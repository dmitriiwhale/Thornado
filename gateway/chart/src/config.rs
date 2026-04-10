use std::env;

use anyhow::{Result, bail};
use nado_sdk::prelude::ClientMode;

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:3004";
const DEFAULT_GRANULARITY: u32 = 60;
const DEFAULT_HISTORY_LIMIT: usize = 500;
const DEFAULT_CACHE_CAPACITY: usize = 1500;
const DEFAULT_SUPPORTED_GRANULARITIES: &str = "60,300,900,3600,7200,14400,86400,604800,2419200";

#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub client_mode: ClientMode,
    pub database_url: String,
    pub nado_ws_url: Option<String>,
    pub nado_archive_url: Option<String>,
    pub default_granularity: u32,
    pub supported_granularities: Vec<u32>,
    pub history_limit: usize,
    pub cache_capacity: usize,
    pub prewarm_symbols: Vec<String>,
    pub prewarm_granularities: Vec<u32>,
    pub prewarm_all: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("CHART_BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
        let network = env::var("CHART_NETWORK").unwrap_or_else(|_| "test".to_string());
        let client_mode = parse_mode(&network)?;

        let database_url = env::var("CHART_DATABASE_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .map(|value| value.trim().to_string())
            .map_err(|_| {
                anyhow::anyhow!(
                    "missing CHART_DATABASE_URL (or DATABASE_URL fallback) for chart time-series storage"
                )
            })?;

        if database_url.is_empty() {
            bail!("CHART_DATABASE_URL cannot be empty")
        }

        let nado_ws_url = env::var("CHART_NADO_WS_URL")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());

        let nado_archive_url = env::var("CHART_NADO_ARCHIVE_URL")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());

        let supported_granularities = env::var("CHART_SUPPORTED_GRANULARITIES")
            .ok()
            .map(|v| parse_granularity_csv(&v))
            .transpose()?
            .unwrap_or_else(|| {
                parse_granularity_csv(DEFAULT_SUPPORTED_GRANULARITIES).unwrap_or_default()
            });

        if supported_granularities.is_empty() {
            bail!("CHART_SUPPORTED_GRANULARITIES must include at least one granularity")
        }

        let default_granularity = env::var("CHART_DEFAULT_GRANULARITY")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(DEFAULT_GRANULARITY);

        if !supported_granularities.contains(&default_granularity) {
            bail!(
                "CHART_DEFAULT_GRANULARITY={} is not in CHART_SUPPORTED_GRANULARITIES",
                default_granularity
            )
        }

        let history_limit = env::var("CHART_HISTORY_LIMIT")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(DEFAULT_HISTORY_LIMIT)
            .clamp(50, 2000);

        let cache_capacity = env::var("CHART_CACHE_CAPACITY")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(DEFAULT_CACHE_CAPACITY)
            .clamp(history_limit, 10000);

        let prewarm_symbols = env::var("CHART_PREWARM_SYMBOLS")
            .ok()
            .map(|raw| {
                raw.split(',')
                    .map(|s| s.trim().to_uppercase())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let prewarm_granularities = env::var("CHART_PREWARM_GRANULARITIES")
            .ok()
            .map(|raw| parse_granularity_csv(&raw))
            .transpose()?
            .unwrap_or_else(|| vec![default_granularity]);

        if prewarm_granularities
            .iter()
            .any(|value| !supported_granularities.contains(value))
        {
            bail!("CHART_PREWARM_GRANULARITIES must be a subset of CHART_SUPPORTED_GRANULARITIES")
        }

        let prewarm_all = env::var("CHART_PREWARM_ALL")
            .ok()
            .map(|value| parse_bool(&value))
            .unwrap_or(false);

        Ok(Self {
            bind_addr,
            client_mode,
            database_url,
            nado_ws_url,
            nado_archive_url,
            default_granularity,
            supported_granularities,
            history_limit,
            cache_capacity,
            prewarm_symbols,
            prewarm_granularities,
            prewarm_all,
        })
    }
}

fn parse_granularity_csv(raw: &str) -> Result<Vec<u32>> {
    let mut out = raw
        .split(',')
        .map(|chunk| chunk.trim())
        .filter(|chunk| !chunk.is_empty())
        .map(|chunk| {
            chunk.parse::<u32>().map_err(|_| {
                anyhow::anyhow!(
                    "invalid granularity value '{}' (expected integer seconds)",
                    chunk
                )
            })
        })
        .collect::<Result<Vec<_>>>()?;

    out.sort_unstable();
    out.dedup();

    if out.iter().any(|v| *v == 0) {
        bail!("granularity cannot be 0")
    }

    Ok(out)
}

fn parse_mode(value: &str) -> Result<ClientMode> {
    match value.trim().to_lowercase().as_str() {
        "test" => Ok(ClientMode::Test),
        "prod" => Ok(ClientMode::Prod),
        "local" => Ok(ClientMode::Local),
        "local-alt" | "local_alt" => Ok(ClientMode::LocalAlt),
        other => {
            bail!(
                "Unsupported CHART_NETWORK='{other}'. Expected one of: test, prod, local, local-alt"
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
