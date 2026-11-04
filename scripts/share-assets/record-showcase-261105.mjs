import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const pwPath = process.env.PW_PATH ?? "playwright";
const { chromium } = require(pwPath);

const root = process.cwd();
const work = join(tmpdir(), "pelican-share-261105");
const framesDir = join(work, "frames");
const outDir = join(root, ".shots/share-post");
const assetsDir = join(root, "assets");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

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
        }
        #__dsh_cursor svg { display: block; width: 100%; height: 100%; }

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

// Set welcomed so screencast explores main arena directly
await page.addInitScript(() => {
  try {
    localStorage.setItem("pelican_welcomed", "1");
  } catch (e) {}
});

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
  } catch (e) {}
});

async function smoothMove(x, y, duration = 480) {
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
  await page.waitForTimeout(120);
  await page.mouse.up();
}

console.log("Navigating to live production...");
await page.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
await page.waitForTimeout(600);

console.log("Starting screencast...");
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 92,
  maxWidth: 1440,
  maxHeight: 900,
  everyNthFrame: 1,
});

// 1. Move and click pelican prompt on home
console.log("1. Move and click pelican prompt on home...");
const pelicanCard = page.locator('a[href="/p/ymaj6x4uw6"]').first();
let box = await pelicanCard.boundingBox();
if (box && box.y > 750) {
  await pelicanCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  box = await pelicanCard.boundingBox();
}
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

await clickAt(cx, cy);
await page.waitForURL(/\/p\/ymaj6x4uw6/, { timeout: 15000 });
await page.waitForTimeout(700);

// 2. Scroll to answers
console.log("2. Scroll to answers...");
await smoothScroll(320, 480);
await page.waitForTimeout(400);

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
      if (!item.href || seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
});

// 3. Hover 2 cards to see live preview
for (let i = 0; i < Math.min(2, answerCards.length); i++) {
  const card = answerCards[i];
  console.log(`Hovering card ${i + 1}...`);
  await smoothMove(card.x + card.width / 2, card.y + card.height / 2, 450);
  await page.waitForTimeout(950);
}

// 4. Hover DeepSeek card
const dsCard = answerCards.find((c) => c.href.includes("qb2qrxalyc1irq")) || answerCards[2] || answerCards[0];
console.log(`Hovering DeepSeek card (${dsCard.href})...`);
await smoothMove(dsCard.x + dsCard.width / 2, dsCard.y + dsCard.height / 2, 450);
await page.waitForTimeout(1100);

// 5. Instead of cutting off on navigation, settle on the animated card view!
// Pausing on the live multi-agent canvas provides the best aesthetic stopping point
console.log("Screencast complete, stopping capture...");
await page.waitForTimeout(800);

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
const totalNormFrames = Math.max(1, Math.round(totalDuration * targetFps));
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

// Output base video: nav-261105.mp4
const outNavMp4 = join(outDir, "nav-261105.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel", "error",
    "-framerate", "30",
    "-i", join(normalizedDir, "norm_%05d.jpg"),
    "-vf", "scale=1440:-2:flags=lanczos",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outNavMp4,
  ],
  { stdio: "inherit" },
);

// Output base GIF: nav-261105.gif
const outNavGif = join(outDir, "nav-261105.gif");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel", "error",
    "-framerate", "20",
    "-i", join(normalizedDir, "norm_%05d.jpg"),
    "-vf", "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop", "0",
    outNavGif,
  ],
  { stdio: "inherit" },
);

// Output base WebP: nav-261105.webp (Pure yuv420p, NO alpha corruption)
const outNavWebp = join(outDir, "nav-261105.webp");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel", "error",
    "-framerate", "20",
    "-i", join(normalizedDir, "norm_%05d.jpg"),
    "-vf", "scale=1000:-1:flags=lanczos,format=yuv420p",
    "-c:v", "libwebp_anim",
    "-lossless", "0",
    "-q:v", "75",
    "-compression_level", "4",
    "-loop", "0",
    outNavWebp,
  ],
  { stdio: "inherit" },
);

// Now generate nav-showcase-261105 with 2.0s device intro fading into live demo
const mockupShot = join(outDir, "showcase-dual-device.png");
if (existsSync(mockupShot)) {
  console.log("Composing nav-showcase-261105 with device intro...");
  const outShowcaseMp4 = join(outDir, "nav-showcase-261105.mp4");

  // Create 2.0s still clip of mockup, crossfade 0.5s into nav video
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel", "error",
      "-loop", "1",
      "-t", "2.0",
      "-i", mockupShot,
      "-i", outNavMp4,
      "-filter_complex",
      "[0:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=30,settb=AVTB[intro];" +
      "[1:v]fps=30,settb=AVTB[main];" +
      "[intro][main]xfade=transition=fade:duration=0.5:offset=1.5,format=yuv420p[v]",
      "-map", "[v]",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outShowcaseMp4,
    ],
    { stdio: "inherit" },
  );

  // Showcase GIF
  const outShowcaseGif = join(outDir, "nav-showcase-261105.gif");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel", "error",
      "-i", outShowcaseMp4,
      "-vf", "fps=20,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
      "-loop", "0",
      outShowcaseGif,
    ],
    { stdio: "inherit" },
  );

  // Showcase WebP (Pure yuv420p, zero corruption)
  const outShowcaseWebp = join(outDir, "nav-showcase-261105.webp");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel", "error",
      "-i", outShowcaseMp4,
      "-vf", "fps=20,scale=1000:-1:flags=lanczos,format=yuv420p",
      "-c:v", "libwebp_anim",
      "-lossless", "0",
      "-q:v", "75",
      "-compression_level", "4",
      "-loop", "0",
      outShowcaseWebp,
    ],
    { stdio: "inherit" },
  );

  // Copy to assets directory
  copyFileSync(outShowcaseMp4, join(assetsDir, "nav-showcase-261105.mp4"));
  copyFileSync(outShowcaseGif, join(assetsDir, "nav-showcase-261105.gif"));
  copyFileSync(outShowcaseWebp, join(assetsDir, "nav-showcase-261105.webp"));
}

copyFileSync(outNavMp4, join(assetsDir, "nav-261105.mp4"));
copyFileSync(outNavGif, join(assetsDir, "nav-261105.gif"));
copyFileSync(outNavWebp, join(assetsDir, "nav-261105.webp"));

console.log("All dated 261105 showcase assets successfully generated and saved to assets/!");
