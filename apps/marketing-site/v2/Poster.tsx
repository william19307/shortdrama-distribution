import React, { useId } from 'react';
import type { WorkV2 } from '../src/data/works-v2';

const bust = (cx: number, base: number, s: number, hair: boolean) => {
  const p = (x: number, y: number) => `${cx + x * s},${base + y * s}`;
  return { body: `M${p(-70, 0)} L${p(-64, -36)} Q${p(-52, -60)} ${p(-13, -64)} L${p(-9, -76)} L${p(9, -76)} L${p(13, -64)} Q${p(52, -60)} ${p(64, -36)} L${p(70, 0)} Z`, head: [cx, base - 98 * s, 19 * s, 24 * s] as const, hair: hair ? `M${p(-22, -100)} Q${p(-26, -132)} ${p(0, -126)} Q${p(28, -130)} ${p(24, -96)} Q${p(30, -62)} ${p(18, -58)} L${p(-18, -58)} Q${p(-32, -64)} ${p(-22, -100)} Z` : '' };
};
const split = (t: string) => { const w = t.toUpperCase().split(' '); const lines: string[] = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > 13 && cur) { lines.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } lines.push(cur); return lines.slice(0, 3); };

export function Poster({ w, lang = 'en', compact = false }: { w: WorkV2; lang?: string; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [c0, c1] = w.hue; const L = w.layout; const lines = split(w.en);
  const figs = L === 0 ? [bust(72, 300, 1.05, true), bust(135, 300, 1.2, false)] : L === 1 ? [bust(100, 300, 1.35, w.id.length % 2 === 0)] : L === 2 ? [bust(100, 300, 0.62, true)] : [bust(132, 330, 2.1, false)];
  const ty = L === 3 ? 92 : 64;
  return (
    <svg viewBox="0 0 200 300" className="poster" role="img" aria-label={w.en} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor={c0} /><stop offset="0.6" stopColor="#07070a" /><stop offset="1" stopColor="#000" /></linearGradient>
        <radialGradient id={`gl${id}`} cx={L === 3 ? '0.3' : '0.5'} cy={L === 2 ? '0.62' : '0.55'} r="0.6"><stop offset="0" stopColor={c1} stopOpacity="0.95" /><stop offset="0.45" stopColor={c1} stopOpacity="0.28" /><stop offset="1" stopColor={c1} stopOpacity="0" /></radialGradient>
        <linearGradient id={`fd${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0.85" /><stop offset="0.35" stopColor="#000" stopOpacity="0" /><stop offset="0.7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.9" /></linearGradient>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor="#fff" stopOpacity="0.7" /></linearGradient>
      </defs>
      <rect width="200" height="300" fill={`url(#bg${id})`} />
      <rect width="200" height="300" fill={`url(#gl${id})`} />
      {[...Array(5)].map((_, i) => <polygon key={i} points={`${60 + i * 22},-10 ${70 + i * 22},-10 ${20 + i * 45},300 ${-10 + i * 45},300`} fill={c1} opacity={0.05 + (i % 2) * 0.03} />)}
      {[...Array(9)].map((_, i) => <circle key={i} cx={(i * 47 + w.views / 1e5) % 200} cy={120 + ((i * 71) % 120)} r={1 + (i % 3) * 2.2} fill="#fff" opacity={0.05 + (i % 4) * 0.04} />)}
      {L === 2 && <g fill="#030305">{[...Array(14)].map((_, i) => { const h = 40 + ((i * 53) % 90); return <rect key={i} x={i * 15 - 5} y={300 - h - 40} width={13} height={h + 40} />; })}{[...Array(30)].map((_, i) => <rect key={'w' + i} x={(i * 29) % 200} y={190 + ((i * 17) % 60)} width="2" height="3" fill={c1} opacity="0.6" />)}</g>}
      {figs.map((f, i) => <g key={i}>
        {f.hair && <path d={f.hair} fill="#020203" />}
        <ellipse cx={f.head[0]} cy={f.head[1]} rx={f.head[2]} ry={f.head[3]} fill="#020203" stroke={`url(#rim${id})`} strokeWidth="1.2" strokeOpacity="0.7" />
        <path d={f.body} fill="#020203" stroke={`url(#rim${id})`} strokeWidth="1.2" strokeOpacity="0.6" />
      </g>)}
      <rect width="200" height="300" fill={`url(#fd${id})`} />
      <text x="100" y="20" textAnchor="middle" className="p-kicker">A STARRIVER ORIGINAL</text>
      {!compact && <text x="100" y="32" textAnchor="middle" className="p-tag">{lang === 'zh' ? w.tagZh : w.tagEn}</text>}
      <g transform={`translate(0 ${300 - ty - (lines.length - 1) * 19})`}>
        {lines.map((l, i) => <text key={i} x="100" y={i * 19} textAnchor="middle" className="p-title" textLength={l.length > 9 ? 176 : undefined} lengthAdjust="spacingAndGlyphs">{l}</text>)}
        <text x="100" y={lines.length * 19 - 2} textAnchor="middle" className="p-zh">{w.title}</text>
      </g>
      <line x1="70" y1="276" x2="130" y2="276" stroke={c1} strokeWidth="1.5" />
      <text x="100" y="290" textAnchor="middle" className="p-foot">{w.year} · {w.eps} EPISODES</text>
      <g transform="translate(8 268)"><rect width="30" height="13" rx="2" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" /><text x="15" y="9.3" textAnchor="middle" className="p-rate">{w.rated}</text></g>
      <g transform="translate(160 268)"><rect width="32" height="13" rx="2" fill="#D6153C" /><text x="16" y="9.3" textAnchor="middle" className="p-rate">SAMPLE</text></g>
    </svg>
  );
}
