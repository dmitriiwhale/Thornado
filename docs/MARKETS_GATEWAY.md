# Markets Gateway (Rust)

Документ описывает отдельный Rust gateway, который агрегирует рынки из SDK:

- `get_symbols(None, None)`
- `get_tickers(None, edge)`
- `get_contracts_v2(edge)`

## Назначение

- Отдавать единый snapshot всех рынков с нужными полями для UI selector.
- Отдавать постоянные deltas по websocket (без изменения существующего orderbook feed).
- Разделять источники:
  - symbols: справочник рынков и типов
  - tickers: price/change/volume
  - contracts: funding/mark/index/open interest

## API

### Health

- `GET /health`

### Symbols (compat)

- `GET /symbols`
- Возвращает массив строк рынка (тот же shape, что и `markets` внутри snapshot).

### Snapshot

- `GET /markets/snapshot`

Ответ:

```json
{
  "seq": 42,
  "source_ts": 1712745600000,
  "markets": [
    {
      "symbol": "BTC-PERP_USDC",
      "ticker_id": "BTC-PERP_USDC",
      "product_id": 1,
      "market_type": "perp",
      "base": "BTC",
      "quote": "USDC",
      "price": 72699.0,
      "change_24h": 1.16,
      "volume_24h": 103465543.0,
      "ann_funding": -5.27,
      "funding_rate": -0.000006,
      "mark_price": 72690.2,
      "index_price": 72695.7,
      "open_interest": 12345.6,
      "open_interest_usd": 897654321.0,
      "updated_at": 1712745600000,
      "stale": false
    }
  ]
}
```

### WebSocket

- `WS /ws/v1/markets`
- Сообщения:
  - `snapshot`
  - `delta`
  - `status`
  - `error`
  - `pong`

## Env

- `MARKETS_BIND_ADDR` (default `0.0.0.0:3005`)
- `MARKETS_NETWORK` (`test|prod|local|local-alt`)
- `MARKETS_EDGE` (`true|false`, optional)
- `MARKETS_SYMBOLS_REFRESH_MS` (default `300000`)
- `MARKETS_TICKERS_POLL_MS` (default `1000`)
- `MARKETS_CONTRACTS_POLL_MS` (default `3000`)
- `MARKETS_STALE_AFTER_MS` (default `20000`)
- `MARKETS_FUNDING_INTERVAL_HOURS` (default `1`) — interval used to annualize `funding_rate` into `ann_funding` (%)
