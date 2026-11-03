#!/usr/bin/env node
// 给本地 D1 与本地 R2 灌入演示数据：用户、题目、答案、评分。
//
//   rrun node scripts/seed-dev.mjs
//
// 数据 id 固定（seedprompt*/seedsub*/9900x 用户），重复执行会先清掉旧的种子行，
// 不会碰真实内容。答案文件同时写进本地 R2，路径与线上一致：s/<submissionId>/<path>。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WRANGLER = path.resolve("node_modules/.bin/wrangler");
const DATABASE = "pelican-arena-apac";
const BUCKET = "pelican-arena-files";
const PERSIST = path.resolve(".wrangler/state");
const WORK_DIR = path.join(os.tmpdir(), "pelican-seed");
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const args = new Set(process.argv.slice(2));
const skipR2 = args.has("--skip-r2");

// ---------------------------------------------------------------- 数据定义

const USERS = [
  { id: 99001, username: "JohnnRen", name: "Johnn", trustLevel: 4, role: "admin" },
  { id: 99002, username: "lin_apple", name: "林檎", trustLevel: 3, role: "user" },
  { id: 99003, username: "grey_pigeon", name: "灰鸽子", trustLevel: 2, role: "user" },
  { id: 99004, username: "momo_2049", name: "momo", trustLevel: 2, role: "user" },
  { id: 99005, username: "alan_w", name: "阿岚", trustLevel: 1, role: "user" },
];

const PROMPTS = [
  {
    id: "seedprompt01",
    kind: "web",
    title: "做一张会呼吸的极简着陆页",
    body: "为一个只做一件事的阅读产品做首页：首屏一句话说明它是什么，主体留白，品牌标记带轻微呼吸动画。只用单个 HTML，不要外链资源。",
    authorId: 99002,
    ageDays: 9,
  },
  {
    id: "seedprompt02",
    kind: "web",
    title: "用 Canvas 做一个可交互的粒子星系",
    body: "整页一个 canvas，粒子围绕中心缓慢旋转，鼠标靠近时被牵引。三年内机型也要能跑满 60 帧，不要引入第三方库。",
    authorId: 99003,
    ageDays: 8,
  },
  {
    id: "seedprompt03",
    kind: "web",
    title: "把一句话做成排版海报",
    body: "以「真正重要的东西，用眼睛是看不见的」为文案，做一张可以在浏览器里直接看的海报页。字号、留白、行距要经得起近看。",
    authorId: 99002,
    ageDays: 7,
  },
  {
    id: "seedprompt04",
    kind: "markdown",
    title: "解释 React Server Components 的序列化边界",
    body: "面向用过 Next.js 但没读过 Flight 协议的开发者，讲清楚服务端组件传给客户端的是什么、哪些值能过边界、哪些不能，配上最小代码。",
    authorId: 99004,
    ageDays: 6,
  },
  {
    id: "seedprompt05",
    kind: "markdown",
    title: "写一份 D1 + Drizzle 的团队上手文档",
    body: "假设读者第一次在 Cloudflare Workers 上用 D1，覆盖建库、schema、迁移、本地与远端两条链路。要能照着做通。",
    allowSearch: true,
    authorId: 99002,
    ageDays: 5,
  },
  {
    id: "seedprompt06",
    kind: "markdown",
    title: "单测与 E2E 的适用边界",
    body: "团队里有人什么都想写 E2E。用一张对比表和一份决策清单说明什么时候该写单测、什么时候值得起浏览器。",
    authorId: 99003,
    ageDays: 4,
  },
  {
    id: "seedprompt07",
    kind: "svg",
    title: "生成一只鹈鹕骑自行车的 SVG",
    body: "单张 SVG，白底可用。鹈鹕要认得出——大嘴和喉囊是重点，自行车至少要有车架、两只轮子和脚踏。",
    authorId: 99004,
    ageDays: 3,
  },
  {
    id: "seedprompt08",
    kind: "svg",
    title: "用几何色块画夜里的灯塔",
    body: "只用矩形、圆形和多边形，画一座夜里的灯塔：塔身、光束、海面、星空。限制在四个颜色以内。",
    authorId: 99005,
    ageDays: 2,
  },
];

const SETUPS = [
  { model: "Claude Opus 4.5", provider: "Anthropic", harness: "Claude Code", reasoning: "high", source: "claude-code" },
  { model: "GPT-5.1", provider: "OpenAI", harness: "Codex CLI", reasoning: "medium", source: "codex" },
  { model: "Gemini 3 Pro", provider: "OpenRouter", harness: "opencode", reasoning: "high", source: "opencode" },
  { model: "DeepSeek V3.2", provider: "火山引擎", harness: "DSH", reasoning: "medium", source: "dsh" },
  { model: "Kimi K2 Thinking", provider: "硅基流动", harness: "pi", reasoning: "xhigh", source: "pi" },
  { model: "GLM-4.6", provider: "阿里云百炼", harness: "裸 API", reasoning: "off", source: null },
  { model: "Qwen3 Coder", provider: "阿里云百炼", harness: "官方网页版", reasoning: "medium", source: null },
  { model: "Grok 4", provider: "网页版", harness: "官方网页版", reasoning: "low", source: null },
  { model: "Claude Opus 5.5", provider: "Anthropic", harness: "Claude Code", reasoning: "high", source: "claude-code" },
  { model: "GPT-6.1 Terra", provider: "OpenAI", harness: "Codex CLI", reasoning: "medium", source: "codex" },
  { model: "Gemini 4 Argon", provider: "Google Gemini", harness: "opencode", reasoning: "high", source: "opencode" },
  { model: "DeepSeek V4.1 Flash", provider: "DeepSeek", harness: "DSH", reasoning: "medium", source: "dsh" },
  { model: "Kimi K3.1 Pro", provider: "月之暗面 Kimi", harness: "pi", reasoning: "high", source: "pi" },
  { model: "GLM-5.3", provider: "智谱 GLM", harness: "裸 API", reasoning: "off", source: null },
  { model: "Qwen3.8 Max", provider: "阿里通义千问", harness: "官方网页版", reasoning: "medium", source: null },
  { model: "MiniMax-M3.1-Flash", provider: "MiniMax", harness: "Cursor", reasoning: "low", source: null },
  { model: "Claude Opus 4.5", provider: "WorkBuddy", harness: "Claude Code", reasoning: "high", source: "claude-code" },
  { model: "DeepSeek V3.2", provider: "Command Code", harness: "DSH", reasoning: "medium", source: "dsh" },
  { model: "GPT-5.1", provider: "OpenCode", harness: "opencode", reasoning: "medium", source: "opencode" },
];

// 题库：20 个主题循环到 92 道，标题加轮次后缀，避免手工铺 100 条。
const TEMPLATE_TOPICS = [
  { kind: "web", title: "做一个三栏阅读器", body: "左侧目录、中间正文、右侧批注，滚动时目录跟随高亮。单文件 HTML，不要框架。" },
  { kind: "web", title: "设计一个专注计时器", body: "一个大号倒计时、一个开始按钮、一组可切换的时长。留白足够，尽量不要装饰。" },
  { kind: "web", title: "做一个可筛选的表格", body: "二十行数据，支持按状态筛选、按数字排序、关键词搜索。移动端不要横向滚动。" },
  { kind: "web", title: "画一张响应式价格表", body: "三档价格，中间那档突出。窄屏时纵向堆叠，不要用图片。" },
  { kind: "web", title: "做一个极简登录页", body: "邮箱加密码，一个提交按钮。错误提示要贴字段出现，不要弹窗。" },
  { kind: "web", title: "做一个瀑布流卡片墙", body: "不同高度的卡片，滚动时懒加载。只用 CSS 和少量 JS。" },
  { kind: "web", title: "做一个天气小组件", body: "当前温度、天气图标、未来三天。数据写死即可，重点是排版。" },
  { kind: "web", title: "做一个可拖拽的看板", body: "三列任务，卡片可以在列之间拖动。支持键盘操作更好。" },
  { kind: "web", title: "做一个音乐播放器界面", body: "封面、进度条、播放控制。进度条可以拖动，不要接真实音频。" },
  { kind: "web", title: "做一个命令行风格的作品页", body: "黑底等宽字，输入命令后逐行输出个人介绍。要能键盘操作。" },
  { kind: "markdown", title: "解释一次数据库迁移的心智模型", body: "面向刚接触后端的前端，讲清楚为什么迁移只能向前、回滚为什么危险，配一个最小例子。" },
  { kind: "markdown", title: "写一份代码评审清单", body: "按可读性、边界、错误处理、测试四个维度组织，每条给出一个真实会踩的坑。" },
  { kind: "markdown", title: "梳理 HTTP 缓存的三层结构", body: "浏览器、CDN、源站各管什么，用一张表和三个请求时序说明。" },
  { kind: "markdown", title: "讲清楚乐观更新的失败路径", body: "从一次点赞出发，说明什么时候回滚、什么时候重试、什么时候让用户手动处理。" },
  { kind: "markdown", title: "写一份小团队的上线检查表", body: "覆盖数据迁移、灰度、回滚、监控和值班交接，适合十人以内团队。" },
  { kind: "markdown", title: "解释为什么日志要结构化", body: "用一个排障故事对比纯文本和结构化日志，最后给出字段命名建议。" },
  { kind: "svg", title: "画一组几何风格的天气图标", body: "晴、雨、雪三个图标，同一套配色和线宽，单张 SVG 里并排。" },
  { kind: "svg", title: "用圆和弧线画一座拱桥", body: "单色线稿，桥拱、水面倒影、几只飞鸟。控制在三种颜色以内。" },
  { kind: "svg", title: "画一个可缩放的图标集", body: "搜索、设置、通知、返回四个图标，24×24 网格，线宽一致。" },
  { kind: "svg", title: "用路径画一枚抽象徽章", body: "中心对称，外圈齿轮，内圈星形。适合做社区徽章。" },
];

const ROUND_LABELS = ["", "深色版", "移动端", "极简版", "动效版", "无障碍版"];
const generatedPrompts = [];
for (let i = 0; i < 92; i++) {
  const topic = TEMPLATE_TOPICS[i % TEMPLATE_TOPICS.length];
  const round = Math.floor(i / TEMPLATE_TOPICS.length);
  const suffix = round === 0 ? "" : ` · ${ROUND_LABELS[round % ROUND_LABELS.length] || round}`;
  generatedPrompts.push({
    id: `seedprompt${String(9 + i).padStart(2, "0")}`,
    kind: topic.kind,
    title: `${topic.title}${suffix}`,
    body: topic.body,
    authorId: USERS[(i + 2) % USERS.length].id,
    ageDays: Math.max(1, (i * 7) % 120),
    hasAnswer: i < 76,
  });
}
PROMPTS.push(...generatedPrompts);

const MOD_POOLS = [[]];

const NOTES = [
  "一次成型，没改稿。",
  "第一版字号偏小，第二轮把正文提到 18px。",
  "让模型先列结构再写，省了两轮返工。",
  "动画节奏调了三次，最后把缓动改成 ease-out。",
  "颜色试了两版，最终选了低饱和。",
  "删掉了所有装饰性阴影，留白反而更好看。",
  "入口文件单文件提交，没有额外资源。",
  "多轮修改后反而变啰嗦，采用了第一版。",
];

// ---------------------------------------------------------------- 内容模板

const page = (title, css, body, script = "") => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
${css}
</style>
</head>
<body>
${body}
${script ? `<script>\n${script}\n</script>` : ""}
</body>
</html>
`;

// 模板题的内容：只求三类作品都有真实文件，seed 决定配色与文案。
function webTemplate(seed) {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  const titles = ["少即是多", "把复杂留给自己", "只做一件事", "让内容自己说话"];
  const title = titles[Math.floor(r() * titles.length)];
  const accent = `hsl(${hue} 58% 46%)`;
  const bg = `hsl(${(hue + 170) % 360} 32% 96%)`;
  return page(
    title,
    `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:${bg};color:#1d1d1f;font-family:"DM Sans",system-ui,sans-serif}.card{width:min(560px,86vw);padding:56px 48px;border:1px solid hsl(${hue} 20% 84%);border-radius:24px;background:#fff;box-shadow:0 24px 80px hsl(${hue} 30% 50% / .12)}h1{margin:0 0 16px;font-size:clamp(32px,6vw,52px);letter-spacing:-.03em;line-height:1.05}p{margin:0;color:#6b6b70;line-height:1.7}.dot{width:10px;height:10px;border-radius:50%;background:${accent};margin-bottom:28px}`,
    `<main class="card"><div class="dot"></div><h1>${title}</h1><p>这是一份用于本地演示的生成内容。重点是让列表、筛选和预览在真实数据量下仍然顺手。</p></main>`,
  );
}

function markdownTemplate(seed) {
  const r = rng(seed);
  const titles = ["一次迁移的复盘", "把边界写清楚", "缓存不是银弹", "先让错误可见"];
  const title = titles[Math.floor(r() * titles.length)];
  const count = 3 + Math.floor(r() * 3);
  const items = Array.from({ length: count }, (_, i) => `${i + 1}. 第 ${i + 1} 条：先约束输入，再处理输出，最后补日志。`).join("\n");
  return `# ${title}\n\n演示用的 Markdown 答案。真正的结论通常只有一句，剩下的都是边界条件。\n\n${items}\n\n\`\`\`ts\nconst result = await load(id);\nif (!result) throw new Error("missing");\n\`\`\`\n\n最后检查一遍：失败路径是否也有测试。`;
}

function svgTemplate(seed) {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  const fill = `hsl(${hue} 55% 48%)`;
  const soft = `hsl(${(hue + 40) % 360} 45% 76%)`;
  const x = 120 + Math.floor(r() * 360);
  const y = 120 + Math.floor(r() * 240);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">\n  <rect width="800" height="600" fill="#f6f3ed"/>\n  <circle cx="${x}" cy="${y}" r="${90 + Math.floor(r() * 60)}" fill="${fill}" opacity="0.9"/>\n  <rect x="${x - 140}" y="${y + 110}" width="280" height="18" rx="9" fill="${soft}"/>\n  <path d="M80 520 Q400 ${320 + Math.floor(r() * 80)} 720 520" fill="none" stroke="${fill}" stroke-width="10" stroke-linecap="round"/>\n</svg>\n`;
}

function templateContent(prompt, seed) {
  if (prompt.kind === "web") return webTemplate(seed);
  if (prompt.kind === "markdown") return markdownTemplate(seed);
  return svgTemplate(seed);
}

function landingPage(variant) {
  const themes = [
    {
      bg: "#f7f4ee",
      ink: "#1b1a17",
      muted: "#6f6a61",
      accent: "#b4471f",
      display: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      label: "每天只推送一篇值得读完的长文。",
    },
    {
      bg: "#0b0f14",
      ink: "#e8edf3",
      muted: "#8b98a8",
      accent: "#7dd3fc",
      display: "'Iowan Old Style', Georgia, serif",
      label: "把注意力还给阅读。",
    },
    {
      bg: "#fbfaf7",
      ink: "#12110f",
      muted: "#77726a",
      accent: "#2f5d50",
      display: "Georgia, 'Songti SC', serif",
      label: "一天一篇，读完就关。",
    },
  ];
  const t = themes[variant];
  const css = `body { background: ${t.bg}; color: ${t.ink}; font-family: ${t.display};
  display: flex; flex-direction: column; justify-content: space-between;
  padding: clamp(24px, 6vw, 72px); }
.mark { width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid ${t.accent};
  display: grid; place-items: center; animation: breathe 5.5s ease-in-out infinite; }
.mark span { width: 22px; height: 22px; border-radius: 50%; background: ${t.accent}; opacity: .85; }
@keyframes breathe { 0%, 100% { transform: scale(1); opacity: .9; }
  50% { transform: scale(1.08); opacity: 1; } }
main { max-width: 780px; }
h1 { font-size: clamp(40px, 8vw, 92px); line-height: 1.02; letter-spacing: -.02em;
  font-weight: 500; margin: 0 0 24px; }
p { font-size: clamp(17px, 2.2vw, 21px); line-height: 1.65; color: ${t.muted};
  max-width: 32em; margin: 0 0 40px; }
a.cta { display: inline-flex; align-items: center; gap: 10px; padding: 14px 22px;
  border-radius: 999px; background: ${t.ink}; color: ${t.bg}; text-decoration: none;
  font-size: 15px; letter-spacing: .02em; }
a.cta:hover { opacity: .85; }
footer { display: flex; justify-content: space-between; font-size: 13px; color: ${t.muted}; }
@media (prefers-reduced-motion: reduce) { .mark { animation: none; } }`;
  const body = `<header><div class="mark"><span></span></div></header>
<main>
  <h1>${variant === 1 ? "折页" : "一页"}</h1>
  <p>${t.label}没有信息流，没有红点，也没有第二篇。每天晚上八点，只有一篇。</p>
  <a class="cta" href="#today">读今天这篇</a>
</main>
<footer><span>一页 · 每日一篇</span><span>${variant === 2 ? "第一八七期" : "Vol. 187"}</span></footer>`;
  return page("一页 · 每日一篇", css, body);
}

function particleGalaxy(variant) {
  const palettes = [
    { bg: "#05070d", core: "rgba(125,211,252,", rim: "rgba(167,139,250," },
    { bg: "#0d0805", core: "rgba(251,191,36,", rim: "rgba(248,113,113," },
    { bg: "#0a0a0a", core: "rgba(255,255,255,", rim: "rgba(148,163,184," },
  ];
  const p = palettes[variant];
  const css = `html, body { height: 100%; overflow: hidden; background: ${p.bg}; }
canvas { display: block; cursor: crosshair; }
.hint { position: fixed; left: 24px; bottom: 20px; color: rgba(255,255,255,.42);
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; }`;
  const body = `<canvas id="sky"></canvas>
<div class="hint">移动鼠标牵引星系 · 点击重置</div>`;
  const script = `const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let w = 0, h = 0, cx = 0, cy = 0;
const stars = [];
const mouse = { x: 0, y: 0, active: false };
const COUNT = ${variant === 2 ? 420 : 620};

function resize() {
  w = canvas.width = innerWidth * DPR;
  h = canvas.height = innerHeight * DPR;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  cx = w / 2; cy = h / 2;
}
function spawn() {
  stars.length = 0;
  for (let i = 0; i < COUNT; i++) {
    const arm = i % 3;
    const radius = 40 + Math.pow(Math.random(), 0.7) * Math.min(cx, cy) * 1.05;
    const angle = radius * 0.011 + arm * (Math.PI * 2 / 3) + Math.random() * 0.35;
    stars.push({ radius, angle, speed: 0.0016 + (1 - radius / Math.max(cx, cy)) * 0.004,
      size: 0.6 + Math.random() * (variant === 2 ? 1.6 : 1.1), drift: Math.random() * 0.6 });
  }
}
function frame() {
  ctx.fillStyle = "rgba(0,0,0,${variant === 2 ? "0.16" : "0.22"})";
  ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    s.angle += s.speed;
    let x = cx + Math.cos(s.angle) * s.radius;
    let y = cy + Math.sin(s.angle) * s.radius * 0.58;
    if (mouse.active) {
      const dx = mouse.x - x, dy = mouse.y - y;
      const d2 = dx * dx + dy * dy;
      const pull = 9000 / (d2 + 9000);
      x += dx * pull * 0.22; y += dy * pull * 0.22;
    }
    const t = s.radius / Math.max(cx, cy);
    ctx.beginPath();
    ctx.fillStyle = (t < 0.55 ? "${p.core}" : "${p.rim}") + (0.25 + (1 - t) * 0.7) + ")";
    ctx.arc(x, y, s.size * DPR, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(frame);
}
addEventListener("resize", () => { resize(); spawn(); });
addEventListener("pointermove", (e) => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; mouse.active = true; });
addEventListener("pointerleave", () => { mouse.active = false; });
addEventListener("click", spawn);
resize(); spawn(); frame();`;
  return page("粒子星系", css, body, script);
}

function poster(variant) {
  const layouts = [
    { bg: "#111111", ink: "#f3efe6", accent: "#d8ff4f", family: "system-ui, sans-serif",
      align: "center", size: "clamp(34px, 7.4vw, 96px)", tracking: "-.02em" },
    { bg: "#efece4", ink: "#16150f", accent: "#c2410c", family: "'Helvetica Neue', Arial, sans-serif",
      align: "left", size: "clamp(30px, 6.4vw, 82px)", tracking: "-.03em" },
    { bg: "#0f1a17", ink: "#e9f2ee", accent: "#f2b8a2", family: "Georgia, 'Songti SC', serif",
      align: "left", size: "clamp(32px, 6.8vw, 88px)", tracking: "0" },
  ];
  const l = layouts[variant];
  const css = `body { background: ${l.bg}; color: ${l.ink}; font-family: ${l.family};
  display: grid; place-items: center; padding: clamp(28px, 7vw, 88px); min-height: 100vh; }
.poster { width: 100%; max-width: 1080px; text-align: ${l.align}; }
.rule { height: 1px; background: ${l.accent}; opacity: .8; margin: 32px 0; width: ${variant === 1 ? "100%" : "64px"}; }
blockquote { margin: 0; font-size: ${l.size}; line-height: 1.18; letter-spacing: ${l.tracking}; font-weight: ${variant === 0 ? 600 : 400}; }
.meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; letter-spacing: .14em;
  text-transform: uppercase; color: ${l.ink}; opacity: .55; font-family: ui-monospace, monospace; }
.credit { margin-top: 40px; font-size: 15px; color: ${l.accent}; letter-spacing: .08em; }
@media (max-width: 640px) { .rule { margin: 22px 0; } .meta { gap: 12px; font-size: 11px; } }`;
  const body = `<div class="poster">
  <div class="meta"><span>Antoine de Saint-Exupéry</span><span>Le Petit Prince · 1943</span></div>
  <div class="rule"></div>
  <blockquote>真正重要的东西，<br>用眼睛是看不见的。</blockquote>
  <div class="rule"></div>
  <div class="credit">${variant === 1 ? "—— 狐狸对小王子的告白" : "On ne voit bien qu'avec le cœur."}</div>
</div>`;
  return page("真正重要的东西", css, body);
}

function rscDoc(variant) {
  const base = [
    `# React Server Components 的序列化边界

服务端组件不会把 HTML 直接交给浏览器，而是渲染成一份 Flight 描述：组件树、它的 props、以及"这里要挂一个客户端组件"的占位。浏览器拿到这份描述后再补上客户端部分。

## 边界在哪

分界线是 \`"use client"\` 指令。一旦文件被打上它，这个模块及其导入的模块都进入客户端图谱，只能接收可序列化的值。服务端组件可以渲染客户端组件，反过来不行。

\`\`\`tsx
// app/panel.tsx（服务端）
import { Counter } from "./counter";

export default async function Panel() {
  const stats = await loadStats();
  return <Counter initial={stats.count} label="今日新增" />;
}
\`\`\`

\`\`\`tsx
// app/counter.tsx（客户端）
"use client";

export function Counter({ initial, label }: { initial: number; label: string }) {
  const [n, setN] = useState(initial);
  return <button onClick={() => setN(n + 1)}>{label}：{n}</button>;
}
\`\`\`

## 什么能过边界

- 原始值、数组、普通对象、null
- Date、Map、Set、TypedArray、FormData 这类内建对象（新版 Flight 已支持）
- Promise 与 React 元素（会被当作可流式传输的引用）
- 服务端函数（通过 \`"use server"\` 变成可调用的引用，而不是函数本身）

## 什么过不去

函数、类实例、Symbol、循环引用、闭包捕获的私有状态——这些没有线格式。遇到它们时不要试图序列化，改成传 id、在客户端重新取，或者把逻辑整体挪到某一侧。

## 一个常见错觉

"服务端组件的 props 会被 sent 到客户端"——只有客户端组件的 props 会。服务端组件之间的 props 始终留在服务端，这也是它能直接接收数据库句柄的原因。`,
    `# 序列化边界：RSC 到底发了什么

## 一句话版本

客户端组件是"壳 + 插槽"，服务端组件是"提前算好的内容"。跨越 \`"use client"\` 的只有壳的 props 和插槽里的元素，不包含任何函数或类实例。

## 数据流

1. 请求进来，服务端开始渲染 RSC 树
2. 遇到客户端组件，写出一个模块引用和它的 props
3. 遇到 Suspense 边界，先发壳，等数据好了再补流
4. 浏览器反序列化成 React 元素树，交给客户端渲染器

## 能过 / 不能过

| 值 | 结果 | 备注 |
| --- | --- | --- |
| \`string\` / \`number\` / \`boolean\` | ✅ | |
| 普通对象、数组 | ✅ | 不能有循环引用 |
| \`Date\` / \`Map\` / \`Set\` | ✅ | Flight 有专门标签 |
| \`Promise\` | ✅ | 会被流式 resolve |
| 普通函数 | ❌ | 改用 \`"use server"\` 声明动作 |
| 类实例 | ❌ | 传可重建的参数 |
| \`useState\` 的 setter | ❌ | 只能在客户端内部传递 |

## 为什么函数不行

函数没有可移植的线格式：闭包捕获了什么是运行时的，V8 的字节码也无法跨端还原。Flight 用"引用"来绕开：服务端动作编译成一个 id，客户端拿 id 发请求，真正的函数仍留在服务器。

## 检查清单

- 传下去的值能否 \`JSON.stringify\`？能通过基本就安全。
- 需要交互的逻辑是否都在客户端组件里？
- 大对象是否应该只传 id 再在客户端取？`,
    `# 别把服务端组件当 JSON API 用

很多人第一次读 Flight 协议后会误以为"服务端组件就是把数据序列化过去"。反过来才对：序列化是限制，不是能力。

## 三个常见误解

**误解一：所有 props 都会过线。**
错。只有客户端组件的 props 会。服务端组件 A 渲染服务端组件 B 时，props 从不离开服务器。

**误解二：可以传函数做回调。**
不行。要交互就把那一段抽成客户端组件；要变更数据就写 Server Action，客户端拿到的是一个引用 id，不是函数体。

**误解三：反正都能塞进 props，不如多塞点。**
过线就要付出字节和反序列化成本。数据库行、全文内容、只在服务端用的句柄，都不该出现在客户端组件的 props 里。

## 一个真实的坑

\`\`\`tsx
"use client";
export function Chart({ rows }: { rows: Row[] }) {
  // rows 有 4000 条，每次导航都重新过线
}
\`\`\`

改法：传 \`promptId\`，在客户端用 \`useSWR\` 或 loader 数据取需要的那一段。

## 边界感

把 \`"use client"\` 当成一道真正的网络边界：左边是你可以随便用的 Node 能力，右边是你必须在浏览器里重建的世界。凡是不能重建的，都不要试图送过去。`,
  ];
  return base[variant];
}

function drizzleDoc(variant) {
  const base = [
    `# 在 Workers 上使用 D1 + Drizzle

## 建库

\`\`\`bash
npx wrangler d1 create my-app-db
\`\`\`

把输出的 \`database_id\` 写进 \`wrangler.jsonc\`：

\`\`\`jsonc
"d1_databases": [{ "binding": "DB", "database_name": "my-app-db", "database_id": "...", "migrations_dir": "drizzle" }]
\`\`\`

## 定义 schema

\`\`\`ts
// app/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
\`\`\`

## 生成并应用迁移

\`\`\`bash
npx drizzle-kit generate      # 产出 drizzle/0000_*.sql
npx wrangler d1 migrations apply my-app-db --local   # 本地
npx wrangler d1 migrations apply my-app-db --remote  # 线上
\`\`\`

## 在请求里用

\`\`\`ts
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const db = () => drizzle(env.DB, { schema });
\`\`\`

## 两条链路要分清

本地 \`--local\` 写入 \`.wrangler/state\`，线上 \`--remote\` 打到真实库。迁移只改结构，种子数据单独灌。上线前确认两条链路都跑过同一组迁移。`,
    `# D1 + Drizzle 速查

## 一次性配置

1. \`wrangler d1 create <name>\` → 记下 \`database_id\`
2. 写进 \`wrangler.jsonc\` 的 \`d1_databases\`，\`migrations_dir\` 指向 \`drizzle\`
3. \`drizzle.config.ts\` 里 \`dialect: "sqlite"\`，schema 指向 \`app/db/schema.ts\`
4. \`package.json\` 加三条脚本：generate / migrate / migrate:remote

## 常用命令

\`\`\`bash
npx drizzle-kit generate
npx wrangler d1 migrations apply my-app-db --local
npx wrangler d1 migrations apply my-app-db --remote
npx wrangler d1 execute my-app-db --local --command "select count(*) from notes"
\`\`\`

## 查询写法

\`\`\`ts
const rows = await db().select().from(notes).orderBy(desc(notes.createdAt)).limit(20);
await db().insert(notes).values({ id: crypto.randomUUID(), body, createdAt: new Date() });
\`\`\`

## 容易踩的点

- D1 没有交互式事务 API，批量写用 \`db().batch([...])\`
- \`--local\` 与 \`--remote\` 是两套数据，别在本地查完就去线上验收
- 时间戳建议统一 \`timestamp_ms\`，避免秒/毫秒混用
- 迁移文件不要手改已应用的版本，新增一版`,
    `# 第一次把 D1 接进 Workers：我踩过的坑

## 起因

项目要在 Cloudflare 上存数据，选了 D1 + Drizzle。文档很全，但拼起来时还是卡了几个小时，记录一下。

## 坑一：binding 名字和 drizzle 实例

\`env.DB\` 来自 \`wrangler.jsonc\` 里的 \`binding\` 字段，不是 \`database_name\`。写错会得到 \`D1_ERROR\`。

\`\`\`ts
export const db = () => drizzle(env.DB);
\`\`\`

## 坑二：本地和远端是两套库

第一次跑完 \`--local\` 就去看线上，发现表不存在。后来才把两条命令分开记：

\`\`\`bash
npx wrangler d1 migrations apply my-app-db --local
npx wrangler d1 migrations apply my-app-db --remote
\`\`\`

## 坑三：类型没生成

\`env\` 的类型来自 \`wrangler types\`。改了 binding 记得重跑，否则 TS 一直报 \`DB\` 不存在。

## 坑四：时间字段

Drizzle 的 \`timestamp_ms\` 只接受毫秒。混进秒级时间戳会让排序完全乱掉，排查起来很费劲。

## 结论

把"改 schema → generate → 本地迁移 → 本地验证 → 远端迁移"当成固定流水线，每一步都留一条命令，不要凭记忆。`,
  ];
  return base[variant];
}

function testingDoc(variant) {
  const base = [
    `# 单测与 E2E 的适用边界

## 三层模型

1. **纯函数单测**：输入输出确定，跑在毫秒级。价格计算、排序、解析器属于这一层。
2. **集成测试**：跑在 workerd 或真实数据库上，验证路由、权限、迁移。秒级。
3. **E2E**：真实浏览器点一遍。十秒到分钟级，能发现 hydration 与布局问题。

## 成本对比

| 维度 | 单测 | E2E |
| --- | --- | --- |
| 单次耗时 | < 50ms | 5~60s |
| 稳定性 | 高 | 受网络与动画影响 |
| 能发现的问题 | 逻辑错误 | 交互断裂、样式塌陷 |
| 维护成本 | 低 | 选择器一变就挂 |

## 什么时候值得写 E2E

- 关键路径只有一个：登录 → 提交 → 看到结果
- 改动涉及客户端状态或动画
- 上线前的人工验收会重复做同一组点击

## 什么时候不该写

- 只是纯逻辑改动，单测能覆盖
- 页面还在频繁改结构，选择器成本高于收益
- 一个用例需要 20 次点击才能到达断言点——先拆页面

## 决策清单

1. 这段逻辑能否脱离浏览器验证？能 → 单测。
2. 失败一次会赔多少钱/多少信任？低 → 集成测试即可。
3. 这个流程每周是否至少被人手动点一次？是 → 值得 E2E。`,
    `# 别用 E2E 覆盖所有东西

## 一个判断

E2E 的价值在于"整条链路有没有断"，不在于"每个分支对不对"。分支属于单测。

## 分层建议

- **模型层**（纯函数）：覆盖率优先，边界值齐全
- **数据层**：迁移能在干净库上跑通，一条集成测试足够
- **页面层**：每个关键路径一条 E2E，不追求分支覆盖
- **视觉**：截图对比，只在稳定页面开

## 成本账

一条 E2E 用例平均 15 秒，20 条就是 5 分钟。假设每天跑 10 次，就是 50 分钟的等待。同样的时间可以写 200 条单测。

## 实践

\`\`\`ts
test("提交后能看到自己的答案", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("用户名").fill("dev");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("已登录")).toBeVisible();
});
\`\`\`

一条路径，一个断言，不写实现细节。剩下的交给单测和代码评审。`,
    `# 测试金字塔在这个项目里怎么落

## 现状

项目里只有 vitest 覆盖了 bundle 校验与日志解析，这两块都是纯函数，改一次跑一次，1 秒内出结果。页面层靠手动验收。

## 需要补什么

- **数据层**：迁移在空库上能否跑通，用一条集成测试锁住
- **关键路径**：登录、提交、评分这三条各一条 E2E
- **不补**：每个列表页的排序、每个空状态——这些用单测和人工看一眼更划算

## 一条 E2E 长什么样

\`\`\`ts
test("评分后列表立即更新", async ({ page }) => {
  await page.goto("/s/abc123");
  await page.getByRole("radio", { name: "4 星" }).click();
  await expect(page.getByText("已评分")).toBeVisible();
});
\`\`\`

## 结论

E2E 是抽样检查，不是验收清单。把"必须每次都验证"的东西下沉到单测，把"用户真的会点"的路径留给浏览器。`,
  ];
  return base[variant];
}

function pelicanSvg(variant) {
  const styles = [
    { body: "#f4f1e8", line: "#20201d", accent: "#d9683a", beak: "#f2b544", sea: "none" },
    { body: "none", line: "#1f2937", accent: "#0f766e", beak: "none", sea: "none" },
    { body: "#e8eef2", line: "#243447", accent: "#e07a5f", beak: "#f4a261", sea: "none" },
  ];
  const s = styles[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-label="一只鹈鹕骑着自行车">
  <title>Pelican on a bicycle</title>
  <rect width="640" height="480" fill="${variant === 1 ? "#ffffff" : "#fbfaf6"}"/>
  <g fill="none" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 4}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="196" cy="360" r="64"/>
    <circle cx="452" cy="360" r="64"/>
    <circle cx="196" cy="360" r="8" fill="${s.line}"/>
    <circle cx="452" cy="360" r="8" fill="${s.line}"/>
    <path d="M196 360 L300 288 L420 288 L452 360"/>
    <path d="M300 288 L330 360"/>
    <path d="M196 360 L300 288"/>
    <path d="M330 360 L360 260"/>
    <path d="M360 260 L430 280"/>
  </g>
  <g>
    <ellipse cx="330" cy="210" rx="86" ry="58" fill="${s.body === "none" ? "#ffffff" : s.body}" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 4}"/>
    <path d="M386 186 C 420 150 442 128 456 116" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 4}" fill="none" stroke-linecap="round"/>
    <circle cx="462" cy="110" r="26" fill="${s.body === "none" ? "#ffffff" : s.body}" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 4}"/>
    <circle cx="470" cy="102" r="4" fill="${s.line}"/>
    <path d="M486 112 L 566 128 L 486 138 Z" fill="${s.beak === "none" ? "#ffffff" : s.beak}" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 3.5}"/>
    <path d="M486 130 C 516 158 536 158 552 138" fill="${s.accent}" opacity="${variant === 1 ? "0" : "0.85"}" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 2.5}"/>
    <path d="M300 262 L 292 326" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 5}" stroke-linecap="round"/>
    <path d="M356 258 L 368 322" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 5}" stroke-linecap="round"/>
    <path d="M292 326 L 268 340" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 5}" stroke-linecap="round"/>
    <path d="M368 322 L 392 336" stroke="${s.line}" stroke-width="${variant === 1 ? 3 : 5}" stroke-linecap="round"/>
  </g>
  <g stroke="${s.line}" stroke-width="2.5" fill="none" opacity="0.55">
    <circle cx="196" cy="360" r="44"/><circle cx="452" cy="360" r="44"/>
    <path d="M196 316 L196 404 M152 360 L240 360 M165 329 L227 391 M227 329 L165 391"/>
    <path d="M452 316 L452 404 M408 360 L496 360 M421 329 L483 391 M483 329 L421 391"/>
  </g>
  <g fill="none" stroke="${s.accent}" stroke-width="3" opacity="0.7">
    <path d="M96 430 C 160 414 236 446 300 430 C 364 414 440 446 544 430"/>
  </g>
</svg>
`;
}

function lighthouseSvg(variant) {
  const palettes = [
    { sky: "#0b1b33", sea: "#12304f", light: "#ffd166", rock: "#1c2a3a", tower: "#f1f5f9" },
    { sky: "#101418", sea: "#1b2733", light: "#f4f1de", rock: "#22262b", tower: "#e5e7eb" },
    { sky: "#14112b", sea: "#232046", light: "#f6bd60", rock: "#2b2640", tower: "#f8f9fb" },
  ];
  const p = palettes[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-label="夜里的灯塔">
  <title>Lighthouse at night</title>
  <rect width="640" height="480" fill="${p.sky}"/>
  <g fill="#ffffff" opacity="0.8">
    <circle cx="96" cy="72" r="2"/><circle cx="168" cy="132" r="1.6"/>
    <circle cx="252" cy="60" r="1.8"/><circle cx="332" cy="104" r="1.4"/>
    <circle cx="418" cy="66" r="2.2"/><circle cx="502" cy="120" r="1.6"/>
    <circle cx="574" cy="58" r="1.8"/><circle cx="600" cy="168" r="1.4"/>
    <circle cx="64" cy="188" r="1.4"/><circle cx="212" cy="196" r="1.2"/>
  </g>
  <rect y="330" width="640" height="150" fill="${p.sea}"/>
  <g fill="none" stroke="${p.light}" stroke-width="2" opacity="0.25">
    <path d="M0 356 C 120 344 200 368 320 356 C 440 344 540 366 640 356"/>
    <path d="M0 388 C 140 376 220 400 360 388 C 480 378 560 398 640 388"/>
    <path d="M0 424 C 120 414 210 436 330 424 C 450 414 540 434 640 424"/>
  </g>
  <polygon points="292,176 348,176 372,352 268,352" fill="${p.tower}"/>
  <g fill="${p.rock}">
    <polygon points="268,352 372,352 400,380 240,380"/>
    <rect x="252" y="140" width="136" height="36" rx="4"/>
  </g>
  <rect x="300" y="128" width="40" height="24" fill="${p.light}"/>
  <polygon points="296,128 344,128 320,104" fill="${p.rock}"/>
  <g fill="${p.light}" opacity="0.28">
    <polygon points="320,140 640,60 640,220"/>
    <polygon points="320,140 0,60 0,220"/>
  </g>
  <g fill="${p.rock}">
    <rect x="276" y="210" width="88" height="10" opacity="0.25"/>
    <rect x="272" y="272" width="96" height="10" opacity="0.25"/>
  </g>
  <g fill="${p.light}">
    <rect x="310" y="236" width="20" height="14" rx="2"/>
    <rect x="306" y="296" width="20" height="14" rx="2"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- 组装数据

const CONTENT = {
  seedprompt01: [landingPage(0), landingPage(1), landingPage(2)],
  seedprompt02: [particleGalaxy(0), particleGalaxy(1), particleGalaxy(2)],
  seedprompt03: [poster(0), poster(1), poster(2)],
  seedprompt04: [rscDoc(0), rscDoc(1), rscDoc(2)],
  seedprompt05: [drizzleDoc(0), drizzleDoc(1), drizzleDoc(2)],
  seedprompt06: [testingDoc(0), testingDoc(1), testingDoc(2)],
  seedprompt07: [pelicanSvg(0), pelicanSvg(1), pelicanSvg(2)],
  seedprompt08: [lighthouseSvg(0), lighthouseSvg(1), lighthouseSvg(2)],
};

const ENTRY = { web: "index.html", markdown: "index.md", svg: "index.svg" };
const MIME = {
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  svg: "image/svg+xml",
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const submissions = [];
let subIndex = 0;

for (const [pIndex, prompt] of PROMPTS.entries()) {
  if (prompt.hasAnswer === false) continue;
  const variants = CONTENT[prompt.id] ?? [templateContent(prompt, pIndex + 1)];
  for (const [vIndex, text] of variants.entries()) {
    const setup = SETUPS[(pIndex * 3 + vIndex) % SETUPS.length];
    const author = USERS[(pIndex + vIndex) % USERS.length];
    const entry = ENTRY[prompt.kind];
    const id = `seedsub${String(++subIndex).padStart(4, "0")}`;
    const ext = entry.slice(entry.lastIndexOf(".") + 1);
    const bytes = Buffer.byteLength(text, "utf8");
    const rand = rng(pIndex * 97 + vIndex * 31 + 7);
    const createdAt = NOW - prompt.ageDays * DAY + (vIndex + 1) * 5 * HOUR + Math.floor(rand() * 2 * HOUR);
    const logMeta = setup.source
      ? {
          source: setup.source,
          models: [setup.model],
          inputTokens: 9000 + Math.floor(rand() * 26000),
          outputTokens: 1200 + Math.floor(rand() * 5200),
          cacheReadTokens: Math.floor(rand() * 18000),
          cacheWriteTokens: Math.floor(rand() * 4000),
          reasoningTokens: setup.reasoning === "off" ? 0 : Math.floor(rand() * 6000),
          durationMs: 42000 + Math.floor(rand() * 240000),
          turns: 2 + Math.floor(rand() * 6),
          toolCalls: Math.floor(rand() * 12),
        }
      : null;

    submissions.push({
      id,
      promptId: prompt.id,
      kind: prompt.kind,
      authorId: author.id,
      model: setup.model,
      provider: setup.provider,
      harness: setup.harness,
      reasoning: setup.reasoning,
      mods: MOD_POOLS[(pIndex + vIndex) % MOD_POOLS.length],
      createdAt,
      entry,
      mime: MIME[ext],
      bytes,
      text,
      content: prompt.kind === "markdown" ? text : null,
      notes: NOTES[(pIndex * 3 + vIndex) % NOTES.length],
      logMeta,
      votes: null,
    });
  }
}

// 评分：每条答案由 3 位非作者用户打分，围绕模型偏置 + 题目偏置浮动。
const MODEL_BIAS = {
  "Claude Opus 4.5": 0.55,
  "GPT-5.1": 0.35,
  "Gemini 3 Pro": 0.2,
  "DeepSeek V3.2": 0.1,
  "Kimi K2 Thinking": -0.05,
  "GLM-4.6": -0.15,
  "Qwen3 Coder": -0.2,
  "Grok 4": -0.3,
};
const PROMPT_BIAS = { seedprompt01: 0.2, seedprompt02: -0.1, seedprompt03: 0.15, seedprompt04: 0.05, seedprompt05: -0.05, seedprompt06: 0.1, seedprompt07: 0.25, seedprompt08: -0.15 };

for (const submission of submissions) {
  const rand = rng([...submission.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
  const raters = USERS.filter((u) => u.id !== submission.authorId)
    .sort(() => rand() - 0.5)
    .slice(0, 3);
  submission.votes = raters.map((rater, i) => {
    const base =
      3.6 + (MODEL_BIAS[submission.model] ?? 0) + (PROMPT_BIAS[submission.promptId] ?? 0);
    const noise = (rand() - 0.5) * 1.6;
    const stars = Math.min(5, Math.max(1, Math.round((base + noise) * 2) / 2));
    return {
      userId: rater.id,
      stars,
      updatedAt: submission.createdAt + (i + 1) * 6 * HOUR,
    };
  });
}

// ---------------------------------------------------------------- SQL 生成

const q = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

const lines = [];

lines.push("DELETE FROM ratings WHERE submission_id LIKE 'seedsub%' OR user_id BETWEEN 99001 AND 99005;");
lines.push("DELETE FROM submission_mods WHERE submission_id LIKE 'seedsub%';");
lines.push("DELETE FROM submissions WHERE id LIKE 'seedsub%';");
lines.push("DELETE FROM prompts WHERE id LIKE 'seedprompt%';");
lines.push(
  "DELETE FROM users WHERE id BETWEEN 99001 AND 99005 AND id NOT IN (SELECT author_id FROM prompts) AND id NOT IN (SELECT author_id FROM submissions);",
);

for (const user of USERS) {
  const rulesAccepted = user.id === 99005 ? "NULL" : (NOW - 2 * DAY);
  lines.push(
    `INSERT OR IGNORE INTO users (id, username, name, avatar_template, trust_level, silenced, role, banned, created_at, last_login_at, rules_accepted_at) VALUES (${user.id}, ${q(user.username)}, ${q(user.name)}, NULL, ${user.trustLevel}, 0, ${q(user.role)}, 0, ${NOW - 120 * DAY}, ${NOW - 2 * DAY}, ${rulesAccepted});`,
  );
}

for (const prompt of PROMPTS) {
  const createdAt = NOW - prompt.ageDays * DAY;
  lines.push(
    `INSERT INTO prompts (id, author_id, title, body, kind, allow_search, allow_libraries, status, moderation_note, created_at, updated_at) VALUES (${q(prompt.id)}, ${prompt.authorId}, ${q(prompt.title)}, ${q(prompt.body)}, ${q(prompt.kind)}, ${prompt.allowSearch ? 1 : 0}, ${prompt.allowLibraries === false ? 0 : 1}, 'active', NULL, ${createdAt}, NULL);`,
  );
}

for (const submission of submissions) {
  const manifest = [
    {
      path: submission.entry,
      size: submission.bytes,
      type: submission.mime,
    },
  ];
  lines.push(
    `INSERT INTO submissions (id, prompt_id, kind, author_id, model_id, provider_id, harness_id, reasoning, files, total_bytes, notes, content, log_meta, has_raw_log, status, moderation_note, created_at, updated_at) VALUES (${q(submission.id)}, ${q(submission.promptId)}, ${q(submission.kind)}, ${submission.authorId}, ${q(slug(submission.model))}, ${q(slug(submission.provider))}, ${q(slug(submission.harness))}, ${q(submission.reasoning)}, ${q(JSON.stringify(manifest))}, ${submission.bytes}, ${q(submission.notes)}, ${q(submission.content)}, ${q(submission.logMeta ? JSON.stringify(submission.logMeta) : null)}, 0, 'active', NULL, ${submission.createdAt}, NULL);`,
  );
  for (const mod of submission.mods) {
    lines.push(
      `INSERT OR IGNORE INTO submission_mods (submission_id, mod_id) VALUES (${q(submission.id)}, ${q(slug(mod))});`,
    );
  }
  for (const vote of submission.votes) {
    lines.push(
      `INSERT INTO ratings (user_id, submission_id, stars, updated_at) VALUES (${vote.userId}, ${q(submission.id)}, ${vote.stars}, ${vote.updatedAt});`,
    );
  }
}


function slug(name) {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^\p{L}\p{N}.\-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------- 落盘与执行

fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

const sqlPath = path.join(WORK_DIR, "seed.sql");
fs.writeFileSync(sqlPath, lines.join("\n") + "\n");

const files = [];
for (const submission of submissions) {
  const dir = path.join(WORK_DIR, "files", submission.id);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, submission.entry);
  fs.writeFileSync(filePath, submission.text);
  files.push({ submission, filePath });
}

console.log(`生成 ${USERS.length} 位用户、${PROMPTS.length} 道题、${submissions.length} 份答案`);
console.log(`SQL: ${sqlPath}`);

execFileSync(
  WRANGLER,
  ["d1", "execute", DATABASE, "--local", "--persist-to", PERSIST, "--file", sqlPath],
  { stdio: "inherit" },
);

if (!skipR2) {
  for (const { submission, filePath } of files) {
    execFileSync(
      WRANGLER,
      [
        "r2",
        "object",
        "put",
        `${BUCKET}/s/${submission.id}/${submission.entry}`,
        "--file",
        filePath,
        "--local",
        "--persist-to",
        PERSIST,
        "--content-type",
        submission.mime,
        "-y",
      ],
      { stdio: "pipe" },
    );
    process.stdout.write(`R2 ${submission.id}\n`);
  }
}

console.log("完成。");
