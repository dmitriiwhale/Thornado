mod config;
mod protocol;
mod service;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::Method;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use nado_sdk::prelude::ClientMode;
use serde::Serialize;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn};

use crate::config::Config;
use crate::protocol::{ClientMessage, ServerMessage};
use crate::service::MarketsService;

#[derive(Clone)]
struct AppState {
    service: Arc<MarketsService>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    markets: usize,
    seq: u64,
    subscribers: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    install_rustls_provider();

    let config = Config::from_env()?;
    info!(
        bind_addr = %config.bind_addr,
        network = %network_label(&config.client_mode),
        symbols_refresh_ms = config.symbols_refresh_ms,
        tickers_poll_ms = config.tickers_poll_ms,
        contracts_poll_ms = config.contracts_poll_ms,
        stale_after_ms = config.stale_after_ms,
        funding_interval_hours = config.funding_interval_hours,
        "starting markets gateway"
    );

    let service = Arc::new(MarketsService::new(config.clone()));
    service.bootstrap().await?;
    service.spawn_pollers();

    let app_state = AppState { service };

    let app = Router::new()
        .route("/health", get(get_health))
        .route("/symbols", get(get_symbols))
        .route("/markets/snapshot", get(get_snapshot))
        .route("/ws/v1/markets", get(ws_markets))
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
        .with_context(|| format!("invalid MARKETS_BIND_ADDR={}", config.bind_addr))?;

    info!(%addr, "markets gateway ready");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let env_filter =
        std::env::var("RUST_LOG").unwrap_or_else(|_| "markets_gateway=info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .compact()
        .init();
}

fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn network_label(mode: &ClientMode) -> &'static str {
    match mode {
        ClientMode::Test => "test",
        ClientMode::Prod => "prod",
        ClientMode::Local => "local",
        ClientMode::LocalAlt => "local-alt",
    }
}

async fn get_health(State(state): State<AppState>) -> impl IntoResponse {
    let markets = state.service.markets_count().await;
    let seq = state.service.sequence().await;
    let subscribers = state.service.subscriber_count();

    Json(HealthResponse {
        status: "ok",
        markets,
        seq,
        subscribers,
    })
}

async fn get_symbols(State(state): State<AppState>) -> impl IntoResponse {
    let snapshot = state.service.snapshot().await;
    Json(snapshot.markets)
}

async fn get_snapshot(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.service.snapshot().await)
}

async fn ws_markets(State(state): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| handle_ws_client(socket, state.service))
}

async fn handle_ws_client(socket: WebSocket, service: Arc<MarketsService>) {
    let (mut sender, mut receiver) = socket.split();
    let mut updates_rx = service.subscribe();

    let snapshot = service.snapshot().await;
    let snapshot_message = ServerMessage::Snapshot {
        seq: snapshot.seq,
        source_ts: snapshot.source_ts,
        markets: snapshot.markets,
    };

    if send_json(&mut sender, &snapshot_message).await.is_err() {
        return;
    }

    loop {
        tokio::select! {
            update = updates_rx.recv() => {
                match update {
                    Ok(message) => {
                        if send_json(&mut sender, &message).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        let status = ServerMessage::Status {
                            status: "lagged".to_string(),
                            detail: format!("skipped {skipped} market updates"),
                            source_ts: now_millis(),
                        };
                        if send_json(&mut sender, &status).await.is_err() {
                            break;
                        }

                        let snapshot = service.snapshot().await;
                        let message = ServerMessage::Snapshot {
                            seq: snapshot.seq,
                            source_ts: snapshot.source_ts,
                            markets: snapshot.markets,
                        };
                        if send_json(&mut sender, &message).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(ClientMessage::Ping { ts }) => {
                                let pong = ServerMessage::Pong { ts: ts.unwrap_or_else(now_millis) };
                                if send_json(&mut sender, &pong).await.is_err() {
                                    break;
                                }
                            }
                            Err(_) => {
                                let error_message = ServerMessage::Error {
                                    message: "unsupported websocket command".to_string(),
                                };
                                if send_json(&mut sender, &error_message).await.is_err() {
                                    break;
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
                        warn!(error = %err, "websocket receive error");
                        break;
                    }
                    None => break,
                }
            }
        }
    }
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
