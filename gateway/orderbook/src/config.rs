use std::env;

use anyhow::{Result, bail};
use nado_sdk::prelude::ClientMode;

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:3002";
const DEFAULT_DEPTH: usize = 20;

#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub client_mode: ClientMode,
    pub depth: usize,
    pub nado_ws_url: Option<String>,
    pub prewarm_symbols: Vec<String>,
    pub prewarm_all: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("ORDERBOOK_BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
        let mode = env::var("ORDERBOOK_NETWORK").unwrap_or_else(|_| "test".to_string());
        let client_mode = parse_mode(&mode)?;

        let depth = env::var("ORDERBOOK_DEPTH")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(DEFAULT_DEPTH);
        if depth == 0 {
            bail!("ORDERBOOK_DEPTH must be > 0");
        }

        let nado_ws_url = env::var("ORDERBOOK_NADO_WS_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let prewarm_symbols = env::var("ORDERBOOK_SYMBOLS")
            .ok()
            .map(|raw| {
                raw.split(',')
                    .map(|s| s.trim().to_uppercase())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let prewarm_all = env::var("ORDERBOOK_PREWARM_ALL")
            .ok()
            .map(|value| parse_bool(&value))
            .unwrap_or(true);

        Ok(Self {
            bind_addr,
            client_mode,
            depth,
            nado_ws_url,
            prewarm_symbols,
            prewarm_all,
        })
    }
}

fn parse_mode(value: &str) -> Result<ClientMode> {
    match value.trim().to_lowercase().as_str() {
        "test" => Ok(ClientMode::Test),
        "prod" => Ok(ClientMode::Prod),
        "local" => Ok(ClientMode::Local),
        "local-alt" | "local_alt" => Ok(ClientMode::LocalAlt),
        other => {
            bail!(
                "Unsupported ORDERBOOK_NETWORK='{other}'. Expected one of: test, prod, local, local-alt"
            )
        }
    }
}

fn parse_bool(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "y" | "on"
    )
}
