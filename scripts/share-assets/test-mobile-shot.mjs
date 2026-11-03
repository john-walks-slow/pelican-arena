import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});

const mobileContext = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

const page = await mobileContext.newPage();
await page.goto("https://pelicanarena.dpdns.org/p/e1onsfq0nd", { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
await page.waitForTimeout(1000);

// Find DeepSeek card
const dsLocator = page.locator('a[href*="tdm8a3xi048b35"]').first();
await dsLocator.scrollIntoViewIfNeeded();
// Adjust scroll slightly so card is centered nicely in mobile viewport
await page.evaluate(() => window.scrollBy(0, -100));
await page.waitForTimeout(800);

await page.screenshot({ path: "/tmp/mobile-ocean-ds.png" });
console.log("Mobile screenshot captured");

await browser.close();
