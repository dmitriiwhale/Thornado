use std::env;

use anyhow::{Result, bail};
use nado_sdk::prelude::ClientMode;

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:3005";
const DEFAULT_SYMBOLS_REFRESH_MS: u64 = 300_000;
const DEFAULT_TICKERS_POLL_MS: u64 = 1_000;
const DEFAULT_CONTRACTS_POLL_MS: u64 = 3_000;
const DEFAULT_STALE_AFTER_MS: u64 = 20_000;
const DEFAULT_FUNDING_INTERVAL_HOURS: f64 = 1.0;

#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub client_mode: ClientMode,
    pub edge: Option<bool>,
    pub symbols_refresh_ms: u64,
    pub tickers_poll_ms: u64,
    pub contracts_poll_ms: u64,
    pub stale_after_ms: u64,
    pub funding_interval_hours: f64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("MARKETS_BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
        let mode = env::var("MARKETS_NETWORK").unwrap_or_else(|_| "test".to_string());
        let client_mode = parse_mode(&mode)?;

        let symbols_refresh_ms =
            parse_u64("MARKETS_SYMBOLS_REFRESH_MS", DEFAULT_SYMBOLS_REFRESH_MS)?;
        let tickers_poll_ms = parse_u64("MARKETS_TICKERS_POLL_MS", DEFAULT_TICKERS_POLL_MS)?;
        let contracts_poll_ms = parse_u64("MARKETS_CONTRACTS_POLL_MS", DEFAULT_CONTRACTS_POLL_MS)?;
        let stale_after_ms = parse_u64("MARKETS_STALE_AFTER_MS", DEFAULT_STALE_AFTER_MS)?;
        let funding_interval_hours = parse_f64(
            "MARKETS_FUNDING_INTERVAL_HOURS",
            DEFAULT_FUNDING_INTERVAL_HOURS,
        )?;

        if symbols_refresh_ms < 1_000 {
            bail!("MARKETS_SYMBOLS_REFRESH_MS must be >= 1000");
        }
        if tickers_poll_ms < 200 {
            bail!("MARKETS_TICKERS_POLL_MS must be >= 200");
        }
        if contracts_poll_ms < 200 {
            bail!("MARKETS_CONTRACTS_POLL_MS must be >= 200");
        }
        if !funding_interval_hours.is_finite() || funding_interval_hours <= 0.0 {
            bail!("MARKETS_FUNDING_INTERVAL_HOURS must be > 0");
        }

        let edge = env::var("MARKETS_EDGE")
            .ok()
            .and_then(|raw| parse_optional_bool(&raw));

        Ok(Self {
            bind_addr,
            client_mode,
            edge,
            symbols_refresh_ms,
            tickers_poll_ms,
            contracts_poll_ms,
            stale_after_ms,
            funding_interval_hours,
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
                "Unsupported MARKETS_NETWORK='{other}'. Expected one of: test, prod, local, local-alt"
            )
        }
    }
}

fn parse_u64(key: &str, default: u64) -> Result<u64> {
    let Some(raw) = env::var(key).ok() else {
        return Ok(default);
    };

    raw.parse::<u64>()
        .map_err(|_| anyhow::anyhow!("{key} must be a valid positive integer"))
}

fn parse_f64(key: &str, default: f64) -> Result<f64> {
    let Some(raw) = env::var(key).ok() else {
        return Ok(default);
    };

    raw.parse::<f64>()
        .map_err(|_| anyhow::anyhow!("{key} must be a valid number"))
}

fn parse_optional_bool(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "y" | "on" => Some(true),
        "0" | "false" | "no" | "n" | "off" => Some(false),
        _ => None,
    }
}
