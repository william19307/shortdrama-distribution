/**
 * 短剧发行 · Cinematic Design Tokens  (source of truth)
 * 提炼自营销站 v2（/workspace/marketing-site/v2/style.css）。
 * 与 tokens.css 一一对应：TS 对象用于 JS/antd，CSS 变量用于样式表。
 */
export const brand = {
  red: '#D6153C', redHover: '#E8204A', redActive: '#B01030', redSoft: '#FF7B95', redText: '#FF5A7A', redDeep: '#4A0716',
} as const;

/** 中性色阶（深色电影感取自 v2：#000 / #0e0e11 / #141418 / #f5f5f7 / #86868b） */
export const neutral = {
  0: '#000000', 50: '#0A0A0C', 100: '#0E0E11', 150: '#121215', 200: '#141418', 250: '#1B1B20', 300: '#26262C',
  400: '#3A3A40', 500: '#5C5C62', 600: '#86868B', 700: '#AEAEB2', 800: '#C7C7CC', 900: '#E8E8ED', 950: '#F5F5F7', 1000: '#FFFFFF',
} as const;

export const status = {
  success: '#34D399', warning: '#FACC15', error: '#FF7A59', info: '#60A5FA',
} as const;

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  bg: string; bgElevated: string; surface: string; surface2: string; surfaceHover: string; overlay: string;
  text: string; textSecondary: string; textTertiary: string; textDisabled: string; textInverse: string;
  border: string; borderStrong: string;
  primary: string; primaryHover: string; primaryActive: string; primaryText: string; primarySoft: string;
  success: string; successSoft: string; warning: string; warningSoft: string; error: string; errorSoft: string; info: string; infoSoft: string; settle: string; settleSoft: string;
  focusRing: string;
}

/**
 * 对比度经 contrast.mjs 计算（WCAG 2.1）：正文/次级/辅助文字在 bg、surface、surface2 上均 ≥ 4.5:1。
 * 语义色按色相拉开：success 翠绿 / warning 明黄 / error 橙红（与品牌绯红区分）/ info 天蓝。
 */
export const colors: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#000000', bgElevated: '#0C0C0F', surface: '#111114', surface2: '#1C1C21', surfaceHover: '#24242A', overlay: 'rgba(0,0,0,.78)',
    text: '#F5F5F7', textSecondary: '#C7C7CC', textTertiary: '#A1A1A6', textDisabled: '#6E6E73', textInverse: '#000000',
    border: 'rgba(255,255,255,.14)', borderStrong: 'rgba(255,255,255,.28)',
    primary: brand.red, primaryHover: brand.redHover, primaryActive: brand.redActive, primaryText: '#FF6B85', primarySoft: 'rgba(214,21,60,.20)',
    success: '#34D399', successSoft: 'rgba(52,211,153,.14)', warning: '#FACC15', warningSoft: 'rgba(250,204,21,.13)',
    error: '#FF7A59', errorSoft: 'rgba(255,122,89,.15)', info: '#60A5FA', infoSoft: 'rgba(96,165,250,.15)',
    settle: '#E879F9', settleSoft: 'rgba(232,121,249,.15)',
    focusRing: 'rgba(214,21,60,.6)',
  },
  light: {
    bg: '#F5F5F7', bgElevated: '#FFFFFF', surface: '#FFFFFF', surface2: '#EFEFF2', surfaceHover: '#E8E8EC', overlay: 'rgba(20,20,24,.5)',
    text: '#0B0B0D', textSecondary: '#3A3A40', textTertiary: '#5C5C62', textDisabled: '#9A9AA0', textInverse: '#FFFFFF',
    border: 'rgba(0,0,0,.12)', borderStrong: 'rgba(0,0,0,.26)',
    primary: brand.red, primaryHover: '#C0102F', primaryActive: '#9E0C27', primaryText: '#B5102F', primarySoft: 'rgba(214,21,60,.09)',
    success: '#0E7A3E', successSoft: 'rgba(14,122,62,.10)', warning: '#8A5300', warningSoft: 'rgba(234,179,8,.16)',
    error: '#B23B0B', errorSoft: 'rgba(178,59,11,.09)', info: '#1D5FD1', infoSoft: 'rgba(29,95,209,.10)',
    settle: '#A21CAF', settleSoft: 'rgba(162,28,175,.10)',
    focusRing: 'rgba(214,21,60,.4)',
  },
};

/**
 * 业务状态 → 语义 tone。
 * - info（蓝）：系统/平台处理中，用户只需等待（审核中）
 * - settle（紫/洋红）：资金流转中（待结算），与审核中的蓝区分
 * - action（琥珀黄 = warning 色）：**等当前视角的人处理**，专用；同一状态在不同角色视角可能不同色（见 bizStatusFor）
 * - success / error / brand / neutral：结果态
 */
export const bizStatus = {
  draft:     { zh: '草稿',   en: 'Draft',      tone: 'neutral' },
  reviewing: { zh: '审核中', en: 'In review',  tone: 'info' },
  pendingSettle: { zh: '待结算', en: 'To settle', tone: 'settle' },
  actionRequired: { zh: '待处理', en: 'Action required', tone: 'action' },
  toSubmit:  { zh: '待提交', en: 'To submit',  tone: 'action' },
  needMaterial: { zh: '待补材料', en: 'Needs material', tone: 'action' },
  invoicePending: { zh: '待上传发票', en: 'Invoice needed', tone: 'action' },
  approved:  { zh: '已通过', en: 'Approved',   tone: 'success' },
  live:      { zh: '上线中', en: 'Live',       tone: 'success' },
  rejected:  { zh: '已驳回', en: 'Rejected',   tone: 'error' },
  settled:   { zh: '已结算', en: 'Settled',    tone: 'brand' },
  offline:   { zh: '已下架', en: 'Offline',    tone: 'neutral' },
} as const;
export type BizStatus = keyof typeof bizStatus;
export type BizTone = (typeof bizStatus)[BizStatus]['tone'];

/**
 * 视角相关：琥珀色 = “等当前视角的人处理”。同一业务状态，对需要动手的一方显示 action，
 * 对等待的一方显示 info。例：待上传发票 —— 版权方（要上传）看到 action，财务（等上传）看到 info。
 */
export type Viewer = 'client' | 'ops' | 'finance';
export const statusOwner: Partial<Record<BizStatus, Viewer>> = { toSubmit: 'client', needMaterial: 'client', invoicePending: 'client', actionRequired: 'ops' };
export function bizToneFor(s: BizStatus, viewer: Viewer): BizTone {
  const owner = statusOwner[s];
  if (!owner) return bizStatus[s].tone;
  return owner === viewer ? 'action' : 'info';
}

/**
 * 平台品牌色 platform.*（取值来源 proto-v4/platform-tokens.md，未改动品牌取值）。
 * 使用范围：**只**用于①按平台拆分系列的图表 ②平台 logo / 平台同步徽章。其余图表一律用 chart.categorical。
 * - dark / light：图表系列、徽章文字/描边，随主题
 * - solid：logo 底色，两主题共用，配白字
 * - lightTextSafe：浅色主题下作为**文字**使用时的建议替代值（原值在 bg/surface2 上 <4.5:1）；图形元素仍用 light
 * 对比度复核见 components.md §13（platform-report.mjs 计算）。
 */
export interface PlatformColor { dark: string; light: string; solid: string; lightTextSafe?: string; css: string; hue: number }
export const platform = {
  ReelShort: { dark: '#FF4D6A', light: '#D6153C', solid: '#D6153C', css: '--ds-platform-reelshort', hue: 350 },
  DramaBox:  { dark: '#A98BFF', light: '#6D3FE8', solid: '#6D3FE8', css: '--ds-platform-dramabox', hue: 256 },
  ShortMax:  { dark: '#2CC9C3', light: '#00807A', solid: '#00807A', lightTextSafe: '#007A74', css: '--ds-platform-shortmax', hue: 178 },
  FlexTV:    { dark: '#FFB020', light: '#A86400', solid: '#A86400', lightTextSafe: '#9E5E00', css: '--ds-platform-flextv', hue: 38 },
  GoodShort: { dark: '#5B9DFF', light: '#1F63E0', solid: '#1F63E0', css: '--ds-platform-goodshort', hue: 217 },
} as const satisfies Record<string, PlatformColor>;
export type PlatformKey = keyof typeof platform;
/** 图表系列描边/marker 形状建议（DramaBox↔GoodShort 在红绿色弱下几乎同色，必须叠加形状或直接标注） */
export const platformMarker: Record<PlatformKey, { symbol: 'circle' | 'rect' | 'triangle' | 'diamond' | 'roundRect'; dash: 'solid' | 'dashed' | 'dotted' }> = {
  ReelShort: { symbol: 'circle', dash: 'solid' }, DramaBox: { symbol: 'diamond', dash: 'solid' }, ShortMax: { symbol: 'triangle', dash: 'solid' },
  FlexTV: { symbol: 'rect', dash: 'solid' }, GoodShort: { symbol: 'roundRect', dash: 'dashed' },
};
/** 二轮平台：只有 logo 底色（配白字） */
export const platformSecondary = {
  MoboReels: { solid: '#0369A1', css: '--ds-platform-moboreels-solid' },
  TopShort:  { solid: '#0F766E', css: '--ds-platform-topshort-solid' },
  DramaWave: { solid: '#7E22CE', css: '--ds-platform-dramawave-solid' },
  StarShort: { solid: '#B91C1C', css: '--ds-platform-starshort-solid' },
  MiniDrama: { solid: '#4D7C0F', css: '--ds-platform-minidrama-solid' },
  'Kalos TV': { solid: '#C2410C', css: '--ds-platform-kalostv-solid' },
  HiShort:   { solid: '#4338CA', css: '--ds-platform-hishort-solid' },
  NetShort:  { solid: '#BE185D', css: '--ds-platform-netshort-solid' },
  iDrama:    { solid: '#15803D', css: '--ds-platform-idrama-solid' },
  PopShort:  { solid: '#334155', css: '--ds-platform-popshort-solid' },
} as const;
export type PlatformSecondaryKey = keyof typeof platformSecondary;
export type AnyPlatformKey = PlatformKey | PlatformSecondaryKey;
/** 取当前主题下的平台系列色（ECharts 等不认 CSS 变量时用） */
export const platformColor = (k: PlatformKey, mode: ThemeName) => platform[k][mode];
export const platformVar = (k: PlatformKey) => `var(${platform[k].css})`;
export const platformSolid = (k: AnyPlatformKey): string => (k in platform ? platform[k as PlatformKey].solid : platformSecondary[k as PlatformSecondaryKey].solid);

/**
 * 排名奖牌 rank.*：仅用于 Top10 排行的第 1–3 名（冠军/亚军/季军）。
 * main = 奖牌图形色（对 bg/surface/surface2 ≥3:1）；text = 名次文字色（≥4.5:1）；soft = 底色；onMain = 实心奖牌上的数字色（≥4.5:1）。
 * 金色刻意做成低饱和“香槟金”，与琥珀警告/待处理拉开：ΔE00 深 14.9 / 浅 14.9（main vs warning）。见 components.md §14。
 */
export interface RankColor { main: string; soft: string; text: string; onMain: string }
export type RankTier = 'gold' | 'silver' | 'bronze';
export const rank: Record<ThemeName, Record<RankTier, RankColor>> = {
  dark: {
    gold:   { main: '#C9A55C', soft: 'rgba(201,165,92,.16)',  text: '#E6C78A', onMain: '#111114' },
    silver: { main: '#B8BFC9', soft: 'rgba(184,191,201,.14)', text: '#C9CED6', onMain: '#111114' },
    bronze: { main: '#D98B5A', soft: 'rgba(217,139,90,.16)',  text: '#E8A06E', onMain: '#111114' },
  },
  light: {
    gold:   { main: '#A07800', soft: 'rgba(160,120,0,.12)',   text: '#6E5A1E', onMain: '#111114' },
    silver: { main: '#6B7280', soft: 'rgba(107,114,128,.12)', text: '#5F6672', onMain: '#FFFFFF' },
    bronze: { main: '#A4552A', soft: 'rgba(164,85,42,.12)',   text: '#8F4E22', onMain: '#FFFFFF' },
  },
};
export const rankMeta: Record<RankTier, { place: 1 | 2 | 3; zh: string; en: string }> = {
  gold: { place: 1, zh: '冠军', en: 'Champion' }, silver: { place: 2, zh: '亚军', en: 'Runner-up' }, bronze: { place: 3, zh: '季军', en: 'Third place' },
};
export const rankTier = (n: number): RankTier | null => (n === 1 ? 'gold' : n === 2 ? 'silver' : n === 3 ? 'bronze' : null);

/** 图表配色：主色领衔，其余低饱和以保持电影感 */
export const chart = {
  categorical: ['#D6153C', '#60A5FA', '#34D399', '#FACC15', '#A78BFA', '#FF7A59', '#2DD4BF', '#A1A1A6'],
  sequential: ['rgba(214,21,60,.12)', 'rgba(214,21,60,.3)', 'rgba(214,21,60,.5)', 'rgba(214,21,60,.75)', '#D6153C', '#FF4A6E'],
  diverging: ['#60A5FA', '#A1A1A6', '#D6153C'],
  grid: { dark: 'rgba(255,255,255,.10)', light: 'rgba(0,0,0,.08)' },
} as const;

/**
 * 字体：英文/数字 Inter，中文 思源黑体（Noto Sans SC / Source Han Sans SC），四档字重 400/500/600/700。
 * 展示页以子集化 woff2 内联（fonts.css）；工程中用 @fontsource 加载，见 README。
 */
export const font = {
  family: '"Inter","Noto Sans SC","Source Han Sans SC","Source Han Sans CN","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  mono: '"Inter","Noto Sans SC",ui-monospace,"SF Mono",Menlo,Consolas,monospace',
  /** 数字：Inter + tnum 等宽数字，比真正的等宽字体更紧凑 */
  numericFeatures: '"tnum" 1, "cv11" 1',
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/** 字体阶梯：营销站 fluid clamp，后台固定 px（admin*）。字重仅用 400/500/600/700。 */
export const typeScale = {
  display:  { size: 'clamp(52px,9.2vw,148px)', lh: 0.95, ls: '-0.05em',  weight: 700 },
  displaySm:{ size: 'clamp(40px,5.6vw,84px)',  lh: 1.0,  ls: '-0.045em', weight: 700 },
  h1:       { size: 'clamp(34px,4.6vw,68px)',  lh: 1.05, ls: '-0.04em',  weight: 700 },
  h2:       { size: '36px', lh: 1.1,  ls: '-0.035em', weight: 700 },
  h3:       { size: '26px', lh: 1.15, ls: '-0.03em',  weight: 600 },
  h4:       { size: '20px', lh: 1.3,  ls: '-0.02em',  weight: 600 },
  lede:     { size: 'clamp(17px,1.5vw,21px)', lh: 1.55, ls: '-0.012em', weight: 400 },
  body:     { size: '16px', lh: 1.6,  ls: '-0.006em', weight: 400 },
  bodySm:   { size: '14px', lh: 1.57, ls: '0',        weight: 400 },
  label:    { size: '14px', lh: 1.4,  ls: '0',        weight: 500 },
  caption:  { size: '12px', lh: 1.5,  ls: '0.005em',  weight: 400 },
  eyebrow:  { size: '13px', lh: 1.2,  ls: '0.12em',   weight: 600, transform: 'uppercase' },
  stat:     { size: 'clamp(48px,6.4vw,104px)', lh: 1, ls: '-0.05em', weight: 700 },
  number:   { size: '14px', lh: 1.4,  ls: '0',        weight: 500 },
  /* admin */
  adminTitle: { size: '20px', lh: 1.35, ls: '-0.015em', weight: 600 },
  adminBody:  { size: '13px', lh: 1.54, ls: '0',        weight: 400 },
  adminStat:  { size: '28px', lh: 1.15, ls: '-0.03em',  weight: 600 },
  adminNumber:{ size: '13px', lh: 1.4,  ls: '0',        weight: 500 },
} as const;

/** 4px 基准间距 */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 14: 56, 18: 72, 24: 96, 35: 140 } as const;
export const layout = {
  maxWidth: 1360, gutter: 56, gutterMobile: 22, columns: 12, gridGap: 16, navHeight: 68,
  sectionY: 140, sectionYMobile: 96, breakpoints: { sm: 720, md: 1100, lg: 1360 },
} as const;

export const radius = { xs: 4, sm: 8, md: 10, lg: 14, xl: 24, xxl: 28, pill: 999 } as const;

export const shadow = {
  dark: {
    sm: '0 1px 2px rgba(0,0,0,.6)',
    md: '0 12px 32px -12px rgba(0,0,0,.8)',
    lg: '0 30px 60px -10px #000, 0 0 0 1px rgba(255,255,255,.12)',
    modal: '0 40px 120px #000',
    glow: '0 10px 40px -10px rgba(214,21,60,.7)',
    glowStrong: '0 0 80px rgba(214,21,60,.7)',
  },
  light: {
    sm: '0 1px 2px rgba(0,0,0,.06)',
    md: '0 8px 24px -8px rgba(0,0,0,.14)',
    lg: '0 24px 48px -12px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04)',
    modal: '0 30px 80px rgba(0,0,0,.25)',
    glow: '0 10px 30px -10px rgba(214,21,60,.55)',
    glowStrong: '0 0 50px rgba(214,21,60,.35)',
  },
} as const;

export const gradient = {
  textHero: 'linear-gradient(92deg,#fff 10%,#ff7b95 55%,#D6153C)',
  textHeroLight: 'linear-gradient(92deg,#0B0B0D 10%,#C0102F 70%,#D6153C)',
  textStat: 'linear-gradient(180deg,#fff,#9a9aa0)',
  textStatLight: 'linear-gradient(180deg,#0B0B0D,#55555B)',
  bento: 'linear-gradient(160deg,#141418,#0a0a0c)',
  bentoLight: 'linear-gradient(160deg,#ffffff,#f3f3f6)',
  spotlight: 'radial-gradient(60% 80% at 50% 0%,rgba(214,21,60,.14),transparent 70%)',
  glowOrb: 'radial-gradient(circle,rgba(214,21,60,.28),transparent 60%)',
  bar: 'linear-gradient(#ff4a6e,rgba(214,21,60,.15))',
  avatar: 'linear-gradient(135deg,#D6153C,#4A0716)',
  posterShade: 'linear-gradient(#0000,#000e 40%)',
} as const;

/**
 * 动效：统一 framer-motion。duration 单位秒，ease 为 cubic-bezier 数组（CSS 版见 easeCss，仅供颜色/边框过渡）。
 */
type Bezier = [number, number, number, number];
const EASE = { out: [0.22, 1, 0.36, 1] as Bezier, inOut: [0.65, 0, 0.35, 1] as Bezier, standard: [0.4, 0, 0.2, 1] as Bezier, in: [0.55, 0, 1, 0.45] as Bezier };
const DUR = { instant: 0.12, fast: 0.2, base: 0.3, slow: 0.45, reveal: 0.7, hero: 1.1, count: 2.2 };
const spring = { hover: { type: 'spring', stiffness: 380, damping: 28, mass: 0.6 }, modal: { type: 'spring', stiffness: 320, damping: 30 } } as const;

export const motion = {
  ease: EASE,
  easeCss: { out: 'cubic-bezier(.22,1,.36,1)', inOut: 'cubic-bezier(.65,0,.35,1)', standard: 'cubic-bezier(.4,0,.2,1)', in: 'cubic-bezier(.55,0,1,.45)' },
  duration: DUR,
  stagger: { tight: 0.04, base: 0.06, loose: 0.1 },
  spring,
  /** 标准预设：<motion.div {...motion.presets.xxx} />，变体类预设配合 variants 使用 */
  presets: {
    /** 页面/视图切换：放在 <AnimatePresence mode="wait"> 内、以路由或视图 key 为 key */
    page: {
      initial: { opacity: 0, y: 12, filter: 'blur(4px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
      transition: { duration: DUR.slow, ease: EASE.out },
    },
    /** 卡片 hover：海报卡放大、普通卡上浮 */
    cardHover: { whileHover: { scale: 1.06, y: -4 }, whileFocus: { scale: 1.06, y: -4 }, whileTap: { scale: 0.98 }, transition: spring.hover },
    cardLift: { whileHover: { y: -3 }, whileTap: { scale: 0.99 }, transition: spring.hover },
    buttonPress: { whileHover: { y: -2 }, whileTap: { scale: 0.97, y: 0 }, transition: { duration: DUR.fast, ease: EASE.out } },
    /** 弹窗：遮罩淡入 + 面板上移缩放 */
    modalOverlay: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: DUR.base, ease: EASE.standard } },
    modal: { initial: { opacity: 0, y: 32, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { duration: DUR.slow, ease: EASE.out } },
    /** 列表入场：父级 listContainer + 子项 listItem（variants） */
    listContainer: { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: '-40px' }, variants: { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } } },
    listItem: { variants: { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: EASE.out } } } },
    /** 滚动进场 */
    reveal: { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: DUR.reveal, ease: EASE.out } },
    /** 大标题逐行上推（父元素 overflow:hidden） */
    lineUp: { initial: { y: '110%' }, animate: { y: 0 }, transition: { duration: DUR.hero, ease: EASE.out } },
    /** 状态点呼吸（替代 CSS @keyframes pulse） */
    pulse: { animate: { opacity: [1, 0.3, 1] as number[] }, transition: { duration: 1.6, repeat: Infinity, ease: EASE.inOut } },
  },
} as const;

export const density = {
  comfortable: { controlHeight: 40, fontSize: 14, tableCellY: 16, tableCellX: 16, cardPadding: 24 },
  compact:     { controlHeight: 30, fontSize: 13, tableCellY: 8,  tableCellX: 12, cardPadding: 16 },
} as const;
export type Density = keyof typeof density;

export const tokens = { brand, neutral, status, colors, bizStatus, rank, platform, platformSecondary, platformMarker, chart, font, typeScale, space, layout, radius, shadow, gradient, motion, density } as const;
export default tokens;
