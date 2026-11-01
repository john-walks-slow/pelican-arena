import type { Route } from "./+types/api.admin.reports";
import { requireAdmin } from "~/lib/guards.server";
import { isSubmissionServable } from "~/lib/moderation";
import { listReportGroups } from "~/lib/moderation.server";
import { createPreviewGrant } from "~/lib/preview-grant.server";

/** Continuation page for the report queue. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const requested = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;

  const groups = await listReportGroups(page);
  const withGrants = await Promise.all(
    groups.groups.map(async (group) =>
      group.targetType === "prompt"
        ? group
        : {
            ...group,
            grant: isSubmissionServable(group.submission.status, group.submission.promptStatus)
              ? null
              : await createPreviewGrant(group.submission.id),
          },
    ),
  );
  return { ...groups, groups: withGrants };
}
