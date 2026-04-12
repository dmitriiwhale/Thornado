use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{Result, anyhow};
use nado_sdk::prelude::*;
use tokio::sync::{RwLock, broadcast};
use tokio::time::MissedTickBehavior;
use tracing::{debug, warn};

use crate::config::Config;
use crate::protocol::{MarketRow, ServerMessage, SnapshotResponse};

#[derive(Debug, Clone)]
struct SymbolMeta {
    product_id: u32,
    symbol: String,
    market_type: String,
    base: String,
    quote: String,
    updated_at: u64,
}

#[derive(Debug, Clone)]
struct TickerMeta {
    product_id: u32,
    ticker_id: String,
    base: String,
    quote: String,
    last_price: f64,
    base_volume: f64,
    quote_volume: f64,
    change_24h: f64,
    updated_at: u64,
}

#[derive(Debug, Clone)]
struct ContractMeta {
    product_id: u32,
    ticker_id: String,
    base: String,
    quote: String,
    market_type: String,
    funding_rate: f64,
    mark_price: f64,
    index_price: f64,
    open_interest: f64,
    open_interest_usd: f64,
    updated_at: u64,
}

#[derive(Default)]
struct ServiceState {
    seq: u64,
    source_ts: u64,
    symbols: HashMap<u32, SymbolMeta>,
    tickers: HashMap<u32, TickerMeta>,
    contracts: HashMap<u32, ContractMeta>,
    markets: BTreeMap<String, MarketRow>,
}

pub struct MarketsService {
    client_mode: ClientMode,
    edge: Option<bool>,
    symbols_refresh_ms: u64,
    tickers_poll_ms: u64,
    contracts_poll_ms: u64,
    stale_after_ms: u64,
    funding_interval_hours: f64,
    state: RwLock<ServiceState>,
    tx: broadcast::Sender<ServerMessage>,
}

impl MarketsService {
    pub fn new(config: Config) -> Self {
        let (tx, _rx) = broadcast::channel(2_048);
        Self {
            client_mode: config.client_mode,
            edge: config.edge,
            symbols_refresh_ms: config.symbols_refresh_ms,
            tickers_poll_ms: config.tickers_poll_ms,
            contracts_poll_ms: config.contracts_poll_ms,
            stale_after_ms: config.stale_after_ms,
            funding_interval_hours: config.funding_interval_hours,
            state: RwLock::new(ServiceState::default()),
            tx,
        }
    }

    pub fn spawn_pollers(self: &Arc<Self>) {
        let symbols_task = Arc::clone(self);
        tokio::spawn(async move {
            symbols_task.run_symbols_loop().await;
        });

        let tickers_task = Arc::clone(self);
        tokio::spawn(async move {
            tickers_task.run_tickers_loop().await;
        });

        let contracts_task = Arc::clone(self);
        tokio::spawn(async move {
            contracts_task.run_contracts_loop().await;
        });
    }

    pub async fn bootstrap(&self) -> Result<()> {
        let client = NadoClient::new(self.client_mode.clone());

        self.refresh_symbols_with_client(&client).await?;

        if let Err(err) = self.refresh_tickers_with_client(&client).await {
            warn!(error = %err, "bootstrap tickers refresh failed");
            self.emit_status("degraded", format!("tickers bootstrap failed: {err}"));
        }

        if let Err(err) = self.refresh_contracts_with_client(&client).await {
            warn!(error = %err, "bootstrap contracts refresh failed");
            self.emit_status("degraded", format!("contracts bootstrap failed: {err}"));
        }

        Ok(())
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerMessage> {
        self.tx.subscribe()
    }

    pub fn subscriber_count(&self) -> usize {
        self.tx.receiver_count()
    }

    pub async fn snapshot(&self) -> SnapshotResponse {
        let state = self.state.read().await;
        SnapshotResponse {
            seq: state.seq,
            source_ts: state.source_ts,
            markets: state.markets.values().cloned().collect(),
        }
    }

    pub async fn markets_count(&self) -> usize {
        self.state.read().await.markets.len()
    }

    pub async fn sequence(&self) -> u64 {
        self.state.read().await.seq
    }

    async fn run_symbols_loop(self: Arc<Self>) {
        let client = NadoClient::new(self.client_mode.clone());
        let mut interval = tokio::time::interval(Duration::from_millis(self.symbols_refresh_ms));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            if let Err(err) = self.refresh_symbols_with_client(&client).await {
                warn!(error = %err, "symbols refresh failed");
                self.emit_status("degraded", format!("symbols refresh failed: {err}"));
            }
        }
    }

    async fn run_tickers_loop(self: Arc<Self>) {
        let client = NadoClient::new(self.client_mode.clone());
        let mut interval = tokio::time::interval(Duration::from_millis(self.tickers_poll_ms));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            if let Err(err) = self.refresh_tickers_with_client(&client).await {
                warn!(error = %err, "tickers refresh failed");
                self.emit_status("degraded", format!("tickers refresh failed: {err}"));
            }
        }
    }

    async fn run_contracts_loop(self: Arc<Self>) {
        let client = NadoClient::new(self.client_mode.clone());
        let mut interval = tokio::time::interval(Duration::from_millis(self.contracts_poll_ms));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            if let Err(err) = self.refresh_contracts_with_client(&client).await {
                warn!(error = %err, "contracts refresh failed");
                self.emit_status("degraded", format!("contracts refresh failed: {err}"));
            }
        }
    }

    async fn refresh_symbols_with_client(&self, client: &NadoClient) -> Result<()> {
        let symbols = client
            .get_symbols(None, None)
            .await
            .map_err(|err| anyhow!("failed to query symbols from Nado: {err}"))?;

        let now = now_millis();
        let mut next = HashMap::with_capacity(symbols.symbols.len());
        for data in symbols.symbols.into_values() {
            let symbol = normalize_symbol(&data.symbol);
            if symbol.is_empty() {
                continue;
            }

            let (base, quote) = split_base_quote(&symbol);
            next.insert(
                data.product_id,
                SymbolMeta {
                    product_id: data.product_id,
                    symbol,
                    market_type: normalize_market_type(&data.product_type),
                    base,
                    quote,
                    updated_at: now,
                },
            );
        }

        if next.is_empty() {
            return Err(anyhow!("no symbols returned from Nado"));
        }

        {
            let mut state = self.state.write().await;
            state.symbols = next;
        }

        self.rebuild_and_publish("symbols").await;
        Ok(())
    }

    async fn refresh_tickers_with_client(&self, client: &NadoClient) -> Result<()> {
        let tickers = client
            .get_tickers(None, self.edge)
            .await
            .map_err(|err| anyhow!("failed to query tickers from Nado: {err}"))?;

        if tickers.is_empty() {
            return Err(anyhow!("empty tickers payload"));
        }

        let now = now_millis();
        let mut next = HashMap::with_capacity(tickers.len());
        for data in tickers.into_values() {
            let ticker_id = normalize_symbol(&data.ticker_id);
            if ticker_id.is_empty() {
                continue;
            }

            let (base, quote) =
                sanitize_pair_fields(&data.base_currency, &data.quote_currency, &ticker_id);
            next.insert(
                data.product_id,
                TickerMeta {
                    product_id: data.product_id,
                    ticker_id,
                    base,
                    quote,
                    last_price: data.last_price,
                    base_volume: data.base_volume,
                    quote_volume: data.quote_volume,
                    change_24h: data.price_change_percent_24h,
                    updated_at: now,
                },
            );
        }

        if next.is_empty() {
            return Err(anyhow!("tickers payload had no valid rows"));
        }

        {
            let mut state = self.state.write().await;
            state.tickers = next;
        }

        self.rebuild_and_publish("tickers").await;
        Ok(())
    }

    async fn refresh_contracts_with_client(&self, client: &NadoClient) -> Result<()> {
        let contracts = client
            .get_contracts_v2(self.edge)
            .await
            .map_err(|err| anyhow!("failed to query contracts from Nado: {err}"))?;

        let now = now_millis();
        let mut next = HashMap::with_capacity(contracts.len());
        for data in contracts.into_values() {
            let ticker_id = normalize_symbol(&data.ticker_id);
            if ticker_id.is_empty() {
                continue;
            }

            let (base, quote) =
                sanitize_pair_fields(&data.base_currency, &data.quote_currency, &ticker_id);
            next.insert(
                data.product_id,
                ContractMeta {
                    product_id: data.product_id,
                    ticker_id,
                    base,
                    quote,
                    market_type: normalize_market_type(&data.product_type),
                    funding_rate: data.funding_rate,
                    mark_price: data.mark_price,
                    index_price: data.index_price,
                    open_interest: data.open_interest,
                    open_interest_usd: data.open_interest_usd,
                    updated_at: now,
                },
            );
        }

        {
            let mut state = self.state.write().await;
            state.contracts = next;
        }

        self.rebuild_and_publish("contracts").await;
        Ok(())
    }

    async fn rebuild_and_publish(&self, reason: &str) {
        let message = {
            let mut state = self.state.write().await;
            let now = now_millis();
            let next_markets = build_market_rows(
                &state,
                now,
                self.stale_after_ms,
                self.funding_interval_hours,
            );
            let (updated, removed) = diff_market_rows(&state.markets, &next_markets);

            if updated.is_empty() && removed.is_empty() {
                return;
            }

            state.seq = state.seq.saturating_add(1);
            state.source_ts = now;
            state.markets = next_markets;

            debug!(
                seq = state.seq,
                reason = reason,
                updated = updated.len(),
                removed = removed.len(),
                "markets cache refreshed"
            );

            if state.seq == 1 {
                ServerMessage::Snapshot {
                    seq: state.seq,
                    source_ts: state.source_ts,
                    markets: state.markets.values().cloned().collect(),
                }
            } else {
                ServerMessage::Delta {
                    seq: state.seq,
                    source_ts: state.source_ts,
                    updated,
                    removed,
                }
            }
        };

        let _ = self.tx.send(message);
    }

    fn emit_status(&self, status: &str, detail: String) {
        let source_ts = now_millis();
        let _ = self.tx.send(ServerMessage::Status {
            status: status.to_string(),
            detail,
            source_ts,
        });
    }
}

fn build_market_rows(
    state: &ServiceState,
    now: u64,
    stale_after_ms: u64,
    funding_interval_hours: f64,
) -> BTreeMap<String, MarketRow> {
    let mut out: BTreeMap<String, MarketRow> = BTreeMap::new();

    for symbol_meta in state.symbols.values() {
        out.insert(
            symbol_meta.symbol.clone(),
            MarketRow {
                symbol: symbol_meta.symbol.clone(),
                ticker_id: symbol_meta.symbol.clone(),
                product_id: symbol_meta.product_id,
                market_type: symbol_meta.market_type.clone(),
                base: symbol_meta.base.clone(),
                quote: symbol_meta.quote.clone(),
                price: None,
                change_24h: None,
                volume_24h: None,
                ann_funding: None,
                funding_rate: None,
                mark_price: None,
                index_price: None,
                open_interest: None,
                open_interest_usd: None,
                updated_at: symbol_meta.updated_at,
                stale: false,
            },
        );
    }

    for ticker in state.tickers.values() {
        let symbol_key = state
            .symbols
            .get(&ticker.product_id)
            .map(|meta| meta.symbol.clone())
            .unwrap_or_else(|| ticker.ticker_id.clone());

        let row = out.entry(symbol_key.clone()).or_insert_with(|| MarketRow {
            symbol: symbol_key.clone(),
            ticker_id: ticker.ticker_id.clone(),
            product_id: ticker.product_id,
            market_type: "unknown".to_string(),
            base: ticker.base.clone(),
            quote: ticker.quote.clone(),
            price: None,
            change_24h: None,
            volume_24h: None,
            ann_funding: None,
            funding_rate: None,
            mark_price: None,
            index_price: None,
            open_interest: None,
            open_interest_usd: None,
            updated_at: ticker.updated_at,
            stale: false,
        });

        row.product_id = ticker.product_id;
        row.ticker_id = ticker.ticker_id.clone();
        if row.base.is_empty() {
            row.base = ticker.base.clone();
        }
        if row.quote.is_empty() {
            row.quote = ticker.quote.clone();
        }

        row.price = finite_option(ticker.last_price);
        row.change_24h = finite_option(ticker.change_24h);
        row.volume_24h = preferred_volume(ticker.base_volume, ticker.quote_volume);
        row.updated_at = row.updated_at.max(ticker.updated_at);
    }

    for contract in state.contracts.values() {
        let symbol_key = state
            .symbols
            .get(&contract.product_id)
            .map(|meta| meta.symbol.clone())
            .unwrap_or_else(|| contract.ticker_id.clone());

        let row = out.entry(symbol_key.clone()).or_insert_with(|| MarketRow {
            symbol: symbol_key.clone(),
            ticker_id: contract.ticker_id.clone(),
            product_id: contract.product_id,
            market_type: contract.market_type.clone(),
            base: contract.base.clone(),
            quote: contract.quote.clone(),
            price: None,
            change_24h: None,
            volume_24h: None,
            ann_funding: None,
            funding_rate: None,
            mark_price: None,
            index_price: None,
            open_interest: None,
            open_interest_usd: None,
            updated_at: contract.updated_at,
            stale: false,
        });

        row.product_id = contract.product_id;
        row.ticker_id = contract.ticker_id.clone();
        if row.market_type == "unknown" || row.market_type.is_empty() {
            row.market_type = contract.market_type.clone();
        }
        if row.base.is_empty() {
            row.base = contract.base.clone();
        }
        if row.quote.is_empty() {
            row.quote = contract.quote.clone();
        }

        row.funding_rate = finite_option(contract.funding_rate);
        row.ann_funding = finite_option(contract.funding_rate)
            .map(|rate| annualize_funding_rate(rate, funding_interval_hours));
        row.mark_price = finite_option(contract.mark_price);
        row.index_price = finite_option(contract.index_price);
        row.open_interest = finite_option(contract.open_interest);
        row.open_interest_usd = finite_option(contract.open_interest_usd);
        row.updated_at = row.updated_at.max(contract.updated_at);
    }

    for row in out.values_mut() {
        if row.ticker_id.is_empty() {
            row.ticker_id = row.symbol.clone();
        }

        if row.updated_at == 0 {
            row.updated_at = now;
        }
        row.stale = now.saturating_sub(row.updated_at) > stale_after_ms;
    }

    out
}

fn diff_market_rows(
    old: &BTreeMap<String, MarketRow>,
    new: &BTreeMap<String, MarketRow>,
) -> (Vec<MarketRow>, Vec<String>) {
    let mut updated = Vec::new();
    for (symbol, next_row) in new {
        match old.get(symbol) {
            Some(prev_row) if prev_row == next_row => {}
            _ => updated.push(next_row.clone()),
        }
    }

    let mut removed = Vec::new();
    for symbol in old.keys() {
        if !new.contains_key(symbol) {
            removed.push(symbol.clone());
        }
    }

    (updated, removed)
}

fn normalize_symbol(symbol: &str) -> String {
    symbol.trim().to_uppercase()
}

fn normalize_market_type(value: &str) -> String {
    let normalized = value.trim().to_lowercase();
    if normalized.is_empty() {
        "unknown".to_string()
    } else {
        normalized
    }
}

fn sanitize_pair_fields(base: &str, quote: &str, symbol_fallback: &str) -> (String, String) {
    let clean_base = normalize_symbol(base);
    let clean_quote = normalize_symbol(quote);
    if !clean_base.is_empty() && !clean_quote.is_empty() {
        return (clean_base, clean_quote);
    }
    split_base_quote(symbol_fallback)
}

fn split_base_quote(symbol: &str) -> (String, String) {
    let normalized = normalize_symbol(symbol);
    if normalized.is_empty() {
        return (String::new(), String::new());
    }

    if let Some((base, quote)) = normalized.split_once('/') {
        return (base.to_string(), quote.to_string());
    }

    if let Some((left, right)) = normalized.split_once('_') {
        let quote = right.to_string();
        if let Some((base, _)) = left.split_once('-') {
            return (base.to_string(), quote);
        }
        return (left.to_string(), quote);
    }

    let parts: Vec<&str> = normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect();
    if parts.len() >= 2 {
        return (
            parts.first().copied().unwrap_or_default().to_string(),
            parts.last().copied().unwrap_or_default().to_string(),
        );
    }

    (normalized, String::new())
}

fn finite_option(value: f64) -> Option<f64> {
    if value.is_finite() { Some(value) } else { None }
}

fn preferred_volume(base_volume: f64, quote_volume: f64) -> Option<f64> {
    match (finite_option(base_volume), finite_option(quote_volume)) {
        (_, Some(quote)) if quote > 0.0 => Some(quote),
        (Some(base), _) if base > 0.0 => Some(base),
        (Some(base), None) => Some(base),
        (None, Some(quote)) => Some(quote),
        _ => None,
    }
}

fn annualize_funding_rate(rate: f64, funding_interval_hours: f64) -> f64 {
    let normalized = if rate.abs() > 1.0 { rate / 100.0 } else { rate };
    let periods_per_day = (24.0 / funding_interval_hours).max(1.0);
    normalized * periods_per_day * 365.0 * 100.0
}

fn now_millis() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as u64
}
