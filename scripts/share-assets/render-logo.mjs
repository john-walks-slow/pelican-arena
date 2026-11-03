import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const framesDir = join(tmpdir(), "pelican-share-assets", "logo-frames");
const outGif = join(root, ".shots/share-post/logo-loop.gif");
const outWebp = join(root, ".shots/share-post/logo-loop.webp");
const still = join(root, ".shots/share-post/logo-still.png");

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(join(root, ".shots/share-post"), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 620, height: 220 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(root, "scripts/share-assets/logo.html")}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);

const width = 620;
const height = 220;
const fps = 100 / 3;
const frames = 100;
for (let i = 0; i < frames; i += 1) {
  const t = (i * 3000) / frames;
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, t);
  await page.screenshot({ path: join(framesDir, `f${String(i).padStart(4, "0")}.png`) });
  if (i === 50) await page.screenshot({ path: still });
}

await browser.close();

// 1. Output GIF
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    join(framesDir, "f%04d.png"),
    "-vf",
    `scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    "-loop",
    "0",
    outGif,
  ],
  { stdio: "inherit" },
);

// 2. Output WebP
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    join(framesDir, "f%04d.png"),
    "-vf",
    `scale=${width}:${height}:flags=lanczos`,
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-quality",
    "85",
    "-loop",
    "0",
    outWebp,
  ],
  { stdio: "inherit" },
);

console.log("Rendered updated logo loop:", outGif, outWebp, still);
