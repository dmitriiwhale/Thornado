use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct PriceLevelView {
    pub price_x18: String,
    pub size_x18: String,
    pub total_x18: String,
    pub price: f64,
    pub size: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DepthView {
    pub bids: Vec<PriceLevelView>,
    pub asks: Vec<PriceLevelView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Snapshot {
        symbol: String,
        product_id: u32,
        seq: u64,
        source_ts: u64,
        depth: DepthView,
    },
    Update {
        symbol: String,
        product_id: u32,
        seq: u64,
        source_ts: u64,
        min_ts: u64,
        max_ts: u64,
        depth: DepthView,
    },
    Status {
        symbol: String,
        product_id: u32,
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
