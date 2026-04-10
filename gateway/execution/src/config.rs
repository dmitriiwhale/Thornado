use std::env;

use anyhow::{Result, bail};
use nado_sdk::prelude::ClientMode;

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:3003";
const DEFAULT_SUBACCOUNT_NAME: &str = "default";

#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub client_mode: ClientMode,
    pub gateway_url: Option<String>,
    pub trigger_url: Option<String>,
    pub default_subaccount_name: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr =
            env::var("EXECUTION_BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());

        let network = env::var("EXECUTION_NETWORK").unwrap_or_else(|_| "test".to_string());
        let client_mode = parse_mode(&network)?;

        let gateway_url = env::var("EXECUTION_NADO_GATEWAY_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let trigger_url = env::var("EXECUTION_NADO_TRIGGER_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let default_subaccount_name = env::var("EXECUTION_DEFAULT_SUBACCOUNT")
            .unwrap_or_else(|_| DEFAULT_SUBACCOUNT_NAME.to_string())
            .trim()
            .to_string();

        if default_subaccount_name.is_empty() {
            bail!("EXECUTION_DEFAULT_SUBACCOUNT cannot be empty")
        }
        if default_subaccount_name.len() > 12 {
            bail!(
                "EXECUTION_DEFAULT_SUBACCOUNT too long: {} bytes (max 12)",
                default_subaccount_name.len()
            )
        }

        Ok(Self {
            bind_addr,
            client_mode,
            gateway_url,
            trigger_url,
            default_subaccount_name,
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
                "Unsupported EXECUTION_NETWORK='{other}'. Expected one of: test, prod, local, local-alt"
            )
        }
    }
}
