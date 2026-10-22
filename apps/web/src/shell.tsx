import {
  AccountBookOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { Role } from '@shortform/shared';
import { App, Badge, Button, Drawer, Dropdown, Layout, Menu, Segmented, Space, Switch, Typography, Upload } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, uploadFile } from './api';
import { roleLabel, useAuth } from './auth';
import { useDsTheme } from './theme';

const { Sider, Header, Content } = Layout;

interface Leaf { key: string; icon: React.ReactNode; label: string; roles: Role[] }
interface Group { key: string; icon: React.ReactNode; label: string; children: Leaf[] }

const STAFF_NAV: Array<Leaf | Group> = [
  { key: '/workbench', icon: <DashboardOutlined />, label: '工作台', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
  {
    key: 'staff-review',
    icon: <AuditOutlined />,
    label: '审核与内容',
    children: [
      { key: '/dramas', icon: <VideoCameraOutlined />, label: '视频库', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
      { key: '/reviews', icon: <AuditOutlined />, label: '审核队列', roles: ['OPS', 'OPS_MANAGER', 'ADMIN'] },
      { key: '/watermarks', icon: <CameraOutlined />, label: '防伪截图', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
    ],
  },
  {
    key: 'staff-distribution',
    icon: <BarChartOutlined />,
    label: '发行与数据',
    children: [
      { key: '/shares', icon: <AccountBookOutlined />, label: '分成与上架', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
      { key: '/daily', icon: <DashboardOutlined />, label: '数据同步', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
      { key: '/platforms', icon: <SettingOutlined />, label: '平台名单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
    ],
  },
  {
    key: 'staff-finance',
    icon: <AccountBookOutlined />,
    label: '结算与财务',
    children: [
      { key: '/settlements', icon: <AccountBookOutlined />, label: '结算复核', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
      { key: '/withdrawals', icon: <BankOutlined />, label: '提款·发票·打款', roles: ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] },
      { key: '/rates', icon: <DollarOutlined />, label: '汇率', roles: ['OPS_MANAGER', 'FINANCE', 'ADMIN'] },
    ],
  },
  {
    key: 'staff-clients',
    icon: <TeamOutlined />,
    label: '客户与合同',
    children: [
      { key: '/companies', icon: <TeamOutlined />, label: '客户与资质', roles: ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN'] },
      { key: '/contracts', icon: <FileProtectOutlined />, label: '合同', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
      { key: '/tickets', icon: <CustomerServiceOutlined />, label: '消息与工单', roles: ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'] },
    ],
  },
  { key: '/tasks', icon: <ThunderboltOutlined />, label: '任务中心', roles: ['OPS', 'OPS_MANAGER', 'ADMIN', 'FINANCE', 'BD'] },
  {
    key: 'staff-system',
    icon: <SettingOutlined />,
    label: '系统',
    children: [
      { key: '/users', icon: <TeamOutlined />, label: '员工账号', roles: ['ADMIN'] },
      { key: '/settings', icon: <SettingOutlined />, label: '全局参数', roles: ['ADMIN'] },
      { key: '/audit', icon: <FileSearchOutlined />, label: '操作日志', roles: ['ADMIN'] },
    ],
  },
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

function isGroup(entry: Leaf | Group): entry is Group {
  return 'children' in entry;
}

function staffMenu(role: Role): MenuItem[] {
  const items: MenuItem[] = [];
  for (const entry of STAFF_NAV) {
    if (isGroup(entry)) {
      const children = entry.children
        .filter((item) => item.roles.includes(role))
        .map((item) => ({ key: item.key, icon: item.icon, label: item.label }));
      if (!children.length) continue;
      items.push({ key: entry.key, icon: entry.icon, label: entry.label, children });
    } else if (entry.roles.includes(role)) {
      items.push({ key: entry.key, icon: entry.icon, label: entry.label });
    }
  }
  return items;
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

function pathMatches(key: string, pathname: string) {
  return key === '/' ? pathname === '/' : pathname === key || pathname.startsWith(`${key}/`);
}

function groupForPath(items: MenuItem[], pathname: string) {
  for (const item of items) {
    if (!item || !('key' in item) || item.key == null || !('children' in item) || !item.children) continue;
    if (leafKeys(item.children).some((key) => pathMatches(key, pathname))) return String(item.key);
  }
  return null;
}

export function Shell() {
  const { user, logout } = useAuth();
  const { mode, density, setMode, setDensity } = useDsTheme();
  const { message } = App.useApp();
  const [unread, setUnread] = useState(0);
  const [queue, setQueue] = useState<{ label: string; pendingDramas: number; items: { id: string; fileName: string; purpose: string; dramaId: string | null; dramaTitle: string; episodeNo: number | null; companyId: string; size: string; mode: string; partCount: number; completedCount: number }[] }>({ label: '', pendingDramas: 0, items: [] });
  const [queueOpen, setQueueOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const items = useMemo(() => {
    if (!user) return [];
    if (user.role === 'CLIENT') return clientMenu();
    return staffMenu(user.role);
  }, [user]);
  const activeGroup = useMemo(() => groupForPath(items, loc.pathname), [items, loc.pathname]);
  const [openKeys, setOpenKeys] = useState<string[]>(() => (activeGroup ? [activeGroup] : []));
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(activeGroup);
  if (pinnedGroup !== activeGroup) {
    setPinnedGroup(activeGroup);
    if (activeGroup && !openKeys.includes(activeGroup)) setOpenKeys([...openKeys, activeGroup]);
  }
  const selected = leafKeys(items).filter((key) => pathMatches(key, loc.pathname)).sort((a, b) => b.length - a.length)[0];
  useEffect(() => {
    if (!user) return;
    let stop = false;
    api<{ unread: number }>('/notifications?page=1&pageSize=1&unreadOnly=true')
      .then((res) => { if (!stop) setUnread(res.unread || 0); })
      .catch(() => { if (!stop) setUnread(0); });
    return () => { stop = true; };
  }, [user, loc.pathname]);
  useEffect(() => {
    if (!user || user.role !== 'CLIENT') return;
    let stop = false;
    const load = () => {
      api<typeof queue>('/storage/uploads')
        .then((res) => { if (!stop) setQueue(res); })
        .catch(() => undefined);
    };
    load();
    if (!queueOpen) return () => { stop = true; };
    const timer = window.setInterval(load, 4000);
    return () => { stop = true; window.clearInterval(timer); };
  }, [user, queueOpen]);
  const resumeUpload = async (item: (typeof queue.items)[number], file: File) => {
    if (file.name !== item.fileName || String(file.size) !== item.size) {
      message.error(`请选择原来的文件「${item.fileName}」继续`);
      return;
    }
    try {
      await uploadFile(file, item.purpose, { dramaId: item.dramaId || undefined, episodeNo: item.episodeNo || undefined, companyId: item.companyId }, { multipart: item.mode === 'multipart' });
      message.success('已继续传完');
      const res = await api<typeof queue>('/storage/uploads');
      setQueue(res);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '没有续传');
    }
  };
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
      <Sider
        className="app-sider"
        width={228}
        theme={mode === 'dark' ? 'dark' : 'light'}
        breakpoint="md"
        collapsedWidth={0}
        collapsible
        trigger={<span title="展开或收起菜单"><MenuOutlined /></span>}
        zeroWidthTriggerStyle={{ top: 16 }}
      >
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }} className="brand-mark">短剧发行</div>
        <Menu
          theme={mode === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selected ? [selected] : []}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={items}
          onClick={({ key }) => { if (key.startsWith('/')) nav(key); }}
          style={{ borderInlineEnd: 0, flex: 'auto' }}
        />
        <div className="sider-foot">内容由客户自行对接海外平台，本平台不推送成片。</div>
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingInline: 16, backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--ds-border)' }}>
          {user?.role === 'CLIENT' ? (
            <>
              <Button type="text" icon={<CloudUploadOutlined />} onClick={() => setQueueOpen(true)}>上传队列</Button>
              <Button type="text" icon={<UnorderedListOutlined />} onClick={() => nav('/tasks')}>任务中心</Button>
            </>
          ) : null}
          <Badge count={unread} size="small" offset={[-2, 4]}>
            <Button type="text" icon={<BellOutlined />} onClick={() => nav('/notifications')}>消息</Button>
          </Badge>
          {user?.role === 'CLIENT' ? <Button type="text" icon={<UserOutlined />} onClick={() => nav('/company')}>账户中心</Button> : null}
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
      <Drawer title="上传队列" open={queueOpen} onClose={() => setQueueOpen(false)} width={380}>
        <Typography.Paragraph type="secondary">大于或等于 500MB 的文件，以及文件夹上传，按分片续传。中断后选择原来的文件继续。</Typography.Paragraph>
        {queue.label ? <Typography.Title level={5} style={{ marginTop: 0 }}>{queue.label}</Typography.Title> : <Typography.Text type="secondary">当前没有未完成的分片。</Typography.Text>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {queue.items.map((item) => (
            <div key={item.id} style={{ border: '1px solid var(--ds-border)', borderRadius: 8, padding: 12 }}>
              <div>{item.dramaTitle || '未归属剧目'}{item.episodeNo ? ` · 第 ${item.episodeNo} 集` : ''}</div>
              <div style={{ color: 'var(--ds-text-3)' }}>{item.fileName}</div>
              <div style={{ color: 'var(--ds-text-3)' }}>{item.mode === 'multipart' ? `分片 ${item.completedCount}/${item.partCount}` : '等待上传'}</div>
              <Upload showUploadList={false} beforeUpload={(file) => { void resumeUpload(item, file); return false; }}>
                <Button size="small" style={{ marginTop: 8 }}>继续上传</Button>
              </Upload>
            </div>
          ))}
        </div>
      </Drawer>
    </Layout>
  );
}
