import React from 'react';
import { Work, PLAT_COLOR, fmtViews } from './data/works';
export const Demo = ({ children = '示例' }: { children?: React.ReactNode }) => <span className="demo">{children}</span>;
export const PBadge = ({ p, sm }: { p: string; sm?: boolean }) => <span className={'pb' + (sm ? ' sm' : '')} style={{ ['--pc' as any]: PLAT_COLOR[p] }}><i />{p}</span>;
export function Cover({ w, big, children }: { w: Work; big?: boolean; children?: React.ReactNode }) {
  return (
    <div className={'cover' + (big ? ' big' : '')} style={{ background: `radial-gradient(120% 80% at 80% 10%, ${w.hue[1]}cc, transparent 60%), linear-gradient(160deg, ${w.hue[0]}, ${w.hue[1]} 140%)` }}>
      <svg className="cv-art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <circle cx="210" cy="120" r="90" fill="#fff" opacity=".08" /><circle cx="210" cy="120" r="55" fill="#fff" opacity=".07" />
        <path d="M0 330 Q80 270 150 310 T300 290 V400 H0Z" fill="#000" opacity=".35" />
        <path d="M110 400 C110 300 130 250 160 230 C175 220 195 225 200 250 C205 280 200 330 215 400Z" fill="#000" opacity=".45" />
        <circle cx="172" cy="205" r="26" fill="#000" opacity=".45" />
      </svg>
      <span className="cv-motif">{w.motif}</span>
      <div className="cv-txt"><div className="cv-en">{w.en}</div><div className="cv-t">{w.title}</div></div>
      <span className="cv-demo">示例封面</span>
      {children}
    </div>
  );
}
export function WorkCard({ w, onClick }: { w: Work; onClick: () => void }) {
  return (
    <div className="wcard" onClick={onClick}>
      <Cover w={w}><span className="cv-ep">{w.eps} 集</span>{w.hot && <span className="cv-hot">爆款</span>}</Cover>
      <div className="wc-body">
        <div className="wc-t">{w.title}</div>
        <div className="wc-p">{w.platforms.map(p => <PBadge key={p} p={p} sm />)}</div>
        <div className="meta">{w.genre} · {w.lang} · {fmtViews(w.views)}次播放</div>
      </div>
    </div>
  );
}
export function Curve({ data, h = 220 }: { data: number[]; h?: number }) {
  const W = 640, pad = 36, max = Math.max(...data) * 1.1;
  const pts = data.map((v, i) => [pad + (i * (W - pad - 12)) / (data.length - 1), h - 28 - (v / max) * (h - 48)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0]} ${h - 28} L${pad} ${h - 28}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="curve" role="img" aria-label="累计播放曲线">
      <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#D6153C" stopOpacity=".35" /><stop offset="1" stopColor="#D6153C" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const y = 20 + (i * (h - 48)) / 3; return <g key={i}><line x1={pad} x2={W - 12} y1={y} y2={y} className="grid" /><text x={pad - 6} y={y + 4} textAnchor="end" className="ax">{fmtViews(max * (1 - i / 3)).replace(' ', '')}</text></g>; })}
      <path d={area} fill="url(#cg)" /><path d={line} fill="none" stroke="#D6153C" strokeWidth="2.5" strokeLinejoin="round" className="cline" />
      {pts.map((p, i) => <g key={i}>{i % 2 === 1 || i === data.length - 1 ? <text x={p[0]} y={h - 8} textAnchor="middle" className="ax">第{i + 1}周</text> : null}{i === data.length - 1 && <circle cx={p[0]} cy={p[1]} r="5" fill="#D6153C" stroke="#fff" strokeWidth="2" />}</g>)}
    </svg>
  );
}
