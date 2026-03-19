import React, { useState, useEffect, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Sparkles, Activity, Bolt, BarChart3, AlignLeft, GripHorizontal,
  Send, Star, Newspaper, Clock, LayoutGrid, X, Plus, Eye,
  Flame, ChevronUp, ChevronDown, Lock, Unlock, Bookmark, Save, Trash2,
} from 'lucide-react';
import SolidBlock from '../components/SolidBlock';
import ElectricButton from '../components/ElectricButton';

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

// в”Ђв”Ђв”Ђ Chart в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const ChartWidget = ({ onClose, locked }) => {
  const [tf, setTf] = useState(2);
  return (
    <div className={WIDGET_SHELL_CLASS}>
      <WH icon={BarChart3} title="BTC / USD" onClose={onClose} locked={locked}
        extra={<span className="font-mono text-xs font-bold" style={C.greenGlow}>+2.81%</span>}
      />
      {/* body; blocks drag */}
      <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
        <div className={`flex shrink-0 items-center gap-0.5 border-b ${C.bRow} ${C.bg} px-3 py-1`}>
          {['1m','5m','15m','1h','4h','1D'].map((t, i) => (
            <button key={t} onClick={() => setTf(i)}
              className={`rounded px-2.5 py-1 text-[12px] font-mono transition-colors ${
                i === tf ? 'bg-violet-400/12 text-violet-100 shadow-[0_0_10px_rgba(196,181,253,0.18)]'
                         : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className={`relative flex-1 ${C.bg}`} style={{ overflow: 'hidden' }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(196,181,253,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(196,181,253,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" style={{ overflow: 'hidden' }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(167,139,250,0.2)" />
                <stop offset="100%" stopColor="rgba(167,139,250,0)" />
              </linearGradient>
              <clipPath id="cc"><rect x="0" y="0" width="100" height="100" /></clipPath>
            </defs>
            <g clipPath="url(#cc)">
              <path d="M0,80 Q10,75 20,60 T40,50 T60,40 T80,20 T100,10 L100,100 L0,100 Z" fill="url(#cg)" />
              <path d="M0,80 Q10,75 20,60 T40,50 T60,40 T80,20 T100,10"
                fill="none" stroke="#c4b5fd" strokeWidth="0.8" strokeDasharray="200" strokeDashoffset="200">
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="3s" fill="freeze" />
              </path>
              <circle cx="100" cy="10" r="1" fill="#e9d5ff">
                <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
          <div className="absolute bottom-2.5 right-2.5 rounded border border-violet-200/18 bg-[rgba(11,12,28,0.86)] px-2 py-0.5 font-mono text-[12px] font-bold" style={C.blueGlow}>
            $108,442
          </div>
        </div>
      </div>
    </div>
  );
};

// в”Ђв”Ђв”Ђ Order Book в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
    <div className="relative z-10 w-[44%] font-mono text-[12px]" style={side === 'ask' ? C.redGlow : C.greenGlow}>{r.price}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[12px] text-slate-300">{r.amount}</div>
    <div className="relative z-10 w-[28%] text-right font-mono text-[12px] text-slate-500">{r.total}</div>
  </div>
);

const OrderBookWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={AlignLeft} title="Order Book" onClose={onClose} locked={locked} />
    <div className="flex flex-1 flex-col overflow-hidden" onMouseDown={nodrag}>
      <div className={`flex shrink-0 items-center border-b ${C.bRow} px-3 py-1.5`}>
        <div className="w-[44%] text-[10px] uppercase tracking-wider text-slate-500">Price (USD)</div>
        <div className="w-[28%] text-right text-[10px] uppercase tracking-wider text-slate-500">Size</div>
        <div className="w-[28%] text-right text-[10px] uppercase tracking-wider text-slate-500">Total</div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col justify-end overflow-hidden py-0.5">
          {[...asks].reverse().map((r, i) => <BookRow key={i} r={r} side="ask" />)}
        </div>
        <div className={`flex shrink-0 items-center justify-center gap-2 border-y ${C.bRow} bg-violet-400/[0.05] py-1.5`}>
          <span className="font-mono text-sm font-bold" style={C.blueGlow}>108,442.00</span>
          <span className="text-[10px] text-slate-500">mark</span>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden py-0.5">
          {bids.map((r, i) => <BookRow key={i} r={r} side="bid" />)}
        </div>
      </div>
    </div>
  </div>
);

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
  ['Size',   '0.35 BTC'],
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

const ExecutionWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Bolt} title="Order Entry" onClose={onClose} locked={locked} />
    <div className="flex flex-1 flex-col gap-1 p-2 min-h-0" onMouseDown={nodrag}>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1 min-h-0">
        {FIELDS.map(([label, value]) => (
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
const POSITIONS = [
  { side: 'LONG',  pair: 'BTC-USD', size: '2.5 BTC',  entry: '102,150', mark: '108,442', pnl: '+$15,730', win: true  },
  { side: 'SHORT', pair: 'ETH-USD', size: '15.0 ETH', entry:   '4,210', mark:   '4,182', pnl:   '+$420',  win: true  },
];

const PositionsWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Activity} title="Positions (2)" onClose={onClose} locked={locked}
      extra={<span className="font-mono text-[12px] text-slate-500">PnL: <span className="font-bold" style={C.greenGlow}>+$16,150</span></span>}
    />
    <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
      <table className="w-full text-left">
        <thead className={`${C.bg} sticky top-0`}>
          <tr>
            {THEAD.map((h, i) => (
              <th key={h} className={`py-2 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${C.bRow}`}>
          {POSITIONS.map((p, i) => (
            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-2.5 px-3 text-xs font-bold text-white">
                <span className="mr-1.5 font-mono text-[12px]" style={p.side === 'LONG' ? C.greenGlow : C.redGlow}>{p.side}</span>
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

// в”Ђв”Ђв”Ђ Watchlist в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const COINS = [
  { sym: 'BTC',  name: 'Bitcoin',   price: '108,442', ch: '+2.81', up: true  },
  { sym: 'ETH',  name: 'Ethereum',  price:   '4,182', ch: '-0.64', up: false },
  { sym: 'SOL',  name: 'Solana',    price:   '182.4', ch: '+5.12', up: true  },
  { sym: 'ARB',  name: 'Arbitrum',  price:    '1.84', ch: '+1.30', up: true  },
  { sym: 'DOGE', name: 'Dogecoin',  price:   '0.182', ch: '-2.10', up: false },
  { sym: 'AVAX', name: 'Avalanche', price:   '38.72', ch: '+3.44', up: true  },
];

const WatchlistWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Star} title="Watchlist" onClose={onClose} locked={locked} />
    <div className={`flex-1 overflow-auto divide-y ${C.bRow}`} onMouseDown={nodrag}>
      {COINS.map(c => (
        <div key={c.sym} className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-violet-400/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${C.border} bg-violet-400/[0.08] font-mono text-[10px] font-bold text-violet-100`}>
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

// в”Ђв”Ђв”Ђ Trade History в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const TRADES = [
  { time: '14:32:01', side: 'BUY',  price: '108,280', pnl: '+$580',   win: true  },
  { time: '13:15:44', side: 'SELL', price: '108,100', pnl: '+$210',   win: true  },
  { time: '12:01:12', side: 'BUY',  price: '107,950', pnl: '-$120',   win: false },
  { time: '11:47:08', side: 'SELL', price: '108,400', pnl: '+$1,240', win: true  },
  { time: '10:22:33', side: 'BUY',  price: '106,800', pnl: '+$890',   win: true  },
];

const TRADE_UP_STYLE = {
  color: '#34f5a3',
  textShadow: '0 0 8px rgba(52, 245, 163, 0.4)',
}

const TRADE_DOWN_STYLE = {
  color: '#ff6487',
  textShadow: '0 0 8px rgba(255, 100, 135, 0.35)',
}

const TradeHistoryWidget = ({ onClose, locked }) => (
  <div className={WIDGET_SHELL_CLASS}>
    <WH icon={Clock} title="Trade History" onClose={onClose} locked={locked} />
    <div className="flex-1 overflow-auto" onMouseDown={nodrag}>
      <table className="w-full">
        <thead className={`${C.bg} sticky top-0`}>
          <tr>
            {[['Time','left'],['Side','left'],['Price','right'],['PnL','right']].map(([h,a]) => (
              <th key={h} className={`py-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500 ${a === 'right' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${C.bRow}`}>
          {TRADES.map((t, i) => (
            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-2 px-3 font-mono text-[13px] text-slate-200">{t.time}</td>
              <td className="py-2 px-3 font-mono text-[13px] font-bold" style={t.side==='BUY' ? TRADE_UP_STYLE : TRADE_DOWN_STYLE}>{t.side}</td>
              <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-300">{t.price}</td>
              <td className="py-2 px-3 text-right font-mono text-[13px] font-bold" style={t.win ? TRADE_UP_STYLE : TRADE_DOWN_STYLE}>{t.pnl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

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
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [layout, setLayout]       = useState(DEFAULT_LAYOUT);
  const [showPanel, setShowPanel] = useState(false);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [locked, setLocked]       = useState(false);
  const [presets, setPresets] = useState(() => readStoredPresets());
  const [activePresetId, setActivePresetId] = useState(null);

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

  const activeIds = layout.map(l => l.i);
  const renderedLayout = layout.map(item => ({
    ...item,
    static: locked,
    isDraggable: !locked,
    isResizable: !locked,
  }));

  const addWidget = id => {
    if (!DEFS[id]) return;
    setLayout((prev) => {
      if (prev.some((item) => item.i === id)) return prev;
      const maxY = prev.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      return [...prev, { i: id, x: 0, y: maxY, ...DEFS[id].dfl }];
    });
  };

  const savePreset = (name) => {
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
  };

  const loadPreset = (presetId) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const normalized = normalizeLayout(preset.layout);
    if (normalized.length === 0) return;

    setLayout(normalized);
    setActivePresetId(presetId);
    setShowPanel(false);
    setShowPresetPanel(false);
  };

  const deletePreset = (presetId) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    setActivePresetId((prev) => (prev === presetId ? null : prev));
  };

  return (
    <div className={`flex flex-1 flex-col ${C.bg} min-h-0`}>
      {/* Toolbar */}
      <div className={`relative z-40 flex shrink-0 items-center justify-between border-b ${C.bRow} ${C.bgCard} px-4 py-2`}>
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-3.5 w-3.5 text-violet-200/60" />
          <span className="text-[12px] text-slate-400">{activeIds.length} widgets</span>
          {!locked && <span className="text-[12px] text-slate-600">- drag header - resize corners</span>}
          {locked && <span className="text-[12px] text-amber-500/80">- layout locked</span>}
        </div>
        <div className="flex items-center gap-2">
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
          onLayoutChange={locked ? undefined : setLayout}
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

