import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  App as AntApp, Button, Card, ConfigProvider, Drawer, Form, Input, InputNumber, Layout, Menu, Modal, Progress, Radio, Segmented,
  Select, Space, Statistic, Steps, Switch, Table, Tabs, Tag, Tooltip, Checkbox, Empty, Pagination, Alert, Badge,
} from 'antd';
import type { TableColumnsType } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import {
  AppstoreOutlined, BarChartOutlined, CheckCircleOutlined, CloudUploadOutlined, DollarOutlined, FileSearchOutlined,
  PlaySquareOutlined, PlusOutlined, SearchOutlined, SettingOutlined, TeamOutlined, FilterOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { getAntdTheme, toneToTagColor } from '../antdTheme';
import tokens, { bizStatus, chart, colors, motion as mo, neutral, type BizStatus, type ThemeName } from '../tokens';

type Lang = 'zh' | 'en';
const T = {
  zh: {
    toc: ['颜色', '字体', '间距', '圆角阴影', '动效', '组件', 'antd 实样', '后台紧凑'],
    heroK: 'Cinematic Design System · v1', heroA: '一套系统，', heroB: '两种舞台。',
    heroSub: '从短剧发行营销站 v2 提炼：纯黑底、品牌红 #D6153C、系统字体栈、大字号紧字距与克制的动效。营销站与后台（antd v5）共用同一组 tokens。',
    cta: '查看组件', cta2: '接入说明',
    color: ['颜色', '深色为默认舞台，浅色为后台日间变体。语义色只承担状态，不做装饰。'], brand: '品牌色', neutral: '中性色阶', semantic: '语义 / 表面色（当前主题）', statusC: '状态色',
    type: ['字体阶梯', '系统字体栈，展示级字号使用负字距（-0.04 ~ -0.06em），正文 -0.011em。'],
    space: ['间距与栅格', '4px 基准；最大宽 1360、边距 56/22、12 栏、间隔 16；版块纵向 140/96。'],
    radius: ['圆角 · 阴影 · 发光 · 渐变', '大卡 24–28、海报 8、输入 10–14、按钮全胶囊；红色发光只给主行动点。'],
    motion: ['动效', '统一缓动 ease-out (.22,1,.36,1)。点击卡片重播。'], replay: '点击重播',
    comp: ['核心组件', '按钮、海报卡、数据大数字、bento、状态徽章、图表配色、空状态。'],
    buttons: '按钮', posters: '海报卡 / 封面卡', stats: '数据大数字卡', bento: 'Bento 卡片', badges: '状态徽章', charts: '图表配色', empty: '空状态',
    s: ['累计播放', '在投剧目', '待结算金额', '审核通过率'],
    bt: [['分发', '一次上传，十二个平台同步上架'], ['本地化', '6 种语言字幕与配音'], ['结算', '对账透明，T+30 到账'], ['数据', '按剧、按平台、按天实时看板']],
    emptyT: '还没有作品', emptyD: '上传第一部短剧，审核通过后即可分发到海外平台。', upload: '上传作品',
    antd: ['antd 组件实样', '以下均为原生 antd v5 组件，仅套用 getAntdTheme()。'],
    cols: ['作品', '状态', '平台', '播放量', '收益 (USD)', '操作'], view: '查看', settle: '结算',
    form: '提交作品', fTitle: '剧名', fGenre: '类型', fEp: '集数', fLang: '目标语言', fNote: '简介', submit: '提交审核', cancel: '取消', openM: '打开弹窗', openD: '打开抽屉',
    mTitle: '确认提交审核？', mBody: '提交后作品将进入审核队列，预计 1–2 个工作日内给出结果。审核期间不可编辑。',
    steps: ['上传', '审核', '本地化', '分发', '结算'],
    tabs: ['全部', '审核中', '已上线', '已驳回'],
    admin: ['后台 · 紧凑密度', 'compact 变体：控件 30px、正文 13px、单元格 8/12；数字列等宽右对齐。'],
    menu: ['总览', '作品管理', '审核队列', '分发', '结算中心', '数据', '团队', '设置'], search: '搜索剧名 / ID',
  },
  en: {
    toc: ['Color', 'Type', 'Space', 'Radius', 'Motion', 'Components', 'antd', 'Admin'],
    heroK: 'Cinematic Design System · v1', heroA: 'One system,', heroB: 'two stages.',
    heroSub: 'Distilled from the short-drama marketing site v2: pure black, brand red #D6153C, system font stack, huge tight type and restrained motion. Shared by the site and the antd v5 admin.',
    cta: 'Browse components', cta2: 'Integration',
    color: ['Color', 'Dark is the default stage; light is the daytime admin variant. Semantic colors carry status only.'], brand: 'Brand', neutral: 'Neutral ramp', semantic: 'Semantic / surface (current theme)', statusC: 'Status',
    type: ['Type scale', 'System font stack. Display sizes use negative tracking (-0.04 ~ -0.06em); body -0.011em.'],
    space: ['Spacing & grid', '4px base; max 1360, gutter 56/22, 12 columns, gap 16; section padding 140/96.'],
    radius: ['Radius · shadow · glow · gradient', 'Big cards 24–28, posters 8, inputs 10–14, buttons pill. Red glow is reserved for the primary action.'],
    motion: ['Motion', 'One easing: ease-out (.22,1,.36,1). Click a card to replay.'], replay: 'Click to replay',
    comp: ['Core components', 'Buttons, posters, big stats, bento, status badges, chart palette, empty states.'],
    buttons: 'Buttons', posters: 'Poster / cover cards', stats: 'Big-number stat cards', bento: 'Bento tiles', badges: 'Status badges', charts: 'Chart palette', empty: 'Empty state',
    s: ['Total views', 'Titles live', 'To settle', 'Approval rate'],
    bt: [['Distribution', 'Upload once, live on twelve platforms'], ['Localization', 'Subtitles & dubbing in 6 languages'], ['Settlement', 'Transparent ledger, paid T+30'], ['Analytics', 'Live dashboards by title, platform, day']],
    emptyT: 'No titles yet', emptyD: 'Upload your first short drama. Once approved it can be distributed worldwide.', upload: 'Upload title',
    antd: ['antd in action', 'Plain antd v5 components, themed only through getAntdTheme().'],
    cols: ['Title', 'Status', 'Platform', 'Views', 'Revenue (USD)', 'Actions'], view: 'View', settle: 'Settle',
    form: 'Submit a title', fTitle: 'Title', fGenre: 'Genre', fEp: 'Episodes', fLang: 'Target languages', fNote: 'Synopsis', submit: 'Submit for review', cancel: 'Cancel', openM: 'Open modal', openD: 'Open drawer',
    mTitle: 'Submit for review?', mBody: 'The title will enter the review queue; expect a decision within 1–2 business days. Editing is locked during review.',
    steps: ['Upload', 'Review', 'Localize', 'Distribute', 'Settle'],
    tabs: ['All', 'In review', 'Live', 'Rejected'],
    admin: ['Admin · compact density', 'Compact variant: 30px controls, 13px text, 8/12 cells; numeric columns tabular & right-aligned.'],
    menu: ['Overview', 'Titles', 'Review queue', 'Distribution', 'Settlement', 'Analytics', 'Team', 'Settings'], search: 'Search title / ID',
  },
};

const WORKS = [
  { id: 'SR-1024', zh: '契约新娘', en: 'Contract Bride', hue: ['#7a0b22', '#1a0208'], g: ['霸总', 'Billionaire'], st: 'reviewing', p: 'ReelShort', v: 12840221, r: 48210.5 },
  { id: 'SR-1031', zh: '归来复仇', en: 'Return of the Heiress', hue: ['#3b2a6b', '#0c0816'], g: ['复仇', 'Revenge'], st: 'approved', p: 'DramaBox', v: 9022150, r: 31877.2 },
  { id: 'SR-1047', zh: '王座之下', en: 'Beneath the Throne', hue: ['#8a5a12', '#1a1003'], g: ['逆袭', 'Underdog'], st: 'pendingSettle', p: 'ShortMax', v: 6510034, r: 22140.0 },
  { id: 'SR-1052', zh: '静默三年', en: 'Three Silent Years', hue: ['#0f4d5c', '#020c10'], g: ['悬疑', 'Thriller'], st: 'rejected', p: 'FlexTV', v: 0, r: 0 },
  { id: 'SR-1066', zh: '千年一梦', en: 'Thousand-Year Dream', hue: ['#264d1c', '#050d03'], g: ['奇幻', 'Fantasy'], st: 'settled', p: 'GoodShort', v: 15402998, r: 60231.8 },
  { id: 'SR-1071', zh: '狼月誓约', en: 'Oath of the Wolf Moon', hue: ['#2a2a35', '#050507'], g: ['狼人', 'Werewolf'], st: 'live', p: 'ReelShort', v: 3201877, r: 9870.4 },
] as const;
type Work = (typeof WORKS)[number];

const Poster = ({ w, lang, badge, style }: { w: Work; lang: Lang; badge?: ReactNode; style?: CSSProperties }) => (
  <div className="ds-poster" tabIndex={0} style={style}>
    <div className="ds-poster__art" style={{ background: `radial-gradient(80% 60% at 70% 20%, ${w.hue[0]}, transparent), linear-gradient(170deg, ${w.hue[0]}, ${w.hue[1]} 75%)` }}>
      <div className="ds-poster__kicker">{lang === 'zh' ? w.g[0] : w.g[1]}</div>
      <div className="ds-poster__title">{lang === 'zh' ? w.zh : w.en}</div>
    </div>
    {badge && <div className="ds-poster__badge">{badge}</div>}
    <div className="ds-poster__info"><b>{lang === 'zh' ? w.zh : w.en}</b><div style={{ color: '#46d369', fontWeight: 700, marginTop: 4 }}>98% match · 80 ep</div></div>
  </div>
);
const SBadge = ({ s, lang }: { s: BizStatus; lang: Lang }) => <span className={`ds-badge ds-badge--${bizStatus[s].tone}`}>{bizStatus[s][lang]}</span>;
const Sec = ({ id, k, t, children }: { id: string; k: string; t: readonly string[]; children: ReactNode }) => (
  <section className="sec" id={id}><div className="wrap">
    <motion.div className="sec-h" {...mo.presets.reveal}><div className="ds-eyebrow">{k}</div><h2>{t[0]}</h2><p>{t[1]}</p></motion.div>{children}
  </div></section>
);
const fmt = (n: number) => n.toLocaleString('en-US');
const fmtM = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MotionCard({ name, ease, dur, code }: { name: string; ease: number[]; dur: number; code: string }) {
  const [k, setK] = useState(0);
  return <div className="mo" onClick={() => setK(k + 1)}><b>{name}</b><code>{code}</code>
    <div className="track"><motion.div key={k} className="dot" initial={{ x: 0 }} animate={{ x: 200 }} transition={{ duration: dur, ease: ease as [number, number, number, number] }} /></div></div>;
}

function useAntdColumns(t: typeof T.zh, lang: Lang, compact = false): TableColumnsType<Work> {
  return [
    { title: t.cols[0], dataIndex: 'id', render: (_, w) => <div className="ds-cover"><Poster w={w} lang={lang} /><div><b>{lang === 'zh' ? w.zh : w.en}</b><small className="ds-num">{w.id} · {lang === 'zh' ? w.g[0] : w.g[1]}</small></div></div> },
    { title: t.cols[1], dataIndex: 'st', render: (s: BizStatus) => compact ? <SBadge s={s} lang={lang} /> : <Tag color={toneToTagColor[bizStatus[s].tone]} bordered={false}>{bizStatus[s][lang]}</Tag> },
    { title: t.cols[2], dataIndex: 'p' },
    { title: t.cols[3], dataIndex: 'v', align: 'right', sorter: (a, b) => a.v - b.v, render: (v: number) => <span className="ds-num">{v ? fmt(v) : '—'}</span> },
    { title: t.cols[4], dataIndex: 'r', align: 'right', render: (v: number) => <span className="ds-num" style={{ fontFamily: 'var(--ds-font-mono)' }}>{v ? fmtM(v) : '—'}</span> },
    { title: t.cols[5], key: 'a', align: 'right', render: (_, w) => <Space size={4}><Button type="text" size="small">{t.view}</Button>{w.st === 'pendingSettle' && <Button size="small" type="primary">{t.settle}</Button>}</Space> },
  ];
}

export default function App() {
  const [mode, setMode] = useState<ThemeName>('dark');
  const [lang, setLang] = useState<Lang>(() => (new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh'));
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const t = T[lang];
  useEffect(() => { const q = new URLSearchParams(location.search); if (q.get('theme') === 'light') setMode('light'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = mode; document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [mode, lang]);
  const c = colors[mode];
  const cols = useAntdColumns(t, lang);
  const colsC = useAntdColumns(t, lang, true);
  const ease = mo.ease.out as unknown as number[];

  return (
    <ConfigProvider theme={getAntdTheme({ mode })} locale={lang === 'zh' ? zhCN : enUS} button={{ autoInsertSpace: false }}>
      <AntApp>
        <header className="top">
          <div className="brand"><i /><b>StarRiver</b><span style={{ color: 'var(--ds-text-2)' }}>Design System</span></div>
          <nav className="toc">{['color', 'type', 'space', 'radius', 'motion', 'components', 'antd', 'admin'].map((id, i) => <a key={id} href={'#' + id}>{t.toc[i]}</a>)}</nav>
          <div className="seg" data-testid="lang"><button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div>
          <div className="seg" data-testid="theme"><button className={mode === 'dark' ? 'on' : ''} onClick={() => setMode('dark')}>{lang === 'zh' ? '深色' : 'Dark'}</button><button className={mode === 'light' ? 'on' : ''} onClick={() => setMode('light')}>{lang === 'zh' ? '浅色' : 'Light'}</button></div>
        </header>

        <section className="hero"><div className="orb" /><div className="wrap" style={{ position: 'relative' }}>
          <motion.div className="ds-eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, ease: mo.ease.out }} style={{ marginBottom: 18 }}>{t.heroK}</motion.div>
          <h1 className="ds-display">{[t.heroA, t.heroB].map((l, k) => <span key={lang + k} style={{ display: 'block', overflow: 'hidden', paddingBottom: '.06em' }}>
            <motion.span style={{ display: 'inline-block' }} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1.1, delay: .1 + k * .12, ease: mo.ease.out }} className={k ? 'ds-grad-text' : ''}>{l}</motion.span></span>)}</h1>
          <p className="ds-lede">{t.heroSub}</p>
          <div style={{ display: 'flex', gap: 14, marginTop: 40 }}><a href="#components" className="ds-btn ds-btn--primary" style={{ textDecoration: 'none' }}>{t.cta} <span className="arr">→</span></a><a href="#antd" className="ds-btn ds-btn--ghost" style={{ textDecoration: 'none' }}>{t.cta2}</a></div>
        </div></section>

        <Sec id="color" k="01 · Color" t={t.color}>
          <div className="sub">{t.brand}</div>
          <div className="swatches">{Object.entries(tokens.brand).map(([k, v]) => <div className="sw" key={k}><i style={{ background: v }} /><div><b>{k}</b><code>{v}</code></div></div>)}</div>
          <div className="sub">{t.neutral}</div>
          <div className="ramp">{Object.entries(neutral).map(([k, v]) => <span key={k} style={{ background: v, color: Number(k) > 550 ? '#000' : '#fff' }}>{k}</span>)}</div>
          <div className="sub">{t.semantic} · {mode}</div>
          <div className="swatches">{(['bg', 'bgElevated', 'surface', 'surface2', 'text', 'textSecondary', 'textTertiary', 'border', 'primary', 'primaryText', 'primarySoft', 'focusRing'] as const).map(k =>
            <div className="sw" key={k}><i style={{ background: c[k], borderBottom: '1px solid var(--ds-border)' }} /><div><b>{k}</b><code>{c[k]}</code></div></div>)}</div>
          <div className="sub">{t.statusC}</div>
          <div className="swatches">{(['success', 'warning', 'error', 'info'] as const).map(k => <div className="sw" key={k}><i style={{ background: c[k] }} /><div><b>{k}</b><code>{c[k]}</code></div></div>)}</div>
        </Sec>

        <Sec id="type" k="02 · Typography" t={t.type}>
          {([['display', 'Display', lang === 'zh' ? '爆款，出海' : 'Go global.'], ['displaySm', 'Display S', lang === 'zh' ? '全球分发' : 'Worldwide'], ['h1', 'H1', lang === 'zh' ? '一次上传，全球上架' : 'Upload once, go live'], ['h2', 'H2', lang === 'zh' ? '作品详情' : 'Title details'], ['h3', 'H3', lang === 'zh' ? '十二个平台同步上架' : 'Live on twelve platforms'], ['h4', 'H4', lang === 'zh' ? '本周热播' : 'Trending this week'], ['lede', 'Lede', t.heroSub.slice(0, 60)], ['body', 'Body', t.mBody], ['bodySm', 'Body S', t.mBody], ['caption', 'Caption', 'SR-1024 · 80 ep · 2026-10-21'], ['eyebrow', 'Eyebrow', 'Now streaming'], ['stat', 'Stat', '2.4B']] as const).map(([k, n, s]) => {
            const ts = tokens.typeScale[k];
            return <div className="type-row" key={k}><div className="meta"><b>{n}</b>{ts.size}<br />lh {ts.lh} · ls {ts.ls} · {ts.weight}</div>
              <div className="s" style={{ fontSize: ts.size, lineHeight: ts.lh, letterSpacing: ts.ls, fontWeight: ts.weight, textTransform: 'transform' in ts ? 'uppercase' : undefined, color: k === 'eyebrow' ? 'var(--ds-primary)' : k === 'lede' ? 'var(--ds-text-2)' : undefined }}>
                {k === 'stat' ? <span className="ds-stat__value" style={{ fontSize: 'inherit', margin: 0 }}>{s}</span> : s}</div></div>;
          })}
          <div className="grid2" style={{ marginTop: 32 }}>
            <div className="panel"><div className="ds-tile__k">Sans</div><div style={{ fontSize: 13, fontFamily: 'var(--ds-font-mono)', color: 'var(--ds-text-2)', lineHeight: 1.6 }}>{tokens.font.family}</div></div>
            <div className="panel"><div className="ds-tile__k">Mono · tabular-nums</div><div className="ds-num" style={{ fontSize: 22, fontWeight: 600 }}>1,284,022.10<br />  908,150.00</div></div>
          </div>
        </Sec>

        <Sec id="space" k="03 · Space & Grid" t={t.space}>
          <div className="grid2"><div className="spaces">{Object.entries(tokens.space).filter(([k]) => k !== '0').map(([k, v]) => <div className="sp" key={k}><span>space-{k} · {v}</span><i style={{ width: v * 3 }} /></div>)}</div>
            <div className="panel"><div className="ds-tile__k">12-col · gap 16 · max 1360</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 8, height: 160, marginTop: 12 }}>{Array.from({ length: 12 }, (_, i) => <div key={i} style={{ background: 'var(--ds-primary-soft)', borderRadius: 4, border: '1px solid var(--ds-border)' }} />)}</div>
              <div style={{ fontSize: 13, color: 'var(--ds-text-3)', marginTop: 16, lineHeight: 1.7 }}>breakpoints · sm 720 · md 1100 · lg 1360<br />gutter 56 → 22 (≤720) · section 140 → 96</div></div></div>
        </Sec>

        <Sec id="radius" k="04 · Radius / Elevation" t={t.radius}>
          <div className="boxes">{Object.entries(tokens.radius).map(([k, v]) => <div className="bx" key={k} style={{ borderRadius: Math.min(v, 60) }}>{k} · {v}</div>)}</div>
          <div className="boxes" style={{ marginTop: 28 }}>{(['sm', 'md', 'lg', 'modal', 'glow', 'glowStrong'] as const).map(k => <div className="bx" key={k} style={{ borderRadius: 16, boxShadow: tokens.shadow[mode][k], background: k.startsWith('glow') ? 'var(--ds-red)' : undefined, color: k.startsWith('glow') ? '#fff' : undefined }}>{k}</div>)}</div>
          <div className="boxes" style={{ marginTop: 28 }}>{(['--ds-grad-bento', '--ds-grad-spotlight', '--ds-grad-glow-orb', '--ds-grad-bar', '--ds-grad-avatar'] as const).map(k => <div className="bx" key={k} style={{ borderRadius: 16, width: 200, background: `var(${k})` }}>{k.replace('--ds-grad-', 'grad-')}</div>)}
            <div className="bx" style={{ borderRadius: 16, width: 200, alignItems: 'center', justifyContent: 'center' }}><span className="ds-grad-text" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.05em' }}>Aa</span></div></div>
        </Sec>

        <Sec id="motion" k="05 · Motion" t={t.motion}>
          <div className="motion-row">
            <MotionCard name="ease-out · reveal" ease={ease} dur={.9} code="[.22,1,.36,1] · 900ms" />
            <MotionCard name="ease-out · hero" ease={ease} dur={1.1} code="[.22,1,.36,1] · 1100ms" />
            <MotionCard name="in-out · slow" ease={mo.ease.inOut as unknown as number[]} dur={.45} code="[.65,0,.35,1] · 450ms" />
            <MotionCard name="standard · fast" ease={mo.ease.standard as unknown as number[]} dur={.2} code="[.4,0,.2,1] · 200ms" />
          </div>
          <div className="note">{Object.entries(mo.duration).map(([k, v]) => `${k} ${v * 1000}ms`).join(' · ')} · stagger 60ms · prefers-reduced-motion → 0</div>
        </Sec>

        <Sec id="components" k="06 · Components" t={t.comp}>
          <div className="sub">{t.buttons}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="ds-btn ds-btn--primary">{t.cta} <span className="arr">→</span></button><button className="ds-btn ds-btn--ghost">{t.cta2}</button>
            <button className="ds-btn ds-btn--primary ds-btn--sm">{t.submit}</button><button className="ds-btn ds-btn--ghost ds-btn--sm">{t.cancel}</button>
            <button className="ds-btn ds-btn--text ds-btn--sm">{t.view} →</button><button className="ds-btn ds-btn--primary ds-btn--sm" disabled>Disabled</button>
          </div>
          <div className="sub">{t.posters}</div>
          <div className="posters">{WORKS.map((w, i) => <Poster key={w.id} w={w} lang={lang} badge={i < 3 ? <SBadge s={w.st as BizStatus} lang={lang} /> : undefined} />)}</div>
          <div className="sub">{t.stats}</div>
          <div className="grid4">{[['2.4', 'B', '+18.2%', 'up'], ['1,280', '', '+42', 'up'], ['$86.4', 'K', '-3.1%', 'down'], ['96.3', '%', '+0.8pt', 'up']].map(([v, u, d, dir], i) =>
            <motion.div className="ds-stat" key={i} {...mo.presets.reveal} transition={{ ...mo.presets.reveal.transition, delay: i * .06 }}><div className="ds-stat__label">{t.s[i]}</div><div className="ds-stat__value">{v}<small>{u}</small></div><span className={'ds-stat__delta ' + dir}>{dir === 'up' ? '▲' : '▼'} {d}</span></motion.div>)}</div>
          <div className="sub">{t.bento}</div>
          <div className="ds-bento">
            <div className="ds-tile" style={{ gridColumn: 'span 3', gridRow: 'span 2' }}><div className="ds-tile__k">{t.bt[0][0]}</div><h4>{t.bt[0][1]}</h4><div className="ds-tile__v"><div className="orbit-core"><b>SR</b></div></div></div>
            <div className="ds-tile" style={{ gridColumn: 'span 3' }}><div className="ds-tile__k">{t.bt[1][0]}</div><h4>{t.bt[1][1]}</h4><div className="ds-tile__v"><div className="chips">{['Hello', 'Hola', 'Olá', 'こんにちは', 'Halo', 'สวัสดี'].map((h, i) => <span key={h} className={i === 1 ? 'on' : ''}>{h}</span>)}</div></div></div>
            <div className="ds-tile" style={{ gridColumn: 'span 3' }}><div className="ds-tile__k">{t.bt[2][0]}</div><h4>{t.bt[2][1]}</h4><div className="ds-tile__v"><div className="ledger ds-num">{[['ReelShort', '+$12,480.00'], ['DramaBox', '+$8,210.50']].map(([a, b]) => <div key={a}><span>{a}</span><span style={{ color: 'var(--ds-success)' }}>{b}</span></div>)}</div></div></div>
            <div className="ds-tile" style={{ gridColumn: 'span 6', flexDirection: 'row', gap: 40, alignItems: 'flex-end' }}><div style={{ flex: '0 0 320px', alignSelf: 'center' }}><div className="ds-tile__k">{t.bt[3][0]}</div><h4>{t.bt[3][1]}</h4></div>
              <div className="bars" style={{ flex: 1 }}>{[38, 52, 46, 70, 64, 88, 79, 96, 72, 90].map((h, i) => <motion.i key={i} initial={{ height: 0 }} whileInView={{ height: h + '%' }} viewport={{ once: true }} transition={{ delay: .2 + i * .05, duration: .9, ease: mo.ease.out }} />)}</div></div>
          </div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <div><div className="sub">{t.badges}</div><div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{(Object.keys(bizStatus) as BizStatus[]).map(s => <SBadge key={s} s={s} lang={lang} />)}
              <div style={{ width: '100%', height: 1, background: 'var(--ds-border)', margin: '8px 0' }} />{(Object.keys(bizStatus) as BizStatus[]).map(s => <Tag key={s} bordered={false} color={toneToTagColor[bizStatus[s].tone]}>{bizStatus[s][lang]}</Tag>)}</div></div>
            <div><div className="sub">{t.empty}</div><div className="ds-empty"><div className="ds-empty__icon"><PlaySquareOutlined /></div><h5>{t.emptyT}</h5><p>{t.emptyD}</p><button className="ds-btn ds-btn--primary ds-btn--sm" style={{ marginTop: 8 }}><PlusOutlined /> {t.upload}</button></div></div>
          </div>
          <div className="sub">{t.charts}</div>
          <div className="panel chart">
            <div className="donut" style={{ background: `conic-gradient(${chart.categorical.slice(0, 6).map((col, i, a) => `${col} ${i * 100 / a.length}% ${(i + 1) * 100 / a.length - .6}%, transparent 0 ${(i + 1) * 100 / a.length}%`).join(',')})` }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, height: 140, alignItems: 'flex-end', borderBottom: `1px solid ${chart.grid[mode]}`, backgroundImage: `linear-gradient(${chart.grid[mode]} 1px, transparent 1px)`, backgroundSize: '100% 35px' }}>
                {[[40, 30, 18], [55, 34, 22], [62, 40, 20], [70, 44, 30], [84, 50, 34], [92, 58, 40]].map((g, i) => <div key={i} style={{ flex: 1, display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%' }}>{g.map((h, j) => <i key={j} style={{ flex: 1, height: h + '%', background: chart.categorical[j], borderRadius: '4px 4px 1px 1px', opacity: j ? .9 : 1 }} />)}</div>)}</div>
              <div className="legend" style={{ marginTop: 16 }}>{chart.categorical.map((col, i) => <span key={col}><i style={{ background: col }} />C{i + 1} {col}</span>)}</div>
              <div style={{ display: 'flex', marginTop: 14, borderRadius: 8, overflow: 'hidden' }}>{chart.sequential.map(s => <span key={s} style={{ flex: 1, height: 18, background: s }} />)}</div>
            </div>
          </div>
        </Sec>

        <Sec id="antd" k="07 · antd v5" t={t.antd}>
          <Tabs defaultActiveKey="0" items={t.tabs.map((l, i) => ({ key: String(i), label: l }))} />
          <div className="ant-wrap" data-testid="antd-table"><Table rowKey="id" columns={cols} dataSource={WORKS as unknown as Work[]} pagination={false} rowSelection={{ defaultSelectedRowKeys: ['SR-1047'] }} /></div>
          <div className="grid2" style={{ marginTop: 24 }}>
            <Card title={t.form} extra={<Tag bordered={false} color="warning">{bizStatus.draft[lang]}</Tag>}>
              <Form layout="vertical" initialValues={{ title: lang === 'zh' ? '契约新娘' : 'Contract Bride', genre: 'b', ep: 80, lang: ['en', 'es'] }}>
                <div className="grid2" style={{ columnGap: 16, rowGap: 0 }}>
                  <Form.Item label={t.fTitle} name="title" rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item label={t.fGenre} name="genre"><Select options={[{ value: 'b', label: lang === 'zh' ? '霸总' : 'Billionaire' }, { value: 'r', label: lang === 'zh' ? '复仇' : 'Revenge' }]} /></Form.Item>
                  <Form.Item label={t.fEp} name="ep"><InputNumber style={{ width: '100%' }} /></Form.Item>
                  <Form.Item label={t.fLang} name="lang"><Select mode="multiple" options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'pt', label: 'Português' }]} /></Form.Item>
                </div>
                <Form.Item label={t.fNote} validateStatus="error" help={lang === 'zh' ? '简介不少于 20 字' : 'At least 20 characters'}><Input.TextArea rows={2} defaultValue="…" /></Form.Item>
                <Space wrap><Button type="primary" onClick={() => setModal(true)} data-testid="open-modal">{t.openM}</Button><Button onClick={() => setDrawer(true)}>{t.openD}</Button><Button type="text">{t.cancel}</Button><Button danger>{lang === 'zh' ? '驳回' : 'Reject'}</Button></Space>
              </Form>
            </Card>
            <Card title="Steps · Segmented · Progress">
              <Steps current={1} size="small" items={t.steps.map((s, i) => ({ title: s, status: i === 1 ? 'process' : i < 1 ? 'finish' : 'wait' }))} />
              <div style={{ marginTop: 28 }}><Steps current={2} direction="vertical" size="small" items={t.steps.slice(0, 3).map((s, i) => ({ title: s, description: i === 2 ? '6 / 12' : 'OK' }))} /></div>
              <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
                <Segmented options={t.tabs} />
                <Progress percent={64} />
                <Space wrap><Switch defaultChecked /><Radio.Group defaultValue="a" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} /><Checkbox defaultChecked>OK</Checkbox><Badge count={12}><Button>{lang === 'zh' ? '消息' : 'Inbox'}</Button></Badge></Space>
                <Alert type="warning" showIcon message={lang === 'zh' ? '2 部作品等待补充材料' : '2 titles need more material'} />
              </Space>
            </Card>
          </div>
          <Modal open={modal} title={t.mTitle} onCancel={() => setModal(false)} onOk={() => setModal(false)} okText={t.submit} cancelText={t.cancel}>
            <p style={{ color: 'var(--ds-text-2)', lineHeight: 1.6 }}>{t.mBody}</p>
            <div style={{ marginTop: 18 }}><Steps current={1} size="small" items={t.steps.slice(0, 3).map(s => ({ title: s }))} /></div>
          </Modal>
          <Drawer open={drawer} onClose={() => setDrawer(false)} title={lang === 'zh' ? '作品详情' : 'Title details'} width={420}>
            <Poster w={WORKS[0]} lang={lang} style={{ width: 160 }} /><div style={{ marginTop: 16 }}><SBadge s="reviewing" lang={lang} /></div><p style={{ marginTop: 12, color: 'var(--ds-text-2)' }}>{t.mBody}</p>
          </Drawer>
        </Sec>

        <Sec id="admin" k="08 · Admin density" t={t.admin}>
          <div data-density="compact" data-testid="admin">
            <ConfigProvider theme={getAntdTheme({ mode, density: 'compact' })}>
              <div className="ant-wrap"><Layout className="admin">
                <Layout.Sider width={200} style={{ borderRight: '1px solid var(--ds-border)', paddingTop: 12 }}>
                  <div className="brand" style={{ padding: '4px 20px 14px', fontSize: 15 }}><i style={{ width: 18, height: 18 }} /><b>StarRiver</b></div>
                  <Menu mode="inline" defaultSelectedKeys={['2']} items={[AppstoreOutlined, PlaySquareOutlined, FileSearchOutlined, CloudUploadOutlined, DollarOutlined, BarChartOutlined, TeamOutlined, SettingOutlined].map((I, i) => ({ key: String(i), icon: <I />, label: t.menu[i] }))} />
                </Layout.Sider>
                <Layout.Content className="admin-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h3 style={{ fontSize: 20, letterSpacing: '-.02em', flex: 1 }}>{t.menu[2]}</h3>
                    <Input prefix={<SearchOutlined />} placeholder={t.search} style={{ width: 220 }} /><Button icon={<FilterOutlined />} /><Button icon={<DownloadOutlined />}>CSV</Button><Button type="primary" icon={<PlusOutlined />}>{t.upload}</Button></div>
                  <div className="grid4" style={{ gap: 12 }}>{[[t.s[0], '2,401,882,104'], [t.s[1], '1,280'], [t.s[2], '$86,420.55'], [t.s[3], '96.3%']].map(([l, v]) => <div className="ds-stat" key={l}><div className="ds-stat__label">{l}</div><div className="ds-stat__value">{v}</div></div>)}</div>
                  <Card size="small" title={<Space>{t.tabs[1]}<Tag bordered={false}>6</Tag></Space>} extra={<Pagination simple size="small" defaultCurrent={1} total={60} />}>
                    <Table rowKey="id" size="middle" columns={colsC} dataSource={WORKS as unknown as Work[]} pagination={false} />
                  </Card>
                  <Space><Statistic title={t.cols[3]} value={51978280} /><Tooltip title="tabular-nums"><CheckCircleOutlined style={{ color: 'var(--ds-success)' }} /></Tooltip><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} style={{ display: 'none' }} /></Space>
                </Layout.Content>
              </Layout></div>
            </ConfigProvider>
          </div>
        </Sec>
        <footer className="foot"><div className="wrap">tokens.css · tokens.ts · antdTheme.ts · components.css — offline single file · {new Date(2026, 9, 21).toISOString().slice(0, 10)}</div></footer>
      </AntApp>
    </ConfigProvider>
  );
}
