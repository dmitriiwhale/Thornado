# Build static binary; connect to Postgres via DATABASE_URL (e.g. docker-compose).
# Use current stable Go image so go.mod's `go 1.25` (or similar) is satisfied without toolchain hops.
FROM golang:alpine AS builder
WORKDIR /src
ENV GOTOOLCHAIN=auto

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/gateway .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/gateway .
EXPOSE 3001
ENV PORT=3001
CMD ["./gateway"]
