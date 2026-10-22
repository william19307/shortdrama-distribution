import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, animate, useScroll, useTransform } from 'framer-motion';
import { DICT, I18n, useT, type Lang } from './i18n';
import { Poster } from './Poster';
import { WorldMap } from './WorldMap';
import { BRAND, WORKS_V2, TOP10, ROWS, PLATFORMS, STATS, TESTIMONIALS_V2, type WorkV2 } from '../src/data/works-v2';

const ease = [0.22, 1, 0.36, 1] as const;
const Reveal = ({ children, d = 0, y = 28, className }: { children: React.ReactNode; d?: number; y?: number; className?: string }) =>
  <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.9, delay: d, ease }}>{children}</motion.div>;
const fmt = (n: number) => n >= 1e8 ? (n / 1e9 >= 1 ? (n / 1e9).toFixed(1) + 'B' : (n / 1e6).toFixed(0) + 'M') : (n / 1e6).toFixed(0) + 'M';
const Br = ({ s }: { s: string }) => <>{s.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</>;
const SampleTag = () => { const { t } = useT(); return <span className="sample">{t.sample}</span>; };

function Nav({ onOpen }: { onOpen: () => void }) {
  const { t, lang, setLang } = useT(); const [solid, setSolid] = useState(false); const [menu, setMenu] = useState(false);
  useEffect(() => { const f = () => setSolid(scrollY > 40); f(); addEventListener('scroll', f); return () => removeEventListener('scroll', f); }, []);
  const links: [string, string][] = [['originals', t.nav.originals], ['top10', t.nav.top10], ['platform', t.nav.platform], ['global', t.nav.global], ['contact', t.nav.contact]];
  return <header className={'nav' + (solid ? ' solid' : '')}>
    <a className="brand" href="#top" aria-label={BRAND.name}><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 1l2.6 8.4H23l-6.8 5 2.6 8.4L12 17.8l-6.8 5 2.6-8.4L1 9.4h8.4z" fill="#D6153C" /></svg><b>StarRiver</b><span>Global</span><SampleTag /></a>
    <nav className="links">{links.map(([id, l]) => <a key={id} href={'#' + id}>{l}</a>)}</nav>
    <div className="nav-r">
      <div className="lang" role="group" aria-label="Language">{(['en', 'zh'] as Lang[]).map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l === 'en' ? 'EN' : '中文'}</button>)}</div>
      <a className="btn btn-sm hide-m" href="#contact">{t.cta}</a>
      <button className="burger" aria-label="Menu" onClick={() => setMenu(!menu)}><i /><i /></button>
    </div>
    <AnimatePresence>{menu && <motion.div className="mmenu" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)}>
      {links.map(([id, l]) => <a key={id} href={'#' + id}>{l}</a>)}<a className="btn" href="#contact">{t.cta}</a></motion.div>}</AnimatePresence>
  </header>;
}

function Hero({ open }: { open: (w: WorkV2) => void }) {
  const { t, lang } = useT(); const [i, setI] = useState(0); const feats = [WORKS_V2[0], WORKS_V2[2], WORKS_V2[13]];
  useEffect(() => { const h = setInterval(() => setI(x => (x + 1) % 3), 6000); return () => clearInterval(h); }, []);
  const { scrollY } = useScroll(); const yb = useTransform(scrollY, [0, 800], [0, 160]); const op = useTransform(scrollY, [0, 600], [1, 0.2]);
  const f = feats[i];
  return <section className="hero" id="top">
    <motion.div className="hero-bg" style={{ y: yb, opacity: op }}>
      <AnimatePresence mode="sync"><motion.div key={i} className="collage" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease }}>
        {[0, 1, 2, 3, 4, 5].map(c => <div key={c} className={'col ' + (c % 2 ? 'up' : 'down')}>{[0, 1, 2, 3].map(r => { const w = WORKS_V2[(c * 3 + r * 5 + i * 4) % 16]; return <div key={r} className="tile"><Poster w={w} lang={lang} compact /></div>; })}</div>)}
      </motion.div></AnimatePresence>
      <div className="hero-glow" style={{ background: `radial-gradient(60% 60% at 70% 40%, ${f.hue[1]}55, transparent 70%)` }} />
    </motion.div>
    <div className="hero-shade" />
    <div className="wrap hero-c">
      <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, ease }}>{t.hero.eyebrow}</motion.p>
      <h1 className="display">{[t.hero.h1a, t.hero.h1b].map((l, k) => <span className="ln" key={lang + k}><motion.span initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1.1, delay: .1 + k * .12, ease }}>{k ? <em>{l}</em> : l}</motion.span></span>)}</h1>
      <motion.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .5, duration: 1 }}>{t.hero.sub}</motion.p>
      <motion.div className="ctas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .7, duration: .8, ease }}>
        <a className="btn" href="#contact">{t.hero.primary}<span className="arr">→</span></a><a className="btn ghost" href="#originals">▶&nbsp; {t.hero.secondary}</a></motion.div>
    </div>
    <div className="wrap hero-now">
      <AnimatePresence mode="wait"><motion.button key={i} className="now" onClick={() => open(f)} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: .6, ease }}>
        <span className="now-k">{t.hero.now} · <SampleTag /></span><span className="now-t">{lang === 'zh' ? f.title : f.en}</span><span className="now-s">{lang === 'zh' ? f.tagZh : f.tagEn}</span></motion.button></AnimatePresence>
      <div className="dots">{feats.map((_, k) => <button key={k} aria-label={'slide ' + (k + 1)} className={k === i ? 'on' : ''} onClick={() => setI(k)}><i /></button>)}</div>
    </div>
  </section>;
}

function Card({ w, open }: { w: WorkV2; open: (w: WorkV2) => void }) {
  const { t, lang } = useT();
  return <div className="card" tabIndex={0} onClick={() => open(w)} onKeyDown={e => e.key === 'Enter' && open(w)}>
    <div className="card-in"><Poster w={w} lang={lang} />
      <div className="card-info"><div className="ci-btns"><span className="cb play">▶</span><span className="cb">+</span><span className="cb">♡</span><span className="cb r">⌄</span></div>
        <div className="ci-meta"><b className="match">{w.match}% {t.card.match}</b><span className="rt">{w.rated}</span><span>{w.eps} {t.card.eps}</span></div>
        <div className="ci-g">{lang === 'zh' ? w.genre : w.genreEn} · {lang === 'zh' ? w.lang : w.langEn} · {fmt(w.views)} {t.card.views}</div></div></div>
  </div>;
}
function Row({ title, items, open }: { title: string; items: WorkV2[]; open: (w: WorkV2) => void }) {
  const ref = useRef<HTMLDivElement>(null); const go = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return <Reveal className="row"><div className="wrap row-h"><h3>{title}</h3><div className="row-ctl"><button aria-label="prev" onClick={() => go(-1)}>‹</button><button aria-label="next" onClick={() => go(1)}>›</button></div></div>
    <div className="row-s" ref={ref}>{items.map(w => <Card key={w.id} w={w} open={open} />)}</div></Reveal>;
}

function Top10({ open }: { open: (w: WorkV2) => void }) {
  const { t, lang } = useT(); const ref = useRef<HTMLDivElement>(null);
  return <section className="sec" id="top10"><div className="wrap"><Reveal><div className="sec-h"><h2 className="h2"><span className="t10">TOP 10</span> {lang === 'zh' ? '本季' : 'this season'}</h2><p className="muted">{t.top10.s} <SampleTag /></p></div></Reveal></div>
    <div className="top-s" ref={ref}>{TOP10.map((w, i) => <motion.div key={w.id} className="top" onClick={() => open(w)} initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * .06, duration: .8, ease }}>
      <span className="num">{i + 1}</span><div className="top-p"><Poster w={w} lang={lang} compact /></div></motion.div>)}</div></section>;
}

function Counter({ v, dec, suf }: { v: number; dec: number; suf: string }) {
  const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true });
  useEffect(() => { if (!inView) return; const c = animate(0, v, { duration: 2.2, ease, onUpdate: x => { if (ref.current) ref.current.textContent = x.toFixed(dec) + suf; } }); return () => c.stop(); }, [inView]);
  return <span ref={ref}>{(0).toFixed(dec) + suf}</span>;
}
function Stats() {
  const { t } = useT();
  return <section className="sec stats"><div className="wrap"><Reveal><h2 className="h2 center">{t.stats.t}</h2></Reveal>
    <div className="stat-g">{STATS.map((s, i) => <Reveal key={s.k} d={i * .08} className="stat"><div className="big"><Counter {...s} /></div><div className="lbl">{(t.stats as any)[s.k]}</div></Reveal>)}</div>
    <p className="center muted small"><SampleTag /> {t.footer.rights}</p></div></section>;
}

function MapSec() {
  const { t } = useT();
  return <section className="sec mapsec" id="global"><div className="wrap map-g">
    <Reveal className="map-txt"><p className="eyebrow">{t.map.eyebrow}</p><h2 className="h2"><Br s={t.map.t} /></h2><p className="lede sm">{t.map.s}</p>
      <div className="legend"><i />{t.map.live} · 15 <SampleTag /></div></Reveal>
    <Reveal d={.15} className="map-v"><WorldMap /></Reveal></div></section>;
}

function Bento() {
  const { t } = useT(); const b = t.bento;
  const Tile = ({ k, cls, children, d }: { k: keyof typeof b; cls: string; children: React.ReactNode; d: number }) => { const v = b[k] as string[];
    return <motion.div className={'tile-b ' + cls} initial={{ opacity: 0, y: 40, scale: .98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: .9, delay: d, ease }}>
      <div className="tb-txt"><p className="tb-k">{v[0]}</p><h4>{v[1]}</h4></div><div className="tb-v">{children}</div></motion.div>; };
  return <section className="sec" id="platform"><div className="wrap">
    <Reveal><p className="eyebrow">{b.eyebrow}</p><h2 className="h2">{b.t}</h2></Reveal>
    <div className="bento">
      <Tile k="dist" cls="b-dist" d={0}><div className="orbit">{PLATFORMS.map((p, i) => <span key={p} style={{ ['--a' as any]: i * 72 + 'deg' }}><em>{p}</em></span>)}<div className="core">SR</div></div></Tile>
      <Tile k="wm" cls="b-wm" d={.08}><div className="wm"><div className="wm-frame"><Poster w={WORKS_V2[8]} compact /><div className="wm-tile">{[...Array(24)].map((_, i) => <span key={i}>SR·7F3A·EP{String(i % 12 + 1).padStart(2, '0')}</span>)}</div><div className="scan" /></div><div className="wm-tag">● TRACE ID 7F3A-21C9 · MATCHED</div></div></Tile>
      <Tile k="loc" cls="b-loc" d={.12}><div className="hellos">{['Hello', 'Hola', 'Olá', 'こんにちは', 'Halo', 'สวัสดี', '안녕하세요', 'Bonjour', 'مرحبا', 'Xin chào', 'Ciao', 'Hallo'].map((h, i) => <span key={h} style={{ animationDelay: i * .25 + 's' }}>{h}</span>)}</div></Tile>
      <Tile k="rec" cls="b-rec" d={.16}><div className="ledger">{WORKS_V2.slice(0, 4).map((w, i) => <div key={w.id} className="lg-r"><span>EP{12 - i * 3}</span><span>{w.platforms[0]}</span><span className="num-m">${(w.views / 1e3 * .021).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span><span className="ok">✓</span></div>)}</div></Tile>
      <Tile k="set" cls="b-set" d={.2}><div className="settle">{t.settle.steps.map((s, i) => <motion.div key={s} className="st" initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: .5 + i * .15 }}><i>{i + 1}</i>{s}</motion.div>)}</div></Tile>
      <Tile k="ana" cls="b-ana" d={.24}><div className="bars">{[38, 52, 46, 70, 64, 88, 79, 96].map((h, i) => <motion.i key={i} initial={{ height: 0 }} whileInView={{ height: h + '%' }} viewport={{ once: true }} transition={{ delay: .4 + i * .06, duration: .9, ease }} />)}</div></Tile>
    </div></div></section>;
}

function Flow() {
  const { t } = useT();
  return <section className="sec"><div className="wrap"><Reveal><p className="eyebrow">{t.flow.eyebrow}</p><h2 className="h2">{t.flow.t}</h2></Reveal>
    <div className="flow">{t.flow.steps.map(([h, p], i) => <Reveal key={h} d={i * .1} className="fs"><span className="fs-n">0{i + 1}</span><div className="fs-line"><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: .2 + i * .15, ease }} /></div><h4>{h}</h4><p>{p}</p></Reveal>)}</div></div></section>;
}

function Partners() {
  const { t } = useT(); const list = [...PLATFORMS, ...PLATFORMS, ...PLATFORMS, ...PLATFORMS];
  return <section className="sec partners" id="partners"><div className="wrap"><Reveal><p className="center muted">{t.partners.t}</p></Reveal></div>
    <div className="marquee"><div className="mq-in">{list.map((p, i) => <span key={i} className="wordmark">{p}</span>)}</div></div></section>;
}

function Voices() {
  const { t, lang } = useT();
  return <section className="sec"><div className="wrap"><Reveal><h2 className="h2">{t.voice.t}</h2></Reveal>
    <div className="voices">{TESTIMONIALS_V2.map((v, i) => <Reveal key={v.name} d={i * .1} className="voice"><span className="q">“</span><p>{lang === 'zh' ? v.zh : v.en}</p>
      <div className="who"><span className="av">{v.name[0]}</span><div><b>{v.name}</b><small>{lang === 'zh' ? v.roleZh : v.roleEn} · <SampleTag /></small></div></div></Reveal>)}</div></div></section>;
}

function Join() {
  const { t } = useT(); const j = t.join;
  const [f, setF] = useState({ company: '', name: '', email: '', titles: '', msg: '', agree: false }); const [err, setErr] = useState<Record<string, string>>({}); const [ok, setOk] = useState(false);
  const submit = (e: React.FormEvent) => { e.preventDefault(); const er: Record<string, string> = {};
    (['company', 'name', 'titles'] as const).forEach(k => { if (!f[k].trim()) er[k] = j.err.required; });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) er.email = f.email ? j.err.email : j.err.required; if (!f.agree) er.agree = j.err.agree;
    setErr(er); if (!Object.keys(er).length) setOk(true); };
  const fld = (k: 'company' | 'name' | 'email', type = 'text') => <label className={'fld' + (err[k] ? ' bad' : '') + (f[k] ? ' filled' : '')}><input id={k} type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder=" " /><span>{j[k]}</span>{err[k] && <em>{err[k]}</em>}</label>;
  return <section className="sec join" id="contact"><div className="join-glow" /><div className="wrap join-g">
    <Reveal><p className="eyebrow">{j.eyebrow}</p><h2 className="display sm"><Br s={j.t} /></h2><p className="lede sm">{j.s}</p><p className="muted small">{BRAND.email} · <SampleTag /></p></Reveal>
    <Reveal d={.1}><AnimatePresence mode="wait">{ok ? <motion.div key="ok" className="form ok" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><div className="okc">✓</div><h4>{j.ok}</h4><p className="muted">{j.okNote}</p></motion.div> :
      <motion.form key="f" className="form" onSubmit={submit} noValidate>
        {fld('company')}{fld('name')}{fld('email', 'email')}
        <label className={'fld' + (err.titles ? ' bad' : '') + ' filled'}><select id="titles" value={f.titles} onChange={e => setF({ ...f, titles: e.target.value })}><option value="">{j.select}</option><option>1–5</option><option>6–20</option><option>21–50</option><option>50+</option></select><span>{j.titles}</span>{err.titles && <em>{err.titles}</em>}</label>
        <label className={'fld' + (f.msg ? ' filled' : '')}><textarea id="msg" rows={3} value={f.msg} onChange={e => setF({ ...f, msg: e.target.value })} placeholder=" " /><span>{j.msg}</span></label>
        <label className={'chk' + (err.agree ? ' bad' : '')}><input id="agree" type="checkbox" checked={f.agree} onChange={e => setF({ ...f, agree: e.target.checked })} /><i />{j.agree}{err.agree && <em>{err.agree}</em>}</label>
        <button className="btn full" type="submit">{j.submit}<span className="arr">→</span></button></motion.form>}</AnimatePresence></Reveal>
  </div></section>;
}

function Modal({ w, close }: { w: WorkV2 | null; close: () => void }) {
  const { t, lang } = useT();
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && close(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);
  return <AnimatePresence>{w && <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
    <motion.div className="md" initial={{ y: 40, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: .5, ease }} onClick={e => e.stopPropagation()}>
      <button className="md-x" onClick={close} aria-label={t.modal.close}>✕</button>
      <div className="md-p"><Poster w={w} lang={lang} /></div>
      <div className="md-b"><p className="eyebrow">{lang === 'zh' ? w.genre : w.genreEn} · <SampleTag /></p><h3>{lang === 'zh' ? w.title : w.en}</h3><p className="md-tag">{lang === 'zh' ? w.tagZh : w.tagEn}</p>
        <div className="ci-meta"><b className="match">{w.match}% {t.card.match}</b><span className="rt">{w.rated}</span><span>{w.year}</span><span>{w.eps} {t.card.eps}</span><span>★ {w.rating}</span></div>
        <p className="muted">{lang === 'zh' ? w.desc : `${w.tagEn} A ${w.eps}-episode ${w.genreEn.toLowerCase()} vertical drama, originally in ${w.langEn}.`}</p>
        <dl><dt>{t.modal.platforms}</dt><dd>{w.platforms.join(' · ')}</dd><dt>{t.card.views}</dt><dd>{fmt(w.views)}</dd><dt>{t.modal.lang}</dt><dd>{lang === 'zh' ? w.lang : w.langEn}</dd></dl></div>
    </motion.div></motion.div>}</AnimatePresence>;
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('sr-lang') as Lang) || 'en'); const [cur, setCur] = useState<WorkV2 | null>(null);
  useEffect(() => { localStorage.setItem('sr-lang', lang); document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);
  const ctx = useMemo(() => ({ lang, setLang, t: DICT[lang] }), [lang]); const t = ctx.t;
  return <I18n.Provider value={ctx}>
    <div className="banner">{t.sampleNote}</div>
    <Nav onOpen={() => {}} /><Hero open={setCur} />
    <section className="rows" id="originals">{ROWS.map(r => <Row key={r.key} title={(t.rows as any)[r.key]} items={r.ids} open={setCur} />)}</section>
    <Top10 open={setCur} /><Stats /><MapSec /><Bento /><Flow /><Partners /><Voices /><Join />
    <footer className="foot"><div className="wrap foot-g"><a className="brand" href="#top"><b>StarRiver</b><span>Global</span><SampleTag /></a><span className="muted small">© 2026 {BRAND.name} ({t.sample}). {t.footer.rights}</span><span className="muted small">{t.footer.privacy} · {t.footer.terms}</span></div></footer>
    <Modal w={cur} close={() => setCur(null)} />
  </I18n.Provider>;
}
