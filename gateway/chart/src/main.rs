mod config;
mod market;
mod protocol;
mod store;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use nado_sdk::prelude::ClientMode;
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn};

use crate::config::Config;
use crate::market::{Supervisor, load_symbol_directory, normalize_symbol};
use crate::protocol::{CandlesResponse, ClientMessage, ServerMessage};
use crate::store::CandleStore;

#[derive(Clone)]
struct AppState {
    supervisor: Arc<Supervisor>,
    default_granularity: u32,
    max_snapshot_limit: usize,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    symbols: usize,
    active_series: usize,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    NotFound(String),
    Internal(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadRequest(message) | Self::NotFound(message) | Self::Internal(message) => {
                write!(f, "{message}")
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            Self::NotFound(message) => (StatusCode::NOT_FOUND, message),
            Self::Internal(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
        };
        (status, Json(ErrorResponse { error: message })).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct CandlesQuery {
    symbol: String,
    tf: Option<String>,
    granularity: Option<u32>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct WsCandlesQuery {
    tf: Option<String>,
    granularity: Option<u32>,
    limit: Option<usize>,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    install_rustls_provider();

    let config = Config::from_env()?;
    let store = Arc::new(CandleStore::connect(&config.database_url).await?);
    let directory = load_symbol_directory(&config.client_mode).await?;
    let symbol_count = directory.symbols.len();

    let supervisor = Arc::new(Supervisor::new(
        config.client_mode.clone(),
        config.nado_ws_url.clone(),
        config.nado_archive_url.clone(),
        store,
        config.history_limit,
        config.cache_capacity,
        config.supported_granularities.clone(),
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
        for granularity in &config.prewarm_granularities {
            match supervisor.ensure_series(symbol, *granularity).await {
                Ok(_) => {
                    info!(symbol = %symbol, granularity, "prewarmed chart series");
                }
                Err(err) => {
                    warn!(
                        symbol = %symbol,
                        granularity,
                        error = %err,
                        "failed to prewarm chart series"
                    );
                }
            }
        }
    }

    let app_state = AppState {
        supervisor,
        default_granularity: config.default_granularity,
        max_snapshot_limit: config.history_limit,
    };

    let app = Router::new()
        .route("/health", get(get_health))
        .route("/symbols", get(get_symbols))
        .route("/v1/candles", get(get_candles))
        .route("/ws/v1/candles/:symbol", get(ws_candles))
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
        .with_context(|| format!("invalid CHART_BIND_ADDR={}", config.bind_addr))?;

    info!(
        %addr,
        network = network_label(&config.client_mode),
        symbols = symbol_count,
        default_granularity = config.default_granularity,
        history_limit = config.history_limit,
        "chart gateway ready"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let env_filter = std::env::var("RUST_LOG").unwrap_or_else(|_| "chart_gateway=info".to_string());
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
    let active_series = state.supervisor.active_series().await;
    let symbols = state.supervisor.symbols().len();
    Json(HealthResponse {
        status: "ok",
        symbols,
        active_series,
    })
}

async fn get_symbols(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.supervisor.symbols().to_vec())
}

async fn get_candles(
    State(state): State<AppState>,
    Query(query): Query<CandlesQuery>,
) -> Result<Json<CandlesResponse>, ApiError> {
    let symbol = normalize_symbol(&query.symbol);
    if symbol.is_empty() {
        return Err(ApiError::BadRequest("symbol is required".to_string()));
    }

    let granularity = parse_granularity(
        query.tf.as_deref(),
        query.granularity,
        state.default_granularity,
    )?;

    let limit = query
        .limit
        .unwrap_or(300)
        .clamp(1, state.max_snapshot_limit.max(1));

    let series = state
        .supervisor
        .ensure_series(&symbol, granularity)
        .await
        .map_err(|err| map_ensure_error(err.to_string()))?;

    let candles = series.snapshot(limit).await;

    Ok(Json(CandlesResponse {
        symbol: series.symbol().to_string(),
        product_id: series.product_id(),
        granularity: series.granularity(),
        source: if candles.is_empty() {
            "empty".to_string()
        } else {
            "timeseries-db+cache".to_string()
        },
        candles,
    }))
}

async fn ws_candles(
    Path(symbol): Path<String>,
    State(state): State<AppState>,
    Query(query): Query<WsCandlesQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    let symbol = normalize_symbol(&symbol);
    if symbol.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ServerMessage::Error {
                message: "symbol is required".to_string(),
            }),
        )
            .into_response();
    }

    let granularity = match parse_granularity(
        query.tf.as_deref(),
        query.granularity,
        state.default_granularity,
    ) {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ServerMessage::Error {
                    message: format!("invalid granularity: {err}"),
                }),
            )
                .into_response();
        }
    };

    let limit = query
        .limit
        .unwrap_or(300)
        .clamp(1, state.max_snapshot_limit.max(1));

    let series = match state.supervisor.ensure_series(&symbol, granularity).await {
        Ok(series) => series,
        Err(err) => {
            let message = err.to_string();
            let status = if message.contains("unknown symbol") {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::BAD_REQUEST
            };
            return (status, Json(ServerMessage::Error { message })).into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_ws_client(socket, series, limit))
}

async fn handle_ws_client(
    socket: WebSocket,
    series: Arc<crate::market::SeriesHandle>,
    limit: usize,
) {
    let (subscriber_id, mut updates_rx, snapshot) = series.subscribe(limit).await;

    let (mut sender, mut receiver) = socket.split();
    if send_json(&mut sender, &snapshot).await.is_err() {
        series.unsubscribe(subscriber_id).await;
        return;
    }

    loop {
        tokio::select! {
            maybe_update = updates_rx.recv() => {
                match maybe_update {
                    Some(update) => {
                        if send_json(&mut sender, &update).await.is_err() {
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
                        warn!(error = %err, "chart websocket receive error");
                        break;
                    }
                    None => break,
                }
            }
        }
    }

    series.unsubscribe(subscriber_id).await;
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

fn parse_granularity(
    tf: Option<&str>,
    granularity: Option<u32>,
    default_granularity: u32,
) -> Result<u32, ApiError> {
    if let Some(value) = granularity {
        if value == 0 {
            return Err(ApiError::BadRequest("granularity must be > 0".to_string()));
        }
        return Ok(value);
    }

    if let Some(tf) = tf {
        let normalized = tf.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            return Ok(default_granularity);
        }

        if let Some(value) = timeframe_to_granularity(&normalized) {
            return Ok(value);
        }

        if let Ok(value) = normalized.parse::<u32>() {
            if value > 0 {
                return Ok(value);
            }
        }

        return Err(ApiError::BadRequest(format!("unsupported tf '{tf}'")));
    }

    Ok(default_granularity)
}

fn timeframe_to_granularity(value: &str) -> Option<u32> {
    match value {
        "1m" => Some(60),
        "5m" => Some(300),
        "15m" => Some(900),
        "1h" => Some(3600),
        "2h" => Some(7200),
        "4h" => Some(14400),
        "1d" => Some(86400),
        "1w" => Some(604800),
        "4w" => Some(2419200),
        _ => None,
    }
}

fn map_ensure_error(message: String) -> ApiError {
    if message.contains("unknown symbol") {
        return ApiError::NotFound(message);
    }
    if message.contains("unsupported granularity") {
        return ApiError::BadRequest(message);
    }
    ApiError::Internal(message)
}
