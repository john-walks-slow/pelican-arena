import { env } from "cloudflare:workers";
import { KIND_META, type PromptKind } from "./kinds";
import { submissionUrl } from "./sandbox";
import { bundleKey } from "./usercontent.server";

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Key in R2 where the rendered thumbnail preview is cached.
 */
export function thumbnailKey(submissionId: string) {
  return `s/${submissionId}/thumb.webp`;
}

/**
 * Retrieves an existing thumbnail from R2 or generates one using Cloudflare Browser Rendering.
 * Returns a data URI (e.g. `data:image/webp;base64,...`) or null if unavailable.
 */
export async function getOrGenerateThumbnail(
  submissionId: string,
  kind: PromptKind,
): Promise<string | null> {
  // 1. If it's a native SVG submission, read the SVG file directly from R2 without spinning up a browser.
  if (kind === "svg") {
    try {
      const entryPath = KIND_META.svg.entry;
      const file = await env.FILES.get(bundleKey(submissionId, entryPath));
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return `data:image/svg+xml;base64,${bytesToBase64(bytes)}`;
      }
    } catch (e) {
      console.error("Failed to read SVG submission from R2:", submissionId, e);
    }
  }

  // 2. Check for an already generated webp thumbnail in R2.
  const cachedKey = thumbnailKey(submissionId);
  try {
    const cached = await env.FILES.get(cachedKey);
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer());
      return `data:image/webp;base64,${bytesToBase64(bytes)}`;
    }
  } catch (e) {
    console.warn("Error reading thumbnail cache from R2:", e);
  }

  // 3. If Cloudflare Browser Rendering binding is available, generate a screenshot.
  const browserBinding = (env as unknown as { BROWSER?: unknown }).BROWSER;
  if (!browserBinding) {
    return null;
  }

  try {
    const puppeteerModule = await import("@cloudflare/puppeteer");
    const puppeteer = puppeteerModule.default || puppeteerModule;
    // Launch headless browser session using Cloudflare Browser Rendering binding
    const browser = await (puppeteer as any).launch(browserBinding);
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 630 });

      const url = submissionUrl(env.USERCONTENT_ORIGIN, submissionId, kind);
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 9000,
      });

      const screenshotBuf = await page.screenshot({
        type: "webp",
        quality: 80,
      });

      const bytes = new Uint8Array(screenshotBuf);

      // Cache to R2 in background
      await env.FILES.put(cachedKey, bytes, {
        httpMetadata: { contentType: "image/webp" },
      }).catch((err) => console.error("Failed to cache thumbnail to R2:", err));

      return `data:image/webp;base64,${bytesToBase64(bytes)}`;
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.error("Browser rendering screenshot failed for", submissionId, err);
    return null;
  }
}
