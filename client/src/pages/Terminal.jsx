import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { CrosshairMode, createChart } from 'lightweight-charts';
import {
  Sparkles, Activity, Bolt, BarChart3, AlignLeft, GripHorizontal,
  Send, Star, Newspaper, Clock, LayoutGrid, X, Plus, Eye,
  Flame, ChevronUp, ChevronDown, Lock, Unlock, Bookmark, Save, Trash2,
  Info, ArrowLeftRight, ExternalLink, Search,
} from 'lucide-react';
import {
  useConnection,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { packOrderAppendix } from '@nadohq/shared';
import { formatUnits, parseUnits } from 'viem';
import SolidBlock from '../components/SolidBlock';
import ElectricButton from '../components/ElectricButton';
import Web3TokenIcon from '../components/portfolio/Web3TokenIcon.jsx';
import { usePortfolioData } from '../hooks/usePortfolioData.js';
import { useNadoLinkedSigner } from '../context/NadoLinkedSignerContext.jsx';
import { useNadoNetwork } from '../context/NadoNetworkContext.jsx';
import { formatUserFacingError } from '../lib/formatUserFacingError.js';
import { fmt } from '../lib/portfolioAdapters.js';
import { useInvalidateSession, useSession } from '../hooks/useSession.js';
import { signInWithThornado } from '../lib/siweAuth.js';
import {
  createExecutionGatewayClient,
  fetchExecutionCapabilities,
} from '../lib/executionGateway.js';

// в”Ђв”Ђв”Ђ Design tokens в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const C = {
  accent:    'text-indigo-50',
  muted:     'text-slate-400',
  dim:       'text-slate-500',
  greenGlow: { color: '#6ee7b7' },
  redGlow:   { color: '#fca5a5' },
  blueGlow:  { color: '#dbeafe' },
  bg:        'bg-[var(--term-panel-muted)]',
  bgCard:    'bg-[var(--term-panel-strong)] backdrop-blur-[12px]',
  border:    'border-[var(--term-border)]',
  bRow:      'border-[var(--term-divider)]',
};

// Blocks drag propagation; use on widget body (below drag-handle)
const nodrag = (e) => e.stopPropagation();
const WIDGET_SHELL_CLASS = 'flex h-full flex-col';

// в”Ђв”Ђв”Ђ Widget Header в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const WH = ({ icon: Icon, title, badge, onClose, extra, locked, pinned, onTogglePin, showIcon = true }) => {
  const titleNode =
    typeof title === 'string' || typeof title === 'number'
      ? <span className="truncate text-xs font-semibold text-white/90">{title}</span>
      : <div className="min-w-0">{title}</div>;

  return (
    <div className={`drag-handle flex h-10 shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-3 select-none ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
      <div className="flex min-w-0 items-center gap-2">
        {showIcon && <Icon className="h-3.5 w-3.5 shrink-0 text-violet-200" />}
        {titleNode}
        {badge && (
          <span className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-violet-200/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-100">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
            {badge}
          </span>
        )}
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        {extra}
        {typeof onTogglePin === 'function' && (
          <button
            onMouseDown={nodrag}
            onClick={onTogglePin}
            className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
              pinned
                ? 'text-amber-300 hover:bg-amber-500/20'
                : 'text-slate-500 hover:bg-slate-700/60 hover:text-slate-300'
            }`}
            title={pinned ? 'Unpin widget size/position' : 'Pin widget size/position'}
            aria-label={pinned ? 'Unpin widget' : 'Pin widget'}
          >
            {pinned ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
        )}
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
};

// в”Ђв”Ђв”Ђ Chart + Orderbook live feeds в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const FALLBACK_TICKERS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP', 'DOGE-PERP', 'AVAX-PERP'];
const DEFAULT_ORDERBOOK_SYMBOL = (import.meta.env.VITE_ORDERBOOK_SYMBOL || 'BTC-PERP').trim().toUpperCase();

const CHART_WS_BASE = (import.meta.env.VITE_CHART_WS_BASE || '').trim();
const CHART_HTTP_BASE = (import.meta.env.VITE_CHART_HTTP_BASE || '').trim();
const ORDERBOOK_WS_BASE = (import.meta.env.VITE_ORDERBOOK_WS_BASE || '').trim();
const ORDERBOOK_HTTP_BASE = (import.meta.env.VITE_ORDERBOOK_HTTP_BASE || '').trim();
const MARKETS_WS_BASE = (import.meta.env.VITE_MARKETS_WS_BASE || '').trim();
const MARKETS_HTTP_BASE = (import.meta.env.VITE_MARKETS_HTTP_BASE || '').trim();

const CHART_TF_OPTIONS = ['1m', '5m', '15m', '1h', '4h', '1D'];
const CHART_PRICE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHART_VOL_FMT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const CHART_FONT_FAMILY = '\'REPLICA_MONO\', \'REPLICA_MONO Fallback\', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
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
const TERMINAL_PREFS_KEY = 'thornado:terminal-preferences:v1';
const ORDERBOOK_TRADES_DISPLAY = 70;
const TRADE_HISTORY_DISPLAY = 90;
const ORDER_ENTRY_MARKET_REFRESH_MS = 5_000;
const ORDER_ENTRY_DEFAULT_LEVERAGE = 10;
const ORDER_ENTRY_MARKET_SLIPPAGE = 0.02;
const ORDER_ENTRY_LIMIT_EXPIRATION_SEC = 86_400 * 30;
const ORDER_ENTRY_IOC_EXPIRATION_SEC = 120;
const ORDER_ENTRY_ADVANCED_TYPES = [
  { value: 'stop_market', label: 'Stop Market' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'twap', label: 'TWAP' },
  { value: 'scaled', label: 'Scaled' },
];
const ORDER_ENTRY_TIF_OPTIONS = [
  { value: 'gtc', label: 'GTC' },
  { value: 'ioc', label: 'IOC' },
  { value: 'fok', label: 'FOK' },
  { value: 'good_until', label: 'Good Until' },
];
const ORDER_ENTRY_TWAP_PRESETS = [
  { value: 10, label: '10m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 240, label: '4h' },
];
const ORDER_ENTRY_TWAP_FREQUENCIES = [
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
];
const ORDER_ENTRY_SCALED_QTY_PRESETS = [5, 10, 20, 30, 50];

const readTerminalPrefs = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TERMINAL_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeTerminalPrefs = (next) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
};

const updateTerminalPrefs = (updater) => {
  const current = readTerminalPrefs();
  const next = updater(current);
  if (!next || typeof next !== 'object') return;
  writeTerminalPrefs(next);
};

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

const formatStatusText = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'connected') return '';
  return normalized.replace(/_/g, ' ');
};

const BOOK_PRICE_FMT_CACHE = new Map();
const ORDERBOOK_QUOTE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ORDERBOOK_DEPTH_VIEWS = ['both', 'asks', 'bids'];
const ORDERBOOK_TOTAL_UNITS = ['base', 'usdt0'];
const SYMBOL_PICKER_TABS = ['All', 'Perps', 'Spot', 'Memes', 'DeFi', 'Chains', 'Commodities', 'Equities', 'FX', 'Indices'];
const SYMBOL_MEME_SET = new Set([
  'DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME', 'BRETT',
  'PUMP', 'PENGU', 'FARTCOIN', 'TRUMP', 'PNUT', 'MOG', 'GOAT',
]);
const SYMBOL_DEFI_SET = new Set([
  'UNI', 'AAVE', 'MKR', 'COMP', 'CRV', 'SNX', 'SUSHI', 'DYDX', 'INJ', 'LDO', 'RUNE',
  'LINK', 'ENA', 'ONDO', 'ZRO', 'SKY', 'GMX', 'JUP', 'ASTER', 'WLFI', 'XPL', 'LIT', 'PENDLE',
]);
const SYMBOL_CHAIN_SET = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'ARB', 'OP', 'MATIC', 'POL', 'AVAX', 'HYPE', 'INJ', 'ATOM', 'SEI',
  'TON', 'ZK', 'LTC', 'BCH', 'XRP', 'ADA', 'NEAR', 'APT', 'SUI', 'STRK', 'CELO', 'ONE', 'MON',
  'ZEC', 'DOT', 'TRX', 'FIL', 'ETC', 'KAS', 'TIA',
]);
const SYMBOL_INDEX_SET = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'SPX', 'NDX', 'DXY', 'VIX', 'US500', 'NAS100', 'DE40', 'UK100', 'JP225', 'HK50']);
const SYMBOL_FIAT_SET = new Set(['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY', 'HKD', 'SGD']);
const SYMBOL_COMMODITY_SET = new Set(['XAU', 'XAG', 'WTI', 'BRENT', 'GOLD', 'SILVER', 'NGAS', 'OIL']);
const SYMBOL_INDEX_HINTS = ['DXY', 'SPX', 'NDX', 'DJI', 'VIX', 'DE40', 'UK100', 'NAS100', 'US500', 'INDEX'];
const SYMBOL_EQUITY_HINTS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'NFLX', 'BABA'];
const SYMBOL_QUOTE_SUFFIXES = ['USDT0', 'USDT', 'USDC', 'USD', 'EUR', 'BTC', 'ETH', 'BNB', 'SOL', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD'];
const SYMBOL_PICKER_LEVERAGE = {
  BTC: 50,
  ETH: 50,
  SOL: 40,
};
const FOREX_SYMBOL_RE = /(USDJPY|GBPUSD|EURUSD|AUDUSD|USDCAD|NZDUSD|USDCHF|EURJPY|GBPJPY|AUDJPY|CADJPY|CHFJPY|EURGBP|EURCHF|GBPCHF|EURAUD|EURCAD|USDNOK|USDSEK|USDMXN|USDZAR)/;
const INDEX_SYMBOL_RE = /(SPY|QQQ|IWM|DIA|SPX|NDX|DXY|VIX|US500|NAS100|DE40|UK100|JP225|HK50)/;
const COMMODITY_SYMBOL_RE = /(WTI|XAG|XAU|XPT|BRENT|NGAS|NATGAS|OIL|GOLD|SILVER)/;
const MEME_SYMBOL_RE = /(KPEPE|KBONK|PEPE|DOGE|FART|PUMP|PENGU|SHIB|MEME|TRUMP|BONK|FLOKI|WIF|BRETT|PNUT|MOG|GOAT)/;
const DEFI_SYMBOL_RE = /\b(UNI|AAVE|LINK|ENA|ONDO|LDO|CRV|MKR|COMP|SNX|ZRO|SKY|GMX|JUP|ASTER|WLFI|XPL|LIT|SUSHI|DYDX|RUNE|PENDLE)\b/;
const normalizeCategoryAsset = (value) => {
  const raw = normalizeTicker(value);
  if (!raw) return '';
  // Nado listings often prefix wrapped markets with "k" (kPEPE, kBONK, kBTC, ...).
  // For tab classification, use the underlying asset ticker.
  if (raw.length > 2 && raw.startsWith('K') && /[A-Z0-9]/.test(raw[1])) {
    return raw.slice(1);
  }
  return raw;
};
const classifyTickerTag = ({ symbol, kind, hints, base, quote }) => {
  const s = normalizeTicker(symbol);
  const b = normalizeCategoryAsset(base || baseAssetFromSymbol(s));
  const q = normalizeCategoryAsset(quote || quoteAssetFromSymbol(s));
  const hintText = String(hints || '').toLowerCase();

  if (
    /(?:fx|forex|currenc)/.test(hintText)
    || FOREX_SYMBOL_RE.test(s)
    || (b && q && SYMBOL_FIAT_SET.has(b) && SYMBOL_FIAT_SET.has(q))
  ) {
    return 'forex';
  }

  if (/(?:index|indices)/.test(hintText) || INDEX_SYMBOL_RE.test(s) || SYMBOL_INDEX_SET.has(b)) return 'indices';

  if (/(?:commodity|metal|energy|oil|gold|silver)/.test(hintText) || COMMODITY_SYMBOL_RE.test(s) || SYMBOL_COMMODITY_SET.has(b)) {
    return 'commodity';
  }

  if (/(?:equity|stock|share)/.test(hintText) || SYMBOL_EQUITY_HINTS.includes(b)) return 'equity';

  if (/(?:meme)/.test(hintText) || MEME_SYMBOL_RE.test(s) || SYMBOL_MEME_SET.has(b)) return 'meme';

  if (/(?:defi|de-fi|dex|lending)/.test(hintText) || DEFI_SYMBOL_RE.test(s) || DEFI_SYMBOL_RE.test(b) || SYMBOL_DEFI_SET.has(b)) return 'defi';

  if (SYMBOL_CHAIN_SET.has(b) || /(?:layer|l1|l2|chain|mainnet|crypto)/.test(hintText)) return 'chain';

  return kind;
};

const toFiniteOrNull = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    if (!cleaned) return null;
    const numericText = cleaned.endsWith('%') ? cleaned.slice(0, -1) : cleaned;
    const num = Number(numericText);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toFiniteNumber = (value) => {
  return toFiniteOrNull(value) ?? 0;
};

const clampNumber = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const sanitizeDecimalInput = (value) => {
  const source = String(value ?? '').replace(',', '.');
  const filtered = source.replace(/[^0-9.]/g, '');
  const firstDot = filtered.indexOf('.');
  if (firstDot === -1) return filtered;
  return `${filtered.slice(0, firstDot + 1)}${filtered.slice(firstDot + 1).replace(/\./g, '')}`;
};

const parsePositiveDecimal = (value) => {
  const normalized = sanitizeDecimalInput(value).trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const formatEditableNumber = (value, maxDigits = 6) => {
  if (!Number.isFinite(value) || value <= 0) return '';
  const fixed = value.toFixed(maxDigits);
  return fixed.replace(/\.?0+$/, '');
};

const extractGatewayErrorMessage = (error) => {
  const message = formatUserFacingError(error);
  const marker = 'Data: ';
  const idx = message.indexOf(marker);
  if (idx === -1) return message;

  const rawPayload = message.slice(idx + marker.length).trim();
  if (!rawPayload || rawPayload === '[object Object]') return message;
  try {
    const parsed = JSON.parse(rawPayload);
    const detailed = parsed?.error ?? parsed?.message;
    if (typeof detailed === 'string' && detailed.trim()) {
      return detailed.trim();
    }
  } catch {
    // leave original message
  }
  return message;
};

const getOrderEntryExecutionType = ({ orderType, postOnly = false, tif = 'gtc' }) => {
  if (orderType === 'market') return 'ioc';
  if (postOnly) return 'post_only';
  if (tif === 'ioc' || tif === 'fok') return 'ioc';
  return 'default';
};

const getOrderEntryExpiration = ({ orderType, tif = 'gtc' }) => {
  const nowSec = Math.trunc(Date.now() / 1000);
  if (orderType === 'market' || tif === 'ioc' || tif === 'fok') {
    return nowSec + ORDER_ENTRY_IOC_EXPIRATION_SEC;
  }
  return nowSec + ORDER_ENTRY_LIMIT_EXPIRATION_SEC;
};

const estimateMarketExecutionPrice = (referencePrice, side) => {
  const ref = toFiniteOrNull(referencePrice);
  if (ref == null || ref <= 0) return null;
  const factor = side === 'sell'
    ? 1 - ORDER_ENTRY_MARKET_SLIPPAGE
    : 1 + ORDER_ENTRY_MARKET_SLIPPAGE;
  return ref * factor;
};

const normalizeTicker = (value) => String(value || '').trim().toUpperCase();
const normalizeOrderbookTotalUnit = (value) => (
  ORDERBOOK_TOTAL_UNITS.includes(value) ? value : 'base'
);
const readStringField = (source, keys = []) => {
  if (!source || typeof source !== 'object') return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};
const extractSymbolItemsFromPayload = (payload) => {
  const out = [];
  const visit = (node, depth = 0) => {
    if (node == null || depth > 3) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (typeof node !== 'object') return;

    const directKeys = ['symbol', 'ticker', 'market', 'pair', 'instrument', 'instrument_name', 'display_symbol', 'code'];
    if (directKeys.some((key) => typeof node[key] === 'string' && node[key].trim())) {
      out.push(node);
    }

    if (node.instrument && typeof node.instrument === 'object') {
      visit(node.instrument, depth + 1);
    }

    const listKeys = ['symbols', 'markets', 'instruments', 'tickers', 'data', 'result', 'items', 'rows', 'assets', 'contracts', 'pairs', 'list'];
    for (const key of listKeys) {
      const value = node[key];
      if (Array.isArray(value)) visit(value, depth + 1);
      if (value && typeof value === 'object' && !Array.isArray(value)) visit(value, depth + 1);
    }
  };
  visit(payload, 0);
  return out;
};
const extractSymbolFromItem = (item) => {
  if (typeof item === 'string') {
    return normalizeTicker(item);
  }
  if (!item || typeof item !== 'object') return '';

  const direct = readStringField(item, ['symbol', 'ticker', 'market', 'pair', 'instrument', 'instrument_name', 'display_symbol', 'code']);
  if (direct) return normalizeTicker(direct);

  if (item.instrument && typeof item.instrument === 'object') {
    const nested = readStringField(item.instrument, ['symbol', 'ticker', 'market', 'pair']);
    if (nested) return normalizeTicker(nested);
  }

  const base = readStringField(item, ['base', 'base_asset', 'baseAsset', 'underlying']);
  const quote = readStringField(item, ['quote', 'quote_asset', 'quoteAsset', 'settle']);
  if (base && quote) return normalizeTicker(`${base}-${quote}`);
  return '';
};
const quoteAssetFromSymbol = (symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return '';
  const clean = normalized.replace(/[-_/](PERP|SPOT|SWAP|FUTURES|INDEX)$/g, '');

  if (clean.includes('/')) {
    const parts = clean.split('/');
    return parts[1] || '';
  }

  const parts = clean.split(/[-_]/).filter(Boolean);
  if (parts.length > 1) {
    const nonContract = parts.filter((part) => !['PERP', 'SPOT', 'SWAP', 'FUTURES', 'INDEX'].includes(part));
    if (nonContract.length > 1) return nonContract[nonContract.length - 1];
  }

  for (const suffix of SYMBOL_QUOTE_SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length > suffix.length + 1) {
      return suffix;
    }
  }
  return '';
};
const baseAssetFromSymbol = (symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return 'ASSET';
  const clean = normalized.replace(/[-_/](PERP|SPOT|SWAP|FUTURES|INDEX)$/g, '');

  if (clean.includes('/')) {
    return clean.split('/')[0] || clean;
  }

  const parts = clean.split(/[-_]/).filter(Boolean);
  if (parts.length > 0) {
    const nonContract = parts.filter((part) => !['PERP', 'SPOT', 'SWAP', 'FUTURES', 'INDEX'].includes(part));
    if (nonContract.length > 0) {
      const candidate = nonContract[0];
      for (const suffix of SYMBOL_QUOTE_SUFFIXES) {
        if (candidate.endsWith(suffix) && candidate.length > suffix.length + 1) {
          return candidate.slice(0, candidate.length - suffix.length);
        }
      }
      return candidate;
    }
  }

  for (const suffix of SYMBOL_QUOTE_SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length > suffix.length + 1) {
      return clean.slice(0, clean.length - suffix.length);
    }
  }

  if (clean.endsWith('PERP') && clean.length > 4) {
    return clean.slice(0, clean.length - 4).replace(/[-_/]+$/, '');
  }

  return clean;
};
const parseTickerStatsField = (source, keys = []) => {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    const value = toFiniteOrNull(source[key]);
    if (value != null) return value;
  }
  return null;
};
const mergeTickerStatsEntry = (current, incoming) => {
  const prev = current && typeof current === 'object' ? current : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const nextHints = String(next.typeHints || '').trim();
  const prevHints = String(prev.typeHints || '').trim();

  return {
    symbol: normalizeTicker(next.symbol || prev.symbol || ''),
    price: next.price ?? prev.price ?? null,
    change24h: next.change24h ?? prev.change24h ?? null,
    volume24h: next.volume24h ?? prev.volume24h ?? null,
    annFunding: next.annFunding ?? prev.annFunding ?? null,
    typeHints: nextHints || prevHints,
  };
};
const parseTickerStatsItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const symbol = extractSymbolFromItem(item);
  if (!symbol) return null;

  const typeHints = [
    readStringField(item, ['market_type', 'type', 'instrument_type', 'contract_type', 'kind', 'category', 'asset_class', 'segment', 'class']),
    readStringField(item.instrument, ['market_type', 'type', 'instrument_type', 'contract_type', 'kind', 'category', 'asset_class']),
    Array.isArray(item.tags) ? item.tags.join(' ') : '',
    Array.isArray(item.categories) ? item.categories.join(' ') : '',
  ].join(' ').toLowerCase();
  const price = parseTickerStatsField(item, ['price', 'mark_price', 'index_price', 'last_price', 'last', 'current_price']);
  const change24h = parseTickerStatsField(item, ['change_24h', 'change24h', 'price_change_24h', 'change_pct_24h', 'pct_change_24h', 'daily_change_pct']);
  const volume24h = parseTickerStatsField(item, ['volume_24h', 'volume24h', 'volume', 'quote_volume_24h', 'notional_volume_24h']);
  const annFunding = parseTickerStatsField(item, ['ann_funding', 'annualized_funding', 'funding_annualized', 'funding_rate_annualized']);
  const hasMetrics = price != null || change24h != null || volume24h != null || annFunding != null;
  const hasHints = Boolean(typeHints.trim());
  if (!hasMetrics && !hasHints) return null;

  return {
    symbol,
    price,
    change24h,
    volume24h,
    annFunding,
    typeHints,
  };
};
const extractTickerStatsMap = (payload) => {
  const out = {};
  const items = extractSymbolItemsFromPayload(payload);
  for (const item of items) {
    const parsed = parseTickerStatsItem(item);
    if (!parsed?.symbol) continue;
    out[parsed.symbol] = mergeTickerStatsEntry(out[parsed.symbol], parsed);
  }
  return out;
};
const inferTickerLeverage = (symbol) => {
  const base = baseAssetFromSymbol(symbol);
  return SYMBOL_PICKER_LEVERAGE[base] ?? 10;
};
const buildTickerCategoryFlags = (row) => {
  const symbol = normalizeTicker(row?.symbol);
  const baseRaw = baseAssetFromSymbol(symbol);
  const quoteRaw = quoteAssetFromSymbol(symbol);
  const base = normalizeCategoryAsset(baseRaw);
  const quote = normalizeCategoryAsset(quoteRaw);
  const hints = String(row?.typeHints || '').toLowerCase();
  const kind = symbol.includes('PERP') || /(?:perp|swap|future|futures|derivative)/.test(hints) ? 'perp' : 'spot';
  const tag = classifyTickerTag({ symbol, kind, hints, base, quote });

  const isFx = tag === 'forex';
  const isCommodity = tag === 'commodity';
  const isIndex = tag === 'indices';
  const isEquity = tag === 'equity';
  const isMeme = tag === 'meme';
  const isDefi = tag === 'defi';
  const isPerp = kind === 'perp';
  const isSpot = kind === 'spot';
  // Keep "Chains" useful: all unclassified crypto markets fall back here.
  const isChain = tag === 'chain' || tag === kind;

  return { isPerp, isSpot, isMeme, isDefi, isChain, isCommodity, isEquity, isFx, isIndex };
};
const matchesTickerPickerTab = (row, tab) => {
  if (tab === 'All') return true;
  const flags = buildTickerCategoryFlags(row);
  if (tab === 'Perps') return flags.isPerp;
  if (tab === 'Spot') return flags.isSpot;
  if (tab === 'Memes') return flags.isMeme;
  if (tab === 'DeFi') return flags.isDefi;
  if (tab === 'Chains') return flags.isChain;
  if (tab === 'Commodities') return flags.isCommodity;
  if (tab === 'Equities') return flags.isEquity;
  if (tab === 'FX') return flags.isFx;
  if (tab === 'Indices') return flags.isIndex;
  return false;
};

const symbolToDisplayPair = (symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return '---';
  return baseAssetFromSymbol(normalized);
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

const currentHttpOrigin = () => {
  if (typeof window === 'undefined') return null;
  const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
  return `${scheme}://${window.location.host}`;
};

const currentWsOrigin = () => {
  if (typeof window === 'undefined') return null;
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}`;
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
  return currentHttpOrigin();
};

const buildChartWsUrl = (symbol, tf) => {
  const safeSymbol = encodeURIComponent(symbol);
  const tfValue = encodeURIComponent(chartTfToApiValue(tf));
  const query = `tf=${tfValue}&limit=500`;

  if (CHART_WS_BASE) {
    return `${CHART_WS_BASE.replace(/\/+$/, '')}/ws/v1/candles/${safeSymbol}?${query}`;
  }
  const origin = currentWsOrigin();
  return origin ? `${origin}/ws/v1/candles/${safeSymbol}?${query}` : null;
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
    const quoteSize = size * price;
    const quoteTotal = total * price;
    return {
      id: `${price}-${size}-${idx}`,
      price,
      size,
      total,
      quoteSize,
      quoteTotal,
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
  let cumulativeQuote = 0;
  return rows.map((row, idx) => {
    cumulative += row.size;
    cumulativeQuote += row.size * row.price;
    return {
      id: `${side}-${row.price}-${idx}`,
      price: row.price,
      size: row.size,
      total: cumulative,
      quoteSize: row.size * row.price,
      quoteTotal: cumulativeQuote,
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
  const origin = currentWsOrigin();
  return origin ? `${origin}/ws/v1/orderbook/${safeSymbol}` : null;
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
  return currentHttpOrigin();
};

const buildMarketsHttpBase = () => {
  if (MARKETS_HTTP_BASE) {
    return MARKETS_HTTP_BASE.replace(/\/+$/, '');
  }
  if (MARKETS_WS_BASE) {
    try {
      const url = new URL(MARKETS_WS_BASE);
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.origin;
    } catch {
      return null;
    }
  }
  return currentHttpOrigin();
};

const fetchSymbolsPayloadFromBase = async (base, signal) => {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  if (!normalizedBase) return null;

  const endpoints = ['/markets/snapshot', '/symbols'];
  for (const endpoint of endpoints) {
    const response = await fetch(`${normalizedBase}${endpoint}`, { signal });
    if (!response.ok) continue;
    return response.json();
  }

  return null;
};

const extractSymbolsFromPayload = (payload) => {
  const items = extractSymbolItemsFromPayload(payload);
  const out = [];
  for (const item of items) {
    const symbol = extractSymbolFromItem(item);
    if (!symbol) continue;
    out.push(symbol);
  }
  return out;
};

const extractMarketRowsFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.markets)) return payload.markets;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const extractMarketMetaLookupFromPayload = (payload) => {
  const out = {};
  const rows = extractMarketRowsFromPayload(payload);

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const symbol = normalizeTicker(
      row.symbol
      ?? row.ticker_id
      ?? row.tickerId
      ?? row.market
      ?? row.pair
      ?? '',
    );
    if (!symbol) continue;

    const rawProductId = row.product_id ?? row.productId;
    const productId = Number(rawProductId);
    if (!Number.isFinite(productId) || productId < 0) continue;

    out[symbol] = {
      symbol,
      productId,
      marketType: String(row.market_type ?? row.marketType ?? '').toLowerCase(),
      base: readStringField(row, ['base', 'base_asset', 'baseAsset']),
      quote: readStringField(row, ['quote', 'quote_asset', 'quoteAsset']),
      price: toFiniteOrNull(row.price),
      markPrice: toFiniteOrNull(row.mark_price ?? row.markPrice),
      indexPrice: toFiniteOrNull(row.index_price ?? row.indexPrice),
      updatedAt: toFiniteOrNull(row.updated_at ?? row.updatedAt),
    };
  }

  return out;
};

const resolveMarketMetaForSymbol = (lookup, symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!normalized || !lookup || typeof lookup !== 'object') return null;
  if (lookup[normalized]) return lookup[normalized];

  const base = normalizeTicker(baseAssetFromSymbol(normalized));
  if (!base) return null;

  const values = Object.values(lookup);
  const perpCandidate = values.find((meta) => {
    const mBase = normalizeTicker(meta?.base || baseAssetFromSymbol(meta?.symbol));
    if (!mBase || mBase !== base) return false;
    const kind = String(meta?.marketType || '').toLowerCase();
    return kind.includes('perp') || kind.includes('swap') || kind.includes('future');
  });
  if (perpCandidate) return perpCandidate;

  return values.find((meta) => {
    const mBase = normalizeTicker(meta?.base || baseAssetFromSymbol(meta?.symbol));
    return mBase && mBase === base;
  }) ?? null;
};

const SYMBOL_LOOKUP_CHUNK = 64;

const resolveProductIdViaClient = async (client, symbol) => {
  const normalized = normalizeTicker(symbol);
  if (!client || !normalized) return null;

  const markets = await client.market.getAllMarkets();
  const productIds = markets
    .map((row) => Number(row?.productId))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (productIds.length === 0) return null;

  const symbolsByProductId = {};
  for (let index = 0; index < productIds.length; index += SYMBOL_LOOKUP_CHUNK) {
    const slice = productIds.slice(index, index + SYMBOL_LOOKUP_CHUNK);
    try {
      const result = await client.context.engineClient.getSymbols({ productIds: slice });
      const rows = result?.symbols ?? {};
      for (const [key, value] of Object.entries(rows)) {
        const productId = Number(value?.productId ?? key);
        const rowSymbol = normalizeTicker(value?.symbol ?? value?.ticker ?? '');
        if (!rowSymbol || !Number.isFinite(productId)) continue;
        symbolsByProductId[productId] = rowSymbol;
        if (rowSymbol === normalized) return productId;
      }
    } catch {
      // continue with next chunk
    }
  }

  const targetBase = normalizeTicker(baseAssetFromSymbol(normalized));
  if (!targetBase) return null;
  for (const [pid, rowSymbol] of Object.entries(symbolsByProductId)) {
    const rowBase = normalizeTicker(baseAssetFromSymbol(rowSymbol));
    if (rowBase === targetBase && rowSymbol.includes('PERP')) {
      return Number(pid);
    }
  }
  return null;
};

const resolveSymbolIncrementsX18ViaClient = async (client, productId) => {
  const safeProductId = Number(productId);
  if (!client || !Number.isFinite(safeProductId) || safeProductId < 0) {
    return { priceIncrementX18: null, sizeIncrementX18: null };
  }

  try {
    const response = await client.context.engineClient.getSymbols({
      productIds: [safeProductId],
    });
    const symbols = response?.symbols ?? {};
    const row = Object.values(symbols).find(
      (entry) => Number(entry?.productId) === safeProductId,
    );
    if (!row) return { priceIncrementX18: null, sizeIncrementX18: null };

    const rawPriceIncrement =
      typeof row?.priceIncrement?.toFixed === 'function'
        ? row.priceIncrement.toFixed()
        : String(row?.priceIncrement ?? '');
    const normalizedPriceIncrement = String(rawPriceIncrement || '').trim();

    const rawSizeIncrement =
      typeof row?.sizeIncrement?.toFixed === 'function'
        ? row.sizeIncrement.toFixed(0)
        : String(row?.sizeIncrement ?? '');
    const normalizedSizeIncrement = String(rawSizeIncrement || '').trim();

    let priceIncrementX18 = null;
    if (normalizedPriceIncrement) {
      const parsed = parseUnits(normalizedPriceIncrement, 18);
      if (parsed > 0n) priceIncrementX18 = parsed;
    }

    let sizeIncrementX18 = null;
    if (normalizedSizeIncrement) {
      const parsed = BigInt(normalizedSizeIncrement);
      if (parsed > 0n) sizeIncrementX18 = parsed;
    }

    return { priceIncrementX18, sizeIncrementX18 };
  } catch {
    return { priceIncrementX18: null, sizeIncrementX18: null };
  }
};

const alignPriceToIncrementX18 = (priceX18, incrementX18) => {
  if (incrementX18 == null || incrementX18 <= 0n) return priceX18;
  if (priceX18 <= 0n) return priceX18;

  const remainder = priceX18 % incrementX18;
  if (remainder === 0n) return priceX18;

  const down = priceX18 - remainder;
  const up = down + incrementX18;
  const distanceDown = priceX18 - down;
  const distanceUp = up - priceX18;
  return distanceDown <= distanceUp ? down : up;
};

const alignAmountToIncrementX18 = (amountX18, incrementX18) => {
  if (incrementX18 == null || incrementX18 <= 0n) return amountX18;
  if (amountX18 <= 0n) return amountX18;
  return amountX18 - (amountX18 % incrementX18);
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
    const bases = Array.from(new Set([
      buildMarketsHttpBase(),
      buildOrderbookHttpBase(),
      buildChartHttpBase(),
    ].filter(Boolean)));
    if (bases.length === 0) return () => controller.abort();

    const load = async () => {
      const tasks = bases.map(async (base) => {
        const payload = await fetchSymbolsPayloadFromBase(base, controller.signal);
        if (!payload) return [];
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

const useMarketMetaLookup = () => {
  const [lookup, setLookup] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    const base = buildMarketsHttpBase();
    if (!base) return () => controller.abort();

    const load = async () => {
      const payload = await fetchSymbolsPayloadFromBase(base, controller.signal);
      if (!payload) return;
      const next = extractMarketMetaLookupFromPayload(payload);
      if (Object.keys(next).length === 0) return;
      setLookup((prev) => ({ ...prev, ...next }));
    };

    load().catch(() => {
      // optional for order entry
    });

    const timer = window.setInterval(() => {
      load().catch(() => {
        // keep last snapshot
      });
    }, ORDER_ENTRY_MARKET_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return lookup;
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

const ChartWidget = ({
  onClose,
  locked,
  symbol,
  availableSymbols = [],
  onSymbolChange,
  nadoAppOrigin = null,
  pinned,
  onTogglePin,
}) => {
  const [tf, setTf] = useState(() => {
    const stored = readTerminalPrefs();
    const savedTf = stored?.chart?.[normalizeTicker(symbol)]?.tf;
    return CHART_TF_OPTIONS.includes(savedTf) ? savedTf : '1h';
  });
  const { candles, status, detail } = useChartCandles(symbol, tf);
  const statusStyle = CHART_STATUS_STYLES[status] || CHART_STATUS_STYLES.idle;
  const statusText = formatStatusText(status);
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
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [symbolPickerQuery, setSymbolPickerQuery] = useState('');
  const [symbolPickerTab, setSymbolPickerTab] = useState('All');
  const [tickerStats, setTickerStats] = useState({});
  const symbolPickerRef = useRef(null);
  const symbolTriggerRef = useRef(null);

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
  const normalizedActiveSymbol = normalizeTicker(symbol);
  const formatPickerNumber = useCallback(
    (value) => (value == null || !Number.isFinite(value) || value <= 0 ? '--' : CHART_PRICE_FMT.format(value)),
    [],
  );
  const formatPickerChange = useCallback(
    (value) =>
      (value == null || !Number.isFinite(value) || Math.abs(value) < 0.0000001
        ? '--'
        : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`),
    [],
  );
  const formatPickerVolume = useCallback(
    (value) =>
      (value == null || !Number.isFinite(value) || value <= 0
        ? '--'
        : CHART_VOL_FMT.format(value)),
    [],
  );
  const symbolUniverse = useMemo(
    () => normalizeTickerList([...availableSymbols, ...Object.keys(tickerStats)], normalizedActiveSymbol),
    [availableSymbols, tickerStats, normalizedActiveSymbol],
  );
  const symbolRows = useMemo(() => {
    return symbolUniverse
      .map((entry, idx) => {
        const normalized = normalizeTicker(entry);
        if (!normalized) return null;
        const base = baseAssetFromSymbol(normalized);
        const stats = tickerStats[normalized] || {};
        const price = normalized === normalizedActiveSymbol && lastPrice != null ? lastPrice : stats.price;
        const dayChange = normalized === normalizedActiveSymbol && changePct != null ? changePct : stats.change24h;
        const draft = {
          symbol: normalized,
          typeHints: stats.typeHints || '',
        };
        const flags = buildTickerCategoryFlags(draft);
        return {
          id: `${normalized}-${idx}`,
          symbol: normalized,
          base,
          flags,
          leverage: inferTickerLeverage(normalized),
          price,
          change24h: dayChange,
          volume24h: stats.volume24h ?? null,
          annFunding: stats.annFunding ?? null,
          typeHints: stats.typeHints || '',
        };
      })
      .filter((row) => row && row.price != null && Number.isFinite(row.price));
  }, [symbolUniverse, tickerStats, normalizedActiveSymbol, lastPrice, changePct]);
  const filteredSymbolRows = useMemo(() => {
    const query = symbolPickerQuery.trim().toUpperCase();
    return symbolRows.filter((row) => {
      if (!matchesTickerPickerTab(row, symbolPickerTab)) return false;
      if (!query) return true;
      return row.base.includes(query) || row.symbol.includes(query);
    });
  }, [symbolRows, symbolPickerTab, symbolPickerQuery]);

  useEffect(() => {
    const stored = readTerminalPrefs();
    const savedTf = stored?.chart?.[normalizeTicker(symbol)]?.tf;
    setTf(CHART_TF_OPTIONS.includes(savedTf) ? savedTf : '1h');
  }, [symbol]);

  useEffect(() => {
    const normalizedSymbol = normalizeTicker(symbol);
    if (!normalizedSymbol) return;
    updateTerminalPrefs((current) => ({
      ...current,
      chart: {
        ...(current.chart || {}),
        [normalizedSymbol]: {
          ...(current.chart?.[normalizedSymbol] || {}),
          tf,
        },
      },
    }));
  }, [symbol, tf]);

  useEffect(() => {
    setSelectedBar(null);
  }, [symbol, tf]);

  useEffect(() => {
    setTfMenuOpen(false);
    setSymbolPickerOpen(false);
    setSymbolPickerQuery('');
    setSymbolPickerTab('All');
  }, [symbol, tf]);

  useEffect(() => {
    const controller = new AbortController();
    const bases = Array.from(new Set([
      buildMarketsHttpBase(),
      buildOrderbookHttpBase(),
      buildChartHttpBase(),
    ].filter(Boolean)));
    if (bases.length === 0) return () => controller.abort();

    const loadTickerStats = async () => {
      const tasks = bases.map(async (base) => {
        const payload = await fetchSymbolsPayloadFromBase(base, controller.signal);
        if (!payload) return {};
        return extractTickerStatsMap(payload);
      });
      const settled = await Promise.allSettled(tasks);
      const next = {};
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const [symbolKey, stats] of Object.entries(result.value || {})) {
          next[symbolKey] = mergeTickerStatsEntry(next[symbolKey], stats);
        }
      }
      if (Object.keys(next).length > 0) {
        setTickerStats((prev) => {
          const merged = { ...prev };
          for (const [symbolKey, stats] of Object.entries(next)) {
            merged[symbolKey] = mergeTickerStatsEntry(merged[symbolKey], stats);
          }
          return merged;
        });
      }
    };

    loadTickerStats().catch(() => {
      // fallback with symbol-only list
    });
    const refreshMs = symbolPickerOpen ? 3_000 : 10_000;
    const refreshTimer = window.setInterval(() => {
      loadTickerStats().catch(() => {
        // keep previous stats on refresh failures
      });
    }, refreshMs);

    return () => {
      window.clearInterval(refreshTimer);
      controller.abort();
    };
  }, [symbolPickerOpen]);

  useEffect(() => {
    if (!tfMenuOpen && !symbolPickerOpen) return () => {};

    const onPointerDown = (event) => {
      const insideTfMenu = tfMenuRef.current?.contains(event.target);
      const insideSymbolPicker = symbolPickerRef.current?.contains(event.target);
      const insideSymbolTrigger = symbolTriggerRef.current?.contains(event.target);
      if (insideTfMenu || insideSymbolPicker || insideSymbolTrigger) return;
      setTfMenuOpen(false);
      setSymbolPickerOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setTfMenuOpen(false);
        setSymbolPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [tfMenuOpen, symbolPickerOpen]);

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

  const chartTitle = (
    <button
      ref={symbolTriggerRef}
      type="button"
      onMouseDown={nodrag}
      onClick={() => {
        setTfMenuOpen(false);
        setSymbolPickerOpen((prev) => !prev);
      }}
      className="inline-flex h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[20px] font-semibold leading-none text-slate-100 transition-colors hover:bg-violet-400/[0.12]"
      aria-haspopup="dialog"
      aria-expanded={symbolPickerOpen}
      aria-label="Open ticker selector"
    >
      <Web3TokenIcon
        symbol={symbol}
        seed={symbol}
        size={32}
        className="h-8 w-8 shrink-0"
        nadoAppOrigin={nadoAppOrigin}
      />
      <span className="font-mono">{symbolToDisplayPair(symbol)}</span>
      <ChevronDown className={`h-[18px] w-[18px] text-slate-400 transition-transform ${symbolPickerOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className={`${WIDGET_SHELL_CLASS} relative`}>
      <WH
        icon={BarChart3}
        showIcon={false}
        title={chartTitle}
        onClose={onClose}
        locked={locked}
        pinned={pinned}
        onTogglePin={onTogglePin}
        extra={(
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-mono text-xs font-bold" style={changeStyle}>{changeText}</span>
            {statusText && (
              <span className={`font-mono text-[10px] ${statusStyle.text}`}>
                {statusText}
              </span>
            )}
          </div>
        )}
      />
      {symbolPickerOpen && (
        <div
          ref={symbolPickerRef}
          onMouseDown={nodrag}
          className={`absolute left-2 top-[42px] z-[70] w-[min(680px,calc(100%-1rem))] overflow-hidden rounded-xl border ${C.border} bg-[rgba(9,11,27,0.98)] shadow-[0_16px_42px_rgba(0,0,0,0.6)]`}
        >
          <div className={`border-b ${C.bRow} px-2.5 py-2`}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={symbolPickerQuery}
                onChange={(event) => setSymbolPickerQuery(event.target.value)}
                placeholder="Search"
                className="h-8 w-full rounded-md bg-white/[0.06] pl-8 pr-2 font-mono text-[12px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:bg-white/[0.08]"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {SYMBOL_PICKER_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSymbolPickerTab(tab)}
                  className={`rounded-md px-2 py-1 text-[12px] transition-colors ${
                    symbolPickerTab === tab
                      ? 'bg-white/[0.10] text-slate-100'
                      : 'bg-white/[0.05] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className={`grid grid-cols-[34px_2fr_1fr_1fr_1fr_1fr] items-center border-b ${C.bRow} px-2 py-1.5 text-[11px] text-slate-500`}>
            <div className="text-center">
              <Star className="mx-auto h-3 w-3" />
            </div>
            <div>Market</div>
            <div className="text-right">Current Price</div>
            <div className="text-right">24h Change</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Ann. Funding</div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {filteredSymbolRows.length > 0 ? (
              filteredSymbolRows.map((row) => {
                const changeStyleRow =
                  row.change24h == null || !Number.isFinite(row.change24h)
                    ? 'text-slate-500'
                    : row.change24h >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300';
                const fundingStyleRow =
                  row.annFunding == null || !Number.isFinite(row.annFunding)
                    ? 'text-slate-500'
                    : row.annFunding >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300';
                const marketTag = row.flags.isPerp
                  ? 'Perp'
                  : row.flags.isFx
                    ? 'FX'
                    : row.flags.isCommodity
                      ? 'Commodity'
                      : row.flags.isEquity
                        ? 'Equity'
                        : row.flags.isIndex
                          ? 'Index'
                          : row.flags.isSpot
                            ? 'Spot'
                            : 'Market';
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onSymbolChange?.(row.symbol);
                      setSymbolPickerOpen(false);
                    }}
                    className={`grid w-full grid-cols-[34px_2fr_1fr_1fr_1fr_1fr] items-center px-2 py-2 text-[12px] transition-colors ${
                      row.symbol === normalizedActiveSymbol
                        ? 'bg-violet-400/[0.12]'
                        : 'hover:bg-violet-400/[0.06]'
                    }`}
                  >
                    <div className="text-center text-slate-500">
                      <Star className="mx-auto h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <Web3TokenIcon
                        symbol={row.symbol}
                        seed={row.symbol}
                        size={28}
                        className="h-7 w-7"
                        nadoAppOrigin={nadoAppOrigin}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-slate-100">{row.base}</div>
                        <div className="mt-0.5 inline-flex items-center justify-start gap-1 text-[10px] text-slate-500">
                          {row.flags.isPerp && <span className="rounded bg-white/[0.08] px-1 py-[1px]">{`${row.leverage}x`}</span>}
                          <span className="rounded bg-white/[0.08] px-1 py-[1px]">{marketTag}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-slate-100">{formatPickerNumber(row.price)}</div>
                    <div className={`text-right font-mono ${changeStyleRow}`}>{formatPickerChange(row.change24h)}</div>
                    <div className="text-right font-mono text-slate-200">{formatPickerVolume(row.volume24h)}</div>
                    <div className={`text-right font-mono ${fundingStyleRow}`}>{formatPickerChange(row.annFunding)}</div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-[12px] text-slate-500">No symbols in this category.</div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bg} px-3 py-1`}>
          <div ref={tfMenuRef} className="relative">
            <button
              type="button"
              onMouseDown={nodrag}
              onClick={() => {
                setSymbolPickerOpen(false);
                setTfMenuOpen((prev) => !prev);
              }}
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
          <div className="font-mono text-[10px] text-slate-500">{symbol}</div>
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

const BookRow = React.memo(({ r, side, maxTotal }) => (
  <div
    className="group relative flex min-h-[30px] items-center px-3 py-[5px] hover:bg-slate-800/30"
    style={{ contentVisibility: 'auto', containIntrinsicSize: '30px' }}
  >
    <div
      className={`absolute left-0 top-0 h-full ${side === 'ask' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}
      style={{ width: `${maxTotal > 0 ? Math.min(100, (r.total / maxTotal) * 100) : 0}%` }}
    />
    <div className="relative z-10 w-[44%] font-mono text-[16px] font-bold tracking-[0.01em]" style={side === 'ask' ? C.redGlow : C.greenGlow}>{r.priceText}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[15px] font-semibold text-slate-200">{r.sizeText}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[15px] font-semibold text-slate-400">{r.totalText}</div>
  </div>
));
BookRow.displayName = 'BookRow';

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

const OrderbookTradeRow = React.memo(({ trade }) => {
  const sideStyle =
    trade.side === 'buy'
      ? C.greenGlow
      : trade.side === 'sell'
        ? C.redGlow
        : C.blueGlow;

  return (
    <div
      className="grid grid-cols-[36%_32%_32%] items-center px-3 py-[3px] hover:bg-slate-800/30"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '22px' }}
    >
      <div className="font-mono text-[11px] text-slate-400">{trade.timeText}</div>
      <div className="text-right font-mono text-[12px]" style={sideStyle}>{trade.priceText}</div>
      <div className="text-right font-mono text-[12px] text-slate-300">{trade.sizeText}</div>
    </div>
  );
});
OrderbookTradeRow.displayName = 'OrderbookTradeRow';

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
const formatOrderbookQuoteTotal = (value) => ORDERBOOK_QUOTE_FMT.format(Math.max(0, toFiniteNumber(value)));

const OrderBookWidget = ({ onClose, locked, symbol, pinned, onTogglePin }) => {
  const { asks, bids, recentTrades, status, detail, markPrice } = useOrderbookStream(symbol);
  const [activeTab, setActiveTab] = useState('book');
  const [depthView, setDepthView] = useState('both');
  const [priceStep, setPriceStep] = useState(1);
  const [priceStepMenuOpen, setPriceStepMenuOpen] = useState(false);
  const [totalUnit, setTotalUnit] = useState('base');
  const [totalUnitMenuOpen, setTotalUnitMenuOpen] = useState(false);
  const priceStepMenuRef = useRef(null);
  const totalUnitMenuRef = useRef(null);
  const askScrollRef = useRef(null);
  const bidScrollRef = useRef(null);
  const prevMarkRef = useRef(null);
  const [markTrend, setMarkTrend] = useState('flat');
  const statusStyle = ORDERBOOK_STATUS_STYLES[status] || ORDERBOOK_STATUS_STYLES.idle;
  const statusText = formatStatusText(status);
  const baseAsset = baseAssetFromSymbol(symbol);
  const totalUnitLabel = totalUnit === 'usdt0' ? 'USDT0' : (baseAsset || 'BASE');
  const totalUnitOptions = useMemo(
    () => [
      { id: 'base', label: baseAsset || 'BASE' },
      { id: 'usdt0', label: 'USDT0' },
    ],
    [baseAsset],
  );
  const useQuoteTotal = totalUnit === 'usdt0';

  const asksAggregated = useMemo(() => aggregateBookSide(asks, 'ask', priceStep), [asks, priceStep]);
  const bidsAggregated = useMemo(() => aggregateBookSide(bids, 'bid', priceStep), [bids, priceStep]);
  const askRows = useMemo(() => {
    const rows = [...asksAggregated].reverse();
    if (!useQuoteTotal) return rows;
    return rows.map((row) => ({
      ...row,
      total: row.quoteTotal,
      totalText: formatOrderbookQuoteTotal(row.quoteTotal),
    }));
  }, [asksAggregated, useQuoteTotal]);
  const bidRows = useMemo(() => {
    if (!useQuoteTotal) return bidsAggregated;
    return bidsAggregated.map((row) => ({
      ...row,
      total: row.quoteTotal,
      totalText: formatOrderbookQuoteTotal(row.quoteTotal),
    }));
  }, [bidsAggregated, useQuoteTotal]);
  const visibleAskRows = depthView === 'bids' ? [] : askRows;
  const visibleBidRows = depthView === 'asks' ? [] : bidRows;
  const maxAskTotal = useMemo(
    () => visibleAskRows.reduce((acc, row) => Math.max(acc, row.total), 0),
    [visibleAskRows],
  );
  const maxBidTotal = useMemo(
    () => visibleBidRows.reduce((acc, row) => Math.max(acc, row.total), 0),
    [visibleBidRows],
  );
  const tradesRows = useMemo(
    () => (Array.isArray(recentTrades) ? recentTrades.slice(0, ORDERBOOK_TRADES_DISPLAY) : []),
    [recentTrades],
  );

  const centerPrice = useMemo(() => {
    if (markPrice != null && Number.isFinite(markPrice)) return markPrice;
    return calcMarkPrice(asks, bids);
  }, [asks, bids, markPrice]);
  const priceStepOptions = useMemo(
    () => buildOrderbookStepOptions(asks, bids, centerPrice),
    [asks, bids, centerPrice],
  );
  const totalLabel = totalUnit === 'usdt0' ? 'Total USDT0' : (baseAsset ? `Total ${baseAsset}` : 'Total');
  const markText = centerPrice == null ? '--' : formatBookPrice(centerPrice);
  const markStyle = markTrend === 'up' ? C.greenGlow : markTrend === 'down' ? C.redGlow : C.blueGlow;
  const markIcon = markTrend === 'up'
    ? <ChevronUp className="h-3.5 w-3.5 text-emerald-300" />
    : markTrend === 'down'
      ? <ChevronDown className="h-3.5 w-3.5 text-rose-300" />
      : null;

  useEffect(() => {
    const normalizedSymbol = normalizeTicker(symbol);
    const stored = readTerminalPrefs();
    const savedPrefs = stored?.orderbook?.[normalizedSymbol] || {};

    setActiveTab(savedPrefs.activeTab === 'trades' ? 'trades' : 'book');
    setDepthView(ORDERBOOK_DEPTH_VIEWS.includes(savedPrefs.depthView) ? savedPrefs.depthView : 'both');

    const savedStep = toFiniteOrNull(savedPrefs.priceStep);
    setPriceStep(savedStep != null && savedStep > 0 ? savedStep : 1);
    setTotalUnit(normalizeOrderbookTotalUnit(savedPrefs.totalUnit));
    setPriceStepMenuOpen(false);
    setTotalUnitMenuOpen(false);
    setMarkTrend('flat');
    prevMarkRef.current = null;
  }, [symbol]);

  useEffect(() => {
    const normalizedSymbol = normalizeTicker(symbol);
    if (!normalizedSymbol) return;
    updateTerminalPrefs((current) => ({
      ...current,
      orderbook: {
        ...(current.orderbook || {}),
        [normalizedSymbol]: {
          ...(current.orderbook?.[normalizedSymbol] || {}),
          activeTab,
          depthView,
          priceStep,
          totalUnit,
        },
      },
    }));
  }, [symbol, activeTab, depthView, priceStep, totalUnit]);

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
      setTotalUnitMenuOpen(false);
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
    const askEl = askScrollRef.current;
    if (askEl) {
      askEl.scrollTop = askEl.scrollHeight;
    }
    const bidEl = bidScrollRef.current;
    if (bidEl) {
      bidEl.scrollTop = 0;
    }
  }, [symbol, depthView, priceStep, activeTab]);

  useEffect(() => {
    if (!priceStepMenuOpen && !totalUnitMenuOpen) return () => {};

    const onPointerDown = (event) => {
      const insideStepMenu = priceStepMenuRef.current?.contains(event.target);
      const insideTotalMenu = totalUnitMenuRef.current?.contains(event.target);
      if (insideStepMenu || insideTotalMenu) return;
      setPriceStepMenuOpen(false);
      setTotalUnitMenuOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPriceStepMenuOpen(false);
        setTotalUnitMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [priceStepMenuOpen, totalUnitMenuOpen]);

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={AlignLeft}
        title="Order Book"
        onClose={onClose}
        locked={locked}
        pinned={pinned}
        onTogglePin={onTogglePin}
        extra={(
          <div className="hidden items-center gap-2 md:flex">
            {statusText && (
              <span className={`font-mono text-[10px] ${statusStyle.text}`}>
                {statusText}
              </span>
            )}
          </div>
        )}
      />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`shrink-0 border-b ${C.bRow} ${C.bg} px-2.5 py-1.5`}>
          <div className="overflow-visible rounded-md bg-[rgba(12,15,34,0.86)]">
            <div className="flex items-center justify-between px-1.5 py-1.5">
              <div className="inline-flex items-center rounded-md bg-[rgba(17,19,40,0.72)] p-0.5">
                <button
                  type="button"
                  onMouseDown={nodrag}
                  onClick={() => setActiveTab('book')}
                  className={`min-w-[64px] rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                  className={`min-w-[64px] rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeTab === 'trades'
                      ? 'bg-white/[0.08] text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Trades
                </button>
              </div>
              {statusText && (
                <span className={`font-mono text-[10px] ${statusStyle.text}`}>
                  {statusText}
                </span>
              )}
            </div>
            {activeTab === 'book' && (
              <div className={`flex items-center justify-between border-t ${C.bRow} px-1.5 py-1.5`}>
                <div className="inline-flex items-center gap-1 rounded-md bg-[rgba(16,18,36,0.60)] p-0.5">
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
                      onClick={() => {
                        setTotalUnitMenuOpen(false);
                        setPriceStepMenuOpen((prev) => !prev);
                      }}
                      className="flex min-w-[56px] items-center justify-between gap-1 rounded-md bg-[rgba(20,22,45,0.62)] px-2 py-1 font-mono text-[11px] text-slate-100 transition-colors"
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
                  <div ref={totalUnitMenuRef} className="relative">
                    <button
                      type="button"
                      onMouseDown={nodrag}
                      onClick={() => {
                        setPriceStepMenuOpen(false);
                        setTotalUnitMenuOpen((prev) => !prev);
                      }}
                      className="flex min-w-[64px] items-center justify-between gap-1 rounded-md bg-[rgba(20,22,45,0.62)] px-2 py-1 font-mono text-[11px] text-slate-100 transition-colors"
                      aria-haspopup="listbox"
                      aria-expanded={totalUnitMenuOpen}
                      aria-label="Order book total unit"
                    >
                      <span>{totalUnitLabel}</span>
                      <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${totalUnitMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {totalUnitMenuOpen && (
                      <div
                        onMouseDown={nodrag}
                        role="listbox"
                        aria-label="Order book total unit"
                        className={`absolute right-0 top-full z-30 mt-1 w-20 overflow-hidden rounded-md border ${C.bRow} bg-[rgba(10,12,30,0.96)] shadow-[0_10px_28px_rgba(0,0,0,0.45)]`}
                      >
                        {totalUnitOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={option.id === totalUnit}
                            onClick={() => {
                              setTotalUnit(option.id);
                              setTotalUnitMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-center px-2 py-1.5 font-mono text-[11px] transition-colors ${
                              option.id === totalUnit
                                ? 'bg-violet-400/18 text-violet-100'
                                : 'text-slate-300 hover:bg-violet-400/10 hover:text-violet-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              {depthView !== 'both' && (
                <div className={`flex shrink-0 items-center border-y ${C.bRow} bg-violet-400/[0.05] px-3 py-1.5`}>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm font-bold" style={markStyle}>{markText}</span>
                    {markIcon}
                  </div>
                </div>
              )}
              {depthView !== 'bids' && (
                <div ref={askScrollRef} className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-0.5">
                  {visibleAskRows.length > 0 ? (
                    visibleAskRows.map((row) => <BookRow key={`ask-${row.id}`} r={row} side="ask" maxTotal={maxAskTotal} />)
                  ) : (
                    <div className="px-3 py-2 text-[11px] text-slate-500">Waiting for asks...</div>
                  )}
                </div>
              )}
              {depthView === 'both' && (
                <div className={`flex shrink-0 items-center border-y ${C.bRow} bg-violet-400/[0.05] px-3 py-1.5`}>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm font-bold" style={markStyle}>{markText}</span>
                    {markIcon}
                  </div>
                </div>
              )}
              {depthView !== 'asks' && (
                <div ref={bidScrollRef} className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-0.5">
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
const AI_ASSISTANT_REPLY_DELAY_MS = 1200;
const AI_ASSISTANT_TYPING_STEP_MS = 28;
const AI_ASSISTANT_TYPING_STEP_CHARS = 2;
const AI_ASSISTANT_DEFAULT_SYMBOL = 'BTC-PERP';
const AI_ASSISTANT_DEFAULT_TF = '15m';
const AI_ASSISTANT_CANDLES_LIMIT = 32;
const AI_ASSISTANT_PRICE_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const AI_ASSISTANT_PCT_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const AI_ASSISTANT_TF_BY_MINUTES = {
  1: '1m',
  5: '5m',
  15: '15m',
  60: '1h',
  120: '2h',
  240: '4h',
  1440: '1d',
};

const formatAiSignedPct = (value) => {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${AI_ASSISTANT_PCT_FMT.format(value)}%`;
};

const formatAiUtcTime = (bucketStart) => {
  if (!Number.isFinite(bucketStart) || bucketStart <= 0) return '--:--';
  const iso = new Date(Math.trunc(bucketStart) * 1000).toISOString();
  return iso.slice(11, 16);
};

const calcCandleRangePct = (candle) => {
  const open = toFiniteOrNull(candle?.open);
  const high = toFiniteOrNull(candle?.high);
  const low = toFiniteOrNull(candle?.low);
  if (open == null || high == null || low == null || open <= 0) return 0;
  return ((high - low) / open) * 100;
};

const normalizeAiSymbol = (raw, fallbackSymbol = AI_ASSISTANT_DEFAULT_SYMBOL) => {
  const source = String(raw ?? '').trim().toUpperCase().replace(/^[#$]/, '');
  const fallback = String(fallbackSymbol ?? AI_ASSISTANT_DEFAULT_SYMBOL).trim().toUpperCase();
  let next = source || fallback || AI_ASSISTANT_DEFAULT_SYMBOL;
  if (next.endsWith('PERP') && !next.includes('-')) {
    next = `${next.slice(0, -4)}-PERP`;
  }
  if (!next.includes('-')) {
    next = `${next}-PERP`;
  }
  next = next.replace(/[^A-Z0-9-]/g, '');
  if (!/^[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(next)) {
    return AI_ASSISTANT_DEFAULT_SYMBOL;
  }
  return next;
};

const nearestSupportedTf = (minutes) => {
  const targets = Object.keys(AI_ASSISTANT_TF_BY_MINUTES).map(Number);
  let best = targets[0];
  let bestDistance = Math.abs(minutes - best);
  for (const candidate of targets) {
    const distance = Math.abs(minutes - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return AI_ASSISTANT_TF_BY_MINUTES[best];
};

const normalizeAiTimeframe = (raw) => {
  const value = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!value) return null;
  if (value === 'daily' || value === 'day' || value === '1d') return '1d';
  const match = value.match(/^(\d+)(m|min|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2];
  let minutes = amount;
  if (unit === 'h') minutes = amount * 60;
  if (unit === 'd') minutes = amount * 1440;
  return nearestSupportedTf(minutes);
};

const extractRequestedTimeframe = (input) => {
  const source = String(input ?? '');
  const explicit = source.match(/\b(\d+\s*(?:m|min|h|d)|daily|day)\b/i);
  const normalized = normalizeAiTimeframe(explicit?.[1]);
  return normalized || AI_ASSISTANT_DEFAULT_TF;
};

const inferAiBias = ({ bodyPct, momentumPct, sessionChangePct }) => {
  if (bodyPct >= 0.15 && momentumPct >= 0.1 && sessionChangePct >= 0) {
    return 'Bullish pressure with continuation risk to the upside.';
  }
  if (bodyPct <= -0.15 && momentumPct <= -0.1 && sessionChangePct <= 0) {
    return 'Bearish pressure with continuation risk to the downside.';
  }
  return 'Neutral structure; market is still balancing.';
};

const inferAiVolatilityState = ({ rangePct, avgRangePct }) => {
  if (!Number.isFinite(avgRangePct) || avgRangePct <= 0) return 'normal';
  const ratio = rangePct / avgRangePct;
  if (ratio >= 1.4) return 'elevated';
  if (ratio <= 0.7) return 'compressed';
  return 'normal';
};

const buildAiAnalysisText = ({ symbol, timeframe, candles }) => {
  const sorted = [...candles].sort((a, b) => a.bucket_start - b.bucket_start);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2] ?? last;
  if (!last) {
    return `No candle data available for ${symbol} on ${timeframe} yet.`;
  }

  const bodyPct = last.open > 0 ? ((last.close - last.open) / last.open) * 100 : 0;
  const momentumPct = prev?.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : bodyPct;
  const rangePct = calcCandleRangePct(last);
  const first = sorted[0] ?? last;
  const sessionChangePct = first?.open > 0 ? ((last.close - first.open) / first.open) * 100 : bodyPct;
  const rangeWindow = sorted.slice(Math.max(0, sorted.length - 12));
  const avgRangePct = rangeWindow.length > 0
    ? rangeWindow.reduce((sum, candle) => sum + calcCandleRangePct(candle), 0) / rangeWindow.length
    : rangePct;

  const levelsWindow = sorted.slice(Math.max(0, sorted.length - 20));
  let support = levelsWindow.reduce((min, candle) => Math.min(min, candle.low), Number.POSITIVE_INFINITY);
  let resistance = levelsWindow.reduce((max, candle) => Math.max(max, candle.high), Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(support)) support = last.low;
  if (!Number.isFinite(resistance)) resistance = last.high;

  const volatilityState = inferAiVolatilityState({ rangePct, avgRangePct });
  const bias = inferAiBias({ bodyPct, momentumPct, sessionChangePct });
  const scenario = momentumPct >= 0
    ? `If price holds above $${AI_ASSISTANT_PRICE_FMT.format(support)}, a retest of $${AI_ASSISTANT_PRICE_FMT.format(resistance)} is likely.`
    : `If price stays below $${AI_ASSISTANT_PRICE_FMT.format(resistance)}, a pullback to $${AI_ASSISTANT_PRICE_FMT.format(support)} remains likely.`;

  return [
    `${symbol} analysis (${timeframe})`,
    `Current price: $${AI_ASSISTANT_PRICE_FMT.format(last.close)}.`,
    `Latest candle (${formatAiUtcTime(last.bucket_start)} UTC): O $${AI_ASSISTANT_PRICE_FMT.format(last.open)}, H $${AI_ASSISTANT_PRICE_FMT.format(last.high)}, L $${AI_ASSISTANT_PRICE_FMT.format(last.low)}, C $${AI_ASSISTANT_PRICE_FMT.format(last.close)}, V ${CHART_VOL_FMT.format(last.volume)}.`,
    `Candle body: ${formatAiSignedPct(bodyPct)}. Momentum vs previous candle: ${formatAiSignedPct(momentumPct)}. Session change: ${formatAiSignedPct(sessionChangePct)}.`,
    `Range: ${AI_ASSISTANT_PCT_FMT.format(rangePct)}% (${volatilityState} volatility).`,
    `Levels: support $${AI_ASSISTANT_PRICE_FMT.format(support)} / resistance $${AI_ASSISTANT_PRICE_FMT.format(resistance)}.`,
    `${bias} ${scenario}`,
  ].join(' ');
};

const fetchAiAssistantCandles = async ({ symbol, timeframe, signal }) => {
  const base = buildChartHttpBase();
  if (!base) throw new Error('chart base unavailable');

  const params = new URLSearchParams({
    symbol,
    tf: timeframe,
    limit: String(AI_ASSISTANT_CANDLES_LIMIT),
  });
  const response = await fetch(`${base}/v1/candles?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`candles request failed (${response.status})`);
  }

  const payload = await response.json();
  const candles = Array.isArray(payload?.candles)
    ? payload.candles.map(normalizeChartCandle).filter(Boolean)
    : [];

  return candles.sort((a, b) => a.bucket_start - b.bucket_start);
};

const buildAiAssistantReply = async ({ prompt, fallbackSymbol, signal }) => {
  const symbol = normalizeAiSymbol(fallbackSymbol, AI_ASSISTANT_DEFAULT_SYMBOL);
  const timeframe = extractRequestedTimeframe(prompt);

  try {
    const candles = await fetchAiAssistantCandles({ symbol, timeframe, signal });
    if (candles.length === 0) {
      return `No candles received for ${symbol} on ${timeframe}. Try again in a few seconds.`;
    }
    return buildAiAnalysisText({ symbol, timeframe, candles });
  } catch {
    return `Could not load candle data for ${symbol} on ${timeframe}. Make sure chart gateway is running and reachable.`;
  }
};

const createAiChatMessage = (role, text) => ({
  id: `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
});

const AiAssistantWidget = ({ onClose, locked, pinned, onTogglePin, symbol }) => {
  const [input, setInput]     = useState('');
  const [msgs, setMsgs]       = useState([
    createAiChatMessage('ai', 'Ready. Ask for a ticker and timeframe, for example: "Analyze BTC 15m".'),
  ]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const replyTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const analysisAbortRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
        analysisAbortRef.current = null;
      }
    };
  }, []);

  const send = () => {
    if (!input.trim() || loading || typing) return;
    const txt = input.trim();
    setInput('');
    setMsgs((m) => [...m, createAiChatMessage('user', txt)]);
    setLoading(true);

    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
      analysisAbortRef.current = null;
    }

    requestSeqRef.current += 1;
    const requestId = requestSeqRef.current;

    replyTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      analysisAbortRef.current = controller;

      void (async () => {
        const fullText = await buildAiAssistantReply({
          prompt: txt,
          fallbackSymbol: symbol || AI_ASSISTANT_DEFAULT_SYMBOL,
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestId !== requestSeqRef.current) return;

        if (analysisAbortRef.current === controller) {
          analysisAbortRef.current = null;
        }

        const aiMessage = createAiChatMessage('ai', '');
        let cursor = 0;

        setMsgs((m) => [...m, aiMessage]);
        setLoading(false);
        setTyping(true);

        typingTimerRef.current = setInterval(() => {
          cursor = Math.min(fullText.length, cursor + AI_ASSISTANT_TYPING_STEP_CHARS);
          const nextText = fullText.slice(0, cursor);

          setMsgs((current) =>
            current.map((msg) => (msg.id === aiMessage.id ? { ...msg, text: nextText } : msg)),
          );

          if (cursor >= fullText.length) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
            setTyping(false);
          }
        }, AI_ASSISTANT_TYPING_STEP_MS);
      })();

      replyTimerRef.current = null;
    }, AI_ASSISTANT_REPLY_DELAY_MS);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: typing ? 'auto' : 'smooth' });
  }, [msgs, loading, typing]);

  const canSend = input.trim().length > 0 && !loading && !typing;

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={Sparkles}
        title="THORN AI"
        badge="Live"
        onClose={onClose}
        locked={locked}
        pinned={pinned}
        onTogglePin={onTogglePin}
      />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m, i) => (
            <div key={m.id ?? i} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'pr-1'} ${m.role === 'ai' && i === 0 ? 'mt-3' : ''}`}>
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
              disabled={!canSend}
              className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded transition-all ${
                canSend ? 'bg-violet-400 text-white shadow-[0_0_10px_rgba(196,181,253,0.35)]' : 'bg-slate-800 text-slate-600'}`}>
              <Send className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ Execution в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const ExecutionWidget = ({
  onClose,
  locked,
  symbol,
  pinned,
  onTogglePin,
  walletConnected = false,
  ownerAddress = null,
  subaccountName = 'default',
  getNadoClient,
  marketMetaLookup = {},
  nadoSummary = null,
  positions = [],
  onOrderPlaced,
}) => {
  const baseAsset = baseAssetFromSymbol(symbol);
  const sliderStops = [0, 25, 50, 75, 100];
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [advancedOrderType, setAdvancedOrderType] = useState('stop_market');
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState(false);
  const [tifMenuOpen, setTifMenuOpen] = useState(false);
  const [tif, setTif] = useState('gtc');
  const [postOnly, setPostOnly] = useState(false);
  const [sizePercent, setSizePercent] = useState(0);
  const [sizeInput, setSizeInput] = useState('');
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [triggerPriceInput, setTriggerPriceInput] = useState('');
  const [stopLimitPriceInput, setStopLimitPriceInput] = useState('');
  const [twapHoursInput, setTwapHoursInput] = useState('0');
  const [twapMinutesInput, setTwapMinutesInput] = useState('0');
  const [twapFrequencySec, setTwapFrequencySec] = useState(30);
  const [twapRandomOrder, setTwapRandomOrder] = useState(false);
  const [scaledStartPriceInput, setScaledStartPriceInput] = useState('');
  const [scaledEndPriceInput, setScaledEndPriceInput] = useState('');
  const [scaledQuantityInput, setScaledQuantityInput] = useState('0');
  const [scaledPriceDistribution, setScaledPriceDistribution] = useState('flat');
  const [scaledSizeDistribution, setScaledSizeDistribution] = useState('even');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpSl, setTpSl] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitInfo, setSubmitInfo] = useState('');
  const [executionGatewayState, setExecutionGatewayState] = useState({
    status: 'idle',
    detail: '',
  });
  const advancedTriggerRef = useRef(null);
  const advancedMenuRef = useRef(null);
  const tifTriggerRef = useRef(null);
  const tifMenuRef = useRef(null);

  const marketMeta = useMemo(
    () => resolveMarketMetaForSymbol(marketMetaLookup, symbol),
    [marketMetaLookup, symbol],
  );
  const marketProductId = Number.isFinite(Number(marketMeta?.productId))
    ? Number(marketMeta.productId)
    : null;
  const referencePrice =
    toFiniteOrNull(marketMeta?.markPrice)
    ?? toFiniteOrNull(marketMeta?.price)
    ?? toFiniteOrNull(marketMeta?.indexPrice)
    ?? null;
  const leverage = inferTickerLeverage(symbol) || ORDER_ENTRY_DEFAULT_LEVERAGE;
  const availableMarginUsd = Math.max(0, toFiniteOrNull(nadoSummary?.availableMarginUsd) ?? 0);

  const isMarketOrder = orderType === 'market';
  const isLimitOrder = orderType === 'limit';
  const isAdvancedOrder = orderType === 'advanced';
  const isStopMarketOrder = isAdvancedOrder && advancedOrderType === 'stop_market';
  const isStopLimitOrder = isAdvancedOrder && advancedOrderType === 'stop_limit';
  const isTwapOrder = isAdvancedOrder && advancedOrderType === 'twap';
  const isScaledOrder = isAdvancedOrder && advancedOrderType === 'scaled';
  const supportsDirectSubmit = isMarketOrder || isLimitOrder;

  const currentPosition = useMemo(() => {
    if (!Array.isArray(positions) || positions.length === 0) return null;
    if (marketProductId != null) {
      const byProductId = positions.find((row) => Number(row?.productId) === Number(marketProductId));
      if (byProductId) return byProductId;
    }
    const normalized = normalizeTicker(symbol);
    if (!normalized) return null;
    return positions.find((row) => normalizeTicker(row?.market) === normalized) ?? null;
  }, [positions, symbol, marketProductId]);

  const currentPositionSize = toFiniteOrNull(
    currentPosition?.size ?? currentPosition?.amount ?? currentPosition?.baseAmount,
  ) ?? 0;

  const maxNotionalUsd = Math.max(0, availableMarginUsd * leverage);
  const maxSize = referencePrice && referencePrice > 0
    ? maxNotionalUsd / referencePrice
    : 0;

  const parsedSize = parsePositiveDecimal(sizeInput);
  const parsedLimitPrice = parsePositiveDecimal(limitPriceInput);
  const parsedTriggerPrice = parsePositiveDecimal(triggerPriceInput);
  const parsedStopLimitPrice = parsePositiveDecimal(stopLimitPriceInput);
  const parsedScaledStartPrice = parsePositiveDecimal(scaledStartPriceInput);
  const parsedScaledEndPrice = parsePositiveDecimal(scaledEndPriceInput);

  const scaledReferencePrice = (
    parsedScaledStartPrice != null && parsedScaledEndPrice != null
      ? (parsedScaledStartPrice + parsedScaledEndPrice) / 2
      : null
  ) ?? referencePrice;

  const executionPrice = isMarketOrder
    ? estimateMarketExecutionPrice(referencePrice, side)
    : isLimitOrder
      ? parsedLimitPrice
      : isStopLimitOrder
        ? parsedStopLimitPrice
        : isStopMarketOrder
          ? parsedTriggerPrice
          : isScaledOrder
            ? scaledReferencePrice
            : null;

  const marginRequiredUsd = (
    parsedSize != null && executionPrice != null && executionPrice > 0
      ? (parsedSize * executionPrice) / Math.max(leverage, 1)
      : null
  );

  const twapHours = Math.max(0, Math.min(24, Math.trunc(toFiniteOrNull(twapHoursInput) ?? 0)));
  const twapMinutes = Math.max(0, Math.min(59, Math.trunc(toFiniteOrNull(twapMinutesInput) ?? 0)));
  const twapRuntimeSeconds = (twapHours * 3600) + (twapMinutes * 60);
  const twapFrequencySafe = Math.max(1, Math.trunc(Number(twapFrequencySec) || 30));
  const twapOrderCount = Math.max(1, Math.ceil(Math.max(twapRuntimeSeconds, 1) / twapFrequencySafe));
  const twapTotalSize = parsedSize ?? 0;
  const twapSizePerOrder = parsedSize != null ? parsedSize / twapOrderCount : null;
  const twapRuntimeText = [
    String(Math.trunc(twapRuntimeSeconds / 3600)).padStart(2, '0'),
    String(Math.trunc((twapRuntimeSeconds % 3600) / 60)).padStart(2, '0'),
    String(Math.trunc(twapRuntimeSeconds % 60)).padStart(2, '0'),
  ].join(':');

  const activeAdvancedLabel = ORDER_ENTRY_ADVANCED_TYPES.find((row) => row.value === advancedOrderType)?.label ?? 'Advanced';
  const activeTifLabel = ORDER_ENTRY_TIF_OPTIONS.find((row) => row.value === tif)?.label ?? 'GTC';

  useEffect(() => {
    const controller = new AbortController();
    fetchExecutionCapabilities(controller.signal)
      .then(() => {
        setExecutionGatewayState({
          status: 'online',
          detail: 'Execution gateway connected',
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Execution gateway unavailable';
        setExecutionGatewayState({
          status: 'error',
          detail: message,
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (referencePrice == null || referencePrice <= 0) return;
    setLimitPriceInput((prev) => (prev.trim().length > 0 ? prev : formatEditableNumber(referencePrice, 4)));
    setStopLimitPriceInput((prev) => (prev.trim().length > 0 ? prev : formatEditableNumber(referencePrice, 4)));
  }, [referencePrice, symbol]);

  useEffect(() => {
    setSizeInput('');
    setSizePercent(0);
    setReduceOnly(false);
    setTpSl(false);
    setPostOnly(false);
    setTwapRandomOrder(false);
    setSubmitError('');
    setSubmitInfo('');
    setAdvancedMenuOpen(false);
    setTifMenuOpen(false);
  }, [symbol]);

  useEffect(() => {
    if (!isAdvancedOrder) setAdvancedMenuOpen(false);
    if (!(isLimitOrder || isScaledOrder)) setTifMenuOpen(false);
  }, [isAdvancedOrder, isLimitOrder, isScaledOrder]);

  useEffect(() => {
    if (!advancedMenuOpen && !tifMenuOpen) return () => {};
    const onPointerDown = (event) => {
      const target = event.target;
      if (advancedMenuOpen) {
        const insideAdvanced = advancedMenuRef.current?.contains(target)
          || advancedTriggerRef.current?.contains(target);
        if (!insideAdvanced) setAdvancedMenuOpen(false);
      }
      if (tifMenuOpen) {
        const insideTif = tifMenuRef.current?.contains(target)
          || tifTriggerRef.current?.contains(target);
        if (!insideTif) setTifMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAdvancedMenuOpen(false);
        setTifMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [advancedMenuOpen, tifMenuOpen]);

  const applySizePercent = useCallback((percent) => {
    const safe = clampNumber(Number(percent), 0, 100);
    setSizePercent(safe);
    if (maxSize > 0 && safe > 0) {
      setSizeInput(formatEditableNumber((maxSize * safe) / 100, 6));
    } else if (safe === 0) {
      setSizeInput('');
    }
  }, [maxSize]);

  const handleSizeSliderChange = useCallback((event) => {
    applySizePercent(event.target.value);
  }, [applySizePercent]);

  const handleSizeInputChange = useCallback((event) => {
    const next = sanitizeDecimalInput(event.target.value);
    setSizeInput(next);
    const parsed = parsePositiveDecimal(next);
    if (parsed == null || maxSize <= 0) {
      setSizePercent(0);
      return;
    }
    const pct = clampNumber((parsed / maxSize) * 100, 0, 100);
    setSizePercent(Math.round(pct));
  }, [maxSize]);

  const setOrderMode = useCallback((nextOrderType) => {
    setOrderType(nextOrderType);
    if (nextOrderType !== 'advanced') setAdvancedMenuOpen(false);
  }, []);

  const handleAdvancedOptionPick = useCallback((nextType) => {
    setOrderType('advanced');
    setAdvancedOrderType(nextType);
    setAdvancedMenuOpen(false);
  }, []);

  const handleSubmitOrder = useCallback(async () => {
    if (submitting) return;
    setSubmitError('');
    setSubmitInfo('');

    try {
      if (!walletConnected) throw new Error('Connect wallet first');
      if (!ownerAddress) throw new Error('Wallet address unavailable');
      if (executionGatewayState.status === 'error') {
        throw new Error(executionGatewayState.detail || 'Execution gateway unavailable');
      }
      if (!supportsDirectSubmit) {
        throw new Error('Selected advanced order type is UI-only for now');
      }
      if (parsedSize == null) throw new Error('Enter order size');
      if (executionPrice == null || executionPrice <= 0) throw new Error('Price unavailable for this order');

      const nadoClient = getNadoClient?.();
      if (!nadoClient) throw new Error('Nado client unavailable');
      setSubmitting(true);

      const sizeText = sanitizeDecimalInput(sizeInput || String(parsedSize));
      const priceText = isMarketOrder
        ? formatEditableNumber(executionPrice, 8)
        : sanitizeDecimalInput(limitPriceInput || String(executionPrice));
      if (!sizeText) throw new Error('Invalid size');
      if (!priceText) throw new Error('Invalid price');
      const productId = marketProductId ?? (await resolveProductIdViaClient(nadoClient, symbol));
      if (productId == null) throw new Error('Market product id not found');
      const executionClient = createExecutionGatewayClient(nadoClient);
      const rawAmountX18 = parseUnits(sizeText, 18);
      // `@nadohq/shared` converts order.price -> priceX18 internally for EIP-712 signing.
      // Keep order.price as decimal text, but align it to engine tick size to avoid 2000 errors.
      const rawPriceX18 = parseUnits(priceText, 18);
      const { priceIncrementX18, sizeIncrementX18 } = await resolveSymbolIncrementsX18ViaClient(
        nadoClient,
        productId,
      );
      const normalizedAmountX18 = alignAmountToIncrementX18(rawAmountX18, sizeIncrementX18);
      if (normalizedAmountX18 <= 0n) throw new Error('Invalid size');
      const signedAmountX18 = side === 'sell' ? -normalizedAmountX18 : normalizedAmountX18;
      const normalizedPriceX18 = alignPriceToIncrementX18(rawPriceX18, priceIncrementX18);
      if (normalizedPriceX18 <= 0n) throw new Error('Invalid price');
      const orderPrice = formatUnits(normalizedPriceX18, 18);
      const appendix = packOrderAppendix({
        orderExecutionType: getOrderEntryExecutionType({
          orderType,
          postOnly: isLimitOrder ? postOnly : false,
          tif,
        }),
        reduceOnly,
      });

      const response = await executionClient.market.placeOrder({
        productId,
        order: {
          subaccountOwner: ownerAddress,
          subaccountName,
          expiration: String(getOrderEntryExpiration({ orderType, tif })),
          price: orderPrice,
          amount: signedAmountX18.toString(),
          appendix: appendix.toString(),
        },
      });

      const upstreamError = response?.data?.error;
      if (upstreamError) {
        throw new Error(String(upstreamError));
      }

      const digest = String(response?.data?.digest || '');
      setSubmitInfo(
        digest
          ? `Order accepted: ${digest.slice(0, 14)}...`
          : 'Order accepted',
      );
      onOrderPlaced?.();
    } catch (error) {
      setSubmitError(extractGatewayErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    walletConnected,
    ownerAddress,
    executionGatewayState,
    supportsDirectSubmit,
    parsedSize,
    executionPrice,
    getNadoClient,
    sizeInput,
    isMarketOrder,
    limitPriceInput,
    marketProductId,
    symbol,
    side,
    orderType,
    isLimitOrder,
    postOnly,
    tif,
    reduceOnly,
    subaccountName,
    onOrderPlaced,
  ]);

  const submitDisabledReason = (() => {
    if (availableMarginUsd <= 0) return 'Deposit Funds to Start Trading';
    if (submitting) return 'Submitting...';
    if (!walletConnected) return 'Connect wallet';
    if (!ownerAddress) return 'Wallet unavailable';
    if (typeof getNadoClient !== 'function') return 'Client unavailable';
    if (executionGatewayState.status === 'error') return 'Execution offline';
    if (!supportsDirectSubmit) return 'Preview only';
    if (parsedSize == null) return 'Enter size';
    if (isLimitOrder && parsedLimitPrice == null) return 'Enter price';
    if (executionPrice == null || executionPrice <= 0) return 'Price unavailable';
    return '';
  })();

  const canSubmit = submitDisabledReason.length === 0;
  const positionText = `${fmt.number(currentPositionSize, 5)} ${baseAsset}`;
  const liqPrice = toFiniteOrNull(currentPosition?.estimatedLiquidationPrice);
  const sliderMaxText = (isStopMarketOrder || isScaledOrder) ? '--' : fmt.currency(maxNotionalUsd);
  const submitButtonText = submitting
    ? 'Submitting...'
    : canSubmit
      ? side === 'buy'
        ? `Submit Buy ${isLimitOrder ? 'Limit' : 'Market'}`
        : `Submit Sell ${isLimitOrder ? 'Limit' : 'Market'}`
      : submitDisabledReason;

  const showLiqMetric = isMarketOrder || isLimitOrder || isStopMarketOrder || isStopLimitOrder;
  const showMarginMetric = !isTwapOrder;
  const showSlippageMetric = isMarketOrder || isStopMarketOrder;
  const slippageText = isStopMarketOrder ? 'Est: -- / Max:5.00%' : 'Est: -- / Max:1.00%';

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={Bolt}
        title={`Order Entry · ${baseAsset}`}
        onClose={onClose}
        locked={locked}
        pinned={pinned}
        onTogglePin={onTogglePin}
      />
      <div
        className={`flex min-h-0 flex-1 flex-col border-t ${C.bRow} bg-[linear-gradient(180deg,rgba(9,11,24,0.98)_0%,rgba(7,9,20,0.98)_100%)] px-2.5 pb-2 pt-2`}
        onMouseDown={nodrag}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="h-[30px] rounded-[4px] bg-white/[0.08] text-[12px] font-medium text-slate-100"
          >
            Cross
          </button>
          <button
            type="button"
            className="h-[30px] rounded-[4px] bg-white/[0.08] text-[12px] font-medium text-slate-100"
          >
            {`${leverage}x`}
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1 rounded-[5px] bg-[rgba(16,18,36,0.74)] p-0.5">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`h-[30px] rounded-[4px] text-[12px] font-medium transition-colors ${
              side === 'buy'
                ? 'bg-emerald-400/90 text-[#052313]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Buy/Long
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`h-[30px] rounded-[4px] text-[12px] font-medium transition-colors ${
              side === 'sell'
                ? 'bg-rose-400/90 text-[#2b0a10]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sell/Short
          </button>
        </div>

        <div className="relative mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[12px]">
            <button
              type="button"
              onClick={() => setOrderMode('market')}
              className={isMarketOrder ? 'font-medium text-slate-100' : 'text-slate-400 hover:text-slate-200'}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderMode('limit')}
              className={isLimitOrder ? 'font-medium text-slate-100' : 'text-slate-400 hover:text-slate-200'}
            >
              Limit
            </button>
            <button
              ref={advancedTriggerRef}
              type="button"
              onClick={() => {
                if (!isAdvancedOrder) {
                  setOrderType('advanced');
                  setAdvancedMenuOpen(true);
                  return;
                }
                setAdvancedMenuOpen((prev) => !prev);
              }}
              className={`flex items-center gap-1 ${isAdvancedOrder ? 'font-medium text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <span>{isAdvancedOrder ? activeAdvancedLabel : 'Advanced'}</span>
              <ChevronDown className={`h-3 w-3 text-slate-500/90 transition-transform ${advancedMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <Info className="h-3.5 w-3.5 text-slate-500" />

          {advancedMenuOpen && (
            <div
              ref={advancedMenuRef}
              className="absolute left-[106px] top-7 z-40 w-[132px] overflow-hidden rounded-[4px] border border-white/10 bg-[#25272f] shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            >
              {ORDER_ENTRY_ADVANCED_TYPES.map((option) => {
                const active = advancedOrderType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleAdvancedOptionPick(option.value)}
                    className={`block w-full px-3 py-2 text-left text-[12px] transition-colors ${
                      active
                        ? 'bg-white/10 text-slate-100'
                        : 'text-slate-200 hover:bg-white/8'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {executionGatewayState.status === 'error' && executionGatewayState.detail && (
          <div className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
            {executionGatewayState.detail}
          </div>
        )}

        <div className="mt-2.5 space-y-1.5 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Available Margin</span>
            <span className="font-mono text-slate-100">{fmt.currency(availableMarginUsd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Position</span>
            <span className="font-mono text-slate-100">{positionText}</span>
          </div>
        </div>

        {(isStopMarketOrder || isStopLimitOrder) && (
          <div className="mt-2.5 rounded-[4px] bg-[rgba(18,20,37,0.9)] px-2.5">
            <div className="flex h-[34px] items-center gap-2 text-[12px]">
              <span className="text-slate-400">Trigger</span>
              <input
                type="text"
                inputMode="decimal"
                value={triggerPriceInput}
                onChange={(event) => setTriggerPriceInput(sanitizeDecimalInput(event.target.value))}
                placeholder="0"
                className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {(isLimitOrder || isStopLimitOrder) && (
          <div className="mt-2.5 rounded-[4px] bg-[rgba(18,20,37,0.9)] px-2.5">
            <div className="flex h-[34px] items-center gap-2 text-[12px]">
              <span className="text-slate-400">Price</span>
              <div className="ml-auto flex items-center gap-1 font-mono text-slate-500">
                <input
                  type="text"
                  inputMode="decimal"
                  value={isLimitOrder ? limitPriceInput : stopLimitPriceInput}
                  onChange={(event) => (
                    isLimitOrder
                      ? setLimitPriceInput(sanitizeDecimalInput(event.target.value))
                      : setStopLimitPriceInput(sanitizeDecimalInput(event.target.value))
                  )}
                  placeholder="0.00"
                  className="h-full w-[90px] bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                />
                <span>Mid</span>
              </div>
            </div>
          </div>
        )}

        {isScaledOrder && (
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
              <div className="flex h-[34px] items-center gap-2 text-[12px]">
                <span className="text-slate-400">Start Price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scaledStartPriceInput}
                  onChange={(event) => setScaledStartPriceInput(sanitizeDecimalInput(event.target.value))}
                  placeholder="0"
                  className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
              <div className="flex h-[34px] items-center gap-2 text-[12px]">
                <span className="text-slate-400">End Price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scaledEndPriceInput}
                  onChange={(event) => setScaledEndPriceInput(sanitizeDecimalInput(event.target.value))}
                  placeholder="0"
                  className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
          <div className="flex h-[34px] items-center justify-between text-[12px]">
            <span className="text-slate-400">Size</span>
            <div className="flex items-center gap-1 font-mono text-slate-300">
              <input
                type="text"
                inputMode="decimal"
                value={sizeInput}
                onChange={handleSizeInputChange}
                placeholder="0.00000"
                className="h-full w-[102px] bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
              />
              <span>{baseAsset}</span>
              <ArrowLeftRight className="h-3 w-3 text-slate-500/80" />
            </div>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="relative h-4">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-slate-700/75" />
            <div
              className={`absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded ${side === 'buy' ? 'bg-emerald-300/75' : 'bg-rose-300/75'}`}
              style={{ width: `${sizePercent}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 z-10 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-100 bg-[rgba(5,9,20,1)]"
              style={{ left: `${sizePercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between">
              {sliderStops.map((stop) => (
                <button
                  key={stop}
                  type="button"
                  onClick={() => applySizePercent(stop)}
                  className={`rounded-full transition-colors ${
                    sizePercent >= stop
                      ? side === 'buy'
                        ? 'h-[9px] w-[9px] border border-emerald-300/70 bg-emerald-300/20'
                        : 'h-[9px] w-[9px] border border-rose-300/70 bg-rose-300/20'
                      : 'h-[9px] w-[9px] border border-slate-600 bg-[rgba(10,12,24,0.98)]'
                  }`}
                  aria-label={`Size ${stop}%`}
                />
              ))}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sizePercent}
              onChange={handleSizeSliderChange}
              className="absolute inset-0 z-20 h-4 w-full cursor-pointer opacity-0"
              aria-label="Order size percent"
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px]">
            <span className="font-mono text-slate-300">{`${sizePercent}% = ${sizeInput || '--'}`}</span>
            <span className="text-slate-300">{`Max ${sliderMaxText}`}</span>
          </div>
        </div>

        {isTwapOrder && (
          <div className="mt-2.5 space-y-2">
            <div className="text-[12px] text-slate-400">Running Time (1m - 24h)</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
                <div className="flex h-[34px] items-center gap-2 text-[12px]">
                  <span className="text-slate-400">Hours</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twapHoursInput}
                    onChange={(event) => setTwapHoursInput(event.target.value.replace(/[^0-9]/g, ''))}
                    className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
                <div className="flex h-[34px] items-center gap-2 text-[12px]">
                  <span className="text-slate-400">Minutes</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twapMinutesInput}
                    onChange={(event) => setTwapMinutesInput(event.target.value.replace(/[^0-9]/g, ''))}
                    className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ORDER_ENTRY_TWAP_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setTwapHoursInput(String(Math.trunc(preset.value / 60)));
                    setTwapMinutesInput(String(preset.value % 60));
                  }}
                  className="h-7 rounded-[4px] bg-white/[0.08] text-[12px] text-slate-100 transition-colors hover:bg-white/[0.12]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-slate-400">Frequency</span>
              <div className="relative">
                <select
                  value={String(twapFrequencySec)}
                  onChange={(event) => setTwapFrequencySec(Number(event.target.value))}
                  className="h-8 appearance-none rounded-[4px] border border-white/10 bg-[rgba(18,20,37,0.9)] pl-2 pr-7 font-mono text-[12px] text-slate-100 outline-none"
                >
                  {ORDER_ENTRY_TWAP_FREQUENCIES.map((option) => (
                    <option key={option.value} value={String(option.value)} className="bg-[#1f2128] text-slate-100">
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
        )}

        {isScaledOrder && (
          <div className="mt-2.5 space-y-2">
            <div className="rounded-[5px] bg-[rgba(18,20,37,0.9)] px-2.5">
              <div className="flex h-[34px] items-center gap-2 text-[12px]">
                <span className="text-slate-400">Quantity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scaledQuantityInput}
                  onChange={(event) => setScaledQuantityInput(sanitizeDecimalInput(event.target.value))}
                  placeholder="0.00"
                  className="h-full min-w-0 flex-1 bg-transparent px-0 text-right font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {ORDER_ENTRY_SCALED_QTY_PRESETS.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setScaledQuantityInput(String(qty))}
                  className="h-7 rounded-[4px] bg-white/[0.08] text-[12px] text-slate-100 transition-colors hover:bg-white/[0.12]"
                >
                  {qty}
                </button>
              ))}
            </div>
            <div className="space-y-1 text-[12px] text-slate-300">
              <div className="text-slate-400">Price Distribution</div>
              <div className="flex items-center gap-3">
                {[
                  { value: 'flat', label: 'Flat' },
                  { value: 'increasing', label: 'Increasing' },
                  { value: 'decreasing', label: 'Decreasing' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScaledPriceDistribution(option.value)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className={`inline-flex h-3 w-3 items-center justify-center rounded-full border ${
                      scaledPriceDistribution === option.value
                        ? 'border-slate-100'
                        : 'border-slate-500'
                    }`}>
                      {scaledPriceDistribution === option.value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-100" />
                      )}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1 text-[12px] text-slate-300">
              <div className="text-slate-400">Size Distribution</div>
              <div className="flex items-center gap-3">
                {[
                  { value: 'even', label: 'Evenly Split' },
                  { value: 'increasing', label: 'Increasing' },
                  { value: 'decreasing', label: 'Decreasing' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScaledSizeDistribution(option.value)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className={`inline-flex h-3 w-3 items-center justify-center rounded-full border ${
                      scaledSizeDistribution === option.value
                        ? 'border-slate-100'
                        : 'border-slate-500'
                    }`}>
                      {scaledSizeDistribution === option.value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-100" />
                      )}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="h-8 w-full cursor-not-allowed rounded-[4px] bg-white/[0.04] text-[13px] text-slate-500"
            >
              Preview Orders
            </button>
          </div>
        )}

        <div className="mt-2.5 space-y-1.5 text-[12px] text-slate-300">
          {(isLimitOrder || isScaledOrder) && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPostOnly((prev) => !prev)}
                className="flex items-center gap-2 text-slate-200"
                aria-pressed={postOnly}
              >
                <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border ${
                  postOnly ? 'border-emerald-300/90 bg-emerald-400/30' : 'border-slate-500 bg-transparent'
                }`}>
                  {postOnly && <span className="h-2 w-2 rounded-[1px] bg-emerald-100" />}
                </span>
                <span>Post Only</span>
              </button>
              <div className="relative flex items-center gap-2">
                <span className="text-slate-400">TIF</span>
                <button
                  ref={tifTriggerRef}
                  type="button"
                  onClick={() => setTifMenuOpen((prev) => !prev)}
                  className="inline-flex h-7 min-w-[84px] items-center justify-between rounded-[4px] bg-[rgba(18,20,37,0.95)] px-2 font-mono text-[12px] text-slate-100 ring-1 ring-white/10"
                >
                  <span>{activeTifLabel}</span>
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </button>
                {tifMenuOpen && (
                  <div
                    ref={tifMenuRef}
                    className="absolute right-0 top-8 z-40 w-[124px] overflow-hidden rounded-[4px] border border-white/10 bg-[#25272f] shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                  >
                    {ORDER_ENTRY_TIF_OPTIONS.map((option) => {
                      const active = tif === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTif(option.value);
                            setTifMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition-colors ${
                            active
                              ? 'bg-white/10 text-slate-100'
                              : 'text-slate-200 hover:bg-white/8'
                          }`}
                        >
                          <span>{option.label}</span>
                          {active && <span className="text-slate-100">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {isTwapOrder && (
            <button
              type="button"
              onClick={() => setTwapRandomOrder((prev) => !prev)}
              className="flex items-center gap-2 text-slate-200"
              aria-pressed={twapRandomOrder}
            >
              <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border ${
                twapRandomOrder ? 'border-violet-300/90 bg-violet-400/30' : 'border-slate-500 bg-transparent'
              }`}>
                {twapRandomOrder && <span className="h-2 w-2 rounded-[1px] bg-violet-100" />}
              </span>
              <span>Random Order</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setReduceOnly((prev) => !prev)}
            className="flex items-center gap-2 text-slate-200"
            aria-pressed={reduceOnly}
          >
            <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border ${
              reduceOnly ? 'border-emerald-300/90 bg-emerald-400/30' : 'border-slate-500 bg-transparent'
            }`}>
              {reduceOnly && <span className="h-2 w-2 rounded-[1px] bg-emerald-100" />}
            </span>
            <span>Reduce Only</span>
          </button>

          {(isMarketOrder || isLimitOrder) && (
            <button
              type="button"
              onClick={() => setTpSl((prev) => !prev)}
              className="flex items-center gap-2 text-slate-200"
              aria-pressed={tpSl}
            >
              <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border ${
                tpSl ? 'border-violet-300/90 bg-violet-400/30' : 'border-slate-500 bg-transparent'
              }`}>
                {tpSl && <span className="h-2 w-2 rounded-[1px] bg-violet-100" />}
              </span>
              <span>TP/SL</span>
            </button>
          )}
        </div>

        {(submitError || submitInfo) && (
          <div
            className={`mt-2.5 rounded-md border px-2.5 py-2 text-[11px] ${
              submitError
                ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {submitError || submitInfo}
          </div>
        )}

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={!canSubmit}
            className={`h-[34px] w-full rounded-[4px] text-[13px] font-medium transition-colors ${
              canSubmit
                ? side === 'buy'
                  ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'
                  : 'bg-rose-300 text-rose-950 hover:bg-rose-200'
                : submitDisabledReason === 'Deposit Funds to Start Trading'
                  ? 'cursor-not-allowed bg-[#d9d9dc] text-[#1f2228]'
                  : 'cursor-not-allowed bg-slate-700/60 text-slate-400'
            }`}
          >
            {submitButtonText}
          </button>
        </div>

        {isTwapOrder ? (
          <div className="mt-2.5 space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Size</span>
              <span className="font-mono text-slate-200">{`${fmt.number(twapTotalSize, 5)} ${baseAsset}`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Runtime</span>
              <span className="font-mono text-slate-200">{twapRuntimeText}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Number of orders</span>
              <span className="font-mono text-slate-200">{fmt.number(twapOrderCount, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Size per suborder</span>
              <span className="font-mono text-slate-200">
                {twapSizePerOrder == null ? '-- BTC' : `${fmt.number(twapSizePerOrder, 5)} ${baseAsset}`}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 space-y-1.5 text-[12px]">
            {showLiqMetric && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Est. Liquidation Price</span>
                <span className="font-mono text-slate-200">
                  {liqPrice == null ? '--' : fmt.number(liqPrice, 4)}
                </span>
              </div>
            )}
            {showMarginMetric && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Margin Required</span>
                <span className="font-mono text-slate-200">
                  {marginRequiredUsd == null ? '--' : fmt.currency(marginRequiredUsd)}
                </span>
              </div>
            )}
            {showSlippageMetric && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Slippage</span>
                <span className="inline-flex items-center gap-1 font-mono text-slate-200">
                  <span>{slippageText}</span>
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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
  pinned,
  onTogglePin,
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
        pinned={pinned}
        onTogglePin={onTogglePin}
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
const WatchlistWidget = ({
  onClose,
  locked,
  pinned,
  onTogglePin,
  availableSymbols = [],
  symbol,
  onSymbolChange,
  nadoAppOrigin = null,
}) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Star} title="Watchlist" onClose={onClose} locked={locked} pinned={pinned} onTogglePin={onTogglePin} />
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
            <Web3TokenIcon
              symbol={entry}
              seed={entry}
              size={36}
              className={`h-9 w-9 border ${C.border} bg-violet-400/[0.08]`}
              nadoAppOrigin={nadoAppOrigin}
            />
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
const TradeHistoryWidget = ({ onClose, locked, symbol, pinned, onTogglePin }) => {
  const { recentTrades, status, detail } = useOrderbookStream(symbol);
  const statusStyle = ORDERBOOK_STATUS_STYLES[status] || ORDERBOOK_STATUS_STYLES.idle;
  const statusText = formatStatusText(status);
  const rows = useMemo(
    () => (Array.isArray(recentTrades) ? recentTrades.slice(0, TRADE_HISTORY_DISPLAY) : []),
    [recentTrades],
  );

  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH
        icon={Clock}
        title="Trade History"
        onClose={onClose}
        locked={locked}
        pinned={pinned}
        onTogglePin={onTogglePin}
        extra={(
          statusText ? <span className={`hidden font-mono text-[10px] md:flex ${statusStyle.text}`}>{statusText}</span> : null
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

const NewsFeedWidget = ({ onClose, locked, pinned, onTogglePin }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH
      icon={Newspaper}
      title="News Feed"
      badge="Live"
      onClose={onClose}
      locked={locked}
      pinned={pinned}
      onTogglePin={onTogglePin}
    />
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

const MarketStatsWidget = ({ onClose, locked, pinned, onTogglePin }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Flame} title="Market Stats" onClose={onClose} locked={locked} pinned={pinned} onTogglePin={onTogglePin} />
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
  orderbook:    { label: 'Order Book',    icon: AlignLeft,  Comp: OrderBookWidget,    dfl: { w: 2, h: 4 } },
  ai:           { label: 'AI Assistant',  icon: Sparkles,   Comp: AiAssistantWidget,  dfl: { w: 4, h: 3 } },
  execution:    { label: 'Execution',     icon: Bolt,       Comp: ExecutionWidget,    dfl: { w: 2, h: 4 } },
  positions:    { label: 'Positions',     icon: Activity,   Comp: PositionsWidget,    dfl: { w: 5, h: 3 } },
  watchlist:    { label: 'Watchlist',     icon: Star,       Comp: WatchlistWidget,    dfl: { w: 3, h: 4 } },
  tradehistory: { label: 'Trade History', icon: Clock,      Comp: TradeHistoryWidget, dfl: { w: 4, h: 3 } },
  newsfeed:     { label: 'News Feed',     icon: Newspaper,  Comp: NewsFeedWidget,     dfl: { w: 4, h: 4 } },
  marketstats:  { label: 'Market Stats',  icon: Flame,      Comp: MarketStatsWidget,  dfl: { w: 4, h: 3 } },
};

const DEFAULT_LAYOUT = [
  { i: 'chart',     x: 0, y: 0, w: 8, h: 4, minW: 5, minH: 3 },
  { i: 'orderbook', x: 8, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
  { i: 'execution', x: 10, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
  { i: 'positions', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 2 },
  { i: 'ai',        x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 2 },
];

const MONITOR_PROFILES = {
  compact: 'compact',
  desktop: 'desktop',
  wide: 'wide',
  ultra: 'ultra',
};
const REQUIRED_FIXED_WIDGET_IDS = new Set(['positions', 'ai']);

const ADAPTIVE_FIXED_LAYOUTS = {
  compact: [
    { i: 'chart',     x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
    { i: 'orderbook', x: 0, y: 4, w: 6,  h: 3, minW: 4, minH: 3 },
    { i: 'execution', x: 6, y: 4, w: 6,  h: 3, minW: 4, minH: 3 },
    { i: 'positions', x: 0, y: 7, w: 6,  h: 4, minW: 4, minH: 2 },
    { i: 'ai',        x: 6, y: 7, w: 6,  h: 4, minW: 4, minH: 2 },
  ],
  desktop: [
    { i: 'chart',     x: 0,  y: 0, w: 8,  h: 4, minW: 5, minH: 3 },
    { i: 'orderbook', x: 8,  y: 0, w: 2,  h: 4, minW: 2, minH: 3 },
    { i: 'execution', x: 10, y: 0, w: 2,  h: 4, minW: 2, minH: 3 },
    { i: 'positions', x: 0,  y: 4, w: 6,  h: 4, minW: 4, minH: 2 },
    { i: 'ai',        x: 6,  y: 4, w: 6,  h: 4, minW: 4, minH: 2 },
  ],
  wide: [
    { i: 'chart',     x: 0,  y: 0, w: 8,  h: 5, minW: 5, minH: 3 },
    { i: 'orderbook', x: 8,  y: 0, w: 2,  h: 5, minW: 2, minH: 3 },
    { i: 'execution', x: 10, y: 0, w: 2,  h: 5, minW: 2, minH: 3 },
    { i: 'positions', x: 0,  y: 5, w: 6,  h: 4, minW: 4, minH: 2 },
    { i: 'ai',        x: 6,  y: 5, w: 6,  h: 4, minW: 4, minH: 2 },
  ],
  ultra: [
    { i: 'chart',     x: 0,  y: 0, w: 8,  h: 5, minW: 5, minH: 3 },
    { i: 'orderbook', x: 8,  y: 0, w: 2,  h: 5, minW: 2, minH: 3 },
    { i: 'execution', x: 10, y: 0, w: 2,  h: 5, minW: 2, minH: 3 },
    { i: 'positions', x: 0,  y: 5, w: 6,  h: 3, minW: 4, minH: 2 },
    { i: 'ai',        x: 6,  y: 5, w: 6,  h: 3, minW: 4, minH: 2 },
  ],
};

const resolveMonitorProfile = (width) => {
  if (!Number.isFinite(width)) return MONITOR_PROFILES.desktop;
  if (width >= 2560) return MONITOR_PROFILES.ultra;
  if (width >= 1920) return MONITOR_PROFILES.wide;
  if (width >= 1440) return MONITOR_PROFILES.desktop;
  return MONITOR_PROFILES.compact;
};

const layoutsEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  const map = new Map(left.map((item) => [item.i, item]));
  for (const item of right) {
    const prev = map.get(item.i);
    if (!prev) return false;
    if (
      prev.x !== item.x ||
      prev.y !== item.y ||
      prev.w !== item.w ||
      prev.h !== item.h ||
      prev.minW !== item.minW ||
      prev.minH !== item.minH ||
      prev.maxW !== item.maxW ||
      prev.maxH !== item.maxH
    ) {
      return false;
    }
  }
  return true;
};

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

const buildAdaptiveFixedLayout = (currentLayout, profile, pinnedIds = new Set()) => {
  const base = ADAPTIVE_FIXED_LAYOUTS[profile] || ADAPTIVE_FIXED_LAYOUTS.desktop;
  const normalizedCurrent = normalizeLayout(currentLayout);
  const currentById = new Map(normalizedCurrent.map((item) => [item.i, item]));
  const activeIds = normalizedCurrent.map((item) => item.i);
  const activeSet = new Set(activeIds);

  const next = [];
  for (const item of base) {
    if (activeSet.has(item.i) || REQUIRED_FIXED_WIDGET_IDS.has(item.i)) {
      const pinnedCurrent = pinnedIds.has(item.i) ? currentById.get(item.i) : null;
      if (pinnedCurrent) {
        next.push({ ...pinnedCurrent });
        continue;
      }
      next.push({ ...item });
    }
  }

  const baseIds = new Set(next.map((item) => item.i));
  let nextY = next.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  for (const id of activeIds) {
    if (baseIds.has(id) || !DEFS[id]) continue;
    const pinnedCurrent = pinnedIds.has(id) ? currentById.get(id) : null;
    if (pinnedCurrent) {
      next.push({ ...pinnedCurrent });
      continue;
    }
    const dfl = DEFS[id].dfl || { w: 4, h: 3 };
    const width = Math.min(12, Math.max(2, Math.trunc(dfl.w || 4)));
    const height = Math.max(2, Math.trunc(dfl.h || 3));
    next.push({
      i: id,
      x: 0,
      y: nextY,
      w: width,
      h: height,
      minW: Math.min(width, Math.max(2, Math.trunc(dfl.minW || 2))),
      minH: Math.max(2, Math.trunc(dfl.minH || 2)),
    });
    nextY += height;
  }

  return normalizeLayout(next);
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
  const { address, chainId, isConnected, connector } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: session, isLoading: sessionLoading } = useSession();
  const invalidateSession = useInvalidateSession();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();
  const { getNadoClient, subaccountName } = useNadoLinkedSigner();
  const { chainEnv, activeChain } = useNadoNetwork();
  const requiredChainName = activeChain?.name ?? 'required chain';
  const [siweError, setSiweError] = useState(null);

  const onWrongChain = chainId != null && chainId !== activeChain.id;
  const sessionAddr = session?.address?.toLowerCase();
  const walletAddr = address?.toLowerCase();
  const sessionMatchesWallet =
    Boolean(sessionAddr && walletAddr && sessionAddr === walletAddr);
  const canQueryPortfolio =
    Boolean(
      address &&
        !onWrongChain &&
        sessionMatchesWallet,
    );

  const runSiwe = useCallback(async () => {
    if (!address) return;
    if (onWrongChain) {
      await switchChain({ chainId: activeChain.id });
      return;
    }

    try {
      setSiweError(null);
      await signInWithThornado(address, {
        chainId: activeChain.id,
        walletClient,
        signMessageAsync,
        connector,
      });
      await invalidateSession();
    } catch (error) {
      setSiweError(extractGatewayErrorMessage(error));
    }
  }, [
    address,
    onWrongChain,
    switchChain,
    activeChain.id,
    walletClient,
    signMessageAsync,
    connector,
    invalidateSession,
    setSiweError,
  ]);

  const runSiweRef = useRef(runSiwe);
  runSiweRef.current = runSiwe;
  const siweAttemptKey = useRef('');

  useEffect(() => {
    siweAttemptKey.current = '';
  }, [address, chainId]);

  useEffect(() => {
    if (sessionMatchesWallet) setSiweError(null);
  }, [sessionMatchesWallet]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!isConnected || !address) return;
    if (onWrongChain) return;
    if (sessionMatchesWallet) return;
    const key = `${address}-${chainId}`;
    if (siweAttemptKey.current === key) return;

    siweAttemptKey.current = key;
    void runSiweRef.current();
  }, [
    sessionLoading,
    isConnected,
    address,
    chainId,
    onWrongChain,
    sessionMatchesWallet,
  ]);

  const portfolio = usePortfolioData({
    getNadoClient,
    enabled: canQueryPortfolio,
    ownerAddress: address,
    chainEnv,
    subaccountName,
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
  const nadoAppOrigin =
    chainEnv === 'inkMainnet' ? 'https://app.nado.xyz' : 'https://testnet.nado.xyz';

  const portfolioStreamGateReason = useMemo(() => {
    if (!isConnected || !address) return 'Connect wallet to enable portfolio stream.';
    if (sessionLoading) return 'Checking session...';
    if (onWrongChain) return `Switch network to ${requiredChainName}.`;
    if (!sessionAddr) return 'Wallet connected, but SIWE session is missing.';
    if (!sessionMatchesWallet) return 'SIWE session address does not match connected wallet.';
    return null;
  }, [
    isConnected,
    address,
    sessionLoading,
    onWrongChain,
    requiredChainName,
    sessionAddr,
    sessionMatchesWallet,
  ]);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [containerHeight, setContainerHeight] = useState(760);
  const [layout, setLayout]       = useState(DEFAULT_LAYOUT);
  const [showPanel, setShowPanel] = useState(false);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [locked, setLocked]       = useState(() => {
    const storedMode = readTerminalPrefs()?.layout?.mode;
    return storedMode !== 'edit';
  });
  const [presets, setPresets] = useState(() => readStoredPresets());
  const [activePresetId, setActivePresetId] = useState(null);
  const [pinnedWidgetIds, setPinnedWidgetIds] = useState(() => {
    const ids = readTerminalPrefs()?.layout?.pinnedWidgetIds;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === 'string' && DEFS[id]);
  });
  const [activeSymbol, setActiveSymbol] = useState(() => {
    const storedSymbol = normalizeTicker(readTerminalPrefs()?.symbol?.active);
    return storedSymbol || DEFAULT_ORDERBOOK_SYMBOL || FALLBACK_TICKERS[0];
  });
  const availableSymbols = useAvailableTickers(activeSymbol);
  const marketMetaLookup = useMarketMetaLookup();
  const pinnedWidgetSet = useMemo(() => new Set(pinnedWidgetIds), [pinnedWidgetIds]);
  const monitorProfile = useMemo(
    () => resolveMonitorProfile(containerWidth),
    [containerWidth],
  );
  const gridMetrics = useMemo(() => {
    if (monitorProfile === MONITOR_PROFILES.compact) {
      return { rowHeight: 72, margin: [4, 4], padClass: 'p-1', padPx: 4 };
    }
    if (monitorProfile === MONITOR_PROFILES.wide) {
      return { rowHeight: 90, margin: [8, 8], padClass: 'p-2', padPx: 8 };
    }
    if (monitorProfile === MONITOR_PROFILES.ultra) {
      return { rowHeight: 98, margin: [10, 10], padClass: 'p-2.5', padPx: 10 };
    }
    return { rowHeight: 82, margin: [6, 6], padClass: 'p-1.5', padPx: 6 };
  }, [monitorProfile]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setContainerWidth(rect.width);
    if (rect.height > 0) setContainerHeight(rect.height);
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const h = e.contentRect.height;
      if (w > 0) setContainerWidth(w);
      if (h > 0) setContainerHeight(h);
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
    updateTerminalPrefs((current) => ({
      ...current,
      layout: {
        ...(current.layout || {}),
        mode: locked ? 'fixed' : 'edit',
      },
    }));
  }, [locked]);

  useEffect(() => {
    updateTerminalPrefs((current) => ({
      ...current,
      layout: {
        ...(current.layout || {}),
        pinnedWidgetIds,
      },
    }));
  }, [pinnedWidgetIds]);

  useEffect(() => {
    updateTerminalPrefs((current) => ({
      ...current,
      symbol: {
        ...(current.symbol || {}),
        active: normalizeTicker(activeSymbol),
      },
    }));
  }, [activeSymbol]);

  useEffect(() => {
    if (availableSymbols.includes(activeSymbol)) return;
    if (availableSymbols.length > 0) {
      setActiveSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, activeSymbol]);

  useEffect(() => {
    if (!locked || activePresetId) return;
    setLayout((prev) => {
      const next = buildAdaptiveFixedLayout(prev, monitorProfile, pinnedWidgetSet);
      return layoutsEqual(prev, next) ? prev : next;
    });
  }, [locked, activePresetId, monitorProfile, pinnedWidgetSet]);

  const activeIds = useMemo(() => layout.map((l) => l.i), [layout]);
  const renderedLayout = useMemo(
    () =>
      layout.map((item) => ({
        ...item,
        static: locked || pinnedWidgetSet.has(item.i),
        isDraggable: !locked && !pinnedWidgetSet.has(item.i),
        isResizable: !locked && !pinnedWidgetSet.has(item.i),
      })),
    [layout, locked, pinnedWidgetSet],
  );
  const totalGridRows = useMemo(
    () =>
      Math.max(
        1,
        renderedLayout.reduce((max, item) => Math.max(max, (item.y || 0) + (item.h || 0)), 0),
      ),
    [renderedLayout],
  );
  const adaptiveRowHeight = useMemo(() => {
    if (!locked) return gridMetrics.rowHeight;

    const marginY = Array.isArray(gridMetrics.margin) ? Number(gridMetrics.margin[1] || 0) : 0;
    const availableHeight = Math.max(280, Math.floor(containerHeight - (gridMetrics.padPx * 2)));
    const containerPaddingY = marginY;
    const fitHeight = Math.floor(
      (
        availableHeight
        - (Math.max(0, totalGridRows - 1) * marginY)
        - (containerPaddingY * 2)
        - 2
      ) / totalGridRows,
    );

    return Math.max(20, Math.min(gridMetrics.rowHeight, fitHeight));
  }, [locked, gridMetrics, containerHeight, totalGridRows]);

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

  const toggleWidgetPin = useCallback((widgetId) => {
    if (!widgetId || !DEFS[widgetId]) return;
    setPinnedWidgetIds((prev) => {
      const set = new Set(prev);
      if (set.has(widgetId)) {
        set.delete(widgetId);
      } else {
        set.add(widgetId);
      }
      return Array.from(set);
    });
  }, []);

  const refreshPortfolio = useCallback(() => {
    const queries = portfolio?.queries ? Object.values(portfolio.queries) : [];
    for (const query of queries) {
      if (typeof query?.refetch === 'function') {
        void query.refetch();
      }
    }
  }, [portfolio]);

  return (
    <div className={`terminal-pro flex flex-1 flex-col ${C.bg} min-h-0`}>
      {/* Toolbar */}
      <div className={`relative z-40 flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-3 py-1.5`}>
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-3.5 w-3.5 text-violet-200/60" />
          <span className="text-[11px] text-slate-500">Layout</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Lock / Unlock toggle */}
          <button
            onClick={() => setLocked(v => !v)}
            title={locked ? 'Enable edit mode' : 'Return to fixed mode'}
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-200 ${
              locked
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-violet-300/40 bg-violet-400/14 text-violet-100 hover:border-violet-300/50'
            }`}
          >
            {locked
              ? <Lock className="h-3.5 w-3.5" />
              : <Unlock className="h-3.5 w-3.5" />}
            {locked ? 'Edit Layout' : 'Fixed Layout'}
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

      {!canQueryPortfolio && (
        <div className="flex shrink-0 items-center justify-between border-b border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100">
          <span className="truncate pr-3">
            {siweError ?? portfolioStreamGateReason ?? 'Portfolio stream is paused.'}
          </span>
          <button
            type="button"
            onClick={() => {
              siweAttemptKey.current = '';
              void runSiweRef.current();
            }}
            disabled={!address || onWrongChain || sessionLoading}
            className="shrink-0 rounded border border-amber-300/30 px-2 py-0.5 text-[10px] font-medium text-amber-50 transition-colors hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry SIWE
          </button>
        </div>
      )}

      {/* Grid */}
      <div ref={containerRef} className={`flex-1 ${locked ? 'overflow-hidden' : 'overflow-auto'} ${gridMetrics.padClass}`}>
        <ReactGridLayout
          className="layout"
          layout={renderedLayout}
          cols={12}
          rowHeight={adaptiveRowHeight}
          width={containerWidth}
          draggableHandle=".drag-handle"
          margin={gridMetrics.margin}
          containerPadding={gridMetrics.margin}
          isResizable={!locked}
          isDraggable={!locked}
          resizeHandles={['se', 'sw', 'ne', 'nw']}
          compactType="vertical"
          preventCollision={false}
          onLayoutChange={locked ? undefined : commitLayout}
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
                    pinned={pinnedWidgetSet.has(i)}
                    onTogglePin={() => toggleWidgetPin(i)}
                    symbol={activeSymbol}
                    walletConnected={Boolean(isConnected && address && sessionMatchesWallet)}
                    ownerAddress={sessionMatchesWallet ? address : null}
                    subaccountName={subaccountName}
                    getNadoClient={getNadoClient}
                    positions={terminalPositions}
                    positionsLoading={positionsLoading}
                    positionsError={positionsError}
                    nadoSummary={portfolio.nadoSummary}
                    marketMetaLookup={marketMetaLookup}
                    onOrderPlaced={refreshPortfolio}
                    availableSymbols={availableSymbols}
                    onSymbolChange={handleSymbolChange}
                    nadoAppOrigin={nadoAppOrigin}
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
