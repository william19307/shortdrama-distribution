import { motion as motionTokens } from '@ds/tokens';
import { App, Button, Card, Checkbox, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Upload } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEAL_TYPE_LABEL, DATA_SOURCE_LABEL, LISTING_LABEL, LISTING_NEXT, SHARE_MODE_LABEL } from '@shortform/shared';
import { api, download, downloadPost, getToken, qs, uploadFile, type Page } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, PlatformChip, StatusTag, dayText, labelOf } from '../ui';

interface Plan {
  id: string; code: string; status: string; statusLabel?: string; round: string; rejectSummary?: string | null;
  drama: { id: string; title: string; code: string };
  company: { id: string; name: string };
  platforms: { id: string; platformId: string; platformName: string; listingStatus: string; platformDramaId?: string; listingUrl?: string }[];
  shares: { platformId: string; mode: string; clientRate: string; overRate?: string | null; guaranteeAmount?: string | null; guaranteeCurrency?: string | null; guaranteePeriodDays?: number | null; reviewStatus: string }[];
  episodes?: { id: string; no: number; reviewStatus: string; rejectReason?: string | null; fileName?: string | null }[];
}

export function WorkbenchPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, number | { minWithdrawAmount: string; deviationPct: string; syncDeadline: string }> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<typeof data>('/workbench').then(setData).catch((err) => setError(err.message)); }, []);
  const cards: [string, string][] = [
    ['reviews', '待审发行'],
    ['shareConfig', '待配分成'],
    ['shareReview', '分成待复核'],
    ['entry', '待录入结算'],
    ['toReview', '结算待复核'],
    ['invoices', '发票待审'],
    ['paying', '待打款'],
    ['pendingShots', '截图待归档'],
    ['overdue', '已过预计时间'],
  ].filter(([key]) => user?.role !== 'BD' || !['entry', 'toReview', 'invoices', 'paying', 'shareReview'].includes(key)) as [string, string][];
  return (
    <div>
      <PageHead title="工作台" hint="数字是你职责范围内还没做完的事。" />
      <ErrorNote error={error} />
      <div className="stat-row">
        {cards.map(([key, title]) => <Card key={key} className="ds-stat"><div style={{ color: 'var(--ds-text-3)' }}>{title}</div><b style={{ fontSize: 28 }}>{String(data?.[key] ?? '—')}</b></Card>)}
      </div>
    </div>
  );
}

export function CompaniesPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Page<Record<string, unknown>> | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const viewOnly = user?.role === 'ADMIN';
  const finance = user?.role === 'FINANCE';
  const load = () => api<Page<Record<string, unknown>>>(`/companies${qs({ q, page, pageSize: 20 })}`).then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [q, page]);
  useEffect(() => { if (id) api<Record<string, any>>(`/companies/${id}`).then(setDetail).catch((err) => setError(err.message)); }, [id]);
  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'OPS_MANAGER') return;
    api<{ id: string; name: string; role: string }[]>('/admin/assignees').then(setStaff).catch(() => undefined);
  }, [user?.role]);

  return (
    <div>
      <PageHead title="客户与资质" />
      <ErrorNote error={error} />
      <Input.Search allowClear placeholder="企业名或信用代码" style={{ width: 280, marginBottom: 12 }} onSearch={(value) => { setPage(1); setQ(value); }} />
      <Table
        rowKey="id"
        dataSource={(rows?.items || []) as any[]}
        pagination={{ current: page, pageSize: 20, total: rows?.total || 0, onChange: setPage, showSizeChanger: false }}
        onRow={(row) => ({ onClick: () => nav(`/companies/${row.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: '企业', dataIndex: 'name' },
          { title: '认证', dataIndex: 'certStatus', render: (value) => <StatusTag status={value} /> },
          { title: '负责运营', dataIndex: ['owner', 'name'], render: (value) => value || '未分配' },
          { title: '负责商务', dataIndex: ['bd', 'name'], render: (value) => value || '未分配' },
          { title: '剧目', dataIndex: ['_count', 'dramas'] },
        ]}
      />
      {detail ? (
        <Card title={detail.name} style={{ marginTop: 16 }} extra={<StatusTag status={detail.certStatus} />}>
          <p>信用代码 {detail.creditCode || '—'} · 法人 {detail.legalPerson || '—'} · 联系人 {detail.contactName || '—'} {detail.contactPhone || ''}</p>
          {detail.certRejectReason ? <p>驳回原因：{detail.certRejectReason}</p> : null}
          {(finance || viewOnly) && ['PENDING', 'CHANGE_PENDING'].includes(detail.certStatus) ? (
            <Space>
              <Button type="primary" disabled={viewOnly} onClick={async () => { await api(`/companies/${detail.id}/certification/review`, { method: 'POST', json: { pass: true } }); message.success('已通过'); setDetail(await api<Record<string, any>>(`/companies/${detail.id}`)); load(); }}>通过认证</Button>
              <Button danger disabled={viewOnly} onClick={async () => { const reason = window.prompt('驳回原因') || ''; if (!reason) return; await api(`/companies/${detail.id}/certification/review`, { method: 'POST', json: { pass: false, reason } }); load(); setDetail(await api<Record<string, any>>(`/companies/${detail.id}`)); }}>驳回</Button>
            </Space>
          ) : null}
          {user?.role === 'OPS_MANAGER' || viewOnly ? (
            <Space style={{ marginTop: 12 }} wrap>
              <Select
                style={{ width: 220 }}
                placeholder="指定负责运营"
                disabled={viewOnly}
                options={staff.filter((item) => item.role === 'OPS').map((item) => ({ value: item.id, label: item.name }))}
                onChange={async (ownerId) => { await api(`/companies/${detail.id}/owner`, { method: 'PATCH', json: { ownerId } }); message.success('已更新负责运营'); setDetail(await api(`/companies/${detail.id}`)); load(); }}
              />
              <Select
                style={{ width: 220 }}
                placeholder="指定负责商务"
                disabled={viewOnly}
                options={staff.filter((item) => item.role === 'BD').map((item) => ({ value: item.id, label: item.name }))}
                onChange={async (bdId) => { await api(`/companies/${detail.id}/bd`, { method: 'PATCH', json: { bdId } }); message.success('已更新负责商务'); setDetail(await api(`/companies/${detail.id}`)); load(); }}
              />
            </Space>
          ) : null}
          {user && ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'].includes(user.role) ? <PolicyForm companyId={detail.id} /> : null}
        </Card>
      ) : null}
    </div>
  );
}

function PolicyForm({ companyId }: { companyId: string }) {
  const { message } = App.useApp();
  const [versions, setVersions] = useState<{ version: number; cycleType: string; planId?: string | null }[]>([]);
  const load = () => api<{ versions: { version: number; cycleType: string; planId?: string | null }[] }>(`/companies/${companyId}/settlement-policy`).then((res) => setVersions(res.versions || [])).catch(() => undefined);
  useEffect(() => { load(); }, [companyId]);
  const latest = versions[0];
  return (
    <Form layout="inline" style={{ marginTop: 16 }} onFinish={async (values) => {
      try {
        await api(`/companies/${companyId}/settlement-policy`, { method: 'PUT', json: values });
        message.success('结算周期已保存');
        load();
      } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
    }}>
      <Form.Item name="cycleType" initialValue="MONTH" label="结算周期"><Select style={{ width: 140 }} options={[{ value: 'MONTH', label: '自然月' }, { value: 'QUARTER', label: '季度' }, { value: 'CUSTOM_DAYS', label: '自定义天数' }]} /></Form.Item>
      <Form.Item name="customDays"><InputNumber placeholder="天数" min={1} /></Form.Item>
      <Form.Item name="anchorDate" rules={[{ required: true }]}><Input placeholder="锚点 YYYY-MM-DD" /></Form.Item>
      <Form.Item name="effectiveDate"><Input placeholder="生效日，默认今天" /></Form.Item>
      <Form.Item name="note"><Input placeholder="说明" /></Form.Item>
      <Button htmlType="submit">保存周期</Button>
      {latest ? <span style={{ color: 'var(--ds-text-3)', lineHeight: '32px' }}>当前 v{latest.version}{latest.planId ? '（项目）' : ''}，共 {versions.length} 个版本</span> : null}
    </Form>
  );
}

export function ReviewsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const viewOnly = user?.role === 'ADMIN';
  const lead = user?.role === 'OPS_MANAGER';
  const [ops, setOps] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Page<Plan> | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string>();
  const [reason, setReason] = useState('画面或字幕需要修改');
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [batchNote, setBatchNote] = useState('');
  const [reasons, setReasons] = useState<{ code: string; title: string }[]>([]);
  const [reasonCode, setReasonCode] = useState<string>();
  const [rejectNote, setRejectNote] = useState('');
  const [sla, setSla] = useState<{ summary: { total: number; warn80: number; overdue: number; double: number } } | null>(null);
  const load = () => api<Page<Plan>>(`/plans${qs({ page: 1, pageSize: 50, status })}`).then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    if (!user || !['OPS', 'OPS_MANAGER', 'ADMIN'].includes(user.role)) return;
    api<typeof sla>('/reviews/sla-board').then(setSla).catch(() => undefined);
    api<{ code: string; title: string }[]>('/reject-reasons').then(setReasons).catch(() => undefined);
  }, [user, rows]);
  useEffect(() => { if (id) api<Plan>(`/plans/${id}`).then(setPlan).catch((err) => setError(err.message)); }, [id]);
  useEffect(() => {
    if (!lead) return;
    api<{ id: string; name: string; role: string }[]>('/admin/assignees').then((rows) => setOps(rows.filter((item) => item.role === 'OPS'))).catch(() => undefined);
  }, [lead]);

  const refresh = async () => { if (id) setPlan(await api<Plan>(`/plans/${id}`)); load(); };

  return (
    <div>
      <PageHead title="审核队列" hint="新客户前 3 部剧全审。之后默认抽检：8 集及以内全看，更长的剧看开头、结尾和中间样本。批量通过和批量驳回的结果记在任务中心。" />
      <ErrorNote error={error} />
      {picked.length ? <Space wrap style={{ marginBottom: 12 }}>
        <b>已选 {picked.length}</b>
        <Button type="primary" disabled={viewOnly} onClick={async () => {
          try {
            const res = await api<{ passed: { code: string }[]; skipped: { code: string; reason: string }[] }>('/reviews/batch-pass', { method: 'POST', json: { planIds: picked } });
            const note = `通过 ${res.passed.length} 部。${res.skipped.map((item) => `${item.code || '工单'}：${item.reason}`).join('；')} 已记入任务中心。`;
            setBatchNote(note);
            message.success(`已通过 ${res.passed.length} 部${res.skipped.length ? `，跳过 ${res.skipped.length} 部` : ''}`);
            setPicked([]);
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有通过'); }
        }}>批量通过</Button>
        <Select
          style={{ width: 180 }}
          placeholder="驳回原因"
          disabled={viewOnly}
          value={reasonCode}
          options={reasons.map((item) => ({ value: item.code, label: item.title }))}
          onChange={setReasonCode}
        />
        <Input style={{ width: 220 }} placeholder="补充说明（其他时必填）" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} />
        <Button danger disabled={viewOnly || !reasonCode} onClick={async () => {
          try {
            const res = await api<{ rejectedCount: number; skippedCount: number; skipped: { reason: string }[] }>('/reviews/batch-reject', { method: 'POST', json: { items: picked.map((planId) => ({ planId })), reasonCode, note: rejectNote || undefined } });
            setBatchNote(`驳回 ${res.rejectedCount} 部，跳过 ${res.skippedCount} 部。${res.skipped.map((item) => item.reason).join('；')} 已记入任务中心。`);
            message.success(`已驳回 ${res.rejectedCount} 部${res.skippedCount ? `，跳过 ${res.skippedCount} 部` : ''}`);
            setPicked([]);
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有驳回'); }
        }}>批量驳回</Button>
        {batchNote ? <span>{batchNote}</span> : null}
      </Space> : null}
      {lead ? <div style={{ marginBottom: 12 }}><Button disabled={viewOnly} onClick={async () => {
        try {
          const res = await api<{ sampledCount: number; ratio: number }>('/reviews/spot-check', { method: 'POST', json: {} });
          message.success(`已按 ${Math.round(res.ratio * 100)}% 抽出 ${res.sampledCount} 部`);
        } catch (err) { message.error(err instanceof Error ? err.message : '没有抽出'); }
      }}>按全局比例抽检</Button></div> : null}
      {sla ? <Space wrap style={{ marginBottom: 12 }}>
        <Tag>在审 {sla.summary.total}</Tag>
        <Tag color="gold">80%预警 {sla.summary.warn80}</Tag>
        <Tag color="orange">已超时 {sla.summary.overdue}</Tag>
        <Tag color="red">2倍超时 {sla.summary.double}</Tag>
      </Space> : null}
      <Tabs
        activeKey={status || 'ALL'}
        onChange={(value) => setStatus(value === 'ALL' ? undefined : value)}
        items={[
          { key: 'ALL', label: '全部' },
          { key: 'PENDING_REVIEW', label: '待处理' },
          { key: 'IN_REVIEW', label: '审核中' },
          { key: 'NEEDS_REVISION', label: '需修改' },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={status || 'ALL'} {...motionTokens.presets.page}>
      <Table rowKey="id" dataSource={rows?.items || []} pagination={false} rowSelection={{ selectedRowKeys: picked, onChange: (keys) => setPicked(keys.map(String)) }} onRow={(row) => ({ onClick: () => nav(`/reviews/${row.id}`), style: { cursor: 'pointer' } })} columns={[
        { title: '单号', dataIndex: 'code', className: 'ds-num' },
        {
          title: '剧',
          render: (_: unknown, row: Plan) => (
            <span className="ds-cover">
              <span className="ds-poster"><span className="ds-poster__art"><span className="ds-poster__title">{row.drama.title.slice(0, 1)}</span></span></span>
              <span><b>{row.drama.title}</b><small>{row.drama.code}</small></span>
            </span>
          ),
        },
        { title: '客户', dataIndex: ['company', 'name'] },
        { title: '轮次', dataIndex: 'round', render: labelOf },
        { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} /> },
      ]} />
        </motion.div>
      </AnimatePresence>
      <Drawer title={plan ? `${plan.drama.title} · ${plan.code}` : '审核'} open={Boolean(plan)} width={720} onClose={() => nav('/reviews')} extra={plan ? <StatusTag status={plan.status} /> : null}>
        {plan ? (
          <>
          <Space wrap>
            {['PENDING_ASSIGN', 'PENDING_REVIEW'].includes(plan.status) ? <Button type="primary" disabled={viewOnly} onClick={async () => { await api(`/reviews/${plan.id}/open`, { method: 'POST' }); refresh(); }}>开始审核</Button> : null}
            {(lead || viewOnly) && ['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_REVISION'].includes(plan.status) ? (
              <Select
                style={{ width: 180 }}
                placeholder="分派给运营"
                disabled={viewOnly}
                options={ops.map((item) => ({ value: item.id, label: item.name }))}
                onChange={async (assigneeId) => { try { await api(`/reviews/${plan.id}/assign`, { method: 'POST', json: { assigneeId } }); message.success('已分派'); refresh(); } catch (err) { message.error(err instanceof Error ? err.message : '没有分派'); } }}
              />
            ) : null}
            {(lead || viewOnly) && plan.status === 'IN_REVIEW' ? <Button disabled={viewOnly} onClick={async () => { await api(`/reviews/${plan.id}/expand`, { method: 'POST' }); message.success('已扩大抽检'); refresh(); }}>扩大抽检</Button> : null}
            {plan.status === 'IN_REVIEW' ? <Button type="primary" disabled={viewOnly} onClick={async () => { try { await api(`/reviews/${plan.id}/finish`, { method: 'POST' }); refresh(); } catch (err) { message.error(err instanceof Error ? err.message : '还不能结束'); } }}>提交审核结果</Button> : null}
          </Space>
          {plan.rejectSummary ? <pre>{plan.rejectSummary}</pre> : null}
          <Table style={{ marginTop: 12 }} rowKey="id" pagination={false} dataSource={plan.episodes || []} columns={[
            { title: '集', dataIndex: 'no', width: 70, className: 'ds-num', align: 'right' as const },
            { title: '文件', dataIndex: 'fileName' },
            { title: '状态', dataIndex: 'reviewStatus', render: (value) => <StatusTag status={value} /> },
            { title: '原因', dataIndex: 'rejectReason' },
            {
              title: '',
              render: (_, row) => ['PENDING', 'REPLACED'].includes(row.reviewStatus) && plan.status === 'IN_REVIEW' ? (
                <Space>
                  <Button size="small" type="primary" disabled={viewOnly} onClick={async () => { await api(`/reviews/${plan.id}/episodes/${row.id}`, { method: 'POST', json: { decision: 'APPROVED' } }); refresh(); }}>通过</Button>
                  <Button size="small" danger disabled={viewOnly} onClick={async () => { await api(`/reviews/${plan.id}/episodes/${row.id}`, { method: 'POST', json: { decision: 'REJECTED', reason } }); refresh(); }}>驳回</Button>
                </Space>
              ) : null,
            },
          ]} />
          <Input style={{ marginTop: 8, maxWidth: 420 }} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="驳回原因" />
          </>
        ) : null}
      </Drawer>
    </div>
  );
}

export function SharesPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const viewOnly = user?.role === 'ADMIN';
  const canReviewShares = user?.role === 'OPS_MANAGER' || viewOnly;
  const [rows, setRows] = useState<Page<Plan> | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; version: number }[]>([]);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<string>();
  const [preview, setPreview] = useState<{ templateId: string; items: { planId: string; title: string; kind: string; reason: string }[] } | null>(null);
  useEffect(() => { api<{ id: string; name: string; version: number }[]>('/share-templates').then(setTemplates).catch(() => undefined); }, []);
  useEffect(() => { api<{ id: string; name: string }[]>('/platforms').then(setPlatforms).catch(() => undefined); }, []);
  const load = () => api<Page<Plan>>(`/plans${qs({ page: 1, pageSize: 50 })}`).then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!id) return;
    api<Plan>(`/plans/${id}`).then((row) => {
      setPlan(row);
      const next: Record<string, any> = {};
      row.platforms.forEach((item) => {
        const share = row.shares.find((entry) => entry.platformId === item.platformId);
        next[item.platformId] = { mode: share?.mode || 'NO_MG', clientRate: share ? String(share.clientRate) : '50', overRate: share?.overRate ? String(share.overRate) : '', guaranteeAmount: share?.guaranteeAmount ? String(share.guaranteeAmount) : '', guaranteeCurrency: share?.guaranteeCurrency || 'USD', guaranteePeriodDays: share?.guaranteePeriodDays || undefined };
      });
      setDraft(next);
    }).catch((err) => setError(err.message));
  }, [id]);

  return (
    <div>
      <PageHead title="分成与上架" hint="保底金额只在内部填写，客户看到的是分成比例。结转按项目记一句话，不参与金额计算。" />
      <ErrorNote error={error} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Upload showUploadList={false} accept=".xlsx" beforeUpload={async (file) => {
          try {
            const body = new FormData();
            body.append('file', file);
            const res = await api<{ applied: number; failed: number; rows: { rowNo: number; error: string }[] }>('/listings/import', { method: 'POST', body });
            message.success(`已录入 ${res.applied} 行${res.failed ? `，${res.failed} 行有误` : ''}，已记入任务中心`);
            if (res.failed) setError(res.rows.filter((row) => row.error).map((row) => `第 ${row.rowNo} 行 ${row.error}`).join('；'));
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有导入'); }
          return false;
        }}><Button disabled={viewOnly}>导入上架结果</Button></Upload>
        <Button onClick={() => download('/listings/template', 'listing-template.xlsx')}>下载上架模板</Button>
        {picked.length ? (
          <>
            <Select mode="multiple" style={{ minWidth: 220 }} placeholder="选择平台" value={batchPlatforms} options={platforms.map((item) => ({ value: item.id, label: item.name }))} onChange={setBatchPlatforms} />
            <Select style={{ width: 140 }} placeholder="上架状态" value={batchStatus} options={Object.keys(LISTING_LABEL).map((value) => ({ value, label: labelOf(value) }))} onChange={setBatchStatus} />
            <Button disabled={viewOnly || !batchPlatforms.length || !batchStatus} onClick={async () => {
              try {
                const res = await api<{ updated: number; skipped: number; reasons: { reason: string }[] }>('/listings/batch', { method: 'POST', json: { planIds: picked, platformIds: batchPlatforms, status: batchStatus } });
                message.success(`已更新 ${res.updated} 条${res.skipped ? `，跳过 ${res.skipped} 条` : ''}`);
                if (res.skipped) setError(res.reasons.map((item) => item.reason).filter((reason, index, list) => list.indexOf(reason) === index).join('；'));
                setPicked([]);
                load();
              } catch (err) { message.error(err instanceof Error ? err.message : '没有改成'); }
            }}>批量改状态</Button>
          </>
        ) : null}
        <Select style={{ width: 220 }} placeholder="分成模板" options={templates.map((item) => ({ value: item.id, label: `${item.name} v${item.version}` }))} onChange={async (templateId) => {
          if (!picked.length) { message.error('请先勾选剧'); return; }
          const res = await api<{ items: { planId: string; title: string; kind: string; reason: string }[] }>(`/share-templates/${templateId}/preview`, { method: 'POST', json: { planIds: picked } });
          setPreview({ templateId, items: res.items });
        }} />
        <Form layout="inline" onFinish={async (values) => {
          try { await api('/share-templates', { method: 'POST', json: values }); message.success('模板已保存'); setTemplates(await api('/share-templates')); }
          catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
        }}>
          <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="模板名" /></Form.Item>
          <Form.Item name="mode" initialValue="NO_MG"><Select style={{ width: 120 }} options={[{ value: 'NO_MG', label: '无保底' }, { value: 'MG', label: '保底' }, { value: 'MG_OVER', label: '超保底' }]} /></Form.Item>
          <Form.Item name="clientRate" initialValue="50"><Input placeholder="比例" style={{ width: 80 }} /></Form.Item>
          <Button htmlType="submit" disabled={viewOnly}>存为模板</Button>
        </Form>
      </Space>
      <Table rowKey="id" dataSource={rows?.items || []} pagination={false} rowSelection={{ selectedRowKeys: picked, onChange: (keys) => setPicked(keys.map(String)) }} onRow={(row) => ({ onClick: () => nav(`/shares/${row.id}`), style: { cursor: 'pointer' } })} columns={[
        { title: '单号', dataIndex: 'code' },
        { title: '剧', dataIndex: ['drama', 'title'] },
        { title: '客户', dataIndex: ['company', 'name'] },
        { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} /> },
      ]} />
      <Modal title="分成差异" open={Boolean(preview)} onCancel={() => setPreview(null)} okText="提交套用" onOk={async () => {
        if (!preview) return;
        const res = await api<{ appliedCount: number; summary: { skip: number } }>(`/share-templates/${preview.templateId}/apply`, { method: 'POST', json: { planIds: picked } });
        message.success(`已套用 ${res.appliedCount} 部，跳过 ${res.summary.skip} 部，进入分成待复核。已记入任务中心`);
        setPreview(null);
        setPicked([]);
        load();
      }}>
        <Table size="small" rowKey="planId" pagination={false} dataSource={preview?.items || []} columns={[
          { title: '剧', dataIndex: 'title' },
          { title: '差异', dataIndex: 'kind', render: (value: string) => ({ NEW: '新配置', OVERWRITE: '覆盖已有', SKIP: '跳过' }[value] || value) },
          { title: '说明', dataIndex: 'reason' },
        ]} />
      </Modal>
      {plan ? (
        <Card title={plan.drama.title} style={{ marginTop: 16 }}>
          {plan.platforms.map((item) => {
            const row = draft[item.platformId] || { mode: 'NO_MG', clientRate: '50' };
            const set = (key: string, value: unknown) => setDraft({ ...draft, [item.platformId]: { ...row, [key]: value } });
            return (
              <Space key={item.platformId} wrap style={{ display: 'flex', marginBottom: 8 }}>
                <span style={{ width: 140 }}><PlatformChip name={item.platformName} /></span>
                <Select disabled={viewOnly} style={{ width: 120 }} value={row.mode} onChange={(value) => set('mode', value)} options={Object.entries(SHARE_MODE_LABEL).map(([value, label]) => ({ value, label }))} />
                <Input style={{ width: 100 }} value={row.clientRate} onChange={(event) => set('clientRate', event.target.value)} addonAfter="%" />
                {row.mode === 'MG_OVER' ? <Input style={{ width: 120 }} placeholder="超出比例" value={row.overRate} onChange={(event) => set('overRate', event.target.value)} /> : null}
                {row.mode !== 'NO_MG' ? <Input style={{ width: 140 }} placeholder="保底金额" value={row.guaranteeAmount} onChange={(event) => set('guaranteeAmount', event.target.value)} /> : null}
                {row.mode !== 'NO_MG' ? <Input style={{ width: 80 }} value={row.guaranteeCurrency} onChange={(event) => set('guaranteeCurrency', event.target.value)} /> : null}
                <Tag>{labelOf(item.listingStatus)}</Tag>
                {['APPROVED', 'DISTRIBUTING', 'LIVE', 'OFFLINE'].includes(plan.status) && (LISTING_NEXT[item.listingStatus] || []).length ? (
                  <Select disabled={viewOnly} style={{ width: 140 }} placeholder="下一步" options={(LISTING_NEXT[item.listingStatus] || []).map((value) => ({ value, label: labelOf(value) }))} onChange={async (status) => { try { await api(`/listings/${item.id}`, { method: 'PATCH', json: { status } }); message.success('上架结果已更新'); const next = await api<Plan>(`/plans/${plan.id}`); setPlan(next); load(); } catch (err) { message.error(err instanceof Error ? err.message : '不能这样改'); } }} />
                ) : null}
              </Space>
            );
          })}
          {['SHARE_CONFIG', 'SHARE_REVIEW'].includes(plan.status) && user?.role !== 'FINANCE' ? (
            <Button type="primary" disabled={viewOnly} onClick={async () => {
              try {
                const items = plan.platforms.map((item) => {
                  const row = draft[item.platformId];
                  return { platformId: item.platformId, mode: row.mode, clientRate: String(row.clientRate), overRate: row.overRate || undefined, guaranteeAmount: row.guaranteeAmount || undefined, guaranteeCurrency: row.guaranteeCurrency, guaranteePeriodDays: row.guaranteePeriodDays };
                });
                setPlan(await api(`/plans/${plan.id}/shares`, { method: 'PUT', json: { items } }));
                message.success('已提交分成复核');
                load();
              } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
            }}>提交分成</Button>
          ) : null}
          {plan.status === 'SHARE_REVIEW' && canReviewShares ? (
            <Space>
              <Button type="primary" disabled={viewOnly} onClick={async () => { try { setPlan(await api(`/plans/${plan.id}/shares/review`, { method: 'POST', json: { pass: true } })); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有通过'); } }}>复核通过</Button>
              <Button danger disabled={viewOnly} onClick={async () => { const reason = window.prompt('退回原因') || ''; if (!reason) return; setPlan(await api(`/plans/${plan.id}/shares/review`, { method: 'POST', json: { pass: false, reason } })); load(); }}>退回</Button>
            </Space>
          ) : null}
          <Form layout="inline" style={{ marginTop: 16 }} onFinish={async (values) => {
            try { await api(`/plans/${plan.id}/settlement-policy`, { method: 'PUT', json: values }); message.success('项目结算说明已保存'); }
            catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
          }}>
            <Form.Item name="cycleType" initialValue="MONTH"><Select style={{ width: 120 }} options={[{ value: 'MONTH', label: '自然月' }, { value: 'QUARTER', label: '季度' }, { value: 'CUSTOM_DAYS', label: '自定义' }]} /></Form.Item>
            <Form.Item name="anchorDate" rules={[{ required: true }]}><Input placeholder="锚点日期" /></Form.Item>
            <Form.Item name="carryoverNote"><Input placeholder="结转说明（仅内部）" style={{ width: 240 }} /></Form.Item>
            <Button htmlType="submit">保存项目策略</Button>
          </Form>
        </Card>
      ) : null}
    </div>
  );
}

export function DailyPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const viewOnly = user?.role === 'ADMIN';
  const lead = user?.role === 'OPS_MANAGER';
  const [rows, setRows] = useState<Page<any> | null>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [dramas, setDramas] = useState<any[]>([]);
  const [expect, setExpect] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [batch, setBatch] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const load = () => api<Page<any>>(`/daily-stats${qs({ page, pageSize: 20 })}`).then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    api<any[]>('/platforms').then(setPlatforms).catch(() => undefined);
    api<Page<any>>('/dramas?page=1&pageSize=100').then((res) => setDramas(res.items)).catch(() => undefined);
    api<any[]>('/sync-expectations').then(setExpect).catch(() => undefined);
    api<any[]>('/daily-sync').then(setTasks).catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHead title="数据同步" hint="可以手工录入，也可以上传 Excel。校验后问题行会标出来。有问题行时专员提交主管，主管填写理由后强制发布，问题行不写入日报。" />
      <ErrorNote error={error} />
      <Card size="small" title="报表导入" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Upload accept=".xlsx" maxCount={1} showUploadList={false} disabled={viewOnly} beforeUpload={async (file) => {
            try {
              const body = new FormData();
              body.append('file', file);
              const headers = new Headers();
              const token = getToken();
              if (token) headers.set('Authorization', `Bearer ${token}`);
              const res = await fetch('/api/daily-stats/import', { method: 'POST', headers, body });
              const data = await res.json();
              if (!res.ok) throw new Error(typeof data?.message === 'string' ? data.message : '没有导入');
              const checked = await api<any>(`/daily-stats/import/${data.id}/validate`, { method: 'POST' });
              setBatch(checked);
              message.success(`已导入 ${checked.summary.total} 行，问题行 ${checked.summary.error}`);
            } catch (err) { message.error(err instanceof Error ? err.message : '没有导入'); }
            return false;
          }}><Button disabled={viewOnly}>上传 Excel</Button></Upload>
          {batch && batch.summary?.error ? <Button disabled={viewOnly} onClick={async () => {
            const note = window.prompt('提交主管的说明') || '';
            try { setBatch(await api(`/daily-stats/import/${batch.id}/submit-manager`, { method: 'POST', json: { note } })); message.success('已提交主管'); }
            catch (err) { message.error(err instanceof Error ? err.message : '没有提交'); }
          }}>提交主管</Button> : null}
          {batch && lead ? <Button disabled={viewOnly} onClick={async () => {
            const reason = window.prompt('强制发布原因') || '';
            if (!reason.trim()) return;
            try { setBatch(await api(`/daily-stats/import/${batch.id}/force-publish`, { method: 'POST', json: { reason } })); message.success('已强制发布'); load(); }
            catch (err) { message.error(err instanceof Error ? err.message : '没有发布'); }
          }}>强制发布</Button> : null}
          {batch && !batch.summary?.error && batch.status !== 'PUBLISHED' && batch.status !== 'FORCE_PUBLISHED' ? <Button type="primary" disabled={viewOnly} onClick={async () => {
            try { setBatch(await api(`/daily-stats/import/${batch.id}/publish`, { method: 'POST' })); message.success('已发布'); load(); }
            catch (err) { message.error(err instanceof Error ? err.message : '没有发布'); }
          }}>发布</Button> : null}
        </Space>
        {batch ? <Table style={{ marginTop: 12 }} size="small" rowKey="id" pagination={false} dataSource={batch.rows || []} columns={[
          { title: '行', dataIndex: 'rowNo' },
          { title: '状态', dataIndex: 'status' },
          { title: '问题', dataIndex: 'errorReason', render: (value: string) => value || '—' },
          { title: '', render: (_: unknown, row: { rowNo: number; status: string }) => row.status === 'PUBLISHED' || viewOnly ? null : <Button size="small" onClick={async () => {
            const reason = window.prompt('问题说明') || '';
            if (!reason.trim()) return;
            try { setBatch(await api(`/daily-stats/import/${batch.id}/rows/${row.rowNo}/mark`, { method: 'POST', json: { reason } })); }
            catch (err) { message.error(err instanceof Error ? err.message : '没有标记'); }
          }}>标为问题行</Button> },
        ]} /> : null}
      </Card>
      <Space wrap style={{ marginBottom: 12 }}>{expect.map((item) => <Tag key={item.id}>{item.name} · {item.asOfLabel}</Tag>)}</Space>
      {tasks.length ? <Table size="small" style={{ marginBottom: 12 }} rowKey="id" pagination={false} dataSource={tasks.slice(0, 12)} columns={[
        { title: '平台', dataIndex: ['platform', 'name'] },
        { title: '数据日期', dataIndex: 'statDate' },
        { title: '口径', dataIndex: 'asOfLabel' },
        { title: '任务', dataIndex: 'status' },
      ]} /> : null}
      <Form layout="vertical" style={{ maxWidth: 880 }} onFinish={async (values) => {
        try {
          const saved = await api<any>('/daily-stats', { method: 'POST', json: { ...values, uniqueViewers: values.uniqueViewers ?? undefined, paidUnlocks: values.paidUnlocks ?? undefined } });
          message.success(saved.lagWarning || '已保存为草稿');
          load();
        } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
      }}>
        <Space wrap align="start">
          <Form.Item name="platformId" label="平台" rules={[{ required: true }]}><Select style={{ width: 180 }} options={platforms.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="dramaId" label="剧目" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" style={{ width: 220 }} options={dramas.map((item) => ({ value: item.id, label: `${item.code} ${item.title}` }))} /></Form.Item>
          <Form.Item name="statDate" label="数据日期" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="statTimezone" label="统计时区" initialValue="America/Los_Angeles" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="titleLocal" label="平台标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="language" label="语种" initialValue="英语" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="territory" label="地区"><Input /></Form.Item>
          <Form.Item name="contractCode" label="合同编号"><Input /></Form.Item>
          <Form.Item name="platformDramaId" label="平台剧目 ID"><Input /></Form.Item>
          <Form.Item name="episodesOnline" label="已上线集数" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="views" label="播放量" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="viewMetricDef" label="播放口径" initialValue="平台后台播放次数" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="uniqueViewers" label="去重人数"><InputNumber min={0} /></Form.Item>
          <Form.Item name="paidUnlocks" label="付费解锁"><InputNumber min={0} /></Form.Item>
          <Form.Item name="grossRevenue" label="毛收入"><Input /></Form.Item>
          <Form.Item name="netRevenue" label="净收入"><Input /></Form.Item>
          <Form.Item name="currency" label="币种" initialValue="USD" rules={[{ required: true }]}><Input style={{ width: 80 }} /></Form.Item>
          <Form.Item name="shareRate" label="分成比例"><Input /></Form.Item>
          <Form.Item name="mgAmount" label="保底（内部）"><Input /></Form.Item>
          <Form.Item name="mgRecouped" label="已抵扣保底（内部）"><Input /></Form.Item>
          <Form.Item name="revenueShareDue" label="公式应分（内部）"><Input /></Form.Item>
          <Form.Item name="dealType" label="合作类型" initialValue="MG_SHARE" rules={[{ required: true }]}><Select style={{ width: 140 }} options={Object.entries(DEAL_TYPE_LABEL).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="dataSource" label="来源" initialValue="SCREENSHOT" rules={[{ required: true }]}><Select style={{ width: 140 }} options={Object.entries(DATA_SOURCE_LABEL).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="watermarkId" label="截图编号"><Input placeholder="关联后才能复核" /></Form.Item>
          <Form.Item name="anomalyNote" label="异常说明"><Input /></Form.Item>
        </Space>
        <Button type="primary" htmlType="submit" disabled={viewOnly}>保存草稿</Button>
      </Form>
      <Table style={{ marginTop: 16 }} rowKey="id" dataSource={rows?.items || []} pagination={{ current: page, pageSize: 20, total: rows?.total || 0, onChange: setPage, showSizeChanger: false }} columns={[
        { title: '日期', dataIndex: 'statDate', render: dayText },
        { title: '平台', dataIndex: ['platform', 'name'] },
        { title: '剧', dataIndex: ['drama', 'title'] },
        { title: '播放', dataIndex: 'views' },
        { title: '净收入', dataIndex: 'netRevenue', render: (value, row) => value ? `${value} ${row.currency}` : '—' },
        { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} /> },
        { title: '提示', dataIndex: 'lagWarning' },
        { title: '', render: (_, row) => <Space>
          <Button size="small" disabled={viewOnly} onClick={async () => { try { await api(`/daily-stats/${row.id}/review`, { method: 'POST' }); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有复核'); } }}>复核</Button>
          <Button size="small" disabled={viewOnly} onClick={async () => { try { await api(`/daily-stats/${row.id}/lock`, { method: 'POST' }); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有锁定'); } }}>锁定</Button>
          {(lead || viewOnly) && row.status !== 'LOCKED' ? <Button size="small" disabled={viewOnly} onClick={async () => { const note = window.prompt('问题说明') || ''; if (!note.trim()) return; try { await api(`/daily-stats/${row.id}/report`, { method: 'POST', json: { note } }); message.success('已上报问题行'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有上报'); } }}>上报问题行</Button> : null}
          {(lead || viewOnly) && row.status !== 'LOCKED' ? <Button size="small" disabled={viewOnly} onClick={async () => { const reason = window.prompt('强制发布原因') || ''; if (!reason.trim()) return; try { await api(`/daily-stats/${row.id}/force-publish`, { method: 'POST', json: { reason } }); message.success('已强制发布'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有发布'); } }}>强制发布</Button> : null}
        </Space> },
      ]} />
    </div>
  );
}

export function WatermarksPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [dramas, setDramas] = useState<any[]>([]);
  const [form, setForm] = useState({ dramaId: '', platformId: '', shotDate: '', kind: 'DATA', filename: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [zipResult, setZipResult] = useState<{ succeeded: number; archived: number; failed: number; items: { filename: string; ok: boolean; status?: string; ticketCode?: string; error?: string }[] } | null>(null);
  const load = () => api<any[]>('/watermarks').then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); api<any[]>('/platforms').then(setPlatforms); api<Page<any>>('/dramas?page=1&pageSize=100').then((res) => setDramas(res.items)); }, []);

  return (
    <div>
      <PageHead title="防伪截图" hint="上传后会铺上暗纹，并在底栏写上平台、剧名、操作人、上海时间和工单号。成功匹配的截图并进当天的工单。可以上传 zip 批量归档，也可以勾选后打包下载。" extra={<Space>
        <Upload accept=".zip,application/zip" showUploadList={false} beforeUpload={async (file) => {
          try {
            const body = new FormData();
            body.append('file', file);
            const result = await api<{ succeeded: number; archived: number; failed: number; items: { filename: string; ok: boolean; status?: string; ticketCode?: string; error?: string }[] }>('/evidence/upload-zip', { method: 'POST', body });
            setZipResult(result);
            message.success(`成功 ${result.succeeded} 张，已归档 ${result.archived} 张，失败 ${result.failed} 张`);
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有归档'); }
          return false;
        }}><Button disabled={user?.role === 'ADMIN'}>上传 zip 批量归档</Button></Upload>
        <Button disabled={!picked.length || user?.role === 'ADMIN'} onClick={async () => { try { await downloadPost('/evidence/archive-zip', { fileKeys: picked }, 'evidence.zip'); } catch (err) { message.error(err instanceof Error ? err.message : '没有下载'); } }}>批量下载</Button>
      </Space>} />
      <ErrorNote error={error} />
      {zipResult ? <div style={{ marginBottom: 12 }}>
        <div>成功 {zipResult.succeeded} 张，已归档 {zipResult.archived} 张，失败 {zipResult.failed} 张</div>
        {zipResult.items.map((item, index) => <div key={`${item.filename}-${index}`} style={{ color: 'var(--ds-text-3)' }}>{item.filename}：{item.ok ? (item.status === 'ARCHIVED' ? `已归档 ${item.ticketCode || ''}` : '待归档') : item.error}</div>)}
      </div> : null}
      <Space wrap style={{ marginBottom: 12 }}>
        <Select style={{ width: 220 }} placeholder="剧" value={form.dramaId || undefined} onChange={(dramaId) => setForm({ ...form, dramaId })} options={dramas.map((item) => ({ value: item.id, label: item.title }))} />
        <Select style={{ width: 160 }} placeholder="平台" value={form.platformId || undefined} onChange={(platformId) => setForm({ ...form, platformId })} options={platforms.map((item) => ({ value: item.id, label: item.name }))} />
        <Input style={{ width: 140 }} placeholder="日期" value={form.shotDate} onChange={(event) => setForm({ ...form, shotDate: event.target.value })} />
        <Select style={{ width: 120 }} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={[{ value: 'DATA', label: '数据' }, { value: 'LISTING', label: '上架' }, { value: 'DELIST', label: '下架' }]} />
        <Input style={{ width: 220 }} placeholder="原文件名，用于自动匹配" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} />
        <Upload showUploadList={false} beforeUpload={async (file) => {
          try {
            const drama = dramas.find((item) => item.id === form.dramaId);
            const uploaded = await uploadFile(file, 'WATERMARK_SOURCE', { dramaId: form.dramaId || undefined, companyId: drama?.company?.id });
            await api('/watermarks', { method: 'POST', json: { fileKey: uploaded.key, dramaId: form.dramaId || undefined, platformId: form.platformId || undefined, shotDate: form.shotDate || undefined, kind: form.kind, filename: form.filename || file.name } });
            message.success('水印已生成');
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有生成'); }
          return false;
        }}><Button type="primary" disabled={user?.role === 'ADMIN'}>上传并生成水印</Button></Upload>
      </Space>
      <div className="poster-grid">
        {rows.map((shot) => (
          <Card key={shot.id} cover={shot.url ? <img src={shot.url} alt="" style={{ height: 160, objectFit: 'cover' }} /> : null} size="small">
            <Space>
              {shot.watermarkedKey ? <Checkbox checked={picked.includes(shot.watermarkedKey)} onChange={(event) => setPicked((cur) => event.target.checked ? [...new Set([...cur, shot.watermarkedKey])] : cur.filter((key) => key !== shot.watermarkedKey))} /> : null}
              <StatusTag status={shot.status === 'ARCHIVED' ? 'APPROVED' : 'PENDING'} text={shot.status === 'ARCHIVED' ? '已归档' : '待归档'} />
            </Space>
            <div>{shot.drama?.title || '未匹配剧目'} · {shot.platform?.name || '未匹配平台'}</div>
            <div>工单号 {shot.ticketCode || '—'}</div>
            <div style={{ color: 'var(--ds-text-3)' }}>{shot.shortHash} {shot.failReason || ''}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function rosterHint(row: { rosterRequests?: { firstBatch?: boolean | null; enabled?: boolean | null }[] }) {
  const req = row.rosterRequests?.[0];
  if (!req) return '';
  const bits = [];
  if (req.firstBatch != null) bits.push(req.firstBatch ? '加入首发' : '移出首发');
  if (req.enabled != null) bits.push(req.enabled ? '启用' : '停用');
  return bits.join('、');
}

export function PlatformsPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState<any[]>([]);
  const viewOnly = user?.role === 'ADMIN';
  const canConfirmFirst = user?.role === 'OPS_MANAGER';
  const canRequestRoster = user?.role === 'OPS' || canConfirmFirst;
  const canEditLag = viewOnly || user?.role === 'OPS' || canConfirmFirst;
  const load = () => api<any[]>('/platforms').then(setRows);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHead title="平台名单" hint="初始首批是 ReelShort、DramaBox、ShortMax、FlexTV、GoodShort。增删首批要主管确认。数据日调整从次日起生效。" />
      <Table rowKey="id" dataSource={rows} pagination={false} columns={[
        { title: '标志', dataIndex: 'logoUrl', width: 148, render: (url: string | null, row) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-text-3)', flex: 'none' }}>
            {url ? <img src={url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} /> : '无'}
          </span>
          <Upload showUploadList={false} accept="image/png,image/jpeg,image/webp" beforeUpload={async (file) => {
            try {
              const body = new FormData();
              body.append('file', file);
              await api(`/platforms/${row.id}/logo`, { method: 'POST', body });
              message.success('标志已上传');
              load();
            } catch (err) { message.error(err instanceof Error ? err.message : '没有上传'); }
            return false;
          }}><Button size="small" autoInsertSpace={false} style={{ letterSpacing: 0, paddingInline: 8 }}><span style={{ letterSpacing: 0 }}>上传</span></Button></Upload>
        </span> },
        { title: '平台', dataIndex: 'name' },
        { title: '地区', dataIndex: 'region' },
        { title: '数据日', dataIndex: 'syncLag', render: (value, row) => <Space>{canEditLag ? <Select size="small" value={value} options={[{ value: 'T1', label: '昨天' }, { value: 'T2', label: '前天' }]} onChange={async (syncLag) => { await api(`/platforms/${row.id}`, { method: 'PATCH', json: { syncLag } }); message.success('数据日次日生效'); load(); }} /> : labelOf(value)}{row.syncLagPending ? <Tag>{labelOf(row.syncLagPending)} 次日生效</Tag> : null}</Space> },
        { title: '启用', dataIndex: 'enabled', render: (value, row) => <Switch checked={value} disabled={viewOnly || (Boolean(row.firstBatch) && !canRequestRoster)} onChange={async (enabled) => { try { const res = await api<any>(`/platforms/${row.id}`, { method: 'PATCH', json: { enabled } }); if (res.pendingConfirmation) message.success('已提交主管确认'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有改成'); } }} /> },
        { title: '首发', dataIndex: 'firstBatch', render: (value, row) => <Space><Switch checked={value} disabled={!canRequestRoster} onChange={async (firstBatch) => { try { const res = await api<any>(`/platforms/${row.id}`, { method: 'PATCH', json: { firstBatch } }); if (res.pendingConfirmation) message.success('已提交主管确认，名单尚未变更'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有改成'); } }} />{rosterHint(row) ? <Tag color="gold">待确认：{rosterHint(row)}</Tag> : null}{canConfirmFirst && row.rosterRequests?.[0] ? <><Button size="small" onClick={async () => { await api(`/platforms/roster-requests/${row.rosterRequests[0].id}/confirm`, { method: 'POST' }); message.success('已确认'); load(); }}>确认</Button><Button size="small" onClick={async () => { await api(`/platforms/roster-requests/${row.rosterRequests[0].id}/reject`, { method: 'POST', json: { note: '名单保持不变' } }); message.success('已驳回'); load(); }}>驳回</Button></> : null}</Space> },
      ]} />
      <Form layout="inline" style={{ marginTop: 16 }} onFinish={async (values) => { await api('/platforms', { method: 'POST', json: values }); message.success('已添加'); load(); }}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="新平台名称" /></Form.Item>
        <Form.Item name="region"><Input placeholder="地区" /></Form.Item>
        <Form.Item name="syncLag" initialValue="T1"><Select options={[{ value: 'T1', label: '昨天' }, { value: 'T2', label: '前天' }]} /></Form.Item>
        <Button htmlType="submit">添加平台</Button>
      </Form>
    </div>
  );
}

export function UsersPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Page<any> | null>(null);
  const load = () => api<Page<any>>('/admin/users?page=1&pageSize=50').then(setRows);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHead title="员工账号" hint="客户从注册进入，这里只建运营、主管、商务、财务和管理员。" />
      <Table rowKey="id" dataSource={rows?.items || []} pagination={false} columns={[
        { title: '姓名', dataIndex: 'name' },
        { title: '邮箱', dataIndex: 'email' },
        { title: '角色', dataIndex: 'role', render: labelOf },
        { title: '停用', dataIndex: 'disabled', render: (value, row) => <Switch checked={value} onChange={async (disabled) => { await api(`/admin/users/${row.id}`, { method: 'PATCH', json: { disabled } }); load(); }} /> },
      ]} />
      <Form layout="inline" style={{ marginTop: 16 }} onFinish={async (values) => { try { await api('/admin/users', { method: 'POST', json: values }); message.success('已创建'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有创建'); } }}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="姓名" /></Form.Item>
        <Form.Item name="email" rules={[{ required: true }]}><Input placeholder="邮箱" /></Form.Item>
        <Form.Item name="password" rules={[{ required: true, min: 8 }]}><Input.Password placeholder="密码" /></Form.Item>
        <Form.Item name="role" initialValue="OPS"><Select options={['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'].map((value) => ({ value, label: labelOf(value) }))} /></Form.Item>
        <Button htmlType="submit" type="primary">创建</Button>
      </Form>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [values, setValues] = useState<any>(null);
  useEffect(() => { api('/admin/settings').then(setValues); }, []);
  const admin = user?.role === 'ADMIN';
  return (
    <div>
      <PageHead title="全局参数" hint="最低提款额、偏差提示、数据截止，以及抽检比例和审核时限。只有管理员能改，财务看不到这一页。" />
      {values ? (
        <Form layout="vertical" style={{ maxWidth: 420 }} initialValues={values} onFinish={async (next) => { try { setValues(await api('/admin/settings', { method: 'PUT', json: next })); message.success('已保存'); } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); } }}>
          <Form.Item name="minWithdrawAmount" label="最低提款额（人民币）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="deviationPct" label="偏差提示阈值（%）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="syncDeadline" label="数据截止（上海时间）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="spotCheckRatio" label="抽检比例（0 到 1，如 0.1）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="reviewSlaDays" label="审核 SLA（工作日）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="shareSlaDays" label="分成配置时限（工作日）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="slaWarnRatio" label="审核预警比例（如 0.8）"><Input disabled={!admin} /></Form.Item>
          <Form.Item name="slaDoubleRatio" label="严重超时倍数（如 2）"><Input disabled={!admin} /></Form.Item>
          {admin ? <Button type="primary" htmlType="submit">保存</Button> : null}
        </Form>
      ) : null}
    </div>
  );
}

export function AuditPage() {
  const [rows, setRows] = useState<Page<any> | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api<Page<any>>(`/audit-logs${qs({ page, pageSize: 30 })}`).then(setRows); }, [page]);
  return (
    <div>
      <PageHead title="操作日志" />
      <Table rowKey="id" dataSource={rows?.items || []} pagination={{ current: page, pageSize: 30, total: rows?.total || 0, onChange: setPage, showSizeChanger: false }} columns={[
        { title: '时间', dataIndex: 'createdAt' },
        { title: '动作', dataIndex: 'action' },
        { title: '对象', dataIndex: 'entityType' },
      ]} />
    </div>
  );
}

export function TasksPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Page<any> | null>(null);
  const load = () => api<Page<any>>('/tasks?page=1&pageSize=30').then(setRows);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHead title="任务中心" hint="批量通过、批量驳回、分成套用、批量申请、上架导入和应结导入都会记在这里。客户只看自己的任务，主管可以看团队任务。失败项可以单独重试，取消只停掉还没做的项。" />
      <Table rowKey="id" dataSource={rows?.items || []} pagination={false} columns={[
        { title: '名称', dataIndex: 'name' },
        { title: '进度', dataIndex: 'progress', render: (value: number) => `${value || 0}%` },
        { title: '成功', dataIndex: 'succeeded' },
        { title: '失败', dataIndex: 'failed' },
        { title: '跳过', dataIndex: 'skipped' },
        { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} /> },
        { title: '', render: (_: unknown, row) => <Space>
          <Button size="small" disabled={!row.failed} onClick={async () => { await api(`/tasks/${row.id}/retry`, { method: 'POST' }); message.success('已重试失败项'); load(); }}>仅重试失败项</Button>
          <Button size="small" disabled={!['RUNNING', 'PENDING'].includes(row.status)} onClick={async () => { await api(`/tasks/${row.id}/cancel`, { method: 'POST' }); message.success('剩余项已取消'); load(); }}>取消剩余</Button>
          <Button size="small" onClick={() => download(`/tasks/${row.id}/report`, `${row.name || 'task'}.csv`)}>下载报告</Button>
        </Space> },
      ]} />
    </div>
  );
}

export function RatesPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = () => api<any[]>('/rates').then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHead title="汇率" hint="结算参考汇率。录入后按日期取不晚于结算日的那一档。" />
      <ErrorNote error={error} />
      <Table rowKey="id" dataSource={rows} pagination={false} columns={[
        { title: '货币对', dataIndex: 'pair' },
        { title: '日期', dataIndex: 'rateDate', render: dayText },
        { title: '汇率', dataIndex: 'value' },
        { title: '来源', dataIndex: 'source' },
      ]} />
      <Form layout="inline" style={{ marginTop: 16 }} onFinish={async (values) => {
        try { await api('/rates', { method: 'POST', json: values }); message.success('已录入汇率'); load(); }
        catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
      }}>
        <Form.Item name="pair" initialValue="USD->CNY" rules={[{ required: true }]}><Input placeholder="USD->CNY" /></Form.Item>
        <Form.Item name="rateDate" rules={[{ required: true }]}><Input placeholder="日期 YYYY-MM-DD" /></Form.Item>
        <Form.Item name="value" rules={[{ required: true }]}><Input placeholder="汇率" /></Form.Item>
        <Form.Item name="source" rules={[{ required: true }]}><Input placeholder="来源" /></Form.Item>
        <Button type="primary" htmlType="submit">录入</Button>
      </Form>
    </div>
  );
}

