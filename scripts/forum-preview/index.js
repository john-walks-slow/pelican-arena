#!/usr/bin/env node
/**
 * Preview what a Pelican link will look like once pasted into a Discourse post.
 *
 *   node scripts/forum-preview/index.js https://pelicanarena.dpdns.org/s/xxxx
 *
 * It fetches the live page, rebuilds every share format we offer, runs them
 * through Discourse's own sanitizer rules (including LinuxDO's iframe
 * allow-list), then screenshots the result at desktop and mobile widths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  fetchPage,
  iframeSnippet,
  markdownSnippet,
  markdownToCooked,
  oembedEmbed,
  oneboxCard,
  pictureSnippet,
  videoSnippet,
} from "./compose.js";
import { findChrome, postHtml, screenshot } from "./render.js";
import { DEFAULT_IFRAME_ALLOWLIST, sanitize } from "./sanitizer.js";

function parseArgs(argv) {
  const args = { variants: ["link", "card", "markdown", "iframe"], out: null, allow: null, shots: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--card-url") args.cardUrl = argv[++i];
    else if (a === "--iframe-url") args.iframeUrl = argv[++i];
    else if (a === "--video-url") args.videoUrl = argv[++i];
    else if (a === "--poster") args.poster = argv[++i];
    else if (a === "--og-image") args.ogImage = argv[++i];
    else if (a === "--allow") args.allow = argv[++i].split("|").filter(Boolean);
    else if (a === "--variants") args.variants = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--no-shots") args.shots = false;
    else if (a === "--chrome") process.env.CHROME_PATH = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else rest.push(a);
  }
  args.url = rest[0];
  return args;
}

const fmt = (ok, text) => `${ok ? "✅" : "⛔"} ${text}`;

function analyze(sanitized) {
  const iframes = sanitized.match(/<iframe\b[^>]*>/gi) ?? [];
  const iframeWithSrc = iframes.find((tag) => /\bsrc\s*=/.test(tag));
  const blockedSrc = sanitized.match(/data-unsanitized-src="([^"]+)"/i)?.[1];
  const video = /<video\b/i.test(sanitized);
  const videoSrc = sanitized.match(/<source\b[^>]*src="([^"]+)"/i)?.[1];
  const picture = /<picture\b/i.test(sanitized);
  const img =
    sanitized.match(/<img\b[^>]*class="thumbnail"[^>]*src="([^"]+)"/i)?.[1] ??
    sanitized.match(/<article[^>]*>[\s\S]*?<img\b[^>]*src="([^"]+)"/i)?.[1] ??
    sanitized.match(/<p>\s*<img\b[^>]*src="([^"]+)"/i)?.[1] ??
    sanitized.match(/<picture[\s\S]*?srcset="([^"\s]+)/i)?.[1];
  return { iframes: iframes.length, iframeSrc: Boolean(iframeWithSrc), blockedSrc, video, videoSrc, picture, img };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    console.log(`Usage: node scripts/forum-preview/index.js <url> [options]

  --card-url <url>     card image (default: <url>/card.svg)
  --iframe-url <url>   iframe target (default: <url>)
  --video-url <url>    add a <video> variant
  --poster <url>       video poster
  --og-image <url>     pretend the page ships this og:image
  --variants a,b,c     link,card,markdown,iframe,video
  --allow a|b|c        iframe prefix allow-list (default: LinuxDO's)
  --out <dir>          output dir (default: .shots/forum-preview/<slug>)
  --no-shots           skip screenshots
  --chrome <path>      Chrome/Chromium binary`);
    process.exit(args.url ? 0 : 1);
  }

  const allow = args.allow ?? DEFAULT_IFRAME_ALLOWLIST;
  const page = await fetchPage(args.url);
  if (args.ogImage) page.meta.image = args.ogImage;
  const base = args.url.replace(/\/+$/, "");
  const cardUrl = args.cardUrl ?? `${base}/card.svg`;
  const iframeUrl = args.iframeUrl ?? args.url;
  const title = page.meta.title || new URL(args.url).pathname;

  const slug = new URL(args.url).pathname.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "root";
  const outDir = resolve(args.out ?? join(".shots", "forum-preview", slug));
  mkdirSync(outDir, { recursive: true });

  /** @type {Array<{name: string, html: string, note?: string}>} */
  const variants = [];
  if (args.variants.includes("link")) {
    const embed = await oembedEmbed(page, allow);
    if (embed?.html) variants.push({ name: "link", html: embed.html, trusted: true, note: "页面声明了 oEmbed，Discourse 会内嵌 iframe" });
    else if (embed?.blocked) variants.push({ name: "link", html: oneboxCard(page), trusted: true, note: `oEmbed 给出 iframe，但 src 不在白名单（${embed.src}），回退为卡片` });
    else if (page.meta.title || page.meta.description) variants.push({ name: "link", html: oneboxCard(page), trusted: true });
    else variants.push({ name: "link", html: `<p><a href="${args.url}">${args.url}</a></p>`, note: "页面没有任何 OG 数据，Discourse 只显示普通链接" });
  }
  if (args.variants.includes("card")) {
    variants.push({ name: "card", html: pictureSnippet({ pageUrl: args.url, cardUrl, title }) });
  }
  if (args.variants.includes("markdown")) {
    variants.push({ name: "markdown", html: markdownToCooked(markdownSnippet({ cardUrl, title })) });
  }
  if (args.variants.includes("iframe")) {
    variants.push({ name: "iframe", html: iframeSnippet({ src: iframeUrl }) });
  }
  if (args.variants.includes("video") && args.videoUrl) {
    variants.push({ name: "video", html: videoSnippet({ src: args.videoUrl, poster: args.poster ?? cardUrl }) });
  }

  const results = variants.map((v) => {
    // Onebox HTML is generated server-side and never passes the post
    // sanitizer; running it through would strip classes the forum keeps.
    const sanitized = v.trusted ? v.html : sanitize(v.html, { allowedIframes: allow });
    return { ...v, sanitized, report: analyze(sanitized) };
  });

  const chrome = args.shots ? findChrome() : null;
  const shotMap = new Map();
  if (chrome) {
    for (const result of results) {
      const entry = { variant: result.name };
      for (const [suffix, width, height] of [
        ["desktop", 1000, 900],
        ["mobile", 390, 900],
      ]) {
        const file = join(outDir, `${result.name}-${suffix}.png`);
        screenshot({
          html: postHtml({ label: `pelican · ${result.name} · ${suffix}`, cooked: result.sanitized }),
          outPath: file,
          width,
          height,
          chrome,
        });
        entry[suffix] = file;
      }
      shotMap.set(result.name, entry);
    }
  }

  for (const result of results) {
    writeFileSync(join(outDir, `${result.name}.html`), postHtml({ label: result.name, cooked: result.sanitized }));
  }

  const lines = [
    `# 帖子预览 · ${title}`,
    "",
    `- 来源：${args.url}`,
    `- OG：title=${page.meta.title || "—"} / image=${page.meta.image || "—"} / site=${page.meta.siteName || "—"}`,
    `- iframe 白名单条目：${allow.length} 条`,
    "",
    "| 变体 | 结果 |",
    "| --- | --- |",
  ];
  for (const result of results) {
    const r = result.report;
    const bits = [];
    if (result.name === "link") {
      bits.push(r.img ? `卡片带缩略图 ${r.img}` : "卡片无缩略图（页面缺 og:image）");
    } else if (result.name !== "iframe") {
      bits.push(fmt(Boolean(r.img || r.picture), r.img ? `图片保留 ${r.img}` : r.picture ? "picture/source 保留" : "没有图片"));
    }
    if (result.name === "iframe") {
      if (r.iframeSrc) bits.push("✅ iframe 白名单通过，可交互");
      else if (r.iframes > 0 || r.blockedSrc) bits.push(`⛔ iframe 被剥离 src${r.blockedSrc ? `（原 src: ${r.blockedSrc}）` : ""}`);
      else bits.push("⛔ iframe 被整体移除（src 不在白名单）");
    }
    if (r.video) bits.push(`video 保留${r.videoSrc ? `（source: ${r.videoSrc}）` : ""}`);
    lines.push(`| ${result.name} | ${bits.join("；") || "见 HTML"} |`);
    if (result.note) lines.push(`| | ${result.note} |`);
  }
  lines.push("", "## 截图", "");
  const rel = (file) => relative(process.cwd(), file);
  for (const shot of shotMap.values()) {
    lines.push(`### ${shot.variant}`);
    lines.push(`![${shot.variant}](<${rel(shot.desktop)}>)`);
    lines.push(`![${shot.variant} mobile](<${rel(shot.mobile)}>)`);
    lines.push("");
  }
  lines.push("", "原始 cooked HTML 见同目录 `<variant>.html`。");
  writeFileSync(join(outDir, "report.md"), lines.join("\n") + "\n");

  console.log(lines.join("\n"));
  console.log(`\n输出目录：${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
