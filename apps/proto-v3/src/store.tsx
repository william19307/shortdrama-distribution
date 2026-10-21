import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { App, Button } from 'antd';
import { DRAMAS, SETTLES, WITHDRAWS, CONTRACTS, TICKETS, CUSTOMERS, RATE_VERSIONS, RATES, ME, setMe, DEMO, GROUPS, OPS_USERS, PLATFORMS, SECOND_PLATS, NOTIFS_U, Drama, pick } from './mock';
export const now = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `2026-10-21 ${p(d.getHours())}:${p(d.getMinutes())}`; };
let uid = 1; export const nid = (p = '') => p + Date.now().toString(36).slice(-5) + (uid++);
const myDramas = DRAMAS.filter((d) => d.cust === ME);
const PLANS = myDramas.filter((d) => !['草稿', '上传中', '校验失败', '待补资质'].includes(d.status)).map((d, i) => ({ id: 'FX-' + (5000 + i), did: d.id, round: d.round, plats: d.round === '首发' ? PLATFORMS.map((p) => p.key) : [SECOND_PLATS[i % 9].key], batch: 'PC-10' + (i % 12), time: d.submitted, status: d.status === '已撤回' ? '已撤回' : '进行中', eta: `10月${23 + (i % 6)}日` }));
export const OPS_PAGES: [string, string][] = [['/o/workbench', '工作台'], ['/o/customers', '客户与资质'], ['/o/review', '审核队列'], ['/o/review-cfg', '分派/抽检/SLA'], ['/o/share', '分成管理'], ['/o/distribution', '发行管理'], ['/o/sync', '数据同步'], ['/o/watermark', '防伪截图'], ['/o/tickets', '工单中心'], ['/o/contracts', '合同管理'], ['/o/settle', '结算录入'], ['/o/settle-review', '应结复核'], ['/o/withdraw', '提款/发票/打款'], ['/o/rates', '汇率配置'], ['/o/tasks', '任务中心'], ['/o/config', '平台与周期配置']];
const ALLP = OPS_PAGES.map((x) => x[0]);
export const DEFAULT_PERMS: Record<string, string[]> = {
  运营专员: ALLP.filter((k) => !['/o/review-cfg', '/o/settle-review', '/o/withdraw', '/o/rates', '/o/config'].includes(k)),
  运营主管: ALLP.filter((k) => !['/o/withdraw'].includes(k)),
  财务: ['/o/workbench', '/o/tickets', '/o/settle', '/o/settle-review', '/o/withdraw', '/o/rates', '/o/tasks'],
  管理员: ['/o/workbench', '/o/tasks'],
};
const capDramas = (ds: Drama[], cap: number) => { const cnt: Record<string, number> = {}; return ds.map((d, i) => { let x = d; if (['审核中', '待审核'].includes(d.status)) { cnt[d.reviewer] = (cnt[d.reviewer] || 0) + 1; if (cnt[d.reviewer] > cap) x = { ...d, status: '待分派', reviewer: '', checked: 0, problems: 0 }; }
  if (d.status === '发行中' && i % 3 === 0) { const sp = SECOND_PLATS.slice(i % 7, (i % 7) + 2); x = { ...x, plats: { ...x.plats, ...Object.fromEntries(sp.map((p, k) => [p.key, ['已上架', '对接中', '待上架'][(i + k) % 3]])) } }; } return x; }); };
const DEMO_ACCT = { cert: '已认证', certInfo: { name: '星河影业（杭州）有限公司', code: '91330106MA2H8XXXX', legal: '陈星', contact: '13800001234', licFile: '营业执照_星河影业.jpg' } as any, bank: { name: '星河影业（杭州）有限公司', bank: '招商银行杭州分行', no: '571908812310601' } as any,
  licenses: [{ id: 'SQ-001', name: '2026 年度片库授权书.pdf', dramas: 220, exp: '2027-12-31', status: '已通过', cust: DEMO }, { id: 'SQ-002', name: '版权登记证书（批量）.zip', dramas: 140, exp: '长期', status: '已通过', cust: DEMO }] as any[],
  notifs: NOTIFS_U.map((n) => ({ ...n, read: false })) as any[], uploaded: true, firstVisit: { library: !localStorage.getItem('tour_lib'), dash: true } };
const init = () => ({
  dramas: capDramas(DRAMAS as Drama[], 24), settles: SETTLES, withdraws: WITHDRAWS, contracts: CONTRACTS, tickets: TICKETS, customers: CUSTOMERS, rateVersions: RATE_VERSIONS, rates: RATES, groups: GROUPS, plans: PLANS as any[],
  ...DEMO_ACCT, account: DEMO, acctStore: {} as Record<string, any>,
  otherLics: [{ id: 'SQ-301', name: '华夏传媒 2026 授权书.pdf', dramas: 0, exp: '2027-06-30', status: '审核中', cust: 'C20393', time: '2026-10-20 15:02' }, { id: 'SQ-302', name: '长风文化 版权证明.zip', dramas: 0, exp: '长期', status: '审核中', cust: 'C20394', time: '2026-10-21 09:12' }] as any[],
  onotifs: [{ t: '10-21 09:12', m: '长风文化（杭州）上传了版权证明，待资质审核', to: '/o/customers?tab=lic', read: false }, { t: '10-21 08:30', m: '3 部剧审核 SLA 将在 8 小时内到期', to: '/o/review', read: false }, { t: '10-20 22:10', m: 'ShortMax 10-19 报表存在 4 行问题待处理', to: '/o/sync', read: false }] as any[],
  perms: DEFAULT_PERMS, params: { sla: 48, remind: 8, escalate: true, cal: '跳过周末与法定节假日', holidays: '2026-10-01 ~ 2026-10-07', exportMax: 100000, taskConc: 3, keepDays: 30, wmRule: '{平台代码}_{剧ID}_{YYYYMMDD}_{类型}_{序号}', upRule: '{剧名}/第{集号:3}集.mp4', devPct: 5, syncCut: '06:00' } as any,
  assignCfg: { rule: '按客户责任运营', cap: 30, head: 3, tail: 2, mid: 10, expandAt: 1, newFull: true } as any,
  cycles: [{ k: 1, lv: '客户级默认', who: '星河影业（杭州）', cyc: '自然月', start: '2026-01-01', ver: 2, hist: [{ v: 1, cyc: '季度', t: '2025-12-20', by: '王敏' }, { v: 2, cyc: '自然月', t: '2026-01-01', by: '王敏' }] }, { k: 2, lv: '项目级覆盖', who: '星河影业 × 龙王殿 × 首发', cyc: '自定义 15 天', start: '2026-09-01', ver: 1, hist: [{ v: 1, cyc: '自定义 15 天', t: '2026-08-28', by: '王敏' }] }, { k: 3, lv: '客户级默认', who: '华夏传媒（杭州）', cyc: '季度', start: '2026-04-01', ver: 1, hist: [{ v: 1, cyc: '季度', t: '2026-03-30', by: '王敏' }] }] as any[],
  tasks: [] as any[], uploads: [] as any[], views: [{ name: '需要我修改', f: { st: '需要你处理' } }, { name: 'Q4 新剧', f: { group: '2026 Q4 新剧' } }] as any[],
  opsUser: 'linxiao',
  platforms: [...PLATFORMS.map((p) => ({ ...p })), ...SECOND_PLATS.map((p) => ({ ...p }))], minWithdraw: 10000,
  shareTpls: [{ id: 'TPL-01', name: '首发标准（无保底 70%）', v: 3, rows: PLATFORMS.map((p) => ({ plat: p.key, mode: '无保底', ratio: 70 })) }, { id: 'TPL-02', name: '头部客户（保底 + 75%）', v: 1, rows: PLATFORMS.map((p, i) => ({ plat: p.key, mode: i < 2 ? '保底' : '无保底', ratio: 75, cur: 'USD' })) }, { id: 'TPL-03', name: '超保底阶梯（60%/80%）', v: 2, rows: PLATFORMS.map((p) => ({ plat: p.key, mode: '超保底', ratio: 60, ratio2: 80, cur: 'USD' })) }],
  shots: [{ id: 'WM-1', file: 'RS_D10001_20261020_上架_01.png', status: '已归档', did: 'D10001', plat: 'ReelShort', date: '2026-10-20' }, { id: 'WM-2', file: 'DB_闪婚豪门_20261020_数据_01.png', status: '待归档', reason: '剧名多候选', cands: ['D10001', 'D10019'] }, { id: 'WM-3', file: 'IMG_8812.png', status: '待归档', reason: '文件名不符合规则' }] as any[],
  syncs: [] as any[], imports: [] as any[], aliases: {} as Record<string, string>, opLog: [] as any[],
});
export type St = ReturnType<typeof init>;
const Ctx = createContext<any>(null);
export const useS = () => useContext(Ctx) as { S: St; up: (fn: (n: St) => void) => void; addTask: (t: any) => string; undoable: (msg: string, apply: () => void, revert: () => void) => void; log: (a: string) => void };
export function Store({ children }: any) {
  const [S, setS] = useState(init); const Sref = useRef(S); Sref.current = S; const [, tick] = useState(0); const { message } = App.useApp();
  const up = (fn: (n: St) => void) => setS((s) => { const n = { ...s }; fn(n); return n; });
  useEffect(() => { const t = setInterval(() => { tick((x) => x + 1); setS((s) => {
    const running = s.uploads.filter((u) => u.status === '上传中'); const queued = s.uploads.filter((u) => u.status === '排队中');
    if (!running.length && !queued.length) return s;
    const uploads = s.uploads.map((u) => ({ ...u })); let r = uploads.filter((u) => u.status === '上传中').length;
    uploads.forEach((u) => { if (u.status === '排队中' && r < 3) { u.status = '上传中'; r++; } if (u.status === '上传中') { u.p = Math.min(100, u.p + 4 + Math.random() * 7); if (u.fail && u.p > 55) { u.status = '上传失败'; u.fail = false; } else if (u.p >= 100) { u.status = '校验中'; u.p = 100; } } });
    let dramas = s.dramas; const fin = uploads.filter((u) => u.status === '校验中'); if (fin.length) { const ids = new Set(fin.map((u) => u.did)); dramas = dramas.map((d) => ids.has(d.id) ? { ...d, status: '草稿' } : d); fin.forEach((u) => (u.status = '可用')); }
    return { ...s, uploads, dramas };
  }); }, 500); return () => clearInterval(t); }, []);
  const addTask = (t: any) => { const id = nid('T'); const dur = t.dur ?? Math.min(4500, 1200 + (t.total || 10) * 8);
    up((n) => { n.tasks = [{ id, start: Date.now(), dur, status: '执行中', ok: 0, fail: 0, skip: 0, side: t.side || 'u', ...t }, ...n.tasks]; });
    setTimeout(() => { if (Sref.current.tasks.find((x: any) => x.id === id)?.status === '已取消') return; const res = t.run ? t.run() : null; up((n) => { n.tasks = n.tasks.map((x) => x.id === id ? { ...x, status: res?.fail ? '部分成功' : '全部成功', ok: res?.ok ?? t.total, fail: res?.fail || 0, skip: res?.skip || 0, report: res?.report } : x); }); message.success(`任务完成：${t.name}`); }, dur);
    return id; };
  const undoable = (msg: string, apply: () => void, revert: () => void) => { apply(); const key = nid(); message.open({ key, type: 'success', duration: 10, content: <span>{msg} <Button size="small" type="link" onClick={() => { revert(); message.destroy(key); message.info('已撤销'); }}>撤销</Button></span> }); };
  const log = (a: string) => up((n) => { n.opLog = [{ t: now(), a: (OPS_USERS.find((u) => u.id === n.opsUser)?.name || '') + ' ' + a }, ...n.opLog]; });
  return <Ctx.Provider value={{ S, up, addTask, undoable, log }}>{children}</Ctx.Provider>;
}
const ACCT_KEYS = ['cert', 'certInfo', 'bank', 'licenses', 'notifs', 'uploaded', 'firstVisit'];
export const switchAcct = (n: any, id: string, fresh?: any) => { n.acctStore = { ...n.acctStore, [ME]: Object.fromEntries(ACCT_KEYS.map((k) => [k, n[k]])) }; const saved = n.acctStore[id] || fresh; ACCT_KEYS.forEach((k) => { n[k] = saved[k]; }); n.account = id; setMe(id); };
export const opsNotify = (n: any, m: string, to: string) => { n.onotifs = [{ t: now().slice(5), m, to, read: false }, ...n.onotifs]; };
export const taskProgress = (t: any) => t.status !== '执行中' ? 100 : Math.min(99, Math.round(((Date.now() - t.start) / t.dur) * 100));
// 客户视角 5 态
export const clientStatus = (s: string) => ({ 草稿: '草稿', 上传中: '草稿', 校验中: '草稿', 需修改: '需要你处理', 预检未通过: '需要你处理', 校验失败: '需要你处理', 待补资质: '需要你处理', 预检中: '审核中', 待分派: '审核中', 待审核: '审核中', 审核中: '审核中', 分成配置中: '审核中', 分成待复核: '审核中', 审核通过: '准备上架', 发行对接中: '准备上架', 发行中: '已上架', 已下架: '已下架', 已撤回: '已下架' } as any)[s] || '草稿';
export const stage = (s: string) => ({ 草稿: 1, 需要你处理: 2, 审核中: 2, 准备上架: 3, 已上架: 4, 已下架: 4 } as any)[clientStatus(s)] ?? 0;
export const download = (name: string, rows: any[][]) => { const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); };
export { pick };
