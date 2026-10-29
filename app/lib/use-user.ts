import { useRouteLoaderData } from "react-router";
import type { loader } from "~/root";

export function useOptionalUser() {
  return useRouteLoaderData<typeof loader>("root")?.user ?? null;
}
