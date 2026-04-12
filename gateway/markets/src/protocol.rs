use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MarketRow {
    pub symbol: String,
    pub ticker_id: String,
    pub product_id: u32,
    pub market_type: String,
    pub base: String,
    pub quote: String,
    pub price: Option<f64>,
    pub change_24h: Option<f64>,
    pub volume_24h: Option<f64>,
    pub ann_funding: Option<f64>,
    pub funding_rate: Option<f64>,
    pub mark_price: Option<f64>,
    pub index_price: Option<f64>,
    pub open_interest: Option<f64>,
    pub open_interest_usd: Option<f64>,
    pub updated_at: u64,
    pub stale: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SnapshotResponse {
    pub seq: u64,
    pub source_ts: u64,
    pub markets: Vec<MarketRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Snapshot {
        seq: u64,
        source_ts: u64,
        markets: Vec<MarketRow>,
    },
    Delta {
        seq: u64,
        source_ts: u64,
        updated: Vec<MarketRow>,
        removed: Vec<String>,
    },
    Status {
        status: String,
        detail: String,
        source_ts: u64,
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
