import http from 'node:http';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 8790);
const TOKEN = process.env.RENDER_TOKEN;
const ALLOWED_HOST = process.env.ALLOWED_HOST || 'pelicanarena.elsewhere.dpdns.org';
const WIDTH = 1200;
const HEIGHT = 630;
const CONCURRENCY = Number(process.env.CONCURRENCY || 2);
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT || 15000);
const SETTLE_MS = Number(process.env.SETTLE_MS || 700);
const PAINT_TIMEOUT = Number(process.env.PAINT_TIMEOUT || 12000);
const MIN_BYTES = Number(process.env.MIN_BYTES || 6000);
const PROXY_SERVER = process.env.PROXY_SERVER || '';

if (!TOKEN) {
  console.error('RENDER_TOKEN is required');
  process.exit(1);
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-color-profile=srgb',
          ...(PROXY_SERVER ? [`--proxy-server=${PROXY_SERVER}`] : []),
        ],
      })
      .then((browser) => {
        browser.on('disconnected', () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

const queue = [];
let active = 0;

function run(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pump();
  });
}

function pump() {
  while (active < CONCURRENCY && queue.length > 0) {
    const { task, resolve, reject } = queue.shift();
    active += 1;
    task()
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

async function render(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    } catch (err) {
      console.warn('navigation settle timeout', url, err.message);
    }
    // Screenshot until the frame is no longer blank: WebGL canvases cannot be
    // probed from JS, but an empty capture compresses to a couple of KB.
    const deadline = Date.now() + PAINT_TIMEOUT;
    let shot = await page.screenshot({ type: 'webp', quality: 80 });
    while (shot.length < MIN_BYTES && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 600));
      shot = await page.screenshot({ type: 'webp', quality: 80 });
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    return await page.screenshot({ type: 'webp', quality: 80 });
  } finally {
    await page.close().catch(() => {});
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, active, queued: queue.length }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404).end('not found');
    return;
  }

  if (req.headers.authorization !== 'Bearer ' + TOKEN) {
    res.writeHead(401).end('unauthorized');
    return;
  }

  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', async () => {
    let target;
    try {
      target = new URL(JSON.parse(body).url);
    } catch {
      res.writeHead(400).end('bad url');
      return;
    }
    if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST) {
      res.writeHead(400).end('host not allowed');
      return;
    }

    const started = Date.now();
    try {
      const image = await run(() => render(target.toString()));
      res.writeHead(200, {
        'content-type': 'image/webp',
        'cache-control': 'no-store',
        'x-render-ms': String(Date.now() - started),
      });
      res.end(Buffer.from(image));
      console.log('rendered', target.pathname, Date.now() - started, 'ms');
    } catch (err) {
      console.error('render failed', target.toString(), err);
      res.writeHead(502).end('render failed');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('pelican render listening on', PORT);
});
