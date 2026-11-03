import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? "playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROME || undefined,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.setContent(`<!doctype html><style>
  html,body{margin:0;height:100%;background:#fff;overflow:hidden}
  #box{position:absolute;left:0;top:300px;width:120px;height:120px;background:#c2410c;border-radius:20px;animation:go 2s linear infinite}
  @keyframes go{from{transform:translateX(0)}to{transform:translateX(1200px)}}
</style><div id="box"></div>`);

const client = await context.newCDPSession(page);
let frames = 0;
const timestamps = [];
client.on("Page.screencastFrame", async (event) => {
  frames += 1;
  timestamps.push(event.metadata.timestamp);
  await client.send("Page.screencastFrameAck", { sessionId: event.sessionId });
});
await client.send("Page.startScreencast", {
  format: "jpeg",
  quality: 80,
  maxWidth: 1440,
  maxHeight: 900,
  everyNthFrame: 1,
});
await page.waitForTimeout(2000);
await client.send("Page.stopScreencast");
const span = timestamps.length > 1 ? timestamps.at(-1) - timestamps[0] : 0;
console.log({ frames, span, fps: span ? (frames - 1) / span : 0 });
await browser.close();
