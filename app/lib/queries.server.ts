import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "~/db/client.server";
import {
  harnesses,
  models,
  mods,
  prompts,
  providers,
  ratings,
  submissionMods,
  submissionReports,
  submissions,
  users,
} from "~/db/schema";
import { CatalogError, type Catalog, type CatalogEntry, type CatalogKind } from "./catalog";
import { slugify } from "./ids";
import type { PromptKind } from "./kinds";
import { matchModel } from "./model-match";
import type { PromptSort } from "./prompt-sort";

/** Gallery order shrinks stars toward a neutral 3 so one vote does not top the list. */
const PRIOR_VOTES = 3;
const SORT_PRIOR = 3;
const priorStars = sql.raw(String(SORT_PRIOR * PRIOR_VOTES));
const priorVotes = sql.raw(String(PRIOR_VOTES));

/** Free-text catalogs. Models are kept out: they come from the synced source. */
const EDITABLE_TABLES = { providers, harnesses, mods };
export type EditableCatalogKind = keyof typeof EDITABLE_TABLES;

/** Escapes LIKE wildcards so a literal "%" in a search does not match everything. */
function likePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const nameLike = (column: SQLiteColumn, query: string) =>
  sql`${column} like ${likePattern(query)} escape '\\'`;

/** Popular entries only; the full catalog is searched remotely as the user types. */
export async function searchCatalog(kind: CatalogKind, query = "", limit = 20) {
  const d = db();

  if (kind === "mods") {
    const [rows, [total]] = await Promise.all([
      d
        .select({ id: mods.id, name: mods.name, uses: count(submissions.id) })
        .from(mods)
        .leftJoin(submissionMods, eq(submissionMods.modId, mods.id))
        .leftJoin(
          submissions,
          and(
            eq(submissions.id, submissionMods.submissionId),
            eq(submissions.status, "active"),
          ),
        )
        .where(query ? nameLike(mods.name, query) : undefined)
        .groupBy(mods.id, mods.name)
        .orderBy(desc(count(submissions.id)), asc(mods.name))
        .limit(limit),
      d
        .select({ n: count() })
        .from(mods)
        .where(query ? nameLike(mods.name, query) : undefined),
    ]);
    return { items: rows, total: total.n };
  }

  if (kind === "models") {
    const where = query
      ? and(eq(models.hidden, false), nameLike(models.name, query))
      : eq(models.hidden, false);
    const [rows, [total]] = await Promise.all([
      d
        .select({ id: models.id, name: models.name, uses: count(submissions.id) })
        .from(models)
        .leftJoin(
          submissions,
          and(eq(submissions.modelId, models.id), eq(submissions.status, "active")),
        )
        .where(where)
        .groupBy(models.id, models.name)
        .orderBy(
          desc(sql`coalesce(${models.releaseDate}, '')`),
          desc(count(submissions.id)),
          asc(models.name),
        )
        .limit(limit),
      d.select({ n: count() }).from(models).where(where),
    ]);
    return { items: rows, total: total.n };
  }

  if (kind === "providers") {
    const where = query ? nameLike(providers.name, query) : undefined;
    const [rows, [total]] = await Promise.all([
      d
        .select({ id: providers.id, name: providers.name, uses: count(submissions.id) })
        .from(providers)
        .leftJoin(
          submissions,
          and(eq(submissions.providerId, providers.id), eq(submissions.status, "active")),
        )
        .where(where)
        .groupBy(providers.id, providers.name, providers.rank)
        .orderBy(asc(providers.rank), desc(count(submissions.id)), asc(providers.name))
        .limit(limit),
      d.select({ n: count() }).from(providers).where(where),
    ]);
    return { items: rows, total: total.n };
  }

  const [rows, [total]] = await Promise.all([
    d
      .select({ id: harnesses.id, name: harnesses.name, uses: count(submissions.id) })
      .from(harnesses)
      .leftJoin(
        submissions,
        and(eq(submissions.harnessId, harnesses.id), eq(submissions.status, "active")),
      )
      .where(query ? nameLike(harnesses.name, query) : undefined)
      .groupBy(harnesses.id, harnesses.name)
      .orderBy(desc(count(submissions.id)), asc(harnesses.name))
      .limit(limit),
    d
      .select({ n: count() })
      .from(harnesses)
      .where(query ? nameLike(harnesses.name, query) : undefined),
  ]);
  return { items: rows, total: total.n };
}

/** Finds the catalog model prefixing a raw log id; scans names once per submission form. */
export async function resolveModel(rawId: string) {
  const rows = await db().select({ id: models.id, name: models.name }).from(models);
  return matchModel(rawId, rows);
}

/** Popular entries for the submit form, without pulling the whole catalog. */
export async function getCatalog(): Promise<Catalog> {
  const [m, p, h, md] = await Promise.all([
    searchCatalog("models", "", 20),
    searchCatalog("providers", "", 30),
    searchCatalog("harnesses", "", 20),
    searchCatalog("mods", "", 20),
  ]);
  return {
    models: m.items.map(({ id, name }) => ({ id, name })),
    providers: p.items.map(({ id, name }) => ({ id, name })),
    harnesses: h.items.map(({ id, name }) => ({ id, name })),
    mods: md.items.map(({ id, name }) => ({ id, name })),
  };
}

/** Resolves a user-typed catalog name to an id, creating the entry when new. */
export async function ensureCatalogEntry(kind: EditableCatalogKind, name: string) {
  const clean = name.trim().slice(0, 60);
  const id = slugify(clean);
  if (!id) throw new Error(`invalid ${kind} name`);
  await db().insert(EDITABLE_TABLES[kind]).values({ id, name: clean }).onConflictDoNothing();
  return id;
}

/** Models are synced, not typed: the submitted name must already be in the catalog. */
export async function requireCatalogModel(name: string) {
  const clean = name.trim().slice(0, 60);
  const id = slugify(clean);
  if (!id) throw new CatalogError("请选择模型");

  const [row] = await db()
    .select({ id: models.id })
    .from(models)
    .where(eq(models.id, id))
    .limit(1);
  if (!row) throw new CatalogError("该模型不在目录中，请从列表选择");
  return row.id;
}

export async function countSince(
  table: "prompts" | "submissions" | "reports",
  authorId: number,
  since: Date,
) {
  const [row] =
    table === "reports"
      ? await db()
          .select({ n: count() })
          .from(submissionReports)
          .where(
            and(eq(submissionReports.reporterId, authorId), gte(submissionReports.createdAt, since)),
          )
      : await (async () => {
          const t = table === "prompts" ? prompts : submissions;
          return db()
            .select({ n: count() })
            .from(t)
            .where(and(eq(t.authorId, authorId), gte(t.createdAt, since)));
        })();
  return row.n;
}

const author = {
  id: users.id,
  username: users.username,
  avatarTemplate: users.avatarTemplate,
};

export type { PromptSort } from "./prompt-sort";
export { DEFAULT_PROMPT_SORT, isPromptSort, PROMPT_SORTS } from "./prompt-sort";

export interface PromptQuery {
  q?: string;
  kind?: PromptKind | null;
  sort?: PromptSort;
  page?: number;
  limit?: number;
}

const PROMPT_PAGE_SIZE = 18;

export async function listPrompts(query: PromptQuery = {}) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = query.limit ?? PROMPT_PAGE_SIZE;
  const conditions = [eq(prompts.status, "active")];
  if (query.kind) conditions.push(eq(prompts.kind, query.kind));
  if (query.q) {
    conditions.push(
      or(nameLike(prompts.title, query.q), nameLike(prompts.body, query.q))!,
    );
  }
  const where = and(...conditions);

  const answerCount = sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id and s.status = 'active')`;
  const coverOrder = sql`(coalesce(sum(r.stars), 0) + ${priorStars}) * 1.0 / (count(r.stars) + ${priorVotes}) desc, s.created_at desc`;
  const coverId = sql<string | null>`(
    select s.id from ${submissions} s
    left join ${ratings} r on r.submission_id = s.id
    where s.prompt_id = ${prompts.id} and s.status = 'active'
    group by s.id
    order by ${coverOrder}
    limit 1)`;
  const coverExcerpt = sql<string | null>`(
    select substr(s.content, 1, 900) from ${submissions} s
    left join ${ratings} r on r.submission_id = s.id
    where s.prompt_id = ${prompts.id} and s.status = 'active'
    group by s.id
    order by ${coverOrder}
    limit 1)`;
  const promptStars = sql<number>`coalesce((
    select sum(r.stars) from ${submissions} s
    inner join ${ratings} r on r.submission_id = s.id
    where s.prompt_id = prompts.id and s.status = 'active'), 0)`;
  const promptVotes = sql<number>`(
    select count(*) from ${submissions} s
    inner join ${ratings} r on r.submission_id = s.id
    where s.prompt_id = prompts.id and s.status = 'active')`;
  const promptScore = sql<number>`(${promptStars} + ${priorStars}) * 1.0 / (${promptVotes} + ${priorVotes})`;
  const lastActivityAt = sql<number>`coalesce((
    select max(s.created_at) from ${submissions} s
    where s.prompt_id = ${prompts.id} and s.status = 'active'), ${prompts.createdAt})`;

  const order =
    query.sort === "answers"
      ? [desc(answerCount), desc(prompts.createdAt)]
      : query.sort === "hardest"
        ? [asc(promptScore), desc(prompts.createdAt)]
        : query.sort === "new"
          ? [desc(prompts.createdAt)]
          : [desc(lastActivityAt), desc(prompts.createdAt)];

  const [rows, [total]] = await Promise.all([
    db()
      .select({
        id: prompts.id,
        title: prompts.title,
        body: prompts.body,
        kind: prompts.kind,
        createdAt: prompts.createdAt,
        lastActivityAt,
        author,
        submissions: answerCount,
        coverSubmissionId: coverId,
        coverExcerpt,
      })
      .from(prompts)
      .innerJoin(users, eq(users.id, prompts.authorId))
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db().select({ n: count() }).from(prompts).where(where),
  ]);

  return {
    prompts: rows,
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

export async function getPrompt(id: string) {
  const [row] = await db()
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      kind: prompts.kind,
      status: prompts.status,
      moderationNote: prompts.moderationNote,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      author,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(eq(prompts.id, id));
  return row ?? null;
}

/** Read model for the author's own prompt list. Includes hidden records. */
export async function listOwnPrompts(authorId: number, page = 1, limit = 18) {
  const answerCount = sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id and s.status = 'active')`;
  const submissionCount = sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id)`;
  const starSum = sql<number>`coalesce((select sum(r.stars) from ${submissions} s inner join ${ratings} r on r.submission_id = s.id where s.prompt_id = prompts.id and s.status = 'active'), 0)`;
  const votes = sql<number>`(select count(*) from ${submissions} s inner join ${ratings} r on r.submission_id = s.id where s.prompt_id = prompts.id and s.status = 'active')`;
  const where = eq(prompts.authorId, authorId);
  const pageQuery = db()
    .select({
      id: prompts.id,
      title: prompts.title,
      kind: prompts.kind,
      status: prompts.status,
      moderationNote: prompts.moderationNote,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      answers: answerCount,
      submissions: submissionCount,
      starSum,
      votes,
    })
    .from(prompts)
    .where(where)
    .orderBy(desc(prompts.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const [rows, [total]] = await Promise.all([
    pageQuery,
    db().select({ n: count() }).from(prompts).where(where),
  ]);
  return {
    prompts: rows,
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

/** Read model for the author's own answer list. Includes withdrawn answers. */
export async function listOwnSubmissions(authorId: number, page = 1, limit = 24) {
  const where = eq(submissions.authorId, authorId);
  const [rows, [total]] = await Promise.all([
    db()
      .select({
        id: submissions.id,
        promptId: submissions.promptId,
        promptTitle: prompts.title,
        promptKind: prompts.kind,
        promptStatus: prompts.status,
        status: submissions.status,
        moderationNote: submissions.moderationNote,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
        excerpt: sql<string | null>`substr(${submissions.content}, 1, 900)`,
        model: { id: models.id, name: models.name },
        provider: { id: providers.id, name: providers.name },
        starSum: sql<number>`coalesce((select sum(r.stars) from ${ratings} r where r.submission_id = submissions.id), 0)`,
        votes: sql<number>`(select count(*) from ${ratings} r where r.submission_id = submissions.id)`,
        otherVotes: sql<number>`(select count(*) from ${ratings} r where r.submission_id = submissions.id and r.user_id <> submissions.author_id)`,
      })
      .from(submissions)
      .innerJoin(prompts, eq(prompts.id, submissions.promptId))
      .innerJoin(models, eq(models.id, submissions.modelId))
      .innerJoin(providers, eq(providers.id, submissions.providerId))
      .where(where)
      .orderBy(desc(submissions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db().select({ n: count() }).from(submissions).where(where),
  ]);
  return {
    submissions: rows,
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

export async function ownContentCounts(authorId: number) {
  const [[p], [s]] = await Promise.all([
    db().select({ n: count() }).from(prompts).where(eq(prompts.authorId, authorId)),
    db().select({ n: count() }).from(submissions).where(eq(submissions.authorId, authorId)),
  ]);
  return { prompts: p.n, submissions: s.n };
}

/** Everything the prompt edit page and the delete guard need. */
export async function getPromptForEdit(id: string) {
  const [row] = await db()
    .select({
      id: prompts.id,
      authorId: prompts.authorId,
      title: prompts.title,
      body: prompts.body,
      kind: prompts.kind,
      status: prompts.status,
      moderationNote: prompts.moderationNote,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      answers: sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id and s.status = 'active')`,
      submissions: sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id)`,
    })
    .from(prompts)
    .where(eq(prompts.id, id));
  return row ?? null;
}

export async function countOtherRatings(submissionId: string, authorId: number) {
  const [row] = await db()
    .select({ n: count() })
    .from(ratings)
    .where(and(eq(ratings.submissionId, submissionId), ne(ratings.userId, authorId)));
  return row.n;
}

export async function updatePrompt(input: {
  id: string;
  authorId: number;
  title: string;
  body: string;
  kind: PromptKind;
  locked: boolean;
  /** True when the author's changes must be reviewed again before going public. */
  reviewed: boolean;
}) {
  const set = input.locked
    ? { title: input.title, updatedAt: new Date() }
    : {
        title: input.title,
        body: input.body,
        kind: input.kind,
        ...(input.reviewed ? { status: "pending" as const, moderationNote: null } : {}),
        updatedAt: new Date(),
      };
  const condition = input.locked
    ? and(eq(prompts.id, input.id), eq(prompts.authorId, input.authorId))
    : and(
        eq(prompts.id, input.id),
        eq(prompts.authorId, input.authorId),
        sql`not exists (select 1 from ${submissions} where submissions.prompt_id = prompts.id and submissions.status = 'active')`,
      );
  const result = await db().update(prompts).set(set).where(condition);
  return result.meta.changes > 0;
}

export type DeletePromptResult = "ok" | "not_found" | "forbidden" | "has_submissions";

export async function deletePrompt(id: string, authorId: number): Promise<DeletePromptResult> {
  const [row] = await db()
    .select({ authorId: prompts.authorId })
    .from(prompts)
    .where(eq(prompts.id, id));
  if (!row) return "not_found";
  if (row.authorId !== authorId) return "forbidden";

  const result = await db()
    .delete(prompts)
    .where(
      and(
        eq(prompts.id, id),
        eq(prompts.authorId, authorId),
        sql`not exists (select 1 from ${submissions} where submissions.prompt_id = prompts.id)`,
      ),
    );
  return result.meta.changes > 0 ? "ok" : "has_submissions";
}

export interface SubmissionFilters {
  model?: string;
  provider?: string;
  harness?: string;
  mod?: string;
}

export type SubmissionSort = "top" | "new";

const submissionColumns = {
  id: submissions.id,
  promptId: submissions.promptId,
  reasoning: submissions.reasoning,
  createdAt: submissions.createdAt,
  updatedAt: submissions.updatedAt,
  totalBytes: submissions.totalBytes,
  logMeta: submissions.logMeta,
  excerpt: sql<string | null>`substr(${submissions.content}, 1, 1200)`,
  model: { id: models.id, name: models.name },
  provider: { id: providers.id, name: providers.name },
  harness: { id: harnesses.id, name: harnesses.name },
  author,
  votes: sql<number>`(select count(*) from ${ratings} r where r.submission_id = submissions.id)`,
  starSum: sql<number>`coalesce((select sum(r.stars) from ${ratings} r where r.submission_id = submissions.id), 0)`,
};

function submissionQuery() {
  return db()
    .select(submissionColumns)
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.authorId))
    .innerJoin(models, eq(models.id, submissions.modelId))
    .innerJoin(providers, eq(providers.id, submissions.providerId))
    .leftJoin(harnesses, eq(harnesses.id, submissions.harnessId));
}

function submissionConditions(promptId: string, filters: SubmissionFilters) {
  const conditions = [eq(submissions.promptId, promptId), eq(submissions.status, "active")];
  if (filters.model) conditions.push(eq(submissions.modelId, filters.model));
  if (filters.provider) conditions.push(eq(submissions.providerId, filters.provider));
  if (filters.harness) conditions.push(eq(submissions.harnessId, filters.harness));
  if (filters.mod) {
    conditions.push(
      sql`exists (select 1 from ${submissionMods} sm where sm.submission_id = ${submissions.id} and sm.mod_id = ${filters.mod})`,
    );
  }
  return and(...conditions);
}

async function attachMods<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, mods: [] as CatalogEntry[] }));
  const links = await db()
    .select({ submissionId: submissionMods.submissionId, id: mods.id, name: mods.name })
    .from(submissionMods)
    .innerJoin(mods, eq(mods.id, submissionMods.modId))
    .where(inArray(submissionMods.submissionId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r,
    mods: links.filter((l) => l.submissionId === r.id).map(({ id, name }) => ({ id, name })),
  }));
}

const SUBMISSION_PAGE_SIZE = 24;

export async function listSubmissions(
  promptId: string,
  filters: SubmissionFilters,
  sort: SubmissionSort,
  page = 1,
  limit = SUBMISSION_PAGE_SIZE,
) {
  const where = submissionConditions(promptId, filters);
  const order =
    sort === "top"
      ? [
          desc(
            sql`(${submissionColumns.starSum} + ${priorStars}) * 1.0 / (${submissionColumns.votes} + ${priorVotes})`,
          ),
          desc(submissions.createdAt),
        ]
      : [desc(submissions.createdAt)];
  const [rows, [total]] = await Promise.all([
    submissionQuery()
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db().select({ n: count() }).from(submissions).where(where),
  ]);
  return {
    submissions: await attachMods(rows),
    total: total.n,
    page,
    nextPage: page * limit < total.n ? page + 1 : null,
  };
}

export interface FacetEntry extends CatalogEntry {
  count: number;
}

export interface PromptFacets {
  models: FacetEntry[];
  providers: FacetEntry[];
  harnesses: FacetEntry[];
  mods: FacetEntry[];
}

/** Only entries that actually appear under this prompt, so filter lists stay bounded. */
export async function getPromptFacets(promptId: string): Promise<PromptFacets> {
  const d = db();
  const active = and(eq(submissions.promptId, promptId), eq(submissions.status, "active"));

  const [m, p, h, md] = await Promise.all([
    d
      .select({ id: models.id, name: models.name, count: count(submissions.id) })
      .from(submissions)
      .innerJoin(models, eq(models.id, submissions.modelId))
      .where(active)
      .groupBy(models.id, models.name)
      .orderBy(desc(count(submissions.id)), asc(models.name))
      .limit(500),
    d
      .select({ id: providers.id, name: providers.name, count: count(submissions.id) })
      .from(submissions)
      .innerJoin(providers, eq(providers.id, submissions.providerId))
      .where(active)
      .groupBy(providers.id, providers.name)
      .orderBy(desc(count(submissions.id)), asc(providers.name))
      .limit(500),
    d
      .select({ id: harnesses.id, name: harnesses.name, count: count(submissions.id) })
      .from(submissions)
      .innerJoin(harnesses, eq(harnesses.id, submissions.harnessId))
      .where(active)
      .groupBy(harnesses.id, harnesses.name)
      .orderBy(desc(count(submissions.id)), asc(harnesses.name))
      .limit(500),
    d
      .select({ id: mods.id, name: mods.name, count: count(submissions.id) })
      .from(submissions)
      .innerJoin(submissionMods, eq(submissionMods.submissionId, submissions.id))
      .innerJoin(mods, eq(mods.id, submissionMods.modId))
      .where(active)
      .groupBy(mods.id, mods.name)
      .orderBy(desc(count(submissions.id)), asc(mods.name))
      .limit(500),
  ]);

  return { models: m, providers: p, harnesses: h, mods: md };
}

export async function getSubmission(id: string) {
  const rows = await submissionQuery().where(eq(submissions.id, id));
  if (rows.length === 0) return null;
  const [row] = await attachMods(rows);
  const [extra] = await db()
    .select({
      files: submissions.files,
      notes: submissions.notes,
      content: submissions.content,
      hasRawLog: submissions.hasRawLog,
      status: submissions.status,
      moderationNote: submissions.moderationNote,
      authorId: submissions.authorId,
    })
    .from(submissions)
    .where(eq(submissions.id, id));
  return { ...row, ...extra };
}

export async function getUserRating(userId: number, submissionId: string) {
  const row = await db().query.ratings.findFirst({
    where: and(eq(ratings.userId, userId), eq(ratings.submissionId, submissionId)),
  });
  return row?.stars ?? null;
}

export async function setRating(userId: number, submissionId: string, stars: number) {
  await db()
    .insert(ratings)
    .values({ userId, submissionId, stars, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.submissionId],
      set: { stars, updatedAt: new Date() },
    });
}

export async function clearRating(userId: number, submissionId: string) {
  await db()
    .delete(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.submissionId, submissionId)));
}

export async function siteStats() {
  const d = db();
  const [[p], [s], [r]] = await Promise.all([
    d.select({ n: count() }).from(prompts).where(eq(prompts.status, "active")),
    d.select({ n: count() }).from(submissions).where(eq(submissions.status, "active")),
    d
      .select({ n: count() })
      .from(ratings)
      .innerJoin(submissions, eq(submissions.id, ratings.submissionId))
      .where(eq(submissions.status, "active")),
  ]);
  return { prompts: p.n, submissions: s.n, ratings: r.n };
}

/**
 * Everything the leaderboard needs: the active answers and every star cast on
 * them. The calibration in `~/lib/leaderboard` fits prompt and voter biases, so
 * it needs the individual votes rather than per-answer sums.
 */
export async function leaderboardData(kind?: PromptKind | null) {
  const active = kind
    ? and(eq(submissions.status, "active"), eq(prompts.status, "active"), eq(prompts.kind, kind))
    : and(eq(submissions.status, "active"), eq(prompts.status, "active"));

  const [answers, stars] = await Promise.all([
    db()
      .select({
        id: submissions.id,
        promptId: submissions.promptId,
        promptTitle: prompts.title,
        model: { id: models.id, name: models.name },
        provider: { id: providers.id, name: providers.name },
        harness: { id: harnesses.id, name: harnesses.name },
      })
      .from(submissions)
      .innerJoin(prompts, eq(prompts.id, submissions.promptId))
      .innerJoin(models, eq(models.id, submissions.modelId))
      .innerJoin(providers, eq(providers.id, submissions.providerId))
      .leftJoin(harnesses, eq(harnesses.id, submissions.harnessId))
      .where(active),
    db()
      .select({
        userId: ratings.userId,
        submissionId: ratings.submissionId,
        stars: ratings.stars,
      })
      .from(ratings)
      .innerJoin(submissions, eq(submissions.id, ratings.submissionId))
      .innerJoin(prompts, eq(prompts.id, submissions.promptId))
      .innerJoin(users, eq(users.id, ratings.userId))
      // A silenced or banned account's stars stop counting, so moderation also
      // settles the leaderboard.
      .where(and(active, eq(users.silenced, false), eq(users.banned, false))),
  ]);

  return {
    submissions: answers.map((row) => ({
      ...row,
      harness: row.harness?.id ? row.harness : null,
    })),
    ratings: stars,
  };
}

/** Prompt counts per work kind, for the leaderboard's kind filter. */
export async function answerCountsByKind() {
  const rows = await db()
    .select({ kind: prompts.kind, n: count(submissions.id) })
    .from(submissions)
    .innerJoin(prompts, eq(prompts.id, submissions.promptId))
    .where(and(eq(submissions.status, "active"), eq(prompts.status, "active")))
    .groupBy(prompts.kind);
  return rows;
}

export async function countActiveAnswers(promptId: string) {
  const [row] = await db()
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.promptId, promptId), eq(submissions.status, "active")));
  return row?.n ?? 0;
}
