import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  routeDiscovery: { mode: "initial" },
  // The cloud dev preview proxies the public host, so the browser's Origin
  // does not match the worker's local request URL. Keep the relaxation
  // scoped to development; production actions stay same-origin only.
  allowedActionOrigins:
    process.env.NODE_ENV === "development" ? ["*.instabox.tech", "*.trycloudflare.com"] : [],
} satisfies Config;
