import { env } from "cloudflare:workers";
import { isSubmissionServable, type PromptStatus, type SubmissionStatus } from "./moderation";

/**
 * Short-lived signed path segments that let the usercontent origin serve an
 * answer that is not public (flagged, removed, or under a hidden prompt).
 * A path prefix rather than a query string keeps relative references inside
 * multi-file bundles working.
 */

const DEFAULT_TTL_SECONDS = 60 * 60;

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;

function signingKey() {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(`preview-grant:${env.SESSION_SECRET}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise;
}

function base64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signature(submissionId: string, expires: number) {
  const mac = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    encoder.encode(`${submissionId}.${expires}`),
  );
  return base64url(mac).slice(0, 32);
}

export async function createPreviewGrant(submissionId: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expires}.${await signature(submissionId, expires)}`;
}

/** Only non-public answers need a grant; public ones stay on the plain path. */
export async function previewGrantFor(submission: {
  id: string;
  status: SubmissionStatus;
  promptStatus: PromptStatus;
}) {
  return isSubmissionServable(submission.status, submission.promptStatus)
    ? null
    : createPreviewGrant(submission.id);
}

export async function verifyPreviewGrant(submissionId: string, grant: string) {
  const [rawExpires, sig] = grant.split(".");
  const expires = Number(rawExpires);
  if (!sig || !Number.isInteger(expires) || expires < Date.now() / 1000) return false;
  const expected = await signature(submissionId, expires);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
