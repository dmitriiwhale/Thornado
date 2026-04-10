use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use tracing::warn;

#[derive(Debug, Clone)]
pub struct CandleRow {
    pub product_id: u32,
    pub symbol: String,
    pub granularity: u32,
    pub bucket_start_sec: i64,
    pub open_x18: String,
    pub high_x18: String,
    pub low_x18: String,
    pub close_x18: String,
    pub volume_x18: String,
    pub submission_idx: i64,
    pub source_ts: i64,
}

#[derive(Clone)]
pub struct CandleStore {
    pool: PgPool,
}

impl CandleStore {
    pub async fn connect(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(16)
            .connect(database_url)
            .await?;

        let this = Self { pool };
        this.init_schema().await?;
        Ok(this)
    }

    async fn init_schema(&self) -> Result<()> {
        if let Err(err) = sqlx::query("CREATE EXTENSION IF NOT EXISTS timescaledb")
            .execute(&self.pool)
            .await
        {
            warn!(error = %err, "timescaledb extension is not available; continuing with plain postgres table");
        }

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS chart_candles (
                product_id INT NOT NULL,
                symbol TEXT NOT NULL,
                granularity INT NOT NULL,
                bucket_start TIMESTAMPTZ NOT NULL,
                open_x18 TEXT NOT NULL,
                high_x18 TEXT NOT NULL,
                low_x18 TEXT NOT NULL,
                close_x18 TEXT NOT NULL,
                volume_x18 TEXT NOT NULL,
                submission_idx BIGINT NOT NULL,
                source_ts BIGINT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (product_id, granularity, bucket_start)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS chart_candles_symbol_granularity_ts_idx ON chart_candles (symbol, granularity, bucket_start DESC)",
        )
        .execute(&self.pool)
        .await?;

        if let Err(err) = sqlx::query(
            "SELECT create_hypertable('chart_candles', 'bucket_start', if_not_exists => TRUE)",
        )
        .execute(&self.pool)
        .await
        {
            warn!(error = %err, "failed to create hypertable (likely extension missing); continuing");
        }

        Ok(())
    }

    pub async fn upsert_candle(&self, candle: &CandleRow) -> Result<()> {
        self.upsert_many(std::slice::from_ref(candle)).await
    }

    pub async fn upsert_many(&self, candles: &[CandleRow]) -> Result<()> {
        if candles.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await?;
        for candle in candles {
            sqlx::query(
                r#"
                INSERT INTO chart_candles (
                    product_id,
                    symbol,
                    granularity,
                    bucket_start,
                    open_x18,
                    high_x18,
                    low_x18,
                    close_x18,
                    volume_x18,
                    submission_idx,
                    source_ts
                ) VALUES (
                    $1,
                    $2,
                    $3,
                    to_timestamp($4::double precision),
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11
                )
                ON CONFLICT (product_id, granularity, bucket_start)
                DO UPDATE SET
                    symbol = EXCLUDED.symbol,
                    open_x18 = EXCLUDED.open_x18,
                    high_x18 = EXCLUDED.high_x18,
                    low_x18 = EXCLUDED.low_x18,
                    close_x18 = EXCLUDED.close_x18,
                    volume_x18 = EXCLUDED.volume_x18,
                    submission_idx = EXCLUDED.submission_idx,
                    source_ts = EXCLUDED.source_ts,
                    updated_at = NOW()
                WHERE chart_candles.submission_idx <= EXCLUDED.submission_idx
                "#,
            )
            .bind(candle.product_id as i32)
            .bind(candle.symbol.as_str())
            .bind(candle.granularity as i32)
            .bind(candle.bucket_start_sec)
            .bind(candle.open_x18.as_str())
            .bind(candle.high_x18.as_str())
            .bind(candle.low_x18.as_str())
            .bind(candle.close_x18.as_str())
            .bind(candle.volume_x18.as_str())
            .bind(candle.submission_idx)
            .bind(candle.source_ts)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn load_recent(
        &self,
        symbol: &str,
        product_id: u32,
        granularity: u32,
        limit: usize,
    ) -> Result<Vec<CandleRow>> {
        let rows = sqlx::query(
            r#"
            SELECT
                product_id,
                symbol,
                granularity,
                EXTRACT(EPOCH FROM bucket_start)::BIGINT AS bucket_start_sec,
                open_x18,
                high_x18,
                low_x18,
                close_x18,
                volume_x18,
                submission_idx,
                source_ts
            FROM chart_candles
            WHERE symbol = $1
              AND product_id = $2
              AND granularity = $3
            ORDER BY bucket_start DESC
            LIMIT $4
            "#,
        )
        .bind(symbol)
        .bind(product_id as i32)
        .bind(granularity as i32)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;

        let mut out = rows
            .into_iter()
            .map(|row| CandleRow {
                product_id: row.get::<i32, _>("product_id") as u32,
                symbol: row.get::<String, _>("symbol"),
                granularity: row.get::<i32, _>("granularity") as u32,
                bucket_start_sec: row.get::<i64, _>("bucket_start_sec"),
                open_x18: row.get::<String, _>("open_x18"),
                high_x18: row.get::<String, _>("high_x18"),
                low_x18: row.get::<String, _>("low_x18"),
                close_x18: row.get::<String, _>("close_x18"),
                volume_x18: row.get::<String, _>("volume_x18"),
                submission_idx: row.get::<i64, _>("submission_idx"),
                source_ts: row.get::<i64, _>("source_ts"),
            })
            .collect::<Vec<_>>();

        out.reverse();
        Ok(out)
    }
}
