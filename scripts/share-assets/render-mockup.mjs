import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const root = process.cwd();
const outDir = join(root, ".shots/share-post");
const work = join(tmpdir(), "pelican-dual-device");
mkdirSync(work, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});

// 1. Desktop Screenshot: Home Gallery (1440x920 @ 2x) from latest live site
console.log("Capturing latest live desktop view...");
const desktopContext = await browser.newContext({
  viewport: { width: 1440, height: 920 },
  deviceScaleFactor: 2,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});
const desktopPage = await desktopContext.newPage();
await desktopPage.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
await desktopPage.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
await desktopPage.waitForTimeout(1000);
const desktopShotPath = join(work, "desktop.png");
await desktopPage.screenshot({ path: desktopShotPath });
await desktopContext.close();

// 2. Mobile Screenshot: Ocean Prompt Detail scrolled to DeepSeek V4.1 Flash
console.log("Capturing latest live mobile view (Ocean + DeepSeek V4.1)...");
const mobileContext = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto("https://pelicanarena.dpdns.org/p/e1onsfq0nd", { waitUntil: "networkidle" });
await mobilePage.waitForFunction(() => !document.documentElement.hasAttribute("data-booting"), null, { timeout: 15000 });
await mobilePage.waitForTimeout(1000);

const dsLocator = mobilePage.locator('a[href*="tdm8a3xi048b35"]').first();
await dsLocator.scrollIntoViewIfNeeded();
await mobilePage.evaluate(() => window.scrollBy(0, -100));
await mobilePage.waitForTimeout(800);

const mobileShotPath = join(work, "mobile.png");
await mobilePage.screenshot({ path: mobileShotPath });
await mobileContext.close();

// Read base64
const desktopB64 = `data:image/png;base64,${readFileSync(desktopShotPath).toString("base64")}`;
const mobileB64 = `data:image/png;base64,${readFileSync(mobileShotPath).toString("base64")}`;

// 3. Compose high-end mockup in a 2400x1500 canvas
console.log("Composing dual device mockup...");
const composerPage = await browser.newPage({
  viewport: { width: 2400, height: 1500 },
  deviceScaleFactor: 1,
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 2400px;
    height: 1500px;
    overflow: hidden;
    background: radial-gradient(120% 120% at 50% 10%, #ffffff 0%, #f6f8fb 55%, #e9edf3 100%);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "DM Sans", sans-serif;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Studio background ambient lighting */
  .ambient-glow {
    position: absolute;
    top: 5%;
    left: 30%;
    width: 900px;
    height: 600px;
    background: radial-gradient(circle, rgba(194, 65, 12, 0.04) 0%, rgba(255, 255, 255, 0) 70%);
    pointer-events: none;
  }

  .ambient-light-bottom {
    position: absolute;
    bottom: -10%;
    left: 20%;
    right: 20%;
    height: 400px;
    background: radial-gradient(ellipse at center, rgba(16, 24, 40, 0.08) 0%, rgba(0,0,0,0) 70%);
    pointer-events: none;
  }

  .stage {
    position: relative;
    width: 2000px;
    height: 1200px;
  }

  /* Desktop Laptop Mockup */
  .desktop-wrap {
    position: absolute;
    left: 60px;
    top: 40px;
    width: 1540px;
    filter: drop-shadow(0 45px 90px rgba(15, 23, 42, 0.18)) drop-shadow(0 15px 30px rgba(15, 23, 42, 0.08));
  }

  .macbook-screen {
    width: 1540px;
    height: 984px;
    background: #0f1115;
    border-radius: 28px 28px 0 0;
    padding: 18px 18px 0 18px;
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.22), inset 0 2px 5px rgba(0,0,0,0.5);
    position: relative;
  }

  .screen-bezel-inner {
    width: 100%;
    height: 966px;
    background: #000;
    border-radius: 12px 12px 0 0;
    overflow: hidden;
    position: relative;
  }

  .camera-notch {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 170px;
    height: 24px;
    background: #000;
    border-radius: 0 0 10px 10px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .camera-lens {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #0b1726;
    box-shadow: inset 0 0 1px 1px rgba(255, 255, 255, 0.35);
  }

  .desktop-display {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .macbook-base {
    position: relative;
    width: 1740px;
    height: 22px;
    margin-left: -100px;
    background: linear-gradient(to bottom, #d2d5dc 0%, #b4b8c2 45%, #888e99 100%);
    border-radius: 2px 2px 16px 16px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 6px 16px rgba(0, 0, 0, 0.25);
  }

  .macbook-notch-lip {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    height: 6px;
    background: #737780;
    border-radius: 0 0 5px 5px;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.4);
  }

  .macbook-foot {
    position: absolute;
    bottom: -4px;
    width: 160px;
    height: 4px;
    background: #3a3d42;
    border-radius: 0 0 4px 4px;
  }
  .macbook-foot.left { left: 160px; }
  .macbook-foot.right { right: 160px; }

  /* Mobile Phone Mockup */
  .mobile-wrap {
    position: absolute;
    right: 40px;
    bottom: 40px;
    width: 440px;
    height: 894px;
    z-index: 20;
    filter: drop-shadow(-24px 36px 64px rgba(15, 23, 42, 0.32)) drop-shadow(0 12px 24px rgba(15, 23, 42, 0.15));
  }

  .iphone-frame {
    width: 100%;
    height: 100%;
    background: #25282e;
    border-radius: 62px;
    padding: 13px;
    box-shadow: 
      inset 0 0 0 2px #515663,
      inset 0 0 0 4.5px #15171b,
      0 0 0 1.5px #3f434c,
      0 0 0 3px rgba(255, 255, 255, 0.3);
    position: relative;
  }

  .iphone-screen {
    width: 100%;
    height: 100%;
    border-radius: 50px;
    overflow: hidden;
    position: relative;
    background: #fff;
  }

  .dynamic-island {
    position: absolute;
    top: 13px;
    left: 50%;
    transform: translateX(-50%);
    width: 124px;
    height: 35px;
    background: #000;
    border-radius: 20px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 14px;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
  .dynamic-island .camera {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #0f1624;
    box-shadow: inset 0 0 2px 1px rgba(255, 255, 255, 0.25);
  }

  .mobile-display {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Glass reflection sheen across phone screen */
  .phone-reflection {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 50px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 40%, transparent 60%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    z-index: 25;
  }
</style>
</head>
<body>
  <div class="ambient-glow"></div>
  <div class="ambient-light-bottom"></div>

  <div class="stage">
    <!-- Desktop (MacBook Pro) -->
    <div class="desktop-wrap">
      <div class="macbook-screen">
        <div class="screen-bezel-inner">
          <div class="camera-notch">
            <div class="camera-lens"></div>
          </div>
          <img class="desktop-display" src="${desktopB64}" alt="Pelican Arena Desktop" />
        </div>
      </div>
      <div class="macbook-base">
        <div class="macbook-notch-lip"></div>
        <div class="macbook-foot left"></div>
        <div class="macbook-foot right"></div>
      </div>
    </div>

    <!-- Mobile (iPhone 16 Pro) -->
    <div class="mobile-wrap">
      <div class="iphone-frame">
        <div class="iphone-screen">
          <div class="dynamic-island">
            <div class="camera"></div>
          </div>
          <img class="mobile-display" src="${mobileB64}" alt="Pelican Arena Mobile" />
          <div class="phone-reflection"></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

await composerPage.setContent(html, { waitUntil: "load" });
await composerPage.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
await composerPage.waitForTimeout(500);

const outMockup = join(outDir, "showcase-dual-device.png");
await composerPage.screenshot({ path: outMockup, clip: { x: 0, y: 0, width: 2400, height: 1500 } });

console.log("Mockup saved to:", outMockup);
await browser.close();
