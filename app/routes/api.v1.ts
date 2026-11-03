import type { Route } from "./+types/api.v1";
import { authenticateApiToken, type TokenActor } from "~/lib/api-tokens.server";
import {
  AUTO_HIDE_REPORTS,
  isPromptAction,
  isSubmissionAction,
  MODERATION_ACTIONS,
  PROMPT_REPORT_REASONS,
  PROMPT_STATUSES,
  SUBMISSION_REPORT_REASONS,
  SUBMISSION_STATUSES,
} from "~/lib/moderation";
import {
  applyPromptAction,
  applySubmissionAction,
  getPromptReviewPayload,
  listAllReports,
  listModerationLog,
  listPendingForApi,
  listReportGroupsForApi,
  ModerationConflict,
  ModerationValidation,
  moderationCounts,
} from "~/lib/moderation.server";
import { origins } from "~/lib/origins.server";
import { SKIP_PROMPT_REVIEW_TRUST } from "~/lib/permissions";
import { KIND_META } from "~/lib/kinds";
import { getPrompt, getSubmission, siteStats } from "~/lib/queries.server";
import { submissionUrl, usercontentUrl } from "~/lib/sandbox";
import { createPreviewGrant } from "~/lib/preview-grant.server";

/**
 * JSON API for automated moderators. Authenticate with
 * `Authorization: Bearer pa_…`; every mutation is attributed to the token in the
 * moderation log.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const fail = (code: string, message: string, status: number) =>
  json({ error: { code, message } }, status);

const intParam = (url: URL, name: string, fallback: number, max: number) => {
  const raw = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.floor(raw))) : fallback;
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("Content-Type") ?? "";
  if (type.includes("application/json")) {
    try {
      const parsed = await request.json();
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      throw new ModerationValidation("请求体不是合法的 JSON");
    }
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

async function requireToken(request: Request): Promise<TokenActor> {
  const token = await authenticateApiToken(request);
  if (!token) throw new HttpError(401, "unauthorized", "缺少或无效的 API token");
  return token;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function meta(request: Request) {
  const base = new URL(request.url).origin;
  return {
    version: "1",
    docs: `${base}/admin?tab=api`,
    statuses: { prompts: PROMPT_STATUSES, submissions: SUBMISSION_STATUSES },
    actions: {
      prompt: ["approve", "reject", "remove", "restore"],
      submission: ["keep", "remove", "restore"],
    },
    reportReasons: {
      prompt: PROMPT_REPORT_REASONS.map(({ id, label, description, severe }) => ({
        id,
        label,
        description,
        severe,
      })),
      submission: SUBMISSION_REPORT_REASONS.map(({ id, label, description, severe }) => ({
        id,
        label,
        description,
        severe,
      })),
    },
    rules: {
      autoHideReports: AUTO_HIDE_REPORTS,
      skipPromptReviewTrust: SKIP_PROMPT_REVIEW_TRUST,
      notesRequiredFor: ["prompt:reject", "prompt:remove", "submission:remove"],
    },
    logActions: MODERATION_ACTIONS,
  };
}

async function promptDetail(id: string) {
  const prompt = await getPromptReviewPayload(id);
  if (!prompt) throw new HttpError(404, "not_found", "题目不存在");
  return { ...prompt, reports: await listAllReports("prompt", id) };
}

async function submissionDetail(request: Request, id: string) {
  const submission = await getSubmission(id);
  if (!submission) throw new HttpError(404, "not_found", "答案不存在");
  const prompt = await getPrompt(submission.promptId);
  if (!prompt) throw new HttpError(404, "not_found", "题目不存在");

  const grant = await createPreviewGrant(submission.id);
  const origin = origins(request).usercontent;
  const kind = prompt.kind;

  return {
    id: submission.id,
    status: submission.status,
    moderationNote: submission.moderationNote,
    createdAt: submission.createdAt,
    prompt: { id: prompt.id, title: prompt.title, kind, status: prompt.status },
    author: submission.author,
    model: submission.model.name,
    provider: submission.provider.name,
    harness: submission.harness?.name ?? null,
    reasoning: submission.reasoning,
    mods: submission.mods.map((m) => m.name),
    notes: submission.notes,
    content: submission.content,
    files: submission.files,
    totalBytes: submission.totalBytes,
    logMeta: submission.logMeta,
    votes: submission.votes,
    starSum: submission.starSum,
    reports: await listAllReports("submission", submission.id),
    preview: {
      entry: KIND_META[kind].entry,
      url: submissionUrl(origin, submission.id, kind, grant),
      baseUrl: usercontentUrl(origin, submission.id, "", grant),
      expiresInSeconds: 3600,
    },
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    await requireToken(request);
    const url = new URL(request.url);
    const path = (params["*"] ?? "").replace(/^\/+|\/+$/g, "");
    const [head, id, tail] = path.split("/");

    if (!head) return json({ data: meta(request) });

    if (head === "stats") {
      const [counts, totals] = await Promise.all([moderationCounts(), siteStats()]);
      return json({ data: { queue: counts, site: totals } });
    }

    if (head === "prompts" && !id) {
      const limit = intParam(url, "limit", 20, 50);
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const { items, nextCursor } = await listPendingForApi(limit, cursor);
      return json({ data: { items, nextCursor }, meta: { status: "pending" } });
    }

    if (head === "prompts" && id && !tail) return json({ data: await promptDetail(id) });

    if (head === "submissions" && id && !tail) {
      return json({ data: await submissionDetail(request, id) });
    }

    if (head === "reports" && !id) {
      const limit = intParam(url, "limit", 20, 50);
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const { items, nextCursor, hasMore } = await listReportGroupsForApi(limit, cursor);
      return json({ data: { items, nextCursor, hasMore } });
    }

    if (head === "log" && !id) {
      const page = intParam(url, "page", 1, 1000);
      const { entries, total, nextPage } = await listModerationLog(page);
      return json({ data: { items: entries, total, nextPage } });
    }

    return fail("not_found", "没有这个接口", 404);
  } catch (error) {
    return handle(error);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const token = await requireToken(request);
    const path = (params["*"] ?? "").replace(/^\/+|\/+$/g, "");
    const [head, id, tail] = path.split("/");
    if (!id || tail !== "actions") return fail("not_found", "没有这个接口", 404);

    if (request.method !== "POST") return fail("method_not_allowed", "只接受 POST", 405);
    const body = await readBody(request);
    const action = text(body.action);
    const note = text(body.note) || null;
    const actor = { kind: "token" as const, token };

    if (head === "prompts") {
      if (!isPromptAction(action)) return fail("invalid_action", "题目不支持这个操作", 400);
      const result = await applyPromptAction(actor, id, action, note);
      return json({ data: { id: result.id, status: result.status, action } });
    }

    if (head === "submissions") {
      if (!isSubmissionAction(action)) return fail("invalid_action", "答案不支持这个操作", 400);
      const result = await applySubmissionAction(actor, id, action, note);
      return json({ data: { id: result.id, status: result.status, action } });
    }

    return fail("not_found", "没有这个接口", 404);
  } catch (error) {
    return handle(error);
  }
}

function handle(error: unknown) {
  if (error instanceof HttpError) return fail(error.code, error.message, error.status);
  if (error instanceof ModerationValidation) return fail("invalid_request", error.message, 400);
  if (error instanceof ModerationConflict) return fail("conflict", error.message, 409);
  throw error;
}
