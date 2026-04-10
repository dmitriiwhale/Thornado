mod config;

use std::collections::HashMap;
use std::fmt::Debug;
use std::net::SocketAddr;
use std::str::FromStr;

use anyhow::{Context, Result};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use ethers_core::types::transaction::eip712::{EIP712Domain, Eip712};
use ethers_core::types::{H160, Signature, U256};
use nado_sdk::eip712_structs::{
    BurnNlp, Cancellation, CancellationProducts, LinkSigner, LiquidateSubaccount, MintNlp, Order,
    TransferQuote, WithdrawCollateral, concat_to_bytes32, to_bytes12,
};
use nado_sdk::engine;
use nado_sdk::prelude::{ClientMode, NadoClient, NadoQuery};
use nado_sdk::trigger;
use nado_sdk::tx;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::config::Config;

const SESSION_HEADER: &str = "x-thornado-session-address";

#[derive(Clone)]
struct AppState {
    config: Config,
    nado_client: NadoClient,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    network: &'static str,
    gateway_url: String,
    trigger_url: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    Upstream(String),
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            Self::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            Self::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            Self::Upstream(msg) => (StatusCode::BAD_GATEWAY, msg),
            Self::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };
        (status, Json(ErrorResponse { error: message })).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct ContextQuery {
    owner: Option<String>,
    subaccount_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExecutionContextResponse {
    owner: String,
    subaccount_name: String,
    subaccount: String,
    linked_signer: String,
    linked_signer_set: bool,
}

#[derive(Debug, Serialize)]
struct CapabilitiesResponse {
    executes: Vec<&'static str>,
    trigger_executes: Vec<&'static str>,
    orders_supported: Vec<&'static str>,
    orders_not_supported: Vec<&'static str>,
}

#[derive(Clone, Copy)]
struct ContractsInfo {
    chain_id: u64,
    endpoint_addr: H160,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    install_rustls_provider();

    let config = Config::from_env()?;

    let mut nado_client = NadoClient::new(config.client_mode.clone());
    if let Some(gateway_url) = &config.gateway_url {
        nado_client = nado_client.with_gateway_url(gateway_url.clone());
    }
    if let Some(trigger_url) = &config.trigger_url {
        nado_client = nado_client.with_trigger_url(trigger_url.clone());
    }

    let app_state = AppState {
        config: config.clone(),
        nado_client,
    };

    let app = Router::new()
        .route("/health", get(get_health))
        .route("/v1/capabilities", get(get_capabilities))
        .route("/v1/context", get(get_context))
        .route("/v1/execute", post(post_execute))
        .route("/v1/execute/trigger", post(post_execute_trigger))
        .with_state(app_state);

    let addr: SocketAddr = config
        .bind_addr
        .parse()
        .with_context(|| format!("invalid EXECUTION_BIND_ADDR={}", config.bind_addr))?;

    info!(
        %addr,
        network = %network_label(&config.client_mode),
        gateway = %config.gateway_url.clone().unwrap_or_else(|| "<default>".to_string()),
        trigger = %config.trigger_url.clone().unwrap_or_else(|| "<default>".to_string()),
        "execution gateway ready"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let env_filter = std::env::var("RUST_LOG").unwrap_or_else(|_| "execution_gateway=info".into());
    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .compact()
        .init();
}

fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn network_label(mode: &ClientMode) -> &'static str {
    match mode {
        ClientMode::Test => "test",
        ClientMode::Prod => "prod",
        ClientMode::Local => "local",
        ClientMode::LocalAlt => "local-alt",
    }
}

async fn get_health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        network: network_label(&state.config.client_mode),
        gateway_url: state.nado_client.gateway_url.clone(),
        trigger_url: state.nado_client.trigger_url.clone(),
    })
}

async fn get_capabilities() -> Json<CapabilitiesResponse> {
    Json(CapabilitiesResponse {
        executes: vec![
            "place_order",
            "cancel_orders",
            "cancel_product_orders",
            "cancel_and_place",
            "withdraw_collateral",
            "mint_nlp",
            "burn_nlp",
            "transfer_quote",
            "link_signer",
            "liquidate_subaccount",
        ],
        trigger_executes: vec![
            "place_order",
            "place_orders",
            "cancel_orders",
            "cancel_product_orders",
        ],
        orders_supported: vec![
            "limit",
            "ioc_market",
            "post_only",
            "reduce_only",
            "stop_loss_take_profit",
        ],
        orders_not_supported: vec!["fok", "twap"],
    })
}

async fn get_context(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ContextQuery>,
) -> Result<Json<ExecutionContextResponse>, ApiError> {
    let owner = match query.owner {
        Some(owner) => parse_address(&owner)?,
        None => session_address_from_headers(&headers)?,
    };

    let subaccount_name =
        subaccount_name_from_query(query.subaccount_name, &state.config.default_subaccount_name)?;

    let subaccount = concat_to_bytes32(owner.into(), to_bytes12(&subaccount_name));

    let linked_signer = state
        .nado_client
        .get_linked_signer(subaccount)
        .await
        .map_err(|err| ApiError::Upstream(format!("failed to fetch linked signer: {err}")))?
        .linked_signer;

    let linked_signer = H160::from(linked_signer);

    Ok(Json(ExecutionContextResponse {
        owner: hex_address(owner),
        subaccount_name,
        subaccount: hex_subaccount(subaccount),
        linked_signer: hex_address(linked_signer),
        linked_signer_set: !is_zero_address(linked_signer),
    }))
}

async fn post_execute(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(execute): Json<engine::Execute>,
) -> Result<Json<engine::ExecuteResponse>, ApiError> {
    let session_address = session_address_from_headers(&headers)?;
    validate_engine_execute(&state, session_address, &execute).await?;

    let url = format!("{}/execute", state.nado_client.gateway_url);
    let response = state
        .nado_client
        .client
        .post_request::<_, engine::ExecuteResponse>(&url, &execute)
        .await
        .map_err(|err| ApiError::Upstream(format!("nado execute failed: {err}")))?;

    Ok(Json(response))
}

async fn post_execute_trigger(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(execute): Json<trigger::Execute>,
) -> Result<Json<engine::ExecuteResponse>, ApiError> {
    let session_address = session_address_from_headers(&headers)?;
    validate_trigger_execute(&state, session_address, &execute).await?;

    let url = format!("{}/execute", state.nado_client.trigger_url);
    let response = state
        .nado_client
        .client
        .post_request::<_, engine::ExecuteResponse>(&url, &execute)
        .await
        .map_err(|err| ApiError::Upstream(format!("nado trigger execute failed: {err}")))?;

    Ok(Json(response))
}

async fn fetch_contracts(state: &AppState) -> Result<ContractsInfo, ApiError> {
    let contracts = state
        .nado_client
        .get_contracts()
        .await
        .map_err(|err| ApiError::Upstream(format!("failed to fetch contracts: {err}")))?;

    Ok(ContractsInfo {
        chain_id: contracts.chain_id,
        endpoint_addr: H160::from(contracts.endpoint_addr),
    })
}

async fn validate_engine_execute(
    state: &AppState,
    session_address: H160,
    execute: &engine::Execute,
) -> Result<(), ApiError> {
    let contracts = fetch_contracts(state).await?;
    let mut linked_signers = HashMap::<[u8; 32], H160>::new();

    match execute {
        engine::Execute::PlaceOrder(place_order) => {
            ensure_supported_regular_order(&place_order.order)?;

            let recovered = recover_order_signer(
                &place_order.order,
                &place_order.signature,
                place_order.product_id,
                contracts.chain_id,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                place_order.order.sender,
                session_address,
                recovered,
            )
            .await?;
        }
        engine::Execute::CancelOrders { tx, signature } => {
            let recovered = recover_endpoint_signer(
                tx,
                signature,
                contracts.chain_id,
                contracts.endpoint_addr,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                tx.sender,
                session_address,
                recovered,
            )
            .await?;
        }
        engine::Execute::CancelProductOrders { tx, signature, .. } => {
            let recovered = recover_endpoint_signer(
                tx,
                signature,
                contracts.chain_id,
                contracts.endpoint_addr,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                tx.sender,
                session_address,
                recovered,
            )
            .await?;
        }
        engine::Execute::CancelAndPlace {
            cancel_tx,
            cancel_signature,
            place_order,
            ..
        } => {
            if cancel_tx.sender != place_order.order.sender {
                return Err(ApiError::Forbidden(
                    "cancel_and_place sender mismatch between cancel_tx and place_order".into(),
                ));
            }

            ensure_supported_regular_order(&place_order.order)?;

            let cancel_signer = recover_endpoint_signer(
                cancel_tx,
                cancel_signature,
                contracts.chain_id,
                contracts.endpoint_addr,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                cancel_tx.sender,
                session_address,
                cancel_signer,
            )
            .await?;

            let place_signer = recover_order_signer(
                &place_order.order,
                &place_order.signature,
                place_order.product_id,
                contracts.chain_id,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                place_order.order.sender,
                session_address,
                place_signer,
            )
            .await?;
        }
        engine::Execute::WithdrawCollateral { tx, signature, .. } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
        engine::Execute::MintNlp { tx, signature, .. } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
        engine::Execute::BurnNlp { tx, signature } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
        engine::Execute::TransferQuote { tx, signature } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
        engine::Execute::LinkSigner { tx, signature } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
        engine::Execute::LiquidateSubaccount { tx, signature } => {
            validate_endpoint_execute(
                state,
                &mut linked_signers,
                session_address,
                contracts,
                tx,
                signature,
            )
            .await?;
        }
    }

    Ok(())
}

async fn validate_trigger_execute(
    state: &AppState,
    session_address: H160,
    execute: &trigger::Execute,
) -> Result<(), ApiError> {
    let contracts = fetch_contracts(state).await?;
    let mut linked_signers = HashMap::<[u8; 32], H160>::new();

    match execute {
        trigger::Execute::PlaceOrder(order) => {
            ensure_supported_trigger_order(&order.order)?;

            let recovered = recover_order_signer(
                &order.order,
                order.signature.as_ref(),
                order.product_id,
                contracts.chain_id,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                order.order.sender,
                session_address,
                recovered,
            )
            .await?;
        }
        trigger::Execute::PlaceOrders { orders, .. } => {
            if orders.is_empty() {
                return Err(ApiError::BadRequest(
                    "place_orders requires at least one order".into(),
                ));
            }

            for order in orders {
                ensure_supported_trigger_order(&order.order)?;

                let recovered = recover_order_signer(
                    &order.order,
                    order.signature.as_ref(),
                    order.product_id,
                    contracts.chain_id,
                )?;

                validate_sender_and_signer(
                    state,
                    &mut linked_signers,
                    order.order.sender,
                    session_address,
                    recovered,
                )
                .await?;
            }
        }
        trigger::Execute::CancelOrders { tx, signature } => {
            let recovered = recover_endpoint_signer(
                tx,
                signature.as_ref(),
                contracts.chain_id,
                contracts.endpoint_addr,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                tx.sender,
                session_address,
                recovered,
            )
            .await?;
        }
        trigger::Execute::CancelProductOrders { tx, signature } => {
            let recovered = recover_endpoint_signer(
                tx,
                signature.as_ref(),
                contracts.chain_id,
                contracts.endpoint_addr,
            )?;

            validate_sender_and_signer(
                state,
                &mut linked_signers,
                tx.sender,
                session_address,
                recovered,
            )
            .await?;
        }
    }

    Ok(())
}

async fn validate_endpoint_execute<T>(
    state: &AppState,
    linked_signers: &mut HashMap<[u8; 32], H160>,
    session_address: H160,
    contracts: ContractsInfo,
    tx: &T,
    signature: &[u8],
) -> Result<(), ApiError>
where
    T: Eip712 + Send + Sync + Debug + HasSender,
{
    let recovered =
        recover_endpoint_signer(tx, signature, contracts.chain_id, contracts.endpoint_addr)?;

    validate_sender_and_signer(
        state,
        linked_signers,
        tx.sender(),
        session_address,
        recovered,
    )
    .await
}

async fn validate_sender_and_signer(
    state: &AppState,
    linked_signers: &mut HashMap<[u8; 32], H160>,
    sender: [u8; 32],
    session_address: H160,
    recovered_signer: H160,
) -> Result<(), ApiError> {
    let owner = owner_from_subaccount(sender);

    if owner != session_address {
        return Err(ApiError::Forbidden(format!(
            "sender owner {} does not match session {}",
            hex_address(owner),
            hex_address(session_address),
        )));
    }

    let linked_signer = linked_signer_for_sender(state, linked_signers, sender).await?;

    if recovered_signer == owner {
        return Ok(());
    }

    if !is_zero_address(linked_signer) && recovered_signer == linked_signer {
        return Ok(());
    }

    Err(ApiError::Forbidden(format!(
        "signature signer {} is not owner {} or linked signer {}",
        hex_address(recovered_signer),
        hex_address(owner),
        hex_address(linked_signer),
    )))
}

async fn linked_signer_for_sender(
    state: &AppState,
    linked_signers: &mut HashMap<[u8; 32], H160>,
    sender: [u8; 32],
) -> Result<H160, ApiError> {
    if let Some(signer) = linked_signers.get(&sender).copied() {
        return Ok(signer);
    }

    let signer = state
        .nado_client
        .get_linked_signer(sender)
        .await
        .map_err(|err| {
            ApiError::Upstream(format!(
                "failed to fetch linked signer for {}: {err}",
                hex_subaccount(sender)
            ))
        })?
        .linked_signer;

    let signer = H160::from(signer);
    linked_signers.insert(sender, signer);
    Ok(signer)
}

fn ensure_supported_regular_order(order: &Order) -> Result<(), ApiError> {
    match order_type_bits(order) {
        0 | 1 | 3 => {}
        2 => {
            return Err(ApiError::BadRequest(
                "FOK orders are not supported in THORNado execution gateway".into(),
            ));
        }
        _ => {
            return Err(ApiError::BadRequest(
                "unsupported order type in appendix".into(),
            ));
        }
    }

    match trigger_type_bits(order) {
        0 => Ok(()),
        1 => Err(ApiError::BadRequest(
            "price-trigger orders must use /v1/execute/trigger".into(),
        )),
        _ => Err(ApiError::BadRequest(
            "TWAP orders are not supported in THORNado execution gateway".into(),
        )),
    }
}

fn ensure_supported_trigger_order(order: &Order) -> Result<(), ApiError> {
    match order_type_bits(order) {
        0 | 1 | 3 => {}
        2 => {
            return Err(ApiError::BadRequest(
                "FOK orders are not supported in THORNado execution gateway".into(),
            ));
        }
        _ => {
            return Err(ApiError::BadRequest(
                "unsupported order type in appendix".into(),
            ));
        }
    }

    match trigger_type_bits(order) {
        1 => Ok(()),
        0 => Err(ApiError::BadRequest(
            "trigger execute endpoint accepts only stop/take (price-trigger) orders".into(),
        )),
        _ => Err(ApiError::BadRequest(
            "TWAP trigger orders are not supported in THORNado execution gateway".into(),
        )),
    }
}

fn order_type_bits(order: &Order) -> u128 {
    (order.appendix >> 9) & 0b11
}

fn trigger_type_bits(order: &Order) -> u128 {
    (order.appendix >> 12) & 0b11
}

fn recover_order_signer(
    order: &Order,
    signature: &[u8],
    product_id: u32,
    chain_id: u64,
) -> Result<H160, ApiError> {
    let domain = tx::domain(
        U256::from(chain_id),
        H160::from_low_u64_be(u64::from(product_id)),
    );

    recover_typed_signer(order, signature, domain)
}

fn recover_endpoint_signer<T: Eip712 + Send + Sync + Debug>(
    payload: &T,
    signature: &[u8],
    chain_id: u64,
    endpoint_addr: H160,
) -> Result<H160, ApiError> {
    let domain = tx::domain(U256::from(chain_id), endpoint_addr);
    recover_typed_signer(payload, signature, domain)
}

fn recover_typed_signer<T: Eip712 + Send + Sync + Debug>(
    payload: &T,
    signature: &[u8],
    domain: EIP712Domain,
) -> Result<H160, ApiError> {
    if signature.len() != 65 {
        return Err(ApiError::BadRequest(format!(
            "invalid signature length: expected 65 bytes, got {}",
            signature.len()
        )));
    }

    let signature = Signature::try_from(signature)
        .map_err(|err| ApiError::BadRequest(format!("invalid signature bytes: {err}")))?;

    let digest = tx::get_eip712_digest(payload, &domain);

    signature
        .recover(digest)
        .map_err(|err| ApiError::Unauthorized(format!("signature recovery failed: {err}")))
}

fn owner_from_subaccount(sender: [u8; 32]) -> H160 {
    H160::from_slice(&sender[..20])
}

fn parse_address(value: &str) -> Result<H160, ApiError> {
    H160::from_str(value).map_err(|_| ApiError::BadRequest(format!("invalid address: {value}")))
}

fn subaccount_name_from_query(
    maybe_name: Option<String>,
    default_subaccount_name: &str,
) -> Result<String, ApiError> {
    let subaccount_name = maybe_name
        .unwrap_or_else(|| default_subaccount_name.to_string())
        .trim()
        .to_string();

    if subaccount_name.is_empty() {
        return Err(ApiError::BadRequest(
            "subaccount_name cannot be empty".into(),
        ));
    }

    if subaccount_name.len() > 12 {
        return Err(ApiError::BadRequest(format!(
            "subaccount_name is too long ({} > 12)",
            subaccount_name.len()
        )));
    }

    Ok(subaccount_name)
}

fn session_address_from_headers(headers: &HeaderMap) -> Result<H160, ApiError> {
    let value = headers
        .get(SESSION_HEADER)
        .ok_or_else(|| ApiError::Unauthorized("missing session address header".into()))?;

    let value = value
        .to_str()
        .map_err(|_| ApiError::Unauthorized("invalid session address header".into()))?;

    H160::from_str(value)
        .map_err(|_| ApiError::Unauthorized(format!("invalid session address: {value}")))
}

fn hex_address(address: H160) -> String {
    format!("0x{}", hex::encode(address.as_bytes()))
}

fn hex_subaccount(subaccount: [u8; 32]) -> String {
    format!("0x{}", hex::encode(subaccount))
}

fn is_zero_address(address: H160) -> bool {
    address.as_bytes().iter().all(|byte| *byte == 0)
}

trait HasSender {
    fn sender(&self) -> [u8; 32];
}

impl HasSender for WithdrawCollateral {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for MintNlp {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for BurnNlp {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for TransferQuote {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for LinkSigner {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for LiquidateSubaccount {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for Cancellation {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl HasSender for CancellationProducts {
    fn sender(&self) -> [u8; 32] {
        self.sender
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        warn!(error = %err, "internal execution gateway error");
        ApiError::Internal("internal execution gateway error".into())
    }
}
