/**
 * Renders a cooked post inside a Discourse-like topic shell and screenshots it
 * with headless Chrome. No browser automation dependency: the same trick works
 * on the phone and on the cloud runner.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const POST_CSS = `
:root {
  --primary: #222;
  --primary-medium: #777;
  --primary-low: #e9e9e9;
  --primary-very-low: #f8f8f8;
  --tertiary: #0088cc;
  --bg: #f5f5f5;
  --surface: #fff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--primary);
  font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans CJK SC", "Noto Sans SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.fixture-label {
  max-width: 690px;
  margin: 18px auto 0;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #888;
  letter-spacing: 0.02em;
}
.topic {
  max-width: 690px;
  margin: 8px auto 40px;
  background: var(--surface);
  border-radius: 8px;
  padding: 18px 24px 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,.06);
}
.topic-post { display: grid; grid-template-columns: 45px minmax(0, 1fr); gap: 12px; }
.avatar {
  width: 45px; height: 45px; border-radius: 50%;
  background: linear-gradient(135deg, #cfd8e3, #9aa7b5);
}
.post-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; font-size: 13px; }
.post-meta .username { font-weight: 700; color: var(--primary); }
.post-meta .time { color: var(--primary-medium); }
.cooked { font-size: 15px; line-height: 1.6; overflow-wrap: break-word; }
.cooked > :first-child { margin-top: 0; }
.cooked > :last-child { margin-bottom: 0; }
.cooked p { margin: 0 0 1em; }
.cooked a { color: var(--tertiary); text-decoration: none; }
.cooked img { max-width: 100%; height: auto; border-radius: 4px; vertical-align: middle; }
.cooked iframe { width: 100%; border: 0; display: block; }
.cooked video { width: 100%; height: auto; border-radius: 4px; display: block; background: #000; }
.onebox {
  display: flex; flex-direction: column;
  border: 1px solid var(--primary-low);
  border-radius: 8px; overflow: hidden; background: #fff;
}
.onebox header.source {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; background: var(--primary-very-low);
  font-size: 13px; color: var(--primary-medium);
  border-bottom: 1px solid var(--primary-low);
}
.onebox header.source img.site-icon { width: 16px; height: 16px; border-radius: 3px; }
.onebox header.source a { color: var(--primary-medium); }
.onebox .onebox-body { padding: 12px; }
.onebox .onebox-body .aspect-image { margin: 0 0 10px; overflow: hidden; border-radius: 4px; }
.onebox .onebox-body .aspect-image img { display: block; width: 100%; max-height: 320px; object-fit: cover; border-radius: 0; }
.onebox h3 { margin: 0 0 4px; font-size: 16px; line-height: 1.35; }
.onebox h3 a { color: var(--primary); }
.onebox p { margin: 0; color: var(--primary-medium); font-size: 14px; }

@media (max-width: 760px) {
  .fixture-label { margin: 12px 12px 0; }
  .topic { margin: 6px 8px 24px; padding: 14px 14px 20px; }
  .topic-post { grid-template-columns: 1fr; gap: 0; }
  .avatar { display: none; }
  .cooked { font-size: 15px; }
}
`;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/chromium/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);

export function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    try {
      execFileSync(path, ["--version"], { stdio: "ignore" });
      return path;
    } catch {
      /* try next */
    }
  }
  throw new Error("No Chrome/Chromium found. Set CHROME_PATH.");
}

export function postHtml({ label, cooked }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${label}</title>
<style>${POST_CSS}</style>
</head>
<body>
<div class="fixture-label">${label.replace(/[<>&]/g, "")}</div>
<main class="topic">
  <article class="topic-post">
    <div class="avatar"></div>
    <div>
      <div class="post-meta"><span class="username">pelican</span><span class="time">刚刚</span></div>
      <div class="cooked">${cooked}</div>
    </div>
  </article>
</main>
</body>
</html>`;
}

export function screenshot({ html, outPath, width, height, chrome = findChrome() }) {
  const dir = mkdtempSync(join(tmpdir(), "forum-preview-"));
  const file = join(dir, "post.html");
  writeFileSync(file, html);
  try {
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--disable-extensions",
        "--force-device-scale-factor=1",
        "--default-background-color=00000000",
        `--user-data-dir=${join(dir, "profile")}`,
        `--window-size=${width},${height}`,
        "--virtual-time-budget=10000",
        `--screenshot=${outPath}`,
        `file://${file}`,
      ],
      { stdio: "ignore" },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
