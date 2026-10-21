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
  success: '#46D369', warning: '#F5A524', error: '#FF4D6D', info: '#3E8BFF',
} as const;

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  bg: string; bgElevated: string; surface: string; surface2: string; surfaceHover: string; overlay: string;
  text: string; textSecondary: string; textTertiary: string; textInverse: string;
  border: string; borderStrong: string;
  primary: string; primaryHover: string; primaryActive: string; primaryText: string; primarySoft: string;
  success: string; successSoft: string; warning: string; warningSoft: string; error: string; errorSoft: string; info: string; infoSoft: string;
  focusRing: string;
}

export const colors: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#000000', bgElevated: '#0E0E11', surface: '#121215', surface2: '#1B1B20', surfaceHover: '#202026', overlay: 'rgba(0,0,0,.75)',
    text: '#F5F5F7', textSecondary: '#AEAEB2', textTertiary: '#86868B', textInverse: '#000000',
    border: 'rgba(255,255,255,.10)', borderStrong: 'rgba(255,255,255,.22)',
    primary: brand.red, primaryHover: brand.redHover, primaryActive: brand.redActive, primaryText: brand.redText, primarySoft: 'rgba(214,21,60,.16)',
    success: '#46D369', successSoft: 'rgba(70,211,105,.14)', warning: '#F5A524', warningSoft: 'rgba(245,165,36,.14)',
    error: '#FF4D6D', errorSoft: 'rgba(255,77,109,.14)', info: '#4C9AFF', infoSoft: 'rgba(76,154,255,.14)',
    focusRing: 'rgba(214,21,60,.55)',
  },
  light: {
    bg: '#F5F5F7', bgElevated: '#FFFFFF', surface: '#FFFFFF', surface2: '#F0F0F3', surfaceHover: '#EBEBEF', overlay: 'rgba(20,20,24,.45)',
    text: '#0B0B0D', textSecondary: '#55555B', textTertiary: '#86868B', textInverse: '#FFFFFF',
    border: 'rgba(0,0,0,.09)', borderStrong: 'rgba(0,0,0,.20)',
    primary: brand.red, primaryHover: '#C0102F', primaryActive: '#9E0C27', primaryText: '#C0102F', primarySoft: 'rgba(214,21,60,.08)',
    success: '#1E9E4A', successSoft: 'rgba(30,158,74,.10)', warning: '#B76E00', warningSoft: 'rgba(245,165,36,.14)',
    error: '#D92D4B', errorSoft: 'rgba(217,45,75,.09)', info: '#1A6FE0', infoSoft: 'rgba(26,111,224,.09)',
    focusRing: 'rgba(214,21,60,.35)',
  },
};

/** 业务状态 → 语义色（审核/结算流） */
export const bizStatus = {
  draft:     { zh: '草稿',   en: 'Draft',      tone: 'neutral' },
  reviewing: { zh: '审核中', en: 'In review',  tone: 'warning' },
  approved:  { zh: '已通过', en: 'Approved',   tone: 'success' },
  rejected:  { zh: '已驳回', en: 'Rejected',   tone: 'error' },
  pendingSettle: { zh: '待结算', en: 'To settle', tone: 'info' },
  settled:   { zh: '已结算', en: 'Settled',    tone: 'brand' },
  live:      { zh: '上线中', en: 'Live',       tone: 'success' },
  offline:   { zh: '已下架', en: 'Offline',    tone: 'neutral' },
} as const;
export type BizStatus = keyof typeof bizStatus;

export type BizTone = 'neutral' | 'warning' | 'success' | 'error' | 'info' | 'brand';

/** 业务状态色。页面只调用这个函数，不在业务代码里写死颜色。 */
const BIZ_TONE: Record<BizTone, readonly string[]> = {
  error: ['NEEDS_REVISION', 'PRECHECK_FAILED', 'REJECTED', 'ANOMALY', 'REJECTED_BY_PLATFORM'],
  success: ['LIVE', 'APPROVED', 'PAID', 'EFFECTIVE', 'LISTED', 'LOCKED', 'REVIEWED', 'RESOLVED', 'REPLACED'],
  warning: ['SHARE_REVIEW', 'PENDING_REVIEW', 'INVOICE_REVIEW', 'PENDING', 'PENDING_CLIENT', 'IN_REVIEW', 'VERIFYING', 'PAYING', 'BELOW_MINIMUM', 'DRAFTING', 'CHANGE_PENDING', 'PENDING_MATCH'],
  neutral: ['OFFLINE', 'WITHDRAWN', 'NO_SETTLEMENT', 'EXPIRED', 'DRAFT', 'CLOSED', 'DELISTED', 'UNSAMPLED', 'UNVERIFIED'],
  brand: ['SHARE_CONFIG'],
  info: ['PENDING_ASSIGN', 'PENDING_APPLY', 'PENDING_INVOICE', 'DISTRIBUTING', 'APPLYING', 'PENDING_SIGN', 'IN_CONTACT', 'CREATED', 'READ', 'IN_PROGRESS', 'PENDING_ENTRY', 'PENDING_LISTING', 'PENDING_CONTACT'],
};

export function bizToneFor(status: string): BizTone {
  for (const tone of Object.keys(BIZ_TONE) as BizTone[]) {
    if (BIZ_TONE[tone].includes(status)) return tone;
  }
  return 'info';
}

/** 首发平台色。未知名平台用中性灰。 */
export const platform = {
  ReelShort: { color: '#E8173A', code: 'RS' },
  DramaBox: { color: '#7C4DFF', code: 'DB' },
  ShortMax: { color: '#00A3A3', code: 'SM' },
  FlexTV: { color: '#F59E0B', code: 'FT' },
  GoodShort: { color: '#3B82F6', code: 'GS' },
} as const;

export function platformOf(name: string) {
  const known = platform[name as keyof typeof platform];
  if (known) return known;
  const code = name.replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'PF';
  return { color: '#86868B', code };
}

export const rank = { gold: '#E8C872', silver: '#C5CDD6', bronze: '#D08A56' } as const;

/** 图表配色：主色领衔，其余低饱和以保持电影感 */
export const chart = {
  categorical: ['#D6153C', '#FF7B95', '#4C9AFF', '#46D369', '#F5A524', '#A78BFA', '#2DD4BF', '#86868B'],
  sequential: ['rgba(214,21,60,.12)', 'rgba(214,21,60,.3)', 'rgba(214,21,60,.5)', 'rgba(214,21,60,.75)', '#D6153C', '#FF4A6E'],
  diverging: ['#4C9AFF', '#86868B', '#D6153C'],
  grid: { dark: 'rgba(255,255,255,.08)', light: 'rgba(0,0,0,.06)' },
} as const;

export const font = {
  family: '"Source Han Sans SC","Noto Sans SC","Source Han Sans","Noto Sans CJK SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  mono: 'ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace',
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 },
} as const;

/** 字体阶梯：营销站用 fluid clamp，后台用固定 px（admin*） */
export const typeScale = {
  display:  { size: 'clamp(52px,9.2vw,148px)', lh: 0.92, ls: '-0.055em', weight: 800 },
  displaySm:{ size: 'clamp(40px,5.6vw,84px)',  lh: 0.98, ls: '-0.05em',  weight: 800 },
  h1:       { size: 'clamp(34px,4.6vw,68px)',  lh: 1.02, ls: '-0.045em', weight: 700 },
  h2:       { size: '36px', lh: 1.05, ls: '-0.04em',  weight: 700 },
  h3:       { size: '26px', lh: 1.12, ls: '-0.035em', weight: 700 },
  h4:       { size: '22px', lh: 1.2,  ls: '-0.025em', weight: 700 },
  lede:     { size: 'clamp(17px,1.5vw,21px)', lh: 1.5, ls: '-0.015em', weight: 400 },
  body:     { size: '16px', lh: 1.55, ls: '-0.011em', weight: 400 },
  bodySm:   { size: '14px', lh: 1.5,  ls: '-0.006em', weight: 400 },
  caption:  { size: '12.5px', lh: 1.4, ls: '0',       weight: 400 },
  eyebrow:  { size: '13px', lh: 1.2,  ls: '0.14em',   weight: 600, transform: 'uppercase' },
  stat:     { size: 'clamp(48px,6.4vw,104px)', lh: 1, ls: '-0.06em', weight: 800 },
  /* admin */
  adminTitle: { size: '20px', lh: 1.3, ls: '-0.02em', weight: 700 },
  adminBody:  { size: '13px', lh: 1.5, ls: '0',       weight: 400 },
  adminStat:  { size: '30px', lh: 1.1, ls: '-0.035em', weight: 700 },
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

/** 动效：framer-motion 用 ease 数组，CSS 用 cubic-bezier */
export const motion = {
  ease: { out: [0.22, 1, 0.36, 1] as const, inOut: [0.65, 0, 0.35, 1] as const, standard: [0.4, 0, 0.2, 1] as const },
  easeCss: { out: 'cubic-bezier(.22,1,.36,1)', inOut: 'cubic-bezier(.65,0,.35,1)', standard: 'cubic-bezier(.4,0,.2,1)' },
  duration: { instant: 0.12, fast: 0.2, base: 0.3, slow: 0.45, reveal: 0.9, hero: 1.1, count: 2.2 },
  stagger: 0.06,
  /** 通用进场：<motion.div {...motion.presets.reveal} /> */
  presets: {
    reveal: { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
    lineUp: { initial: { y: '110%' }, animate: { y: 0 }, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] } },
    modal:  { initial: { y: 40, scale: 0.96, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 }, exit: { y: 20, opacity: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    hoverLift: { whileHover: { y: -2 }, transition: { duration: 0.3 } },
  },
} as const;

export const density = {
  comfortable: { controlHeight: 40, fontSize: 14, tableCellY: 16, tableCellX: 16, cardPadding: 24 },
  compact:     { controlHeight: 30, fontSize: 13, tableCellY: 8,  tableCellX: 12, cardPadding: 16 },
} as const;
export type Density = keyof typeof density;

export const tokens = { brand, neutral, status, colors, bizStatus, bizToneFor, platform, platformOf, rank, chart, font, typeScale, space, layout, radius, shadow, gradient, motion, density } as const;
export default tokens;
