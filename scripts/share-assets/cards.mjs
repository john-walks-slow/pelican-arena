import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const outDir = join(root, ".shots/share-post");
mkdirSync(outDir, { recursive: true });

const cards = [
  { slug: "sea", id: "tdm8a3xi048b35", label: "大海 · DeepSeek V4.1 Flash" },
  { slug: "tetris", id: "183h6d1rqklzlb", label: "俄罗斯方块 · DeepSeek V4.1 Flash" },
];

const svgs = new Map();
for (const card of cards) {
  const response = await fetch(`https://pelicanarena.dpdns.org/s/${card.id}/card.svg`);
  if (!response.ok) throw new Error(`${card.id}: ${response.status}`);
  svgs.set(card.slug, await response.text());
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});

async function renderCard(card, scale) {
  const page = await browser.newPage({
    viewport: { width: 600, height: 380 },
    deviceScaleFactor: scale,
  });
  const svg = svgs.get(card.slug);
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;background:#fff}img{display:block;width:600px;height:380px}</style></head>
     <body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" /></body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate(() => document.images[0].decode());
  const path = join(outDir, `card-${card.slug}.png`);
  await page.screenshot({ path, clip: { x: 0, y: 0, width: 600, height: 380 } });
  await page.close();
  return path;
}

for (const card of cards) {
  const path = await renderCard(card, 2);
  console.log(card.label, path);
}

const twoUp = await browser.newPage({ viewport: { width: 1240, height: 400 }, deviceScaleFactor: 2 });
const imgs = cards
  .map(
    (card, index) =>
      `<img src="data:image/svg+xml;base64,${Buffer.from(svgs.get(card.slug)).toString("base64")}" style="position:absolute;left:${20 + index * 620}px;top:10px;width:600px;height:380px" />`,
  )
  .join("");
await twoUp.setContent(
  `<!doctype html><html><head><style>html,body{margin:0;background:#fff}img{display:block}</style></head><body>${imgs}</body></html>`,
  { waitUntil: "load" },
);
await twoUp.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
const twoUpRaw = join(tmpdir(), "pelican-share-assets", "cards-2up@2x.png");
await twoUp.screenshot({ path: twoUpRaw, clip: { x: 0, y: 0, width: 1240, height: 400 } });
await twoUp.close();
await browser.close();

const twoUpPath = join(outDir, "cards-2up.png");
execFileSync(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-i", twoUpRaw, "-vf", "scale=1240:400:flags=lanczos", "-frames:v", "1", twoUpPath],
  { stdio: "inherit" },
);
console.log(twoUpPath);
