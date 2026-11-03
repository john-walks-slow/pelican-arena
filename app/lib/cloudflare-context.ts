import { createContext } from "react-router";

/**
 * The Worker's execution context, handed to loaders/actions through React
 * Router's request context so background work (e.g. rendering a thumbnail)
 * can outlive the response.
 */
export type CloudflareContext = {
  env: Env;
  ctx: ExecutionContext;
};

export const cloudflareContext = createContext<CloudflareContext>();
