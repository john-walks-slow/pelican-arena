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

// 2. Mobile Screenshot: Ocean Prompt Detail (393x798 @ 3x for 852 - 54px status bar)
// Scrolled with DeepSeek V4.1 card placed directly under the sticky header
console.log("Capturing latest live mobile view (Ocean + DeepSeek V4.1 top-aligned)...");
const mobileContext = await browser.newContext({
  viewport: { width: 393, height: 798 },
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

await mobilePage.evaluate(() => {
  const card = document.querySelector('a[href*="tdm8a3xi048b35"]');
  if (card) {
    const rect = card.getBoundingClientRect();
    // Sticky header total height is ~94px + 12px padding
    const targetY = 94 + 12;
    window.scrollBy({ top: rect.top - targetY, behavior: "instant" });
  }
});
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
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "DM Sans", sans-serif;
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
    right: 50px;
    bottom: 35px;
    width: 420px;
    height: 879px;
    z-index: 20;
    filter: drop-shadow(-24px 36px 64px rgba(15, 23, 42, 0.32)) drop-shadow(0 12px 24px rgba(15, 23, 42, 0.15));
  }

  .iphone-frame {
    width: 100%;
    height: 100%;
    background: #25282e;
    border-radius: 60px;
    padding: 13.5px;
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
    border-radius: 48px;
    overflow: hidden;
    position: relative;
    background: #f8f9fb;
  }

  /* Simulated iOS Status Bar */
  .iphone-status-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 54px;
    background: #f8f9fb;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 28px 0 32px;
  }

  .status-time {
    font-size: 15px;
    font-weight: 600;
    color: #101318;
    letter-spacing: -0.02em;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "DM Sans", sans-serif;
    margin-top: 2px;
  }

  .dynamic-island {
    position: absolute;
    top: 11px;
    left: 50%;
    transform: translateX(-50%);
    width: 124px;
    height: 35px;
    background: #000;
    border-radius: 20px;
    z-index: 42;
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

  .status-icons {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 1px;
  }

  /* Webview below status bar */
  .iphone-webview {
    position: absolute;
    top: 54px;
    left: 0;
    width: 100%;
    height: 798px;
    overflow: hidden;
    background: #f8f9fb;
  }

  .mobile-display {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* iOS Home Indicator Bar */
  .home-indicator {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 136px;
    height: 5px;
    background: #101318;
    border-radius: 3px;
    z-index: 50;
    opacity: 0.85;
  }

  /* Glass reflection sheen across phone screen */
  .phone-reflection {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 48px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 40%, transparent 60%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    z-index: 45;
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
          <div class="iphone-status-bar">
            <div class="status-time">9:41</div>
            <div class="dynamic-island">
              <div class="camera"></div>
            </div>
            <div class="status-icons">
              <svg width="18" height="12" viewBox="0 0 18 12" fill="#101318">
                <rect x="0.5" y="8.5" width="3" height="3.5" rx="0.8" />
                <rect x="4.5" y="6" width="3" height="6" rx="0.8" />
                <rect x="8.5" y="3.5" width="3" height="8.5" rx="0.8" />
                <rect x="12.5" y="0.5" width="3" height="11.5" rx="0.8" />
              </svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="#101318">
                <path d="M8 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-3.3-2.3a4.6 4.6 0 0 1 6.6 0 .8.8 0 0 0 1.1-1.1 6.2 6.2 0 0 0-8.8 0 .8.8 0 1 0 1.1 1.1zm-2.8-2.8a8.5 8.5 0 0 1 12.2 0 .8.8 0 0 0 1.1-1.1 10.1 10.1 0 0 0-14.4 0 .8.8 0 1 0 1.1 1.1z" />
              </svg>
              <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
                <rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.5" stroke="#101318" stroke-width="1.2" opacity="0.35" />
                <path d="M25 4.5v4c.7 0 1.2-.5 1.2-1.2v-1.6c0-.7-.5-1.2-1.2-1.2z" fill="#101318" opacity="0.4" />
                <rect x="2.5" y="2.5" width="18" height="8" rx="2" fill="#101318" />
              </svg>
            </div>
          </div>
          <div class="iphone-webview">
            <img class="mobile-display" src="${mobileB64}" alt="Pelican Arena Mobile" />
          </div>
          <div class="home-indicator"></div>
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
