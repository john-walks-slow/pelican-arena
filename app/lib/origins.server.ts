import { env } from "cloudflare:workers";

export const origins = () => ({
  app: env.APP_ORIGIN,
  usercontent: env.USERCONTENT_ORIGIN,
});
