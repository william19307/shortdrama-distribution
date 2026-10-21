# 核心组件规范 · Cinematic DS

> 参考实现：`components.css`（类名前缀 `ds-`），tokens 来自 `tokens.css` / `tokens.ts`。实样见 `设计系统.html`。
> 原则：**黑底是舞台，红色只给主行动**；大字号配负字距；动效统一 `ease-out [.22,1,.36,1]`。

## 1. 按钮 Button
| 变体 | 类名 / antd | 用途 | 规格 |
|---|---|---|---|
| Primary | `.ds-btn--primary` / `type="primary"` | 每屏最多 1 个主行动 | 高 52（营销）/ 40（后台）/ 30（紧凑），全胶囊，`--ds-glow` 红色投影，hover 上移 2px + `#E8204A` |
| Ghost | `.ds-btn--ghost` / `default` | 次要行动 | 半透明白底 + 1px `--ds-border-strong`，`backdrop-filter: blur(20px)` |
| Text | `.ds-btn--text` / `type="text"` | 表格行内操作、“查看 →” | 无底，hover 变 `--ds-text` |
| Danger | antd `danger` | 驳回 / 删除 | 描边，不使用发光 |
- 尺寸：`--sm` 36 / `--xs` 28；图标与文字间距 10；箭头 `.arr` hover 右移 4px。
- 焦点：`box-shadow: 0 0 0 3px var(--ds-focus-ring)`；禁用 `opacity:.4`，去掉阴影与位移。
- 紧凑密度下主按钮**去掉发光**（`antdTheme` 已处理），避免表格里红光堆叠。

## 2. 海报卡 / 封面卡 Poster & Cover
- 比例固定 **2:3**，圆角 `--ds-radius-sm`(8)，背景为作品主色渐变或封面图。
- hover/focus：`scale(1.08)`（营销站行内 1.12）+ `--ds-shadow-lg`，底部信息层 `linear-gradient(#0000,#000e 40%)` 淡入上移 10px，时长 `--ds-dur-slow` 450ms。
- 左上角可放状态徽章，徽章在海报上一律用深色半透明底（保证浅色主题下可读）。
- **封面卡 `.ds-cover`**（表格/列表）：44px 宽缩略图 + 标题(600) + 次级 ID（`tabular-nums`）；紧凑密度缩到 30px，隐藏海报内文字。
- 必须可键盘聚焦（`tabIndex=0`），`aria-label` 为作品名。

## 3. 数据大数字卡 Stat
- 结构：标签（13/600/`--ds-text-3`）→ 数值 → 涨跌胶囊。
- 数值：营销 56–104px、800、`letter-spacing:-.06em`，`--ds-grad-text-stat` 竖向渐变文字；后台 30px、`-.035em`。
- **一律 `font-variant-numeric: tabular-nums`**；单位（B / K / %）缩至 0.45em 贴在数值后。
- 涨跌：`▲ +18.2%` 用 success-soft，`▼` 用 error-soft；只表达方向，不做红绿以外的强调。
- 营销站可用 framer-motion `animate(0, v, {duration: 2.2, ease})` 计数；后台禁用计数动画。

## 4. Bento 卡片
- 6 栏网格，`grid-auto-rows: 240–300px`，gap 16；跨度组合 3×2 / 3×1 / 2×1 / 6×1。
- 卡：`--ds-radius-xxl`(28)、`--ds-grad-bento`、1px `--ds-border`，hover 边框变 `--ds-border-strong`。
- 内容：eyebrow 小标(13/600 灰) → 标题 H3(26/-.035em, max-width 340) → 视觉区（`flex:1`）。
- 视觉区元素：红色核心块 + `--ds-glow-strong`、胶囊 chips、对账行（等宽数字）、渐变柱 `--ds-grad-bar`。
- 进场：`opacity 0 → 1, y 40 → 0, scale .98 → 1`，按序 stagger 40–60ms。

## 5. 状态徽章 Status Badge
| 业务状态 | key | tone | 视觉 |
|---|---|---|---|
| 草稿 | draft | neutral | 灰 |
| 审核中 | reviewing | warning | 琥珀，圆点呼吸 1.6s |
| 已通过 | approved | success | 绿 |
| 已驳回 | rejected | error | 红粉（`#FF4D6D`，区别于品牌红） |
| 待结算 | pendingSettle | info | 蓝 |
| 已结算 | settled | brand | 品牌红 soft |
| 上线中 | live | success | 绿 |
| 已下架 | offline | neutral | 灰 |
- 形态：24px 高胶囊、12/600、前置 6px 圆点、soft 背景 + 实色文字，无描边。
- antd 场景：`<Tag bordered={false} color={toneToTagColor[bizStatus[s].tone]}>`；映射与文案见 `tokens.bizStatus`。
- 状态色永远配文字，不单靠颜色传达（色弱友好）。

## 6. 图表配色 Chart
- 分类色 `chart.categorical`：`#D6153C` 领衔 → `#FF7B95` → `#4C9AFF` → `#46D369` → `#F5A524` → `#A78BFA` → `#2DD4BF` → `#86868B`。系列 ≤ 5 时只取前 5。
- 单系列/热力：`chart.sequential`（红色透明度阶梯）；对比：`chart.diverging` 蓝-灰-红。
- 网格线 `chart.grid[mode]`（深 8% 白 / 浅 6% 黑），坐标轴文字 `--ds-text-3` 12px，tooltip 用 `--ds-surface-2` + `--ds-shadow-md`。
- 柱：顶部圆角 4–8，可用 `--ds-grad-bar` 渐隐；环图内径 ≥ 60%。ECharts 示例：
```ts
import { chart, colors } from './tokens';
const c = colors[mode];
option = { color: chart.categorical, textStyle: { color: c.textTertiary, fontFamily: font.family },
  splitLine: { lineStyle: { color: chart.grid[mode] } }, tooltip: { backgroundColor: c.surface2, borderColor: c.border, textStyle: { color: c.text } } };
```

## 7. 空状态 Empty
- 虚线容器（1px dashed `--ds-border-strong`，圆角 24）+ 72px 图标块（primary-soft 底、`--ds-glow-strong`）+ 标题 18 + 说明 14 灰（≤ 320px）+ 一个 `sm` 主按钮。
- 文案：说明“为什么空”+“下一步做什么”。表格内空态用 antd `Empty.PRESENTED_IMAGE_SIMPLE`，不加发光。

## 8. 后台密度建议（`density: 'compact'` / `data-density="compact"`）
| 项 | 舒适 comfortable | 紧凑 compact |
|---|---|---|
| 控件高度 | 40 | 30（SM 24 / LG 36） |
| 正文字号 | 14 | 13（表头 12、辅助 12） |
| 表格单元格 padding | 16 / 16 | 8 / 12 |
| 卡片 padding | 24–28 | 16 |
| 卡片圆角 | 24 | 14 |
| 大数字 | 56+ | 30 |
| Menu 行高 | 42 | 34 |
- **表格可读性**：行 hover 用 4% 白/2.5% 黑；选中行用 primary-soft；表头无竖分隔、`--ds-text-3` 灰；不用斑马纹（深色下噪声大）；行内操作用 text 按钮，主操作最多一个。
- **数字**：所有金额/播放量/ID 用 `.ds-num`（`tabular-nums`）并**右对齐**；金额可用 `--ds-font-mono` 并固定 2 位小数；空值显示 `—`。
- 标题层级：页面标题 20/700/-.02em，区块标题 14–16/600；去掉营销站的超大 display 与发光。
- 动效：后台只保留 ≤ 300ms 的状态过渡；禁用进场 reveal、数字滚动。
- 长表：固定表头（`sticky`）、列宽给数字列留足、超长文本省略 + Tooltip。
