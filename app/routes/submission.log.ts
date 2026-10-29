import { env } from "cloudflare:workers";
import { data } from "react-router";
import type { Route } from "./+types/submission.log";
import { getSubmission } from "~/lib/queries.server";
import { rawLogKey } from "~/lib/submissions.server";

export async function loader({ params }: Route.LoaderArgs) {
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  const object = await env.FILES.get(rawLogKey(submission.id));
  if (!object) throw data("Not Found", { status: 404 });
  const json = submission.logMeta?.source === "opencode";
  const extension = json ? "json" : "jsonl";
  return new Response(object.body, {
    headers: {
      "Content-Type": json
        ? "application/json; charset=utf-8"
        : "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="${submission.id}.${extension}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
