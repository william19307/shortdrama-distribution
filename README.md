# 短剧海外发行管理平台

服务短剧版权方的海外发行工作台：申请、审核、分成、每日数据、人民币结算。平台不向 ReelShort 等海外渠道推送成片，也不做转码、翻译或和海外平台的资金清算。

## 演示三步

本机公测用 Docker 一键演示，不部署到公网。需要本机已安装 Docker。`SEED_DEMO` 默认是 `true`（见 `.env.example`），容器启动时会迁移并写入演示账号。

```bash
docker compose up -d --build
```

也可以用 `./start-demo.sh`，它会读 `.env.demo` 再起同一套服务。

浏览器打开 http://localhost:8080 。第一次会构建镜像、迁移数据库并灌入演示数据，需要多等一会儿。只映射网页端口，Postgres 和 MinIO 不对外。密码在 `.env.demo`（脚本会从 `.env.demo.example` 复制）。演示登录密码固定为 `Demo123456`，再次启动不会改掉已经改过的密码。

| 邮箱 | 角色 | 演示里看什么 |
|---|---|---|
| client@xinghe.example | 客户 · 林可 · 星河影业（已认证） | 数据、剧集、申请发行、结算提款、工单 |
| client@qingning.example | 客户 · 周宁 · 青柠文化（认证审核中） | 认证还没过，不能提款 |
| client-b@weiren.example | 客户 · 未仁 · 未仁文化（未认证） | 未认证客户 |
| client-new@example.com | 客户 · 新客户 · 新星短剧（未认证） | 新注册客户 |
| ops@studio.example | 运营 · 林晓 | 只处理自己负责的客户：审核、分成、录金额 |
| ops2@studio.example | 运营 · 王倩 | 另一名专员，默认没有负责客户 |
| ops-manager@studio.example | 运营主管 · 孙悦 | 全部客户。分成复核、分派、扩大抽检、问题行上报 |
| bd@studio.example | 商务 · 陈宇 | 只看负责的星河、青柠。上架结果。看不到结算单、提款单和保底 |
| finance@studio.example | 财务 · 赵倩 | 认证、结算复核、提款、发票、打款、汇率。没有合同、视频库和分成菜单 |
| admin@studio.example | 管理员 · 周岚 | 能打开全部运营页面，业务按钮只读。可改员工角色、汇率、提款门槛、结算周期、同步日期 |

## 公测启动说明

按下面顺序点一遍，就能走完客户 → 运营 → 财务。

1. 用 `client@xinghe.example` 登录。左侧是「数据详情 / 视频存储库 / 合同申请及列表」。右上角有上传队列、任务中心、消息铃铛和账户中心。数据总览能看到播放和在架平台；昨天的数还没复核时会显示「数据更新中」。打开视频存储库里的《神医下山》，状态是需要修改。分集、封面、授权书可以上传，页面上有进度，失败后点「重试」。申请发行时首发五家平台不能删，二轮可以手填平台。
2. 「结算与提款」里看人民币金额。未达最低提款额的单子不能单独申请。账户中心可以看认证和收款账户。工单里有审核意见和防伪截图。
3. 退出，用 `ops@studio.example` 登录。工作台是林晓负责的客户。审核队列按抽检处理，驳回后客户替换再提交。分成里填写保底，这一栏客户和商务的接口都不会返回。每日数据手工录入，关联水印后再由别人复核。
4. 结算单页填写周期，点「按这个周期批量生成」（这个周期要已有复核过的每日数据），或指定一个客户生成一张。录入应结金额的人不能自己复核。
5. 用 `ops-manager@studio.example` 复核分成，用 `finance@studio.example` 复核应结金额。财务继续做提款核对、发票驳回或通过、上传回单打款。录入人不能复核自己的日报或结算金额。主管还可以分派审核、扩大抽检、把问题行标成异常。
6. 用 `bd@studio.example` 登录。菜单里没有结算和提款。只能看到分派给自己的星河、青柠。打开发行计划时看不到保底金额。

已知限制，公测演示接受、不要当成故障：

- 不向海外平台推送成片，不做转码、翻译、邮件、短信、电子签、子账号。
- 没有 Excel 一键导入、文件夹自动匹配、保存视图。
- 结算金额是人手填写的人民币，系统不算结转。到周期不会自动出单，用页面上的批量生成。
- 上传失败可以重试已确认的分片，没有单独的断点续传队列。
- 演示数据在容器卷里。`docker compose -f docker-compose.demo.yml --env-file .env.demo down -v` 会清掉数据。
- 对象存储是容器内的 MinIO，浏览器经网页反代把文件交给 API，不把 9000 端口暴露出来。

## 本地开发

开发时仍可只用 Docker 起数据库，网页和 API 在本机跑。这和上面的全容器演示是两条路。

## 本地启动

需要 Node.js 20+、pnpm 10、Docker（Postgres 与 MinIO）。

```bash
docker compose up -d postgres minio minio-init
cp .env.example .env          # 已有 .env 时跳过；pnpm dev 也会自动复制
pnpm install
pnpm dev                      # 迁移、种子、API :3000、网页 :5173
```

只想分开启动时：

```bash
docker compose up -d postgres minio minio-init
pnpm db:setup                 # 同步 .env、编译 shared、prisma generate、migrate、seed
pnpm dev:api                  # http://localhost:3000/api/health
pnpm dev:web                  # http://localhost:5173
```

没有 Docker 时，把 `.env` 里的 `DATABASE_URL` 指到本机 Postgres 16，并执行 `CREATE EXTENSION pg_trgm;`。对象存储可临时改成 `STORAGE_DRIVER=memory`（进程内存，重启即丢，只适合开发）。正式本地存储用 MinIO：控制台 http://localhost:9001 ，账号 `minio` / `minio123456`，桶名 `shortform`。

网页通过 Vite 把 `/api` 代理到 `VITE_API_PROXY`（默认 `http://localhost:3000`）。API 的 CORS 允许 `WEB_ORIGIN`。

本地走查时打开：

| 地址 | 用途 |
|---|---|
| http://localhost:5173 | 网页。`pnpm dev` 或 `pnpm dev:web` |
| http://localhost:3000 | API |
| http://localhost:3000/api/health | 健康检查，返回正常即可登录 |

`.env.example` 里 `SEED_DEMO=true`。Docker 一键启动不另设时也按 true 写演示种子。`pnpm db:setup` / `pnpm dev` 同样会带上。已有账号的密码不会被重置。要空库可设 `SEED_DEMO=false`。

### 演示账号

密码都是 `Demo123456`。登录页在开发环境会列出这些账号，点一下即可填入。

| 邮箱 | 角色 | 走查时看什么 |
|---|---|---|
| client@xinghe.example | 客户 · 林可 · 星河影业（已认证，运营林晓、商务陈宇） | 数据总览、我的剧集、合同、结算提款 |
| client@qingning.example | 客户 · 周宁 · 青柠文化（认证审核中） | 不能提款 |
| client-b@weiren.example | 客户 · 未仁 · 未仁文化（未认证） | 未认证 |
| client-new@example.com | 客户 · 新客户 · 新星短剧（未认证） | 新客户 |
| ops@studio.example | 运营专员 · 林晓 | 只处理负责客户 |
| ops2@studio.example | 运营专员 · 王倩 | 另一名专员 |
| ops-manager@studio.example | 运营主管 · 孙悦 | 分成复核、审核分派、扩大抽检、问题行上报、汇率 |
| bd@studio.example | 商务 · 陈宇 | 只看负责的星河和青柠，没有结算和保底 |
| finance@studio.example | 财务 · 赵倩 | 客户认证、结算复核、提款发票打款、汇率 |
| admin@studio.example | 管理员 · 周岚 | 页面都可见。合同、审核、分成、数据录入返回 403。可改账号角色、汇率、提款门槛、结算周期、同步日期 |

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
docker-compose.yml  开发用 Postgres 16、MinIO
docker-compose.demo.yml  本机全容器演示（网页 + API + 数据库 + MinIO）
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

- 注册登录，角色：客户、运营、运营主管、商务、财务、管理员。运营只处理自己负责的客户，主管看全部客户。商务不能看结算单、提款单和保底。
- 企业认证（含主体变更审核期间冻结提款）、收款账户。户名在已认证后必须与企业名一致。
- 剧目、封面、分集、授权书、版权证明。分集走预签名直传；超过 8MB 且存储为 S3 时分片。浏览器显示进度，失败可重试并跳过已确认分片。`UPLOAD_VIA_API=true` 时改为经 API 写入存储，方便只开放网页端口。列表服务端分页、筛选，剧名有 `pg_trgm` 索引。
- 发行计划。首发固定为当前启用的 ReelShort、DramaBox、ShortMax、FlexTV、GoodShort，客户不能删。二轮可选手填平台。
- 抽检审核（8 集及以内全审，否则头尾加中间样本）、驳回、替换、重提。二轮且成片都已通过则跳过审核。
- 按平台配置保底、超保底、无保底。客户和商务看到的分成、结算明细按字段白名单返回，保底金额和结转说明不会出现。结转只记在项目策略上，不参与计算。分成由运营主管或管理员复核，提交人不能复核自己提交的。
- 每日数据手工录入，字段对齐调研文档的 32 项。日期与平台口径不一致时给出提示，不阻断。
- 截图加水印（暗纹 + 上海时间明文 + 原图短哈希），匹配成功后进入工单。
- 数据看板、合同申请与列表。合同状态只能按申请中 → 起草中 → 待签署 → 客户或代传扫描件进入待确认 → 运营确认后生效 → 已到期。不能直接改成已生效。扫描件必须已在存储中，且属于该客户。商务只能改自己负责的客户。
- 发行申请前，授权书或版权证明必须已审核通过。
- 商务只看 `bdId` 指向自己的客户。财务菜单限于认证、结算、提款和汇率。
- 结算单由运营手工填写人民币应结金额，也可按周期批量生成。录入人不能复核。不足最低提款额为「未达起提额」，合计达标后可合并申请。提款必须带幂等键，并发时只锁仍为「待申请」的结算单，后续核对、发票、打款在同一事务里推进。发票人工审核，驳回后可重传。打款上传回单。

## 还没做

这些留在后续，不在本次本地 MVP 里：

- 报表 Excel 一键导入、字段映射和别名模糊匹配
- 元数据 Excel、文件夹与剧集自动匹配
- 浏览器里的持久上传队列（失败可以重试，不保留跨页面的队列）
- ffprobe 成片探测
- Redis、Worker、消息队列
- 到结算周期自动生成结算单（页面上可以按周期手动批量生成，周期本身可配置）
- 汇率外部抓取（现在手工录入）
- 邮件、短信、手机号登录、OCR
- 子账号、电子签
- 回收站和 10 秒撤销、保存视图、拖拽分组
- 审核超时推送（有预计完成时间和工作台超期计数）
- 按月分区、深分页 keyset
- 公网部署。本机演示用 `./start-demo.sh`。换成真实 COS 之后再配生产密钥和域名

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
