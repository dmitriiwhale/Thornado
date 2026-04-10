use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct CandleView {
    pub bucket_start: u64,
    pub open_x18: String,
    pub high_x18: String,
    pub low_x18: String,
    pub close_x18: String,
    pub volume_x18: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub submission_idx: i64,
    pub source_ts: i64,
}

impl CandleView {
    pub fn from_x18_strings(
        bucket_start: i64,
        open_x18: String,
        high_x18: String,
        low_x18: String,
        close_x18: String,
        volume_x18: String,
        submission_idx: i64,
        source_ts: i64,
    ) -> Self {
        Self {
            bucket_start: bucket_start.max(0) as u64,
            open: x18_to_f64(&open_x18),
            high: x18_to_f64(&high_x18),
            low: x18_to_f64(&low_x18),
            close: x18_to_f64(&close_x18),
            volume: x18_to_f64(&volume_x18),
            open_x18,
            high_x18,
            low_x18,
            close_x18,
            volume_x18,
            submission_idx,
            source_ts,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CandlesResponse {
    pub symbol: String,
    pub product_id: u32,
    pub granularity: u32,
    pub candles: Vec<CandleView>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Snapshot {
        symbol: String,
        product_id: u32,
        granularity: u32,
        seq: u64,
        candles: Vec<CandleView>,
    },
    Update {
        symbol: String,
        product_id: u32,
        granularity: u32,
        seq: u64,
        candle: CandleView,
    },
    Status {
        symbol: String,
        product_id: u32,
        granularity: u32,
        status: String,
        detail: String,
    },
    Error {
        message: String,
    },
    Pong {
        ts: u64,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum ClientMessage {
    Ping { ts: Option<u64> },
}

#[derive(Debug, Clone, Serialize)]
pub struct SymbolInfo {
    pub symbol: String,
    pub product_id: u32,
}

fn x18_to_f64(raw: &str) -> f64 {
    let value = raw.parse::<f64>().unwrap_or(0.0);
    value / 1e18_f64
}
