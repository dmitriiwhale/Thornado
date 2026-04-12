mod config;
mod protocol;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use bytes::BytesMut;
use ethers_core::types::H160;
use futures_util::{SinkExt, StreamExt};
use nado_sdk::core::NadoBuilder;
use nado_sdk::eip712_structs::{concat_to_bytes32, to_bytes12};
use nado_sdk::indexer::Balance as IndexerBalance;
use nado_sdk::prelude::{
    ClientMode, NadoClient, NadoIndexer, NadoQuery, Stream, SubscriptionsClient,
    SubscriptionsConfig,
};
use ratchet_rs::deflate::DeflateExtProvider;
use ratchet_rs::{Message as WsMessage, SubprotocolRegistry, WebSocketConfig, subscribe_with};
use rustls::pki_types::ServerName;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_rustls::TlsConnector;
use tokio_rustls::client::TlsStream;
use tower_http::cors::{Any, CorsLayer};
use tracing::{debug, error, info, warn};
use url::Url;

use crate::config::Config;
use crate::protocol::{ClientMessage, PortfolioPayload, ServerMessage};

const SESSION_HEADER: &str = "x-thornado-session-address";

#[derive(Clone)]
struct AppState {
    config: Config,
    nado_client: NadoClient,
    active_ws_clients: Arc<AtomicUsize>,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Upstream(String),
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            Self::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            Self::Upstream(msg) => (StatusCode::BAD_GATEWAY, msg),
            Self::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        warn!(error = %err, "portfolio gateway internal error");
        ApiError::Internal("internal portfolio gateway error".to_string())
    }
}

#[derive(Debug, Deserialize)]
struct PortfolioQuery {
    subaccount_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    network: &'static str,
    gateway_url: String,
    nado_ws_url: Option<String>,
    archive_url: String,
    active_ws_clients: usize,
}

#[derive(Debug, Serialize)]
struct SnapshotEnvelope {
    as_of_ms: u64,
    cause: String,
    portfolio: PortfolioPayload,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    install_rustls_provider();

    let config = Config::from_env()?;

    let mut nado_client = NadoClient::new(config.client_mode.clone());
    if let Some(gateway_url) = &config.gateway_url {
        nado_client = nado_client.with_gateway_url(gateway_url.clone());
    }
    if let Some(archive_url) = &config.archive_url {
        nado_client = nado_client.with_archive_url(archive_url.clone());
    }

    let app_state = AppState {
        config: config.clone(),
        nado_client,
        active_ws_clients: Arc::new(AtomicUsize::new(0)),
    };

    let app = Router::new()
        .route("/health", get(get_health))
        .route("/v1/portfolio/snapshot", get(get_snapshot))
        .route("/ws/v1/portfolio", get(ws_portfolio))
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
        .with_context(|| format!("invalid PORTFOLIO_BIND_ADDR={}", config.bind_addr))?;

    info!(
        %addr,
        network = %network_label(&config.client_mode),
        gateway = %config.gateway_url.clone().unwrap_or_else(|| "<default>".to_string()),
        ws = %config.nado_ws_url.clone().unwrap_or_else(|| "<default>".to_string()),
        archive = %config.archive_url.clone().unwrap_or_else(|| "<default>".to_string()),
        poll_ms = config.poll_ms,
        event_refresh_debounce_ms = config.event_refresh_debounce_ms,
        "portfolio gateway ready"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let env_filter = std::env::var("RUST_LOG").unwrap_or_else(|_| "portfolio=info".to_string());
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

async fn get_health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        network: network_label(&state.config.client_mode),
        gateway_url: state.nado_client.gateway_url.clone(),
        nado_ws_url: state.config.nado_ws_url.clone(),
        archive_url: state.nado_client.archive_url.clone(),
        active_ws_clients: state.active_ws_clients.load(Ordering::Relaxed),
    })
}

async fn get_snapshot(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PortfolioQuery>,
) -> Result<Json<SnapshotEnvelope>, ApiError> {
    let owner = session_address_from_headers(&headers)?;
    let subaccount_name =
        subaccount_name_from_query(query.subaccount_name, &state.config.default_subaccount_name)?;

    let as_of_ms = now_millis();
    let portfolio = fetch_portfolio_payload(&state, owner, &subaccount_name).await?;

    Ok(Json(SnapshotEnvelope {
        as_of_ms,
        cause: "snapshot".to_string(),
        portfolio,
    }))
}

async fn ws_portfolio(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PortfolioQuery>,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    let owner = session_address_from_headers(&headers)?;
    let subaccount_name =
        subaccount_name_from_query(query.subaccount_name, &state.config.default_subaccount_name)?;

    Ok(ws.on_upgrade(move |socket| handle_ws_client(socket, state, owner, subaccount_name)))
}

async fn handle_ws_client(
    socket: WebSocket,
    state: AppState,
    owner: H160,
    subaccount_name: String,
) {
    state.active_ws_clients.fetch_add(1, Ordering::Relaxed);

    let (mut sender, mut receiver) = socket.split();
    let subaccount = concat_to_bytes32(owner.into(), to_bytes12(&subaccount_name));

    let mut seq = 1_u64;
    match fetch_portfolio_payload(&state, owner, &subaccount_name).await {
        Ok(portfolio) => {
            let msg = ServerMessage::Snapshot {
                seq,
                as_of_ms: now_millis(),
                cause: "initial".to_string(),
                portfolio,
            };
            if send_json(&mut sender, &msg).await.is_err() {
                state.active_ws_clients.fetch_sub(1, Ordering::Relaxed);
                return;
            }
        }
        Err(err) => {
            let msg = ServerMessage::Error {
                message: format_error(&err),
            };
            let _ = send_json(&mut sender, &msg).await;
            state.active_ws_clients.fetch_sub(1, Ordering::Relaxed);
            return;
        }
    }

    let mut poll_ticker = tokio::time::interval(Duration::from_millis(state.config.poll_ms));
    poll_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let mut upstream_events = spawn_upstream_event_channel(
        state.config.client_mode.clone(),
        state.config.nado_ws_url.clone(),
        subaccount,
    );
    let mut last_event_refresh =
        Instant::now() - Duration::from_millis(state.config.event_refresh_debounce_ms);

    loop {
        tokio::select! {
            _ = poll_ticker.tick() => {
                seq = seq.saturating_add(1);
                if !send_update(&state, &mut sender, owner, &subaccount_name, seq, "poll").await {
                    break;
                }
            }
            upstream = upstream_events.recv() => {
                match upstream {
                    Some(UpstreamSignal::Event) => {
                        let elapsed_ms = last_event_refresh.elapsed().as_millis() as u64;
                        if elapsed_ms < state.config.event_refresh_debounce_ms {
                            continue;
                        }
                        last_event_refresh = Instant::now();
                        seq = seq.saturating_add(1);
                        if !send_update(&state, &mut sender, owner, &subaccount_name, seq, "event").await {
                            break;
                        }
                    }
                    Some(UpstreamSignal::Disconnected(detail)) => {
                        let status = ServerMessage::Status {
                            status: "degraded".to_string(),
                            detail: format!(
                                "upstream subscription disconnected ({detail}); polling fallback active"
                            ),
                            as_of_ms: now_millis(),
                        };
                        if send_json(&mut sender, &status).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let status = ServerMessage::Status {
                            status: "degraded".to_string(),
                            detail: "upstream subscription disconnected; polling fallback active".to_string(),
                            as_of_ms: now_millis(),
                        };
                        if send_json(&mut sender, &status).await.is_err() {
                            break;
                        }
                        upstream_events = tokio::sync::mpsc::channel(1).1;
                    }
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
                                let msg = ServerMessage::Error { message: "unsupported websocket command".to_string() };
                                if send_json(&mut sender, &msg).await.is_err() {
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
                        warn!(error = %err, "portfolio websocket receive error");
                        break;
                    }
                    None => break,
                }
            }
        }
    }

    state.active_ws_clients.fetch_sub(1, Ordering::Relaxed);
}

async fn send_update(
    state: &AppState,
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    owner: H160,
    subaccount_name: &str,
    seq: u64,
    cause: &str,
) -> bool {
    match fetch_portfolio_payload(state, owner, subaccount_name).await {
        Ok(portfolio) => {
            let message = ServerMessage::Update {
                seq,
                as_of_ms: now_millis(),
                cause: cause.to_string(),
                portfolio,
            };
            send_json(sender, &message).await.is_ok()
        }
        Err(err) => {
            let message = ServerMessage::Status {
                status: "refresh_failed".to_string(),
                detail: format_error(&err),
                as_of_ms: now_millis(),
            };
            send_json(sender, &message).await.is_ok()
        }
    }
}

#[derive(Debug)]
enum UpstreamSignal {
    Event,
    Disconnected(String),
}

fn spawn_upstream_event_channel(
    client_mode: ClientMode,
    nado_ws_url: Option<String>,
    subaccount: [u8; 32],
) -> mpsc::Receiver<UpstreamSignal> {
    let (tx, rx) = mpsc::channel::<UpstreamSignal>(64);

    tokio::spawn(async move {
        let ws_url = subscription_ws_url(&client_mode, nado_ws_url.as_deref());
        let mut reconnect_backoff = Duration::from_secs(1);

        loop {
            if tx.is_closed() {
                break;
            }

            let started_at = Instant::now();
            let disconnect_detail = match run_upstream_event_session(
                &ws_url,
                client_mode.clone(),
                subaccount,
                tx.clone(),
            )
            .await
            {
                Ok(()) => {
                    warn!(
                        ws_url = %ws_url,
                        "upstream subscriptions session ended unexpectedly for portfolio stream"
                    );
                    "upstream subscriptions session ended unexpectedly".to_string()
                }
                Err(err) => {
                    warn!(
                        error = %err,
                        ws_url = %ws_url,
                        "failed to connect upstream subscriptions for portfolio stream"
                    );
                    err.to_string()
                }
            };

            if tx.is_closed() {
                break;
            }

            if tx
                .send(UpstreamSignal::Disconnected(disconnect_detail))
                .await
                .is_err()
            {
                break;
            }

            if started_at.elapsed() >= Duration::from_secs(30) {
                reconnect_backoff = Duration::from_secs(1);
            }

            tokio::time::sleep(reconnect_backoff).await;
            reconnect_backoff = (reconnect_backoff * 2).min(Duration::from_secs(15));
        }
    });

    rx
}

async fn run_upstream_event_session(
    ws_url: &str,
    client_mode: ClientMode,
    subaccount: [u8; 32],
    events_tx: mpsc::Sender<UpstreamSignal>,
) -> Result<()> {
    match run_upstream_event_session_via_ratchet(ws_url, subaccount, events_tx.clone()).await {
        Ok(()) => Ok(()),
        Err(ratchet_err) => {
            warn!(
                error = %ratchet_err,
                ws_url = %ws_url,
                "ratchet upstream subscriptions failed; trying nado-sdk websocket client fallback"
            );
            run_upstream_event_session_via_sdk(ws_url, client_mode, subaccount, events_tx)
                .await
                .map_err(|sdk_err| {
                    anyhow::anyhow!(
                        "upstream subscriptions failed (ratchet: {ratchet_err}; nado-sdk fallback: {sdk_err})"
                    )
                })
        }
    }
}

async fn run_upstream_event_session_via_sdk(
    ws_url: &str,
    client_mode: ClientMode,
    subaccount: [u8; 32],
    events_tx: mpsc::Sender<UpstreamSignal>,
) -> Result<()> {
    let config = SubscriptionsConfig::with_client_mode(client_mode).with_url(ws_url.to_string());
    let mut client = SubscriptionsClient::connect(config).await.map_err(|err| {
        anyhow::anyhow!("failed connecting to upstream subscriptions WS ({ws_url}): {err}")
    })?;

    for stream in [
        Stream::position_change(subaccount, None),
        Stream::fill(subaccount, None),
    ] {
        client.subscribe(stream).await.map_err(|err| {
            anyhow::anyhow!("failed sending subscribe payload via nado-sdk: {err}")
        })?;
    }

    info!(
        ws_url = %ws_url,
        "connected upstream subscriptions via nado-sdk websocket fallback"
    );

    loop {
        match client.next_event().await {
            Some(_event) => {
                if events_tx.send(UpstreamSignal::Event).await.is_err() {
                    return Err(anyhow::anyhow!(
                        "local portfolio websocket channel closed while forwarding upstream update"
                    ));
                }
            }
            None => {
                return Err(anyhow::anyhow!(
                    "upstream nado-sdk websocket stream closed while waiting for events"
                ));
            }
        }
    }
}

async fn run_upstream_event_session_via_ratchet(
    ws_url: &str,
    subaccount: [u8; 32],
    events_tx: mpsc::Sender<UpstreamSignal>,
) -> Result<()> {
    let stream = connect_upstream_stream(ws_url).await?;
    match stream {
        UpstreamStream::Plain(stream) => {
            run_upstream_event_ws(stream, ws_url, subaccount, events_tx).await
        }
        UpstreamStream::Tls(stream) => {
            run_upstream_event_ws(stream, ws_url, subaccount, events_tx).await
        }
    }
}

async fn run_upstream_event_ws<S>(
    stream: S,
    ws_url: &str,
    subaccount: [u8; 32],
    events_tx: mpsc::Sender<UpstreamSignal>,
) -> Result<()>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Send + Unpin + 'static,
{
    let mut websocket = subscribe_with(
        WebSocketConfig::default(),
        stream,
        ws_url,
        &DeflateExtProvider::default(),
        SubprotocolRegistry::default(),
    )
    .await
    .map_err(|err| {
        anyhow::anyhow!(
            "failed connecting to upstream subscriptions WS ({}): {err}",
            ws_url
        )
    })?
    .websocket;

    let streams = [
        Stream::position_change(subaccount, None),
        Stream::fill(subaccount, None),
    ];

    for (request_id, stream) in streams.into_iter().enumerate() {
        let payload = json!({
            "method": "subscribe",
            "id": (request_id + 1) as u64,
            "stream": stream,
        });
        websocket
            .write_text(payload.to_string())
            .await
            .map_err(|err| anyhow::anyhow!("failed sending subscribe payload: {err}"))?;
    }
    websocket
        .flush()
        .await
        .map_err(|err| anyhow::anyhow!("failed flushing subscribe payload: {err}"))?;

    let (tx, mut rx) = websocket
        .split()
        .map_err(|err| anyhow::anyhow!("failed splitting upstream websocket: {err}"))?;
    let ping_task = spawn_ping_task(tx);

    let result = async {
        let mut read_buf = BytesMut::new();
        loop {
            match rx.read(&mut read_buf).await {
                Ok(WsMessage::Text) => {
                    let text = std::str::from_utf8(read_buf.as_ref())
                        .map(|value| value.to_owned())
                        .map_err(|_| anyhow::anyhow!("received invalid utf8 text frame"))?;
                    read_buf.clear();
                    process_upstream_event_text(&events_tx, &text).await?;
                }
                Ok(WsMessage::Binary) => {
                    let text = String::from_utf8(read_buf.to_vec())
                        .map_err(|_| anyhow::anyhow!("received non-utf8 binary frame"))?;
                    read_buf.clear();
                    process_upstream_event_text(&events_tx, &text).await?;
                }
                Ok(WsMessage::Ping(_)) | Ok(WsMessage::Pong(_)) => {
                    read_buf.clear();
                }
                Ok(WsMessage::Close(frame)) => {
                    return Err(anyhow::anyhow!("upstream websocket closed: {:?}", frame));
                }
                Err(err) => {
                    return Err(anyhow::anyhow!("upstream websocket read error: {err}"));
                }
            }
        }
    }
    .await;

    ping_task.abort();
    let _ = ping_task.await;

    result
}

async fn process_upstream_event_text(
    events_tx: &mpsc::Sender<UpstreamSignal>,
    text: &str,
) -> Result<()> {
    let value: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(err) => {
            debug!(
                error = %err,
                payload = %text,
                "ignoring non-json upstream subscriptions payload"
            );
            return Ok(());
        }
    };

    if let Some(error_value) = value.get("error") {
        return Err(anyhow::anyhow!("upstream returned error: {error_value}"));
    }

    if value.get("id").is_some() && value.get("result").is_some() {
        return Ok(());
    }

    if events_tx.send(UpstreamSignal::Event).await.is_err() {
        return Err(anyhow::anyhow!(
            "local portfolio websocket channel closed while forwarding upstream update"
        ));
    }

    Ok(())
}

fn subscription_ws_url(client_mode: &ClientMode, nado_ws_url: Option<&str>) -> String {
    if let Some(url) = nado_ws_url {
        return url.to_string();
    }

    let gateway = client_mode.default_gateway_url();
    let ws_gateway = gateway
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    format!("{}/subscribe", ws_gateway.trim_end_matches('/'))
}

fn spawn_ping_task<S, E>(mut tx: ratchet_rs::Sender<S, E>) -> JoinHandle<()>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Send + Unpin + 'static,
    E: ratchet_rs::ExtensionEncoder + Send + 'static,
{
    tokio::spawn(async move {
        let mut ping_ticker = tokio::time::interval(Duration::from_secs(20));
        ping_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        // Skip the immediate first tick so the first ping is sent after 20s.
        ping_ticker.tick().await;

        loop {
            ping_ticker.tick().await;
            if tx.write_ping([]).await.is_err() {
                break;
            }
            if tx.flush().await.is_err() {
                break;
            }
        }
    })
}

enum UpstreamStream {
    Plain(tokio::net::TcpStream),
    Tls(TlsStream<tokio::net::TcpStream>),
}

async fn connect_upstream_stream(ws_url: &str) -> Result<UpstreamStream> {
    let url = Url::parse(ws_url)
        .map_err(|err| anyhow::anyhow!("invalid upstream ws url '{ws_url}': {err}"))?;
    let host = url
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("upstream ws url is missing host: {ws_url}"))?
        .to_string();
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow::anyhow!("upstream ws url is missing port: {ws_url}"))?;

    let tcp = tokio::net::TcpStream::connect((host.as_str(), port))
        .await
        .map_err(|err| anyhow::anyhow!("failed tcp connect to upstream ws {host}:{port}: {err}"))?;
    let _ = tcp.set_nodelay(true);

    match url.scheme() {
        "ws" => Ok(UpstreamStream::Plain(tcp)),
        "wss" => {
            let server_name = ServerName::try_from(host.clone())
                .map_err(|_| anyhow::anyhow!("invalid tls server name in ws url: {host}"))?;
            let connector = tls_connector();
            let tls = connector.connect(server_name, tcp).await.map_err(|err| {
                anyhow::anyhow!("failed tls connect to upstream ws {host}:{port}: {err}")
            })?;
            Ok(UpstreamStream::Tls(tls))
        }
        scheme => Err(anyhow::anyhow!(
            "unsupported websocket scheme '{scheme}' in upstream ws url: {ws_url}"
        )),
    }
}

fn tls_connector() -> TlsConnector {
    let roots = rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    TlsConnector::from(Arc::new(config))
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

async fn fetch_portfolio_payload(
    state: &AppState,
    owner: H160,
    subaccount_name: &str,
) -> Result<PortfolioPayload, ApiError> {
    let subaccount = concat_to_bytes32(owner.into(), to_bytes12(subaccount_name));

    let subaccount_info = state
        .nado_client
        .get_subaccount_info(subaccount)
        .await
        .map_err(|err| ApiError::Upstream(format!("failed to fetch subaccount summary: {err}")))?;

    let (summary, product_ids, perp_product_ids, symbol_hints) = map_summary(&subaccount_info)?;

    let symbols = fetch_symbols_value(&state.nado_client, &product_ids).await;

    let mut symbol_by_product_id = symbol_hints;
    if let Some(obj) = symbols.get("symbols").and_then(|v| v.as_object()) {
        for value in obj.values() {
            let product_id = value
                .get("productId")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32);
            let symbol = value
                .get("symbol")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let (Some(pid), Some(sym)) = (product_id, symbol) {
                symbol_by_product_id.insert(pid, sym);
            }
        }
    }

    let positions = map_positions(&subaccount_info, &symbol_by_product_id)?;
    let isolated_positions = map_isolated_positions(
        state
            .nado_client
            .get_isolated_positions(subaccount)
            .await
            .ok(),
        &symbol_by_product_id,
    )?;

    let orders = map_orders(
        state
            .nado_client
            .get_historical_orders_builder()
            .subaccounts(vec![subaccount])
            .limit(200)
            .query()
            .await
            .ok(),
        &symbol_by_product_id,
    )?;

    let trades = map_trades(
        state
            .nado_client
            .get_matches_builder()
            .subaccounts(vec![subaccount])
            .limit(120)
            .query()
            .await
            .ok(),
    )?;

    let funding = map_funding(if perp_product_ids.is_empty() {
        None
    } else {
        state
            .nado_client
            .get_interest_and_funding_builder()
            .subaccount(subaccount)
            .product_ids(perp_product_ids.clone())
            .limit(300)
            .query()
            .await
            .ok()
    })?;

    let latest_market_prices = map_latest_market_prices(if perp_product_ids.is_empty() {
        None
    } else {
        state
            .nado_client
            .get_market_prices(perp_product_ids.clone())
            .await
            .ok()
    })?;

    let latest_oracle_prices = map_latest_oracle_prices(if product_ids.is_empty() {
        None
    } else {
        state.nado_client.get_oracle_price(product_ids).await.ok()
    })?;

    let pnl = map_pnl(&summary, &positions, &trades)?;
    let risk = map_risk(&summary)?;

    Ok(PortfolioPayload {
        owner_address: hex_address(owner),
        subaccount_name: subaccount_name.to_string(),
        subaccount: hex_subaccount(subaccount),
        summary,
        positions,
        orders,
        trades,
        funding,
        pnl,
        risk,
        symbols,
        account_snapshot: None,
        isolated_positions,
        latest_market_prices,
        latest_oracle_prices,
    })
}

fn map_summary(
    subaccount_info: &nado_sdk::engine::SubaccountInfoResponse,
) -> Result<(Value, Vec<u32>, Vec<u32>, HashMap<u32, String>), ApiError> {
    let mut balances: Vec<Value> = Vec::new();
    let mut product_ids: Vec<u32> = Vec::new();
    let mut perp_product_ids: Vec<u32> = Vec::new();
    let mut symbols: HashMap<u32, String> = HashMap::new();

    let mut spot_by_id = HashMap::new();
    for product in &subaccount_info.spot_products {
        spot_by_id.insert(product.product_id, product);
    }

    let mut perp_by_id = HashMap::new();
    for product in &subaccount_info.perp_products {
        perp_by_id.insert(product.product_id, product);
    }

    for spot_balance in &subaccount_info.spot_balances {
        let Some(product) = spot_by_id.get(&spot_balance.product_id).copied() else {
            continue;
        };

        product_ids.push(spot_balance.product_id);

        let health_contrib = health_contributions_for(
            &subaccount_info.health_contributions,
            spot_balance.product_id,
        );

        balances.push(json!({
            "type": "spot",
            "productId": spot_balance.product_id,
            "product_id": spot_balance.product_id,
            "amount": spot_balance.balance.amount.to_string(),
            "tokenAddr": hex_address(product.config.token.into()),
            "oraclePrice": x18_to_decimal_string(product.oracle_price_x18),
            "longWeightInitial": x18_to_decimal_string(product.risk.long_weight_initial_x18),
            "longWeightMaintenance": x18_to_decimal_string(product.risk.long_weight_maintenance_x18),
            "shortWeightInitial": x18_to_decimal_string(product.risk.short_weight_initial_x18),
            "shortWeightMaintenance": x18_to_decimal_string(product.risk.short_weight_maintenance_x18),
            "healthContributions": {
                "initial": health_contrib.0,
                "maintenance": health_contrib.1,
                "unweighted": health_contrib.2,
            }
        }));
    }

    for perp_balance in &subaccount_info.perp_balances {
        let Some(product) = perp_by_id.get(&perp_balance.product_id).copied() else {
            continue;
        };

        product_ids.push(perp_balance.product_id);
        perp_product_ids.push(perp_balance.product_id);

        let health_contrib = health_contributions_for(
            &subaccount_info.health_contributions,
            perp_balance.product_id,
        );

        balances.push(json!({
            "type": "perp",
            "productId": perp_balance.product_id,
            "product_id": perp_balance.product_id,
            "amount": perp_balance.balance.amount.to_string(),
            "vQuoteBalance": perp_balance.balance.v_quote_balance.to_string(),
            "oraclePrice": x18_to_decimal_string(product.oracle_price_x18),
            "longWeightInitial": x18_to_decimal_string(product.risk.long_weight_initial_x18),
            "longWeightMaintenance": x18_to_decimal_string(product.risk.long_weight_maintenance_x18),
            "shortWeightInitial": x18_to_decimal_string(product.risk.short_weight_initial_x18),
            "shortWeightMaintenance": x18_to_decimal_string(product.risk.short_weight_maintenance_x18),
            "healthContributions": {
                "initial": health_contrib.0,
                "maintenance": health_contrib.1,
                "unweighted": health_contrib.2,
            }
        }));

        symbols.insert(
            perp_balance.product_id,
            format!("Perp #{}", perp_balance.product_id),
        );
    }

    let health = json!({
        "initial": map_health(subaccount_info.healths.first()),
        "maintenance": map_health(subaccount_info.healths.get(1)),
        "unweighted": map_health(subaccount_info.healths.get(2)),
    });

    Ok((
        json!({
            "exists": subaccount_info.exists,
            "balances": balances,
            "health": health,
        }),
        dedup_u32(product_ids),
        dedup_u32(perp_product_ids),
        symbols,
    ))
}

fn map_health(health: Option<&nado_sdk::bindings::querier::HealthInfo>) -> Value {
    match health {
        Some(v) => json!({
            "health": v.health.to_string(),
            "assets": v.assets.to_string(),
            "liabilities": v.liabilities.to_string(),
        }),
        None => json!({
            "health": "0",
            "assets": "0",
            "liabilities": "0",
        }),
    }
}

fn health_contributions_for(
    contributions: &[Vec<i128>],
    product_id: u32,
) -> (String, String, String) {
    let Some(row) = contributions.get(product_id as usize) else {
        return ("0".to_string(), "0".to_string(), "0".to_string());
    };

    let initial = row.first().copied().unwrap_or_default().to_string();
    let maintenance = row.get(1).copied().unwrap_or_default().to_string();
    let unweighted = row.get(2).copied().unwrap_or_default().to_string();
    (initial, maintenance, unweighted)
}

async fn fetch_symbols_value(client: &NadoClient, product_ids: &[u32]) -> Value {
    if product_ids.is_empty() {
        return json!({ "symbols": {} });
    }

    let response = match client.get_symbols(Some(product_ids.to_vec()), None).await {
        Ok(v) => v,
        Err(err) => {
            warn!(error = %err, "failed to fetch symbols for portfolio payload");
            return json!({ "symbols": {} });
        }
    };

    let mut symbols = serde_json::Map::new();

    for (key, value) in response.symbols {
        symbols.insert(
            key,
            json!({
                "productId": value.product_id,
                "product_id": value.product_id,
                "symbol": value.symbol,
                "type": value.product_type,
            }),
        );
    }

    json!({ "symbols": symbols })
}

fn map_positions(
    subaccount_info: &nado_sdk::engine::SubaccountInfoResponse,
    symbols: &HashMap<u32, String>,
) -> Result<Value, ApiError> {
    let mut rows = Vec::<Value>::new();
    let mut perp_by_id = HashMap::new();
    for product in &subaccount_info.perp_products {
        perp_by_id.insert(product.product_id, product);
    }

    for (idx, perp_balance) in subaccount_info.perp_balances.iter().enumerate() {
        let Some(product) = perp_by_id.get(&perp_balance.product_id).copied() else {
            continue;
        };

        let amount = perp_balance.balance.amount;
        if amount == 0 {
            continue;
        }

        let size = x18_to_f64(amount.abs());
        let mark = x18_to_f64(product.oracle_price_x18);
        let notional = size * mark;
        let side = if amount > 0 { "LONG" } else { "SHORT" };

        let entry = if amount != 0 {
            let v_quote = perp_balance.balance.v_quote_balance;
            let implied = -((v_quote as f64) / (amount as f64));
            if implied.is_finite() {
                Some(implied)
            } else {
                None
            }
        } else {
            None
        };

        let pnl = x18_to_f64(perp_balance.balance.v_quote_balance);

        rows.push(json!({
            "id": format!("pos-{}-{}", perp_balance.product_id, idx),
            "productId": perp_balance.product_id,
            "market": symbols.get(&perp_balance.product_id).cloned().unwrap_or_else(|| format!("Perp #{}", perp_balance.product_id)),
            "side": side,
            "size": size,
            "entry": entry,
            "mark": mark,
            "pnl": pnl,
            "notional": notional,
            "isolated": false,
        }));
    }

    Ok(Value::Array(rows))
}

fn map_isolated_positions(
    response: Option<nado_sdk::engine::IsolatedPositionsResponse>,
    symbols: &HashMap<u32, String>,
) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(Value::Array(vec![]));
    };

    let mut rows = Vec::new();
    for row in response.isolated_positions {
        let product_id = row.base_balance.product_id;
        let name = symbols
            .get(&product_id)
            .cloned()
            .unwrap_or_else(|| format!("Perp #{}", product_id));

        let base_health = (
            row.base_healths
                .first()
                .copied()
                .unwrap_or_default()
                .to_string(),
            row.base_healths
                .get(1)
                .copied()
                .unwrap_or_default()
                .to_string(),
            row.base_healths
                .get(2)
                .copied()
                .unwrap_or_default()
                .to_string(),
        );

        rows.push(json!({
            "subaccount": {
                "subaccountName": null,
            },
            "healths": {
                "initial": row.healths.first().map(|h| h.health.to_string()).unwrap_or_else(|| "0".to_string()),
                "maintenance": row.healths.get(1).map(|h| h.health.to_string()).unwrap_or_else(|| "0".to_string()),
                "unweighted": row.healths.get(2).map(|h| h.health.to_string()).unwrap_or_else(|| "0".to_string()),
            },
            "baseBalance": {
                "productId": product_id,
                "market": name,
                "amount": row.base_balance.balance.amount.to_string(),
                "vQuoteBalance": row.base_balance.balance.v_quote_balance.to_string(),
                "oraclePrice": x18_to_decimal_string(row.base_product.oracle_price_x18),
                "longWeightInitial": x18_to_decimal_string(row.base_product.risk.long_weight_initial_x18),
                "longWeightMaintenance": x18_to_decimal_string(row.base_product.risk.long_weight_maintenance_x18),
                "shortWeightInitial": x18_to_decimal_string(row.base_product.risk.short_weight_initial_x18),
                "shortWeightMaintenance": x18_to_decimal_string(row.base_product.risk.short_weight_maintenance_x18),
                "healthContributions": {
                    "initial": base_health.0,
                    "maintenance": base_health.1,
                    "unweighted": base_health.2,
                },
            },
            "quoteBalance": {
                "productId": row.quote_balance.product_id,
                "amount": row.quote_balance.balance.amount.to_string(),
                "oraclePrice": x18_to_decimal_string(row.quote_product.oracle_price_x18),
            }
        }));
    }

    Ok(Value::Array(rows))
}

fn map_orders(
    response: Option<nado_sdk::indexer::OrdersResponse>,
    symbols: &HashMap<u32, String>,
) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(Value::Array(vec![]));
    };

    let mut rows = Vec::new();

    for order in response.orders {
        let total = order.amount;
        let closed = order.closed_amount;
        let open_amount = total.abs().saturating_sub(closed.abs());
        if open_amount == 0 {
            continue;
        }

        let product_id = if order.product_id < 0 {
            continue;
        } else {
            order.product_id as u32
        };

        let market = symbols
            .get(&product_id)
            .cloned()
            .unwrap_or_else(|| format!("Perp #{}", product_id));

        let side = if order.amount >= 0 { "LONG" } else { "SHORT" };

        rows.push(json!({
            "id": hex_digest(order.digest),
            "productId": product_id,
            "market": market,
            "side": side,
            "price": x18_to_decimal_string(order.price_x18),
            "size": x18_to_decimal_string(open_amount),
            "status": "OPEN",
            "createdAt": order.last_fill_timestamp.saturating_mul(1000),
        }));
    }

    Ok(Value::Array(rows))
}

fn map_trades(response: Option<nado_sdk::indexer::MatchesResponse>) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(json!({ "events": [] }));
    };

    let mut ts_by_submission: HashMap<u64, u64> = HashMap::new();
    for tx in response.txs {
        ts_by_submission.insert(tx.submission_idx, tx.timestamp.saturating_mul(1000));
    }

    let mut events = Vec::new();

    for m in response.matches {
        let product_id = indexer_balance_product_id(&m.pre_balance.base)
            .or_else(|| indexer_balance_product_id(&m.post_balance.base))
            .unwrap_or_default();
        let base_pre = indexer_balance_amount(&m.pre_balance.base).unwrap_or_default();
        let base_post = indexer_balance_amount(&m.post_balance.base).unwrap_or_default();
        let quote_pre = m
            .pre_balance
            .quote
            .as_ref()
            .and_then(indexer_balance_amount)
            .unwrap_or_default();
        let quote_post = m
            .post_balance
            .quote
            .as_ref()
            .and_then(indexer_balance_amount)
            .unwrap_or_default();

        events.push(json!({
            "productId": product_id,
            "submissionIndex": m.submission_idx,
            "baseFilled": m.base_filled.to_string(),
            "quoteFilled": m.quote_filled.to_string(),
            "totalFee": m.fee.to_string(),
            "realizedPnl": m.realized_pnl.to_string(),
            "timestamp": ts_by_submission.get(&m.submission_idx).copied().unwrap_or(0),
            "digest": hex_digest(m.digest),
            "order": {
                "amount": m.order.amount.to_string(),
            },
            "preBalances": {
                "base": { "amount": base_pre.to_string() },
                "quote": { "amount": quote_pre.to_string() },
            },
            "postBalances": {
                "base": { "amount": base_post.to_string() },
                "quote": { "amount": quote_post.to_string() },
            }
        }));
    }

    Ok(json!({ "events": events }))
}

fn map_funding(
    response: Option<nado_sdk::indexer::InterestAndFundingTicksResponse>,
) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(json!({
            "fundingPayments": [],
            "interestPayments": [],
        }));
    };

    let funding_payments: Vec<Value> = response
        .funding_payments
        .into_iter()
        .map(|p| {
            json!({
                "productId": p.product_id,
                "product_id": p.product_id,
                "timestamp": p.timestamp,
                "paymentAmount": p.amount.to_string(),
                "annualPaymentRate": x18_to_decimal_string(p.rate_x18),
                "oraclePrice": x18_to_decimal_string(p.oracle_price_x18),
                "isolated": p.isolated,
            })
        })
        .collect();

    let interest_payments: Vec<Value> = response
        .interest_payments
        .into_iter()
        .map(|p| {
            json!({
                "productId": p.product_id,
                "product_id": p.product_id,
                "timestamp": p.timestamp,
                "paymentAmount": p.amount.to_string(),
                "annualPaymentRate": x18_to_decimal_string(p.rate_x18),
                "oraclePrice": x18_to_decimal_string(p.oracle_price_x18),
                "isolated": p.isolated,
            })
        })
        .collect();

    Ok(json!({
        "fundingPayments": funding_payments,
        "interestPayments": interest_payments,
    }))
}

fn map_latest_market_prices(
    response: Option<nado_sdk::engine::MarketPricesResponse>,
) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(Value::Array(vec![]));
    };

    let rows = response
        .market_prices
        .into_iter()
        .map(|price| {
            let bid = x18_to_f64(price.bid_x18);
            let ask = x18_to_f64(price.ask_x18);
            let mark = (bid + ask) / 2.0;
            json!({
                "productId": price.product_id,
                "bid": bid,
                "ask": ask,
                "markPrice": mark,
            })
        })
        .collect();

    Ok(Value::Array(rows))
}

fn map_latest_oracle_prices(
    response: Option<nado_sdk::indexer::OraclePriceResponse>,
) -> Result<Value, ApiError> {
    let Some(response) = response else {
        return Ok(Value::Array(vec![]));
    };

    let rows = response
        .prices
        .into_iter()
        .map(|price| {
            json!({
                "productId": price.product_id,
                "oraclePrice": x18_to_f64(price.oracle_price_x18),
                "updateTime": price.update_time,
            })
        })
        .collect();

    Ok(Value::Array(rows))
}

fn map_pnl(summary: &Value, positions: &Value, trades: &Value) -> Result<Value, ApiError> {
    let unrealized = positions
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|row| row.get("pnl").and_then(Value::as_f64))
                .sum::<f64>()
        })
        .unwrap_or(0.0);

    let realized = trades
        .get("events")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    row.get("realizedPnl")
                        .and_then(Value::as_str)
                        .and_then(|v| v.parse::<f64>().ok())
                        .map(|v| v / 1e18)
                })
                .sum::<f64>()
        })
        .unwrap_or(0.0);

    let equity = summary
        .get("health")
        .and_then(|h| h.get("unweighted"))
        .and_then(|h| h.get("assets"))
        .and_then(Value::as_str)
        .and_then(|assets| assets.parse::<f64>().ok())
        .zip(
            summary
                .get("health")
                .and_then(|h| h.get("unweighted"))
                .and_then(|h| h.get("liabilities"))
                .and_then(Value::as_str)
                .and_then(|liab| liab.parse::<f64>().ok()),
        )
        .map(|(assets, liab)| (assets - liab) / 1e18)
        .unwrap_or(0.0);

    Ok(json!({
        "equity": equity,
        "unrealizedPnl": unrealized,
        "realizedPnl": realized,
    }))
}

fn map_risk(summary: &Value) -> Result<Value, ApiError> {
    let maintenance_health = summary
        .get("health")
        .and_then(|h| h.get("maintenance"))
        .and_then(|h| h.get("health"))
        .cloned()
        .unwrap_or_else(|| Value::String("0".to_string()));

    Ok(json!({
        "maintenanceHealth": maintenance_health,
    }))
}

fn indexer_balance_amount(balance: &IndexerBalance) -> Option<i128> {
    match balance {
        IndexerBalance::Spot(v) => Some(v.balance.amount),
        IndexerBalance::Perp(v) => Some(v.balance.amount),
        IndexerBalance::Pending => None,
    }
}

fn indexer_balance_product_id(balance: &IndexerBalance) -> Option<u32> {
    match balance {
        IndexerBalance::Spot(v) => Some(v.product_id),
        IndexerBalance::Perp(v) => Some(v.product_id),
        IndexerBalance::Pending => None,
    }
}

fn format_error(err: &ApiError) -> String {
    match err {
        ApiError::BadRequest(msg)
        | ApiError::Unauthorized(msg)
        | ApiError::Upstream(msg)
        | ApiError::Internal(msg) => msg.clone(),
    }
}

fn subaccount_name_from_query(
    maybe_name: Option<String>,
    default_subaccount_name: &str,
) -> Result<String, ApiError> {
    let subaccount_name = maybe_name
        .unwrap_or_else(|| default_subaccount_name.to_string())
        .trim()
        .to_string();

    if subaccount_name.is_empty() {
        return Err(ApiError::BadRequest(
            "subaccount_name cannot be empty".to_string(),
        ));
    }

    if subaccount_name.len() > 12 {
        return Err(ApiError::BadRequest(format!(
            "subaccount_name is too long ({} > 12)",
            subaccount_name.len()
        )));
    }

    Ok(subaccount_name)
}

fn session_address_from_headers(headers: &HeaderMap) -> Result<H160, ApiError> {
    let value = headers
        .get(SESSION_HEADER)
        .ok_or_else(|| ApiError::Unauthorized("missing session address header".to_string()))?;

    let value = value
        .to_str()
        .map_err(|_| ApiError::Unauthorized("invalid session address header".to_string()))?;

    H160::from_str(value)
        .map_err(|_| ApiError::Unauthorized(format!("invalid session address: {value}")))
}

fn hex_address(address: H160) -> String {
    format!("0x{}", hex::encode(address.as_bytes()))
}

fn hex_subaccount(subaccount: [u8; 32]) -> String {
    format!("0x{}", hex::encode(subaccount))
}

fn hex_digest(digest: [u8; 32]) -> String {
    format!("0x{}", hex::encode(digest))
}

fn x18_to_decimal_string(value: i128) -> String {
    let sign = if value < 0 { "-" } else { "" };
    let abs = value.unsigned_abs();
    let int_part = abs / 1_000_000_000_000_000_000_u128;
    let frac_part = abs % 1_000_000_000_000_000_000_u128;

    if frac_part == 0 {
        return format!("{sign}{int_part}");
    }

    let mut frac = format!("{frac_part:018}");
    while frac.ends_with('0') {
        frac.pop();
    }

    format!("{sign}{int_part}.{frac}")
}

fn x18_to_f64(value: i128) -> f64 {
    value as f64 / 1e18_f64
}

fn dedup_u32(values: Vec<u32>) -> Vec<u32> {
    let mut set = std::collections::BTreeSet::new();
    for v in values {
        set.insert(v);
    }
    set.into_iter().collect()
}

fn now_millis() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as u64
}
