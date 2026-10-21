// ⚠ 全部为示例数据（mock），仅用于原型演示
import c1 from './assets/c1.jpg'; import c2 from './assets/c2.jpg'; import c3 from './assets/c3.jpg'; import c4 from './assets/c4.jpg'; import c5 from './assets/c5.jpg'; import c6 from './assets/c6.jpg';
export { default as EMPTY_IMG } from './assets/empty.jpg';
export const COVERS = [c1, c2, c3, c4, c5, c6];
export const TINTS = ['rgba(214,21,60,.0)', 'rgba(0,80,160,.25)', 'rgba(120,40,160,.25)', 'rgba(0,120,90,.25)', 'rgba(200,120,0,.25)', 'rgba(0,0,0,.15)', 'rgba(255,60,120,.2)'];
let seed = 7; export const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
export const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
export const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const TODAY = '2026-10-21';
export const PLATFORMS = [
  { key: 'ReelShort', short: 'RS', color: '#E8173A', region: '北美/欧洲', sync: 'T-1', on: true, first: true, api: 'API' },
  { key: 'DramaBox', short: 'DB', color: '#7C4DFF', region: '北美/东南亚', sync: 'T-1', on: true, first: true, api: '手工' },
  { key: 'ShortMax', short: 'SM', color: '#00A3A3', region: '北美/中东', sync: 'T-2', on: true, first: true, api: '手工' },
  { key: 'FlexTV', short: 'FT', color: '#F59E0B', region: '东南亚/拉美', sync: 'T-1', on: true, first: true, api: 'API' },
  { key: 'GoodShort', short: 'GS', color: '#3B82F6', region: '北美/日韩', sync: 'T-2', on: true, first: true, api: '手工' },
];
export const SECOND_PLATS = ['MoboReels', 'TopShort', 'DramaWave', 'StarShort', 'MiniDrama', 'Kalos TV', 'HiShort', 'NetShort', 'iDrama', 'PopShort'].map((k, i) => ({ key: k, short: k.slice(0, 2).toUpperCase(), color: ['#0EA5E9', '#14B8A6', '#A855F7', '#EF4444', '#84CC16', '#F97316', '#6366F1', '#EC4899', '#22C55E', '#64748B'][i], region: ['北美', '欧洲', '东南亚', '拉美', '中东', '日韩', '北美', '全球', '东南亚', '欧洲'][i], sync: 'T-1', on: i !== 9, first: false, api: '手工', contact: ['Amy Chen', 'Leo Park', 'Nina S.', 'Carlos M.', 'Omar K.', 'Yuki T.', 'Ben W.', 'Ivy L.', 'Tom N.', 'Eva R.'][i] }));
export const ALL_PLATS = [...PLATFORMS, ...SECOND_PLATS];
export const platColor = (k: string) => ALL_PLATS.find((p) => p.key === k)?.color || '#888';
const A = ['闪婚后', '重生之', '龙王殿', '替嫁', '离婚后', '神医', '萌宝驾到', '战神', '豪门', '总裁', '千金', '狼人', '穿越', '隐婚', '首富', '赘婿', '天才', '逆袭'];
const B = ['豪门老公藏不住了', '千金归来', '战神归来', '新娘的秘密', '前妻成了首富', '下山', '爹地快追', '王者回归', '弃妇翻身', '甜宠日记', '真假千金', '冷面总裁是狼人', '我在古代当首辅', '老公是大佬', '归来认亲', '逆天改命', '少年医仙', '复仇女王'];
const EN = ['Hidden Vows', 'Rebirth of the Heiress', 'Return of the Dragon King', 'The Substitute Bride', 'Ex-Wife the Tycoon', 'Divine Doctor', 'Chase Mommy', 'King Returns', 'Rise Again', 'Sweet Diary', 'True Heiress', 'My Alpha CEO', 'Chancellor', 'Secret Boss', 'Homecoming', 'Fate Defied', 'Young Healer', 'Revenge Queen'];
export const GENRES = ['都市', '甜宠', '复仇', '战神', '虐恋', '奇幻', '萌宝', '古装', '逆袭', '悬疑'];
export const LANGS = ['英语', '西班牙语', '葡萄牙语', '印尼语', '泰语', '日语'];
export const TAGS = [{ k: '爆款', c: 'red' }, { k: '待翻译', c: 'orange' }, { k: '2026Q4', c: 'blue' }, { k: '女频', c: 'magenta' }, { k: '男频', c: 'geekblue' }, { k: '重点推广', c: 'gold' }];
export const OPS_USERS = [{ id: 'linxiao', name: '林晓', role: '运营专员' }, { id: 'wangmin', name: '王敏', role: '运营主管' }, { id: 'zhaoqian', name: '赵倩', role: '财务' }, { id: 'chenyu', name: '陈宇', role: '运营专员' }, { id: 'liuyang', name: '刘洋', role: '运营专员' }, { id: 'admin', name: '周岚', role: '管理员' }];
const CN1 = ['星河', '华夏', '长风', '青柠', '橙光', '东方', '北辰', '南山', '金麦', '银河', '紫荆', '远山', '白鹭', '云帆', '海川', '天行'];
const CN2 = ['影业', '传媒', '文化', '影视', '短剧工作室', '娱乐'];
const CITY = ['杭州', '北京', '上海', '深圳', '成都', '西安', '长沙', '广州'];
export let ME = 'C20391';
export const DEMO = 'C20391';
export const setMe = (x: string) => { ME = x; };
export const CUSTOMERS = Array.from({ length: 500 }, (_, i) => {
  const me = i === 0;
  return { id: me ? 'C20391' : 'C' + (20392 + i), name: me ? '星河影业（杭州）' : `${CN1[i % 16]}${CN2[Math.floor(i / 16) % 6]}（${CITY[Math.floor(i / 96) % 8]}）`, cert: me ? '已认证' : pick(['已认证', '已认证', '已认证', '审核中', '未认证', '认证驳回']), owner: me ? 'linxiao' : pick(OPS_USERS.filter((u) => u.role === '运营专员')).id, dramas: 0, joined: `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}`, contact: pick(['张总', '李经理', '王制片', '刘总', '陈导']), phone: '138****' + String(1000 + i).slice(-4) };
});
export type Drama = { id: string; cn: string; en: string; eps: number; status: string; genre: string; lang: string; tags: string[]; groups: string[]; up: string; cust: string; img: number; tint: number; lic: boolean; round: string; plats: Record<string, string>; reviewer: string; submitted: string; sla: number; checked: number; sample: number; problems: number; plays: number; rev: number; done: number; share?: any; resub: number; matchErr?: boolean };
const STAT_W: [string, number][] = [['发行中', 34], ['已下架', 3], ['草稿', 8], ['上传中', 2], ['校验失败', 2], ['需修改', 6], ['待补资质', 3], ['待分派', 4], ['待审核', 8], ['审核中', 6], ['分成配置中', 6], ['分成待复核', 4], ['审核通过', 4], ['发行对接中', 6], ['已撤回', 2]];
const wpick = () => { const t = STAT_W.reduce((a, b) => a + b[1], 0); let r = rnd() * t; for (const [s, w] of STAT_W) { if ((r -= w) < 0) return s; } return '草稿'; };
const custW = () => { const r = rnd(); return r < 0.12 ? ME : CUSTOMERS[1 + Math.floor(rnd() * 499)].id; };
export const DRAMAS: Drama[] = Array.from({ length: 3260 }, (_, i) => {
  const cust = i < 386 ? ME : custW() === ME ? CUSTOMERS[1 + (i % 499)].id : CUSTOMERS[1 + (i % 499)].id;
  const status = i < 8 ? ['发行中', '发行中', '发行中', '需修改', '审核中', '发行对接中', '草稿', '发行中'][i] : wpick();
  const a = i % A.length, b = (i * 7 + Math.floor(i / 18)) % B.length;
  const name = i < 8 ? ['闪婚后，豪门老公他藏不住了', '重生之千金归来', '龙王殿：战神归来', '神医下山', '我的冷面总裁是狼人', '离婚后前妻成了首富', '萌宝驾到：爹地快追妈咪', '替嫁新娘的秘密'][i] : `${A[a]}${B[b]}${i >= 324 ? '' : ''}${i > 30 ? ' ' + (Math.floor(i / 30) + 1) : ''}`;
  const eps = 60 + Math.floor(rnd() * 41);
  const plats: Record<string, string> = {};
  if (['发行中', '已下架'].includes(status)) PLATFORMS.forEach((p) => (plats[p.key] = status === '已下架' ? '已下架' : rnd() < 0.82 ? '已上架' : pick(['待上架', '对接中', '平台已拒绝'])));
  if (status === '发行中' && !Object.values(plats).includes('已上架')) plats.ReelShort = '已上架';
  if (status === '发行对接中') PLATFORMS.forEach((p) => (plats[p.key] = pick(['待对接', '对接中', '待上架', '对接中'])));
  if (status === '审核通过') PLATFORMS.forEach((p) => (plats[p.key] = '待对接'));
  if (status === '发行中' && rnd() < 0.25) plats[pick(SECOND_PLATS).key] = '已上架';
  const live = status === '发行中' || status === '已下架';
  const plays = live ? Math.round((i < 8 ? [8620, 6410, 5230, 0, 0, 0, 0, 3980][i] || 500 : 50 + rnd() * 3000) * 1000) : 0;
  const sample = Math.min(eps, 5 + Math.round(eps * 0.1));
  const day = 1 + Math.floor(rnd() * 20);
  return { id: 'D' + (10001 + i), cn: name, en: EN[b] + (i > 30 ? ' ' + (Math.floor(i / 30) + 1) : ''), eps, status, genre: GENRES[(i * 3) % 10], lang: i % 5 === 0 ? pick(LANGS) : '英语', tags: rnd() < 0.5 ? [pick(TAGS).k] : rnd() < 0.3 ? [TAGS[0].k, TAGS[2].k] : [], groups: i < 386 ? (rnd() < 0.3 ? ['2026 Q4 新剧'] : rnd() < 0.2 ? ['重点项目'] : []) : [], up: `2026-${String(4 + Math.floor(rnd() * 6) + (i < 60 ? 0 : 0)).padStart(2, '0')}-${String(day).padStart(2, '0')}`.replace(/^2026-(1[0-9])/, '2026-10'), cust, img: i < 8 ? [0, 2, 1, 5, 3, 0, 4, 2][i] : (i * 7 + Math.floor(i / 6)) % 6, tint: (i * 5) % 7, lic: status === '待补资质' ? false : rnd() > 0.06, round: rnd() < 0.82 ? '首发' : '二轮', plats, reviewer: ['待分派', '草稿', '上传中', '校验失败', '待补资质'].includes(status) ? '' : pick(OPS_USERS.filter((u) => u.role !== '财务')).id, submitted: `2026-10-${String(8 + Math.floor(rnd() * 13)).padStart(2, '0')} ${String(9 + Math.floor(rnd() * 9)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`, sla: Math.round(-12 + rnd() * 60), checked: status === '审核中' ? Math.floor(rnd() * sample) : ['分成配置中', '分成待复核', '审核通过', '发行对接中', '发行中', '已下架', '需修改'].includes(status) ? sample : 0, sample, problems: status === '需修改' ? 1 + Math.floor(rnd() * 3) : status === '审核中' && rnd() < 0.2 ? 1 : 0, plays, rev: Math.round(plays * (0.018 + rnd() * 0.012)), done: live ? 0.4 + rnd() * 0.3 : 0, resub: status === '需修改' ? 1 : 0 };
});
DRAMAS.slice(0, 120).forEach((d, i) => { if (i % 9 === 0) d.up = `2026-10-${String(14 + (i % 7)).padStart(2, '0')}`; });
DRAMAS.forEach((d) => { const c = CUSTOMERS.find((x) => x.id === d.cust); if (c) c.dramas++; });
export const GROUPS = ['2026 Q4 新剧', '重点项目', '女频合集'];
export const DAYS90 = Array.from({ length: 90 }, (_, i) => { const d = new Date(2026, 6, 23 + i); return `${d.getMonth() + 1}/${d.getDate()}`; });
export const daily = (d: Drama, n: number, metric: 'plays' | 'rev') => { const h = hash(d.id); const base = (metric === 'plays' ? d.plays : d.rev) / 60; return Array.from({ length: n }, (_, i) => Math.round(base * (0.6 + ((h >> (i % 20)) & 7) / 10) * (1 + (90 - n + i) / 120))); };
export const fmtW = (n: number) => n >= 1e8 ? (n / 1e8).toFixed(2) + ' 亿' : n >= 1e4 ? (n / 1e4).toFixed(1) + ' 万' : Math.round(n).toLocaleString();
export const yuan = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MIN_WITHDRAW = 10000;
// 结算单：客户 × 周期
const SETTLE_ST = ['待录入', '待复核', '待申请', '未达起提额', '核对中', '待开票', '发票审核中', '打款中', '已到账', '无需结算'];
export type Settle = { id: string; cust: string; period: string; ref: number; amt: number | null; status: string; enterer: string; reviewer: string; note: string; custNote: string; log: any[]; invoice?: string; voucher?: string; wd?: string; mods: number; lockedRef?: boolean };
const mine: [string, string, number, string][] = [
  ['JS-C20391-2610', '2026-10-01 ~ 2026-10-31', 0, '周期未结束'],
  ['JS-C20391-2609B', '2026-09-16 ~ 2026-09-30', 263410.32, '待申请'],
  ['JS-C20391-2609A', '2026-09-01 ~ 2026-09-15', 222910.23, '待申请'],
  ['JS-C20391-2608', '2026-08-01 ~ 2026-08-31', 412880.1, '已到账'],
  ['JS-C20391-2607', '2026-07-01 ~ 2026-07-31', 356210.0, '已到账'],
  ['JS-C20391-2606', '2026-06-01 ~ 2026-06-30', 0, '无需结算'],
];
export const SETTLES: Settle[] = [
  ...mine.map(([id, p, a, s]) => ({ id, cust: ME, period: p, ref: a ? a * 1.012 : 0, amt: s === '周期未结束' ? null : a, status: s, enterer: 'linxiao', reviewer: 'wangmin', note: '按 9 月平台对账单录入', custNote: a ? 'DramaBox 9 月含 1 笔补发收入 ¥3,280.00' : '', log: [{ t: '2026-10-03 10:12', u: '林晓', a: '录入应结金额', v: yuan(a) }, { t: '2026-10-04 15:40', u: '王敏', a: '复核通过', v: '' }], mods: 0, wd: s === '已到账' ? 'TX' + id.slice(-4) : undefined })),
  ...Array.from({ length: 320 }, (_, i) => { const st = SETTLE_ST[Math.min(9, Math.floor(rnd() * rnd() * 11))]; const ref = Math.round(3000 + rnd() * 400000) + rnd(); const ent = st === '待录入' ? '' : pick(['linxiao', 'chenyu', 'liuyang', 'wangmin']); const amt = st === '待录入' ? null : st === '无需结算' ? 0 : Math.round(ref * (0.93 + rnd() * 0.1) * 100) / 100; return { id: `JS-${CUSTOMERS[1 + i].id}-2609`, cust: CUSTOMERS[1 + i].id, period: '2026-09-01 ~ 2026-09-30', ref, amt, status: st, enterer: ent, reviewer: ['待录入', '待复核'].includes(st) ? '' : 'zhaoqian', note: amt != null ? '按平台对账单' : '', custNote: '', log: [], mods: rnd() < 0.1 ? 2 : 0, invoice: ['发票审核中', '打款中', '已到账'].includes(st) ? '发票_' + i + '.pdf' : undefined }; }),
];
export const WITHDRAWS: any[] = [
  { id: 'TX2608', cust: ME, settles: ['JS-C20391-2608'], amt: 412880.1, acct: '招商银行 ****6621', time: '2026-09-05 10:22', status: '已到账', invoice: '发票_星河_2608.pdf', voucher: '回单_2608.pdf' },
  { id: 'TX2607', cust: ME, settles: ['JS-C20391-2607'], amt: 356210.0, acct: '招商银行 ****6621', time: '2026-08-06 15:40', status: '已到账', invoice: '发票_星河_2607.pdf', voucher: '回单_2607.pdf' },
  ...SETTLES.filter((s) => ['核对中', '待开票', '发票审核中', '打款中'].includes(s.status)).map((s, i) => ({ id: 'TX' + (3000 + i), cust: s.cust, settles: [s.id], amt: s.amt, acct: pick(['工商银行', '建设银行', '招商银行']) + ' ****' + (1000 + i), time: '2026-10-1' + (i % 9) + ' 10:0' + (i % 9), status: s.status, invoice: s.invoice })),
];
SETTLES.forEach((s) => { const w = WITHDRAWS.find((w) => w.settles.includes(s.id)); if (w) s.wd = w.id; });
export const CONTRACT_ST = ['申请中', '起草中', '待签署', '待确认', '已生效', '已到期'];
export const CONTRACTS = Array.from({ length: 26 }, (_, i) => { const d = DRAMAS[i]; const st = i < 5 ? ['已生效', '已生效', '待签署', '起草中', '申请中'][i] : pick(['已生效', '已生效', '已到期', '待签署', '申请中']); return { id: 'HT-2026-' + String(318 + i * 7).padStart(4, '0'), name: `《${d.cn}》海外${i % 4 === 2 ? '补充协议（二轮平台）' : '独家发行合同'}`, type: i % 4 === 2 ? '补充协议' : '发行合同', dramas: [d.id], cust: ME, status: st, date: `2026-${String(3 + (i % 7)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`, file: st === '已生效' || st === '已到期' || st === '待签署' ? '合同正文.pdf' : '', signs: st === '已生效' ? [{ t: '2026-06-12 10:00', who: '我方 · 法务', a: '盖章' }, { t: '2026-06-13 14:20', who: '星河影业', a: '盖章' }] : [] }; });
export const TICKETS: any[] = [
  { id: 'GD-10293', type: '防伪截图', did: 'D10001', cust: ME, plat: 'ReelShort', title: 'ReelShort 上架截图（第1-80集已上线）', time: '2026-10-20 18:32', status: '待客户查看', msgs: [], shots: 3 },
  { id: 'GD-10288', type: '审核结果', did: 'D10004', cust: ME, plat: '', title: '第12、27、58集需修改：字幕错位 / 片头含第三方水印', time: '2026-10-19 11:05', status: '待客户查看', msgs: [], eps: [12, 27, 58] },
  { id: 'GD-10276', type: '防伪截图', did: 'D10002', cust: ME, plat: 'DramaBox', title: 'DramaBox 首页推荐位截图', time: '2026-10-17 09:48', status: '客户已读', msgs: [], shots: 2 },
  { id: 'GD-10251', type: '审核结果', did: 'D10006', cust: ME, plat: '', title: '全部集审核通过', time: '2026-10-14 16:20', status: '已关闭', msgs: [] },
  { id: 'GD-10240', type: '数据异议', did: 'D10003', cust: ME, plat: 'FlexTV', title: '10/09 FlexTV 播放量偏低，申请核对', time: '2026-10-11 10:00', status: '处理中', msgs: [{ who: '我', t: '2026-10-11 10:00', m: '10/09 FlexTV 播放量只有平时三成，请核对。' }, { who: '运营 · 林晓', t: '2026-10-11 15:30', m: '已联系平台，预计 2 个工作日内回复。' }] },
  ...Array.from({ length: 410 }, (_, i) => { const d = DRAMAS[(i * 13) % 3260]; const tp = pick(['审核结果', '防伪截图', '防伪截图', '数据异议', '结算异议']); return { id: 'GD-' + (10000 + i), type: tp, did: d.id, cust: d.cust, plat: tp === '审核结果' ? '' : pick(PLATFORMS).key, title: tp === '审核结果' ? (rnd() < 0.5 ? '全部集审核通过' : `第${1 + (i % 50)}集需修改：画面含二维码`) : tp === '防伪截图' ? '上架截图 · 自动归档' : tp === '数据异议' ? '播放量与平台后台不一致' : '9 月应结金额核对', time: `2026-10-${String(1 + (i % 20)).padStart(2, '0')} ${String(9 + (i % 9)).padStart(2, '0')}:1${i % 10}`, status: pick(['待客户查看', '客户已读', '处理中', '已解决', '已关闭']), msgs: [], shots: 1 }; }),
];
export const RATE_VERSIONS = [
  { v: 'V3', scope: '全局默认', pair: 'USD→CNY', src: '中国人民银行人民币汇率中间价', type: '浮动', rule: '结算周期最后一个自然日', prec: '4 位 / 四舍五入', eff: '2026-07-01', status: '已生效', by: '赵倩', rv: '王敏', reason: '统一取中间价' },
  { v: 'V2', scope: '全局默认', pair: 'USD→CNY', src: '中国外汇交易中心', type: '浮动', rule: '结算单生成日', prec: '4 位 / 四舍五入', eff: '2026-03-01', status: '已失效', by: '赵倩', rv: '王敏', reason: '' },
  { v: 'V1-C20420', scope: '客户：华夏传媒', pair: 'EUR→CNY', src: '合同约定', type: '固定', rule: '固定 7.8200（至 2026-12-31）', prec: '4 位 / 截断', eff: '2026-05-01', status: '已生效', by: '王敏', rv: '赵倩', reason: '合同约定固定汇率' },
];
export const RATES = Array.from({ length: 64 }, (_, i) => { const d = new Date(2026, 9, 20 - i); return { id: 'R' + (9000 + i), pair: i % 4 === 3 ? 'EUR→CNY' : 'USD→CNY', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, val: (i % 4 === 3 ? 7.78 : 7.12) + ((i * 37) % 100) / 1000 - 0.05, src: '人行中间价', how: i % 5 ? '自动' : '手工', by: i % 5 ? '系统' : '赵倩', used: i > 20 }; });
export const NOTIFS_U = [{ t: '10-20 18:32', m: '《闪婚后，豪门老公他藏不住了》ReelShort 上架截图已到', to: '/u/tickets' }, { t: '10-19 11:05', m: '《神医下山》有 3 集需要你修改', to: '/u/tickets' }];
