# Cinematic Design System（短剧发行 · 营销站 v2 → 营销站 & 后台通用）

| 文件 | 说明 |
|---|---|
| `tokens.ts` | 设计 tokens（TS 对象，源）：颜色深/浅、语义/状态/业务状态色、图表色、字体阶梯、间距栅格、圆角、阴影发光、渐变、动效、密度 |
| `tokens.css` | 同一套 tokens 的 CSS 变量（`--ds-*`），`[data-theme]` 切深浅、`[data-density]` 切密度 |
| `antdTheme.ts` | antd v5 `ThemeConfig` 工厂 `getAntdTheme({mode, density})` + 4 个预设 + `toneToTagColor` |
| `components.css` | 核心组件参考实现（`ds-btn / ds-poster / ds-stat / ds-tile / ds-badge / ds-empty …`） |
| `components.md` | 组件规范 + 后台密度建议 |
| `设计系统.html` | 离线单文件展示页（中英 / 深浅切换，含 antd 实样与紧凑后台示例） |
| `demo/` + `vite.config.ts` | 展示页源码；`npm run build` → `dist/index.html`（复制为 `设计系统.html`） |
| `shot.cjs` / `screenshots/` | Playwright 自查脚本与截图 |

校验：`npm run typecheck`（tsc，antd 5.29.3，strict）。

## 接入 proto-v3（只是说明，本仓库未改动 proto-v3）

### 1. 拷贝或引用文件
最简单：把 `tokens.ts`、`antdTheme.ts`、`tokens.css`（可选 `components.css`）复制到 `proto-v3/src/design-system/`；或在 `vite.config.ts` 配置别名：
```ts
resolve: { alias: { '@ds': path.resolve(__dirname, '../design-system') } }
```
`antdTheme.ts` 仅依赖 `antd`（proto-v3 已有 ^5.29），无其它依赖。

### 2. 引入 CSS 变量
```ts
// src/main.tsx 顶部
import '@ds/tokens.css';
import '@ds/components.css'; // 需要 ds-badge / ds-stat 等时
```

### 3. ConfigProvider 使用 antdTheme（替换 main.tsx 中现有内联 theme）
```tsx
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { getAntdTheme } from '@ds/antdTheme';

function Root() {
  const [dark, setDark] = useState(true);                       // 设计系统默认深色
  const [compact, setCompact] = useState(true);                 // 后台建议默认紧凑
  const mode = dark ? 'dark' : 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = mode;              // 驱动 tokens.css
    document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
  }, [mode, compact]);
  const themeConfig = useMemo(() => getAntdTheme({ mode, density: compact ? 'compact' : 'comfortable' }), [mode, compact]);
  return (
    <ThemeCtx.Provider value={{ dark, setDark }}>
      <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} theme={themeConfig}>
        <AntApp>…</AntApp>
      </ConfigProvider>
    </ThemeCtx.Provider>
  );
}
```
> 注：proto-v3 现有的 `document.documentElement.dataset.theme = …` 写法与 `tokens.css` 选择器兼容，可直接沿用。如需在局部覆盖（例如某个页面强制深色），嵌套一层 `<ConfigProvider theme={getAntdTheme({ mode: 'dark' })}>` 并给容器加 `data-theme="dark"`。

### 4. 深浅切换
```tsx
<Segmented value={mode} onChange={v => setDark(v === 'dark')} options={[{ label: '深色', value: 'dark' }, { label: '浅色', value: 'light' }]} />
```
CSS 中直接写 `color: var(--ds-text); background: var(--ds-surface)` 即可随主题切换；JS 中取 `colors[mode].primary` 等。

### 5. 密度切换
```tsx
<Switch checked={compact} onChange={setCompact} checkedChildren="紧凑" unCheckedChildren="舒适" />
```
`getAntdTheme` 的 compact 会叠加 `theme.compactAlgorithm` 并覆盖 Table/Menu/Card/Button 等尺寸；`data-density="compact"` 同步 `--ds-control-h / --ds-cell-y / --ds-card-pad` 等变量。也可只给某块区域局部紧凑：
```tsx
<div data-density="compact"><ConfigProvider theme={getAntdTheme({ mode, density: 'compact' })}><Table … /></ConfigProvider></div>
```

### 6. 状态徽章 / 数字
```tsx
import { bizStatus } from '@ds/tokens';
import { toneToTagColor } from '@ds/antdTheme';
<Tag bordered={false} color={toneToTagColor[bizStatus.reviewing.tone]}>{bizStatus.reviewing.zh}</Tag>
<span className={`ds-badge ds-badge--${bizStatus.rejected.tone}`}>已驳回</span>
// 数字列
{ dataIndex: 'revenue', align: 'right', render: v => <span className="ds-num">{v.toFixed(2)}</span> }
```

### 7. ECharts（proto-v3 已用 echarts）
```ts
import { chart, colors, font } from '@ds/tokens';
const option = { color: chart.categorical, textStyle: { color: colors[mode].textTertiary, fontFamily: font.family }, … };
```

### 8. framer-motion（营销站）
```tsx
import { motion as m } from '@ds/tokens';
<motion.div {...m.presets.reveal} />
<motion.span transition={{ duration: m.duration.hero, ease: m.ease.out }} />
```

## 迁移注意
- proto-v3 当前浅色默认、`borderRadius 10`、Tabs 墨条为黑白；切到本主题后默认深色、按钮全胶囊、Tabs 墨条为品牌红、Table 卡片底为 `#0E0E11`。建议先在一个页面局部嵌套 ConfigProvider 验证。
- `getAntdTheme` 开启了 `cssVar` 与 `hashed:false`（便于和 `--ds-*` 混用、减小样式体积）；如与项目其它 ConfigProvider 冲突，可在返回值上覆盖 `{ ...getAntdTheme(o), cssVar: undefined, hashed: true }`。
- `colorInfo` 由 proto-v3 的 `#065FD4` 改为 `#4C9AFF / #1A6FE0`；`colorLink` 改为品牌红文字色。
