import { env } from "cloudflare:workers";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isLoopback(host: string) {
  return LOOPBACK.test(host);
}

export function origins(request?: Request) {
  const defaultApp = env.APP_ORIGIN || "http://localhost:5173";
  const defaultUsercontent = env.USERCONTENT_ORIGIN || "http://127.0.0.1:5173";

  if (!request) {
    return { app: defaultApp, usercontent: defaultUsercontent };
  }

  const reqUrl = new URL(request.url);
  const appHost = new URL(defaultApp).host;
  const usercontentHost = new URL(defaultUsercontent).host;

  // If accessed via a remote host (e.g. frp tunnel, LAN IP) where the request host
  // differs from both configured origins, route usercontent through the same host with /__usercontent prefix.
  if (reqUrl.host !== appHost && reqUrl.host !== usercontentHost) {
    return {
      app: reqUrl.origin,
      // Preview proxies (Instabox, Cloudflare tunnel) rewrite Host to a loopback
      // address, so the origin we see is not the one the browser used. A path
      // prefix makes every preview URL relative to the page and therefore always
      // reachable, whatever host the reader is on.
      usercontent: isLoopback(reqUrl.host)
        ? "/__usercontent"
        : `${reqUrl.origin}/__usercontent`,
    };
  }

  return {
    app: defaultApp,
    usercontent: defaultUsercontent,
  };
}
