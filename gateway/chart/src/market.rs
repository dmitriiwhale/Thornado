use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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

use crate::protocol::{CandleView, ServerMessage, SymbolInfo};
use crate::store::{CandleRow, CandleStore};

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

#[derive(Debug, Clone, Eq, PartialEq, Hash)]
struct SeriesKey {
    symbol: String,
    granularity: u32,
}

pub struct Supervisor {
    client_mode: ClientMode,
    nado_ws_url: Option<String>,
    nado_archive_url: Option<String>,
    store: Arc<CandleStore>,
    history_limit: usize,
    cache_capacity: usize,
    supported_granularities: Vec<u32>,
    symbols: Vec<SymbolInfo>,
    lookup: HashMap<String, u32>,
    series: Mutex<HashMap<SeriesKey, Arc<SeriesHandle>>>,
}

impl Supervisor {
    pub fn new(
        client_mode: ClientMode,
        nado_ws_url: Option<String>,
        nado_archive_url: Option<String>,
        store: Arc<CandleStore>,
        history_limit: usize,
        cache_capacity: usize,
        supported_granularities: Vec<u32>,
        directory: SymbolDirectory,
    ) -> Self {
        Self {
            client_mode,
            nado_ws_url,
            nado_archive_url,
            store,
            history_limit,
            cache_capacity,
            supported_granularities,
            symbols: directory.symbols,
            lookup: directory.lookup,
            series: Mutex::new(HashMap::new()),
        }
    }

    pub fn symbols(&self) -> &[SymbolInfo] {
        &self.symbols
    }

    pub fn supports_granularity(&self, granularity: u32) -> bool {
        self.supported_granularities.contains(&granularity)
    }

    pub async fn ensure_series(&self, symbol: &str, granularity: u32) -> Result<Arc<SeriesHandle>> {
        if !self.supports_granularity(granularity) {
            anyhow::bail!("unsupported granularity '{granularity}'")
        }

        let normalized = normalize_symbol(symbol);
        let Some(product_id) = self.lookup.get(&normalized).copied() else {
            anyhow::bail!("unknown symbol '{symbol}'");
        };

        let key = SeriesKey {
            symbol: normalized.clone(),
            granularity,
        };

        if let Some(existing) = self.series.lock().await.get(&key).cloned() {
            return Ok(existing);
        }

        let handle = Arc::new(SeriesHandle::new(
            normalized.clone(),
            product_id,
            granularity,
            self.client_mode.clone(),
            self.nado_ws_url.clone(),
            self.nado_archive_url.clone(),
            self.store.clone(),
            self.history_limit,
            self.cache_capacity,
        ));

        {
            let mut series = self.series.lock().await;
            if let Some(existing) = series.get(&key) {
                return Ok(existing.clone());
            }
            series.insert(key.clone(), handle.clone());
        }

        if let Err(err) = handle.bootstrap().await {
            error!(
                symbol = %normalized,
                granularity,
                error = %err,
                "series bootstrap failed"
            );
            self.series.lock().await.remove(&key);
            return Err(err);
        }

        handle.clone().spawn();
        Ok(handle)
    }

    pub async fn active_series(&self) -> usize {
        self.series.lock().await.len()
    }
}

#[derive(Default)]
struct SeriesState {
    candles: VecDeque<CandleRow>,
}

impl SeriesState {
    fn replace_all(&mut self, rows: Vec<CandleRow>, cache_capacity: usize) {
        self.candles.clear();
        for row in rows {
            self.candles.push_back(row);
            while self.candles.len() > cache_capacity {
                self.candles.pop_front();
            }
        }
    }

    fn apply_row(&mut self, row: CandleRow, cache_capacity: usize) -> bool {
        if self.candles.is_empty() {
            self.candles.push_back(row);
            return true;
        }

        if let Some(last) = self.candles.back_mut() {
            if last.bucket_start_sec == row.bucket_start_sec {
                if row.submission_idx < last.submission_idx {
                    return false;
                }
                *last = row;
                return true;
            }

            if row.bucket_start_sec > last.bucket_start_sec {
                self.candles.push_back(row);
                while self.candles.len() > cache_capacity {
                    self.candles.pop_front();
                }
                return true;
            }
        }

        if let Some(first) = self.candles.front() {
            if row.bucket_start_sec < first.bucket_start_sec {
                return false;
            }
        }

        for existing in self.candles.iter_mut().rev() {
            if existing.bucket_start_sec == row.bucket_start_sec {
                if row.submission_idx < existing.submission_idx {
                    return false;
                }
                *existing = row;
                return true;
            }
            if existing.bucket_start_sec < row.bucket_start_sec {
                break;
            }
        }

        let mut insert_index = self.candles.len();
        for (idx, existing) in self.candles.iter().enumerate() {
            if existing.bucket_start_sec > row.bucket_start_sec {
                insert_index = idx;
                break;
            }
        }

        self.candles.insert(insert_index, row);
        while self.candles.len() > cache_capacity {
            self.candles.pop_front();
        }
        true
    }

    fn snapshot_views(&self, limit: usize) -> Vec<CandleView> {
        let mut views = self
            .candles
            .iter()
            .rev()
            .take(limit)
            .map(candle_to_view)
            .collect::<Vec<_>>();
        views.reverse();
        views
    }
}

pub struct SeriesHandle {
    symbol: String,
    product_id: u32,
    granularity: u32,
    client_mode: ClientMode,
    nado_ws_url: Option<String>,
    nado_archive_url: Option<String>,
    store: Arc<CandleStore>,
    history_limit: usize,
    cache_capacity: usize,

    state: RwLock<SeriesState>,
    seq: AtomicU64,
    worker_started: AtomicBool,
    next_subscriber_id: AtomicU64,
    subscribers: Mutex<HashMap<u64, mpsc::UnboundedSender<ServerMessage>>>,
}

impl SeriesHandle {
    fn new(
        symbol: String,
        product_id: u32,
        granularity: u32,
        client_mode: ClientMode,
        nado_ws_url: Option<String>,
        nado_archive_url: Option<String>,
        store: Arc<CandleStore>,
        history_limit: usize,
        cache_capacity: usize,
    ) -> Self {
        Self {
            symbol,
            product_id,
            granularity,
            client_mode,
            nado_ws_url,
            nado_archive_url,
            store,
            history_limit,
            cache_capacity,
            state: RwLock::new(SeriesState::default()),
            seq: AtomicU64::new(1),
            worker_started: AtomicBool::new(false),
            next_subscriber_id: AtomicU64::new(1),
            subscribers: Mutex::new(HashMap::new()),
        }
    }

    pub fn spawn(self: Arc<Self>) {
        if self.worker_started.swap(true, Ordering::SeqCst) {
            return;
        }

        tokio::spawn(async move {
            self.run_worker_loop().await;
        });
    }

    pub async fn bootstrap(&self) -> Result<()> {
        let mut rows = self
            .store
            .load_recent(
                &self.symbol,
                self.product_id,
                self.granularity,
                self.history_limit,
            )
            .await?;

        if rows.len() < self.history_limit {
            let fetched = self.fetch_archive(self.history_limit as u32).await?;
            if !fetched.is_empty() {
                self.store.upsert_many(&fetched).await?;
                rows = self
                    .store
                    .load_recent(
                        &self.symbol,
                        self.product_id,
                        self.granularity,
                        self.history_limit,
                    )
                    .await?;
            }
        }

        let mut state = self.state.write().await;
        state.replace_all(rows, self.cache_capacity);
        Ok(())
    }

    pub async fn snapshot(&self, limit: usize) -> Vec<CandleView> {
        self.state.read().await.snapshot_views(limit)
    }

    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    pub fn product_id(&self) -> u32 {
        self.product_id
    }

    pub fn granularity(&self) -> u32 {
        self.granularity
    }

    pub async fn subscribe(
        &self,
        snapshot_limit: usize,
    ) -> (u64, mpsc::UnboundedReceiver<ServerMessage>, ServerMessage) {
        let (tx, rx) = mpsc::unbounded_channel();
        let subscriber_id = self.next_subscriber_id.fetch_add(1, Ordering::Relaxed);
        self.subscribers.lock().await.insert(subscriber_id, tx);

        let snapshot = {
            let state = self.state.read().await;
            let candles = state.snapshot_views(snapshot_limit);
            if candles.is_empty() {
                ServerMessage::Status {
                    symbol: self.symbol.clone(),
                    product_id: self.product_id,
                    granularity: self.granularity,
                    status: "warming_up".to_string(),
                    detail: "waiting for first candle updates".to_string(),
                }
            } else {
                ServerMessage::Snapshot {
                    symbol: self.symbol.clone(),
                    product_id: self.product_id,
                    granularity: self.granularity,
                    seq: self.next_seq(),
                    candles,
                }
            }
        };

        (subscriber_id, rx, snapshot)
    }

    pub async fn unsubscribe(&self, subscriber_id: u64) {
        self.subscribers.lock().await.remove(&subscriber_id);
    }

    async fn run_worker_loop(self: &Arc<Self>) {
        let mut backoff = Duration::from_secs(1);

        loop {
            if let Err(err) = self.backfill_from_archive().await {
                warn!(
                    symbol = %self.symbol,
                    granularity = self.granularity,
                    error = %err,
                    "archive backfill before stream reconnect failed"
                );
            }

            self.emit(ServerMessage::Status {
                symbol: self.symbol.clone(),
                product_id: self.product_id,
                granularity: self.granularity,
                status: "connecting".to_string(),
                detail: "connecting to latest_candlestick stream".to_string(),
            })
            .await;

            match self.run_stream_once().await {
                Ok(()) => {
                    warn!(
                        symbol = %self.symbol,
                        granularity = self.granularity,
                        "latest_candlestick stream ended unexpectedly"
                    );
                }
                Err(err) => {
                    error!(
                        symbol = %self.symbol,
                        granularity = self.granularity,
                        error = %err,
                        "latest_candlestick stream failed"
                    );
                    self.emit(ServerMessage::Status {
                        symbol: self.symbol.clone(),
                        product_id: self.product_id,
                        granularity: self.granularity,
                        status: "reconnecting".to_string(),
                        detail: format!("stream error: {err}; retry in {}s", backoff.as_secs()),
                    })
                    .await;
                }
            }

            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(Duration::from_secs(20));
        }
    }

    async fn run_stream_once(&self) -> Result<()> {
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

        let subscribe_payload = serde_json::json!({
            "method": "subscribe",
            "id": 1_u64,
            "stream": {
                "type": "latest_candlestick",
                "product_id": self.product_id,
                "granularity": self.granularity
            }
        });
        websocket
            .write_text(subscribe_payload.to_string())
            .await
            .map_err(|err| {
                anyhow!(
                    "failed sending latest_candlestick subscribe payload for symbol={} product_id={} granularity={}: {err}",
                    self.symbol,
                    self.product_id,
                    self.granularity
                )
            })?;
        websocket
            .flush()
            .await
            .map_err(|err| anyhow!("failed flushing subscribe payload: {err}"))?;

        info!(
            symbol = %self.symbol,
            product_id = self.product_id,
            granularity = self.granularity,
            "latest_candlestick subscribed"
        );

        self.emit(ServerMessage::Status {
            symbol: self.symbol.clone(),
            product_id: self.product_id,
            granularity: self.granularity,
            status: "connected".to_string(),
            detail: "subscribed to latest_candlestick".to_string(),
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
                        read_buf.clear();
                        let detail = format!("upstream websocket closed: {:?}", frame);
                        let _ = event_tx.send(UpstreamInbound::Closed(detail));
                        break;
                    }
                    Err(err) => {
                        let _ = event_tx.send(UpstreamInbound::Error(err.to_string()));
                        break;
                    }
                }
            }
        });

        let loop_result = async {
            while let Some(inbound) = event_rx.recv().await {
                match inbound {
                    UpstreamInbound::Text(text) => {
                        let value: Value = serde_json::from_str(&text)
                            .map_err(|err| anyhow!("failed parsing upstream payload: {err}"))?;

                        if let Some(error_value) = value.get("error") {
                            return Err(anyhow!("upstream returned error: {error_value}"));
                        }

                        let payload = value.get("event").unwrap_or(&value);
                        let maybe_row = parse_latest_candlestick(
                            payload,
                            &self.symbol,
                            self.product_id,
                            self.granularity,
                        )?;
                        let Some(row) = maybe_row else {
                            continue;
                        };

                        self.store.upsert_candle(&row).await?;

                        let changed = {
                            let mut state = self.state.write().await;
                            state.apply_row(row.clone(), self.cache_capacity)
                        };

                        if changed {
                            self.emit(ServerMessage::Update {
                                symbol: self.symbol.clone(),
                                product_id: self.product_id,
                                granularity: self.granularity,
                                seq: self.next_seq(),
                                candle: candle_to_view(&row),
                            })
                            .await;
                        }
                    }
                    UpstreamInbound::Closed(reason) => {
                        return Err(anyhow!("upstream websocket closed: {reason}"));
                    }
                    UpstreamInbound::Error(reason) => {
                        return Err(anyhow!("upstream websocket receive error: {reason}"));
                    }
                }
            }

            Err(anyhow!("upstream websocket event channel closed"))
        }
        .await;

        ping_task.abort();
        reader_task.abort();
        let _ = ping_task.await;
        let _ = reader_task.await;

        loop_result
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

    async fn backfill_from_archive(&self) -> Result<()> {
        let fetched = self.fetch_archive(self.history_limit as u32).await?;
        if fetched.is_empty() {
            return Ok(());
        }

        self.store.upsert_many(&fetched).await?;
        let rows = self
            .store
            .load_recent(
                &self.symbol,
                self.product_id,
                self.granularity,
                self.history_limit,
            )
            .await?;

        let mut state = self.state.write().await;
        state.replace_all(rows, self.cache_capacity);
        Ok(())
    }

    async fn fetch_archive(&self, limit: u32) -> Result<Vec<CandleRow>> {
        let mut client = NadoClient::new(self.client_mode.clone());
        if let Some(url) = &self.nado_archive_url {
            client = client.with_archive_url(url.clone());
        }

        let response = client
            .get_candlesticks_builder()
            .product_id(self.product_id)
            .granularity(self.granularity)
            .limit(limit.min(500))
            .query()
            .await
            .map_err(|err| anyhow!("failed querying archive candlesticks: {err}"))?;

        let mut rows = response
            .candlesticks
            .into_iter()
            .map(|item| {
                let bucket_start_sec = normalize_timestamp_to_sec(item.timestamp);
                CandleRow {
                    product_id: self.product_id,
                    symbol: self.symbol.clone(),
                    granularity: self.granularity,
                    bucket_start_sec,
                    open_x18: item.open_x18.to_string(),
                    high_x18: item.high_x18.to_string(),
                    low_x18: item.low_x18.to_string(),
                    close_x18: item.close_x18.to_string(),
                    volume_x18: item.volume.to_string(),
                    submission_idx: item.submission_idx,
                    source_ts: item.timestamp,
                }
            })
            .collect::<Vec<_>>();

        rows.sort_by_key(|row| row.bucket_start_sec);
        rows.dedup_by_key(|row| row.bucket_start_sec);
        Ok(rows)
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

fn parse_latest_candlestick(
    payload: &Value,
    symbol: &str,
    expected_product_id: u32,
    expected_granularity: u32,
) -> Result<Option<CandleRow>> {
    let Some(object) = payload.as_object() else {
        return Ok(None);
    };

    let event_type = object
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();

    if event_type != "latest_candlestick" {
        return Ok(None);
    }

    let product_id = object
        .get("product_id")
        .and_then(value_to_u32)
        .ok_or_else(|| anyhow!("latest_candlestick missing product_id"))?;

    if product_id != expected_product_id {
        debug!(
            symbol,
            expected_product_id, product_id, "skipping latest_candlestick for different product"
        );
        return Ok(None);
    }

    let granularity = object
        .get("granularity")
        .and_then(value_to_u32)
        .ok_or_else(|| anyhow!("latest_candlestick missing granularity"))?;

    if granularity != expected_granularity {
        debug!(
            symbol,
            expected_granularity,
            granularity,
            "skipping latest_candlestick for different granularity"
        );
        return Ok(None);
    }

    let raw_timestamp = object
        .get("timestamp")
        .and_then(value_to_i64)
        .ok_or_else(|| anyhow!("latest_candlestick missing timestamp"))?;
    let bucket_start_sec = normalize_timestamp_to_sec(raw_timestamp);

    let open_x18 = value_to_string_number(object.get("open_x18"))
        .ok_or_else(|| anyhow!("latest_candlestick missing open_x18"))?;
    let high_x18 = value_to_string_number(object.get("high_x18"))
        .ok_or_else(|| anyhow!("latest_candlestick missing high_x18"))?;
    let low_x18 = value_to_string_number(object.get("low_x18"))
        .ok_or_else(|| anyhow!("latest_candlestick missing low_x18"))?;
    let close_x18 = value_to_string_number(object.get("close_x18"))
        .ok_or_else(|| anyhow!("latest_candlestick missing close_x18"))?;
    let volume_x18 = value_to_string_number(object.get("volume"))
        .ok_or_else(|| anyhow!("latest_candlestick missing volume"))?;

    let submission_idx = object
        .get("submission_idx")
        .and_then(value_to_i64)
        .unwrap_or_else(|| now_millis() as i64);

    let source_ts = object
        .get("source_ts")
        .and_then(value_to_i64)
        .unwrap_or(raw_timestamp);

    Ok(Some(CandleRow {
        product_id,
        symbol: symbol.to_string(),
        granularity,
        bucket_start_sec,
        open_x18,
        high_x18,
        low_x18,
        close_x18,
        volume_x18,
        submission_idx,
        source_ts,
    }))
}

fn candle_to_view(row: &CandleRow) -> CandleView {
    CandleView::from_x18_strings(
        row.bucket_start_sec,
        row.open_x18.clone(),
        row.high_x18.clone(),
        row.low_x18.clone(),
        row.close_x18.clone(),
        row.volume_x18.clone(),
        row.submission_idx,
        row.source_ts,
    )
}

fn normalize_timestamp_to_sec(value: i64) -> i64 {
    if value > 9_999_999_999_999_999 {
        return value / 1_000_000_000;
    }
    if value > 9_999_999_999_999 {
        return value / 1_000_000;
    }
    if value > 9_999_999_999 {
        return value / 1_000;
    }
    value
}

fn value_to_u32(value: &Value) -> Option<u32> {
    value
        .as_u64()
        .and_then(|v| u32::try_from(v).ok())
        .or_else(|| value.as_str().and_then(|v| v.parse::<u32>().ok()))
}

fn value_to_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|v| i64::try_from(v).ok()))
        .or_else(|| value.as_str().and_then(|v| v.parse::<i64>().ok()))
}

fn value_to_string_number(value: Option<&Value>) -> Option<String> {
    let value = value?;
    if let Some(raw) = value.as_str() {
        return Some(raw.to_string());
    }
    if let Some(raw) = value.as_i64() {
        return Some(raw.to_string());
    }
    if let Some(raw) = value.as_u64() {
        return Some(raw.to_string());
    }
    None
}

fn now_millis() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as u64
}
