import React, { useMemo, useState } from 'react';
import { Layout, Menu, Input, Avatar, Badge, Segmented, Dropdown, Button, Tooltip, Drawer, Progress, Empty, Tag, AutoComplete, FloatButton, Space, List, Popover, Tabs } from 'antd';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { MenuOutlined, SearchOutlined, BellOutlined, BarChartOutlined, VideoCameraOutlined, FileProtectOutlined, WalletOutlined, CustomerServiceOutlined, UserOutlined, DashboardOutlined, AuditOutlined, PercentageOutlined, CloudUploadOutlined, BankOutlined, SettingOutlined, SendOutlined, MoonOutlined, LogoutOutlined, AccountBookOutlined, TeamOutlined, CameraOutlined, ProjectOutlined, ThunderboltOutlined, UnorderedListOutlined, DollarOutlined, SafetyCertificateOutlined, FileDoneOutlined, PauseOutlined, CaretRightOutlined, ReloadOutlined, CloseOutlined, ImportOutlined, FileSearchOutlined, SwapOutlined, TagsOutlined, ClusterOutlined, StopOutlined } from '@ant-design/icons';
import { useThemeMode } from './main';
import { useS, taskProgress, clientStatus, switchAcct } from './store';
import * as A from './admin';
import { Result } from 'antd';
import { ME, DEMO, OPS_USERS } from './mock';
import { ST, Cover } from './common';
import * as U from './user';
import * as U2 from './user2';
import * as O from './ops';
import * as O2 from './ops2';
const { Header, Sider, Content } = Layout;
const userMenu = [
  { type: 'group', label: '数据详情', children: [{ key: '/u/dashboard', icon: <BarChartOutlined />, label: '数据总览' }, { key: '/u/settle', icon: <WalletOutlined />, label: '结算与提款' }] },
  { type: 'group', label: '视频存储库', children: [{ key: '/u/library', icon: <VideoCameraOutlined />, label: '我的剧集' }, { key: '/u/upload', icon: <CloudUploadOutlined />, label: '批量上传' }, { key: '/u/plans', icon: <SendOutlined />, label: '发行进度' }, { key: '/u/organize', icon: <TagsOutlined />, label: '标签与分组' }] },
  { type: 'group', label: '合同', children: [{ key: '/u/contracts', icon: <FileProtectOutlined />, label: '合同申请及列表' }] },
  { type: 'divider' }, { key: '/u/tickets', icon: <CustomerServiceOutlined />, label: '消息与工单' }, { key: '/u/tasks', icon: <ThunderboltOutlined />, label: '任务中心' }, { key: '/u/account', icon: <UserOutlined />, label: '账户中心' },
];
const opsMenu = [
  { key: '/o/workbench', icon: <DashboardOutlined />, label: '工作台' }, { key: '/o/customers', icon: <TeamOutlined />, label: '客户与资质' },
  { type: 'group', label: '内容与发行', children: [{ key: '/o/review', icon: <AuditOutlined />, label: '审核队列' }, { key: '/o/review-cfg', icon: <ClusterOutlined />, label: '分派·抽检·SLA' }, { key: '/o/share', icon: <PercentageOutlined />, label: '分成管理' }, { key: '/o/distribution', icon: <ProjectOutlined />, label: '发行管理' }] },
  { type: 'group', label: '数据', children: [{ key: '/o/sync', icon: <ImportOutlined />, label: '数据同步 / 报表导入' }, { key: '/o/watermark', icon: <CameraOutlined />, label: '防伪截图' }] },
  { type: 'group', label: '服务', children: [{ key: '/o/tickets', icon: <CustomerServiceOutlined />, label: '工单中心' }, { key: '/o/contracts', icon: <FileProtectOutlined />, label: '合同管理' }] },
  { type: 'group', label: '结算', children: [{ key: '/o/settle', icon: <AccountBookOutlined />, label: '结算单与录入' }, { key: '/o/settle-review', icon: <FileDoneOutlined />, label: '应结金额复核' }, { key: '/o/withdraw', icon: <BankOutlined />, label: '提款·发票·打款' }, { key: '/o/rates', icon: <DollarOutlined />, label: '汇率配置' }] },
  { type: 'divider' }, { key: '/o/tasks', icon: <ThunderboltOutlined />, label: '任务中心' }, { key: '/o/config', icon: <SettingOutlined />, label: '平台名单与配置' },
];
const adminMenu = [{ key: '/a/roles', icon: <SafetyCertificateOutlined />, label: '角色与权限' }, { key: '/a/params', icon: <SettingOutlined />, label: '全局参数' }, { key: '/a/tasks', icon: <ThunderboltOutlined />, label: '全局任务监控' }, { key: '/a/logs', icon: <FileSearchOutlined />, label: '操作日志' }];
const filterMenu = (items: any[], ok: (k: string) => boolean): any[] => items.map((it) => it.children ? { ...it, children: filterMenu(it.children, ok) } : it).filter((it) => it.type === 'divider' || (it.children ? it.children.length > 0 : ok(it.key)));
export function TaskList({ side }: any) {
  const { S, up, addTask } = useS(); const list = S.tasks.filter((t) => !side || t.side === side);
  if (!list.length) return <Empty description="还没有任务。批量操作、导入、导出会出现在这里" />;
  return <List dataSource={list} renderItem={(t: any) => <div className="task">
    <div className="tic">{t.icon || <ThunderboltOutlined />}</div>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b className="ell">{t.name}</b><ST s={t.status} /></div>
      <Progress percent={t.status === '已取消' ? 0 : taskProgress(t)} size="small" status={t.status === '执行中' ? 'active' : t.status === '部分成功' ? 'exception' : t.status === '已取消' ? 'normal' : 'success'} showInfo={false} />
      <div className="meta">{t.status === '已取消' ? '已取消，未做任何修改' : t.status === '执行中' ? `处理中… 共 ${t.total ?? '-'} 项` : <>成功 <b style={{ color: '#18864b' }}>{t.ok}</b> · 失败 <b style={{ color: '#d6153c' }}>{t.fail}</b> · 跳过 {t.skip}</>}
        {t.report && <a style={{ marginLeft: 8 }} onClick={() => up((n) => { n.tasks = n.tasks.map((x) => x.id === t.id ? { ...x, open: !x.open } : x); })}>{t.open ? '收起报告' : '查看报告'}</a>}
        {t.status === '执行中' && <a style={{ marginLeft: 8, color: '#d6153c' }} onClick={() => up((n) => { n.tasks = n.tasks.map((x) => x.id === t.id ? { ...x, status: '已取消' } : x); })}>取消</a>}
        {t.status === '部分成功' && <a style={{ marginLeft: 8 }} onClick={() => addTask({ name: t.name + '（仅重试失败项）', total: t.fail, side: t.side, icon: <ReloadOutlined /> })}>仅重试失败项</a>}</div>
      {t.open && t.report && <div className="report">{t.report.map((r: any, i: number) => <div key={i}>{r.ok ? '✅' : '⚠️'} {r.m}</div>)}</div>}</div></div>} />;
}
function UploadQueue({ open, onClose }: any) {
  const { S, up } = useS(); const set = (id: string, st: string) => up((n) => { n.uploads = n.uploads.map((u) => u.id === id ? { ...u, status: st } : u); });
  return <Drawer title="上传队列" open={open} onClose={onClose} width={440} extra={<Space><Button size="small" onClick={() => up((n) => { n.uploads = n.uploads.map((u) => ['上传中', '排队中'].includes(u.status) ? { ...u, status: '已暂停' } : u); })}>全部暂停</Button><Button size="small" onClick={() => up((n) => { n.uploads = n.uploads.map((u) => ['已暂停', '上传失败'].includes(u.status) ? { ...u, status: '排队中' } : u); })}>全部继续</Button></Space>}>
    {!S.uploads.length ? <Empty description="没有上传中的剧" /> : S.uploads.map((u) => { const d = S.dramas.find((x) => x.id === u.did); return <div className="task" key={u.id}>
      {d && <Cover d={d} h={64} w={48} ep={false} />}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b className="ell">{u.name}</b><ST s={u.status} /></div>
        <Progress percent={Math.round(u.p)} size="small" status={u.status === '上传失败' ? 'exception' : u.status === '可用' ? 'success' : 'active'} />
        <div className="meta">{u.files} 个文件 · 分片直传 · 3 并发
          <span style={{ float: 'right' }}>{u.status === '上传中' && <Button size="small" type="text" icon={<PauseOutlined />} onClick={() => set(u.id, '已暂停')}>暂停</Button>}
            {u.status === '已暂停' && <Button size="small" type="text" icon={<CaretRightOutlined />} onClick={() => set(u.id, '排队中')}>继续</Button>}
            {u.status === '上传失败' && <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => set(u.id, '排队中')}>重试</Button>}
            {!['可用'].includes(u.status) && <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => up((n) => { n.uploads = n.uploads.filter((x) => x.id !== u.id); })} />}</span></div></div></div>; })}
  </Drawer>;
}
function GlobalSearch({ ops }: any) {
  const { S } = useS(); const nav = useNavigate(); const [q, setQ] = useState('');
  const opts = useMemo(() => { if (!q.trim()) return []; const k = q.trim().toLowerCase();
    const ds = S.dramas.filter((d) => (ops || d.cust === ME) && (d.cn.toLowerCase().includes(k) || d.en.toLowerCase().includes(k) || d.id.toLowerCase().includes(k))).slice(0, 6);
    const ts = S.tickets.filter((t) => (ops || t.cust === ME) && (t.id.toLowerCase().includes(k) || t.title.includes(q))).slice(0, 4);
    const cs = ops ? S.customers.filter((c) => c.name.includes(q) || c.id.toLowerCase().includes(k)).slice(0, 4) : [];
    const res: any[] = [];
    if (ds.length) res.push({ label: <b>剧集</b>, options: ds.map((d) => ({ value: 'd:' + d.id, label: <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Cover d={d} h={36} w={27} ep={false} /><span className="ell" style={{ flex: 1 }}>{d.cn}</span><span className="meta">{d.id}</span></div> })) });
    if (ts.length) res.push({ label: <b>工单</b>, options: ts.map((t) => ({ value: 't:' + t.id, label: <span>{t.id} · {t.title}</span> })) });
    if (cs.length) res.push({ label: <b>客户</b>, options: cs.map((c) => ({ value: 'c:' + c.id, label: <span>{c.name} · {c.id}</span> })) });
    if (!res.length) res.push({ value: 'none', disabled: true, label: <span className="meta">没有找到「{q}」</span> });
    return res; }, [q, S.dramas, ops]);
  return <AutoComplete style={{ width: '100%', maxWidth: 560 }} options={opts} value={q} onChange={setQ} popupMatchSelectWidth
    onSelect={(v: string) => { const [t, id] = v.split(':'); setQ(''); if (t === 'd') { const dd = S.dramas.find((x) => x.id === id); nav(!ops ? '/u/drama/' + id : ['待分派', '待审核', '审核中'].includes(dd?.status || '') ? '/o/review/' + id : '/o/distribution?q=' + id); } if (t === 't') nav((ops ? '/o/tickets?id=' : '/u/tickets?id=') + id); if (t === 'c') nav('/o/customers?q=' + id); }}>
    <Input size="large" prefix={<SearchOutlined style={{ color: 'var(--t2)' }} />} placeholder={ops ? '搜索客户、剧名、剧 ID、工单号' : '搜索剧名 / 外文名 / 剧 ID / 工单号'} style={{ borderRadius: 999 }} allowClear /></AutoComplete>;
}
function Forbidden({ side, role }: any) { const nav = useNavigate(); const { up } = useS(); return <div className="page"><Result status="403" title={side === 'a' ? '管理端仅限管理员' : `当前角色「${role}」没有此页面权限`} subTitle={side === 'a' ? '权限、全局参数、操作日志由管理员维护' : '权限由管理端「角色与权限」配置，修改后菜单即时生效'} extra={<Space><Button type="primary" onClick={() => nav(side === 'a' ? '/o/workbench' : '/o/workbench')}>回工作台</Button>{side === 'a' && <Button onClick={() => up((n) => { n.opsUser = 'admin'; })}>切换为管理员 周岚</Button>}</Space>} /></div>; }
const Keyed = ({ C }: any) => { const l = useLocation(); return <C key={l.pathname + l.search} />; };
function Shell() {
  const nav = useNavigate(); const loc = useLocation(); const { dark, setDark } = useThemeMode(); const { S, up } = useS();
  const [col, setCol] = useState(false); const side = loc.pathname.startsWith('/o') ? 'o' : loc.pathname.startsWith('/a') ? 'a' : 'u'; const ops = side !== 'u'; const [tq, setTq] = useState(false); const [uq, setUq] = useState(false);
  const me = OPS_USERS.find((u) => u.id === S.opsUser)!; const running = S.tasks.filter((t) => t.status === '执行中' && t.side === (ops ? 'o' : 'u')).length;
  const upAct = S.uploads.filter((u) => !['可用'].includes(u.status)); const upP = upAct.length ? Math.round(upAct.reduce((a, b) => a + b.p, 0) / upAct.length) : 100;
  const pool = ops ? S.onotifs : S.notifs; const unread = pool.filter((n: any) => !n.read).length; const key = ops ? 'onotifs' : 'notifs';
  const allowed = (k: string) => (S.perms[me.role] || []).includes(k); const cust = S.customers.find((c) => c.id === ME);
  const sel0 = '/' + loc.pathname.split('/').slice(1, 3).join('/'); const known = ['/o/workbench', ...Object.values(S.perms).flat()];
  const forbidden = side === 'o' ? (known.includes(sel0) && !allowed(sel0) && !loc.pathname.startsWith('/o/review/')) || (loc.pathname.startsWith('/o/review/') && !allowed('/o/review')) : side === 'a' ? me.role !== '管理员' : false;
  const bell = <div style={{ width: 340 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b>{ops ? '运营通知' : '通知'}</b><a onClick={() => up((n: any) => { n[key] = n[key].map((x: any) => ({ ...x, read: true })); })}>全部已读</a></div>
    {pool.length ? pool.slice(0, 8).map((n: any, i: number) => <div key={i} className={'notif' + (n.read ? '' : ' unread')} onClick={() => { up((s: any) => { s[key] = s[key].map((x: any, j: number) => j === i ? { ...x, read: true } : x); }); nav(n.to); }}><div>{n.m}</div><div className="meta">{n.t}</div></div>) : <Empty description="暂无通知" />}</div>;
  const sel = '/' + loc.pathname.split('/').slice(1, 3).join('/');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
        <Button type="text" shape="circle" icon={<MenuOutlined />} onClick={() => setCol(!col)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17, width: 200, cursor: 'pointer', flexShrink: 0 }} onClick={() => nav(side === 'o' ? '/o/workbench' : side === 'a' ? '/a/roles' : '/u/dashboard')}>
          <span className="logo">▶</span>剧出海 <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 14 }}>{side === 'o' ? 'Ops' : side === 'a' ? 'Admin' : 'Studio'}</span></div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>{side !== 'a' && <GlobalSearch ops={ops} />}</div>
        <Segmented value={side} onChange={(v) => nav(v === 'o' ? '/o/workbench' : v === 'a' ? '/a/roles' : '/u/dashboard')} options={[{ label: '用户端', value: 'u' }, { label: '运营端', value: 'o' }, { label: '管理端', value: 'a' }]} />
        {!ops && <Tooltip title="上传队列"><Badge count={upAct.length} size="small"><Button type="text" shape="circle" icon={<CloudUploadOutlined />} onClick={() => setUq(true)} /></Badge></Tooltip>}
        <Tooltip title="任务中心"><Badge count={running} size="small" color="#1668dc"><Button type="text" shape="circle" icon={<UnorderedListOutlined />} onClick={() => setTq(true)} data-testid="tasks" /></Badge></Tooltip>
        <Tooltip title="深色主题"><Button type="text" shape="circle" icon={<MoonOutlined />} onClick={() => setDark(!dark)} /></Tooltip>
        <Popover trigger="click" content={bell} placement="bottomRight"><Badge count={unread} size="small"><Button type="text" shape="circle" icon={<BellOutlined />} /></Badge></Popover>
        <Dropdown menu={{ items: ops ? [...OPS_USERS.filter((u) => ['linxiao', 'wangmin', 'zhaoqian', 'admin'].includes(u.id)).map((u) => ({ key: 'r:' + u.id, label: `切换为 ${u.name}（${u.role}）`, icon: <SwapOutlined />, disabled: u.id === S.opsUser })), { type: 'divider' }, { key: 'l', label: '退出登录', icon: <LogoutOutlined /> }] as any : [{ key: 'a', label: '账户中心', icon: <UserOutlined /> }, ...(S.account !== DEMO ? [{ key: 'demo', label: '切换到演示账号（星河影业）', icon: <SwapOutlined /> }] : S.acctStore && Object.keys(S.acctStore).some((k) => k !== DEMO) ? [{ key: 'new', label: '切换回新注册账号', icon: <SwapOutlined /> }] : []), { type: 'divider' }, { key: 'l', label: '退出登录', icon: <LogoutOutlined /> }],
          onClick: ({ key }) => key.startsWith('r:') ? up((n) => { n.opsUser = key.slice(2); }) : key === 'a' ? nav('/u/account') : key === 'demo' ? (up((n) => switchAcct(n, DEMO)), nav('/u/dashboard')) : key === 'new' ? (up((n) => switchAcct(n, Object.keys(n.acctStore).find((k) => k !== DEMO)!)), nav('/u/dashboard')) : nav('/login') }}>
          <Avatar style={{ background: ops ? '#3B3B3B' : '#D6153C', cursor: 'pointer', flexShrink: 0 }}>{ops ? me.name[0] : cust?.name[0]}</Avatar></Dropdown>
      </Header>
      <Layout>
        <Sider width={236} collapsedWidth={72} collapsed={col} style={{ position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflow: 'auto' }}>
          {!col && <div style={{ padding: '18px 20px 6px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar size={44} style={{ background: ops ? '#3B3B3B' : '#D6153C', flexShrink: 0 }}>{ops ? me.name[0] : cust?.name[0]}</Avatar>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }} className="ell">{ops ? `${me.name} · ${me.role}` : cust?.name}</div><div style={{ fontSize: 12, color: 'var(--t2)' }}>{ops ? (me.role === '管理员' ? '超级管理员' : me.role === '财务' ? '财务结算' : '负责 98 个客户') : <span style={{ cursor: 'pointer' }} onClick={() => nav('/u/account')}><ST s={S.cert} /></span>}</div></div></div>}
          <Menu mode="inline" inlineCollapsed={col} selectedKeys={[sel]} items={(side === 'o' ? filterMenu(opsMenu, allowed) : side === 'a' ? adminMenu : userMenu) as any} onClick={(e) => nav(e.key)} style={{ border: 0, padding: '8px 12px' }} />
        </Sider>
        <Content>{forbidden ? <Forbidden side={side} role={me.role} /> : <Routes>
          <Route path="/u/dashboard" element={<U.Dashboard />} /><Route path="/u/drama/:id" element={<Keyed C={U.DramaDetail} />} /><Route path="/u/settle" element={<U2.Settle />} />
          <Route path="/u/library" element={<U.Library />} /><Route path="/u/upload" element={<U.BatchUpload />} /><Route path="/u/plans" element={<U.Plans />} />
          <Route path="/u/contracts" element={<U2.Contracts />} /><Route path="/u/tickets" element={<U2.Tickets />} /><Route path="/u/account" element={<U2.Account />} />
          <Route path="/o/workbench" element={<O.Workbench />} /><Route path="/o/customers" element={<Keyed C={O.Customers} />} /><Route path="/o/review" element={<O.ReviewQueue />} /><Route path="/o/review/:id" element={<Keyed C={O.ReviewDesk} />} />
          <Route path="/o/share" element={<Keyed C={O.Share} />} /><Route path="/o/distribution" element={<Keyed C={O.Distribution} />} /><Route path="/o/sync" element={<O.Sync />} /><Route path="/o/watermark" element={<Keyed C={O.Watermark} />} />
          <Route path="/o/tickets" element={<O2.OTickets />} /><Route path="/o/contracts" element={<O2.OContracts />} /><Route path="/o/settle" element={<O2.SettleEntry />} /><Route path="/o/settle-review" element={<O2.SettleReview />} />
          <Route path="/o/withdraw" element={<O2.Withdraw />} /><Route path="/o/rates" element={<O2.Rates />} /><Route path="/o/tasks" element={<O2.Tasks />} /><Route path="/o/config" element={<O2.Config />} /><Route path="/o/review-cfg" element={<O.ReviewCfg />} /><Route path="/u/tasks" element={<U2.UTasks />} /><Route path="/u/organize" element={<U2.Organize />} />
          <Route path="/a/roles" element={<A.Roles />} /><Route path="/a/params" element={<A.Params />} /><Route path="/a/tasks" element={<A.TaskMon />} /><Route path="/a/logs" element={<A.Logs />} /><Route path="/o/admin" element={<Navigate to="/a/roles" />} />
          <Route path="*" element={<U.NotFound />} />
        </Routes>}</Content>
      </Layout>
      <Drawer title="任务中心" open={tq} onClose={() => setTq(false)} width={460}><TaskList side={ops ? 'o' : 'u'} /></Drawer>
      <UploadQueue open={uq} onClose={() => setUq(false)} />
      {!ops && upAct.length > 0 && <FloatButton icon={<CloudUploadOutlined />} badge={{ count: upAct.length }} description={upP + '%'} shape="square" style={{ right: 32, bottom: 32, width: 64 }} onClick={() => setUq(true)} />}
    </Layout>
  );
}
export default function App() {
  return <Routes><Route path="/login" element={<U2.Login />} /><Route path="/" element={<Navigate to="/login" />} /><Route path="/*" element={<Shell />} /></Routes>;
}
