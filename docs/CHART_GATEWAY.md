# Chart Gateway (Rust + Timeseries DB)

Документ описывает Rust chart gateway, который хранит и стримит свечи для терминала.

## Назначение

- Сохранять свечи (`latest_candlestick`) в time-series storage.
- Моментально отдавать snapshot свечей при смене тикера.
- Отдавать live-апдейты свечей через websocket.

## Архитектура

1. `gateway/chart`:
   - `GET /v1/candles` для snapshot.
   - `WS /ws/v1/candles/:symbol` для live updates.
2. Источник данных Nado:
   - history: archive candlesticks API.
   - realtime: subscriptions stream `latest_candlestick`.
3. Хранилище:
   - таблица `chart_candles` в Postgres/TimescaleDB.
   - upsert по ключу `(product_id, granularity, bucket_start)`.

## API

### Health

- `GET /health`

### Symbols

- `GET /symbols`

### Candles snapshot

- `GET /v1/candles?symbol=BTC-PERP&tf=1m&limit=300`
- Альтернатива `tf`: `granularity=<seconds>`.

### Candles websocket

- `WS /ws/v1/candles/BTC-PERP?tf=1m&limit=300`
- Сообщения:
  - `snapshot`
  - `update`
  - `status`
  - `error`
  - `pong`

## Env

- `CHART_BIND_ADDR` (default `0.0.0.0:3004`)
- `CHART_DATABASE_URL` (fallback: `DATABASE_URL`)
- `CHART_NETWORK` (`test|prod|local|local-alt`)
- `CHART_NADO_WS_URL` (optional)
- `CHART_NADO_ARCHIVE_URL` (optional)
- `CHART_DEFAULT_GRANULARITY` (default `60`)
- `CHART_SUPPORTED_GRANULARITIES` (CSV seconds)
- `CHART_HISTORY_LIMIT` (default `500`)
- `CHART_CACHE_CAPACITY` (default `1500`)
- `CHART_PREWARM_ALL` (`true|false`, default `false`)
- `CHART_PREWARM_SYMBOLS` (CSV)
- `CHART_PREWARM_GRANULARITIES` (CSV seconds)

## База данных

При старте сервис:

1. Пытается включить `timescaledb` extension.
2. Создает таблицу `chart_candles` и индекс.
3. Пытается перевести таблицу в hypertable.

Если extension недоступен, сервис продолжит работу на обычной Postgres-таблице.
