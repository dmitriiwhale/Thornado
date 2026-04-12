FROM rust:1.89-bookworm AS builder
WORKDIR /src

COPY nado-rust-sdk /src/nado-rust-sdk
COPY thornado/gateway/markets /src/thornado/gateway/markets

WORKDIR /src/thornado/gateway/markets
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /src/thornado/gateway/markets/target/release/markets-gateway /app/markets-gateway

EXPOSE 3005
ENV MARKETS_BIND_ADDR=0.0.0.0:3005

CMD ["/app/markets-gateway"]
