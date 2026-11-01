import { createRequestHandler } from "react-router";
import { syncModelCatalog } from "~/lib/catalog-sync.server";
import { serveUsercontent } from "~/lib/usercontent.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const usercontentHost = new URL(env.USERCONTENT_ORIGIN).host;
    const appHost = new URL(env.APP_ORIGIN).host;

    // Production / dual-host: match by host header
    if (url.host === usercontentHost && usercontentHost !== appHost) {
      return serveUsercontent(request, env.FILES);
    }

    // Single-host dev / tunnel / frp: match by path prefix
    if (url.pathname.startsWith("/__usercontent/")) {
      const rewritten = new URL(request.url);
      rewritten.pathname = url.pathname.replace(/^\/__usercontent/, "");
      return serveUsercontent(new Request(rewritten, request), env.FILES);
    }

    return requestHandler(request);
  },

  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(
      syncModelCatalog().catch((error) => console.error("catalog sync failed", error)),
    );
  },
} satisfies ExportedHandler<Env>;
