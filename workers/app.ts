import { createRequestHandler } from "react-router";
import { serveUsercontent } from "~/lib/usercontent.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const host = new URL(request.url).host;
    if (host === new URL(env.USERCONTENT_ORIGIN).host) {
      return serveUsercontent(request, env.FILES);
    }
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
