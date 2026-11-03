import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  if (window.top !== window) return;
  window.__cursorX = 1270;
  window.__cursorY = 820;
  const start = () => {
    try {
      const style = document.createElement("style");
      style.textContent =
        "#__dsh_cursor{position:fixed;left:0;top:0;z-index:2147483647;width:20px;height:24px;pointer-events:none;transform:translate3d(1270px,820px,0)}";
      document.head.append(style);
      const el = document.createElement("div");
      el.id = "__dsh_cursor";
      el.innerHTML =
        '<svg viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.2 2.1 L2.2 19.2 L7.1 14.6 L10.6 22.1 L14.2 20.4 L10.7 13 L17.4 12.8 Z" fill="#101318" stroke="#ffffff" stroke-width="1.5"/></svg>';
      document.body.append(el);
      window.addEventListener("mousemove", (event) => {
        window.__cursorX = event.clientX;
        window.__cursorY = event.clientY;
        const cursor = document.getElementById("__dsh_cursor");
        if (cursor) cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }, { passive: true });
      window.__cursorInit = "done";
    } catch (error) {
      window.__cursorInit = "error:" + error.message;
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
});
const page = await context.newPage();
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
page.on("console", (message) => { if (message.type() === "error") console.log("CONSOLE", message.text()); });
await page.goto("https://pelicanarena.dpdns.org/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log(
  await page.evaluate(() => ({
    init: window.__cursorInit,
    cursor: Boolean(document.getElementById("__dsh_cursor")),
    rect: document.getElementById("__dsh_cursor")?.getBoundingClientRect().toJSON(),
    z: getComputedStyle(document.getElementById("__dsh_cursor") || document.body).zIndex,
  })),
);
await page.mouse.move(826, 656);
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/cursor-test.png" });
console.log(
  await page.evaluate(() => ({
    init: window.__cursorInit,
    cursor: Boolean(document.getElementById("__dsh_cursor")),
    rect: document.getElementById("__dsh_cursor")?.getBoundingClientRect().toJSON(),
  })),
);
await browser.close();
