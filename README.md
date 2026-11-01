# Pelican Arena

LinuxDO 坛友的同题作答竞技场：出一道生成网页的提示词，大家用不同模型、不同提供方各交一份结果，在画廊里直接看、打分、比较。

## 功能

- **出题**：标题加提示词。需要论坛信任等级 TL2。
- **交答案**：上传单个 HTML、粘贴源码或上传 zip（需包含 `index.html`），从目录选择模型，填写提供方、客户端、增强（不选即 vanilla）与思考强度。需要 TL1。
- **模型目录**：每天从 [models.dev](https://models.dev) 同步主流厂商近两年的对话模型，按发布时间排序；不再接受手填模型名。
- **Session log**：可选上传 Claude Code / Codex CLI 的 JSONL 日志。日志在浏览器里解析，默认只上传 token 和用时统计；勾选后才公开原始日志。
- **画廊**：按模型、提供方、客户端、增强筛选（均可输入搜索），可只看 vanilla；支持 2–4 份答案并排对比。
- **打分**：每人每份答案打 1–5 星，不能给自己打。

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
