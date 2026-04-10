FROM rust:1.89-bookworm AS builder
WORKDIR /src

COPY nado-rust-sdk /src/nado-rust-sdk
COPY thornado/gateway/chart /src/thornado/gateway/chart

WORKDIR /src/thornado/gateway/chart
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /src/thornado/gateway/chart/target/release/chart-gateway /app/chart-gateway

EXPOSE 3004
ENV CHART_BIND_ADDR=0.0.0.0:3004

CMD ["/app/chart-gateway"]
