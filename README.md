# 短剧海外发行管理平台

服务短剧版权方（客户）的海外发行平台：**申请、审核、分成、数据、结算** 一站式管理。本仓库目前包含产品文档，以及三套可独立运行的前端（Vite + React + TypeScript）：运营/客户交互原型、营销站、设计系统（设计令牌与 Ant Design 主题）。

示例数据仅用于演示，不连接真实后端。

## 目录结构

```
docs/
  prd/                 产品需求文档（多版本，最新为 v0.5）
  research/            海外短剧平台版权合作调研
  reviews/             原型体验走查与修复对照
apps/
  proto-v3/            管理端 / 客户端交互原型（Vite + React + TS + antd）
  marketing-site/      营销站（Vite + React；含 v1 与 v2）
  design-system/       设计令牌、CSS 变量、antd 主题与组件展示页
```

可直接分享的单文件 HTML（脚本与样式已打进一个文件，不依赖 `node_modules`）放在各应用目录下，不在 `dist/` 里：

| 文件 | 内容 |
|---|---|
| `apps/proto-v3/短剧发行平台原型-v3.html` | 交互原型当前稿 |
| `apps/proto-v3/短剧发行平台原型-第一稿.html` | 交互原型第一稿 |
| `apps/marketing-site/营销站.html` | 营销站 v1 |
| `apps/marketing-site/营销站-v2.html` | 营销站 v2 |
| `apps/design-system/设计系统.html` | 设计系统展示页 |

`apps/proto-v3/shots/` 为走查截图。`dist/`、`dist-v2/` 与 `node_modules/` 为本地构建产物，已在根目录 `.gitignore` 中忽略。

## 打开预构建 HTML

用浏览器直接打开上述 `.html` 即可，无需安装依赖、无需启动开发服务器。路由使用 Hash，本地 `file://` 打开可用。

示例：

```bash
# macOS
open "apps/proto-v3/短剧发行平台原型-v3.html"

# Linux
xdg-open "apps/proto-v3/短剧发行平台原型-v3.html"
```

也可以把文件拖进浏览器窗口，或把路径发给同事离线查看。

## 本地运行

需要 Node.js 18+（本仓库用 Node 22 验证过）。在对应应用目录执行安装、开发与构建。`npm run build` 会输出到该应用的 `dist/`（营销站 v2 为 `dist-v2/`），**不会覆盖**上面的单文件 HTML。

### 交互原型 `apps/proto-v3`

```bash
cd apps/proto-v3
npm install
npm run dev      # 默认 http://localhost:5173
npm run build
```

### 营销站 `apps/marketing-site`

v1（`index.html` + `src/`）：

```bash
cd apps/marketing-site
npm install
npm run dev
npm run build
```

v2（`v2/`，配置为 `vite.v2.config.ts`）：

```bash
cd apps/marketing-site
npm run dev -- --config vite.v2.config.ts
npm run build -- --config vite.v2.config.ts
```

### 设计系统 `apps/design-system`

令牌源文件是 `tokens.ts` / `tokens.css`，antd 主题工厂是 `antdTheme.ts`。展示页源码在 `demo/`。

```bash
cd apps/design-system
npm install
npm run dev
npm run build
npm run typecheck
```

三个应用的 `devDependencies` 都包含 Playwright（截图脚本 `shot.cjs`）。只做页面构建时，可以在安装前设置 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，跳过浏览器二进制下载。

## PRD 版本

`docs/prd/` 保留需求演进过程，**以 v0.5 为准**：

| 文件 | 说明 |
|---|---|
| `短剧海外发行管理平台-PRD.md` | 初稿（文内标为 v1.0；v0.5 变更记录中记为 v0.1，首版误标） |
| `短剧海外发行管理平台-PRD-v0.2.md` | v0.2 |
| `短剧海外发行管理平台-PRD-v0.3.md` | v0.3 |
| `短剧海外发行管理平台-PRD-v0.4.md` | v0.4 |
| `短剧海外发行管理平台-PRD-v0.5.md` | **当前最新（2026-10-21）** |

v0.5 相对前序版本的重点是规模化：按数百客户、单客户数百部剧、平台总量数千部剧 / 数十万集重审流程，补齐批量上传与发行、审核队列与抽检、报表导入、结算批量处理、异步任务中心，并新增第 6 章「用户端设计原则」。文中 **【已定】** 为业务已拍板，**【暂按默认】** 为沿用默认假设，**【待定】** 仍需拍板。更早版本仅作对照，开发与原型以 v0.5 为准。
