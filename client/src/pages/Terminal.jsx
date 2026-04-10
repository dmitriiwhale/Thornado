import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { CrosshairMode, createChart } from 'lightweight-charts';
import {
  Sparkles, Activity, Bolt, BarChart3, AlignLeft, GripHorizontal,
  Send, Star, Newspaper, Clock, LayoutGrid, X, Plus, Eye,
  Flame, ChevronUp, ChevronDown, Lock, Unlock, Bookmark, Save, Trash2,
} from 'lucide-react';
import { useConnection, usePublicClient, useWalletClient } from 'wagmi';
import SolidBlock from '../components/SolidBlock';
import ElectricButton from '../components/ElectricButton';
import { usePortfolioData } from '../hooks/usePortfolioData.js';
import { useNadoLinkedSigner } from '../context/NadoLinkedSignerContext.jsx';
import { useNadoNetwork } from '../context/NadoNetworkContext.jsx';
import { fmt } from '../lib/portfolioAdapters.js';

// в”Ђв”Ђв”Ђ Design tokens в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const C = {
  accent:    'text-indigo-100',
  muted:     'text-slate-400',
  dim:       'text-slate-500',
  greenGlow: { color: '#6ee7b7' },
  redGlow:   { color: '#fca5a5' },
  blueGlow:  { color: '#dbeafe' },
  bg:        'bg-[rgba(8,10,24,0.38)]',
  bgCard:    'bg-[linear-gradient(180deg,rgba(19,21,44,0.86),rgba(9,11,26,0.78))] backdrop-blur-[16px]',
  border:    'border-white/[0.1]',
  bRow:      'border-white/[0.08]',
};

// Blocks drag propagation; use on widget body (below drag-handle)
const nodrag = (e) => e.stopPropagation();
const WIDGET_SHELL_CLASS = 'flex h-full flex-col';

// в”Ђв”Ђв”Ђ Widget Header в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const WH = ({ icon: Icon, title, badge, onClose, extra, locked }) => (
  <div className={`drag-handle flex h-10 shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-3 select-none ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-violet-200" />
      <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
      {badge && (
        <span className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-violet-200/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-100">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
          {badge}
        </span>
      )}
    </div>
    <div className="flex items-center gap-1.5 shrink-0 ml-2">
      {extra}
      {!locked && <GripHorizontal className="h-3.5 w-3.5 text-slate-600" />}
      {onClose && !locked && (
        <button
          onMouseDown={nodrag}
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-700/60 hover:text-violet-200"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

// в”Ђв”Ђв”Ђ Chart + Orderbook live feeds в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const FALLBACK_TICKERS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP', 'DOGE-PERP', 'AVAX-PERP'];
const DEFAULT_ORDERBOOK_SYMBOL = (import.meta.env.VITE_ORDERBOOK_SYMBOL || 'BTC-PERP').trim().toUpperCase();

const CHART_WS_BASE = (import.meta.env.VITE_CHART_WS_BASE || '').trim();
const CHART_WS_PORT = (import.meta.env.VITE_CHART_WS_PORT || '3004').trim();
const CHART_HTTP_BASE = (import.meta.env.VITE_CHART_HTTP_BASE || '').trim();
const ORDERBOOK_WS_BASE = (import.meta.env.VITE_ORDERBOOK_WS_BASE || '').trim();
const ORDERBOOK_WS_PORT = (import.meta.env.VITE_ORDERBOOK_WS_PORT || '3002').trim();
const ORDERBOOK_HTTP_BASE = (import.meta.env.VITE_ORDERBOOK_HTTP_BASE || '').trim();

const CHART_TF_OPTIONS = ['1m', '5m', '15m', '1h', '4h', '1D'];
const CHART_PRICE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHART_VOL_FMT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const CHART_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const CHART_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});
const SIZE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const TOTAL_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const SYMBOLS_CACHE_KEY = 'thornado:available-symbols:v1';

const CHART_STATUS_STYLES = {
  connected: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  connecting: { dot: 'bg-amber-400', text: 'text-amber-300' },
  reconnecting: { dot: 'bg-amber-400', text: 'text-amber-300' },
  loading: { dot: 'bg-amber-400', text: 'text-amber-300' },
  error: { dot: 'bg-rose-400', text: 'text-rose-300' },
  idle: { dot: 'bg-slate-500', text: 'text-slate-400' },
};

const ORDERBOOK_STATUS_STYLES = {
  connected: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  connecting: { dot: 'bg-amber-400', text: 'text-amber-300' },
  reconnecting: { dot: 'bg-amber-400', text: 'text-amber-300' },
  warming_up: { dot: 'bg-amber-400', text: 'text-amber-300' },
  error: { dot: 'bg-rose-400', text: 'text-rose-300' },
  idle: { dot: 'bg-slate-500', text: 'text-slate-400' },
};

const BOOK_PRICE_FMT_CACHE = new Map();
const ORDERBOOK_SPREAD_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ORDERBOOK_DEPTH_VIEWS = ['both', 'asks', 'bids'];

const toFiniteOrNull = (value) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const toFiniteNumber = (value) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeTicker = (value) => String(value || '').trim().toUpperCase();

const symbolToDisplayPair = (symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return '--- / USD';
  const base = normalized.split('-')[0] || normalized;
  return `${base} / USD`;
};

const baseAssetFromSymbol = (symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return 'ASSET';
  return normalized.split('-')[0] || normalized;
};

const chartTfToApiValue = (tf) => {
  const normalized = String(tf || '').trim().toUpperCase();
  if (!normalized) return '1m';
  if (normalized === '1D') return '1d';
  return normalized.toLowerCase();
};

const normalizeChartCandle = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const bucketStart = toFiniteOrNull(raw.bucket_start ?? raw.timestamp ?? 0);
  if (!Number.isFinite(bucketStart) || bucketStart <= 0) return null;

  const open = toFiniteOrNull(raw.open);
  const close = toFiniteOrNull(raw.close);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return null;

  const parsedHigh = toFiniteOrNull(raw.high);
  const parsedLow = toFiniteOrNull(raw.low);
  const parsedVolume = toFiniteOrNull(raw.volume);
  const high = Math.max(parsedHigh ?? open, open, close);
  const low = Math.min(parsedLow ?? close, open, close);

  return {
    bucket_start: Math.trunc(bucketStart),
    open,
    high,
    low,
    close,
    volume: Math.max(0, parsedVolume ?? 0),
  };
};

const mergeChartCandleRecord = (previous, incoming) => {
  const prev = previous && typeof previous === 'object' ? previous : null;
  const next = incoming && typeof incoming === 'object' ? incoming : null;
  if (!next) return prev;

  const bucketStart = Math.trunc(toFiniteOrNull(next.bucket_start ?? prev?.bucket_start) ?? 0);
  if (!Number.isFinite(bucketStart) || bucketStart <= 0) return prev;

  const open = toFiniteOrNull(next.open ?? prev?.open);
  const close = toFiniteOrNull(next.close ?? prev?.close ?? next.open ?? prev?.open);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return prev;

  const high = Math.max(
    toFiniteOrNull(prev?.high) ?? Number.NEGATIVE_INFINITY,
    toFiniteOrNull(next.high) ?? Number.NEGATIVE_INFINITY,
    open,
    close,
  );
  const low = Math.min(
    toFiniteOrNull(prev?.low) ?? Number.POSITIVE_INFINITY,
    toFiniteOrNull(next.low) ?? Number.POSITIVE_INFINITY,
    open,
    close,
  );
  const volume = Math.max(0, toFiniteOrNull(next.volume) ?? toFiniteOrNull(prev?.volume) ?? 0);

  return {
    bucket_start: bucketStart,
    open,
    high,
    low,
    close,
    volume,
  };
};

const mergeChartCandles = (current, incoming, maxSize = 600) => {
  const map = new Map();
  for (const candle of current || []) {
    if (candle && Number.isFinite(candle.bucket_start)) {
      map.set(candle.bucket_start, candle);
    }
  }
  for (const candle of incoming || []) {
    if (candle && Number.isFinite(candle.bucket_start)) {
      const prev = map.get(candle.bucket_start);
      map.set(candle.bucket_start, mergeChartCandleRecord(prev, candle) || candle);
    }
  }
  const merged = Array.from(map.values()).sort((a, b) => a.bucket_start - b.bucket_start);
  return merged.length > maxSize ? merged.slice(merged.length - maxSize) : merged;
};

const buildChartHttpBase = () => {
  if (CHART_HTTP_BASE) {
    return CHART_HTTP_BASE.replace(/\/+$/, '');
  }
  if (CHART_WS_BASE) {
    try {
      const url = new URL(CHART_WS_BASE);
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.origin;
    } catch {
      return null;
    }
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname || '127.0.0.1';
    return `${scheme}://${host}:${CHART_WS_PORT}`;
  }
  return `http://127.0.0.1:${CHART_WS_PORT}`;
};

const buildChartWsUrl = (symbol, tf) => {
  const safeSymbol = encodeURIComponent(symbol);
  const tfValue = encodeURIComponent(chartTfToApiValue(tf));
  const query = `tf=${tfValue}&limit=500`;

  if (CHART_WS_BASE) {
    return `${CHART_WS_BASE.replace(/\/+$/, '')}/ws/v1/candles/${safeSymbol}?${query}`;
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname || '127.0.0.1';
    return `${scheme}://${host}:${CHART_WS_PORT}/ws/v1/candles/${safeSymbol}?${query}`;
  }
  return `ws://127.0.0.1:${CHART_WS_PORT}/ws/v1/candles/${safeSymbol}?${query}`;
};

const useChartCandles = (symbol, tf) => {
  const [chart, setChart] = useState({
    candles: [],
    status: 'idle',
    detail: '',
  });
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    const normalizedSymbol = normalizeTicker(symbol);
    if (!normalizedSymbol) return () => {};

    let disposed = false;
    let ws = null;
    let reconnectAttempt = 0;
    const controller = new AbortController();
    const tfValue = chartTfToApiValue(tf);

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connectWs = () => {
      if (disposed) return;
      ws = new WebSocket(buildChartWsUrl(normalizedSymbol, tfValue));

      ws.onopen = () => {
        if (disposed) return;
        reconnectAttempt = 0;
        setChart((prev) => ({ ...prev, status: 'connected', detail: '' }));
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        let msg;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (msg.type === 'snapshot' && Array.isArray(msg.candles)) {
          const next = msg.candles.map(normalizeChartCandle).filter(Boolean);
          setChart((prev) => ({
            ...prev,
            candles: mergeChartCandles([], next),
            status: 'connected',
            detail: '',
          }));
          return;
        }

        if (msg.type === 'update' && msg.candle) {
          const next = normalizeChartCandle(msg.candle);
          if (!next) return;
          setChart((prev) => ({
            ...prev,
            candles: mergeChartCandles(prev.candles, [next]),
            status: 'connected',
            detail: '',
          }));
          return;
        }

        if (msg.type === 'status') {
          setChart((prev) => ({
            ...prev,
            status: String(msg.status || prev.status),
            detail: String(msg.detail || ''),
          }));
          return;
        }

        if (msg.type === 'error') {
          setChart((prev) => ({
            ...prev,
            status: 'error',
            detail: String(msg.message || 'chart gateway error'),
          }));
        }
      };

      ws.onerror = () => {
        if (disposed) return;
        setChart((prev) => ({
          ...prev,
          status: 'error',
          detail: prev.detail || 'chart websocket error',
        }));
      };

      ws.onclose = () => {
        if (disposed) return;
        reconnectAttempt += 1;
        const backoffMs = Math.min(1000 * (2 ** (reconnectAttempt - 1)), 8000);
        setChart((prev) => ({
          ...prev,
          status: 'reconnecting',
          detail: `reconnect in ${Math.max(1, Math.round(backoffMs / 1000))}s`,
        }));
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(connectWs, backoffMs);
      };
    };

    const loadSnapshot = async () => {
      const base = buildChartHttpBase();
      if (!base) return;

      setChart({
        candles: [],
        status: 'loading',
        detail: '',
      });

      try {
        const url = `${base}/v1/candles?symbol=${encodeURIComponent(normalizedSymbol)}&tf=${encodeURIComponent(tfValue)}&limit=500`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload || !Array.isArray(payload.candles)) return;
        const next = payload.candles.map(normalizeChartCandle).filter(Boolean);
        setChart((prev) => ({
          ...prev,
          candles: mergeChartCandles([], next),
          status: prev.status === 'connected' ? 'connected' : 'loading',
          detail: '',
        }));
      } catch {
        // websocket stream stays source of truth
      }
    };

    loadSnapshot();
    connectWs();

    return () => {
      disposed = true;
      controller.abort();
      clearReconnectTimer();
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [symbol, tf]);

  return chart;
};

const getBookPriceFormatter = (digits) => {
  const safeDigits = Math.min(8, Math.max(2, Math.trunc(digits)));
  const cacheKey = String(safeDigits);
  const cached = BOOK_PRICE_FMT_CACHE.get(cacheKey);
  if (cached) return cached;
  const next = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits,
  });
  BOOK_PRICE_FMT_CACHE.set(cacheKey, next);
  return next;
};

const inferBookPriceDigits = (value) => {
  const abs = Math.abs(toFiniteNumber(value));
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.1) return 5;
  if (abs >= 0.01) return 6;
  if (abs >= 0.001) return 7;
  return 8;
};

const formatBookPrice = (value) => getBookPriceFormatter(inferBookPriceDigits(value)).format(toFiniteNumber(value));
const MAX_ORDERBOOK_TRADES = 80;
const ORDERBOOK_STEP_MULTIPLIERS = [1, 2, 5, 10, 50, 100, 250];

const normalizeBookSide = (levels = []) =>
  levels.map((level, idx) => {
    const price = toFiniteNumber(level?.price);
    const size = toFiniteNumber(level?.size);
    const total = toFiniteNumber(level?.total);
    return {
      id: `${price}-${size}-${idx}`,
      price,
      size,
      total,
      priceText: formatBookPrice(price),
      sizeText: SIZE_FMT.format(size),
      totalText: TOTAL_FMT.format(total),
    };
  });

const aggregateBookSide = (levels = [], side = 'ask', step = 1) => {
  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 1;
  const buckets = new Map();

  for (const level of levels) {
    const price = toFiniteNumber(level?.price);
    const size = toFiniteNumber(level?.size);
    if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) continue;

    const bucketRaw = side === 'ask'
      ? Math.ceil(price / normalizedStep) * normalizedStep
      : Math.floor(price / normalizedStep) * normalizedStep;
    const bucketPrice = Number(bucketRaw.toFixed(8));
    if (!Number.isFinite(bucketPrice) || bucketPrice <= 0) continue;
    buckets.set(bucketPrice, (buckets.get(bucketPrice) || 0) + size);
  }

  const rows = Array.from(buckets.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => a.price - b.price);

  if (side === 'bid') {
    rows.reverse();
  }

  let cumulative = 0;
  return rows.map((row, idx) => {
    cumulative += row.size;
    return {
      id: `${side}-${row.price}-${idx}`,
      price: row.price,
      size: row.size,
      total: cumulative,
      priceText: formatBookPrice(row.price),
      sizeText: SIZE_FMT.format(row.size),
      totalText: TOTAL_FMT.format(cumulative),
    };
  });
};

const roundOrderbookStep = (value) => {
  const numeric = toFiniteOrNull(value);
  if (numeric == null || numeric <= 0) return null;
  return Number(numeric.toFixed(8));
};

const estimateBookTickSize = (asks = [], bids = []) => {
  const prices = [...asks, ...bids]
    .map((row) => toFiniteOrNull(row?.price))
    .filter((price) => price != null && price > 0);
  if (prices.length < 2) return null;

  const uniqueSorted = Array.from(new Set(prices.map((price) => roundOrderbookStep(price))))
    .filter((price) => price != null)
    .sort((a, b) => a - b);
  if (uniqueSorted.length < 2) return null;

  let minDiff = Number.POSITIVE_INFINITY;
  for (let idx = 1; idx < uniqueSorted.length; idx += 1) {
    const diff = uniqueSorted[idx] - uniqueSorted[idx - 1];
    if (Number.isFinite(diff) && diff > 1e-12 && diff < minDiff) {
      minDiff = diff;
    }
  }

  return Number.isFinite(minDiff) ? roundOrderbookStep(minDiff) : null;
};

const fallbackBookTickSize = (referencePrice) => {
  const price = Math.abs(toFiniteNumber(referencePrice));
  if (price >= 10_000) return 0.5;
  if (price >= 1_000) return 0.1;
  if (price >= 100) return 0.01;
  if (price >= 1) return 0.001;
  if (price >= 0.1) return 0.0001;
  if (price >= 0.01) return 0.00001;
  return 0.000001;
};

const ceilNiceStep = (value) => {
  const numeric = toFiniteOrNull(value);
  if (numeric == null || numeric <= 0) return null;
  const exponent = Math.floor(Math.log10(numeric));
  const scale = 10 ** exponent;
  const mantissa = numeric / scale;

  let roundedMantissa = 10;
  if (mantissa <= 1) roundedMantissa = 1;
  else if (mantissa <= 2) roundedMantissa = 2;
  else if (mantissa <= 5) roundedMantissa = 5;

  return roundOrderbookStep(roundedMantissa * scale);
};

const buildOrderbookStepOptions = (asks = [], bids = [], referencePrice = null) => {
  const tick = estimateBookTickSize(asks, bids) ?? fallbackBookTickSize(referencePrice);
  const normalizedPrice = Math.abs(toFiniteNumber(referencePrice));
  const targetByPrice = normalizedPrice > 0 ? normalizedPrice * 0.00001 : tick;
  const anchor = ceilNiceStep(Math.max(tick, targetByPrice)) ?? roundOrderbookStep(tick) ?? 1;

  const options = ORDERBOOK_STEP_MULTIPLIERS
    .map((multiplier) => roundOrderbookStep(anchor * multiplier))
    .filter((value) => value != null && value > 0);

  const unique = Array.from(new Set(options)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : [1];
};

const normalizeTimestampMs = (value) => {
  const ts = toFiniteNumber(value);
  if (!Number.isFinite(ts) || ts <= 0) return Date.now();
  if (ts >= 1_000_000_000_000) return Math.trunc(ts);
  if (ts >= 1_000_000_000) return Math.trunc(ts * 1000);
  return Date.now();
};

const formatOrderbookTradeTime = (value) => {
  const tsMs = normalizeTimestampMs(value);
  const date = new Date(tsMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const normalizeOrderbookTradeSide = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw.includes('buy') || raw === 'bid' || raw === 'b' || raw === 'long') return 'buy';
  if (raw.includes('sell') || raw === 'ask' || raw === 's' || raw === 'short') return 'sell';
  return 'unknown';
};

const normalizeOrderbookTrade = (trade, fallbackSourceTs, fallbackSeq) => {
  const price = toFiniteOrNull(trade?.price);
  const size = toFiniteOrNull(trade?.size);
  if (price == null || size == null || price <= 0 || size <= 0) return null;

  const sourceTs = normalizeTimestampMs(trade?.source_ts ?? trade?.timestamp ?? fallbackSourceTs);
  const side = normalizeOrderbookTradeSide(trade?.side ?? trade?.trade_type);
  const quoteSize = toFiniteOrNull(trade?.quote_size);
  const notional = quoteSize ?? (price * size);
  const fallbackId = `${sourceTs}-${price}-${size}-${fallbackSeq ?? 0}`;
  const id = trade?.trade_id ?? trade?.id ?? fallbackId;

  return {
    id: String(id),
    side,
    sourceTs,
    timeText: formatOrderbookTradeTime(sourceTs),
    price,
    priceText: formatBookPrice(price),
    size,
    sizeText: SIZE_FMT.format(size),
    quoteSize,
    notionalText: TOTAL_FMT.format(Math.max(0, notional)),
  };
};

const calcMarkPrice = (asks, bids) => {
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  if (bestAsk != null && bestBid != null) return (bestAsk + bestBid) / 2;
  if (bestAsk != null) return bestAsk;
  if (bestBid != null) return bestBid;
  return null;
};

const buildOrderbookWsUrl = (symbol) => {
  const safeSymbol = encodeURIComponent(symbol);
  if (ORDERBOOK_WS_BASE) {
    return `${ORDERBOOK_WS_BASE.replace(/\/+$/, '')}/ws/v1/orderbook/${safeSymbol}`;
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname || '127.0.0.1';
    return `${scheme}://${host}:${ORDERBOOK_WS_PORT}/ws/v1/orderbook/${safeSymbol}`;
  }
  return `ws://127.0.0.1:${ORDERBOOK_WS_PORT}/ws/v1/orderbook/${safeSymbol}`;
};

const buildOrderbookHttpBase = () => {
  if (ORDERBOOK_HTTP_BASE) {
    return ORDERBOOK_HTTP_BASE.replace(/\/+$/, '');
  }
  if (ORDERBOOK_WS_BASE) {
    try {
      const url = new URL(ORDERBOOK_WS_BASE);
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.origin;
    } catch {
      return null;
    }
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname || '127.0.0.1';
    return `${scheme}://${host}:${ORDERBOOK_WS_PORT}`;
  }
  return `http://127.0.0.1:${ORDERBOOK_WS_PORT}`;
};

const extractSymbolsFromPayload = (payload) => {
  if (!Array.isArray(payload)) return [];
  const out = [];
  for (const item of payload) {
    if (typeof item === 'string') {
      out.push(item);
      continue;
    }
    if (item && typeof item === 'object' && typeof item.symbol === 'string') {
      out.push(item.symbol);
    }
  }
  return out;
};

const normalizeTickerList = (list, activeSymbol) => {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const symbol = normalizeTicker(value);
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    out.push(symbol);
  };
  add(activeSymbol);
  FALLBACK_TICKERS.forEach(add);
  (list || []).forEach(add);
  return out;
};

const readCachedSymbols = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SYMBOLS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedSymbols = (symbols) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYMBOLS_CACHE_KEY, JSON.stringify(symbols));
  } catch {
    // ignore storage errors
  }
};

const useAvailableTickers = (activeSymbol) => {
  const [symbols, setSymbols] = useState(() => normalizeTickerList(readCachedSymbols(), activeSymbol));

  useEffect(() => {
    const controller = new AbortController();
    const bases = Array.from(new Set([buildOrderbookHttpBase(), buildChartHttpBase()].filter(Boolean)));
    if (bases.length === 0) return () => controller.abort();

    const load = async () => {
      const tasks = bases.map(async (base) => {
        const response = await fetch(`${base}/symbols`, { signal: controller.signal });
        if (!response.ok) return [];
        const payload = await response.json();
        return extractSymbolsFromPayload(payload);
      });
      const settled = await Promise.allSettled(tasks);
      const loadedSymbols = [];
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          loadedSymbols.push(...item.value);
        }
      }
      if (loadedSymbols.length > 0) {
        setSymbols((prev) => {
          const next = normalizeTickerList([...prev, ...loadedSymbols], activeSymbol);
          writeCachedSymbols(next);
          return next;
        });
      }
    };

    load().catch(() => {
      // fallback symbols stay visible
    });
    return () => controller.abort();
  }, [activeSymbol]);

  return useMemo(() => normalizeTickerList(symbols, activeSymbol), [symbols, activeSymbol]);
};

const useOrderbookStream = (symbol) => {
  const [book, setBook] = useState({
    asks: [],
    bids: [],
    recentTrades: [],
    status: 'idle',
    detail: '',
    seq: null,
    markPrice: null,
  });
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let ws = null;
    let reconnectAttempt = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) return;
      const wsUrl = buildOrderbookWsUrl(symbol);
      setBook({
        asks: [],
        bids: [],
        recentTrades: [],
        status: 'connecting',
        detail: '',
        seq: null,
        markPrice: null,
      });

      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (disposed) return;
        reconnectAttempt = 0;
        setBook((prev) => ({ ...prev, status: 'connected', detail: '' }));
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        let msg;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (msg.type === 'snapshot' || msg.type === 'update') {
          const asks = normalizeBookSide(msg.depth?.asks || []);
          const bids = normalizeBookSide(msg.depth?.bids || []);
          setBook((prev) => ({
            ...prev,
            asks,
            bids,
            status: 'connected',
            detail: '',
            seq: typeof msg.seq === 'number' ? msg.seq : prev.seq,
            markPrice: calcMarkPrice(asks, bids),
          }));
          return;
        }

        if (msg.type === 'trade') {
          const nextTrade = normalizeOrderbookTrade(msg.trade, msg.source_ts, msg.seq);
          if (!nextTrade) return;

          setBook((prev) => {
            const deduped = prev.recentTrades.filter((row) => row.id !== nextTrade.id);
            return {
              ...prev,
              status: 'connected',
              detail: '',
              seq: typeof msg.seq === 'number' ? msg.seq : prev.seq,
              recentTrades: [nextTrade, ...deduped].slice(0, MAX_ORDERBOOK_TRADES),
            };
          });
          return;
        }

        if (msg.type === 'status') {
          setBook((prev) => ({
            ...prev,
            status: msg.status || prev.status,
            detail: msg.detail || '',
          }));
          return;
        }

        if (msg.type === 'error') {
          setBook((prev) => ({
            ...prev,
            status: 'error',
            detail: msg.message || 'gateway error',
          }));
        }
      };

      ws.onerror = () => {
        if (disposed) return;
        setBook((prev) => ({
          ...prev,
          status: 'error',
          detail: prev.detail || 'websocket error',
        }));
      };

      ws.onclose = () => {
        if (disposed) return;
        reconnectAttempt += 1;
        const backoffMs = Math.min(1000 * (2 ** (reconnectAttempt - 1)), 8000);
        setBook((prev) => ({
          ...prev,
          status: 'reconnecting',
          detail: `reconnect in ${Math.max(1, Math.round(backoffMs / 1000))}s`,
        }));
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(connect, backoffMs);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearReconnectTimer();
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [symbol]);

  return book;
};

const toChartUnixTime = (bucketStart) => {
  const numeric = Math.trunc(toFiniteNumber(bucketStart));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric > 10_000_000_000 ? Math.trunc(numeric / 1000) : numeric;
};

const mapCandlesToTvData = (candles) =>
  (candles || [])
    .map((candle) => {
      const time = toChartUnixTime(candle.bucket_start);
      if (!time) return null;
      const open = toFiniteNumber(candle.open);
      const high = Math.max(toFiniteNumber(candle.high), open, toFiniteNumber(candle.close));
      const low = Math.min(toFiniteNumber(candle.low), open, toFiniteNumber(candle.close));
      const close = toFiniteNumber(candle.close);
      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return null;
      return { time, open, high, low, close };
    })
    .filter(Boolean);

const mapVolumeToTvData = (candles) =>
  (candles || [])
    .map((candle) => {
      const time = toChartUnixTime(candle.bucket_start);
      if (!time) return null;
      const open = toFiniteNumber(candle.open);
      const close = toFiniteNumber(candle.close);
      const volume = Math.max(0, toFiniteNumber(candle.volume));
      return {
        time,
        value: volume,
        color: close >= open ? 'rgba(52,245,163,0.45)' : 'rgba(255,100,135,0.45)',
      };
    })
    .filter(Boolean);

const formatChartPointTime = (unixSeconds) => {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return '--';
  return CHART_TIME_FMT.format(new Date(Math.trunc(unixSeconds) * 1000));
};

const ChartWidget = ({ onClose, locked, symbol }) => {
  const [tf, setTf] = useState('1h');
  const { candles, status, detail } = useChartCandles(symbol, tf);
  const statusStyle = CHART_STATUS_STYLES[status] || CHART_STATUS_STYLES.idle;
  const [chartError, setChartError] = useState('');
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const clickUnsubRef = useRef(null);
  const fitKeyRef = useRef('');
  const [selectedBar, setSelectedBar] = useState(null);
  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const tfMenuRef = useRef(null);

  const statsCandles = useMemo(() => candles.slice(-500), [candles]);
  const plotCandles = useMemo(() => statsCandles.slice(-400), [statsCandles]);
  const tvCandles = useMemo(() => mapCandlesToTvData(plotCandles), [plotCandles]);
  const tvVolume = useMemo(() => mapVolumeToTvData(plotCandles), [plotCandles]);
  const volumeByTime = useMemo(() => {
    const out = new Map();
    for (const row of tvVolume) {
      if (row && Number.isFinite(row.time)) {
        out.set(Math.trunc(row.time), toFiniteNumber(row.value));
      }
    }
    return out;
  }, [tvVolume]);

  const focusBar = selectedBar && Number.isFinite(selectedBar.open) ? selectedBar : null;
  const focusTime = Number.isFinite(focusBar?.time) ? Math.trunc(focusBar.time) : null;
  const focusVolume = focusTime == null ? null : volumeByTime.get(focusTime) ?? null;
  const focusTimeLabel = formatChartPointTime(focusTime);
  const chartInfoRows = useMemo(
    () => [
      ['Time', focusTimeLabel],
      ['Open', focusBar?.open],
      ['High', focusBar?.high],
      ['Low', focusBar?.low],
      ['Close', focusBar?.close],
      ['Vol', focusVolume],
    ],
    [focusTimeLabel, focusBar, focusVolume],
  );

  const firstPrice = tvCandles.length > 0 ? toFiniteNumber(tvCandles[0].open || tvCandles[0].close) : null;
  const lastPrice = tvCandles.length > 0 ? toFiniteNumber(tvCandles[tvCandles.length - 1].close) : null;
  const changePct = useMemo(() => {
    if (firstPrice == null || firstPrice === 0 || lastPrice == null) return null;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [firstPrice, lastPrice]);
  const changeText = changePct == null ? '--' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
  const changeStyle = changePct == null ? C.blueGlow : changePct >= 0 ? C.greenGlow : C.redGlow;

  useEffect(() => {
    setSelectedBar(null);
  }, [symbol, tf]);

  useEffect(() => {
    setTfMenuOpen(false);
  }, [symbol, tf]);

  useEffect(() => {
    if (!tfMenuOpen) return () => {};

    const onPointerDown = (event) => {
      if (!tfMenuRef.current) return;
      if (!tfMenuRef.current.contains(event.target)) {
        setTfMenuOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setTfMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [tfMenuOpen]);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return () => {};
    setChartError('');

    let chart = null;
    let ro = null;
    let onClick = null;

    try {
      chart = createChart(host, {
        width: Math.max(220, host.clientWidth || 220),
        height: Math.max(160, host.clientHeight || 160),
        layout: {
          background: { type: 'solid', color: 'rgba(0,0,0,0)' },
          textColor: 'rgba(148,163,184,0.92)',
          fontFamily: CHART_FONT_FAMILY,
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(196,181,253,0.05)' },
          horzLines: { color: 'rgba(196,181,253,0.07)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(196,181,253,0.16)',
          scaleMargins: { top: 0.08, bottom: 0.26 },
        },
        timeScale: {
          borderColor: 'rgba(196,181,253,0.16)',
          rightOffset: 2,
          barSpacing: 7,
          minBarSpacing: 4,
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: 'rgba(196,181,253,0.30)',
            width: 1,
            style: 2,
            labelBackgroundColor: 'rgba(30,41,59,0.95)',
          },
          horzLine: {
            color: 'rgba(196,181,253,0.30)',
            width: 1,
            style: 2,
            labelBackgroundColor: 'rgba(30,41,59,0.95)',
          },
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: 'rgba(52,245,163,0.9)',
        downColor: 'rgba(255,100,135,0.92)',
        borderUpColor: 'rgba(52,245,163,1)',
        borderDownColor: 'rgba(255,100,135,1)',
        wickUpColor: 'rgba(52,245,163,1)',
        wickDownColor: 'rgba(255,100,135,1)',
        priceLineColor: 'rgba(196,181,253,0.9)',
        priceLineVisible: true,
        lastValueVisible: true,
        title: symbol,
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
        base: 0,
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

      const extractBarPoint = (param) => {
        if (!param || !param.seriesData || !candleSeriesRef.current) return null;
        const point = param.seriesData.get(candleSeriesRef.current);
        if (!point || typeof point.open !== 'number') return null;
        const time = typeof param.time === 'number' ? Math.trunc(param.time) : null;
        return {
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          time,
        };
      };

      onClick = (param) => {
        const next = extractBarPoint(param);
        if (!next) {
          setSelectedBar(null);
          return;
        }
        setSelectedBar(next);
      };
      chart.subscribeClick(onClick);

      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = Math.max(220, Math.floor(entry.contentRect.width));
        const height = Math.max(160, Math.floor(entry.contentRect.height));
        chart.applyOptions({ width, height });
      });
      ro.observe(host);

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      resizeObserverRef.current = ro;
      clickUnsubRef.current = () => chart.unsubscribeClick(onClick);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'chart init failed';
      setChartError(message);
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      resizeObserverRef.current = null;
      clickUnsubRef.current = null;
    }

    return () => {
      if (clickUnsubRef.current) {
        clickUnsubRef.current();
      }
      clickUnsubRef.current = null;
      if (ro) ro.disconnect();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      if (chart) chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    candleSeriesRef.current.setData(tvCandles);
    volumeSeriesRef.current.setData(tvVolume);

    const fitKey = `${normalizeTicker(symbol)}:${tf}`;
    if (fitKeyRef.current !== fitKey && tvCandles.length > 1 && chartRef.current) {
      chartRef.current.timeScale().fitContent();
      fitKeyRef.current = fitKey;
    }
  }, [symbol, tf, tvCandles, tvVolume]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({ title: symbol });
  }, [symbol]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || typeof series.setMarkers !== 'function') return;

    if (!selectedBar || !Number.isFinite(selectedBar.time)) {
      series.setMarkers([]);
      return;
    }

    const selectedTime = Math.trunc(selectedBar.time);
    const selected = tvCandles.find((bar) => Math.trunc(bar.time) === selectedTime);
    if (!selected) {
      series.setMarkers([]);
      return;
    }

    const bullish = selected.close >= selected.open;
    series.setMarkers([
      {
        time: selected.time,
        position: bullish ? 'aboveBar' : 'belowBar',
        color: bullish ? '#34f5a3' : '#ff6487',
        shape: 'circle',
        text: '',
      },
    ]);
  }, [selectedBar, tvCandles]);

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={BarChart3}
        title={symbolToDisplayPair(symbol)}
        onClose={onClose}
        locked={locked}
        extra={(
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-mono text-xs font-bold" style={changeStyle}>{changeText}</span>
            <span className={`flex items-center gap-1 font-mono text-[10px] ${statusStyle.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
              {status}
            </span>
          </div>
        )}
      />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bg} px-3 py-1`}>
          <div ref={tfMenuRef} className="relative">
            <button
              type="button"
              onMouseDown={nodrag}
              onClick={() => setTfMenuOpen((prev) => !prev)}
              className="flex min-w-[74px] items-center justify-between gap-2 rounded-md border border-violet-200/20 bg-[rgba(20,22,45,0.74)] px-3 py-1 font-mono text-[12px] text-violet-100 shadow-[0_0_12px_rgba(76,70,160,0.22)] transition-colors hover:border-violet-200/35 hover:bg-[rgba(28,31,64,0.88)]"
              aria-haspopup="listbox"
              aria-expanded={tfMenuOpen}
              aria-label="Select chart timeframe"
            >
              <span>{tf}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-violet-200/80 transition-transform ${
                  tfMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {tfMenuOpen && (
              <div
                onMouseDown={nodrag}
                role="listbox"
                aria-label="Chart timeframe"
                className={`absolute left-0 top-full z-30 mt-1 w-28 overflow-hidden rounded-md border ${C.bRow} bg-[rgba(10,12,30,0.96)] shadow-[0_10px_28px_rgba(0,0,0,0.45)]`}
              >
                {CHART_TF_OPTIONS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="option"
                    aria-selected={entry === tf}
                    onClick={() => {
                      setTf(entry);
                      setTfMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 font-mono text-[12px] transition-colors ${
                      entry === tf
                        ? 'bg-violet-400/18 text-violet-100'
                        : 'text-slate-300 hover:bg-violet-400/10 hover:text-violet-100'
                    }`}
                  >
                    <span>{entry}</span>
                    {entry === tf && <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            {symbol}
          </div>
        </div>
        {(detail && status !== 'connected') && (
          <div className={`shrink-0 border-b ${C.bRow} ${C.bg} px-3 py-1 text-[10px] text-slate-500`}>
            {detail}
          </div>
        )}
        {chartError && (
          <div className={`shrink-0 border-b ${C.bRow} ${C.bg} px-3 py-1 text-[10px] text-rose-300`}>
            {chartError}
          </div>
        )}
        <div className={`relative flex-1 ${C.bg}`} style={{ overflow: 'hidden' }}>
          <div ref={chartHostRef} className="absolute inset-0" />
          {selectedBar && (
            <div className="pointer-events-none absolute left-2 top-2 z-20 overflow-hidden rounded-md border border-violet-200/20 bg-[rgba(9,11,26,0.86)] shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
              <table className="text-[10px] font-mono">
                <tbody>
                  {chartInfoRows.map(([label, value]) => (
                    <tr key={label} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="px-2 py-1 text-slate-500">{label}</td>
                      <td className="px-2 py-1 text-right text-slate-200">
                        {label === 'Time'
                          ? value
                          : value == null || !Number.isFinite(value)
                            ? '--'
                            : label === 'Vol'
                              ? CHART_VOL_FMT.format(value)
                              : CHART_PRICE_FMT.format(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tvCandles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[11px] text-slate-500">Waiting for candles...</span>
            </div>
          )}
          <div className="absolute bottom-2.5 right-2.5 rounded border border-violet-200/18 bg-[rgba(11,12,28,0.86)] px-2 py-0.5 font-mono text-[12px] font-bold" style={C.blueGlow}>
            {lastPrice == null ? '--' : CHART_PRICE_FMT.format(lastPrice)}
          </div>
        </div>
      </div>
    </div>
  );
};

const BookRow = ({ r, side, maxTotal }) => (
  <div className="group relative flex items-center px-3 py-[3px] hover:bg-slate-800/30">
    <div
      className={`absolute left-0 top-0 h-full ${side === 'ask' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}
      style={{ width: `${maxTotal > 0 ? Math.min(100, (r.total / maxTotal) * 100) : 0}%` }}
    />
    <div className="relative z-10 w-[44%] font-mono text-[12px]" style={side === 'ask' ? C.redGlow : C.greenGlow}>{r.priceText}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[12px] text-slate-300">{r.sizeText}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[12px] text-slate-500">{r.totalText}</div>
  </div>
);

const OrderbookDepthGlyph = ({ mode }) => {
  const showAsk = mode === 'both' || mode === 'asks';
  const showBid = mode === 'both' || mode === 'bids';

  return (
    <div className="flex h-3 items-end gap-[2px]">
      <span className={`w-[3px] rounded-sm ${showAsk ? 'h-[10px] bg-rose-300/90' : 'h-[10px] bg-slate-700/90'}`} />
      <span className={`w-[3px] rounded-sm ${showAsk ? 'h-[7px] bg-rose-300/65' : 'h-[7px] bg-slate-700/90'}`} />
      <span className={`w-[3px] rounded-sm ${showBid ? 'h-[7px] bg-emerald-300/65' : 'h-[7px] bg-slate-700/90'}`} />
      <span className={`w-[3px] rounded-sm ${showBid ? 'h-[10px] bg-emerald-300/90' : 'h-[10px] bg-slate-700/90'}`} />
    </div>
  );
};

const OrderbookTradeRow = ({ trade }) => {
  const sideStyle =
    trade.side === 'buy'
      ? C.greenGlow
      : trade.side === 'sell'
        ? C.redGlow
        : C.blueGlow;

  return (
    <div className="grid grid-cols-[36%_32%_32%] items-center px-3 py-[3px] hover:bg-slate-800/30">
      <div className="font-mono text-[11px] text-slate-400">{trade.timeText}</div>
      <div className="text-right font-mono text-[12px]" style={sideStyle}>{trade.priceText}</div>
      <div className="text-right font-mono text-[12px] text-slate-300">{trade.sizeText}</div>
    </div>
  );
};

const formatOrderbookStep = (value) => {
  const step = toFiniteOrNull(value);
  if (step == null || step <= 0) return '1';
  if (step >= 1) {
    return Number.isInteger(step)
      ? String(step)
      : step.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
  return step.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
};

const OrderBookWidget = ({ onClose, locked, symbol }) => {
  const { asks, bids, recentTrades, status, detail, seq, markPrice } = useOrderbookStream(symbol);
  const [activeTab, setActiveTab] = useState('book');
  const [depthView, setDepthView] = useState('both');
  const [priceStep, setPriceStep] = useState(1);
  const [priceStepMenuOpen, setPriceStepMenuOpen] = useState(false);
  const priceStepMenuRef = useRef(null);
  const prevMarkRef = useRef(null);
  const [markTrend, setMarkTrend] = useState('flat');
  const statusStyle = ORDERBOOK_STATUS_STYLES[status] || ORDERBOOK_STATUS_STYLES.idle;
  const baseAsset = baseAssetFromSymbol(symbol);

  const asksAggregated = useMemo(() => aggregateBookSide(asks, 'ask', priceStep), [asks, priceStep]);
  const bidsAggregated = useMemo(() => aggregateBookSide(bids, 'bid', priceStep), [bids, priceStep]);
  const askRows = useMemo(() => [...asksAggregated].reverse(), [asksAggregated]);
  const visibleAskRows = depthView === 'bids' ? [] : askRows;
  const visibleBidRows = depthView === 'asks' ? [] : bidsAggregated;
  const maxAskTotal = useMemo(
    () => visibleAskRows.reduce((acc, row) => Math.max(acc, row.total), 0),
    [visibleAskRows],
  );
  const maxBidTotal = useMemo(
    () => visibleBidRows.reduce((acc, row) => Math.max(acc, row.total), 0),
    [visibleBidRows],
  );
  const tradesRows = useMemo(
    () => (Array.isArray(recentTrades) ? recentTrades.slice(0, MAX_ORDERBOOK_TRADES) : []),
    [recentTrades],
  );

  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  const spreadPct = useMemo(() => {
    if (bestAsk == null || bestBid == null || bestAsk <= 0) return null;
    return ((bestAsk - bestBid) / bestAsk) * 100;
  }, [bestAsk, bestBid]);

  const centerPrice = useMemo(() => {
    if (markPrice != null && Number.isFinite(markPrice)) return markPrice;
    return calcMarkPrice(asks, bids);
  }, [asks, bids, markPrice]);
  const priceStepOptions = useMemo(
    () => buildOrderbookStepOptions(asks, bids, centerPrice),
    [asks, bids, centerPrice],
  );
  const totalLabel = baseAsset ? `Total ${baseAsset}` : 'Total';
  const markText = centerPrice == null ? '--' : formatBookPrice(centerPrice);
  const spreadText = spreadPct == null ? '--' : `${ORDERBOOK_SPREAD_FMT.format(spreadPct)}%`;
  const markStyle = markTrend === 'up' ? C.greenGlow : markTrend === 'down' ? C.redGlow : C.blueGlow;
  const markIcon = markTrend === 'up'
    ? <ChevronUp className="h-3.5 w-3.5 text-emerald-300" />
    : markTrend === 'down'
      ? <ChevronDown className="h-3.5 w-3.5 text-rose-300" />
      : null;

  useEffect(() => {
    setActiveTab('book');
    setDepthView('both');
    setPriceStepMenuOpen(false);
    setMarkTrend('flat');
    prevMarkRef.current = null;
  }, [symbol]);

  useEffect(() => {
    if (!Array.isArray(priceStepOptions) || priceStepOptions.length === 0) return;
    setPriceStep((prev) => {
      const current = toFiniteOrNull(prev);
      if (current == null || current <= 0) return priceStepOptions[0];

      const same = priceStepOptions.find(
        (candidate) => Math.abs(candidate - current) <= Math.max(1e-10, candidate * 1e-8),
      );
      if (same != null) return same;

      let nearest = priceStepOptions[0];
      let bestDistance = Math.abs(priceStepOptions[0] - current);
      for (let idx = 1; idx < priceStepOptions.length; idx += 1) {
        const candidate = priceStepOptions[idx];
        const distance = Math.abs(candidate - current);
        if (distance < bestDistance) {
          nearest = candidate;
          bestDistance = distance;
        }
      }
      return nearest;
    });
  }, [priceStepOptions]);

  useEffect(() => {
    if (activeTab !== 'book') {
      setPriceStepMenuOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (markPrice == null || !Number.isFinite(markPrice)) return;
    if (prevMarkRef.current != null && Number.isFinite(prevMarkRef.current)) {
      const delta = markPrice - prevMarkRef.current;
      if (delta > 1e-9) {
        setMarkTrend('up');
      } else if (delta < -1e-9) {
        setMarkTrend('down');
      } else {
        setMarkTrend('flat');
      }
    }
    prevMarkRef.current = markPrice;
  }, [markPrice]);

  useEffect(() => {
    if (!priceStepMenuOpen) return () => {};

    const onPointerDown = (event) => {
      if (!priceStepMenuRef.current) return;
      if (!priceStepMenuRef.current.contains(event.target)) {
        setPriceStepMenuOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPriceStepMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [priceStepMenuOpen]);

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={AlignLeft}
        title="Order Book"
        onClose={onClose}
        locked={locked}
        extra={(
          <div className="hidden items-center gap-2 md:flex">
            <span className={`flex items-center gap-1 font-mono text-[10px] ${statusStyle.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
              {status}
            </span>
          </div>
        )}
      />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bg} px-3 py-1.5`}>
          <div className="inline-flex items-center rounded-md border border-violet-200/14 bg-[rgba(18,20,40,0.92)] p-0.5">
            <button
              type="button"
              onMouseDown={nodrag}
              onClick={() => setActiveTab('book')}
              className={`min-w-[72px] rounded-[5px] px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === 'book'
                  ? 'bg-white/[0.08] text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Book
            </button>
            <button
              type="button"
              onMouseDown={nodrag}
              onClick={() => setActiveTab('trades')}
              className={`min-w-[72px] rounded-[5px] px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === 'trades'
                  ? 'bg-white/[0.08] text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Trades
            </button>
          </div>
          <span className={`flex items-center gap-1 font-mono text-[10px] ${statusStyle.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {status}
          </span>
        </div>
        {activeTab === 'book' && (
          <div className={`flex shrink-0 items-center justify-between border-b ${C.bRow} px-3 py-1`}>
            <div className="inline-flex items-center gap-1 rounded-md border border-violet-200/14 bg-[rgba(16,18,36,0.88)] p-0.5">
              {ORDERBOOK_DEPTH_VIEWS.map((view) => (
                <button
                  key={view}
                  type="button"
                  onMouseDown={nodrag}
                  onClick={() => setDepthView(view)}
                  className={`flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors ${
                    depthView === view
                      ? 'bg-violet-400/16'
                      : 'hover:bg-violet-400/8'
                  }`}
                  aria-label={`Order book side mode: ${view}`}
                  title={view}
                >
                  <OrderbookDepthGlyph mode={view} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div ref={priceStepMenuRef} className="relative">
                <button
                  type="button"
                  onMouseDown={nodrag}
                  onClick={() => setPriceStepMenuOpen((prev) => !prev)}
                  className="flex min-w-[56px] items-center justify-between gap-1 rounded-md border border-violet-200/18 bg-[rgba(20,22,45,0.72)] px-2 py-1 font-mono text-[11px] text-slate-100 transition-colors hover:border-violet-200/30"
                  aria-haspopup="listbox"
                  aria-expanded={priceStepMenuOpen}
                  aria-label="Order book aggregation step"
                >
                  <span>{formatOrderbookStep(priceStep)}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${priceStepMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {priceStepMenuOpen && (
                  <div
                    onMouseDown={nodrag}
                    role="listbox"
                    aria-label="Order book aggregation step"
                    className={`absolute right-0 top-full z-30 mt-1 w-16 overflow-hidden rounded-md border ${C.bRow} bg-[rgba(10,12,30,0.96)] shadow-[0_10px_28px_rgba(0,0,0,0.45)]`}
                  >
                    {priceStepOptions.map((step) => (
                      <button
                        key={String(step)}
                        type="button"
                        role="option"
                        aria-selected={step === priceStep}
                        onClick={() => {
                          setPriceStep(step);
                          setPriceStepMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-center px-2 py-1.5 font-mono text-[11px] transition-colors ${
                          step === priceStep
                            ? 'bg-violet-400/18 text-violet-100'
                            : 'text-slate-300 hover:bg-violet-400/10 hover:text-violet-100'
                        }`}
                      >
                        {formatOrderbookStep(step)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="inline-flex min-w-[56px] items-center justify-center gap-1 rounded-md border border-violet-200/18 bg-[rgba(20,22,45,0.72)] px-2 py-1 font-mono text-[11px] text-slate-100">
                {baseAsset || 'BASE'}
              </div>
            </div>
          </div>
        )}
        {detail && status !== 'connected' && (
          <div className={`shrink-0 border-b ${C.bRow} px-3 py-1 text-[10px] text-slate-500`}>
            {detail}
          </div>
        )}
        {activeTab === 'book' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className={`flex shrink-0 items-center border-b ${C.bRow} px-3 py-1.5`}>
              <div className="w-[44%] text-[10px] uppercase tracking-wider text-slate-500">Price</div>
              <div className="w-[28%] text-right text-[10px] uppercase tracking-wider text-slate-500">Size</div>
              <div className="w-[28%] text-right text-[10px] uppercase tracking-wider text-slate-500">{totalLabel}</div>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              {depthView !== 'bids' && (
                <div className="flex flex-1 flex-col justify-end overflow-hidden py-0.5">
                  {visibleAskRows.length > 0
                    ? visibleAskRows.map((row) => <BookRow key={`ask-${row.id}`} r={row} side="ask" maxTotal={maxAskTotal} />)
                    : <div className="px-3 py-2 text-[11px] text-slate-500">Waiting for asks...</div>}
                </div>
              )}
              <div className={`flex shrink-0 items-center justify-between border-y ${C.bRow} bg-violet-400/[0.05] px-3 py-1.5`}>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-bold" style={markStyle}>{markText}</span>
                  {markIcon}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Spread: {spreadText}</span>
                  {typeof seq === 'number' && <span className="font-mono text-[10px] text-slate-500">seq {seq}</span>}
                </div>
              </div>
              {depthView !== 'asks' && (
                <div className="flex flex-1 flex-col overflow-hidden py-0.5">
                  {visibleBidRows.length > 0
                    ? visibleBidRows.map((row) => <BookRow key={`bid-${row.id}`} r={row} side="bid" maxTotal={maxBidTotal} />)
                    : <div className="px-3 py-2 text-[11px] text-slate-500">Waiting for bids...</div>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className={`flex shrink-0 items-center border-b ${C.bRow} px-3 py-1.5`}>
              <div className="w-[36%] text-[10px] uppercase tracking-wider text-slate-500">Time</div>
              <div className="w-[32%] text-right text-[10px] uppercase tracking-wider text-slate-500">Price</div>
              <div className="w-[32%] text-right text-[10px] uppercase tracking-wider text-slate-500">Size</div>
            </div>
            <div className="flex-1 overflow-y-auto py-0.5">
              {tradesRows.length > 0
                ? tradesRows.map((trade) => <OrderbookTradeRow key={`trade-${trade.id}`} trade={trade} />)
                : <div className="px-3 py-2 text-[11px] text-slate-500">Waiting for trades...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ AI Assistant в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const AiAssistantWidget = ({ onClose, locked }) => {
  const [input, setInput]     = useState('');
  const [msgs, setMsgs]       = useState([
    { role: 'ai', text: 'Ready for work, boss.' },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const replyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
    };
  }, []);

  const send = () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: txt }]);
    setLoading(true);
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
    }
    replyTimerRef.current = setTimeout(() => {
      setMsgs(m => [...m, { role: 'ai', text: 'BTC bullish divergence on 15m RSI. Key resistance $108,850. Invalidation $107,600. R/R 1:3.2.' }]);
      setLoading(false);
      replyTimerRef.current = null;
    }, 1200);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH icon={Sparkles} title="THORN AI" badge="Live" onClose={onClose} locked={locked} />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m, i) => (
            <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'pr-1'} ${m.role === 'ai' && i === 0 ? 'mt-3' : ''}`}>
              {m.role === 'ai' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-400/12 ring-1 ring-violet-200/20">
                  <Sparkles className="h-3 w-3 text-violet-100" />
                </div>
              )}
              <div className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                m.role === 'ai'
                  ? `max-w-[calc(100%-2rem)] rounded-tl-sm border ${C.border} bg-violet-400/[0.08] text-violet-50/90`
                  : `max-w-[85%] rounded-tr-sm border ${C.bRow} bg-slate-800/40 text-slate-200`
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2 pr-1">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-400/12 ring-1 ring-violet-200/20">
                <Sparkles className="h-3 w-3 animate-pulse text-violet-100" />
              </div>
              <div className={`max-w-[calc(100%-2rem)] flex items-center gap-1 rounded-xl rounded-tl-sm border ${C.border} bg-violet-400/[0.08] px-3 py-2`}>
                {[0,1,2].map(d => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300" style={{ animationDelay: `${d*0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className={`shrink-0 border-t ${C.bRow} p-2`}>
          <div className="relative flex items-center">
            <input type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask AI to analyze or execute..."
              className={`w-full rounded-lg border ${C.bRow} ${C.bg} py-2 pl-3 pr-8 text-[12px] text-white placeholder-slate-600 outline-none transition-all focus:border-violet-200/30 focus:ring-1 focus:ring-violet-300/15`}
            />
            <button onClick={send}
              className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded transition-all ${
                input ? 'bg-violet-400 text-white shadow-[0_0_10px_rgba(196,181,253,0.35)]' : 'bg-slate-800 text-slate-600'}`}>
              <Send className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ Execution в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const FIELDS = [
  ['Type',   'Limit'],
  ['Entry',  '108,280'],
  ['Inval.', '107,920'],
];

const EXECUTION_ACTIONS = [
  {
    id: 'sell',
    label: 'Sell',
    border: 'border-red-500/35',
    bg: 'bg-red-500/[0.07]',
    hoverBorder: 'hover:border-red-400/65',
    hoverBg: 'hover:bg-red-500/[0.16]',
    topSweep: 'via-red-400',
    bottomSweep: 'via-red-400',
    text: 'text-red-300',
    textHover: 'group-hover:text-red-200',
    radial: 'radial-gradient(ellipse at 50% 120%, rgba(239,68,68,0.2), transparent 65%)',
    iconPath: 'M4 7L0.5 1.5h7L4 7z',
  },
  {
    id: 'buy',
    label: 'Buy',
    border: 'border-emerald-500/35',
    bg: 'bg-emerald-500/[0.07]',
    hoverBorder: 'hover:border-emerald-400/65',
    hoverBg: 'hover:bg-emerald-500/[0.16]',
    topSweep: 'via-emerald-400',
    bottomSweep: 'via-emerald-400',
    text: 'text-emerald-300',
    textHover: 'group-hover:text-emerald-200',
    radial: 'radial-gradient(ellipse at 50% -20%, rgba(52,211,153,0.2), transparent 65%)',
    iconPath: 'M4 1L7.5 6.5H0.5L4 1z',
  },
];

const ExecutionActionButton = ({ action }) => (
  <button
    className={`group relative h-7 overflow-hidden rounded-lg border ${action.border} ${action.bg} transition-all duration-200 ${action.hoverBorder} ${action.hoverBg} active:scale-95`}
  >
    <div
      className={`absolute inset-x-0 top-0 h-px w-[200%] -translate-x-full bg-gradient-to-r from-transparent ${action.topSweep} to-transparent opacity-0 group-hover:animate-[electric-sweep_1.6s_infinite] group-hover:opacity-100`}
    />
    <div
      className={`absolute inset-x-0 bottom-0 h-px w-[200%] translate-x-full bg-gradient-to-l from-transparent ${action.bottomSweep} to-transparent opacity-0 group-hover:animate-[electric-sweep-reverse_1.6s_infinite] group-hover:opacity-100`}
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{ background: action.radial }}
    />
    <span className={`relative z-10 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest ${action.text} ${action.textHover}`}>
      <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor">
        <path d={action.iconPath} />
      </svg>
      {action.label}
    </span>
  </button>
);

const ExecutionWidget = ({ onClose, locked, symbol }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Bolt} title={`Order Entry · ${baseAssetFromSymbol(symbol)}`} onClose={onClose} locked={locked} />
    <div className="flex flex-1 flex-col gap-1 p-2 min-h-0" onMouseDown={nodrag}>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1 min-h-0">
        {[['Size', `0.35 ${baseAssetFromSymbol(symbol)}`], ...FIELDS].map(([label, value]) => (
          <div key={label}
            className="flex flex-col justify-center overflow-hidden rounded-lg border border-slate-700/40 bg-white/[0.02] px-2 transition-colors cursor-pointer hover:bg-violet-400/[0.05]">
            <div className="text-[8px] uppercase tracking-[0.15em] text-violet-200/45 leading-none">{label}</div>
            <div className="mt-0.5 truncate font-mono text-[12px] font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1">
        {EXECUTION_ACTIONS.map((action) => (
          <ExecutionActionButton key={action.id} action={action} />
        ))}
      </div>
    </div>
  </div>
);

// в”Ђв”Ђв”Ђ Positions в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const THEAD = ['Market', 'Size', 'Entry', 'Mark', 'PnL'];
const normalizePositionSide = (side) => {
  const raw = String(side || '').trim().toUpperCase();
  if (raw === 'SHORT') return 'SHORT';
  if (raw === 'LONG') return 'LONG';
  return raw || '—';
};

const marketBaseAsset = (market) => {
  const normalized = String(market || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.includes('/')) return normalized.split('/')[0] || normalized;
  if (normalized.includes('-')) return normalized.split('-')[0] || normalized;
  return normalized;
};

const formatPositionNumber = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return fmt.number(n, digits);
};

const PositionsWidget = ({
  onClose,
  locked,
  walletConnected,
  positions = [],
  positionsLoading = false,
  positionsError = null,
}) => {
  const openPositions = useMemo(
    () =>
      (Array.isArray(positions) ? positions : [])
        .filter((p) => p && Number.isFinite(Number(p.size)) && Math.abs(Number(p.size)) > 0)
        .map((p, i) => {
          const side = normalizePositionSide(p.side);
          const market = String(p.market || '—');
          const sizeValue = Number(p.size);
          const pnlValue = Number(p.pnl);
          return {
            id: p.id ?? `${market}-${side}-${i}`,
            side,
            market,
            sizeText: Number.isFinite(sizeValue)
              ? `${fmt.number(Math.abs(sizeValue), 4)} ${marketBaseAsset(market)}`
              : '—',
            entryText: formatPositionNumber(p.entry, 2),
            markText: formatPositionNumber(p.mark, 2),
            pnlText: Number.isFinite(pnlValue) ? fmt.signedCurrency(pnlValue) : '—',
            pnlValue,
          };
        }),
    [positions],
  );

  const totalPnl = useMemo(() => {
    let sum = 0;
    let has = false;
    for (const row of openPositions) {
      if (!Number.isFinite(row.pnlValue)) continue;
      sum += row.pnlValue;
      has = true;
    }
    return has ? sum : null;
  }, [openPositions]);

  const totalPnlText = totalPnl == null ? '—' : fmt.signedCurrency(totalPnl);
  const totalPnlStyle =
    totalPnl == null ? C.blueGlow : totalPnl >= 0 ? C.greenGlow : C.redGlow;

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={Activity}
        title={`Positions (${openPositions.length})`}
        onClose={onClose}
        locked={locked}
        extra={
          <span className="font-mono text-[12px] text-slate-500">
            PnL: <span className="font-bold" style={totalPnlStyle}>{totalPnlText}</span>
          </span>
        }
      />
      <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
        {!walletConnected && (
          <div className="px-3 py-3 text-[11px] text-slate-500">Connect wallet to load positions.</div>
        )}
        {walletConnected && positionsLoading && (
          <div className="px-3 py-3 text-[11px] text-slate-500">Loading positions...</div>
        )}
        {walletConnected && !positionsLoading && positionsError && (
          <div className="px-3 py-3 text-[11px] text-rose-300">Failed to load positions.</div>
        )}
        {walletConnected && !positionsLoading && !positionsError && openPositions.length === 0 && (
          <div className="px-3 py-3 text-[11px] text-slate-500">No open positions.</div>
        )}
        {walletConnected && !positionsLoading && !positionsError && openPositions.length > 0 && (
          <table className="w-full text-left">
            <thead className={`${C.bg} sticky top-0`}>
              <tr>
                {THEAD.map((h, i) => (
                  <th key={h} className={`py-2 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${C.bRow}`}>
              {openPositions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-xs font-bold text-white">
                    <span className="mr-1.5 font-mono text-[12px]" style={p.side === 'LONG' ? C.greenGlow : p.side === 'SHORT' ? C.redGlow : C.blueGlow}>{p.side}</span>
                    {p.market}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{p.sizeText}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{p.entryText}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-white">{p.markText}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-bold" style={Number.isFinite(p.pnlValue) ? (p.pnlValue >= 0 ? C.greenGlow : C.redGlow) : C.blueGlow}>{p.pnlText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ Watchlist в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const WatchlistWidget = ({ onClose, locked, availableSymbols = [], symbol, onSymbolChange }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Star} title="Watchlist" onClose={onClose} locked={locked} />
    <div className={`flex-1 overflow-auto divide-y ${C.bRow}`} onMouseDown={nodrag}>
      {availableSymbols.map((entry) => {
        const base = baseAssetFromSymbol(entry);
        const active = entry === symbol;
        return (
        <button
          key={entry}
          type="button"
          onClick={() => onSymbolChange?.(entry)}
          className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
            active ? 'bg-violet-400/[0.1]' : 'hover:bg-violet-400/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${C.border} bg-violet-400/[0.08] font-mono text-[10px] font-bold text-violet-100`}>
              {base.slice(0,2)}
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-white leading-none">{base}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{entry}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs font-semibold text-white leading-none">PERP</div>
            <div className={`mt-0.5 flex items-center justify-end gap-0.5 font-mono text-[10px] font-semibold ${active ? 'text-violet-200' : 'text-slate-500'}`}>
              {active ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              {active ? 'active' : 'switch'}
            </div>
          </div>
        </button>
        );
      })}
      {availableSymbols.length === 0 && (
        <div className="px-3 py-2 text-[11px] text-slate-500">No symbols available.</div>
      )}
    </div>
  </div>
);

// в”Ђв”Ђв”Ђ Trade History в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const TradeHistoryWidget = ({ onClose, locked, symbol }) => {
  const { recentTrades, status, detail } = useOrderbookStream(symbol);
  const statusStyle = ORDERBOOK_STATUS_STYLES[status] || ORDERBOOK_STATUS_STYLES.idle;
  const rows = useMemo(
    () => (Array.isArray(recentTrades) ? recentTrades.slice(0, 120) : []),
    [recentTrades],
  );

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={Clock}
        title="Trade History"
        onClose={onClose}
        locked={locked}
        extra={(
          <span className={`hidden items-center gap-1 font-mono text-[10px] md:flex ${statusStyle.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {status}
          </span>
        )}
      />
      <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
        {detail && status !== 'connected' && (
          <div className={`shrink-0 border-b ${C.bRow} px-3 py-1 text-[10px] text-slate-500`}>
            {detail}
          </div>
        )}
        <table className="w-full">
          <thead className={`${C.bg} sticky top-0`}>
            <tr>
              {[['Time', 'left'], ['Side', 'left'], ['Price', 'right'], ['Size', 'right']].map(([h, a]) => (
                <th key={h} className={`py-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500 ${a === 'right' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${C.bRow}`}>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-[11px] text-slate-500">
                  Waiting for trades...
                </td>
              </tr>
            )}
            {rows.map((trade) => {
              const sideLabel =
                trade.side === 'buy'
                  ? 'BUY'
                  : trade.side === 'sell'
                    ? 'SELL'
                    : 'UNK';
              const sideStyle =
                trade.side === 'buy'
                  ? C.greenGlow
                  : trade.side === 'sell'
                    ? C.redGlow
                    : C.blueGlow;

              return (
                <tr key={trade.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2 px-3 font-mono text-[12px] text-slate-200">{trade.timeText}</td>
                  <td className="py-2 px-3 font-mono text-[12px] font-bold" style={sideStyle}>{sideLabel}</td>
                  <td className="py-2 px-3 text-right font-mono text-[12px] text-slate-300">{trade.priceText}</td>
                  <td className="py-2 px-3 text-right font-mono text-[12px] text-slate-300">{trade.sizeText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ News Feed в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const NEWS = [
  { time: '2m ago',  tag: 'BULLISH', title: 'BlackRock BTC ETF sees record $1.2B inflow in single day',          tc: 'text-emerald-300', bc: 'border-emerald-500/30 bg-emerald-500/10' },
  { time: '8m ago',  tag: 'NEUTRAL', title: 'Fed minutes: policymakers see no rush to cut rates further',        tc: 'text-yellow-300',  bc: 'border-yellow-500/30 bg-yellow-500/10'  },
  { time: '15m ago', tag: 'BULLISH', title: 'MicroStrategy acquires 5,000 BTC at avg $107,200',                  tc: 'text-emerald-300', bc: 'border-emerald-500/30 bg-emerald-500/10' },
  { time: '31m ago', tag: 'BEARISH', title: 'SEC delays decision on spot ETH options, market reacts cautiously', tc: 'text-red-300',      bc: 'border-red-500/30 bg-red-500/10'         },
  { time: '1h ago',  tag: 'NEUTRAL', title: 'Crypto derivatives open interest hits $45B all-time high',           tc: 'text-yellow-300',  bc: 'border-yellow-500/30 bg-yellow-500/10'  },
];

const NewsFeedWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Newspaper} title="News Feed" badge="Live" onClose={onClose} locked={locked} />
    <div className={`flex-1 overflow-auto divide-y ${C.bRow}`} onMouseDown={nodrag}>
      {NEWS.map((n, i) => (
        <div key={i} className="flex cursor-pointer flex-col gap-1.5 px-3 py-2.5 transition-colors hover:bg-violet-400/[0.03]">
          <div className="flex items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${n.tc} ${n.bc}`}>{n.tag}</span>
            <span className="text-[10px] text-slate-200">{n.time}</span>
          </div>
          <p className="text-[12px] leading-snug text-slate-400">{n.title}</p>
        </div>
      ))}
    </div>
  </div>
);

// в”Ђв”Ђв”Ђ Market Stats в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const STATS = [
  { label: 'Market Cap',    value: '$2.14T',  sub: '+3.2% 24h'    },
  { label: '24h Volume',    value: '$148.3B', sub: 'Spot + Perps'  },
  { label: 'BTC Dominance', value: '54.8%',   sub: '-0.4% 24h'    },
  { label: 'Fear & Greed',  value: '78',      sub: 'Extreme Greed' },
  { label: 'Funding Rate',  value: '0.012%',  sub: 'BTC Perp 8h'  },
  { label: 'Open Interest', value: '$45.1B',  sub: 'All-time high' },
];

const MarketStatsWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Flame} title="Market Stats" onClose={onClose} locked={locked} />
    <div className="grid flex-1 grid-cols-2 gap-px overflow-auto bg-slate-800/15 p-px" onMouseDown={nodrag}>
      {STATS.map(s => (
        <div key={s.label} className={`flex flex-col justify-center ${C.bgCard} p-3 transition-colors hover:bg-violet-400/[0.04]`}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{s.label}</div>
          <div className="mt-1 font-mono text-base font-bold text-white">{s.value}</div>
          <div className="text-[10px] text-slate-500">{s.sub}</div>
        </div>
      ))}
    </div>
  </div>
);

// в”Ђв”Ђв”Ђ Widget registry в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const DEFS = {
  chart:        { label: 'Chart',         icon: BarChart3,  Comp: ChartWidget,        dfl: { w: 8, h: 4 } },
  orderbook:    { label: 'Order Book',    icon: AlignLeft,  Comp: OrderBookWidget,    dfl: { w: 4, h: 4 } },
  ai:           { label: 'AI Assistant',  icon: Sparkles,   Comp: AiAssistantWidget,  dfl: { w: 4, h: 3 } },
  execution:    { label: 'Execution',     icon: Bolt,       Comp: ExecutionWidget,    dfl: { w: 3, h: 3 } },
  positions:    { label: 'Positions',     icon: Activity,   Comp: PositionsWidget,    dfl: { w: 5, h: 3 } },
  watchlist:    { label: 'Watchlist',     icon: Star,       Comp: WatchlistWidget,    dfl: { w: 3, h: 4 } },
  tradehistory: { label: 'Trade History', icon: Clock,      Comp: TradeHistoryWidget, dfl: { w: 4, h: 3 } },
  newsfeed:     { label: 'News Feed',     icon: Newspaper,  Comp: NewsFeedWidget,     dfl: { w: 4, h: 4 } },
  marketstats:  { label: 'Market Stats',  icon: Flame,      Comp: MarketStatsWidget,  dfl: { w: 4, h: 3 } },
};

const DEFAULT_LAYOUT = [
  { i: 'chart',     x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 2 },
  { i: 'orderbook', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 2 },
  { i: 'ai',        x: 0, y: 4, w: 4, h: 3, minW: 3, minH: 2 },
  { i: 'positions', x: 4, y: 4, w: 5, h: 3, minW: 3, minH: 2 },
  { i: 'execution', x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
];

const PRESET_STORAGE_KEY = 'thornado:terminal-layout-presets:v1';
const MAX_PRESETS = 5;

const toLayoutSnapshot = (items) =>
  items.map(({ i, x, y, w, h, minW, minH, maxW, maxH }) => ({
    i, x, y, w, h, minW, minH, maxW, maxH,
  }));

const normalizeLayout = (items) => {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .filter((item) => item && typeof item.i === 'string' && DEFS[item.i])
    .filter((item) => {
      if (seen.has(item.i)) return false;
      seen.add(item.i);
      return true;
    })
    .map((item) => ({
      i: item.i,
      x: Number.isFinite(item.x) ? item.x : 0,
      y: Number.isFinite(item.y) ? item.y : 0,
      w: Number.isFinite(item.w) ? item.w : DEFS[item.i].dfl.w,
      h: Number.isFinite(item.h) ? item.h : DEFS[item.i].dfl.h,
      minW: Number.isFinite(item.minW) ? item.minW : undefined,
      minH: Number.isFinite(item.minH) ? item.minH : undefined,
      maxW: Number.isFinite(item.maxW) ? item.maxW : undefined,
      maxH: Number.isFinite(item.maxH) ? item.maxH : undefined,
    }));
};

const readStoredPresets = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        name: p.name.trim().slice(0, 40),
        updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now(),
        layout: normalizeLayout(p.layout),
      }))
      .filter((p) => p.name.length > 0 && p.layout.length > 0)
      .slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
};

// в”Ђв”Ђв”Ђ Add Widget Panel в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const AddWidgetPanel = ({ activeIds, onAdd, onClose }) => (
  <div
    className={`absolute top-9 right-0 z-50 w-56 overflow-hidden rounded-2xl border ${C.border} ${C.bgCard} shadow-[0_8px_40px_rgba(0,0,0,0.7)]`}
    onMouseDown={e => e.stopPropagation()}
  >
    <div className={`flex items-center justify-between border-b ${C.bRow} px-4 py-2.5`}>
      <span className="text-xs font-bold text-white">Add Widget</span>
      <button onClick={onClose} className="rounded p-0.5 text-slate-500 transition-colors hover:text-violet-200">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="max-h-72 overflow-auto p-1.5">
      {Object.entries(DEFS).map(([id, def]) => {
        const active = activeIds.includes(id);
        const Icon = def.icon;
        return (
          <button key={id}
            onClick={() => { if (!active) { onAdd(id); onClose(); } }}
            disabled={active}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
              active ? 'cursor-default opacity-35' : 'cursor-pointer hover:bg-violet-400/[0.07]'}`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
              active ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : `${C.border} bg-violet-400/[0.08]`}`}>
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-400' : 'text-violet-100'}`} />
            </div>
            <span className="flex-1 text-xs font-medium text-white">{def.label}</span>
            {active ? <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    : <Plus className="h-3.5 w-3.5 shrink-0 text-violet-100" />}
          </button>
        );
      })}
    </div>
  </div>
);

const PresetPanel = ({ presets, activePresetId, onLoad, onSave, onDelete, onClose }) => {
  const [name, setName] = useState('');
  const [hint, setHint] = useState('');

  const save = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const result = onSave(cleanName);
    if (!result.ok) {
      setHint(result.message);
      return;
    }
    setHint(result.message);
    setName('');
  };

  return (
    <div
      className={`absolute top-9 right-0 z-50 w-80 overflow-hidden rounded-2xl border ${C.border} ${C.bgCard} shadow-[0_8px_40px_rgba(0,0,0,0.7)]`}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className={`flex items-center justify-between border-b ${C.bRow} px-4 py-2.5`}>
        <div className="flex items-center gap-2">
          <Bookmark className="h-3.5 w-3.5 text-violet-200" />
          <span className="text-xs font-bold text-white">Layout Presets</span>
        </div>
        <button onClick={onClose} className="rounded p-0.5 text-slate-500 transition-colors hover:text-violet-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={`border-b ${C.bRow} p-3`}>
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Save current layout</span>
          <span className="text-slate-500">{presets.length}/{MAX_PRESETS}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="Preset name"
            className={`h-8 flex-1 rounded-lg border ${C.bRow} ${C.bg} px-2.5 text-[12px] text-white placeholder-slate-600 outline-none transition-all focus:border-violet-200/30 focus:ring-1 focus:ring-violet-300/15`}
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-violet-300/25 bg-violet-400/10 px-3 text-[12px] font-medium text-violet-100 transition-colors hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
        {hint && <div className="mt-2 text-[11px] text-slate-400">{hint}</div>}
      </div>

      <div className="max-h-72 overflow-auto p-1.5">
        {presets.length === 0 && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 py-2 text-[12px] text-slate-500">
            No saved presets yet.
          </div>
        )}
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`mb-1 flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
              preset.id === activePresetId
                ? 'border-violet-300/35 bg-violet-400/[0.08]'
                : 'border-slate-700/35 bg-slate-900/20'
            }`}
          >
            <button
              onClick={() => onLoad(preset.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-[12px] font-medium text-white">{preset.name}</div>
              <div className="text-[10px] text-slate-500">
                {new Date(preset.updatedAt).toLocaleString()}
              </div>
            </button>
            <button
              onClick={() => onDelete(preset.id)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
              title="Delete preset"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ Terminal Grid в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const TerminalGrid = () => {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { getNadoClient } = useNadoLinkedSigner();
  const { chainEnv, activeChain } = useNadoNetwork();

  const onWrongChain = chainId != null && chainId !== activeChain.id;
  const canQueryPortfolio =
    Boolean(address && publicClient && walletClient && !onWrongChain);

  const portfolio = usePortfolioData({
    getNadoClient,
    enabled: canQueryPortfolio,
    ownerAddress: address,
    chainEnv,
    subaccountName: 'default',
  });

  const terminalPositions = portfolio.positions ?? [];
  const positionsLoading = Boolean(
    canQueryPortfolio &&
      (portfolio.queries?.canonicalPositions?.isLoading ??
        portfolio.queries?.positions?.isLoading),
  );
  const positionsError =
    portfolio.queries?.canonicalPositions?.error ??
    portfolio.queries?.positions?.error ??
    null;

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [layout, setLayout]       = useState(DEFAULT_LAYOUT);
  const [showPanel, setShowPanel] = useState(false);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [locked, setLocked]       = useState(false);
  const [presets, setPresets] = useState(() => readStoredPresets());
  const [activePresetId, setActivePresetId] = useState(null);
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_ORDERBOOK_SYMBOL || FALLBACK_TICKERS[0]);
  const availableSymbols = useAvailableTickers(activeSymbol);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setContainerWidth(rect.width);
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!showPanel && !showPresetPanel) return;
    const h = () => {
      setShowPanel(false);
      setShowPresetPanel(false);
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [showPanel, showPresetPanel]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // ignore storage errors
    }
  }, [presets]);

  useEffect(() => {
    if (availableSymbols.includes(activeSymbol)) return;
    if (availableSymbols.length > 0) {
      setActiveSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, activeSymbol]);

  const activeIds = useMemo(() => layout.map((l) => l.i), [layout]);
  const renderedLayout = useMemo(
    () =>
      layout.map((item) => ({
        ...item,
        static: locked,
        isDraggable: !locked,
        isResizable: !locked,
      })),
    [layout, locked],
  );

  const commitLayout = useCallback((nextLayout) => {
    setLayout(normalizeLayout(nextLayout));
  }, []);

  const addWidget = useCallback((id) => {
    if (!DEFS[id]) return;
    setLayout((prev) => {
      if (prev.some((item) => item.i === id)) return prev;
      const maxY = prev.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      return [...prev, { i: id, x: 0, y: maxY, ...DEFS[id].dfl }];
    });
  }, []);

  const savePreset = useCallback((name) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return { ok: false, message: 'Name is required.' };

    const snapshot = toLayoutSnapshot(layout);
    const existing = presets.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    const now = Date.now();

    if (existing) {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === existing.id ? { ...p, name: clean, layout: snapshot, updatedAt: now } : p,
        ),
      );
      setActivePresetId(existing.id);
      return { ok: true, message: `Updated "${clean}".` };
    }

    if (presets.length >= MAX_PRESETS) {
      return { ok: false, message: `Max ${MAX_PRESETS} presets. Delete one to save a new preset.` };
    }

    const id = `preset_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setPresets((prev) => [{ id, name: clean, updatedAt: now, layout: snapshot }, ...prev]);
    setActivePresetId(id);
    return { ok: true, message: `Saved "${clean}".` };
  }, [layout, presets]);

  const loadPreset = useCallback((presetId) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const normalized = normalizeLayout(preset.layout);
    if (normalized.length === 0) return;

    setLayout(normalized);
    setActivePresetId(presetId);
    setShowPanel(false);
    setShowPresetPanel(false);
  }, [presets]);

  const deletePreset = useCallback((presetId) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    setActivePresetId((prev) => (prev === presetId ? null : prev));
  }, []);

  const handleSymbolChange = useCallback((nextSymbol) => {
    const normalized = normalizeTicker(nextSymbol);
    if (!normalized) return;
    setActiveSymbol(normalized);
  }, []);

  return (
    <div className={`flex flex-1 flex-col ${C.bg} min-h-0`}>
      {/* Toolbar */}
      <div className={`relative z-40 flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-4 py-2`}>
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-3.5 w-3.5 text-violet-200/60" />
          <span className="text-[12px] text-slate-400">{activeIds.length} widgets</span>
          <span className="rounded border border-violet-200/15 bg-violet-400/[0.08] px-2 py-0.5 font-mono text-[11px] text-violet-100">
            {activeSymbol}
          </span>
          {!locked && <span className="text-[12px] text-slate-600">- drag header - resize corners</span>}
          {locked && <span className="text-[12px] text-amber-500/80">- layout locked</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/40 px-2.5 py-1 text-[11px] text-slate-400 md:flex">
            <span className="font-mono">Ticker</span>
            <select
              value={activeSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-violet-100 outline-none"
            >
              {availableSymbols.map((entry) => (
                <option key={entry} value={entry} className="bg-slate-900 text-violet-100">
                  {entry}
                </option>
              ))}
            </select>
          </label>

          {/* Lock / Unlock toggle */}
          <button
            onClick={() => setLocked(v => !v)}
            title={locked ? 'Unlock layout' : 'Lock layout'}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 ${
              locked
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'border-slate-600/50 bg-slate-800/40 text-slate-500 hover:border-violet-200/20 hover:text-violet-100'
            }`}
          >
            {locked
              ? <Lock className="h-3.5 w-3.5" />
              : <Unlock className="h-3.5 w-3.5" />}
          </button>

          {/* Presets */}
          <div className="relative" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowPanel(false);
                setShowPresetPanel((v) => !v);
              }}
              title="Layout presets"
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-200 ${
                showPresetPanel
                  ? 'border-violet-300/40 bg-violet-400/14 text-violet-100'
                  : 'border-slate-600/50 bg-slate-800/40 text-slate-400 hover:border-violet-200/20 hover:text-violet-100'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Presets
            </button>
            {showPresetPanel && (
              <PresetPanel
                presets={presets}
                activePresetId={activePresetId}
                onSave={savePreset}
                onLoad={loadPreset}
                onDelete={deletePreset}
                onClose={() => setShowPresetPanel(false)}
              />
            )}
          </div>

          {/* Add widget */}
          {!locked && (
            <div className="relative" onMouseDown={e => e.stopPropagation()}>
              <ElectricButton primary className="h-7 px-3 text-[12px] font-medium"
                onClick={() => {
                  setShowPresetPanel(false);
                  setShowPanel(v => !v);
                }}>
                <Plus className="mr-1 h-3 w-3 inline" />
                Add Widget
              </ElectricButton>
              {showPanel && (
                <AddWidgetPanel activeIds={activeIds} onAdd={addWidget} onClose={() => setShowPanel(false)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div ref={containerRef} className="flex-1 overflow-auto p-3">
        <ReactGridLayout
          className="layout"
          layout={renderedLayout}
          cols={12}
          rowHeight={88}
          width={containerWidth}
          draggableHandle=".drag-handle"
          margin={[10, 10]}
          isResizable={!locked}
          isDraggable={!locked}
          resizeHandles={['se', 'sw', 'ne', 'nw']}
          compactType={null}
          preventCollision={true}
          onDragStop={locked ? undefined : commitLayout}
          onResizeStop={locked ? undefined : commitLayout}
        >
          {layout.map(({ i }) => {
            const def = DEFS[i];
            if (!def) return null;
            const Comp = def.Comp;
            return (
              <div key={i}>
                <SolidBlock className={`h-full w-full overflow-hidden transition-all duration-200 ${locked ? 'ring-0' : ''}`}>
                  <Comp
                    locked={locked}
                    symbol={activeSymbol}
                    walletConnected={Boolean(isConnected && address)}
                    positions={terminalPositions}
                    positionsLoading={positionsLoading}
                    positionsError={positionsError}
                    availableSymbols={availableSymbols}
                    onSymbolChange={handleSymbolChange}
                    onClose={locked ? undefined : () => setLayout(prev => prev.filter(l => l.i !== i))}
                  />
                </SolidBlock>
              </div>
            );
          })}
        </ReactGridLayout>
      </div>
    </div>
  );
};

export default TerminalGrid;
