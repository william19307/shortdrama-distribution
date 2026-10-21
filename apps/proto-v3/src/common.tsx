import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Tooltip, Tag, Button, Progress, Popover, Checkbox, Table } from 'antd';
import { InfoCircleOutlined, ExperimentOutlined, EditOutlined, ExclamationCircleFilled, ClockCircleFilled, RocketFilled, CheckCircleFilled, InboxOutlined, BulbFilled, SyncOutlined, CloseCircleFilled, MinusCircleFilled, SettingOutlined } from '@ant-design/icons';
import { useThemeMode } from './main';
import { COVERS, TINTS, EMPTY_IMG, platColor, ALL_PLATS } from './mock';
import { clientStatus } from './store';
export const Demo = () => <span className="demo"><ExperimentOutlined />示例数据</span>;
export const PH = ({ title, sub, extra, icon }: any) => (
  <div className="ph"><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>{icon && <div className="ph-ic">{icon}</div>}<div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{extra}</div></div>
);
export const Kpi = ({ label, value, delta, tip, icon, color = '#D6153C' }: any) => (
  <div className="card kpi"><div style={{ display: 'flex', justifyContent: 'space-between' }}><div className="lb">{label}{tip && <Tooltip title={tip}><InfoCircleOutlined /></Tooltip>}</div>{icon && <span className="kic" style={{ background: color + '18', color }}>{icon}</span>}</div>
    <div className="v">{value}</div>{delta != null ? <div className={'d ' + (delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% <span style={{ color: 'var(--t2)' }}>较上一周期</span></div> : <div className="d">&nbsp;</div>}</div>
);
export const Cover = ({ d, h = 200, ep = true, w }: any) => (
  <div className="cover" style={{ height: h, width: w, backgroundImage: `linear-gradient(180deg,transparent 45%,rgba(0,0,0,.82)),linear-gradient(${TINTS[d.tint]},${TINTS[d.tint]}),url(${COVERS[d.img]})` }}>
    {h > 90 && <span className="t" style={{ fontSize: h > 120 ? 14 : 11 }}>{d.cn}</span>}{ep && h > 90 && <span className="ep">{d.eps} 集</span>}</div>
);
export const CS: any = { 草稿: { c: '#8c8c8c', bg: '#f0f0f0', i: <EditOutlined /> }, 需要你处理: { c: '#d46b08', bg: '#fff1e0', i: <ExclamationCircleFilled /> }, 审核中: { c: '#1668dc', bg: '#e6f0ff', i: <ClockCircleFilled /> }, 准备上架: { c: '#531dab', bg: '#f1e8ff', i: <RocketFilled /> }, 已上架: { c: '#18864b', bg: '#e3f6ea', i: <CheckCircleFilled /> }, 已下架: { c: '#8c8c8c', bg: '#f0f0f0', i: <InboxOutlined /> } };
export const CStatus = ({ s, raw, big }: any) => { const k = raw ? clientStatus(raw) : s; const c = CS[k] || CS['草稿']; return <span className={'cst' + (big ? ' big' : '')} style={{ color: c.c, background: c.bg }}>{c.i}{k}</span>; };
const IC: any = { green: ['已上架', '已到账', '已生效', '已发布', '全部成功', '已认证', '通过', '已归档', '已解决', '已关闭', '可用', '已打款', '审核通过', '发行中', '已复核', '可发布', '自动匹配', '已通过'], blue: ['审核中', '核对中', '执行中', '对接中', '发行对接中', '处理中', '起草中', '待上架', '同步中', '上传中', '校验中', '分成配置中', '待审核', '打款中', '发票审核中', '待分派', '预检中', '变更审核中', '人工确认', '待确认'], orange: ['需修改', '待复核', '待申请', '待开票', '部分成功', '待签署', '待客户查看', '待录入', '分成待复核', '待归档', '待对接', '已暂停', '模糊候选', '待人工处理', '修正', '已超时', '新消息', '待主管处理'], red: ['平台已拒绝', '失败', '认证驳回', '上传失败', '校验失败', '驳回', '问题', '未匹配', '异常', '预检未通过', '待补资质', '已退回', '已驳回'], default: ['草稿', '已下架', '已撤回', '无需结算', '未达起提额', '已到期', '申请中', '已失效', '未认证', '排队中', '客户已读', '已读', '已取消', '周期未结束', '忽略', '待同步'] };
export const tagColor = (s: string) => { for (const k in IC) if (IC[k].includes(s)) return k === 'green' ? 'success' : k === 'blue' ? 'processing' : k === 'orange' ? 'warning' : k === 'red' ? 'error' : 'default'; return 'default'; };
const TI: any = { success: <CheckCircleFilled />, processing: <SyncOutlined />, warning: <ExclamationCircleFilled />, error: <CloseCircleFilled />, default: <MinusCircleFilled /> };
export const ST = ({ s }: any) => { const c = tagColor(s); return <Tag bordered={false} color={c} icon={TI[c]}>{s}</Tag>; };
export const PlatLogo = ({ k, size = 22, dim, title = true }: any) => { const p = ALL_PLATS.find((x) => x.key === k); const el = <span className="plogo" style={{ width: size, height: size, fontSize: size * 0.42, background: dim ? '#cfcfcf' : platColor(k) }}>{p?.short || k.slice(0, 2)}</span>; return title ? <Tooltip title={k}>{el}</Tooltip> : el; };
export const Empty2 = ({ title = '这里还没有内容', desc, action }: any) => <div className="empty2"><img src={EMPTY_IMG} /><div className="et">{title}</div>{desc && <div className="ed">{desc}</div>}{action}</div>;
export const Conclusion = ({ children }: any) => <div className="concl"><BulbFilled style={{ color: '#f5a623', fontSize: 18 }} /><span>{children}</span></div>;
export const Ring = ({ p, size = 44, color }: any) => <Progress type="circle" percent={p} size={size} strokeColor={color || (p >= 100 ? '#18864b' : '#D6153C')} format={(x) => <span style={{ fontSize: size / 4 }}>{x}%</span>} />;
export function Chart({ option, height = 300, onEvents }: any) {
  const { dark } = useThemeMode();
  const axis = { axisLine: { lineStyle: { color: dark ? '#333' : '#e5e5e5' } }, axisLabel: { color: dark ? '#aaa' : '#606060', hideOverlap: true }, splitLine: { lineStyle: { color: dark ? '#262626' : '#f0f0f0' } } };
  const o = { backgroundColor: 'transparent', animation: !(navigator as any).webdriver, textStyle: { fontFamily: 'Inter,PingFang SC,sans-serif' }, grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: dark ? '#282828' : '#fff', borderColor: dark ? '#333' : '#eee', textStyle: { color: dark ? '#eee' : '#0f0f0f' }, extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12)' },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: dark ? '#ccc' : '#444' } }, ...option,
    xAxis: option.xAxis && { ...axis, ...option.xAxis }, yAxis: option.yAxis && { ...axis, ...option.yAxis } };
  return <ReactECharts option={o} style={{ height }} notMerge theme={dark ? 'dark' : undefined} opts={{ renderer: 'svg' }} onEvents={onEvents} />;
}
export const pager = (total: number, extra: any = {}) => ({ showSizeChanger: true, pageSizeOptions: [20, 50, 100], defaultPageSize: 20, showTotal: (t: number) => `共 ${t.toLocaleString()} 条`, total, ...extra });
export const BigBtn = (p: any) => <Button type="primary" size="large" {...p} className={'bigbtn ' + (p.className || '')} />;

export const LicImg = (name: string, code: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420"><rect width="600" height="420" fill="#fbf6ea"/><rect x="14" y="14" width="572" height="392" fill="none" stroke="#b8862b" stroke-width="6"/><rect x="26" y="26" width="548" height="368" fill="none" stroke="#b8862b" stroke-width="1.5"/><text x="300" y="86" font-size="40" text-anchor="middle" fill="#a31d1d" font-family="serif" font-weight="bold">营 业 执 照</text><text x="300" y="116" font-size="14" text-anchor="middle" fill="#8a6d3b">（副 本）· 示例占位图</text><g font-size="16" fill="#333" font-family="sans-serif"><text x="60" y="170">统一社会信用代码：${code}</text><text x="60" y="206">名　　称：${name}</text><text x="60" y="242">类　　型：有限责任公司</text><text x="60" y="278">法定代表人：（客户上传原件中识别）</text><text x="60" y="314">成立日期：2019 年 05 月 16 日</text></g><circle cx="480" cy="320" r="52" fill="none" stroke="#d6153c" stroke-width="3" opacity=".7"/><text x="480" y="326" font-size="14" text-anchor="middle" fill="#d6153c" opacity=".8">登记机关</text><text x="300" y="384" font-size="12" text-anchor="middle" fill="#aaa">原型占位：真实系统展示客户上传的原始文件，可查看原图 / 下载</text></svg>`);
export function useColSet(storeKey: string) {
  const [hide, setHide] = React.useState<string[]>(() => JSON.parse(localStorage.getItem('cols_' + storeKey) || '[]'));
  const ref = React.useRef<any[]>([]);
  const save = (h: string[]) => { setHide(h); localStorage.setItem('cols_' + storeKey, JSON.stringify(h)); };
  const nm = (c: any) => (typeof c.title === 'string' ? c.title : '');
  const cols = (c: any[]) => { ref.current = c; return c.filter((x) => !nm(x) || !hide.includes(nm(x))); };
  const btn = () => <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Popover trigger="click" placement="bottomRight" title="显示的列" content={<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{ref.current.filter(nm).map((c) => <Checkbox key={nm(c)} checked={!hide.includes(nm(c))} onChange={(e) => save(e.target.checked ? hide.filter((x) => x !== nm(c)) : [...hide, nm(c)])}>{nm(c)}</Checkbox>)}<a onClick={() => save([])}>恢复默认</a></div>}><Button size="small" type="text" icon={<SettingOutlined />}>列设置{hide.length ? `（隐藏 ${hide.length}）` : ''}</Button></Popover></div>;
  return { cols, btn };
}
export const selAll = (list: any[], setSel: (k: any[]) => void, idKey = 'id') => [Table.SELECTION_ALL, Table.SELECTION_NONE, { key: 'filtered', text: `选择全部筛选结果（${list.length}）`, onSelect: () => setSel(list.map((x) => x[idKey])) }];
