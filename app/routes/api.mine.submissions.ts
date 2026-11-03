import { data } from "react-router";
import type { Route } from "./+types/api.mine.submissions";
import { isSubmissionServable } from "~/lib/moderation";
import { createPreviewGrant } from "~/lib/preview-grant.server";
import { listOwnSubmissions } from "~/lib/queries.server";
import { getUser } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) return data({ error: "请先登录" }, { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  const result = await listOwnSubmissions(user.id, page);
  const submissions = await Promise.all(
    result.submissions.map(async (answer) => ({
      ...answer,
      grant: isSubmissionServable(answer.status, answer.promptStatus)
        ? null
        : await createPreviewGrant(answer.id),
    })),
  );
  return { ...result, submissions };
}
