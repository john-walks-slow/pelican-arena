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

  // Cache strategy to maximize CDN hits and minimize Worker invocations:
  // 1. Gallery previews (?preview=1) get public CDN caching so concurrent/repeated visits
  //    are served by edge CDN directly without invoking the Worker.
  // 2. Static asset sub-resources (js, css, images, fonts, wasm) are immutable within a bundle
  //    and can be safely cached on edge and browser.
  // 3. Entry documents (HTML / root index) without preview stay `no-store` to ensure retracted
  //    submissions take effect immediately.
  const preview = url.searchParams.has("preview");
  const isStaticSubResource =
    clean !== ENTRY_FILE &&
    /\.(?:js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|wasm|map)$/i.test(clean);

  const cacheControl = preview
    ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    : isStaticSubResource
      ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      : "no-store";

  const headers = new Headers({
    "Content-Type": contentTypeFor(clean),
    "Content-Security-Policy": `sandbox ${SANDBOX}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": cacheControl,
    ETag: object.httpEtag,
  });
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
