import { data } from "react-router";
import type { Route } from "./+types/prompt.submissions";
import {
  getPrompt,
  listSubmissions,
  type SubmissionSort,
} from "~/lib/queries.server";

/** Continuation page for a prompt's answer gallery. */
export async function loader({ params, request }: Route.LoaderArgs) {
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const url = new URL(request.url);
  const q = url.searchParams;
  const sort: SubmissionSort = q.get("sort") === "new" ? "new" : "top";
  const requested = Number(q.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  const filters = {
    model: q.get("model") || undefined,
    provider: q.get("provider") || undefined,
    harness: q.get("harness") || undefined,
    mod: q.get("mod") || undefined,
  };

  const key = [sort, filters.model, filters.provider, filters.harness, filters.mod].join("|");
  return { ...(await listSubmissions(prompt.id, filters, sort, page)), filters, sort, key };
}
