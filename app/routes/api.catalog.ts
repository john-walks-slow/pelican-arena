import { data } from "react-router";
import type { Route } from "./+types/api.catalog";
import type { CatalogKind } from "~/lib/catalog";
import { resolveModel, searchCatalog } from "~/lib/queries.server";

const KINDS: CatalogKind[] = ["models", "providers", "harnesses", "mods"];

/** Searchable catalog for comboboxes, so pages never ship the whole table. */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as CatalogKind;
  if (!KINDS.includes(kind)) throw data("Invalid catalog kind", { status: 400 });

  const resolve = url.searchParams.get("resolve")?.trim();
  if (resolve) {
    return { match: await resolveModel(resolve.slice(0, 100)) };
  }

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const requested = Number(url.searchParams.get("limit") ?? (kind === "providers" ? 30 : 20));
  const fallback = kind === "providers" ? 30 : 20;
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : fallback, 1), 50);
  return searchCatalog(kind, query, limit);
}
