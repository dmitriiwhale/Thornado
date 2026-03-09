import React, { useState, useEffect, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Sparkles, Activity, Bolt, BarChart3, AlignLeft, GripHorizontal,
  Send, Star, Newspaper, Clock, LayoutGrid, X, Plus, Eye,
  Flame, ChevronUp, ChevronDown, Lock, Unlock,
} from 'lucide-react';
import SolidBlock from '../components/SolidBlock';
import ElectricButton from '../components/ElectricButton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  accent:    'text-sky-300',
  muted:     'text-slate-400',
  dim:       'text-slate-500',
  greenGlow: { color: '#6ee7b7' },
  redGlow:   { color: '#fca5a5' },
  blueGlow:  { color: '#7dd3fc' },
  bg:        'bg-[#07101c]',
  bgCard:    'bg-[#0c1829]',
  border:    'border-sky-400/20',
  bRow:      'border-slate-700/40',
};

// Blocks drag propagation — use on widget body (below drag-handle)
const nodrag = (e) => e.stopPropagation();

// ─── Widget Header ────────────────────────────────────────────────────────────
const WH = ({ icon: Icon, title, badge, onClose, extra, locked }) => (
  <div className={`drag-handle flex h-10 shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-3 select-none ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
      <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
      {badge && (
        <span className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
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
          className="flex h-5 w-5 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-700/60 hover:text-sky-300"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

// ─── Chart ────────────────────────────────────────────────────────────────────
const ChartWidget = ({ onClose, locked }) => {
  const [tf, setTf] = useState(2);
  return (
    <div className="flex h-full flex-col">
      <WH icon={BarChart3} title="BTC / USD" onClose={onClose} locked={locked}
        extra={<span className="font-mono text-xs font-bold" style={C.greenGlow}>+2.81%</span>}
      />
      {/* body — blocks drag */}
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`flex shrink-0 items-center gap-0.5 border-b ${C.bRow} ${C.bg} px-3 py-1`}>
          {['1m','5m','15m','1h','4h','1D'].map((t, i) => (
            <button key={t} onClick={() => setTf(i)}
              className={`rounded px-2.5 py-1 text-[11px] font-mono transition-colors ${
                i === tf ? 'bg-sky-400/15 text-sky-200 shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                         : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className={`relative flex-1 ${C.bg}`} style={{ overflow: 'hidden' }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.03)_1px,transparent_1px)] [background-size:40px_40px]" />
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" style={{ overflow: 'hidden' }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(56,189,248,0.20)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0)" />
              </linearGradient>
              <clipPath id="cc"><rect x="0" y="0" width="100" height="100" /></clipPath>
            </defs>
            <g clipPath="url(#cc)">
              <path d="M0,80 Q10,75 20,60 T40,50 T60,40 T80,20 T100,10 L100,100 L0,100 Z" fill="url(#cg)" />
              <path d="M0,80 Q10,75 20,60 T40,50 T60,40 T80,20 T100,10"
                fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="200" strokeDashoffset="200">
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="3s" fill="freeze" />
              </path>
              <circle cx="100" cy="10" r="1" fill="#7dd3fc">
                <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
          <div className="absolute bottom-2.5 right-2.5 rounded border border-sky-400/25 bg-[#07101c] px-2 py-0.5 font-mono text-[11px] font-bold" style={C.blueGlow}>
            $108,442
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Order Book ───────────────────────────────────────────────────────────────
const asks = [
  { price: '108,450.00', amount: '2.14', total: '14.50' },
  { price: '108,448.50', amount: '0.85', total: '12.36' },
  { price: '108,445.00', amount: '5.10', total: '11.51' },
  { price: '108,443.20', amount: '1.20', total: '6.41'  },
  { price: '108,442.50', amount: '5.21', total: '5.21'  },
];
const bids = [
  { price: '108,441.00', amount: '0.45', total: '0.45'  },
  { price: '108,439.50', amount: '2.30', total: '2.75'  },
  { price: '108,438.00', amount: '1.80', total: '4.55'  },
  { price: '108,435.50', amount: '8.40', total: '12.95' },
  { price: '108,430.00', amount: '3.10', total: '16.05' },
];

const BookRow = ({ r, side }) => (
  <div className="group relative flex items-center px-3 py-[3px] hover:bg-slate-800/30">
    <div className={`absolute right-0 top-0 h-full ${side === 'ask' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}
      style={{ width: `${(parseFloat(r.total) / 16) * 100}%` }} />
    <div className="relative z-10 w-[44%] font-mono text-[11px]" style={side === 'ask' ? C.redGlow : C.greenGlow}>{r.price}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[11px] text-slate-300">{r.amount}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[11px] text-slate-500">{r.total}</div>
  </div>
);

const OrderBookWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={AlignLeft} title="Order Book" onClose={onClose} locked={locked} />
    <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
      <div className={`flex shrink-0 items-center border-b ${C.bRow} px-3 py-1.5`}>
        <div className="w-[44%] text-[9px] uppercase tracking-wider text-slate-500">Price (USD)</div>
        <div className="w-[28%] text-right text-[9px] uppercase tracking-wider text-slate-500">Size</div>
        <div className="w-[28%] text-right text-[9px] uppercase tracking-wider text-slate-500">Total</div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col justify-end overflow-hidden py-0.5">
          {[...asks].reverse().map((r, i) => <BookRow key={i} r={r} side="ask" />)}
        </div>
        <div className={`flex shrink-0 items-center justify-center gap-2 border-y ${C.bRow} bg-sky-400/[0.04] py-1.5`}>
          <span className="font-mono text-sm font-bold" style={C.blueGlow}>108,442.00</span>
          <span className="text-[9px] text-slate-500">mark</span>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden py-0.5">
          {bids.map((r, i) => <BookRow key={i} r={r} side="bid" />)}
        </div>
      </div>
    </div>
  </div>
);

// ─── AI Assistant ─────────────────────────────────────────────────────────────
const AiAssistantWidget = ({ onClose, locked }) => {
  const [input, setInput]     = useState('');
  const [msgs, setMsgs]       = useState([
    { role: 'ai', text: 'Liquidity sweep above local highs detected. Retest probability 74%. Wait for reclaim above $108,280 then scale in.' },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const send = () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: txt }]);
    setLoading(true);
    setTimeout(() => {
      setMsgs(m => [...m, { role: 'ai', text: 'BTC bullish divergence on 15m RSI. Key resistance $108,850. Invalidation $107,600. R/R 1:3.2.' }]);
      setLoading(false);
    }, 1200);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  return (
    <div className="flex h-full flex-col">
      <WH icon={Sparkles} title="THORN AI" badge="Live" onClose={onClose} locked={locked} />
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'ai' && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/35">
                  <Sparkles className="h-3 w-3 text-sky-300" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                m.role === 'ai'
                  ? `rounded-tl-sm border ${C.border} bg-sky-900/10 text-sky-100/85`
                  : `rounded-tr-sm border ${C.bRow} bg-slate-800/40 text-slate-200`
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/35">
                <Sparkles className="h-3 w-3 text-sky-300 animate-pulse" />
              </div>
              <div className={`flex items-center gap-1 rounded-xl rounded-tl-sm border ${C.border} bg-sky-900/10 px-3 py-2`}>
                {[0,1,2].map(d => <span key={d} className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: `${d*0.15}s` }} />)}
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
              className={`w-full rounded-lg border ${C.bRow} ${C.bg} py-2 pl-3 pr-8 text-[11px] text-white placeholder-slate-600 outline-none transition-all focus:border-sky-400/50 focus:ring-1 focus:ring-sky-500/25`}
            />
            <button onClick={send}
              className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded transition-all ${
                input ? 'bg-sky-500 text-white shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'bg-slate-800 text-slate-600'}`}>
              <Send className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Execution ────────────────────────────────────────────────────────────────
const FIELDS = [
  ['Type',   'Limit'],
  ['Size',   '0.35 BTC'],
  ['Entry',  '108,280'],
  ['Inval.', '107,920'],
];

const ExecutionWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Bolt} title="Order Entry" onClose={onClose} locked={locked} />
    <div className="flex flex-1 flex-col gap-1 p-2 min-h-0" onMouseDown={nodrag}>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1 min-h-0">
        {FIELDS.map(([label, value]) => (
          <div key={label}
            className="flex flex-col justify-center overflow-hidden rounded-lg border border-slate-700/40 bg-white/[0.02] px-2 hover:bg-sky-400/[0.05] transition-colors cursor-pointer">
            <div className="text-[7px] uppercase tracking-[0.15em] text-sky-400/45 leading-none">{label}</div>
            <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1">
        {/* SELL */}
        <button className="group relative h-7 overflow-hidden rounded-lg border border-red-500/35 bg-red-500/[0.07] transition-all duration-200 hover:border-red-400/65 hover:bg-red-500/[0.16] active:scale-95">
          <div className="absolute inset-x-0 top-0 h-px w-[200%] -translate-x-full bg-gradient-to-r from-transparent via-red-400 to-transparent opacity-0 group-hover:animate-[electric-sweep_1.6s_infinite] group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 h-px w-[200%] translate-x-full bg-gradient-to-l from-transparent via-red-400 to-transparent opacity-0 group-hover:animate-[electric-sweep-reverse_1.6s_infinite] group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(239,68,68,0.2), transparent 65%)' }} />
          <span className="relative z-10 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest text-red-300 group-hover:text-red-200">
            <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 7L0.5 1.5h7L4 7z"/></svg>
            Sell
          </span>
        </button>
        {/* BUY */}
        <button className="group relative h-7 overflow-hidden rounded-lg border border-emerald-500/35 bg-emerald-500/[0.07] transition-all duration-200 hover:border-emerald-400/65 hover:bg-emerald-500/[0.16] active:scale-95">
          <div className="absolute inset-x-0 top-0 h-px w-[200%] -translate-x-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 group-hover:animate-[electric-sweep_1.6s_infinite] group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 h-px w-[200%] translate-x-full bg-gradient-to-l from-transparent via-emerald-400 to-transparent opacity-0 group-hover:animate-[electric-sweep-reverse_1.6s_infinite] group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(52,211,153,0.2), transparent 65%)' }} />
          <span className="relative z-10 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300 group-hover:text-emerald-200">
            <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 1L7.5 6.5H0.5L4 1z"/></svg>
            Buy
          </span>
        </button>
      </div>
    </div>
  </div>
);

// ─── Positions ────────────────────────────────────────────────────────────────
const THEAD = ['Market', 'Size', 'Entry', 'Mark', 'PnL'];
const POSITIONS = [
  { side: 'LONG',  pair: 'BTC-USD', size: '2.5 BTC',  entry: '102,150', mark: '108,442', pnl: '+$15,730', win: true  },
  { side: 'SHORT', pair: 'ETH-USD', size: '15.0 ETH', entry:   '4,210', mark:   '4,182', pnl:   '+$420',  win: true  },
];

const PositionsWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Activity} title="Positions (2)" onClose={onClose} locked={locked}
      extra={<span className="font-mono text-[11px] text-slate-500">PnL: <span className="font-bold" style={C.greenGlow}>+$16,150</span></span>}
    />
    <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
      <table className="w-full text-left">
        <thead className={`${C.bg} sticky top-0`}>
          <tr>
            {THEAD.map((h, i) => (
              <th key={h} className={`py-2 px-3 text-[9px] font-medium uppercase tracking-wider text-slate-500 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${C.bRow}`}>
          {POSITIONS.map((p, i) => (
            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-2.5 px-3 text-xs font-bold text-white">
                <span className="mr-1.5 font-mono text-[11px]" style={p.side === 'LONG' ? C.greenGlow : C.redGlow}>{p.side}</span>
                {p.pair}
              </td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{p.size}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{p.entry}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-white">{p.mark}</td>
              <td className="py-2.5 px-3 text-right font-mono text-xs font-bold" style={p.win ? C.greenGlow : C.redGlow}>{p.pnl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─── Watchlist ────────────────────────────────────────────────────────────────
const COINS = [
  { sym: 'BTC',  name: 'Bitcoin',   price: '108,442', ch: '+2.81', up: true  },
  { sym: 'ETH',  name: 'Ethereum',  price:   '4,182', ch: '-0.64', up: false },
  { sym: 'SOL',  name: 'Solana',    price:   '182.4', ch: '+5.12', up: true  },
  { sym: 'ARB',  name: 'Arbitrum',  price:    '1.84', ch: '+1.30', up: true  },
  { sym: 'DOGE', name: 'Dogecoin',  price:   '0.182', ch: '-2.10', up: false },
  { sym: 'AVAX', name: 'Avalanche', price:   '38.72', ch: '+3.44', up: true  },
];

const WatchlistWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Star} title="Watchlist" onClose={onClose} locked={locked} />
    <div className={`flex-1 overflow-auto divide-y ${C.bRow}`} onMouseDown={nodrag}>
      {COINS.map(c => (
        <div key={c.sym} className="flex items-center justify-between px-3 py-2 hover:bg-sky-400/[0.04] cursor-pointer transition-colors">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${C.border} bg-sky-400/[0.07] font-mono text-[10px] font-bold text-sky-300`}>
              {c.sym.slice(0,2)}
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-white leading-none">{c.sym}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs font-semibold text-white leading-none">${c.price}</div>
            <div className="mt-0.5 flex items-center justify-end gap-0.5 font-mono text-[10px] font-semibold" style={c.up ? C.greenGlow : C.redGlow}>
              {c.up ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              {c.ch}%
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Trade History ────────────────────────────────────────────────────────────
const TRADES = [
  { time: '14:32:01', side: 'BUY',  price: '108,280', pnl: '+$580',   win: true  },
  { time: '13:15:44', side: 'SELL', price: '108,100', pnl: '+$210',   win: true  },
  { time: '12:01:12', side: 'BUY',  price: '107,950', pnl: '-$120',   win: false },
  { time: '11:47:08', side: 'SELL', price: '108,400', pnl: '+$1,240', win: true  },
  { time: '10:22:33', side: 'BUY',  price: '106,800', pnl: '+$890',   win: true  },
];

const TradeHistoryWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Clock} title="Trade History" onClose={onClose} locked={locked} />
    <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
      <table className="w-full">
        <thead className={`${C.bg} sticky top-0`}>
          <tr>
            {[['Time','left'],['Side','left'],['Price','right'],['PnL','right']].map(([h,a]) => (
              <th key={h} className={`py-2 px-3 text-[9px] font-medium uppercase tracking-wider text-slate-500 text-${a}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${C.bRow}`}>
          {TRADES.map((t, i) => (
            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{t.time}</td>
              <td className="py-2 px-3 font-mono text-[11px] font-bold" style={t.side==='BUY' ? C.greenGlow : C.redGlow}>{t.side}</td>
              <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-400">{t.price}</td>
              <td className="py-2 px-3 text-right font-mono text-[11px] font-bold" style={t.win ? C.greenGlow : C.redGlow}>{t.pnl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─── News Feed ────────────────────────────────────────────────────────────────
const NEWS = [
  { time: '2m ago',  tag: 'BULLISH', title: 'BlackRock BTC ETF sees record $1.2B inflow in single day',          tc: 'text-emerald-300', bc: 'border-emerald-500/30 bg-emerald-500/10' },
  { time: '8m ago',  tag: 'NEUTRAL', title: 'Fed minutes: policymakers see no rush to cut rates further',        tc: 'text-yellow-300',  bc: 'border-yellow-500/30 bg-yellow-500/10'  },
  { time: '15m ago', tag: 'BULLISH', title: 'MicroStrategy acquires 5,000 BTC at avg $107,200',                  tc: 'text-emerald-300', bc: 'border-emerald-500/30 bg-emerald-500/10' },
  { time: '31m ago', tag: 'BEARISH', title: 'SEC delays decision on spot ETH options, market reacts cautiously', tc: 'text-red-300',      bc: 'border-red-500/30 bg-red-500/10'         },
  { time: '1h ago',  tag: 'NEUTRAL', title: 'Crypto derivatives open interest hits $45B all-time high',           tc: 'text-yellow-300',  bc: 'border-yellow-500/30 bg-yellow-500/10'  },
];

const NewsFeedWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Newspaper} title="News Feed" badge="Live" onClose={onClose} locked={locked} />
    <div className={`flex-1 overflow-auto divide-y ${C.bRow}`} onMouseDown={nodrag}>
      {NEWS.map((n, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5 hover:bg-sky-400/[0.03] cursor-pointer transition-colors">
          <div className="flex items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${n.tc} ${n.bc}`}>{n.tag}</span>
            <span className="text-[10px] text-slate-500">{n.time}</span>
          </div>
          <p className="text-[11px] leading-snug text-slate-400">{n.title}</p>
        </div>
      ))}
    </div>
  </div>
);

// ─── Market Stats ─────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Market Cap',    value: '$2.14T',  sub: '+3.2% 24h'    },
  { label: '24h Volume',    value: '$148.3B', sub: 'Spot + Perps'  },
  { label: 'BTC Dominance', value: '54.8%',   sub: '-0.4% 24h'    },
  { label: 'Fear & Greed',  value: '78',      sub: 'Extreme Greed' },
  { label: 'Funding Rate',  value: '0.012%',  sub: 'BTC Perp 8h'  },
  { label: 'Open Interest', value: '$45.1B',  sub: 'All-time high' },
];

const MarketStatsWidget = ({ onClose, locked }) => (
  <div className="flex h-full flex-col">
    <WH icon={Flame} title="Market Stats" onClose={onClose} locked={locked} />
    <div className="grid flex-1 grid-cols-2 gap-px overflow-auto bg-slate-800/15 p-px" onMouseDown={nodrag}>
      {STATS.map(s => (
        <div key={s.label} className={`flex flex-col justify-center ${C.bgCard} p-3 hover:bg-sky-400/[0.04] transition-colors`}>
          <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{s.label}</div>
          <div className="mt-1 font-mono text-base font-bold text-white">{s.value}</div>
          <div className="text-[9px] text-slate-500">{s.sub}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Widget registry ──────────────────────────────────────────────────────────
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

// ─── Add Widget Panel ─────────────────────────────────────────────────────────
const AddWidgetPanel = ({ activeIds, onAdd, onClose }) => (
  <div
    className={`absolute top-9 right-0 z-50 w-56 overflow-hidden rounded-2xl border ${C.border} ${C.bgCard} shadow-[0_8px_40px_rgba(0,0,0,0.7)]`}
    onMouseDown={e => e.stopPropagation()}
  >
    <div className={`flex items-center justify-between border-b ${C.bRow} px-4 py-2.5`}>
      <span className="text-xs font-bold text-white">Add Widget</span>
      <button onClick={onClose} className="rounded p-0.5 text-slate-500 hover:text-sky-300 transition-colors">
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
              active ? 'cursor-default opacity-35' : 'hover:bg-sky-400/[0.07] cursor-pointer'}`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
              active ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : `${C.border} bg-sky-400/[0.07]`}`}>
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-400' : 'text-sky-300'}`} />
            </div>
            <span className="flex-1 text-xs font-medium text-white">{def.label}</span>
            {active ? <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    : <Plus className="h-3.5 w-3.5 shrink-0 text-sky-300" />}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Terminal Grid ─────────────────────────────────────────────────────────────
const TerminalGrid = () => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [layout, setLayout]       = useState(DEFAULT_LAYOUT);
  const [showPanel, setShowPanel] = useState(false);
  const [locked, setLocked]       = useState(false);

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
    if (!showPanel) return;
    const h = () => setShowPanel(false);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [showPanel]);

  const activeIds = layout.map(l => l.i);

  const addWidget = id => {
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setLayout(prev => [...prev, { i: id, x: 0, y: maxY, ...DEFS[id].dfl }]);
  };

  return (
    <div className={`flex flex-1 flex-col ${C.bg} min-h-0`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(56,189,248,0.07),transparent_35%),radial-gradient(ellipse_at_85%_80%,rgba(34,211,238,0.04),transparent_32%)]" />

      {/* Toolbar */}
      <div className={`relative z-40 flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-4 py-2`}>
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-3.5 w-3.5 text-sky-400/60" />
          <span className="text-[11px] text-slate-400">{activeIds.length} widgets</span>
          {!locked && <span className="text-[11px] text-slate-600">· drag header · resize corners</span>}
          {locked && <span className="text-[11px] text-amber-500/80">· layout locked</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Lock / Unlock toggle */}
          <button
            onClick={() => setLocked(v => !v)}
            title={locked ? 'Unlock layout' : 'Lock layout'}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 ${
              locked
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'border-slate-600/50 bg-slate-800/40 text-slate-500 hover:border-sky-400/40 hover:text-sky-300'
            }`}
          >
            {locked
              ? <Lock className="h-3.5 w-3.5" />
              : <Unlock className="h-3.5 w-3.5" />}
          </button>

          {/* Add widget */}
          {!locked && (
            <div className="relative" onMouseDown={e => e.stopPropagation()}>
              <ElectricButton primary className="h-7 px-3 text-[11px] font-medium"
                onClick={() => setShowPanel(v => !v)}>
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
          layout={layout}
          onLayoutChange={locked ? undefined : setLayout}
          cols={12}
          rowHeight={88}
          width={containerWidth}
          draggableHandle=".drag-handle"
          margin={[10, 10]}
          isResizable={!locked}
          isDraggable={!locked}
          resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'e']}
          compactType={null}
          preventCollision={true}
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
