# Pelican Arena

[L站](https://linux.do/)的娱乐性模型竞技场。

## 功能

- **出题**：标题加提示词，格式可选 html / 文本 / svg。需要论坛信任等级 TL2。
- **交答案**：上传答案，选择模型、提供方和其他元数据。需要 TL1。
- **模型目录**：每天从 [models.dev](https://models.dev) 同步主流厂商模型，按发布时间排序；目录外的模型也可以直接填写。
- **Session log**：可选解析 Harness 的 JSONL 日志，记录 token 和用时统计。
- **打分**：为答案评分，查看模型排名（*纯娱乐）。

## 反馈

欢迎 issue 反馈问题与建议。

## 本地开发

需要 Node 22+。

```bash
npm install
cp .dev.vars.example .dev.vars   # 填 SESSION_SECRET；没有 OAuth 凭据时会启用开发登录
npm run db:migrate               # 建本地 D1 并写入初始目录
npm run catalog:sync -- --local  # 可选：按 models.dev 最新数据补跑一次同步
npm run dev
```

开发时用两个主机名区分主站和答案站：在 `.dev.vars` 里设置 `APP_ORIGIN=http://localhost:<port>`、`USERCONTENT_ORIGIN=http://127.0.0.1:<port>`，打开 `localhost` 访问主站。

测试与类型检查：

```bash
npm test
npm run typecheck
```

## 部署到 Cloudflare

1. 创建资源，把返回的 `database_id` 填进 `wrangler.jsonc`：
   ```bash
   npx wrangler d1 create pelican-arena --location apac
   npx wrangler r2 bucket create pelican-arena-files
   ```
2. 准备两个域名：一个做主站，另一个**可注册域名**（不是主站的子域名）放用户上传的页面。两个域名都绑定到这个 Worker（Custom Domains）。
3. 在 `wrangler.jsonc` 的 `vars` 里设置 `APP_ORIGIN`、`USERCONTENT_ORIGIN`、`LINUXDO_CLIENT_ID`，以及可选的 `ADMIN_USERNAMES`（逗号分隔的论坛用户名）。
4. 在 [connect.linux.do](https://connect.linux.do) 申请接入，回调地址填 `<APP_ORIGIN>/auth/callback`，然后写入密钥：
   ```bash
   npx wrangler secret put LINUXDO_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   ```
5. 迁移数据库并部署：
   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```
   Worker 部署后每天 03:17 UTC 自动同步模型目录；需要立即更新时运行 `npm run catalog:sync -- --remote`。

## 许可

MIT
