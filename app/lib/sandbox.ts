/**
 * Strict sandbox policy for third-party submissions.
 *
 * `allow-same-origin` is omitted intentionally: user code runs in a sandboxed
 * unique origin so it cannot read cookies or storage on the usercontent host,
 * and cannot escape through same-origin parent traversal.
 */
import { KIND_META, type PromptKind } from "./kinds";

export const SANDBOX =
  "allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads";

/** Path segment that carries a preview grant for a non-public answer. */
export const GRANT_SEGMENT = "_g";

const grantPrefix = (grant?: string | null) => (grant ? `/${GRANT_SEGMENT}/${grant}` : "");

export function usercontentUrl(
  origin: string,
  submissionId: string,
  path = "",
  grant?: string | null,
) {
  return `${origin.replace(/\/+$/, "")}${grantPrefix(grant)}/${submissionId}/${path}`;
}

/** The entry file URL for a submission, chosen by its prompt's work kind. */
export function submissionUrl(
  origin: string,
  submissionId: string,
  kind: PromptKind,
  grant?: string | null,
) {
  return usercontentUrl(origin, submissionId, KIND_META[kind].entry, grant);
}

/**
 * Entry URL for gallery previews. Marked so the worker may cache it briefly:
 * previews are destroyed and re-created on every navigation and would
 * otherwise reload from scratch behind a skeleton.
 */
export function previewUrl(
  origin: string,
  submissionId: string,
  kind: PromptKind,
  grant?: string | null,
) {
  return `${submissionUrl(origin, submissionId, kind, grant)}?preview=1`;
}

/** Static thumbnail preview URL for a submission. */
export function thumbnailUrl(
  origin: string,
  submissionId: string,
  grant?: string | null,
) {
  return usercontentUrl(origin, submissionId, "thumb.webp", grant);
}
