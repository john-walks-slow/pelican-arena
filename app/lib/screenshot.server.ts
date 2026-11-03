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

type Thumbnail = { bytes: Uint8Array; contentType: string };

/**
 * Reads the preview image that already exists: the stored WebP for pages, or
 * the SVG source for SVG answers. This never renders anything — a missing
 * thumbnail is simply reported as missing.
 */
export async function readThumbnail(
  submissionId: string,
  kind: PromptKind,
): Promise<Thumbnail | null> {
  if (kind === "svg") {
    try {
      const file = await env.FILES.get(bundleKey(submissionId, KIND_META.svg.entry));
      if (file) {
        return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: "image/svg+xml" };
      }
    } catch (err) {
      console.error("Failed to read SVG submission from R2:", submissionId, err);
    }
    return null;
  }

  if (kind !== "web") return null;

  try {
    const cached = await env.FILES.get(thumbnailKey(submissionId));
    if (cached) {
      return { bytes: new Uint8Array(await cached.arrayBuffer()), contentType: "image/webp" };
    }
  } catch (err) {
    console.warn("Error reading thumbnail cache from R2:", err);
  }
  return null;
}

/** Data URI form used by share cards, which are rendered as a single image. */
export async function thumbnailDataUri(
  submissionId: string,
  kind: PromptKind,
): Promise<string | null> {
  const thumbnail = await readThumbnail(submissionId, kind);
  if (!thumbnail) return null;
  return `data:${thumbnail.contentType};base64,${bytesToBase64(thumbnail.bytes)}`;
}

/**
 * Renders one page on the self-hosted Tencent box, which keeps a warm Chrome
 * behind a tunnel. Retries once; returns null when unset or failing.
 */
async function renderOnVps(url: string): Promise<Uint8Array | null> {
  const config = env as unknown as { RENDER_ORIGIN?: string; RENDER_TOKEN?: string };
  if (!config.RENDER_ORIGIN || !config.RENDER_TOKEN) {
    console.warn("RENDER_ORIGIN / RENDER_TOKEN are not configured; skipping", url);
    return null;
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`${config.RENDER_ORIGIN.replace(/\/+$/, "")}/render`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.RENDER_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        console.warn("Thumbnail render responded", response.status, `(attempt ${attempt})`, url);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 1024) return bytes;
      console.warn("Thumbnail render returned a tiny image", `(attempt ${attempt})`, url);
    } catch (err) {
      console.warn("Thumbnail render failed", `(attempt ${attempt})`, url, err);
    }
  }
  return null;
}

/**
 * Renders and stores the preview image for a web answer. Called once after a
 * submission is accepted; never from a request that serves an image.
 */
export async function ensureThumbnail(submissionId: string, kind: PromptKind): Promise<void> {
  if (kind !== "web") return;

  const key = thumbnailKey(submissionId);
  if (await env.FILES.head(key)) return;

  const url = submissionUrl(env.USERCONTENT_ORIGIN, submissionId, kind);
  const bytes = await renderOnVps(url);
  if (!bytes) {
    console.error("No thumbnail rendered for", submissionId);
    return;
  }

  await env.FILES.put(key, bytes, { httpMetadata: { contentType: "image/webp" } });
}
