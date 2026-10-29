import type { Route } from "./+types/api.prompts";
import { isPromptKind, type PromptKind } from "~/lib/kinds";
import {
  DEFAULT_PROMPT_SORT,
  isPromptSort,
  listPrompts,
  type PromptSort,
} from "~/lib/queries.server";

/** Continuation page for the prompt gallery. */
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const kindParam = params.get("kind");
  const kind: PromptKind | null = isPromptKind(kindParam) ? kindParam : null;
  const sortParam = params.get("sort");
  const sort: PromptSort = isPromptSort(sortParam) ? sortParam : DEFAULT_PROMPT_SORT;
  const requested = Number(params.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;

  return { ...(await listPrompts({ q, kind, sort, page })), q, kind, sort };
}
