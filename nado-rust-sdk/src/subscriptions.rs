use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use eyre::{eyre, Result};
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::{
    HeaderValue, SEC_WEBSOCKET_EXTENSIONS,
};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use crate::core::base::NadoBase;
use crate::eip712_structs::StreamAuthentication;
use crate::tx::{domain, get_eip712_digest};
use crate::utils::client_mode::ClientMode;

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;
type WsWrite = SplitSink<WsStream, Message>;
type WsRead = SplitStream<WsStream>;

const DEFAULT_REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const DEFAULT_PING_INTERVAL: Duration = Duration::from_secs(30);
const DEFAULT_COMMAND_BUFFER: usize = 128;
const DEFAULT_EVENT_BUFFER: usize = 1024;

#[derive(Debug, Clone)]
pub struct SubscriptionsConfig {
    pub url: String,
    pub request_timeout: Duration,
    pub ping_interval: Duration,
    pub command_buffer: usize,
    pub event_buffer: usize,
}

impl Default for SubscriptionsConfig {
    fn default() -> Self {
        Self {
            url: ClientMode::Test.default_subscription_ws_url(),
            request_timeout: DEFAULT_REQUEST_TIMEOUT,
            ping_interval: DEFAULT_PING_INTERVAL,
            command_buffer: DEFAULT_COMMAND_BUFFER,
            event_buffer: DEFAULT_EVENT_BUFFER,
        }
    }
}

impl SubscriptionsConfig {
    pub fn with_client_mode(client_mode: ClientMode) -> Self {
        Self {
            url: client_mode.default_subscription_ws_url(),
            ..Self::default()
        }
    }

    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = url.into();
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum StreamType {
    Default,
    OrderUpdate,
    Trade,
    BestBidOffer,
    Fill,
    PositionChange,
    BookDepth,
    Liquidation,
    LatestCandlestick,
    FundingPayment,
    FundingRate,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Stream {
    #[serde(rename = "type")]
    pub stream_type: StreamType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_id: Option<Option<u32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subaccount: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granularity: Option<u32>,
}

impl Stream {
    pub fn order_update(subaccount: [u8; 32], product_id: Option<u32>) -> Self {
        Self {
            stream_type: StreamType::OrderUpdate,
            product_id: Some(product_id),
            subaccount: Some(format!("0x{}", hex::encode(subaccount))),
            granularity: None,
        }
    }

    pub fn trade(product_id: u32) -> Self {
        Self {
            stream_type: StreamType::Trade,
            product_id: Some(Some(product_id)),
            subaccount: None,
            granularity: None,
        }
    }

    pub fn best_bid_offer(product_id: u32) -> Self {
        Self {
            stream_type: StreamType::BestBidOffer,
            product_id: Some(Some(product_id)),
            subaccount: None,
            granularity: None,
        }
    }

    pub fn fill(subaccount: [u8; 32], product_id: Option<u32>) -> Self {
        Self {
            stream_type: StreamType::Fill,
            product_id: Some(product_id),
            subaccount: Some(format!("0x{}", hex::encode(subaccount))),
            granularity: None,
        }
    }

    pub fn position_change(subaccount: [u8; 32], product_id: Option<u32>) -> Self {
        Self {
            stream_type: StreamType::PositionChange,
            product_id: Some(product_id),
            subaccount: Some(format!("0x{}", hex::encode(subaccount))),
            granularity: None,
        }
    }

    pub fn book_depth(product_id: u32) -> Self {
        Self {
            stream_type: StreamType::BookDepth,
            product_id: Some(Some(product_id)),
            subaccount: None,
            granularity: None,
        }
    }

    pub fn liquidation(product_id: Option<u32>) -> Self {
        Self {
            stream_type: StreamType::Liquidation,
            product_id: Some(product_id),
            subaccount: None,
            granularity: None,
        }
    }

    pub fn latest_candlestick(product_id: u32, granularity: u32) -> Self {
        Self {
            stream_type: StreamType::LatestCandlestick,
            product_id: Some(Some(product_id)),
            subaccount: None,
            granularity: Some(granularity),
        }
    }

    pub fn funding_payment(product_id: u32) -> Self {
        Self {
            stream_type: StreamType::FundingPayment,
            product_id: Some(Some(product_id)),
            subaccount: None,
            granularity: None,
        }
    }

    pub fn funding_rate(product_id: Option<u32>) -> Self {
        Self {
            stream_type: StreamType::FundingRate,
            product_id: Some(product_id),
            subaccount: None,
            granularity: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SubscriptionEvent {
    pub stream: Option<Stream>,
    pub payload: Value,
    pub raw: Value,
}

impl SubscriptionEvent {
    pub fn stream_type(&self) -> Option<&StreamType> {
        self.stream.as_ref().map(|stream| &stream.stream_type)
    }

    pub fn last_max_timestamp(&self) -> Option<u64> {
        get_u64_field(&self.payload, "last_max_timestamp")
            .or_else(|| get_u64_field(&self.raw, "last_max_timestamp"))
    }
}

pub struct SubscriptionsClient {
    cmd_tx: mpsc::Sender<Command>,
    events_rx: mpsc::Receiver<SubscriptionEvent>,
    worker_task: Option<JoinHandle<()>>,
    request_timeout: Duration,
    next_id: AtomicU64,
}

impl SubscriptionsClient {
    pub async fn connect_with_client_mode(client_mode: ClientMode) -> Result<Self> {
        Self::connect(SubscriptionsConfig::with_client_mode(client_mode)).await
    }

    pub async fn connect(config: SubscriptionsConfig) -> Result<Self> {
        install_rustls_provider();
        let request = ws_request(&config.url)?;
        let (stream, _) = connect_async(request).await?;
        let (write, read) = stream.split();
        let (cmd_tx, cmd_rx) = mpsc::channel(config.command_buffer);
        let (events_tx, events_rx) = mpsc::channel(config.event_buffer);

        let worker_task = tokio::spawn(connection_worker(
            write,
            read,
            cmd_rx,
            events_tx,
            config.ping_interval,
        ));

        Ok(Self {
            cmd_tx,
            events_rx,
            worker_task: Some(worker_task),
            request_timeout: config.request_timeout,
            next_id: AtomicU64::new(1),
        })
    }

    pub async fn authenticate_with_nado<V: NadoBase>(&self, nado: &V, ttl: Duration) -> Result<()> {
        let now_ms = now_millis()?;
        let ttl_ms =
            u64::try_from(ttl.as_millis()).map_err(|_| eyre!("ttl overflows u64 milliseconds"))?;
        let expiration = now_ms.saturating_add(ttl_ms);
        let auth_tx = StreamAuthentication {
            sender: nado.subaccount()?,
            expiration,
        };

        let signature = stream_auth_signature(nado, &auth_tx)?;
        self.authenticate(auth_tx, signature).await
    }

    pub async fn authenticate(
        &self,
        tx: StreamAuthentication,
        signature: impl Into<String>,
    ) -> Result<()> {
        let id = self.request_id();
        let request = AuthenticateRequest {
            method: "authenticate",
            id,
            tx,
            signature: signature.into(),
        };
        self.send_and_expect_ok(request, id).await
    }

    pub async fn subscribe(&self, stream: Stream) -> Result<()> {
        let id = self.request_id();
        let request = StreamRequest {
            method: "subscribe",
            id,
            stream,
        };
        self.send_and_expect_ok(request, id).await
    }

    pub async fn unsubscribe(&self, stream: Stream) -> Result<()> {
        let id = self.request_id();
        let request = StreamRequest {
            method: "unsubscribe",
            id,
            stream,
        };
        self.send_and_expect_ok(request, id).await
    }

    pub async fn list(&self) -> Result<Vec<Stream>> {
        let id = self.request_id();
        let request = ListRequest { method: "list", id };
        let response = self.send_request(request, id).await?;
        if let Some(error) = response.error {
            return Err(eyre!("list failed: {error}"));
        }
        let Some(result) = response.result else {
            return Ok(vec![]);
        };
        serde_json::from_value(result).map_err(Into::into)
    }

    pub async fn next_event(&mut self) -> Option<SubscriptionEvent> {
        self.events_rx.recv().await
    }

    pub async fn close(mut self) -> Result<()> {
        let Some(worker_task) = self.worker_task.take() else {
            return Ok(());
        };

        let (ack_tx, ack_rx) = oneshot::channel();
        let sent = self.cmd_tx.send(Command::Close { ack_tx }).await;
        if sent.is_ok() {
            let _ = timeout(Duration::from_secs(2), ack_rx).await;
        }
        let _ = worker_task.await;
        Ok(())
    }

    async fn send_and_expect_ok<T: Serialize>(&self, request: T, id: u64) -> Result<()> {
        let response = self.send_request(request, id).await?;
        if let Some(error) = response.error {
            return Err(eyre!("request failed: {error}"));
        }
        Ok(())
    }

    async fn send_request<T: Serialize>(&self, request: T, id: u64) -> Result<RpcResponse> {
        let payload = serde_json::to_string(&request)?;
        let (response_tx, response_rx) = oneshot::channel();
        self.cmd_tx
            .send(Command::Request {
                id,
                payload,
                response_tx,
            })
            .await
            .map_err(|_| eyre!("websocket connection worker is not running"))?;

        timeout(self.request_timeout, response_rx)
            .await
            .map_err(|_| eyre!("timed out waiting for websocket response"))?
            .map_err(|_| eyre!("websocket response channel dropped"))?
    }

    fn request_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }
}

impl Drop for SubscriptionsClient {
    fn drop(&mut self) {
        if let Some(worker_task) = self.worker_task.take() {
            worker_task.abort();
        }
    }
}

#[derive(Debug, Serialize)]
struct AuthenticateRequest {
    method: &'static str,
    id: u64,
    tx: StreamAuthentication,
    signature: String,
}

#[derive(Debug, Serialize)]
struct StreamRequest {
    method: &'static str,
    id: u64,
    stream: Stream,
}

#[derive(Debug, Serialize)]
struct ListRequest {
    method: &'static str,
    id: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct RpcResponse {
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<Value>,
    id: u64,
}

#[derive(Debug)]
enum Command {
    Request {
        id: u64,
        payload: String,
        response_tx: oneshot::Sender<Result<RpcResponse>>,
    },
    Close {
        ack_tx: oneshot::Sender<()>,
    },
}

async fn connection_worker(
    mut write: WsWrite,
    mut read: WsRead,
    mut cmd_rx: mpsc::Receiver<Command>,
    events_tx: mpsc::Sender<SubscriptionEvent>,
    ping_interval: Duration,
) {
    let mut pending: HashMap<u64, oneshot::Sender<Result<RpcResponse>>> = HashMap::new();
    let mut ping_ticker = tokio::time::interval(ping_interval);
    ping_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let close_result: Result<()> = loop {
        tokio::select! {
            maybe_command = cmd_rx.recv() => {
                let Some(command) = maybe_command else {
                    break Ok(());
                };
                match command {
                    Command::Request { id, payload, response_tx } => {
                        let send_result = write.send(Message::Text(payload.into())).await;
                        if let Err(error) = send_result {
                            let _ = response_tx.send(Err(eyre!("failed sending websocket request: {error}")));
                            break Err(eyre!("failed sending websocket request: {error}"));
                        }
                        pending.insert(id, response_tx);
                    }
                    Command::Close { ack_tx } => {
                        let _ = write.send(Message::Close(None)).await;
                        let _ = ack_tx.send(());
                        break Ok(());
                    }
                }
            }
            _ = ping_ticker.tick() => {
                if let Err(error) = write.send(Message::Ping(Vec::new().into())).await {
                    break Err(eyre!("failed sending ping: {error}"));
                }
            }
            incoming = read.next() => {
                match incoming {
                    Some(Ok(message)) => {
                        if let Err(error) = handle_message(message, &mut write, &mut pending, &events_tx).await {
                            break Err(error);
                        }
                    }
                    Some(Err(error)) => break Err(eyre!("websocket read error: {error}")),
                    None => break Ok(()),
                }
            }
        }
    };

    if let Err(error) = close_result {
        for (_, response_tx) in pending.drain() {
            let _ = response_tx.send(Err(eyre!("{error}")));
        }
        return;
    }

    for (_, response_tx) in pending {
        let _ = response_tx.send(Err(eyre!("websocket connection closed")));
    }
}

async fn handle_message(
    message: Message,
    write: &mut WsWrite,
    pending: &mut HashMap<u64, oneshot::Sender<Result<RpcResponse>>>,
    events_tx: &mpsc::Sender<SubscriptionEvent>,
) -> Result<()> {
    match message {
        Message::Text(text) => handle_text_message(&text, pending, events_tx).await,
        Message::Binary(bytes) => {
            let text = String::from_utf8(bytes.to_vec())
                .map_err(|_| eyre!("received non-utf8 websocket binary frame"))?;
            handle_text_message(&text, pending, events_tx).await
        }
        Message::Ping(payload) => {
            write.send(Message::Pong(payload)).await?;
            Ok(())
        }
        Message::Pong(_) => Ok(()),
        Message::Frame(_) => Ok(()),
        Message::Close(frame) => match frame {
            Some(frame) => Err(eyre!("websocket closed: {} ({})", frame.reason, frame.code)),
            None => Err(eyre!("websocket closed")),
        },
    }
}

async fn handle_text_message(
    text: &str,
    pending: &mut HashMap<u64, oneshot::Sender<Result<RpcResponse>>>,
    events_tx: &mpsc::Sender<SubscriptionEvent>,
) -> Result<()> {
    let value: Value = serde_json::from_str(text)?;
    if let Some(response) = parse_rpc_response(&value)? {
        if let Some(response_tx) = pending.remove(&response.id) {
            let _ = response_tx.send(Ok(response));
        }
        return Ok(());
    }

    let event = parse_event(value);
    events_tx.send(event).await?;
    Ok(())
}

fn parse_rpc_response(value: &Value) -> Result<Option<RpcResponse>> {
    let Some(id_value) = value.get("id") else {
        return Ok(None);
    };
    if !value.get("result").is_some() && !value.get("error").is_some() {
        return Ok(None);
    }

    let id = id_value
        .as_u64()
        .ok_or_else(|| eyre!("response id is not a u64"))?;
    let response = RpcResponse {
        result: value.get("result").cloned(),
        error: value.get("error").cloned(),
        id,
    };
    Ok(Some(response))
}

fn parse_event(value: Value) -> SubscriptionEvent {
    let stream = value
        .get("stream")
        .cloned()
        .and_then(|stream| serde_json::from_value(stream).ok());
    let payload = value.get("event").cloned().unwrap_or_else(|| value.clone());

    SubscriptionEvent {
        stream,
        payload,
        raw: value,
    }
}

fn ws_request(url: &str) -> Result<tokio_tungstenite::tungstenite::http::Request<()>> {
    let mut request = url.into_client_request()?;
    request.headers_mut().insert(
        SEC_WEBSOCKET_EXTENSIONS,
        HeaderValue::from_static("permessage-deflate"),
    );
    Ok(request)
}

fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn stream_auth_signature<V: NadoBase>(nado: &V, auth_tx: &StreamAuthentication) -> Result<String> {
    let eip712_domain = domain(nado.chain_id()?, nado.endpoint_addr());
    let digest = get_eip712_digest(auth_tx, &eip712_domain);
    let signature = nado.wallet()?.sign_hash(digest)?;
    Ok(format!("0x{}", hex::encode(signature.to_vec())))
}

fn now_millis() -> Result<u64> {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| eyre!("system time error: {error}"))?;
    let millis =
        u64::try_from(since_epoch.as_millis()).map_err(|_| eyre!("timestamp overflows u64"))?;
    Ok(millis)
}

fn get_u64_field(value: &Value, field_name: &str) -> Option<u64> {
    let field = value.get(field_name)?;
    if let Some(v) = field.as_u64() {
        return Some(v);
    }
    if let Some(v) = field.as_str() {
        return v.parse::<u64>().ok();
    }
    None
}

trait SubscriptionEndpointUrl {
    fn default_subscription_ws_url(&self) -> String;
}

impl SubscriptionEndpointUrl for ClientMode {
    fn default_subscription_ws_url(&self) -> String {
        let gateway = self.default_gateway_url();
        let ws_gateway = gateway
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        format!("{}/subscribe", ws_gateway.trim_end_matches('/'))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_none_product_id_serializes_to_null() {
        let stream = Stream::funding_rate(None);
        let value = serde_json::to_value(stream).unwrap();
        assert_eq!(value.get("product_id").unwrap(), &Value::Null);
    }

    #[test]
    fn stream_omits_product_id_when_not_applicable() {
        let stream = Stream {
            stream_type: StreamType::Default,
            product_id: None,
            subaccount: None,
            granularity: None,
        };
        let value = serde_json::to_value(stream).unwrap();
        assert!(value.get("product_id").is_none());
    }

    #[test]
    fn converts_gateway_to_subscription_ws_url() {
        assert_eq!(
            ClientMode::Test.default_subscription_ws_url(),
            "wss://gateway.test.nado.xyz/v1/subscribe"
        );
        assert_eq!(
            ClientMode::Local.default_subscription_ws_url(),
            "ws://gateway.local.nado.xyz:80/v1/subscribe"
        );
    }

    #[test]
    fn ws_request_sets_permessage_deflate_header() {
        let request = ws_request("wss://gateway.test.nado.xyz/v1/subscribe").unwrap();
        assert_eq!(
            request
                .headers()
                .get(SEC_WEBSOCKET_EXTENSIONS)
                .and_then(|value| value.to_str().ok()),
            Some("permessage-deflate")
        );
    }
}
