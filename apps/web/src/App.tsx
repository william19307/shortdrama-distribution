import { ConfigProvider, App as AntApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { getAntdTheme } from '@ds/antdTheme';
import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './auth';
import { useDsTheme } from './theme';
import { Shell } from './shell';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { LibraryPage } from './pages/Library';
import { DramaPage } from './pages/Drama';
import { TicketsPage } from './pages/Tickets';
import { CompanyPage } from './pages/Company';
import { ContractsPage } from './pages/Contracts';
import { SettlementsPage, WithdrawalsPage } from './pages/Money';
import { WorkbenchPage, CompaniesPage, ReviewsPage, SharesPage, DailyPage, WatermarksPage, PlatformsPage, UsersPage, SettingsPage, AuditPage, TasksPage } from './pages/Ops';

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export function AppRoutes() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const { mode, density } = useDsTheme();
  const effective = loc.pathname === '/login' ? 'comfortable' : density;
  const theme = useMemo(() => getAntdTheme({ mode, density: effective }), [mode, effective]);
  useEffect(() => {
    document.documentElement.dataset.density = effective;
  }, [effective]);

  return (
    <ConfigProvider theme={theme} locale={zhCN} button={{ autoInsertSpace: false }}>
      <AntApp>
        <Routes>
          <Route path="/login" element={loading ? <Spin /> : user ? <Navigate to={homeFor(user.role)} replace /> : <LoginPage />} />
          <Route element={<Gate><Shell /></Gate>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dramas" element={<LibraryPage />} />
            <Route path="/dramas/:id" element={<DramaPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketsPage />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/settlements" element={<SettlementsPage />} />
            <Route path="/settlements/:id" element={<SettlementsPage />} />
            <Route path="/withdrawals" element={<WithdrawalsPage />} />
            <Route path="/workbench" element={<WorkbenchPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompaniesPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/reviews/:id" element={<ReviewsPage />} />
            <Route path="/shares" element={<SharesPage />} />
            <Route path="/shares/:id" element={<SharesPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/watermarks" element={<WatermarksPage />} />
            <Route path="/platforms" element={<PlatformsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/tasks" element={<TasksPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
        </Routes>
      </AntApp>
    </ConfigProvider>
  );
}
