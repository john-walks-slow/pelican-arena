import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const framesDir = join(tmpdir(), "pelican-share-assets", "shock-frames");
const outGif = join(root, ".shots/share-post/shock.gif");
const outWebp = join(root, ".shots/share-post/shock.webp");
const still = join(root, ".shots/share-post/shock-still.png");

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(join(root, ".shots/share-post"), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 380, height: 250 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(root, "scripts/share-assets/shock.html")}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);

const width = 380;
const height = 250;
const fps = 25;
const totalDuration = 3000; // ms
const frames = Math.round((totalDuration / 1000) * fps); // 75 frames

for (let i = 0; i < frames; i += 1) {
  const t = (i * totalDuration) / frames;
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, t);
  const framePath = join(framesDir, `f${String(i).padStart(4, "0")}.png`);
  await page.screenshot({ path: framePath });
  if (i === Math.round(frames * 0.45)) {
    await page.screenshot({ path: still });
  }
}

await browser.close();

// Render GIF
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

// Render WebP
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

console.log("Rendered shock:", outGif, outWebp);
