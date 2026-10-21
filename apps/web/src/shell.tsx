import {
  AccountBookOutlined,
  AuditOutlined,
  BankOutlined,
  CameraOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { Role } from '@shortform/shared';
import { Layout, Menu, Dropdown, Space, Typography } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { roleLabel, useAuth } from './auth';

const { Sider, Header, Content } = Layout;

interface Item { key: string; icon?: React.ReactNode; label: string; roles?: Role[] }

const ITEMS: Item[] = [
  { key: '/', icon: <DashboardOutlined />, label: '数据总览', roles: ['CLIENT'] },
  { key: '/dramas', icon: <VideoCameraOutlined />, label: '我的剧集', roles: ['CLIENT'] },
  { key: '/contracts', icon: <FileProtectOutlined />, label: '合同', roles: ['CLIENT', 'OPS', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/settlements', icon: <AccountBookOutlined />, label: '结算与提款', roles: ['CLIENT'] },
  { key: '/tickets', icon: <CustomerServiceOutlined />, label: '消息与工单', roles: ['CLIENT', 'OPS', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/company', icon: <UserOutlined />, label: '账户中心', roles: ['CLIENT'] },
  { key: '/workbench', icon: <DashboardOutlined />, label: '工作台', roles: ['OPS', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/companies', icon: <TeamOutlined />, label: '客户与资质', roles: ['OPS', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/dramas', icon: <VideoCameraOutlined />, label: '视频库', roles: ['OPS', 'BD', 'ADMIN'] },
  { key: '/reviews', icon: <AuditOutlined />, label: '审核队列', roles: ['OPS', 'ADMIN'] },
  { key: '/shares', icon: <AccountBookOutlined />, label: '分成与上架', roles: ['OPS', 'FINANCE', 'ADMIN'] },
  { key: '/daily', icon: <DashboardOutlined />, label: '每日数据', roles: ['OPS', 'BD', 'ADMIN'] },
  { key: '/watermarks', icon: <CameraOutlined />, label: '防伪截图', roles: ['OPS', 'BD', 'ADMIN'] },
  { key: '/settlements', icon: <AccountBookOutlined />, label: '结算单', roles: ['OPS', 'FINANCE', 'ADMIN'] },
  { key: '/withdrawals', icon: <BankOutlined />, label: '提款·发票·打款', roles: ['OPS', 'FINANCE', 'ADMIN'] },
  { key: '/rates', icon: <DollarOutlined />, label: '汇率', roles: ['FINANCE', 'ADMIN'] },
  { key: '/platforms', icon: <SettingOutlined />, label: '平台名单', roles: ['OPS', 'BD', 'ADMIN'] },
  { key: '/users', icon: <TeamOutlined />, label: '员工账号', roles: ['ADMIN'] },
  { key: '/settings', icon: <SettingOutlined />, label: '全局参数', roles: ['ADMIN', 'FINANCE'] },
  { key: '/audit', icon: <FileSearchOutlined />, label: '操作日志', roles: ['ADMIN'] },
  { key: '/tasks', icon: <ThunderboltOutlined />, label: '任务', roles: ['OPS', 'ADMIN', 'FINANCE', 'BD'] },
];

export function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const items = useMemo(() => {
    const seen = new Set<string>();
    return ITEMS.filter((item) => user && item.roles?.includes(user.role) && !seen.has(item.key) && seen.add(item.key)).map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    }));
  }, [user]);
  const selected = items.map((item) => item.key).filter((key) => (key === '/' ? loc.pathname === '/' : loc.pathname === key || loc.pathname.startsWith(`${key}/`))).sort((a, b) => b.length - a.length)[0];

  return (
    <Layout className="ds-root" style={{ minHeight: '100vh' }}>
      <Sider width={228} breakpoint="lg" collapsedWidth={64}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 18px' }} className="brand-mark">短剧发行</div>
        <Menu theme="dark" mode="inline" selectedKeys={selected ? [selected] : []} items={items} onClick={({ key }) => nav(key)} style={{ borderInlineEnd: 0 }} />
        <div className="sider-foot">内容由客户自行对接海外平台，本平台不推送成片。</div>
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingInline: 16, backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--ds-border)' }}>
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'out', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); nav('/login'); } }] }}>
            <Space style={{ cursor: 'pointer' }}>
              <Typography.Text>{user?.name}</Typography.Text>
              <Typography.Text type="secondary">{user ? roleLabel(user.role) : ''}{user?.companyName ? ` · ${user.companyName}` : ''}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
