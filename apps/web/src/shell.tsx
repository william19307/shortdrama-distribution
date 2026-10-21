import {
  AccountBookOutlined,
  AuditOutlined,
  BankOutlined,
  BellOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { Role } from '@shortform/shared';
import { Badge, Button, Drawer, Dropdown, Layout, Menu, Segmented, Space, Switch, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { roleLabel, useAuth } from './auth';
import { useDsTheme } from './theme';

const { Sider, Header, Content } = Layout;

interface Item { key: string; icon?: React.ReactNode; label: string; roles?: Role[] }

const STAFF_ITEMS: Item[] = [
  { key: '/contracts', icon: <FileProtectOutlined />, label: '合同', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/tickets', icon: <CustomerServiceOutlined />, label: '消息与工单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/workbench', icon: <DashboardOutlined />, label: '工作台', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/companies', icon: <TeamOutlined />, label: '客户与资质', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  { key: '/dramas', icon: <VideoCameraOutlined />, label: '视频库', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/reviews', icon: <AuditOutlined />, label: '审核队列', roles: ['OPS', 'OPS_MANAGER', 'ADMIN'] },
  { key: '/shares', icon: <AccountBookOutlined />, label: '分成与上架', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/daily', icon: <DashboardOutlined />, label: '数据同步', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/watermarks', icon: <CameraOutlined />, label: '防伪截图', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/settlements', icon: <AccountBookOutlined />, label: '结算复核', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/withdrawals', icon: <BankOutlined />, label: '提款·发票·打款', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/rates', icon: <DollarOutlined />, label: '汇率', roles: ['OPS_MANAGER', 'FINANCE', 'ADMIN'] },
  { key: '/platforms', icon: <SettingOutlined />, label: '平台名单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
  { key: '/users', icon: <TeamOutlined />, label: '员工账号', roles: ['ADMIN'] },
  { key: '/settings', icon: <SettingOutlined />, label: '全局参数', roles: ['ADMIN'] },
  { key: '/audit', icon: <FileSearchOutlined />, label: '操作日志', roles: ['ADMIN'] },
  { key: '/tasks', icon: <ThunderboltOutlined />, label: '任务中心', roles: ['OPS', 'OPS_MANAGER', 'ADMIN', 'FINANCE', 'BD'] },
];

type MenuItem = NonNullable<MenuProps['items']>[number];

function clientMenu(): MenuItem[] {
  return [
    {
      key: 'client-detail',
      icon: <DashboardOutlined />,
      label: '数据详情',
      children: [
        { key: '/', label: '数据总览' },
        { key: '/settlements', label: '结算与提款' },
      ],
    },
    { key: '/dramas', icon: <VideoCameraOutlined />, label: '视频存储库' },
    { key: '/contracts', icon: <FileProtectOutlined />, label: '合同申请及列表' },
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
  const [openKeys, setOpenKeys] = useState<string[]>(user?.role === 'CLIENT' ? ['client-detail'] : []);
  const [unread, setUnread] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
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
  useEffect(() => {
    if (user?.role !== 'CLIENT') return;
    let stop = false;
    api<{ unread: number }>('/notifications?page=1&pageSize=1&unreadOnly=true')
      .then((res) => { if (!stop) setUnread(res.unread || 0); })
      .catch(() => { if (!stop) setUnread(0); });
    return () => { stop = true; };
  }, [user, loc.pathname]);
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
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingInline: 16, backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--ds-border)' }}>
          {user?.role === 'CLIENT' ? (
            <>
              <Button type="text" icon={<CloudUploadOutlined />} onClick={() => setQueueOpen(true)}>上传队列</Button>
              <Button type="text" icon={<UnorderedListOutlined />} onClick={() => nav('/tasks')}>任务中心</Button>
              <Badge dot={unread > 0} offset={[-4, 6]}>
                <Button type="text" icon={<BellOutlined />} onClick={() => nav('/tickets')}>消息</Button>
              </Badge>
              <Button type="text" icon={<UserOutlined />} onClick={() => nav('/company')}>账户中心</Button>
            </>
          ) : null}
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
      <Drawer title="上传队列" open={queueOpen} onClose={() => setQueueOpen(false)} width={360}>
        <Typography.Text type="secondary">当前没有进行中的上传。在视频存储库里上传成片、封面或授权书时，进度会显示在对应页面。</Typography.Text>
      </Drawer>
    </Layout>
  );
}
