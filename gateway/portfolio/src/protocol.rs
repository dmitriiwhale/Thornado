use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum ClientMessage {
    Ping { ts: Option<u64> },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum ServerMessage {
    Snapshot {
        seq: u64,
        as_of_ms: u64,
        cause: String,
        portfolio: PortfolioPayload,
    },
    Update {
        seq: u64,
        as_of_ms: u64,
        cause: String,
        portfolio: PortfolioPayload,
    },
    Status {
        status: String,
        detail: String,
        as_of_ms: u64,
    },
    Error {
        message: String,
    },
    Pong {
        ts: u64,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioPayload {
    pub owner_address: String,
    pub subaccount_name: String,
    pub subaccount: String,
    pub summary: Value,
    pub positions: Value,
    pub orders: Value,
    pub trades: Value,
    pub funding: Value,
    pub pnl: Value,
    pub risk: Value,
    pub symbols: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_snapshot: Option<Value>,
    pub isolated_positions: Value,
    pub latest_market_prices: Value,
    pub latest_oracle_prices: Value,
}
