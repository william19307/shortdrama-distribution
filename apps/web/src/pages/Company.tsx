import { App, Button, Form, Input, Space, Switch, Table } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorNote, PageHead, StatusTag } from '../ui';

interface Bank { id: string; accountName: string; bankName: string; branch?: string; accountNo: string; isDefault: boolean }
interface Company {
  id: string; name: string; certStatus: string; creditCode?: string | null; legalPerson?: string | null;
  contactName?: string | null; contactPhone?: string | null; certRejectReason?: string | null;
  bankAccounts: Bank[];
}

export function CompanyPage() {
  const { message } = App.useApp();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState('');
  const load = () => api<Company>('/company').then(setCompany).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHead title="账户中心" hint="企业认证通过后才能提款。已认证主体变更期间，提款会暂停，原主体继续有效。" extra={company ? <StatusTag status={company.certStatus} /> : null} />
      <ErrorNote error={error} />
      {company?.certRejectReason ? <p>上次未通过：{company.certRejectReason}</p> : null}
      <Form
        layout="vertical"
        style={{ maxWidth: 640 }}
        key={company?.certStatus}
        initialValues={company || undefined}
        onFinish={async (values) => {
          try {
            setCompany(await api<Company>('/company/certification', { method: 'PUT', json: values }));
            message.success('已提交认证');
          } catch (err) { message.error(err instanceof Error ? err.message : '没有提交'); }
        }}
      >
        <Form.Item name="name" label="企业名称" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
        <Form.Item name="creditCode" label="统一社会信用代码" rules={[{ required: true, len: 18 }]}><Input /></Form.Item>
        <Form.Item name="legalPerson" label="法人" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
        <Button type="primary" htmlType="submit">提交认证</Button>
      </Form>
      <h2 style={{ marginTop: 28 }}>收款账户</h2>
      <p style={{ color: 'var(--ds-text-2)' }}>已认证后，户名必须与企业名称一致。账号只显示末四位。</p>
      <Table rowKey="id" pagination={false} dataSource={company?.bankAccounts || []} columns={[
        { title: '户名', dataIndex: 'accountName' },
        { title: '银行', dataIndex: 'bankName' },
        { title: '支行', dataIndex: 'branch' },
        { title: '账号', dataIndex: 'accountNo' },
        { title: '默认', dataIndex: 'isDefault', render: (value) => value ? '是' : '' },
        { title: '', render: (_, row: Bank) => <Button danger type="link" onClick={async () => { await api(`/bank-accounts/${row.id}`, { method: 'DELETE' }); load(); }}>删除</Button> },
      ]} />
      <Form layout="inline" style={{ marginTop: 12 }} onFinish={async (values) => {
        try {
          await api('/bank-accounts', { method: 'POST', json: { ...values, isDefault: Boolean(values.isDefault) } });
          message.success('账户已添加');
          load();
        } catch (err) { message.error(err instanceof Error ? err.message : '没有保存'); }
      }}>
        <Form.Item name="accountName" rules={[{ required: true }]}><Input placeholder="户名" /></Form.Item>
        <Form.Item name="bankName" rules={[{ required: true }]}><Input placeholder="银行" /></Form.Item>
        <Form.Item name="branch"><Input placeholder="支行" /></Form.Item>
        <Form.Item name="accountNo" rules={[{ required: true }]}><Input placeholder="账号" /></Form.Item>
        <Form.Item name="isDefault" valuePropName="checked"><Switch checkedChildren="默认" unCheckedChildren="默认" /></Form.Item>
        <Button htmlType="submit">添加</Button>
      </Form>
      <Space />
    </div>
  );
}
