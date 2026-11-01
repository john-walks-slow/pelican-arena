import { data } from "react-router";
import type { Route } from "./+types/prompt.report";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { isReportReason, REPORT_NOTE_LIMIT, reportNeedsNote } from "~/lib/moderation";
import { createReport, ReportConflict, ModerationValidation } from "~/lib/moderation.server";

/** Report dialog endpoint for a prompt. */
export async function action({ params, request }: Route.ActionArgs) {
  const user = await requirePermission(request, "report");
  const limitError = await dailyLimitError(user, "report");
  if (limitError) return data({ error: limitError }, { status: 429 });

  const form = await request.formData();
  const reason = form.get("reason");
  if (!isReportReason(reason, "prompt")) return data({ error: "请选择举报理由" }, { status: 400 });

  const note = String(form.get("note") ?? "").trim().slice(0, REPORT_NOTE_LIMIT);
  if (reportNeedsNote(reason) && !note) {
    return data({ error: "请在补充说明里写明原因" }, { status: 400 });
  }

  try {
    await createReport(user, "prompt", params.promptId, reason, note || null);
  } catch (error) {
    if (error instanceof ModerationValidation) return data({ error: error.message }, { status: 400 });
    if (error instanceof ReportConflict) return data({ error: error.message }, { status: 409 });
    throw error;
  }
  return { ok: true as const };
}
