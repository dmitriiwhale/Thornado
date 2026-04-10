use std::collections::BTreeMap;

use nado_sdk::engine::PriceLevel;

use crate::protocol::{DepthView, PriceLevelView};

#[derive(Debug, Clone)]
pub struct LevelDelta {
    pub price_x18: i128,
    pub size_x18: i128,
}

#[derive(Debug, Clone)]
pub struct BookDelta {
    pub last_max_timestamp: u64,
    pub min_timestamp: u64,
    pub max_timestamp: u64,
    pub bids: Vec<LevelDelta>,
    pub asks: Vec<LevelDelta>,
}

#[derive(Debug, Clone)]
pub enum ApplyOutcome {
    Applied,
    Stale,
    Gap {
        current_ts: u64,
        event_last_max_ts: u64,
    },
}

#[derive(Debug, Default)]
pub struct OrderBookState {
    bids: BTreeMap<i128, i128>,
    asks: BTreeMap<i128, i128>,
    last_ts: u64,
}

impl OrderBookState {
    pub fn reset_from_snapshot(&mut self, bids: &[PriceLevel], asks: &[PriceLevel], ts: u64) {
        self.bids.clear();
        self.asks.clear();
        Self::load_side(&mut self.bids, bids);
        Self::load_side(&mut self.asks, asks);
        self.last_ts = ts;
    }

    pub fn apply_delta(&mut self, delta: &BookDelta) -> ApplyOutcome {
        if delta.max_timestamp <= self.last_ts {
            return ApplyOutcome::Stale;
        }

        if delta.last_max_timestamp > self.last_ts {
            return ApplyOutcome::Gap {
                current_ts: self.last_ts,
                event_last_max_ts: delta.last_max_timestamp,
            };
        }

        Self::apply_side_delta(&mut self.bids, &delta.bids);
        Self::apply_side_delta(&mut self.asks, &delta.asks);
        self.last_ts = delta.max_timestamp;
        ApplyOutcome::Applied
    }

    pub fn depth_view(&self, depth: usize) -> DepthView {
        let mut asks = Vec::with_capacity(depth);
        let mut total_asks = 0_i128;
        for (&price_x18, &size_x18) in self.asks.iter().take(depth) {
            total_asks += size_x18;
            asks.push(level_view(price_x18, size_x18, total_asks));
        }

        let mut bids = Vec::with_capacity(depth);
        let mut total_bids = 0_i128;
        for (&price_x18, &size_x18) in self.bids.iter().rev().take(depth) {
            total_bids += size_x18;
            bids.push(level_view(price_x18, size_x18, total_bids));
        }

        DepthView { bids, asks }
    }

    pub fn last_ts(&self) -> u64 {
        self.last_ts
    }

    pub fn is_empty(&self) -> bool {
        self.bids.is_empty() && self.asks.is_empty()
    }

    fn load_side(target: &mut BTreeMap<i128, i128>, levels: &[PriceLevel]) {
        for PriceLevel(price_x18, size_x18) in levels {
            if *size_x18 > 0 {
                target.insert(*price_x18, *size_x18);
            }
        }
    }

    fn apply_side_delta(target: &mut BTreeMap<i128, i128>, levels: &[LevelDelta]) {
        for level in levels {
            if level.size_x18 == 0 {
                target.remove(&level.price_x18);
            } else if level.size_x18 > 0 {
                target.insert(level.price_x18, level.size_x18);
            }
        }
    }
}

fn level_view(price_x18: i128, size_x18: i128, total_x18: i128) -> PriceLevelView {
    PriceLevelView {
        price_x18: price_x18.to_string(),
        size_x18: size_x18.to_string(),
        total_x18: total_x18.to_string(),
        price: x18_to_f64(price_x18),
        size: x18_to_f64(size_x18),
        total: x18_to_f64(total_x18),
    }
}

fn x18_to_f64(value_x18: i128) -> f64 {
    const SCALE: f64 = 1_000_000_000_000_000_000.0;
    (value_x18 as f64) / SCALE
}
