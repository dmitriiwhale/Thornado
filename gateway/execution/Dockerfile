FROM rust:1.89-bookworm AS builder
WORKDIR /src

COPY nado-rust-sdk /src/nado-rust-sdk
COPY thornado/gateway/execution /src/thornado/gateway/execution

WORKDIR /src/thornado/gateway/execution
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /src/thornado/gateway/execution/target/release/execution-gateway /app/execution-gateway

EXPOSE 3003
ENV EXECUTION_BIND_ADDR=0.0.0.0:3003

CMD ["/app/execution-gateway"]
