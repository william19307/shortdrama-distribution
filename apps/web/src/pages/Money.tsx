import { amountColumn } from '@ds/antdTheme';
import { colors, motion as motionTokens, platformColor, type PlatformKey } from '@ds/tokens';
import { App, Badge, Button, Descriptions, Form, Input, Modal, Select, Space, Steps, Table, Upload } from 'antd';
import * as echarts from 'echarts';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, qs, uploadFile, type Page } from '../api';
import { useAuth } from '../auth';
import { useDsTheme } from '../theme';
import { ErrorNote, MoneyText, PageHead, PlatformChip, StatusTag, dayText } from '../ui';

interface Settlement {
  id: string; code: string; status: string; statusLabel?: string; amountCny: string | null;
  periodStart: string; periodEnd: string; clientNote?: string; internalNote?: string;
  referenceCny?: string | null; deviationPct?: string | null;
  company?: { id: string; name: string };
  lines?: { id: string; platformName: string; currency: string; originalAmount: string; referenceCny: string | null; drama?: { title: string } }[];
  logs?: { id: string; action: string; reason?: string; createdAt: string }[];
}
interface SettlementPage extends Page<Settlement> { minWithdrawAmount?: string }
interface Bank { id: string; accountName: string; bankName: string; accountNo: string }
interface Withdrawal {
  id: string; code: string; status: string; amountCny: string; invoiceNo?: string | null; invoiceRejectReason?: string | null;
  company?: { id: string; name: string }; bankAccount?: { accountName: string; accountNo: string; bankName: string };
  settlements?: { id: string; code: string; amountCny: string }[];
}

function withdrawLabel(status: string) {
  if (status === 'NO_SETTLEMENT') return '已退回';
  return undefined;
}

export function SettlementsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const client = user?.role === 'CLIENT';
  const { mode } = useDsTheme();
  const canReview = user?.role === 'FINANCE' || user?.role === 'ADMIN' || user?.role === 'OPS_MANAGER';
  const [form] = Form.useForm();
  const [rows, setRows] = useState<SettlementPage | null>(null);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState<string>();
  const [withdrawals, setWithdrawals] = useState<Page<Withdrawal> | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);

  const load = () => {
    api<SettlementPage>(`/settlements${qs({ page, pageSize: 20 })}`).then(setRows).catch((err) => setError(err.message));
    if (client) {
      api<Bank[]>('/bank-accounts').then(setBanks).catch(() => undefined);
      api<Page<Withdrawal>>('/withdrawals?page=1&pageSize=20').then(setWithdrawals).catch(() => undefined);
    } else {
      api<Page<{ id: string; name: string }>>('/companies?page=1&pageSize=100').then((res) => setCompanies(res.items)).catch(() => undefined);
    }
  };
  useEffect(() => { load(); }, [page, client]);
  useEffect(() => {
    if (!id) { setDetail(null); return; }
    api<Settlement>(`/settlements/${id}`).then(setDetail).catch((err) => setError(err.message));
  }, [id]);
  useEffect(() => {
    const el = document.getElementById('settle-plat');
    if (!el || !detail?.lines?.length) return;
    const chart = echarts.init(el);
    const sums = new Map<string, number>();
    for (const line of detail.lines) sums.set(line.platformName, (sums.get(line.platformName) || 0) + Number(line.referenceCny || line.originalAmount || 0));
    const keys = new Set(['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort']);
    chart.setOption({
      textStyle: { color: colors[mode].textSecondary },
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['46%', '72%'],
        label: { color: colors[mode].text, formatter: '{b}' },
        data: [...sums.entries()].map(([name, value]) => ({
          name,
          value,
          itemStyle: { color: keys.has(name) ? platformColor(name as PlatformKey, mode) : colors[mode].textTertiary },
        })),
      }],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [detail, mode]);

  const apply = async () => {
    try {
      const idempotencyKey = crypto.randomUUID();
      await api('/withdrawals', { method: 'POST', json: { settlementIds: picked, bankAccountId: bankId, idempotencyKey } });
      message.success('提款申请已提交');
      setPicked([]);
      setApplyOpen(false);
      load();
    } catch (err) { message.error(err instanceof Error ? err.message : '没有提交'); }
  };

  return (
    <div>
      <PageHead title={client ? '结算与提款' : '结算单'} hint={client ? `人民币结算。最低提款额 ${rows?.minWithdrawAmount || '10000.00'} 元，未达到的结算单会标成「未达起提额」，以后合计够了可以一起申请。` : '应结金额由运营手工填写，财务复核。分成和保底不参与计算。'} />
      <ErrorNote error={error} />
      {client ? <SettlementStats rows={rows?.items || []} /> : null}
      {!client ? (
        <Form form={form} layout="inline" style={{ marginBottom: 12 }} onFinish={async (values) => {
          try {
            const created = await api<Settlement>('/settlements/generate', { method: 'POST', json: values });
            message.success('结算单已生成');
            nav(`/settlements/${created.id}`);
          } catch (err) { message.error(err instanceof Error ? err.message : '没有生成'); }
        }}>
          <Form.Item name="companyId" rules={[{ required: true }]}><Select style={{ width: 220 }} placeholder="客户" options={companies.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="periodStart" rules={[{ required: true }]}><Input placeholder="开始 YYYY-MM-DD" /></Form.Item>
          <Form.Item name="periodEnd" rules={[{ required: true }]}><Input placeholder="结束 YYYY-MM-DD" /></Form.Item>
          <Button htmlType="submit">生成结算单</Button>
          <Button htmlType="button" onClick={async () => {
            const values = form.getFieldsValue();
            if (!values.periodStart || !values.periodEnd) { message.warning('先填写这个周期的开始和结束日期'); return; }
            try {
              const res = await api<{ created: Settlement[]; existing: Settlement[]; failed: { name: string; message: string }[]; notice?: string }>('/settlements/generate-batch', { method: 'POST', json: { periodStart: values.periodStart, periodEnd: values.periodEnd } });
              if (res.notice) message.info(res.notice);
              else message.success(`新生成 ${res.created.length} 张，已有 ${res.existing.length} 张${res.failed.length ? `，失败 ${res.failed.length} 张` : ''}`);
              load();
            } catch (err) { message.error(err instanceof Error ? err.message : '没有批量生成'); }
          }}>按这个周期批量生成</Button>
        </Form>
      ) : null}
      <Table
        rowKey="id"
        dataSource={rows?.items || []}
        pagination={{ current: page, pageSize: 20, total: rows?.total || 0, onChange: setPage, showSizeChanger: false }}
        rowSelection={client ? { selectedRowKeys: picked, onChange: (keys) => setPicked(keys as string[]), getCheckboxProps: (row) => ({ disabled: row.status !== 'PENDING_APPLY' }) } : undefined}
        onRow={(row) => ({ onClick: () => nav(`/settlements/${row.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: '单号', dataIndex: 'code' },
          { title: '客户', dataIndex: ['company', 'name'] },
          { title: '周期', render: (_: unknown, row: Settlement) => `${dayText(row.periodStart)} ~ ${dayText(row.periodEnd)}` },
          { title: '状态', render: (_: unknown, row: Settlement) => <StatusTag status={row.status} text={row.statusLabel} /> },
          amountColumn<Settlement>({ title: '应结（人民币）', dataIndex: 'amountCny', currency: '¥' }),
        ].filter((col) => client ? col.title !== '客户' : true)}
      />
      {client ? (
        <div style={{ marginTop: 16 }}>
          <Steps size="small" current={withdrawStep(withdrawals?.items || [])} items={[{ title: '选择结算单' }, { title: '上传发票' }, { title: '财务审核' }, { title: '打款' }]} />
          <Button type="primary" style={{ marginTop: 12 }} disabled={!picked.length} onClick={() => setApplyOpen(true)}>申请提款</Button>
          <Modal
            title="申请提款"
            open={applyOpen}
            onCancel={() => setApplyOpen(false)}
            onOk={apply}
            okText="提交"
            okButtonProps={{ disabled: !bankId }}
            transitionName=""
            maskTransitionName=""
            modalRender={(node) => <motion.div {...motionTokens.presets.modal}>{node}</motion.div>}
          >
            <Select style={{ width: '100%' }} placeholder="收款账户" value={bankId} onChange={setBankId} options={banks.map((item) => ({ value: item.id, label: `${item.accountName} · ${item.bankName} · ${item.accountNo}` }))} />
          </Modal>
        </div>
      ) : null}
      {detail ? (
        <div style={{ marginTop: 20 }}>
          <Descriptions title={detail.code} column={2} items={[
            { label: '状态', children: <StatusTag status={detail.status} text={detail.statusLabel} /> },
            { label: '应结', children: <MoneyText value={detail.amountCny} /> },
            { label: '说明', children: detail.clientNote || '—' },
            ...(client ? [] : [{ label: '内部说明', children: detail.internalNote || '—' }, { label: '参考换算', children: <MoneyText value={detail.referenceCny} /> }]),
          ]} />
          {detail.lines?.length ? <div id="settle-plat" className="chart-box" style={{ marginTop: 12 }} /> : null}
          <Table style={{ marginTop: 12 }} rowKey="id" pagination={false} dataSource={detail.lines || []} columns={[
            { title: '剧', dataIndex: ['drama', 'title'] },
            { title: '平台', dataIndex: 'platformName', render: (value: string) => <PlatformChip name={value} /> },
            { title: '原币', render: (_: unknown, row: NonNullable<Settlement['lines']>[number]) => `${row.originalAmount ?? '—'} ${row.currency}` },
            amountColumn<NonNullable<Settlement['lines']>[number]>({ title: '参考人民币', dataIndex: 'referenceCny', currency: '¥' }),
          ]} />
          {!client && (detail.status === 'PENDING_ENTRY' || detail.status === 'PENDING_REVIEW') ? (
            <Form layout="vertical" style={{ maxWidth: 520, marginTop: 16 }} onFinish={async (values) => {
              try {
                const saved = await api<Settlement & { warning?: string }>(`/settlements/${detail.id}/amount`, { method: 'POST', json: values });
                if (saved.warning) message.warning(saved.warning);
                else message.success('金额已提交复核');
                setDetail(saved);
                load();
              } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
            }}>
              <Form.Item name="amountCny" label="应结金额（人民币）" rules={[{ required: true }]}><Input placeholder="例如 186420.50" /></Form.Item>
              <Form.Item name="internalNote" label="内部说明（客户看不到）" rules={[{ required: true }]}><Input.TextArea /></Form.Item>
              <Form.Item name="clientNote" label="给客户的说明"><Input.TextArea /></Form.Item>
              {detail.amountCny != null ? <Form.Item name="reason" label="修改原因" rules={[{ required: true }]}><Input /></Form.Item> : null}
              <Button type="primary" htmlType="submit">提交金额</Button>
            </Form>
          ) : null}
          {!client && detail.status === 'PENDING_REVIEW' && canReview ? (
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={async () => { try { setDetail(await api(`/settlements/${detail.id}/review`, { method: 'POST', json: { pass: true } })); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有通过'); } }}>复核通过</Button>
              <Button danger onClick={async () => { const reason = window.prompt('退回原因') || ''; if (!reason) return; setDetail(await api(`/settlements/${detail.id}/review`, { method: 'POST', json: { pass: false, reason } })); load(); }}>退回</Button>
            </Space>
          ) : null}
        </div>
      ) : null}
      {client && withdrawals ? (
        <div style={{ marginTop: 28 }}>
          <h2>提款记录 <Badge count={withdrawals.items.filter((row) => row.status === 'PENDING_INVOICE').length} /></h2>
          <Table rowKey="id" pagination={false} dataSource={withdrawals.items} columns={[
            { title: '单号', dataIndex: 'code' },
            amountColumn<Withdrawal>({ title: '金额', dataIndex: 'amountCny', currency: '¥' }),
            { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} text={withdrawLabel(value)} /> },
            { title: '账户', render: (_, row: Withdrawal) => row.bankAccount ? `${row.bankAccount.bankName} ${row.bankAccount.accountNo}` : '—' },
            { title: '', render: (_, row: Withdrawal) => row.status === 'PENDING_INVOICE' ? <InvoiceButton id={row.id} onDone={load} /> : row.invoiceRejectReason || '' },
          ]} />
        </div>
      ) : null}
    </div>
  );
}

function sumAmount(rows: Settlement[], statuses: string[]) {
  return rows.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + Number(row.amountCny || 0), 0);
}

function SettlementStats({ rows }: { rows: Settlement[] }) {
  const pending = sumAmount(rows, ['PENDING_ENTRY', 'PENDING_REVIEW']);
  const ready = sumAmount(rows, ['PENDING_APPLY']);
  const settled = sumAmount(rows, ['PAID', 'SETTLED']);
  return (
    <div className="stat-row">
      <div className="ds-stat"><div className="ds-stat__label">可提现</div><div className="ds-stat__value"><small>¥</small>{ready.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
      <div className="ds-stat"><div className="ds-stat__label" style={{ color: 'var(--ds-settle)' }}>待结算</div><div className="ds-stat__value"><small>¥</small>{pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
      <div className="ds-stat"><div className="ds-stat__label">已结算</div><div className="ds-stat__value"><small>¥</small>{settled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
    </div>
  );
}

function withdrawStep(rows: Withdrawal[]) {
  if (rows.some((row) => row.status === 'PAYING' || row.status === 'PAID')) return 3;
  if (rows.some((row) => row.status === 'INVOICE_REVIEW' || row.status === 'PENDING_PAY')) return 2;
  if (rows.some((row) => row.status === 'PENDING_INVOICE')) return 1;
  return 0;
}

function InvoiceButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { message } = App.useApp();
  const [no, setNo] = useState('');
  return (
    <Space>
      <Input placeholder="发票号" value={no} onChange={(event) => setNo(event.target.value)} />
      <Upload showUploadList={false} beforeUpload={async (file) => {
        try {
          const uploaded = await uploadFile(file, 'INVOICE');
          await api(`/withdrawals/${id}/invoice`, { method: 'POST', json: { invoiceKey: uploaded.key, invoiceNo: no } });
          message.success('发票已提交');
          onDone();
        } catch (err) { message.error(err instanceof Error ? err.message : '没有上传'); }
        return false;
      }}><Button>上传发票</Button></Upload>
    </Space>
  );
}

export function WithdrawalsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [rows, setRows] = useState<Page<Withdrawal> | null>(null);
  const [error, setError] = useState('');
  const finance = user?.role === 'FINANCE' || user?.role === 'ADMIN';
  const load = () => api<Page<Withdrawal>>('/withdrawals?page=1&pageSize=50').then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const act = async (path: string, json: unknown) => {
    try { await api(path, { method: 'POST', json }); load(); }
    catch (err) { message.error(err instanceof Error ? err.message : '没有完成'); }
  };

  return (
    <div>
      <PageHead title="提款 · 发票 · 打款" hint="核对、审发票和打款由财务或管理员操作。退回的提款单显示为已退回。" />
      <ErrorNote error={error} />
      <Table rowKey="id" dataSource={rows?.items || []} pagination={false} columns={[
        { title: '单号', dataIndex: 'code' },
        { title: '客户', dataIndex: ['company', 'name'] },
        amountColumn<Withdrawal>({ title: '金额', dataIndex: 'amountCny', currency: '¥' }),
        { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag status={value} text={withdrawLabel(value)} /> },
        { title: '收款', render: (_, row: Withdrawal) => row.bankAccount ? `${row.bankAccount.accountName} ${row.bankAccount.accountNo}` : '—' },
        {
          title: '处理',
          render: (_, row: Withdrawal) => finance ? (
            <Space>
              {row.status === 'VERIFYING' ? <><Button type="primary" size="small" onClick={() => act(`/withdrawals/${row.id}/verify`, { pass: true })}>核对通过</Button><Button size="small" danger onClick={() => act(`/withdrawals/${row.id}/verify`, { pass: false, reason: '资料不符' })}>退回</Button></> : null}
              {row.status === 'INVOICE_REVIEW' ? <><Button type="primary" size="small" onClick={() => act(`/withdrawals/${row.id}/invoice/review`, { pass: true })}>发票通过</Button><Button size="small" danger onClick={() => { const reason = window.prompt('驳回原因') || ''; if (reason) act(`/withdrawals/${row.id}/invoice/review`, { pass: false, reason }); }}>驳回发票</Button></> : null}
              {row.status === 'PAYING' ? <PayButton id={row.id} companyId={row.company?.id} onDone={load} /> : null}
            </Space>
          ) : null,
        },
      ]} />
    </div>
  );
}

function PayButton({ id, companyId, onDone }: { id: string; companyId?: string; onDone: () => void }) {
  const { message } = App.useApp();
  return (
    <Upload showUploadList={false} beforeUpload={async (file) => {
      try {
        const uploaded = await uploadFile(file, 'VOUCHER', { companyId });
        await api(`/withdrawals/${id}/pay`, { method: 'POST', json: { voucherKey: uploaded.key } });
        message.success('已记录打款');
        onDone();
      } catch (err) { message.error(err instanceof Error ? err.message : '没有打款'); }
      return false;
    }}><Button type="primary" size="small">上传回单并打款</Button></Upload>
  );
}

