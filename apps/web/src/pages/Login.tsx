import { motion as motionTokens } from '@ds/tokens';
import { Button, Card, Form, Input, Space, Tabs, Typography } from 'antd';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth';

const DEMOS = [
  ['已认证客户A · 林可', 'client@xinghe.example'],
  ['未认证客户B · 未仁', 'client-b@weiren.example'],
  ['新客户（无数据）', 'client-new@example.com'],
  ['青柠文化 · 周宁', 'client@qingning.example'],
  ['运营专员甲 · 林晓', 'ops@studio.example'],
  ['运营专员乙 · 王倩', 'ops2@studio.example'],
  ['运营主管 · 孙悦', 'ops-manager@studio.example'],
  ['商务 · 陈宇', 'bd@studio.example'],
  ['财务 · 赵倩', 'finance@studio.example'],
  ['管理员 · 周岚', 'admin@studio.example'],
];

const showDemos = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMOS === 'true';

export function LoginPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [registerForm] = Form.useForm();

  return (
    <motion.div className="auth-screen ds-root" data-density="comfortable" {...motionTokens.presets.page}>
      <section className="auth-hero">
        <div className="ds-eyebrow">海外发行</div>
        <h1 className="ds-display-sm ds-grad-text">把剧送出去，<br />把账算清楚。</h1>
        <p className="ds-lede" style={{ maxWidth: 460 }}>申请发行、跟进审核、看每天的播放，再按人民币结算。成片由你自己交给海外平台，这里不代为推送。</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Typography.Title level={3} style={{ marginTop: 0 }}>登录</Typography.Title>
          <Tabs
            items={[
              {
                key: 'in',
                label: '已有账号',
                children: (
                  <Form form={form} layout="vertical" onFinish={async (v) => {
                    try {
                      const user = await login(v.email, v.password);
                      nav(homeFor(user.role));
                    } catch (err) {
                      form.setFields([{ name: 'password', errors: [err instanceof Error ? err.message : '登录失败'] }]);
                    }
                  }}>
                    <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请填写邮箱' }]}><Input autoComplete="username" /></Form.Item>
                    <Form.Item name="password" label="密码" rules={[{ required: true, message: '请填写密码' }]}><Input.Password autoComplete="current-password" /></Form.Item>
                    <Button type="primary" htmlType="submit" block style={{ marginTop: 12 }}>进入</Button>
                  </Form>
                ),
              },
              {
                key: 'up',
                label: '注册客户',
                children: (
                  <Form form={registerForm} layout="vertical" onFinish={async (v) => {
                    try {
                      const user = await register(v);
                      nav(homeFor(user.role));
                    } catch (err) {
                      registerForm.setFields([{ name: 'email', errors: [err instanceof Error ? err.message : '注册失败'] }]);
                    }
                  }}>
                    <Form.Item name="companyName" label="企业名称" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
                    <Form.Item name="name" label="你的名字" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
                    <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}><Input.Password /></Form.Item>
                    <Button type="primary" htmlType="submit" block>创建企业账号</Button>
                  </Form>
                ),
              },
            ]}
          />
          {showDemos ? (
            <Card size="small" title="演示账号" style={{ marginTop: 20 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {DEMOS.map(([name, email]) => (
                  <Button key={email} block onClick={() => { form.setFieldsValue({ email, password: 'Demo123456' }); }}>{name}</Button>
                ))}
                <Typography.Text type="secondary">密码统一为 Demo123456。点名字会填进登录表，再按进入。</Typography.Text>
              </Space>
            </Card>
          ) : null}
        </div>
      </section>
    </motion.div>
  );
}
