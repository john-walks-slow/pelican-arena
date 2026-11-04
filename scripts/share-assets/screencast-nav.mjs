import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const work = join(tmpdir(), "pelican-share-screencast");
const framesDir = join(work, "frames");
const outDir = join(root, ".shots/share-post");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: [
    "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    "--enable-features=ViewTransition",
    "--disable-features=Translate",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.25,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

// Cursor with prominent click ripple effect
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
          width: 22px; height: 26px; pointer-events: none;
          transform: translate3d(1270px, 820px, 0);
          filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
          /* Completely static cursor - no twitch, scale or movement on click */
        }
        #__dsh_cursor svg { display: block; width: 100%; height: 100%; }

        /* Elegant expanding ripple ring emerging from under cursor tip */
        .cursor-click-ripple {
          position: fixed;
          z-index: 2147483645;
          pointer-events: none;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid rgba(194, 65, 12, 0.75);
          background: radial-gradient(circle, rgba(194, 65, 12, 0.24) 0%, rgba(194, 65, 12, 0) 70%);
          transform: translate(-50%, -50%) scale(0.15);
          opacity: 0.85;
          animation: dsh-ripple 460ms cubic-bezier(0.15, 0.8, 0.35, 1) forwards;
        }

        @keyframes dsh-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.15);
            opacity: 0.85;
            border-width: 2.5px;
          }
          60% {
            opacity: 0.6;
            border-width: 1.8px;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0;
            border-width: 1px;
          }
        }
      `;
      document.head.append(style);

      const el = document.createElement("div");
      el.id = "__dsh_cursor";
      el.innerHTML = `<svg viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.2 2.1 L2.2 19.2 L7.1 14.6 L10.6 22.1 L14.2 20.4 L10.7 13 L17.4 12.8 Z"
          fill="#101318" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
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

      window.addEventListener("mousedown", (e) => {
        const ripple = document.createElement("div");
        ripple.className = "cursor-click-ripple";
        ripple.style.left = `${e.clientX}px`;
        ripple.style.top = `${e.clientY}px`;
        document.body.append(ripple);
        setTimeout(() => ripple.remove(), 500);
      });
    } catch (error) {
      console.error("cursor overlay failed", error);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
});

const page = await context.newPage();

// CDP session for full-framerate screencast
const cdp = await context.newCDPSession(page);
let frameIndex = 0;
const recordedFrames = [];

cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  try {
    const timestamp = metadata.timestamp;
    const buf = Buffer.from(data, "base64");
    const filename = `frame_${String(frameIndex).padStart(5, "0")}.jpg`;
    const filepath = join(framesDir, filename);
    writeFileSync(filepath, buf);
    recordedFrames.push({ file: filepath, timestamp });
    frameIndex += 1;
    await cdp.send("Page.screencastFrameAck", { sessionId });
  } catch (e) {
    // ignore
  }
});

async function smoothMove(x, y, duration = 500) {
  const from = await page.evaluate(() => ({ x: window.__cursorX ?? 1270, y: window.__cursorY ?? 820 }));
  const steps = Math.max(6, Math.round(duration / 16));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * ease, from.y + (y - from.y) * ease);
    await page.waitForTimeout(duration / steps);
  }
}

async function smoothScroll(y, duration = 450) {
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
  await smoothMove(x, y, 480);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(120); // show ripple click
  await page.mouse.up();
}

console.log("Navigating to home...");
await page.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
await page.waitForTimeout(500);

// Start screencast now
console.log("Starting screencast...");
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 90,
  maxWidth: 1440,
  maxHeight: 900,
  everyNthFrame: 1,
});

// 1. On home page: NO HOVER, directly move to Pelican prompt and CLICK!
console.log("1. Directly move and click pelican prompt on home...");
const pelicanCard = page.locator('a[href="/p/ymaj6x4uw6"]').first();
let box = await pelicanCard.boundingBox();
if (box && box.y > 750) {
  await pelicanCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  box = await pelicanCard.boundingBox();
}
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// Direct click without pausing
await clickAt(cx, cy);
await page.waitForURL(/\/p\/ymaj6x4uw6/, { timeout: 15000 });
await page.waitForTimeout(650);

// 2. Scroll to answers
console.log("2. Scroll to answers...");
await smoothScroll(320, 480);
await page.waitForTimeout(400);

// Get cards
const answerCards = await page.locator('a[href^="/s/"]').evaluateAll((nodes) => {
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

console.log(`Found ${answerCards.length} answer cards.`);

// 3. Hover 2 cards to see previews
for (let i = 0; i < Math.min(2, answerCards.length); i++) {
  const card = answerCards[i];
  console.log(`Hovering card ${i + 1}...`);
  await smoothMove(card.x + card.width / 2, card.y + card.height / 2, 450);
  await page.waitForTimeout(950);
}

// 4. Hover and click DeepSeek V4.1 card
const dsCard = answerCards.find((c) => c.href.includes("qb2qrxalyc1irq")) || answerCards[2] || answerCards[0];
console.log(`Hovering DeepSeek card (${dsCard.href})...`);
await smoothMove(dsCard.x + dsCard.width / 2, dsCard.y + dsCard.height / 2, 450);
await page.waitForTimeout(1000);

console.log("Clicking DeepSeek card...");
await clickAt(dsCard.x + dsCard.width / 2, dsCard.y + dsCard.height / 2);
await page.waitForURL(/\/s\/qb2qrxalyc1irq/, { timeout: 15000 });

// 5. On detail page: pause to appreciate
console.log("Detail loaded. Pausing...");
await page.waitForTimeout(1600);

await cdp.send("Page.stopScreencast");
console.log(`Recorded ${recordedFrames.length} frames.`);

await browser.close();

// Normalize to 30fps
const t0 = recordedFrames[0].timestamp;
const totalDuration = recordedFrames[recordedFrames.length - 1].timestamp - t0;
console.log(`Total duration: ${totalDuration.toFixed(2)}s, average fps: ${(recordedFrames.length / totalDuration).toFixed(1)}`);

const normalizedDir = join(work, "norm30");
rmSync(normalizedDir, { recursive: true, force: true });
mkdirSync(normalizedDir, { recursive: true });

const targetFps = 30;
const totalNormFrames = Math.round(totalDuration * targetFps);
let curIdx = 0;

for (let i = 0; i < totalNormFrames; i++) {
  const targetTime = t0 + i / targetFps;
  while (curIdx < recordedFrames.length - 1 && recordedFrames[curIdx + 1].timestamp <= targetTime) {
    curIdx++;
  }
  const normFile = join(normalizedDir, `norm_${String(i).padStart(5, "0")}.jpg`);
  execFileSync("ln", ["-s", recordedFrames[curIdx].file, normFile]);
}

console.log(`Normalized to ${totalNormFrames} frames at 30fps.`);

// Output smooth WebP (30fps)
const outWebp = join(outDir, "nav.webp");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    "30",
    "-i",
    join(normalizedDir, "norm_%05d.jpg"),
    "-vf",
    "scale=1100:-1:flags=lanczos",
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-quality",
    "72",
    "-compression_level",
    "6",
    "-loop",
    "0",
    outWebp,
  ],
  { stdio: "inherit" },
);

// Output smooth GIF (20fps, scaled 800)
const outGif = join(outDir, "nav.gif");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    "20",
    "-i",
    join(normalizedDir, "norm_%05d.jpg"),
    "-vf",
    "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop",
    "0",
    outGif,
  ],
  { stdio: "inherit" },
);

// Optimize GIF with gifsicle
execFileSync("gifsicle", ["-O3", "--lossy=80", outGif, "-o", outGif]);

// Output MP4 high quality
const outMp4 = join(outDir, "nav.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    "30",
    "-i",
    join(normalizedDir, "norm_%05d.jpg"),
    "-vf",
    "scale=1440:-2:flags=lanczos",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outMp4,
  ],
  { stdio: "inherit" },
);

console.log("Done! Generated:");
console.log(execFileSync("ls", ["-lh", outWebp, outGif, outMp4], { encoding: "utf8" }));
