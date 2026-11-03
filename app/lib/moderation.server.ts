import { env } from "cloudflare:workers";
import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import {
  apiTokens,
  moderationLog,
  prompts,
  reports,
  submissions,
  users,
  type User,
} from "~/db/schema";
import type { TokenActor } from "./api-tokens.server";
import { newId } from "./ids";
import type { PromptKind } from "./kinds";
import {
  AUTO_HIDE_REPORTS,
  isReportReason,
  MODERATION_NOTE_LIMIT,
  PROMPT_TRANSITIONS,
  REPORT_NOTE_LIMIT,
  severeReasons,
  SUBMISSION_TRANSITIONS,
  type ModerationAction,
  type PromptAction,
  type PromptStatus,
  type ReportReason,
  type ReportTarget,
  type SubmissionAction,
  type SubmissionStatus,
} from "./moderation";

/** Prompt review is opt-in; without it new prompts publish immediately. */
export const promptReviewEnabled = () => String(env.PROMPT_REVIEW) === "true";

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
  const d = db();
  const [updated] = await d
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
  if (action !== "restore") {
    await d
      .update(reports)
      .set({
        status: action === "approve" ? "dismissed" : "accepted",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(reports.targetType, "prompt"),
          eq(reports.targetId, promptId),
          eq(reports.status, "open"),
        ),
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
      .update(reports)
      .set({ status: reportStatus, resolvedAt: new Date() })
      .where(
        and(
          eq(reports.targetType, "submission"),
          eq(reports.targetId, submissionId),
          eq(reports.status, "open"),
        ),
      );
  }

  await writeLog(actor, "submission", submissionId, SUBMISSION_ACTION_LOG[action], clean);
  return updated;
}

/* ---------- reports ---------- */

export class ReportConflict extends Error {}

interface ReportTargetRow {
  id: string;
  status: PromptStatus | SubmissionStatus;
  authorId: number;
}

async function loadReportTarget(
  target: ReportTarget,
  id: string,
): Promise<ReportTargetRow | null> {
  if (target === "prompt") {
    const [row] = await db()
      .select({ id: prompts.id, status: prompts.status, authorId: prompts.authorId })
      .from(prompts)
      .where(eq(prompts.id, id));
    return row ?? null;
  }
  const [row] = await db()
    .select({
      id: submissions.id,
      status: submissions.status,
      authorId: submissions.authorId,
      promptStatus: prompts.status,
    })
    .from(submissions)
    .innerJoin(prompts, eq(prompts.id, submissions.promptId))
    .where(eq(submissions.id, id));
  if (!row || row.promptStatus !== "active") return null;
  return { id: row.id, status: row.status, authorId: row.authorId };
}

export async function createReport(
  reporter: Pick<User, "id">,
  target: ReportTarget,
  targetId: string,
  reason: ReportReason,
  note: string | null,
) {
  const clean = (note ?? "").trim().slice(0, REPORT_NOTE_LIMIT) || null;
  const noun = target === "prompt" ? "题目" : "答案";

  if (!isReportReason(reason, target)) throw new ModerationValidation("请选择举报理由");

  const row = await loadReportTarget(target, targetId);
  if (!row) throw new ReportConflict(`找不到${noun}`);
  if (row.authorId === reporter.id) throw new ReportConflict(`不能举报自己的${noun}`);
  const reportable =
    target === "prompt"
      ? row.status === "active"
      : row.status === "active" || row.status === "flagged";
  if (!reportable) throw new ReportConflict(`${noun}未公开，不需要举报`);

  const [existing] = await db()
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, target),
        eq(reports.targetId, targetId),
        eq(reports.reporterId, reporter.id),
      ),
    );
  if (existing) throw new ReportConflict(`你已经举报过这${target === "prompt" ? "道题" : "份答案"}`);

  await db().insert(reports).values({
    id: newId(12),
    targetType: target,
    targetId,
    reporterId: reporter.id,
    reason,
    note: clean,
  });

  if (severeReasons(target).includes(reason)) {
    await autoHideIfFlagged(target, targetId);
  }
}

/** Hides a reported target once enough distinct users call it severe. */
async function autoHideIfFlagged(target: ReportTarget, targetId: string) {
  const [row] = await db()
    .select({ n: sql<number>`count(distinct ${reports.reporterId})` })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, target),
        eq(reports.targetId, targetId),
        eq(reports.status, "open"),
        inArray(reports.reason, severeReasons(target)),
      ),
    );
  if (row.n < AUTO_HIDE_REPORTS) return false;

  const d = db();
  if (target === "prompt") {
    const [hidden] = await d
      .update(prompts)
      .set({ status: "pending", moderationNote: "收到多起严重举报，等待复核。" })
      .where(and(eq(prompts.id, targetId), eq(prompts.status, "active")))
      .returning({ id: prompts.id });
    if (!hidden) return false;
    await writeLog(null, "prompt", targetId, "prompt_flag", null);
    return true;
  }

  const [flagged] = await d
    .update(submissions)
    .set({ status: "flagged" })
    .where(and(eq(submissions.id, targetId), eq(submissions.status, "active")))
    .returning({ id: submissions.id });
  if (!flagged) return false;
  await writeLog(null, "submission", targetId, "submission_flag", null);
  return true;
}

export async function hasReported(userId: number, target: ReportTarget, targetId: string) {
  const [row] = await db()
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, target),
        eq(reports.targetId, targetId),
        eq(reports.reporterId, userId),
      ),
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
        allowSearch: prompts.allowSearch,
        allowLibraries: prompts.allowLibraries,
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
      allowSearch: prompts.allowSearch,
      allowLibraries: prompts.allowLibraries,
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

export interface ReportEntry {
  id: string;
  reason: ReportReason;
  note: string | null;
  createdAt: Date;
  reporter: { id: number; username: string; avatarTemplate: string | null };
}

export interface PromptReportTarget {
  id: string;
  status: PromptStatus;
  createdAt: Date;
  title: string;
  kind: PromptKind;
  excerpt: string;
  author: { id: number; username: string; avatarTemplate: string | null };
}

export interface SubmissionReportTarget {
  id: string;
  status: SubmissionStatus;
  createdAt: Date;
  model: string;
  provider: string;
  promptId: string;
  promptTitle: string;
  promptStatus: PromptStatus;
  kind: PromptKind;
  author: { id: number; username: string; avatarTemplate: string | null };
}

export type ReportGroup = { reports: ReportEntry[]; firstReportAt: Date } & (
  | { targetType: "prompt"; prompt: PromptReportTarget }
  | { targetType: "submission"; submission: SubmissionReportTarget }
);

interface GroupRow {
  targetType: ReportTarget;
  targetId: string;
  firstAt: number;
  status: string;
}

/**
 * Reported prompts and answers in one queue: automatically hidden targets come
 * first, then by how long the oldest report has waited.
 */
export async function listReportGroups(page = 1, limit = REPORT_GROUP_PAGE_SIZE) {
  const d = db();
  const open = eq(reports.status, "open");
  const statusExpr = sql<string>`case ${reports.targetType}
    when 'prompt' then (select status from prompts p where p.id = ${reports.targetId})
    else (select status from submissions s where s.id = ${reports.targetId}) end`;

  const [grouped, [total]] = await Promise.all([
    d
      .select({
        targetType: reports.targetType,
        targetId: reports.targetId,
        firstAt: sql<number>`min(${reports.createdAt})`,
        status: statusExpr,
      })
      .from(reports)
      .where(open)
      .groupBy(reports.targetType, reports.targetId)
      .orderBy(
        desc(sql`case when (${statusExpr}) in ('flagged', 'pending') then 1 else 0 end`),
        asc(sql`min(${reports.createdAt})`),
      )
      .limit(limit)
      .offset((page - 1) * limit),
    d
      .select({
        n: sql<number>`count(distinct ${reports.targetType} || ':' || ${reports.targetId})`,
      })
      .from(reports)
      .where(open),
  ]);

  return {
    groups: await hydrateReportGroups(grouped),
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

async function hydrateReportGroups(grouped: GroupRow[]): Promise<ReportGroup[]> {
  if (grouped.length === 0) return [];
  const d = db();
  const open = eq(reports.status, "open");
  const promptIds = grouped.filter((g) => g.targetType === "prompt").map((g) => g.targetId);
  const submissionIds = grouped
    .filter((g) => g.targetType === "submission")
    .map((g) => g.targetId);
  const allIds = [...promptIds, ...submissionIds];

  const [promptRows, submissionRows, reportRows] = await Promise.all([
    promptIds.length === 0
      ? Promise.resolve([])
      : d
          .select({
            id: prompts.id,
            status: prompts.status,
            createdAt: prompts.createdAt,
            title: prompts.title,
            kind: prompts.kind,
            excerpt: sql<string>`substr(${prompts.body}, 1, 360)`,
            author: {
              id: users.id,
              username: users.username,
              avatarTemplate: users.avatarTemplate,
            },
          })
          .from(prompts)
          .innerJoin(users, eq(users.id, prompts.authorId))
          .where(inArray(prompts.id, promptIds)),
    submissionIds.length === 0
      ? Promise.resolve([])
      : d
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
          .where(inArray(submissions.id, submissionIds)),
    d
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        note: reports.note,
        createdAt: reports.createdAt,
        reporter: {
          id: users.id,
          username: users.username,
          avatarTemplate: users.avatarTemplate,
        },
      })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.reporterId))
      .where(and(open, inArray(reports.targetId, allIds)))
      .orderBy(asc(reports.createdAt)),
  ]);

  const promptsById = new Map(promptRows.map((row) => [row.id, row]));
  const submissionsById = new Map(submissionRows.map((row) => [row.id, row]));
  const reportsByKey = new Map<string, ReportEntry[]>();
  for (const row of reportRows) {
    const key = `${row.targetType}:${row.targetId}`;
    const entry: ReportEntry = {
      id: row.id,
      reason: row.reason,
      note: row.note,
      createdAt: row.createdAt,
      reporter: row.reporter,
    };
    const bucket = reportsByKey.get(key);
    if (bucket) bucket.push(entry);
    else reportsByKey.set(key, [entry]);
  }

  const out: ReportGroup[] = [];
  for (const g of grouped) {
    const entries = reportsByKey.get(`${g.targetType}:${g.targetId}`) ?? [];
    const firstReportAt = new Date(g.firstAt);
    if (g.targetType === "prompt") {
      const prompt = promptsById.get(g.targetId);
      if (prompt) out.push({ targetType: "prompt", prompt, reports: entries, firstReportAt });
    } else {
      const submission = submissionsById.get(g.targetId);
      if (submission) {
        out.push({ targetType: "submission", submission, reports: entries, firstReportAt });
      }
    }
  }
  return out;
}

/** Every report about one target, for the moderation API. */
export async function listAllReports(target: ReportTarget, targetId: string) {
  return db()
    .select({
      id: reports.id,
      reason: reports.reason,
      note: reports.note,
      status: reports.status,
      createdAt: reports.createdAt,
      reporter: users.username,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(and(eq(reports.targetType, target), eq(reports.targetId, targetId)))
    .orderBy(asc(reports.createdAt));
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
      .select({
        n: sql<number>`count(distinct ${reports.targetType} || ':' || ${reports.targetId})`,
      })
      .from(reports)
      .where(eq(reports.status, "open")),
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

