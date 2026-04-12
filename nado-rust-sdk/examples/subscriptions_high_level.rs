// High-level websocket subscriptions example.
//
// Run with:
// cargo run --example subscriptions_high_level --features ws
//
// Required environment variables:
// - RUST_SDK_PRIVATE_KEY: wallet private key used for stream authentication
//
// Optional environment variables:
// - NETWORK: "test" or "prod" (defaults to "test")

use std::env;
use std::time::Duration;

use eyre::Result;
use nado_sdk::prelude::*;
use nado_sdk::utils::private_key::private_key;

fn network_mode() -> ClientMode {
    match env::var("NETWORK")
        .unwrap_or_else(|_| "test".to_string())
        .as_str()
    {
        "prod" => ClientMode::Prod,
        _ => ClientMode::Test,
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();

    let mode = network_mode();
    let nado = NadoClient::new(mode.clone())
        .with_signer(private_key())
        .await?;

    let mut ws = SubscriptionsClient::connect_with_client_mode(mode).await?;

    // order_update is the only authenticated stream
    ws.authenticate_with_nado(&nado, Duration::from_secs(90))
        .await?;

    const BTC_PERP: u32 = 2;
    ws.subscribe(Stream::trade(BTC_PERP)).await?;
    ws.subscribe(Stream::book_depth(BTC_PERP)).await?;
    ws.subscribe(Stream::order_update(nado.subaccount()?, Some(BTC_PERP)))
        .await?;

    println!("Subscribed. Listening for realtime events...");
    while let Some(event) = ws.next_event().await {
        println!("{}", serde_json::to_string(&event.raw)?);
    }

    Ok(())
}
