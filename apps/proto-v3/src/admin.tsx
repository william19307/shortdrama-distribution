import React, { useState } from 'react';
import { Row, Col, Button, Table, Tag, Checkbox, App, Form, InputNumber, Input, Switch, Select, Timeline, Space, Alert, Segmented, Modal } from 'antd';
import { SafetyCertificateOutlined, SettingOutlined, ThunderboltOutlined, FileSearchOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons';
import { PH, ST, pager } from './common';
import { useS, now, taskProgress, OPS_PAGES, DEFAULT_PERMS, download } from './store';
import { OPS_USERS } from './mock';
const ROLES = ['运营专员', '运营主管', '财务', '管理员'];
const BTN_PERMS = [['审核通过/驳回', ['运营专员', '运营主管']], ['分成复核', ['运营主管']], ['强制发布问题数据', ['运营主管']], ['应结金额复核', ['运营主管', '财务']], ['确认打款', ['财务']], ['汇率版本复核', ['运营主管', '财务']], ['导出客户数据', ['运营主管', '财务']]];
export function Roles() {
  const { S, up, log } = useS(); const { message } = App.useApp(); const [draft, setDraft] = useState<Record<string, string[]>>(S.perms); const dirty = JSON.stringify(draft) !== JSON.stringify(S.perms);
  const toggle = (r: string, k: string, v: boolean) => setDraft({ ...draft, [r]: v ? [...draft[r], k] : draft[r].filter((x) => x !== k) });
  return <div className="page"><PH title="角色与权限" icon={<SafetyCertificateOutlined />} sub="勾选后点「保存」立即生效：运营端菜单与页面访问随之变化（右上角头像切换角色验证）"
    extra={<Space><Button icon={<UndoOutlined />} onClick={() => setDraft(DEFAULT_PERMS)}>恢复默认</Button><Button type="primary" disabled={!dirty} onClick={() => { const diff = ROLES.flatMap((r) => [...draft[r].filter((k) => !S.perms[r].includes(k)).map((k) => `${r} +${OPS_PAGES.find((p) => p[0] === k)?.[1]}`), ...S.perms[r].filter((k) => !draft[r].includes(k)).map((k) => `${r} −${OPS_PAGES.find((p) => p[0] === k)?.[1]}`)]); up((n) => { n.perms = draft; }); log('权限变更：' + diff.join('，')); message.success(`已保存 ${diff.length} 项权限变更，已写入操作日志`); }}>保存{dirty ? '（有未保存修改）' : ''}</Button></Space>} />
    <Row gutter={16}><Col span={15}><div className="card" style={{ padding: 8 }}><div className="ct" style={{ padding: '8px 8px 0' }}>页面（菜单）权限</div><Table size="small" rowKey="k" pagination={false} dataSource={OPS_PAGES.map(([k, m]) => ({ k, m }))} columns={[{ title: '页面', dataIndex: 'm' }, ...ROLES.map((r) => ({ title: r, align: 'center' as const, render: (x: any) => <Checkbox checked={draft[r].includes(x.k)} onChange={(e) => toggle(r, x.k, e.target.checked)} /> }))]} /></div></Col>
      <Col span={9}><div className="card"><div className="ct">账号与角色</div>{OPS_USERS.map((u) => <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>{u.name} {u.id === S.opsUser && <Tag color="red">当前</Tag>}</span><Tag>{u.role}</Tag></div>)}</div>
        <div className="card" style={{ marginTop: 16 }}><div className="ct">按钮级权限（演示，只读）</div>{BTN_PERMS.map(([b, rs]: any) => <div key={b} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{b}</span><Space size={2}>{rs.map((r: string) => <Tag key={r} color="blue">{r}</Tag>)}</Space></div>)}<Alert style={{ marginTop: 8 }} type="info" showIcon message="数据级权限：运营专员只看自己负责客户的结算与工单（后续版本）" /></div></Col></Row></div>;
}
export function Params() {
  const { S, up, log } = useS(); const { message } = App.useApp(); const [f] = Form.useForm();
  const G = ({ t, children }: any) => <div className="card" style={{ marginBottom: 16 }}><div className="ct">{t}</div>{children}</div>;
  return <div className="page"><PH title="全局参数" icon={<SettingOutlined />} sub="修改后保存即生效，全部写入操作日志" extra={<Button type="primary" onClick={() => f.submit()}>保存</Button>} />
    <Form form={f} layout="vertical" initialValues={{ ...S.params, minWithdraw: S.minWithdraw }} onFinish={(v) => { const ch = Object.keys(v).filter((k) => (k === 'minWithdraw' ? S.minWithdraw : S.params[k]) !== v[k]); up((n) => { n.minWithdraw = v.minWithdraw; n.params = { ...n.params, ...v }; }); log('全局参数修改：' + (ch.join('、') || '无变化')); message.success(ch.length ? `已保存 ${ch.length} 项` : '没有变化'); }}>
      <Row gutter={16}><Col span={12}>
        <G t="SLA 与提醒规则"><Row gutter={12}><Col span={8}><Form.Item name="sla" label="审核 SLA（小时）"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="remind" label="到期前提醒（小时）"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="escalate" label="超时升级主管" valuePropName="checked"><Switch /></Form.Item></Col></Row></G>
        <G t="工作日历"><Form.Item name="cal" label="SLA 计时"><Segmented options={['自然日', '跳过周末', '跳过周末与法定节假日']} /></Form.Item><Form.Item name="holidays" label="节假日"><Input /></Form.Item></G>
        <G t="结算"><Row gutter={12}><Col span={12}><Form.Item name="minWithdraw" label="最低提款额（¥）"><InputNumber min={0} step={1000} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="devPct" label="应结偏差提示阈值（%）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row></G></Col>
        <Col span={12}><G t="导出与任务参数"><Row gutter={12}><Col span={8}><Form.Item name="exportMax" label="单次导出上限（行）"><InputNumber min={1000} step={10000} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="taskConc" label="每人并发任务"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="keepDays" label="报告保留（天）"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="syncCut" label="数据同步每日截止"><Input style={{ width: 120 }} /></Form.Item></G>
        <G t="文件命名规则"><Form.Item name="wmRule" label="防伪截图批量归档"><Input /></Form.Item><Form.Item name="upRule" label="客户批量上传识别"><Input /></Form.Item><div className="meta">示例：RS_D10001_20261020_上架_01.png · 龙王殿/第001集.mp4</div></G></Col></Row></Form></div>;
}
export function TaskMon() {
  const { S, up, log } = useS(); const [side, setSide] = useState('全部'); const list = S.tasks.filter((t) => side === '全部' || (side === '客户' ? t.side === 'u' : t.side === 'o'));
  return <div className="page"><PH title="全局任务监控" icon={<ThunderboltOutlined />} sub="全部客户与运营发起的异步任务；执行中的任务可取消（取消后不做任何修改）" />
    <Segmented style={{ marginBottom: 12 }} value={side} onChange={(v: any) => setSide(v)} options={['全部', '客户', '运营']} />
    <div className="card" style={{ padding: 8 }}><Table rowKey="id" size="middle" dataSource={list} pagination={pager(list.length)} locale={{ emptyText: '还没有任务：去运营端做一次批量操作，这里会实时出现' }} columns={[{ title: '任务', dataIndex: 'name' }, { title: '来源', render: (t: any) => <Tag>{t.side === 'u' ? '客户' : '运营'}</Tag> }, { title: '状态', dataIndex: 'status', render: (s: string) => <ST s={s} /> }, { title: '进度', render: (t: any) => `${t.status === '已取消' ? 0 : taskProgress(t)}%` }, { title: '结果', render: (t: any) => t.status === '执行中' || t.status === '已取消' ? '—' : `成功 ${t.ok} / 失败 ${t.fail} / 跳过 ${t.skip}` }, { title: '', render: (t: any) => t.status === '执行中' && <Button size="small" danger icon={<StopOutlined />} onClick={() => { up((n) => { n.tasks = n.tasks.map((x) => x.id === t.id ? { ...x, status: '已取消' } : x); }); log('取消任务：' + t.name); }}>取消</Button> }]} /></div></div>;
}
export function Logs() {
  const { S } = useS(); const [q, setQ] = useState('');
  const base = [...S.opLog, { t: '2026-10-21 08:02', a: '王敏 复核通过分成 12 部' }, { t: '2026-10-20 18:40', a: '赵倩 确认打款 TX3001' }, { t: '2026-10-20 10:15', a: '周岚 权限变更：财务 +汇率配置' }]; const list = base.filter((l) => !q || l.a.includes(q));
  return <div className="page"><PH title="操作日志" icon={<FileSearchOutlined />} sub="权限、参数、配置、关键审批全部留痕" extra={<Button onClick={() => download('操作日志.csv', [['时间', '操作'], ...list.map((l) => [l.t, l.a])])}>导出</Button>} />
    <Input.Search allowClear placeholder="搜索操作内容" onSearch={setQ} style={{ width: 280, marginBottom: 12 }} />
    <div className="card"><Timeline items={list.map((l) => ({ children: <span>{l.t} · {l.a}</span> }))} /></div></div>;
}
