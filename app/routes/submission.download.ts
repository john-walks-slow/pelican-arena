import { env } from "cloudflare:workers";
import { data } from "react-router";
import type { Route } from "./+types/submission.download";
import { contentTypeFor } from "~/lib/bundle";
import { KIND_META } from "~/lib/kinds";
import { getPrompt, getSubmission } from "~/lib/queries.server";
import { bundleKey } from "~/lib/usercontent.server";

/** Downloads the single source file of a Markdown or SVG submission. */
export async function loader({ params }: Route.LoaderArgs) {
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  if (prompt.kind === "web") throw data("Not Found", { status: 404 });

  const entry = KIND_META[prompt.kind].entry;
  const object = await env.FILES.get(bundleKey(submission.id, entry));
  if (!object) throw data("Not Found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": contentTypeFor(entry),
      "Content-Disposition": `attachment; filename="pelican-${submission.id}.${KIND_META[prompt.kind].extension}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
