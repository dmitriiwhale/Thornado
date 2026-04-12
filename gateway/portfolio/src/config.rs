use std::env;

use anyhow::{Result, bail};
use nado_sdk::prelude::ClientMode;

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:3006";
const DEFAULT_SUBACCOUNT_NAME: &str = "default";
const DEFAULT_POLL_MS: u64 = 5_000;
const DEFAULT_EVENT_REFRESH_DEBOUNCE_MS: u64 = 750;

#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub client_mode: ClientMode,
    pub gateway_url: Option<String>,
    pub nado_ws_url: Option<String>,
    pub archive_url: Option<String>,
    pub default_subaccount_name: String,
    pub poll_ms: u64,
    pub event_refresh_debounce_ms: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("PORTFOLIO_BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());

        let network = env::var("PORTFOLIO_NETWORK").unwrap_or_else(|_| "test".to_string());
        let client_mode = parse_mode(&network)?;

        let gateway_url = env::var("PORTFOLIO_NADO_GATEWAY_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let nado_ws_url = env::var("PORTFOLIO_NADO_WS_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| gateway_url.as_deref().map(gateway_to_subscription_ws_url));

        let archive_url = env::var("PORTFOLIO_NADO_ARCHIVE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let default_subaccount_name = env::var("PORTFOLIO_DEFAULT_SUBACCOUNT")
            .unwrap_or_else(|_| DEFAULT_SUBACCOUNT_NAME.to_string())
            .trim()
            .to_string();

        if default_subaccount_name.is_empty() {
            bail!("PORTFOLIO_DEFAULT_SUBACCOUNT cannot be empty")
        }
        if default_subaccount_name.len() > 12 {
            bail!(
                "PORTFOLIO_DEFAULT_SUBACCOUNT too long: {} bytes (max 12)",
                default_subaccount_name.len()
            )
        }

        let poll_ms = parse_u64("PORTFOLIO_POLL_MS", DEFAULT_POLL_MS)?;
        if poll_ms < 1_000 {
            bail!("PORTFOLIO_POLL_MS must be >= 1000")
        }

        let event_refresh_debounce_ms = parse_u64(
            "PORTFOLIO_EVENT_REFRESH_DEBOUNCE_MS",
            DEFAULT_EVENT_REFRESH_DEBOUNCE_MS,
        )?;

        Ok(Self {
            bind_addr,
            client_mode,
            gateway_url,
            nado_ws_url,
            archive_url,
            default_subaccount_name,
            poll_ms,
            event_refresh_debounce_ms,
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
                "Unsupported PORTFOLIO_NETWORK='{other}'. Expected one of: test, prod, local, local-alt"
            )
        }
    }
}

fn parse_u64(name: &str, default: u64) -> Result<u64> {
    match env::var(name) {
        Ok(v) => v
            .trim()
            .parse::<u64>()
            .map_err(|e| anyhow::anyhow!("{name} must be u64: {e}")),
        Err(_) => Ok(default),
    }
}

fn gateway_to_subscription_ws_url(gateway_url: &str) -> String {
    let ws_gateway = gateway_url
        .replace("https://", "wss://")
        .replace("http://", "ws://")
        .trim_end_matches('/')
        .to_string();

    if ws_gateway.ends_with("/subscribe") {
        ws_gateway
    } else {
        format!("{ws_gateway}/subscribe")
    }
}
