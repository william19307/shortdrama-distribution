import React, { createContext, useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './style.css';
export const ThemeCtx = createContext<{ dark: boolean; setDark: (b: boolean) => void }>({ dark: false, setDark: () => {} });
export const useThemeMode = () => useContext(ThemeCtx);
function Root() {
  const [dark, setDark] = useState(() => localStorage.getItem('ms-theme') === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('ms-theme', dark ? 'dark' : 'light'); }, [dark]);
  return (
    <ThemeCtx.Provider value={{ dark, setDark }}>
      <ConfigProvider locale={zhCN} theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: '#D6153C', colorInfo: '#065FD4', colorLink: '#C8102E', borderRadius: 10, borderRadiusLG: 12, borderRadiusSM: 6,
          fontFamily: 'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif', fontSize: 14,
          colorBgLayout: dark ? '#0f0f0f' : '#ffffff', colorBgContainer: dark ? '#1c1c1c' : '#ffffff', colorBorderSecondary: dark ? '#2a2a2a' : '#ececec',
          colorText: dark ? '#f1f1f1' : '#0f0f0f', colorTextSecondary: dark ? '#aaaaaa' : '#606060', controlHeight: 40 },
        components: { Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' } } }}>
        <AntApp><HashRouter><App /></HashRouter></AntApp>
      </ConfigProvider>
    </ThemeCtx.Provider>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
