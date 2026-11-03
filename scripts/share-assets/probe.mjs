import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.screenshot({ path: ".shots/share-post/probe-home.png" });

const cards = await page.locator('a[href^="/p/"]').evaluateAll((nodes) =>
  nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return { href: n.getAttribute("href"), text: n.innerText.replace(/\s+/g, " ").slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }),
);
console.log("HOME CARDS", JSON.stringify(cards, null, 2));

await page.goto("https://pelicanarena.dpdns.org/p/ymaj6x4uw6", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: ".shots/share-post/probe-prompt.png" });

const answers = await page.locator('a[href^="/s/"]').evaluateAll((nodes) =>
  nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return { href: n.getAttribute("href"), text: n.innerText.replace(/\s+/g, " ").slice(0, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }),
);
console.log("ANSWER CARDS", JSON.stringify(answers, null, 2));

await page.locator('a[href^="/s/qb2qrxalyc1irq"]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: ".shots/share-post/probe-answers.png" });
const box = await page.locator('a[href^="/s/qb2qrxalyc1irq"]').first().boundingBox();
console.log("DEEPSEEK CARD", box);

await page.goto("https://pelicanarena.dpdns.org/s/qb2qrxalyc1irq", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: ".shots/share-post/probe-detail.png" });

await browser.close();
