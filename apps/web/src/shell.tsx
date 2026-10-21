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
import { Layout, Menu, Dropdown, Space, Typography, Segmented, Switch } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { roleLabel, useAuth } from './auth';
import { useDsTheme } from './theme';

const { Sider, Header, Content } = Layout;

interface Item { key: string; icon?: React.ReactNode; label: string; roles?: Role[] }

const STAFF_ITEMS: Item[] = [
  { key: '/contracts', icon: <FileProtectOutlined />, label: '合同', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/tickets', icon: <CustomerServiceOutlined />, label: '消息与工单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/workbench', icon: <DashboardOutlined />, label: '工作台', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/companies', icon: <TeamOutlined />, label: '客户与资质', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/dramas', icon: <VideoCameraOutlined />, label: '视频库', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/reviews', icon: <AuditOutlined />, label: '审核队列', roles: ['OPS', 'OPS_MANAGER', 'ADMIN'] },
  { key: '/shares', icon: <AccountBookOutlined />, label: '分成与上架', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/daily', icon: <DashboardOutlined />, label: '每日数据', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/watermarks', icon: <CameraOutlined />, label: '防伪截图', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/settlements', icon: <AccountBookOutlined />, label: '结算单', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/withdrawals', icon: <BankOutlined />, label: '提款·发票·打款', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/rates', icon: <DollarOutlined />, label: '汇率', roles: ['OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/platforms', icon: <SettingOutlined />, label: '平台名单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/users', icon: <TeamOutlined />, label: '员工账号', roles: ['ADMIN'] },
  { key: '/settings', icon: <SettingOutlined />, label: '全局参数', roles: ['ADMIN', 'FINANCE'] },
  { key: '/audit', icon: <FileSearchOutlined />, label: '操作日志', roles: ['ADMIN'] },
  { key: '/tasks', icon: <ThunderboltOutlined />, label: '任务', roles: ['OPS', 'OPS_MANAGER', 'ADMIN', 'FINANCE', 'BD'] },
];

type MenuItem = NonNullable<MenuProps['items']>[number];

function clientMenu(): MenuItem[] {
  return [
    {
      key: 'client-overview',
      icon: <DashboardOutlined />,
      label: '数据总览',
      children: [
        { key: '/', label: '总览' },
        { key: '/settlements', label: '结算与提款' },
      ],
    },
    { key: '/dramas', icon: <VideoCameraOutlined />, label: '我的剧集' },
    { key: '/contracts', icon: <FileProtectOutlined />, label: '合同' },
  ];
}

function leafKeys(items: MenuItem[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    if (!item || !('key' in item) || item.key == null) continue;
    if ('children' in item && item.children) keys.push(...leafKeys(item.children));
    else keys.push(String(item.key));
  }
  return keys;
}

export function Shell() {
  const { user, logout } = useAuth();
  const { mode, density, setMode, setDensity } = useDsTheme();
  const [openKeys, setOpenKeys] = useState<string[]>(user?.role === 'CLIENT' ? ['client-overview'] : []);
  const nav = useNavigate();
  const loc = useLocation();
  const items = useMemo(() => {
    if (!user) return [];
    if (user.role === 'CLIENT') return clientMenu();
    return STAFF_ITEMS.filter((item) => item.roles?.includes(user.role)).map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    }));
  }, [user]);
  const selected = leafKeys(items).filter((key) => (key === '/' ? loc.pathname === '/' : loc.pathname === key || loc.pathname.startsWith(`${key}/`))).sort((a, b) => b.length - a.length)[0];
  const accountMenu: MenuProps['items'] = [
    ...(user?.role === 'CLIENT'
      ? [
          { key: 'tickets', icon: <CustomerServiceOutlined />, label: '消息与工单', onClick: () => nav('/tickets') },
          { key: 'company', icon: <UserOutlined />, label: '账户中心', onClick: () => nav('/company') },
          { type: 'divider' as const },
        ]
      : []),
    { key: 'out', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); nav('/login'); } },
  ];

  return (
    <Layout className="ds-root" style={{ minHeight: '100vh' }}>
      <Sider width={228} breakpoint="lg" collapsedWidth={64}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 18px' }} className="brand-mark">短剧发行</div>
        <Menu
          theme={mode === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selected ? [selected] : []}
          openKeys={user?.role === 'CLIENT' ? openKeys : undefined}
          onOpenChange={setOpenKeys}
          items={items}
          onClick={({ key }) => { if (key.startsWith('/')) nav(key); }}
          style={{ borderInlineEnd: 0 }}
        />
        <div className="sider-foot">内容由客户自行对接海外平台，本平台不推送成片。</div>
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingInline: 16, backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--ds-border)' }}>
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as 'dark' | 'light')}
            options={[{ label: '深色', value: 'dark' }, { label: '浅色', value: 'light' }]}
          />
          <Switch size="small" checked={density === 'compact'} onChange={(checked) => setDensity(checked ? 'compact' : 'comfortable')} checkedChildren="紧凑" unCheckedChildren="舒适" />
          <Dropdown trigger={['click']} menu={{ items: accountMenu }}>
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
