# 短剧海外发行管理平台

服务短剧版权方的海外发行工作台：申请、审核、分成、每日数据、人民币结算。平台不向 ReelShort 等海外渠道推送成片，也不做转码、翻译或和海外平台的资金清算。

当前是可本地运行的 MVP，按 `docs/prd/短剧海外发行管理平台-PRD-v0.5.md` 实现。交互参照 `apps/proto-v3`，颜色、圆角、密度和 antd 主题从 `apps/design-system` 读取（`getAntdTheme`）。后台用 compact，客户端用 comfortable。设计系统以后更换图标、动效或思源字体时，改设计系统即可，业务页不写死这些值。

## 本地启动

需要 Node.js 20+、pnpm 10、Docker（Postgres 与 MinIO）。

```bash
docker compose up -d
cp .env.example .env          # 已有 .env 时跳过；pnpm dev 也会自动复制
pnpm install
pnpm dev                      # 迁移、种子、API :3000、网页 :5173
```

只想分开启动时：

```bash
docker compose up -d
pnpm db:setup                 # 同步 .env、编译 shared、prisma generate、migrate、seed
pnpm dev:api                  # http://localhost:3000/api/health
pnpm dev:web                  # http://localhost:5173
```

没有 Docker 时，把 `.env` 里的 `DATABASE_URL` 指到本机 Postgres 16，并执行 `CREATE EXTENSION pg_trgm;`。对象存储可临时改成 `STORAGE_DRIVER=memory`（进程内存，重启即丢，只适合开发）。正式本地存储用 MinIO：控制台 http://localhost:9001 ，账号 `minio` / `minio123456`，桶名 `shortform`。

网页通过 Vite 把 `/api` 代理到 `VITE_API_PROXY`（默认 `http://localhost:3000`）。API 的 CORS 允许 `WEB_ORIGIN`。

### 演示账号

密码都是 `Demo123456`。

| 邮箱 | 角色 |
|---|---|
| client@xinghe.example | 客户 · 星河影业（已认证，负责人林晓） |
| client@qingning.example | 客户 · 青柠文化（认证审核中） |
| ops@studio.example | 运营 · 林晓 |
| bd@studio.example | 商务 · 陈宇 |
| finance@studio.example | 财务 · 赵倩 |
| admin@studio.example | 管理员 · 周岚 |

开发环境下登录页会列出这些账号。

### 检查

```bash
pnpm typecheck
pnpm test          # API 集成测试，使用库 shortform_test 与内存存储
```

测试库需要事先建好：`CREATE DATABASE shortform_test;` 并且 `CREATE EXTENSION pg_trgm;`。`pnpm test` 会对该库执行 `prisma migrate deploy`。

## 仓库结构

```
apps/web          客户与后台（React + TypeScript + Vite + antd）
apps/api          NestJS + Prisma
packages/shared   枚举、中文文案、zod 校验
docker-compose.yml  Postgres 16、MinIO
docs/prd          需求，以 v0.5 为准
docs/research     32 字段日报模板与截图口径
apps/proto-v3     交互原型（不接这套 API）
apps/marketing-site
apps/design-system
```

## 环境变量

全部在 `.env.example`。服务器和云厂商都还没定，不要把密钥写进代码。

| 变量 | 作用 |
|---|---|
| `DATABASE_URL` | Postgres |
| `PORT` / `WEB_ORIGIN` / `JWT_SECRET` | API 端口、网页来源、登录令牌 |
| `STORAGE_DRIVER` | `s3` 或 `memory` |
| `S3_ENDPOINT` `S3_REGION` `S3_BUCKET` `S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_FORCE_PATH_STYLE` | MinIO 或腾讯云 COS。COS 一般关闭 path style，endpoint 用 `https://cos.<region>.myqcloud.com` |

存储走 `StorageService`：预签名直传、分片、读取和水印图都通过这个接口。换成 COS 只改环境变量。

业务参数不写死在代码里：最低提款额（默认 10000 元）、金额偏差提示、每日数据截止时间，在管理端「全局参数」。平台「昨天 / 前天」在平台名单里配置。结算周期在客户或项目策略上配置。

## 已实现

- 注册登录，角色：客户、运营、商务、财务、管理员。运营只处理自己负责的客户。
- 企业认证（含主体变更审核期间冻结提款）、收款账户。户名在已认证后必须与企业名一致。
- 剧目、封面、分集、授权书、版权证明。分集走预签名直传；超过 8MB 且存储为 S3 时分片。列表服务端分页、筛选，剧名有 `pg_trgm` 索引。
- 发行计划。首发固定为当前启用的 ReelShort、DramaBox、ShortMax、FlexTV、GoodShort，客户不能删。二轮可选手填平台。
- 抽检审核（8 集及以内全审，否则头尾加中间样本）、驳回、替换、重提。二轮且成片都已通过则跳过审核。
- 按平台配置保底、超保底、无保底。保底金额和结转说明对客户的接口响应会去掉，不只是页面上隐藏。结转只记在项目策略上，不参与计算。
- 每日数据手工录入，字段对齐调研文档的 32 项。日期与平台口径不一致时给出提示，不阻断。
- 截图加水印（暗纹 + 上海时间明文 + 原图短哈希），匹配成功后进入工单。
- 数据看板、合同申请与列表。
- 结算单由运营手工填写人民币应结金额，录入人不能复核。不足最低提款额为「未达起提额」，合计达标后可合并申请。发票人工审核，驳回后可重传。打款上传回单。

## 还没做

这些留在后续，不在本次本地 MVP 里：

- 报表 Excel 一键导入、字段映射和别名模糊匹配
- 元数据 Excel、文件夹与剧集自动匹配
- 浏览器里的断点续传队列（服务端已有分片和 7 天上传会话）
- ffprobe 成片探测
- Redis、Worker、消息队列
- 到结算周期自动生成结算单（现在是手工生成，周期本身可配置）
- 汇率外部抓取（现在手工录入）
- 邮件、短信、手机号登录、OCR
- 子账号、电子签
- 回收站和 10 秒撤销、保存视图、拖拽分组
- 审核超时推送（有预计完成时间和工作台超期计数）
- 按月分区、深分页 keyset
- 部署，以及换成真实 COS 之后的生产配置

## 待接入的外部服务

| 服务 | 现在 | 以后 |
|---|---|---|
| Postgres | Docker 或本机 | 云数据库，仍用 `DATABASE_URL` |
| 对象存储 | MinIO | 腾讯云 COS，改 `S3_*` |
| 汇率 | 手工 | 外部牌价 |
| 邮件 / 短信 | 无 | 认证、工单、结算通知 |
| 电子签 / OCR | 无 | 合同与证照 |
| 成片探测 | 无 | ffprobe |
| 队列 | 导出记一条已完成任务 | Redis / 队列 Worker |
| 海外平台接口 | 不推送、不拉取 | 明确不做内容推送；报表导入另做 |

## 原型、营销站、设计系统

这三套是需求阶段的前端，不进 pnpm workspace，避免和产品的依赖锁冲突。单文件 HTML 可直接用浏览器打开：

| 文件 | 内容 |
|---|---|
| `apps/proto-v3/短剧发行平台原型-v3.html` | 交互原型当前稿 |
| `apps/proto-v3/短剧发行平台原型-第一稿.html` | 交互原型第一稿 |
| `apps/marketing-site/营销站.html` | 营销站 v1 |
| `apps/marketing-site/营销站-v2.html` | 营销站 v2 |
| `apps/design-system/设计系统.html` | 设计系统展示页 |

源码开发：

```bash
cd apps/proto-v3 && npm install && npm run dev
cd apps/marketing-site && npm install && npm run dev
cd apps/design-system && npm install && npm run dev
```

`docs/prd/` 以 v0.5 为准。更早版本只作对照。
