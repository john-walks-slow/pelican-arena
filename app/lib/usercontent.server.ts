import { eq } from "drizzle-orm";
import { db } from "~/db/client.server";
import { prompts, submissions } from "~/db/schema";
import { contentTypeFor, ENTRY_FILE, normalizePath } from "~/lib/bundle";
import { KIND_META } from "~/lib/kinds";
import { isSubmissionServable } from "~/lib/moderation";
import { verifyPreviewGrant } from "~/lib/preview-grant.server";
import { GRANT_SEGMENT, SANDBOX } from "~/lib/sandbox";

export const bundleKey = (submissionId: string, path: string) =>
  `s/${submissionId}/${path}`;

const SUBMISSION_ID = /^[a-z0-9]{10,32}$/;

async function servingAllowed(id: string, grant: string | undefined) {
  if (grant) return verifyPreviewGrant(id, grant);
  const [row] = await db()
    .select({ status: submissions.status, promptStatus: prompts.status })
    .from(submissions)
    .innerJoin(prompts, eq(prompts.id, submissions.promptId))
    .where(eq(submissions.id, id));
  return Boolean(row && isSubmissionServable(row.status, row.promptStatus));
}

/**
 * Serves submitted bundles from R2 on the usercontent origin.
 *
 * Public answers are reachable at `/<id>/<path>`. Answers that are not public
 * (flagged, removed, or under a prompt that is not live) need a signed grant in
 * front: `/_g/<grant>/<id>/<path>`, so previews still work for authors, admins
 * and the moderation API without opening the answer to the world.
 */
export async function serveUsercontent(request: Request, bucket: R2Bucket) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const segments = url.pathname.slice(1).split("/");

  let grant: string | undefined;
  if (segments[0] === GRANT_SEGMENT) {
    grant = segments[1];
    segments.splice(0, 2);
  }

  const [id, ...rest] = segments;
  if (!id || !SUBMISSION_ID.test(id)) {
    return new Response("Not Found", { status: 404 });
  }
  if (!(await servingAllowed(id, grant))) {
    return new Response("Not Found", { status: 404 });
  }
  if (rest.length === 0) {
    const redirect = grant ? `/${GRANT_SEGMENT}/${grant}/${id}/` : `/${id}/`;
    return Response.redirect(`${url.origin}${redirect}`, 301);
  }

  let raw: string;
  try {
    raw = decodeURIComponent(rest.join("/"));
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  const path = raw === "" || raw.endsWith("/") ? `${raw}${ENTRY_FILE}` : raw;
  const clean = normalizePath(path);
  if (!clean) return new Response("Not Found", { status: 404 });

  const object = await bucket.get(bundleKey(id, clean));
  if (!object) return new Response("Not Found", { status: 404 });

  // Cache strategy to maximize CDN hits and minimize Worker invocations:
  // 1. Granted URLs are private/sensitive and must never be cached publicly.
  // 2. Gallery previews (?preview=1) get short public CDN caching (60s) for rapid navigation.
  // 3. Static asset sub-resources (js, css, images, fonts, wasm) are immutable within a bundle
  //    and can be safely cached on edge and browser.
  // 4. Entry documents (HTML / SVG / Markdown) without preview stay `no-store` to ensure retracted
  //    submissions take effect immediately.
  const preview = url.searchParams.has("preview");
  const isEntryDocument = Object.values(KIND_META).some((m) => m.entry === clean);
  const isStaticSubResource =
    !isEntryDocument &&
    /\.(?:js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|wasm|map)$/i.test(clean);

  const cacheControl = grant
    ? "private, no-store"
    : preview
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
