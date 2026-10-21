import { App, Button, Form, Input, Space, Steps, Switch, Table, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { api, uploadFile } from '../api';
import { ErrorNote, PageHead, StatusTag } from '../ui';

interface Bank { id: string; accountName: string; bankName: string; branch?: string; accountNo: string; isDefault: boolean }
interface Company {
  id: string; name: string; certStatus: string; creditCode?: string | null; legalPerson?: string | null;
  contactName?: string | null; contactPhone?: string | null; certRejectReason?: string | null; licenseKey?: string | null;
  bankAccounts: Bank[];
}

export function CompanyPage() {
  const { message } = App.useApp();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [licenseKey, setLicenseKey] = useState('');
  const [form] = Form.useForm();
  const load = () => api<Company>('/company').then((next) => {
    setCompany(next);
    form.setFieldsValue({
      name: next.name,
      creditCode: next.creditCode,
      legalPerson: next.legalPerson,
      contactName: next.contactName,
      contactPhone: next.contactPhone,
    });
  }).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const reviewing = company?.certStatus === 'PENDING' || company?.certStatus === 'CHANGE_PENDING';

  const submit = async (skipBank: boolean) => {
    const values = await form.validateFields(['name', 'creditCode', 'legalPerson', 'contactName', 'contactPhone']);
    if (!licenseKey && !company?.licenseKey) {
      message.error('请先上传营业执照');
      setStep(0);
      return;
    }
    const next = await api<Company>('/company/certification', { method: 'PUT', json: { ...values, licenseKey: licenseKey || company?.licenseKey } });
    if (!skipBank) {
      const bank = form.getFieldsValue(['accountName', 'bankName', 'accountNo']);
      if (bank.accountName && bank.bankName && bank.accountNo) {
        await api('/bank-accounts', { method: 'POST', json: { ...bank, isDefault: true } });
      }
    }
    setCompany(await api<Company>('/company'));
    message.success(next.certStatus === 'PENDING' || next.certStatus === 'CHANGE_PENDING' ? '已提交，正在审核' : '已提交认证');
  };

  return (
    <div>
      <PageHead title="账户中心" hint="企业认证分三步。执照、法人和联系人提交后进入审核，对公账户可以稍后填写。" extra={company ? <Space>{!reviewing && company.certStatus !== 'APPROVED' ? <Button type="primary" onClick={() => setStep(0)}>去认证</Button> : null}<StatusTag status={company.certStatus} /></Space> : null} />
      <ErrorNote error={error} />
      {company?.certRejectReason ? <p>上次未通过：{company.certRejectReason}</p> : null}
      <Steps current={reviewing ? 3 : step} style={{ maxWidth: 720, marginBottom: 24 }} items={[
        { title: '营业执照' },
        { title: '法人与联系人' },
        { title: '对公账户' },
        { title: '审核' },
      ]} />
      {reviewing ? (
        <div>
          <h2>审核中</h2>
          <p>资料已提交。预计 1 个工作日内完成审核，当前进度：审核中。</p>
        </div>
      ) : (
        <Form form={form} layout="vertical" style={{ maxWidth: 640 }} initialValues={company || undefined}>
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Upload.Dragger multiple={false} showUploadList={false} beforeUpload={async (file) => {
              try {
                const uploaded = await uploadFile(file, 'LICENSE', { companyId: company?.id });
                setLicenseKey(uploaded.key);
                message.success('营业执照已上传');
              } catch (err) { message.error(err instanceof Error ? err.message : '没有上传'); }
              return false;
            }}>
              <p>把营业执照拖到这里，或点击上传</p>
              {licenseKey || company?.licenseKey ? <p>已上传</p> : null}
            </Upload.Dragger>
            <Form.Item name="name" label="企业名称" rules={[{ required: true, message: '请填写企业名称' }, { min: 2, message: '企业名称至少 2 个字' }]} style={{ marginTop: 16 }}><Input /></Form.Item>
            <Form.Item name="creditCode" label="统一社会信用代码" rules={[{ required: true, message: '请填写统一社会信用代码' }, { len: 18, message: '统一社会信用代码为 18 位' }]}><Input /></Form.Item>
            <Button type="primary" onClick={() => form.validateFields(['name', 'creditCode']).then(() => setStep(1)).catch(() => undefined)}>下一步</Button>
          </div>
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Form.Item name="legalPerson" label="法人" rules={[{ required: true, message: '请填写法人' }]}><Input /></Form.Item>
            <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请填写联系人' }]}><Input /></Form.Item>
            <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: '请填写联系电话' }]}><Input /></Form.Item>
            <Space>
              <Button onClick={() => setStep(0)}>上一步</Button>
              <Button type="primary" onClick={() => form.validateFields(['legalPerson', 'contactName', 'contactPhone']).then(() => setStep(2)).catch(() => undefined)}>下一步</Button>
            </Space>
          </div>
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            <Form.Item name="accountName" label="户名"><Input /></Form.Item>
            <Form.Item name="bankName" label="开户银行"><Input /></Form.Item>
            <Form.Item name="accountNo" label="账号"><Input /></Form.Item>
            <Space>
              <Button onClick={() => setStep(1)}>上一步</Button>
              <Button onClick={() => submit(true).catch((err) => message.error(err instanceof Error ? err.message : '没有提交'))}>稍后填写</Button>
              <Button type="primary" onClick={() => submit(false).catch((err) => message.error(err instanceof Error ? err.message : '没有提交'))}>提交</Button>
            </Space>
          </div>
        </Form>
      )}
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
      {!reviewing ? (
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
      ) : null}
    </div>
  );
}
