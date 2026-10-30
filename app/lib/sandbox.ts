import { KIND_META, type PromptKind } from "./kinds";

/**
 * Sandbox flags shared by the usercontent CSP header and every embedding
 * iframe. Never add allow-same-origin: submitted pages must stay in an opaque
 * origin.
 */

export const SANDBOX =
  "allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads";

export function usercontentUrl(origin: string, submissionId: string, path = "") {
  return `${origin.replace(/\/+$/, "")}/${submissionId}/${path}`;
}

/** The entry file URL for a submission, chosen by its prompt's work kind. */
export function submissionUrl(origin: string, submissionId: string, kind: PromptKind) {
  return usercontentUrl(origin, submissionId, KIND_META[kind].entry);
}

/**
 * Entry URL for gallery previews. Marked so the worker may cache it briefly:
 * previews are destroyed and re-created on every navigation and would
 * otherwise reload from scratch behind a skeleton.
 */
export function previewUrl(origin: string, submissionId: string, kind: PromptKind) {
  return `${submissionUrl(origin, submissionId, kind)}?preview=1`;
}
