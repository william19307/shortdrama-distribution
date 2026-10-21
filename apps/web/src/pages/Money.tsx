import { App, Button, Descriptions, Form, Input, Select, Space, Table, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, qs, uploadFile, type Page } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, StatusTag, dayText, money } from '../ui';

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
  const [rows, setRows] = useState<SettlementPage | null>(null);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState<string>();
  const [withdrawals, setWithdrawals] = useState<Page<Withdrawal> | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

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

  const apply = async () => {
    try {
      await api('/withdrawals', { method: 'POST', json: { settlementIds: picked, bankAccountId: bankId, idempotencyKey: crypto.randomUUID() } });
      message.success('提款申请已提交');
      setPicked([]);
      load();
    } catch (err) { message.error(err instanceof Error ? err.message : '没有提交'); }
  };

  return (
    <div>
      <PageHead title={client ? '结算与提款' : '结算单'} hint={client ? `人民币结算。最低提款额 ${rows?.minWithdrawAmount || '10000.00'} 元，未达到的结算单会标成「未达起提额」，以后合计够了可以一起申请。` : '应结金额由运营手工填写，财务复核。分成和保底不参与计算。'} />
      <ErrorNote error={error} />
      {!client ? (
        <Form layout="inline" style={{ marginBottom: 12 }} onFinish={async (values) => {
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
          { title: '应结（人民币）', dataIndex: 'amountCny', render: (value: string | null) => money(value) },
        ].filter((col) => client ? col.title !== '客户' : true)}
      />
      {client ? (
        <Space style={{ marginTop: 12 }}>
          <Select style={{ width: 280 }} placeholder="收款账户" value={bankId} onChange={setBankId} options={banks.map((item) => ({ value: item.id, label: `${item.accountName} · ${item.bankName} · ${item.accountNo}` }))} />
          <Button type="primary" disabled={!picked.length || !bankId} onClick={apply}>申请提款</Button>
        </Space>
      ) : null}
      {detail ? (
        <div style={{ marginTop: 20 }}>
          <Descriptions title={detail.code} column={2} items={[
            { label: '状态', children: <StatusTag status={detail.status} text={detail.statusLabel} /> },
            { label: '应结', children: money(detail.amountCny) },
            { label: '说明', children: detail.clientNote || '—' },
            ...(client ? [] : [{ label: '内部说明', children: detail.internalNote || '—' }, { label: '参考换算', children: money(detail.referenceCny) }]),
          ]} />
          <Table style={{ marginTop: 12 }} rowKey="id" pagination={false} dataSource={detail.lines || []} columns={[
            { title: '剧', dataIndex: ['drama', 'title'] },
            { title: '平台', dataIndex: 'platformName' },
            { title: '原币', render: (_, row) => `${row.originalAmount ?? '—'} ${row.currency}` },
            { title: '参考人民币', dataIndex: 'referenceCny', render: money },
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
          {!client && detail.status === 'PENDING_REVIEW' && (user?.role === 'FINANCE' || user?.role === 'ADMIN') ? (
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={async () => { try { setDetail(await api(`/settlements/${detail.id}/review`, { method: 'POST', json: { pass: true } })); load(); } catch (err) { message.error(err instanceof Error ? err.message : '没有通过'); } }}>复核通过</Button>
              <Button danger onClick={async () => { const reason = window.prompt('退回原因') || ''; if (!reason) return; setDetail(await api(`/settlements/${detail.id}/review`, { method: 'POST', json: { pass: false, reason } })); load(); }}>退回</Button>
            </Space>
          ) : null}
        </div>
      ) : null}
      {client && withdrawals ? (
        <div style={{ marginTop: 28 }}>
          <h2>提款记录</h2>
          <Table rowKey="id" pagination={false} dataSource={withdrawals.items} columns={[
            { title: '单号', dataIndex: 'code' },
            { title: '金额', dataIndex: 'amountCny', render: money },
            { title: '状态', dataIndex: 'status', render: (value) => <StatusTag status={value} text={withdrawLabel(value)} /> },
            { title: '账户', render: (_, row: Withdrawal) => row.bankAccount ? `${row.bankAccount.bankName} ${row.bankAccount.accountNo}` : '—' },
            { title: '', render: (_, row: Withdrawal) => row.status === 'PENDING_INVOICE' ? <InvoiceButton id={row.id} onDone={load} /> : row.invoiceRejectReason || '' },
          ]} />
        </div>
      ) : null}
    </div>
  );
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
        { title: '金额', dataIndex: 'amountCny', render: money },
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

