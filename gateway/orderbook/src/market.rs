use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{Result, anyhow};
use bytes::BytesMut;
use nado_sdk::prelude::*;
use ratchet_rs::deflate::DeflateExtProvider;
use ratchet_rs::{Message as WsMessage, SubprotocolRegistry, WebSocketConfig, subscribe_with};
use rustls::pki_types::ServerName;
use serde_json::Value;
use tokio::sync::{Mutex, RwLock, mpsc};
use tokio::task::JoinHandle;
use tokio::time::MissedTickBehavior;
use tokio_rustls::TlsConnector;
use tokio_rustls::client::TlsStream;
use tracing::{debug, error, info, warn};
use url::Url;

use crate::orderbook_state::{ApplyOutcome, BookDelta, LevelDelta, OrderBookState};
use crate::protocol::{ServerMessage, SymbolInfo};

#[derive(Debug, Clone)]
pub struct SymbolDirectory {
    pub symbols: Vec<SymbolInfo>,
    pub lookup: HashMap<String, u32>,
}

pub async fn load_symbol_directory(mode: &ClientMode) -> Result<SymbolDirectory> {
    let client = NadoClient::new(mode.clone());
    let symbols = client
        .get_symbols(None, Some("perp".to_string()))
        .await
        .map_err(|err| anyhow!("failed to query symbols from Nado: {err}"))?;

    let mut list: Vec<SymbolInfo> = Vec::with_capacity(symbols.symbols.len());
    let mut lookup: HashMap<String, u32> = HashMap::with_capacity(symbols.symbols.len() * 2);

    for data in symbols.symbols.into_values() {
        let canonical = normalize_symbol(&data.symbol);
        if canonical.is_empty() {
            continue;
        }

        list.push(SymbolInfo {
            symbol: canonical.clone(),
            product_id: data.product_id,
        });
        lookup.insert(canonical.clone(), data.product_id);

        // Allow short aliases for symbols like BTC-PERP_USDC -> BTC-PERP
        if let Some((alias, _)) = canonical.split_once('_') {
            let alias = alias.trim().to_string();
            if !alias.is_empty() {
                lookup.entry(alias).or_insert(data.product_id);
            }
        }
    }

    list.sort_by(|a, b| a.symbol.cmp(&b.symbol));
    list.dedup_by(|a, b| a.symbol == b.symbol);

    if list.is_empty() {
        anyhow::bail!("no perp symbols returned from Nado");
    }

    Ok(SymbolDirectory {
        symbols: list,
        lookup,
    })
}

pub fn normalize_symbol(symbol: &str) -> String {
    symbol.trim().to_uppercase()
}

pub struct Supervisor {
    client_mode: ClientMode,
    nado_ws_url: Option<String>,
    depth: usize,
    symbols: Vec<SymbolInfo>,
    lookup: HashMap<String, u32>,
    markets: Mutex<HashMap<String, Arc<MarketHandle>>>,
}

impl Supervisor {
    pub fn new(
        client_mode: ClientMode,
        nado_ws_url: Option<String>,
        depth: usize,
        directory: SymbolDirectory,
    ) -> Self {
        Self {
            client_mode,
            nado_ws_url,
            depth,
            symbols: directory.symbols,
            lookup: directory.lookup,
            markets: Mutex::new(HashMap::new()),
        }
    }

    pub fn symbols(&self) -> &[SymbolInfo] {
        &self.symbols
    }

    pub async fn ensure_market(&self, symbol: &str) -> Result<Arc<MarketHandle>> {
        let normalized = normalize_symbol(symbol);

        if let Some(existing) = self.markets.lock().await.get(&normalized).cloned() {
            return Ok(existing);
        }

        let Some(product_id) = self.lookup.get(&normalized).copied() else {
            anyhow::bail!("unknown symbol '{symbol}'");
        };

        let handle = Arc::new(MarketHandle::new(
            normalized.clone(),
            product_id,
            self.depth,
            self.client_mode.clone(),
            self.nado_ws_url.clone(),
        ));

        {
            let mut markets = self.markets.lock().await;
            if let Some(existing) = markets.get(&normalized) {
                return Ok(existing.clone());
            }
            markets.insert(normalized.clone(), handle.clone());
        }

        handle.clone().spawn();
        Ok(handle)
    }

    pub async fn active_markets(&self) -> usize {
        self.markets.lock().await.len()
    }
}

pub struct MarketHandle {
    symbol: String,
    product_id: u32,
    depth: usize,
    client_mode: ClientMode,
    nado_ws_url: Option<String>,

    state: RwLock<OrderBookState>,
    seq: AtomicU64,

    next_subscriber_id: AtomicU64,
    subscribers: Mutex<HashMap<u64, mpsc::UnboundedSender<ServerMessage>>>,
}

impl MarketHandle {
    fn new(
        symbol: String,
        product_id: u32,
        depth: usize,
        client_mode: ClientMode,
        nado_ws_url: Option<String>,
    ) -> Self {
        Self {
            symbol,
            product_id,
            depth,
            client_mode,
            nado_ws_url,
            state: RwLock::new(OrderBookState::default()),
            seq: AtomicU64::new(1),
            next_subscriber_id: AtomicU64::new(1),
            subscribers: Mutex::new(HashMap::new()),
        }
    }

    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    pub fn product_id(&self) -> u32 {
        self.product_id
    }

    pub fn spawn(self: Arc<Self>) {
        tokio::spawn(async move {
            self.run_worker_loop().await;
        });
    }

    pub async fn subscribe(
        &self,
    ) -> (
        u64,
        mpsc::UnboundedReceiver<ServerMessage>,
        Option<ServerMessage>,
    ) {
        let (tx, rx) = mpsc::unbounded_channel();
        let id = self.next_subscriber_id.fetch_add(1, Ordering::Relaxed);
        self.subscribers.lock().await.insert(id, tx);
        let snapshot = self.snapshot_message().await;
        (id, rx, snapshot)
    }

    pub async fn unsubscribe(&self, subscriber_id: u64) {
        self.subscribers.lock().await.remove(&subscriber_id);
    }

    async fn snapshot_message(&self) -> Option<ServerMessage> {
        let state = self.state.read().await;
        if state.is_empty() {
            return None;
        }

        let seq = self.next_seq();
        Some(ServerMessage::Snapshot {
            symbol: self.symbol.clone(),
            product_id: self.product_id,
            seq,
            source_ts: state.last_ts(),
            depth: state.depth_view(self.depth),
        })
    }

    async fn run_worker_loop(self: &Arc<Self>) {
        let mut backoff = Duration::from_secs(1);

        loop {
            self.emit(ServerMessage::Status {
                symbol: self.symbol.clone(),
                product_id: self.product_id,
                status: "connecting".to_string(),
                detail: "connecting to nado".to_string(),
            })
            .await;

            match self.run_stream_once().await {
                Ok(()) => {
                    warn!(symbol = %self.symbol, "upstream stream ended unexpectedly");
                }
                Err(err) => {
                    error!(symbol = %self.symbol, error = %err, "market worker iteration failed");
                    self.emit(ServerMessage::Status {
                        symbol: self.symbol.clone(),
                        product_id: self.product_id,
                        status: "reconnecting".to_string(),
                        detail: err.to_string(),
                    })
                    .await;
                }
            }

            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(Duration::from_secs(15));
        }
    }

    async fn run_stream_once(self: &Arc<Self>) -> Result<()> {
        let ws_url = self.subscription_ws_url();
        let stream = connect_upstream_stream(&ws_url).await?;
        match stream {
            UpstreamStream::Plain(stream) => self.run_upstream_session(stream, &ws_url).await,
            UpstreamStream::Tls(stream) => self.run_upstream_session(stream, &ws_url).await,
        }
    }

    async fn run_upstream_session<S>(&self, stream: S, ws_url: &str) -> Result<()>
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
            anyhow!(
                "failed connecting to upstream subscriptions WS ({}): {err}",
                ws_url
            )
        })?
        .websocket;

        // Start streaming first, then fetch snapshot, so we can bridge the race window safely.
        let streams = [("book_depth", Stream::book_depth(self.product_id))];

        for (request_id, (stream_name, stream)) in streams.into_iter().enumerate() {
            let subscribe_payload = serde_json::json!({
                "method": "subscribe",
                "id": (request_id + 1) as u64,
                "stream": stream,
            });
            websocket
                .write_text(subscribe_payload.to_string())
                .await
                .map_err(|err| {
                    anyhow!(
                        "failed sending {stream_name} subscribe payload for symbol={} product_id={}: {err}",
                        self.symbol,
                        self.product_id
                    )
                })?;
        }
        websocket
            .flush()
            .await
            .map_err(|err| anyhow!("failed flushing subscribe payload: {err}"))?;

        info!(
            symbol = %self.symbol,
            product_id = self.product_id,
            "book_depth subscribed"
        );
        self.emit(ServerMessage::Status {
            symbol: self.symbol.clone(),
            product_id: self.product_id,
            status: "connected".to_string(),
            detail: "subscribed to nado book_depth".to_string(),
        })
        .await;

        let (tx, mut rx) = websocket
            .split()
            .map_err(|err| anyhow!("failed splitting upstream websocket: {err}"))?;
        let ping_task = spawn_ping_task(tx);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<UpstreamInbound>();
        let reader_task = tokio::spawn(async move {
            let mut read_buf = BytesMut::new();

            loop {
                match rx.read(&mut read_buf).await {
                    Ok(WsMessage::Text) => {
                        let text = match std::str::from_utf8(read_buf.as_ref()) {
                            Ok(text) => text.to_owned(),
                            Err(_) => {
                                let _ = event_tx.send(UpstreamInbound::Error(
                                    "received invalid utf8 text frame".to_string(),
                                ));
                                break;
                            }
                        };
                        read_buf.clear();
                        if event_tx.send(UpstreamInbound::Text(text)).is_err() {
                            break;
                        }
                    }
                    Ok(WsMessage::Binary) => {
                        let text = match String::from_utf8(read_buf.to_vec()) {
                            Ok(text) => text,
                            Err(_) => {
                                let _ = event_tx.send(UpstreamInbound::Error(
                                    "received non-utf8 upstream binary frame".to_string(),
                                ));
                                break;
                            }
                        };
                        read_buf.clear();
                        if event_tx.send(UpstreamInbound::Text(text)).is_err() {
                            break;
                        }
                    }
                    Ok(WsMessage::Ping(_)) | Ok(WsMessage::Pong(_)) => {
                        read_buf.clear();
                    }
                    Ok(WsMessage::Close(frame)) => {
                        let _ = event_tx.send(UpstreamInbound::Closed(format!(
                            "upstream websocket closed: {:?}",
                            frame
                        )));
                        break;
                    }
                    Err(err) => {
                        let _ = event_tx.send(UpstreamInbound::Error(format!(
                            "upstream websocket read error: {err}"
                        )));
                        break;
                    }
                }
            }
        });

        let result = async {
            let client = NadoClient::new(self.client_mode.clone());
            let snapshot = client
                .get_market_liquidity(self.product_id, self.depth as u32)
                .await
                .map_err(|err| {
                    format!(
                        "failed get_market_liquidity for symbol={} product_id={}: {err}",
                        self.symbol, self.product_id
                    )
                })
                .map_err(anyhow::Error::msg)?;

            {
                let mut state = self.state.write().await;
                state.reset_from_snapshot(&snapshot.bids, &snapshot.asks, snapshot.timestamp);
            }
            self.emit_snapshot(snapshot.timestamp).await;

            loop {
                match event_rx.try_recv() {
                    Ok(UpstreamInbound::Text(text)) => {
                        self.handle_upstream_json_text(&text).await?
                    }
                    Ok(UpstreamInbound::Closed(reason)) => return Err(anyhow!(reason)),
                    Ok(UpstreamInbound::Error(reason)) => return Err(anyhow!(reason)),
                    Err(tokio::sync::mpsc::error::TryRecvError::Empty) => break,
                    Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                        return Err(anyhow!("upstream websocket reader ended"));
                    }
                }
            }

            loop {
                match event_rx.recv().await {
                    Some(UpstreamInbound::Text(text)) => {
                        self.handle_upstream_json_text(&text).await?
                    }
                    Some(UpstreamInbound::Closed(reason)) => return Err(anyhow!(reason)),
                    Some(UpstreamInbound::Error(reason)) => return Err(anyhow!(reason)),
                    None => return Err(anyhow!("upstream websocket reader ended")),
                }
            }
        }
        .await;

        ping_task.abort();
        let _ = ping_task.await;
        reader_task.abort();
        let _ = reader_task.await;
        result
    }

    async fn handle_upstream_json_text(&self, text: &str) -> Result<()> {
        let value: Value = match serde_json::from_str(text) {
            Ok(value) => value,
            Err(_) => {
                debug!(symbol = %self.symbol, "skipping non-json upstream message");
                return Ok(());
            }
        };

        let payload = value.get("event").unwrap_or(&value);
        if let Some(error) = value.get("error").or_else(|| payload.get("error")) {
            return Err(anyhow!("upstream returned subscription error: {error}"));
        }

        let maybe_delta = parse_book_depth_delta(payload, self.product_id)?;
        if let Some(delta) = maybe_delta {
            let update = {
                let mut state = self.state.write().await;
                match state.apply_delta(&delta) {
                    ApplyOutcome::Applied => Some((state.depth_view(self.depth), state.last_ts())),
                    ApplyOutcome::Stale => None,
                    ApplyOutcome::Gap {
                        current_ts,
                        event_last_max_ts,
                    } => {
                        return Err(anyhow!(
                            "book_depth gap for {}: local_ts={} event_last_max_ts={}",
                            self.symbol,
                            current_ts,
                            event_last_max_ts
                        ));
                    }
                }
            };

            if let Some((depth, source_ts)) = update {
                let seq = self.next_seq();
                self.emit(ServerMessage::Update {
                    symbol: self.symbol.clone(),
                    product_id: self.product_id,
                    seq,
                    source_ts,
                    min_ts: delta.min_timestamp,
                    max_ts: delta.max_timestamp,
                    depth,
                })
                .await;
            }

            return Ok(());
        }

        Ok(())
    }

    async fn emit_snapshot(&self, source_ts: u64) {
        let (depth, seq) = {
            let state = self.state.read().await;
            (state.depth_view(self.depth), self.next_seq())
        };

        self.emit(ServerMessage::Snapshot {
            symbol: self.symbol.clone(),
            product_id: self.product_id,
            seq,
            source_ts,
            depth,
        })
        .await;
    }

    async fn emit(&self, message: ServerMessage) {
        let mut stale = Vec::new();
        let mut subscribers = self.subscribers.lock().await;

        for (id, tx) in subscribers.iter() {
            if tx.send(message.clone()).is_err() {
                stale.push(*id);
            }
        }

        for id in stale {
            subscribers.remove(&id);
        }
    }

    fn next_seq(&self) -> u64 {
        self.seq.fetch_add(1, Ordering::Relaxed)
    }

    fn subscription_ws_url(&self) -> String {
        if let Some(url) = &self.nado_ws_url {
            return url.clone();
        }

        let gateway = self.client_mode.default_gateway_url();
        let ws_gateway = gateway
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        format!("{}/subscribe", ws_gateway.trim_end_matches('/'))
    }
}

enum UpstreamInbound {
    Text(String),
    Closed(String),
    Error(String),
}

fn spawn_ping_task<S, E>(mut tx: ratchet_rs::Sender<S, E>) -> JoinHandle<()>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Send + Unpin + 'static,
    E: ratchet_rs::ExtensionEncoder + Send + 'static,
{
    tokio::spawn(async move {
        let mut ping_ticker = tokio::time::interval(Duration::from_secs(20));
        ping_ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

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
    let url =
        Url::parse(ws_url).map_err(|err| anyhow!("invalid upstream ws url '{ws_url}': {err}"))?;
    let host = url
        .host_str()
        .ok_or_else(|| anyhow!("upstream ws url is missing host: {ws_url}"))?
        .to_string();
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("upstream ws url is missing port: {ws_url}"))?;

    let tcp = tokio::net::TcpStream::connect((host.as_str(), port))
        .await
        .map_err(|err| anyhow!("failed tcp connect to upstream ws {host}:{port}: {err}"))?;
    let _ = tcp.set_nodelay(true);

    match url.scheme() {
        "ws" => Ok(UpstreamStream::Plain(tcp)),
        "wss" => {
            let server_name = ServerName::try_from(host.clone())
                .map_err(|_| anyhow!("invalid tls server name in ws url: {host}"))?;
            let connector = tls_connector();
            let tls = connector
                .connect(server_name, tcp)
                .await
                .map_err(|err| anyhow!("failed tls connect to upstream ws {host}:{port}: {err}"))?;
            Ok(UpstreamStream::Tls(tls))
        }
        scheme => Err(anyhow!(
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

fn parse_book_depth_delta(payload: &Value, expected_product_id: u32) -> Result<Option<BookDelta>> {
    let Some(obj) = payload.as_object() else {
        return Ok(None);
    };

    let event_type = obj
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_lowercase();

    if event_type != "book_depth" {
        return Ok(None);
    }

    let product_id = obj
        .get("product_id")
        .and_then(value_to_u32)
        .ok_or_else(|| anyhow!("book_depth missing product_id"))?;

    if product_id != expected_product_id {
        debug!(
            expected_product_id,
            received_product_id = product_id,
            "skipping book_depth for mismatched product"
        );
        return Ok(None);
    }

    let last_max_timestamp = obj
        .get("last_max_timestamp")
        .and_then(value_to_u64)
        .ok_or_else(|| anyhow!("book_depth missing last_max_timestamp"))?;
    let min_timestamp = obj
        .get("min_timestamp")
        .and_then(value_to_u64)
        .ok_or_else(|| anyhow!("book_depth missing min_timestamp"))?;
    let max_timestamp = obj
        .get("max_timestamp")
        .and_then(value_to_u64)
        .ok_or_else(|| anyhow!("book_depth missing max_timestamp"))?;

    let bids = parse_levels(obj.get("bids"))?;
    let asks = parse_levels(obj.get("asks"))?;

    Ok(Some(BookDelta {
        last_max_timestamp,
        min_timestamp,
        max_timestamp,
        bids,
        asks,
    }))
}

fn parse_levels(raw: Option<&Value>) -> Result<Vec<LevelDelta>> {
    let Some(raw) = raw else {
        return Ok(Vec::new());
    };

    let Some(levels) = raw.as_array() else {
        return Err(anyhow!("expected levels array"));
    };

    let mut out = Vec::with_capacity(levels.len());
    for level in levels {
        let Some(parts) = level.as_array() else {
            return Err(anyhow!("expected [price,size] level"));
        };
        if parts.len() != 2 {
            return Err(anyhow!("expected exactly 2 level items"));
        }

        let price_x18 = value_to_i128(&parts[0]).ok_or_else(|| anyhow!("invalid level price"))?;
        let size_x18 = value_to_i128(&parts[1]).ok_or_else(|| anyhow!("invalid level size"))?;
        out.push(LevelDelta {
            price_x18,
            size_x18,
        });
    }

    Ok(out)
}

fn value_to_u32(value: &Value) -> Option<u32> {
    value
        .as_u64()
        .and_then(|v| u32::try_from(v).ok())
        .or_else(|| value.as_str().and_then(|v| v.parse::<u32>().ok()))
}

fn value_to_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|v| v.parse::<u64>().ok()))
}

fn value_to_i128(value: &Value) -> Option<i128> {
    value
        .as_i64()
        .map(i128::from)
        .or_else(|| value.as_u64().map(i128::from))
        .or_else(|| value.as_str().and_then(|v| v.parse::<i128>().ok()))
}
