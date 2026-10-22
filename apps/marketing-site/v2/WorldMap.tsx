import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MARKETS, HUB } from '../src/data/works-v2';
type P = [number, number][];
const LAND: P[] = [
  [[-168,66],[-140,70],[-95,72],[-80,63],[-62,60],[-55,50],[-66,44],[-76,35],[-81,25],[-90,29],[-97,26],[-97,20],[-88,15],[-80,8],[-85,11],[-105,20],[-112,29],[-117,33],[-124,40],[-125,49],[-135,58],[-152,58],[-165,60]],
  [[-50,60],[-20,70],[-20,82],[-60,82],[-73,77]],
  [[-80,8],[-60,10],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-55],[-72,-50],[-74,-40],[-71,-18],[-81,-5]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[0,50],[5,54],[8,57],[5,62],[15,69],[28,71],[40,68],[45,60],[40,48],[30,45],[28,41],[22,37],[15,38],[12,44],[3,42]],
  [[-5,50],[1,51],[0,55],[-3,58],[-6,56]],
  [[-17,15],[-17,21],[-10,30],[-6,35],[10,37],[20,32],[32,31],[35,28],[43,12],[51,11],[40,-3],[40,-15],[33,-26],[20,-35],[15,-25],[12,-6],[8,4],[-8,4]],
  [[28,41],[40,48],[45,60],[60,70],[80,73],[105,78],[140,72],[180,68],[170,60],[155,58],[140,52],[135,43],[127,36],[122,30],[121,22],[110,20],[108,12],[104,1],[98,10],[93,22],[88,22],[80,14],[77,8],[72,20],[66,25],[57,25],[50,30],[48,29],[55,23],[58,20],[52,16],[43,13],[35,28],[35,36]],
  [[95,5],[105,-6],[115,-8],[120,-9],[140,-8],[150,-6],[130,0],[118,2],[110,2],[100,3]],
  [[130,31],[136,34],[141,36],[142,43],[140,41],[135,35]],
  [[118,8],[122,18],[126,12],[124,6]],
  [[114,-22],[122,-18],[131,-12],[137,-12],[142,-10],[146,-18],[153,-25],[150,-37],[140,-38],[132,-32],[115,-34]],
  [[44,-13],[50,-15],[48,-25],[44,-22]],
];
const inside = (x: number, y: number, poly: P) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const K = 3; const pr = (lon: number, lat: number) => [(lon + 180) * K, (84 - lat) * K];
export function WorldMap() {
  const dots = useMemo(() => { const d: [number, number][] = []; for (let lat = 82; lat > -58; lat -= 2.6) for (let lon = -178; lon < 180; lon += 2.6) if (LAND.some(p => inside(lon, lat, p))) d.push([lon, lat]); return d; }, []);
  const [hx, hy] = pr(...HUB);
  return (
    <svg viewBox={`0 0 ${360 * K} ${142 * K}`} className="worldmap" aria-label="World map of live markets (sample)">
      <defs><radialGradient id="mglow"><stop offset="0" stopColor="#D6153C" stopOpacity="0.9" /><stop offset="1" stopColor="#D6153C" stopOpacity="0" /></radialGradient></defs>
      {dots.map(([lon, lat], i) => { const [x, y] = pr(lon, lat); return <circle key={i} cx={x} cy={y} r={2.1} fill="#fff" opacity={0.16} />; })}
      {MARKETS.map(([lon, lat, k], i) => { const [x, y] = pr(lon, lat); const mx = (x + hx) / 2, my = Math.min(y, hy) - 60 - Math.abs(x - hx) * 0.12;
        return <g key={k}>
          <motion.path d={`M${hx},${hy} Q${mx},${my} ${x},${y}`} fill="none" stroke="#D6153C" strokeWidth="1.3" strokeOpacity="0.55" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
          <motion.circle cx={x} cy={y} r={16} fill="url(#mglow)" initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.08 }} style={{ transformOrigin: `${x}px ${y}px` }} />
          <circle cx={x} cy={y} r={3.4} fill="#fff" />
          <circle cx={x} cy={y} r={4} fill="none" stroke="#D6153C" className="ping" style={{ animationDelay: `${i * 0.27}s`, transformOrigin: `${x}px ${y}px` }} />
        </g>; })}
      <circle cx={hx} cy={hy} r={6} fill="#D6153C" /><circle cx={hx} cy={hy} r={12} fill="none" stroke="#D6153C" strokeOpacity="0.6" />
    </svg>
  );
}
