import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import {
  apiTokens,
  moderationLog,
  prompts,
  submissionReports,
  submissions,
  users,
  type User,
} from "~/db/schema";
import type { TokenActor } from "./api-tokens.server";
import { newId } from "./ids";
import {
  AUTO_HIDE_REPORTS,
  MODERATION_NOTE_LIMIT,
  PROMPT_TRANSITIONS,
  REPORT_NOTE_LIMIT,
  SEVERE_REASONS,
  SUBMISSION_TRANSITIONS,
  type ModerationAction,
  type PromptAction,
  type PromptStatus,
  type ReportReason,
  type SubmissionAction,
  type SubmissionStatus,
} from "./moderation";

/** Who performed a moderation action: a signed-in admin or an API token. */
export type Actor =
  | { kind: "user"; user: Pick<User, "id" | "username"> }
  | { kind: "token"; token: TokenActor };

const actorColumns = (actor: Actor) =>
  actor.kind === "user"
    ? { actorUserId: actor.user.id, actorTokenId: null }
    : { actorUserId: null, actorTokenId: actor.token.id };


/** Raised when a conditional update matched nothing, e.g. another admin got there first. */
export class ModerationConflict extends Error {}

/** Raised for malformed requests, so callers can answer 400 rather than 409. */
export class ModerationValidation extends Error {}

const PROMPT_ACTION_LOG: Record<PromptAction, ModerationAction> = {
  approve: "prompt_approve",
  reject: "prompt_reject",
  remove: "prompt_remove",
  restore: "prompt_restore",
};

const SUBMISSION_ACTION_LOG: Record<SubmissionAction, ModerationAction> = {
  keep: "submission_keep",
  remove: "submission_remove",
  restore: "submission_restore",
};

async function writeLog(
  actor: Actor | null,
  targetType: "prompt" | "submission",
  targetId: string,
  action: ModerationAction,
  note: string | null,
) {
  await db().insert(moderationLog).values({
    id: newId(12),
    ...(actor ? actorColumns(actor) : { actorUserId: null, actorTokenId: null }),
    targetType,
    targetId,
    action,
    note,
  });
}

function cleanNote(note: string | null | undefined, required: boolean) {
  const clean = (note ?? "").trim().slice(0, MODERATION_NOTE_LIMIT);
  if (required && !clean) throw new ModerationValidation("请填写理由");
  return clean || null;
}

export async function getPromptStatus(id: string) {
  const [row] = await db()
    .select({ id: prompts.id, status: prompts.status, authorId: prompts.authorId })
    .from(prompts)
    .where(eq(prompts.id, id));
  return row ?? null;
}

export async function applyPromptAction(
  actor: Actor,
  promptId: string,
  action: PromptAction,
  note?: string | null,
) {
  const transition = PROMPT_TRANSITIONS[action];
  const clean = cleanNote(note, transition.noteRequired);
  const [updated] = await db()
    .update(prompts)
    .set({
      status: transition.to,
      moderationNote: action === "reject" || action === "remove" ? clean : null,
    })
    .where(and(eq(prompts.id, promptId), inArray(prompts.status, transition.from)))
    .returning({ id: prompts.id, status: prompts.status });
  if (!updated) {
    throw new ModerationConflict(
      action === "approve" ? "题目已被处理" : "题目当前状态不允许此操作",
    );
  }
  await writeLog(actor, "prompt", promptId, PROMPT_ACTION_LOG[action], clean);
  return updated;
}

export async function applySubmissionAction(
  actor: Actor,
  submissionId: string,
  action: SubmissionAction,
  note?: string | null,
) {
  const transition = SUBMISSION_TRANSITIONS[action];
  const clean = cleanNote(note, transition.noteRequired);
  const d = db();

  const [updated] = await d
    .update(submissions)
    .set({
      status: transition.to,
      moderationNote: action === "remove" ? clean : null,
    })
    .where(and(eq(submissions.id, submissionId), inArray(submissions.status, transition.from)))
    .returning({ id: submissions.id, status: submissions.status });
  if (!updated) {
    throw new ModerationConflict(
      action === "restore" ? "答案未被下架" : "答案当前状态不允许此操作",
    );
  }

  // Keeping an answer dismisses the reports behind it; removing one accepts them.
  const reportStatus = action === "remove" ? "accepted" : "dismissed";
  if (action !== "restore") {
    await d
      .update(submissionReports)
      .set({ status: reportStatus, resolvedAt: new Date() })
      .where(
        and(eq(submissionReports.submissionId, submissionId), eq(submissionReports.status, "open")),
      );
  }

  await writeLog(actor, "submission", submissionId, SUBMISSION_ACTION_LOG[action], clean);
  return updated;
}

/* ---------- reports ---------- */

export class ReportConflict extends Error {}

export async function createReport(
  reporter: Pick<User, "id">,
  submissionId: string,
  reason: ReportReason,
  note: string | null,
) {
  const clean = (note ?? "").trim().slice(0, REPORT_NOTE_LIMIT) || null;

  const [submission] = await db()
    .select({
      id: submissions.id,
      status: submissions.status,
      authorId: submissions.authorId,
      promptStatus: prompts.status,
    })
    .from(submissions)
    .innerJoin(prompts, eq(prompts.id, submissions.promptId))
    .where(eq(submissions.id, submissionId));
  if (!submission || submission.promptStatus !== "active") throw new ReportConflict("找不到答案");
  if (submission.authorId === reporter.id) throw new ReportConflict("不能举报自己的答案");
  if (submission.status !== "active" && submission.status !== "flagged") {
    throw new ReportConflict("答案未公开，不需要举报");
  }

  const [existing] = await db()
    .select({ id: submissionReports.id })
    .from(submissionReports)
    .where(
      and(
        eq(submissionReports.submissionId, submissionId),
        eq(submissionReports.reporterId, reporter.id),
      ),
    );
  if (existing) throw new ReportConflict("你已经举报过这份答案");

  await db().insert(submissionReports).values({
    id: newId(12),
    submissionId,
    reporterId: reporter.id,
    reason,
    note: clean,
  });

  if ((SEVERE_REASONS as readonly string[]).includes(reason)) {
    await autoHideIfFlagged(submissionId);
  }
}

/** Hides an answer once enough distinct users report it for a severe reason. */
async function autoHideIfFlagged(submissionId: string) {
  const [row] = await db()
    .select({ n: sql<number>`count(distinct ${submissionReports.reporterId})` })
    .from(submissionReports)
    .where(
      and(
        eq(submissionReports.submissionId, submissionId),
        eq(submissionReports.status, "open"),
        inArray(submissionReports.reason, SEVERE_REASONS),
      ),
    );
  if (row.n < AUTO_HIDE_REPORTS) return false;

  const [flagged] = await db()
    .update(submissions)
    .set({ status: "flagged" })
    .where(and(eq(submissions.id, submissionId), eq(submissions.status, "active")))
    .returning({ id: submissions.id });
  if (!flagged) return false;
  await writeLog(null, "submission", submissionId, "submission_flag", null);
  return true;
}

export async function hasReported(userId: number, submissionId: string) {
  const [row] = await db()
    .select({ id: submissionReports.id })
    .from(submissionReports)
    .where(
      and(eq(submissionReports.submissionId, submissionId), eq(submissionReports.reporterId, userId)),
    );
  return Boolean(row);
}

/* ---------- admin: prompts ---------- */

const authorColumns = {
  id: users.id,
  username: users.username,
  avatarTemplate: users.avatarTemplate,
  trustLevel: users.trustLevel,
};

/** Approved and rejected counts for the authors on this page. */
async function reviewStats(authorIds: number[]) {
  if (authorIds.length === 0) return new Map<number, { approved: number; rejected: number }>();
  const rows = await db()
    .select({ authorId: prompts.authorId, status: prompts.status, n: count() })
    .from(prompts)
    .where(
      and(
        inArray(prompts.authorId, authorIds),
        or(eq(prompts.status, "active"), eq(prompts.status, "rejected")),
      ),
    )
    .groupBy(prompts.authorId, prompts.status);
  const stats = new Map<number, { approved: number; rejected: number }>();
  for (const id of authorIds) stats.set(id, { approved: 0, rejected: 0 });
  for (const row of rows) {
    const entry = stats.get(row.authorId)!;
    if (row.status === "active") entry.approved = row.n;
    else entry.rejected = row.n;
  }
  return stats;
}

export const PENDING_PAGE_SIZE = 10;

export async function listPendingPrompts(page = 1, limit = PENDING_PAGE_SIZE) {
  const where = eq(prompts.status, "pending");
  const [rows, [total]] = await Promise.all([
    db()
      .select({
        id: prompts.id,
        title: prompts.title,
        body: prompts.body,
        kind: prompts.kind,
        createdAt: prompts.createdAt,
        author: authorColumns,
      })
      .from(prompts)
      .innerJoin(users, eq(users.id, prompts.authorId))
      .where(where)
      .orderBy(asc(prompts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db().select({ n: count() }).from(prompts).where(where),
  ]);
  const stats = await reviewStats(rows.map((r) => r.author.id));
  return {
    prompts: rows.map((r) => ({ ...r, history: stats.get(r.author.id)! })),
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

export async function getPromptForReview(id: string) {
  const [row] = await db()
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      kind: prompts.kind,
      status: prompts.status,
      moderationNote: prompts.moderationNote,
      createdAt: prompts.createdAt,
      author: authorColumns,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(eq(prompts.id, id));
  if (!row) return null;
  const stats = await reviewStats([row.author.id]);
  return { ...row, history: stats.get(row.author.id)! };
}

/* ---------- admin: reports ---------- */

export const REPORT_GROUP_PAGE_SIZE = 20;

export interface ReportGroup {
  submission: {
    id: string;
    status: SubmissionStatus;
    createdAt: Date;
    model: string;
    provider: string;
    promptId: string;
    promptTitle: string;
    promptStatus: PromptStatus;
    kind: "web" | "markdown" | "svg";
    author: { id: number; username: string; avatarTemplate: string | null };
  };
  reports: {
    id: string;
    reason: ReportReason;
    note: string | null;
    createdAt: Date;
    reporter: { id: number; username: string; avatarTemplate: string | null };
  }[];
  firstReportAt: Date;
}

/**
 * Answers with open reports, ordered so automatically hidden ones come first,
 * then by how long the oldest report has waited.
 */
export async function listReportGroups(page = 1, limit = REPORT_GROUP_PAGE_SIZE) {
  const d = db();
  const open = eq(submissionReports.status, "open");
  const [grouped, [totalGroups]] = await Promise.all([
    d
      .select({
        submissionId: submissionReports.submissionId,
        firstAt: sql<number>`min(${submissionReports.createdAt})`,
        status: submissions.status,
      })
      .from(submissionReports)
      .innerJoin(submissions, eq(submissions.id, submissionReports.submissionId))
      .where(open)
      .groupBy(submissionReports.submissionId, submissions.status)
      .orderBy(
        desc(sql`case when ${submissions.status} = 'flagged' then 1 else 0 end`),
        asc(sql`min(${submissionReports.createdAt})`),
      )
      .limit(limit)
      .offset((page - 1) * limit),
    d
      .select({ n: sql<number>`count(distinct ${submissionReports.submissionId})` })
      .from(submissionReports)
      .where(open),
  ]);

  return {
    groups: await hydrateReportGroups(grouped),
    total: totalGroups.n,
    page,
    nextPage: page * limit < totalGroups.n ? page + 1 : null,
  };
}

interface GroupKey {
  submissionId: string;
  firstAt: number;
  status: SubmissionStatus;
}

async function hydrateReportGroups(grouped: GroupKey[]): Promise<ReportGroup[]> {
  const d = db();
  const open = eq(submissionReports.status, "open");
  const ids = grouped.map((g) => g.submissionId);
  if (ids.length === 0) return [];

  const [submissionRows, reportRows] = await Promise.all([
    d
      .select({
        id: submissions.id,
        status: submissions.status,
        createdAt: submissions.createdAt,
        promptId: prompts.id,
        promptTitle: prompts.title,
        promptStatus: prompts.status,
        kind: prompts.kind,
        author: {
          id: users.id,
          username: users.username,
          avatarTemplate: users.avatarTemplate,
        },
        model: sql<string>`(select name from models where models.id = ${submissions.modelId})`,
        provider: sql<string>`(select name from providers where providers.id = ${submissions.providerId})`,
      })
      .from(submissions)
      .innerJoin(prompts, eq(prompts.id, submissions.promptId))
      .innerJoin(users, eq(users.id, submissions.authorId))
      .where(inArray(submissions.id, ids)),
    d
      .select({
        id: submissionReports.id,
        submissionId: submissionReports.submissionId,
        reason: submissionReports.reason,
        note: submissionReports.note,
        createdAt: submissionReports.createdAt,
        reporter: {
          id: users.id,
          username: users.username,
          avatarTemplate: users.avatarTemplate,
        },
      })
      .from(submissionReports)
      .innerJoin(users, eq(users.id, submissionReports.reporterId))
      .where(and(open, inArray(submissionReports.submissionId, ids)))
      .orderBy(asc(submissionReports.createdAt)),
  ]);

  const byId = new Map(submissionRows.map((s) => [s.id, s]));
  return grouped.flatMap((g) => {
    const submission = byId.get(g.submissionId);
    if (!submission) return [];
    return [
      {
        submission,
        reports: reportRows.filter((r) => r.submissionId === g.submissionId),
        firstReportAt: new Date(g.firstAt),
      },
    ];
  });
}

/** One answer's open reports, for the submission page and the API. */
export async function getReportGroup(submissionId: string) {
  const [row] = await db()
    .select({
      firstAt: sql<number>`min(${submissionReports.createdAt})`,
      status: submissions.status,
    })
    .from(submissionReports)
    .innerJoin(submissions, eq(submissions.id, submissionReports.submissionId))
    .where(
      and(
        eq(submissionReports.status, "open"),
        eq(submissionReports.submissionId, submissionId),
      ),
    )
    .groupBy(submissions.status);
  if (!row) return null;
  const [group] = await hydrateReportGroups([
    { submissionId, firstAt: row.firstAt, status: row.status },
  ]);
  return group ?? null;
}

/** Appeal details for the API: open and resolved reports of one answer. */
export async function listAllReports(submissionId: string) {
  return db()
    .select({
      id: submissionReports.id,
      reason: submissionReports.reason,
      note: submissionReports.note,
      status: submissionReports.status,
      createdAt: submissionReports.createdAt,
      reporter: users.username,
    })
    .from(submissionReports)
    .innerJoin(users, eq(users.id, submissionReports.reporterId))
    .where(eq(submissionReports.submissionId, submissionId))
    .orderBy(asc(submissionReports.createdAt));
}

/* ---------- admin: log & counters ---------- */

export const LOG_PAGE_SIZE = 50;

export async function listModerationLog(page = 1, limit = LOG_PAGE_SIZE) {
  const d = db();
  const [rows, [total]] = await Promise.all([
    d
      .select({
        id: moderationLog.id,
        targetType: moderationLog.targetType,
        targetId: moderationLog.targetId,
        action: moderationLog.action,
        note: moderationLog.note,
        createdAt: moderationLog.createdAt,
        actor: users.username,
        token: apiTokens.name,
        promptTitle: sql<string | null>`(
          select p.title from prompts p
          where ${moderationLog.targetType} = 'prompt' and p.id = ${moderationLog.targetId})`,
        submissionModel: sql<string | null>`(
          select m.name from submissions s join models m on m.id = s.model_id
          where ${moderationLog.targetType} = 'submission' and s.id = ${moderationLog.targetId})`,
        submissionPrompt: sql<string | null>`(
          select p.title from submissions s join prompts p on p.id = s.prompt_id
          where ${moderationLog.targetType} = 'submission' and s.id = ${moderationLog.targetId})`,
      })
      .from(moderationLog)
      .leftJoin(users, eq(users.id, moderationLog.actorUserId))
      .leftJoin(apiTokens, eq(apiTokens.id, moderationLog.actorTokenId))
      .orderBy(desc(moderationLog.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    d.select({ n: count() }).from(moderationLog),
  ]);
  return {
    entries: rows,
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

export async function moderationCounts() {
  const d = db();
  const [[pending], [reported]] = await Promise.all([
    d.select({ n: count() }).from(prompts).where(eq(prompts.status, "pending")),
    d
      .select({ n: sql<number>`count(distinct ${submissionReports.submissionId})` })
      .from(submissionReports)
      .where(eq(submissionReports.status, "open")),
  ]);
  return { pending: pending.n, reports: reported.n, total: pending.n + reported.n };
}

/* ---------- API reads ---------- */

/** Everything an automated reviewer needs about a prompt, in one payload. */
export async function getPromptReviewPayload(id: string) {
  const prompt = await getPromptForReview(id);
  if (!prompt) return null;
  const [answers] = await db()
    .select({ n: count() })
    .from(submissions)
    .where(eq(submissions.promptId, id));
  return { ...prompt, answers: answers.n };
}

export async function listPendingForApi(limit = 20, cursor?: string) {
  const d = db();
  const conditions = [eq(prompts.status, "pending")];
  if (cursor) conditions.push(sql`${prompts.createdAt} > ${Number(cursor)}`);
  const rows = await d
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      kind: prompts.kind,
      status: prompts.status,
      createdAt: prompts.createdAt,
      author: authorColumns,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(and(...conditions))
    .orderBy(asc(prompts.createdAt))
    .limit(limit);
  const stats = await reviewStats(rows.map((r) => r.author.id));
  const items = rows.map((r) => ({ ...r, history: stats.get(r.author.id)! }));
  const last = rows.at(-1);
  return { items, nextCursor: rows.length === limit && last ? String(last.createdAt.getTime()) : null };
}

export async function listReportGroupsForApi(limit = 20, cursor?: string) {
  const { groups, nextPage } = await listReportGroups(1, 200);
  const filtered = cursor
    ? groups.filter((g) => g.firstReportAt.getTime() > Number(cursor))
    : groups;
  const items = filtered.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: items.length === limit && last ? String(last.firstReportAt.getTime()) : null,
    hasMore: filtered.length > limit || nextPage !== null,
  };
}

/** Token bookkeeping for the admin page. */
export async function latestLogForTarget(targetType: "prompt" | "submission", targetId: string) {
  const [row] = await db()
    .select({
      action: moderationLog.action,
      note: moderationLog.note,
      createdAt: moderationLog.createdAt,
      actor: users.username,
      token: apiTokens.name,
    })
    .from(moderationLog)
    .leftJoin(users, eq(users.id, moderationLog.actorUserId))
    .leftJoin(apiTokens, eq(apiTokens.id, moderationLog.actorTokenId))
    .where(and(eq(moderationLog.targetType, targetType), eq(moderationLog.targetId, targetId)))
    .orderBy(desc(moderationLog.createdAt))
    .limit(1);
  return row ?? null;
}

