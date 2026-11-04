# 缩略图渲染服务

跑在腾讯云轻量（4C4G）上的无头 Chrome 渲染器，用来替代 Cloudflare Browser Run 的免费额度（10 分钟/天）。Worker 侧只调它，不再回退 Browser Run。

## 接口

```
POST /render
Authorization: Bearer <RENDER_TOKEN>
Content-Type: application/json

{"url": "https://pelicanarena.elsewhere.dpdns.org/<id>/index.html"}
→ image/webp 1200×630
```

- 只接受 `ALLOWED_HOST`（默认 `pelicanarena.elsewhere.dpdns.org`）的 https 地址，避免被当成 SSRF 跳板。
- 队列并发默认 2，浏览器常驻（首次请求冷启动）。每次先 `domcontentloaded`，然后反复截图直到画面不再接近空白（WebGL 画布无法从 JS 探针，空白帧只有几 KB）；普通页面约 3–5 秒，重资源 WebGL 页面 15–20 秒。
- `GET /health` 返回当前并发与排队数。

## 部署

```bash
sudo mkdir -p /opt/pelican-render && sudo chown ubuntu:ubuntu /opt/pelican-render
cd /opt/pelican-render
npm init -y && npm i puppeteer-core@24
# 把 server.mjs 拷到 /opt/pelican-render/server.js
```

`/etc/pelican-render.env`（600）：

```
RENDER_TOKEN=<32 字节随机 hex>
PORT=8790
CONCURRENCY=2
SETTLE_MS=700
NAV_TIMEOUT=10000
PAINT_TIMEOUT=12000
MIN_BYTES=6000
```

systemd 单元 `pelican-render.service`：

```ini
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/pelican-render
EnvironmentFile=/etc/pelican-render.env
ExecStart=/usr/bin/node /opt/pelican-render/server.js
Restart=always
MemoryMax=2500M
```

依赖系统自带的 `google-chrome`（Ubuntu 24.04 上已安装）。

`/etc/pelican-render.env` 里再加 `PROXY_SERVER=http://127.0.0.1:7891`，让 Chrome 的所有请求都先经过本机 mihomo。mihomo 自己按规则分流：只有 jsdelivr / unpkg / cdnjs / github / google / gstatic 这类被墙或跨境很慢的域名走代理，其余（包括答案站本身）直连。订阅源与节点不进仓库，只写在 `/opt/mihomo/config.yaml`。

## 对外暴露

用 Cloudflare Tunnel（`cloudflared-pelican.service`）把 `127.0.0.1:8790` 发布为 `render.johnnren.qzz.io`，不开公网端口。隧道走 HTTP/2（大陆 UDP 常被限速，QUIC 会不停重连）：

```
cloudflared tunnel --no-autoupdate --protocol http2 run --token <tunnel-token>
```

## Worker 侧

`wrangler.jsonc` 的 `RENDER_ORIGIN` + secret `RENDER_TOKEN`；`app/lib/screenshot.server.ts` 的 `ensureThumbnail()` 只走这里（失败重试一次后放弃，不再回退 Cloudflare Browser Run）。
