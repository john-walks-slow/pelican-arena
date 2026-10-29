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
