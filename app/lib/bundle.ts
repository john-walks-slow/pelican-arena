import { unzipSync } from "fflate";
import { KIND_META, type PromptKind } from "./kinds";

export interface BundleFile {
  path: string;
  size: number;
  type: string;
}

export interface BundleEntry {
  path: string;
  data: Uint8Array;
}

export const BUNDLE_LIMITS = {
  htmlBytes: 4 * 1024 * 1024,
  totalBytes: 10 * 1024 * 1024,
  maxFiles: 200,
  zipBytes: 10 * 1024 * 1024,
  markdownBytes: 300 * 1024,
  svgBytes: 2 * 1024 * 1024,
};

export function singleFileLimit(kind: PromptKind) {
  if (kind === "markdown") return BUNDLE_LIMITS.markdownBytes;
  if (kind === "svg") return BUNDLE_LIMITS.svgBytes;
  return BUNDLE_LIMITS.htmlBytes;
}

export const ENTRY_FILE = "index.html";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

export function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Returns a clean relative path, or null when the path is unsafe. */
export function normalizePath(raw: string): string | null {
  const segments = raw.replace(/\\/g, "/").split("/");
  const clean: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    if (/[\u0000-\u001f\u007f]/.test(segment)) return null;
    clean.push(segment);
  }
  if (clean.length === 0) return null;
  return clean.join("/");
}

function isJunk(path: string): boolean {
  return (
    path.startsWith("__MACOSX/") ||
    path.split("/").some((s) => s === ".DS_Store" || s === "Thumbs.db")
  );
}

/** A zip of a folder wraps everything in one directory; unwrap it. */
function stripSharedRoot(paths: string[]): string | null {
  if (paths.includes(ENTRY_FILE)) return null;
  const first = paths[0]?.split("/")[0];
  if (!first || !paths.every((p) => p.startsWith(`${first}/`))) return null;
  return `${first}/`;
}

export class BundleError extends Error {}

/**
 * Validates and normalizes bundle entries. Runs in the browser before upload
 * and again on the server, so both sides agree on what a valid bundle is.
 */
export function buildBundle(entries: BundleEntry[], kind: PromptKind = "web"): BundleEntry[] {
  const paths = new Map<string, Uint8Array>();
  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path) throw new BundleError(`文件路径不合法：${entry.path}`);
    if (isJunk(path)) continue;
    if (paths.has(path)) throw new BundleError(`文件重复：${path}`);
    paths.set(path, entry.data);
  }

  const prefix = stripSharedRoot([...paths.keys()]);
  const files = [...paths].map(([path, data]) => ({
    path: prefix ? path.slice(prefix.length) : path,
    data,
  }));

  const entry = KIND_META[kind].entry;
  const entryFile = files.find((f) => f.path === entry);
  if (!entryFile) {
    throw new BundleError(`缺少入口文件 ${entry}`);
  }
  if (kind === "web") {
    if (entryFile.data.byteLength > BUNDLE_LIMITS.htmlBytes) {
      throw new BundleError(`入口文件超过 ${formatBytes(BUNDLE_LIMITS.htmlBytes)}`);
    }
    if (files.length > BUNDLE_LIMITS.maxFiles) {
      throw new BundleError(`文件数超过 ${BUNDLE_LIMITS.maxFiles} 个`);
    }
    const total = files.reduce((sum, f) => sum + f.data.byteLength, 0);
    if (total > BUNDLE_LIMITS.totalBytes) {
      throw new BundleError(`总大小超过 ${formatBytes(BUNDLE_LIMITS.totalBytes)}`);
    }
  } else {
    if (files.length !== 1) {
      throw new BundleError(`${KIND_META[kind].label} 只支持单个文件`);
    }
    if (files[0].data.byteLength > singleFileLimit(kind)) {
      throw new BundleError(`文件超过 ${formatBytes(singleFileLimit(kind))}`);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Unzips in the browser, refusing archives that would inflate past the limits. */
export function unzipBundle(zip: Uint8Array): BundleEntry[] {
  if (zip.byteLength > BUNDLE_LIMITS.zipBytes) {
    throw new BundleError(`压缩包超过 ${formatBytes(BUNDLE_LIMITS.zipBytes)}`);
  }
  let declared = 0;
  let count = 0;
  const unzipped = unzipSync(zip, {
    filter: (file) => {
      if (file.name.endsWith("/")) return false;
      count += 1;
      declared += file.originalSize;
      if (count > BUNDLE_LIMITS.maxFiles * 2 || declared > BUNDLE_LIMITS.totalBytes) {
        throw new BundleError("压缩包解压后过大");
      }
      return true;
    },
  });
  return Object.entries(unzipped).map(([path, data]) => ({ path, data }));
}

/** Reads a text-based work, rejecting invalid UTF-8 and empty or non-SVG bodies. */
export function readTextBundle(kind: PromptKind, data: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new BundleError("文件不是有效的 UTF-8 文本");
  }
  if (!text.trim()) throw new BundleError("文件内容为空");
  if (kind === "svg" && !/<svg[\s>]/i.test(text)) {
    throw new BundleError("文件里没有找到 <svg> 根元素");
  }
  return text;
}

export function describeBundle(files: BundleEntry[]): BundleFile[] {
  return files.map((f) => ({
    path: f.path,
    size: f.data.byteLength,
    type: contentTypeFor(f.path),
  }));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
