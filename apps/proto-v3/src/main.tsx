import React, { createContext, useContext, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import 'dayjs/locale/zh-cn';
import App from './App';
import { Store } from './store';
import './style.css';
export const ThemeCtx = createContext<{ dark: boolean; setDark: (b: boolean) => void }>({ dark: false, setDark: () => {} });
export const useThemeMode = () => useContext(ThemeCtx);
function Root() {
  const [dark, setDark] = useState(false);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  return (
    <ThemeCtx.Provider value={{ dark, setDark }}>
      <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: '#D6153C', colorInfo: '#065FD4', colorLink: '#C8102E', borderRadius: 10, borderRadiusLG: 12, borderRadiusSM: 6,
          fontFamily: 'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif', fontSize: 14,
          colorBgLayout: dark ? '#0f0f0f' : '#f9f9f9', colorBgContainer: dark ? '#1c1c1c' : '#ffffff', colorBorderSecondary: dark ? '#2a2a2a' : '#ececec',
          colorText: dark ? '#f1f1f1' : '#0f0f0f', colorTextSecondary: dark ? '#aaaaaa' : '#606060', boxShadowTertiary: '0 1px 2px rgba(0,0,0,.04),0 2px 8px rgba(0,0,0,.04)', controlHeight: 36 },
        components: {
          Layout: { headerBg: dark ? '#0f0f0f' : '#ffffff', siderBg: dark ? '#0f0f0f' : '#ffffff', bodyBg: dark ? '#0f0f0f' : '#f9f9f9', headerHeight: 56, headerPadding: '0 16px' },
          Menu: { itemBg: 'transparent', itemSelectedBg: dark ? '#272727' : '#f2f2f2', itemSelectedColor: dark ? '#fff' : '#0f0f0f', itemHoverBg: dark ? '#222' : '#f5f5f5', itemBorderRadius: 10, itemHeight: 44, iconSize: 18, groupTitleColor: dark ? '#888' : '#909090' },
          Card: { paddingLG: 24 }, Table: { headerBg: dark ? '#1c1c1c' : '#fafafa', headerColor: dark ? '#aaa' : '#606060', rowHoverBg: dark ? '#242424' : '#fafafa', cellPaddingBlock: 14 },
          Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' }, Tabs: { inkBarColor: dark ? '#fff' : '#0f0f0f', itemSelectedColor: dark ? '#fff' : '#0f0f0f', itemActiveColor: dark ? '#fff' : '#0f0f0f', itemHoverColor: dark ? '#ddd' : '#333' },
          Segmented: { itemSelectedBg: dark ? '#3a3a3a' : '#fff' }, Steps: { dotSize: 10 },
        } }}>
        <AntApp><Store><HashRouter><App /></HashRouter></Store></AntApp>
      </ConfigProvider>
    </ThemeCtx.Provider>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
