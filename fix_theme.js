const fs = require('fs');

// 1. Update SolidBlock.jsx to have a nice deep blue/slate tint instead of harsh black
let solidCode = fs.readFileSync('client/src/components/SolidBlock.jsx', 'utf8');
solidCode = solidCode.replace(/bg-\[\#09090b\]/g, 'bg-[#0F172A]'); // Tailwind Slate-900 (rich dark blue-gray)
solidCode = solidCode.replace(/border-white\/\[0\.08\]/g, 'border-blue-400/20'); // Slightly more bluish border
fs.writeFileSync('client/src/components/SolidBlock.jsx', solidCode);

// 2. Update App.jsx backgrounds
let appCode = fs.readFileSync('client/src/App.jsx', 'utf8');

// The main background: was bg-black, let's make it a very pleasant deep blue
appCode = appCode.replace(/bg-black/g, 'bg-[#09101E]'); // Or #0A1128

// Inner card backgrounds (currently dark gray/black)
appCode = appCode.replace(/bg-\[\#0c0c0e\]/g, 'bg-[#151E32]'); // Lighter blue/gray for inner elements
appCode = appCode.replace(/bg-\[\#0a0a0c\]/g, 'bg-[#111827]'); // Slightly darker slate for chart/logo container
appCode = appCode.replace(/bg-\[\#121214\]/g, 'bg-[#1E293B]'); // Button bg
appCode = appCode.replace(/bg-\[\#1a1a1d\]/g, 'bg-[#334155]'); // Button hover

// Update border colors inside the app to match the softer blue theme
appCode = appCode.replace(/border-white\/\[0\.04\]/g, 'border-blue-400/10');
appCode = appCode.replace(/border-white\/\[0\.06\]/g, 'border-blue-400/20');
appCode = appCode.replace(/border-white\/\[0\.08\]/g, 'border-blue-400/25');
appCode = appCode.replace(/border-white\/10/g, 'border-blue-400/30');
appCode = appCode.replace(/border-white\/20/g, 'border-blue-400/40');
appCode = appCode.replace(/border-white\/30/g, 'border-blue-400/50');

// Update slight white fills to slight blue fills
appCode = appCode.replace(/bg-white\/\[0\.015\]/g, 'bg-blue-400/[0.03]');
appCode = appCode.replace(/bg-white\/\[0\.02\]/g, 'bg-blue-400/[0.04]');
appCode = appCode.replace(/bg-white\/\[0\.03\]/g, 'bg-blue-400/[0.06]');
appCode = appCode.replace(/bg-white\/\[0\.04\]/g, 'bg-blue-400/[0.08]');
appCode = appCode.replace(/bg-white\/5/g, 'bg-blue-400/10');
appCode = appCode.replace(/bg-white\/10/g, 'bg-blue-400/20');

// Update text colors for harmony
appCode = appCode.replace(/text-white\/30/g, 'text-blue-200/40');
appCode = appCode.replace(/text-white\/40/g, 'text-blue-200/50');
appCode = appCode.replace(/text-white\/50/g, 'text-blue-200/60');
appCode = appCode.replace(/text-white\/60/g, 'text-blue-200/70');
appCode = appCode.replace(/text-white\/70/g, 'text-blue-100/80');
appCode = appCode.replace(/text-white\/90/g, 'text-white/95'); // Keep high contrast bright text bright

// The glowing blobs in the background - make them slightly more vibrant/cyan
appCode = appCode.replace(/rgba\(60,140,255,0\.16\)/g, 'rgba(56,189,248,0.2)'); // Light blue / cyan
appCode = appCode.replace(/rgba\(169,105,255,0\.18\)/g, 'rgba(129,140,f8,0.2)'); // Indigo

fs.writeFileSync('client/src/App.jsx', appCode);
console.log('Theme shifted from deep black to a pleasant, lighter dark-blue/slate palette.');
