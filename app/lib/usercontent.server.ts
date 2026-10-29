import { contentTypeFor, ENTRY_FILE, normalizePath } from "~/lib/bundle";
import { SANDBOX } from "~/lib/sandbox";

export const bundleKey = (submissionId: string, path: string) =>
  `s/${submissionId}/${path}`;

const SUBMISSION_ID = /^[a-z0-9]{10,32}$/;

/** Serves submitted bundles from R2 on the usercontent origin. */
export async function serveUsercontent(request: Request, bucket: R2Bucket) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const [id, ...rest] = url.pathname.slice(1).split("/");
  if (!id || !SUBMISSION_ID.test(id)) {
    return new Response("Not Found", { status: 404 });
  }
  if (rest.length === 0) {
    return Response.redirect(`${url.origin}/${id}/`, 301);
  }

  const raw = decodeURIComponent(rest.join("/"));
  const path = raw === "" || raw.endsWith("/") ? `${raw}${ENTRY_FILE}` : raw;
  const clean = normalizePath(path);
  if (!clean) return new Response("Not Found", { status: 404 });

  const object = await bucket.get(bundleKey(id, clean));
  if (!object) return new Response("Not Found", { status: 404 });

  const headers = new Headers({
    "Content-Type": contentTypeFor(clean),
    "Content-Security-Policy": `sandbox ${SANDBOX}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    ETag: object.httpEtag,
  });
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
