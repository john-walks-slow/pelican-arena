import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const work = join(tmpdir(), "pelican-share-assets");
const videoDir = join(work, "nav-video");
const outDir = join(root, ".shots/share-post");
const SPEED = 1.55;
rmSync(videoDir, { recursive: true, force: true });
mkdirSync(videoDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

await context.addInitScript(() => {
  if (window.top !== window) return;
  window.__cursorX = 1270;
  window.__cursorY = 820;

  const start = () => {
    try {
      const style = document.createElement("style");
      style.textContent = `
        html { scrollbar-width: none !important; }
        ::-webkit-scrollbar { display: none !important; }
        #__dsh_cursor {
          position: fixed; left: 0; top: 0; z-index: 2147483647;
          width: 20px; height: 24px; pointer-events: none;
          transform: translate3d(1270px, 820px, 0);
          filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.28));
          transition: width 90ms ease, height 90ms ease;
        }
        #__dsh_cursor svg { display: block; width: 100%; height: 100%; }
        #__dsh_cursor.is-down { width: 17px; height: 20px; }
        #__dsh_cursor::after {
          content: ""; position: absolute; left: 4px; top: 3px;
          width: 16px; height: 16px; border-radius: 999px;
          border: 2px solid rgb(194 65 12 / 0.55); opacity: 0;
          transform: translate(-50%, -50%) scale(0.4);
        }
        #__dsh_cursor.is-down::after { animation: __dsh_ping 420ms ease-out; }
        @keyframes __dsh_ping {
          0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.35); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
        }
      `;
      document.head.append(style);

      const el = document.createElement("div");
      el.id = "__dsh_cursor";
      el.innerHTML = `<svg viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.2 2.1 L2.2 19.2 L7.1 14.6 L10.6 22.1 L14.2 20.4 L10.7 13 L17.4 12.8 Z"
          fill="#101318" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
      document.body.append(el);

      window.addEventListener(
        "mousemove",
        (event) => {
          window.__cursorX = event.clientX;
          window.__cursorY = event.clientY;
          const cursor = document.getElementById("__dsh_cursor");
          if (cursor) cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        },
        { passive: true },
      );
      window.addEventListener("mousedown", () => document.getElementById("__dsh_cursor")?.classList.add("is-down"));
      window.addEventListener("mouseup", () => document.getElementById("__dsh_cursor")?.classList.remove("is-down"));
    } catch (error) {
      console.error("cursor overlay failed", error);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
});

const page = await context.newPage();
const t0 = Date.now();
const marks = [];
const mark = (name) => {
  marks.push({ name, at: Date.now() - t0 });
  console.log(`${name} +${Date.now() - t0}ms`);
};

async function smoothMove(x, y, duration = 700) {
  const from = await page.evaluate(() => ({ x: window.__cursorX ?? 1270, y: window.__cursorY ?? 820 }));
  const steps = Math.max(4, Math.round(duration / 16));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * ease, from.y + (y - from.y) * ease);
    await page.waitForTimeout(duration / steps);
  }
}

async function smoothScroll(y, duration = 650) {
  await page.evaluate(
    ({ target, ms }) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const delta = target - start;
        if (Math.abs(delta) < 1) return resolve();
        const begin = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - begin) / ms);
          const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          window.scrollTo(0, start + delta * ease);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { target: y, ms: duration },
  );
}

async function clickAt(x, y) {
  await smoothMove(x, y, 760);
  await page.waitForTimeout(320);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

try {
  await page.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
  await page.waitForTimeout(700);
  mark("home-ready");

  const pelicanCard = page.locator('a[href="/p/ymaj6x4uw6"]').first();
  let pelican = await centerOf(pelicanCard);
  if (pelican.y > 820) {
    await pelicanCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    pelican = await centerOf(pelicanCard);
  }
  await smoothMove(pelican.x, pelican.y, 900);
  await page.waitForTimeout(650);
  mark("home-hover");
  await clickAt(pelican.x, pelican.y);
  await page.waitForURL(/\/p\/ymaj6x4uw6/, { timeout: 15000 });
  await page.waitForTimeout(700);
  mark("prompt");

  await smoothScroll(250, 520);
  await page.waitForTimeout(700);

  const cards = await page.locator('a[href^="/s/"]').evaluateAll((nodes) => {
    const seen = new Set();
    return nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          href: node.getAttribute("href"),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((item) => {
        if (item.width < 300 || !item.href) return false;
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      })
      .sort((a, b) => (Math.abs(a.y - b.y) > 20 ? a.y - b.y : a.x - b.x));
  });
  console.log("CARDS", cards);

  const hoverTargets = cards.slice(0, 3);
  for (const [index, card] of hoverTargets.entries()) {
    await smoothMove(card.x + card.width / 2, card.y + card.height / 2, 460);
    await page.waitForTimeout(1250);
    mark(`hover-${index + 1}`);
  }

  const deepseek = cards.find((card) => card.href?.startsWith("/s/qb2qrxalyc1irq"));
  if (!deepseek) throw new Error("DeepSeek card not found");
  if (deepseek.y < 100 || deepseek.y + deepseek.height > 860) {
    await smoothScroll(Math.max(0, deepseek.y - 150), 620);
    await page.waitForTimeout(300);
    const box = await page.locator('a[href^="/s/qb2qrxalyc1irq"]').first().boundingBox();
    Object.assign(deepseek, { x: box.x, y: box.y, width: box.width, height: box.height });
  }
  await clickAt(deepseek.x + deepseek.width / 2, deepseek.y + deepseek.height / 2);
  await page.waitForURL(/\/s\/qb2qrxalyc1irq/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  mark("detail");

  await page.mouse.move(1240, 840);
  await page.waitForTimeout(900);
  mark("end");
} catch (error) {
  console.error("NAV FAILED", error);
  await page.screenshot({ path: join(outDir, "nav-failure.png") }).catch(() => {});
  throw error;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();

  const file = readdirSync(videoDir).find((name) => name.endsWith(".webm"));
  if (!file) throw new Error("no video recorded");
  const videoPath = join(videoDir, file);
  const startMark = marks.find((m) => m.name === "home-ready")?.at ?? 0;
  const endMark = marks.find((m) => m.name === "end")?.at ?? startMark + 15000;
  const start = Math.max(0.05, (startMark + 250) / 1000);
  const duration = Math.max(3, (endMark - startMark - 250) / 1000);
  console.log({ videoPath, start, duration });

  const gif = join(outDir, "nav.gif");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-i",
      videoPath,
      "-vf",
      `setpts=PTS/${SPEED},fps=12,scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      "-loop",
      "0",
      gif,
    ],
    { stdio: "inherit" },
  );

  const mp4 = join(outDir, "nav.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-i",
      videoPath,
      "-vf",
      `setpts=PTS/${SPEED},scale=1440:-2:flags=lanczos`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4,
    ],
    { stdio: "inherit" },
  );

  console.log(gif);
  console.log(mp4);
}
