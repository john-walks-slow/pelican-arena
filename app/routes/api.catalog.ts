import { data } from "react-router";
import type { Route } from "./+types/api.catalog";
import type { CatalogKind } from "~/lib/catalog";
import { getModelMeta, resolveModel, searchCatalog } from "~/lib/queries.server";

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

  const find = url.searchParams.get("find")?.trim();
  if (find) return { model: await getModelMeta(find.slice(0, 100)) };

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const fallback = kind === "providers" || kind === "harnesses" ? 120 : 20;
  const requested = Number(url.searchParams.get("limit") ?? fallback);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : fallback, 1), 200);
  return searchCatalog(kind, query, limit);
}
