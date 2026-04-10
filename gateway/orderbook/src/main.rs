mod config;
mod market;
mod orderbook_state;
mod protocol;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn};

use crate::config::Config;
use crate::market::{Supervisor, load_symbol_directory};
use crate::protocol::{ClientMessage, ServerMessage};

#[derive(Clone)]
struct AppState {
    supervisor: Arc<Supervisor>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    active_markets: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    install_rustls_provider();

    let config = Config::from_env()?;
    info!(
        bind_addr = %config.bind_addr,
        depth = config.depth,
        network = %network_label(&config),
        prewarm_all = config.prewarm_all,
        "starting orderbook gateway"
    );

    let directory = load_symbol_directory(&config.client_mode).await?;
    let symbol_count = directory.symbols.len();

    let supervisor = Arc::new(Supervisor::new(
        config.client_mode.clone(),
        config.nado_ws_url.clone(),
        config.depth,
        directory,
    ));

    let mut symbols_to_prewarm = config.prewarm_symbols.clone();
    if config.prewarm_all {
        symbols_to_prewarm = supervisor
            .symbols()
            .iter()
            .map(|entry| entry.symbol.clone())
            .collect();
    }

    for symbol in &symbols_to_prewarm {
        match supervisor.ensure_market(symbol).await {
            Ok(_) => info!(symbol = %symbol, "prewarmed market worker"),
            Err(err) => warn!(symbol = %symbol, error = %err, "failed to prewarm market worker"),
        }
    }

    let app_state = AppState {
        supervisor: supervisor.clone(),
    };

    let app = Router::new()
        .route("/health", get(get_health))
        .route("/symbols", get(get_symbols))
        .route("/ws/v1/orderbook/:symbol", get(ws_orderbook))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET])
                .allow_headers(Any),
        )
        .with_state(app_state);

    let addr: SocketAddr = config
        .bind_addr
        .parse()
        .with_context(|| format!("invalid ORDERBOOK_BIND_ADDR={}", config.bind_addr))?;

    info!(%addr, symbols = symbol_count, "orderbook gateway ready");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let env_filter = std::env::var("RUST_LOG").unwrap_or_else(|_| "orderbook=info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .compact()
        .init();
}

fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn network_label(config: &Config) -> &'static str {
    match &config.client_mode {
        nado_sdk::prelude::ClientMode::Test => "test",
        nado_sdk::prelude::ClientMode::Prod => "prod",
        nado_sdk::prelude::ClientMode::Local => "local",
        nado_sdk::prelude::ClientMode::LocalAlt => "local-alt",
    }
}

async fn get_health(State(state): State<AppState>) -> impl IntoResponse {
    let active_markets = state.supervisor.active_markets().await;
    Json(HealthResponse {
        status: "ok",
        active_markets,
    })
}

async fn get_symbols(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.supervisor.symbols().to_vec())
}

async fn ws_orderbook(
    Path(symbol): Path<String>,
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> Response {
    let market = match state.supervisor.ensure_market(&symbol).await {
        Ok(market) => market,
        Err(err) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ServerMessage::Error {
                    message: err.to_string(),
                }),
            )
                .into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_ws_client(socket, market))
}

async fn handle_ws_client(socket: WebSocket, market: Arc<crate::market::MarketHandle>) {
    let (subscriber_id, mut updates_rx, snapshot) = market.subscribe().await;
    let symbol = market.symbol().to_string();
    let product_id = market.product_id();

    let (mut sender, mut receiver) = socket.split();

    if let Some(snapshot) = snapshot {
        if send_json(&mut sender, &snapshot).await.is_err() {
            market.unsubscribe(subscriber_id).await;
            return;
        }
    } else {
        let warming = ServerMessage::Status {
            symbol: symbol.clone(),
            product_id,
            status: "warming_up".to_string(),
            detail: "waiting for first snapshot".to_string(),
        };
        if send_json(&mut sender, &warming).await.is_err() {
            market.unsubscribe(subscriber_id).await;
            return;
        }
    }

    loop {
        tokio::select! {
            maybe_update = updates_rx.recv() => {
                match maybe_update {
                    Some(message) => {
                        if send_json(&mut sender, &message).await.is_err() {
                            break;
                        }
                    }
                    None => break,
                }
            }
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(client_message) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_message {
                                ClientMessage::Ping { ts } => {
                                    let pong = ServerMessage::Pong { ts: ts.unwrap_or_else(now_millis) };
                                    if send_json(&mut sender, &pong).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) => break,
                    Some(Ok(_)) => {}
                    Some(Err(err)) => {
                        warn!(symbol = %symbol, error = %err, "websocket receive error");
                        break;
                    }
                    None => break,
                }
            }
        }
    }

    market.unsubscribe(subscriber_id).await;
    info!(symbol = %symbol, product_id, "frontend websocket disconnected");
}

async fn send_json(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    message: &ServerMessage,
) -> Result<()> {
    let text = serde_json::to_string(message)?;
    sender
        .send(Message::Text(text.into()))
        .await
        .map_err(|err| {
            error!(error = %err, "failed to send websocket message");
            anyhow::anyhow!(err)
        })
}

fn now_millis() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as u64
}
