FROM rust:1.89-bookworm AS builder
WORKDIR /src

COPY nado-rust-sdk /src/nado-rust-sdk
COPY thornado/gateway/portfolio /src/thornado/gateway/portfolio

WORKDIR /src/thornado/gateway/portfolio
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /src/thornado/gateway/portfolio/target/release/portfolio /app/portfolio

EXPOSE 3006
ENV PORTFOLIO_BIND_ADDR=0.0.0.0:3006

CMD ["/app/portfolio"]
