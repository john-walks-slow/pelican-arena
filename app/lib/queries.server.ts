import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
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
  submissions,
  users,
} from "~/db/schema";
import type { Catalog, CatalogEntry, CatalogKind } from "./catalog";
import { slugify } from "./ids";
import type { PromptKind } from "./kinds";
import { matchModel } from "./model-match";

/** Gallery order shrinks stars toward a neutral 3 so one vote does not top the list. */
const PRIOR_VOTES = 3;
const SORT_PRIOR = 3;
const priorStars = sql.raw(String(SORT_PRIOR * PRIOR_VOTES));
const priorVotes = sql.raw(String(PRIOR_VOTES));

const CATALOG_TABLES = { models, providers, harnesses, mods };

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

  const table = kind === "models" ? models : kind === "providers" ? providers : harnesses;
  const usedBy =
    kind === "models"
      ? submissions.modelId
      : kind === "providers"
        ? submissions.providerId
        : submissions.harnessId;
  const [rows, [total]] = await Promise.all([
    d
      .select({ id: table.id, name: table.name, uses: count(submissions.id) })
      .from(table)
      .leftJoin(
        submissions,
        and(eq(usedBy, table.id), eq(submissions.status, "active")),
      )
      .where(query ? nameLike(table.name, query) : undefined)
      .groupBy(table.id, table.name)
      .orderBy(desc(count(submissions.id)), asc(table.name))
      .limit(limit),
    d
      .select({ n: count() })
      .from(table)
      .where(query ? nameLike(table.name, query) : undefined),
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
  const [m, p, h, md] = await Promise.all(
    (Object.keys(CATALOG_TABLES) as CatalogKind[]).map((kind) => searchCatalog(kind, "", 20)),
  );
  return {
    models: m.items.map(({ id, name }) => ({ id, name })),
    providers: p.items.map(({ id, name }) => ({ id, name })),
    harnesses: h.items.map(({ id, name }) => ({ id, name })),
    mods: md.items.map(({ id, name }) => ({ id, name })),
  };
}

/** Resolves a user-typed catalog name to an id, creating the entry when new. */
export async function ensureCatalogEntry(kind: CatalogKind, name: string) {
  const clean = name.trim().slice(0, 60);
  const id = slugify(clean);
  if (!id) throw new Error(`invalid ${kind} name`);
  await db().insert(CATALOG_TABLES[kind]).values({ id, name: clean }).onConflictDoNothing();
  return id;
}

export async function countSince(
  table: "prompts" | "submissions",
  authorId: number,
  since: Date,
) {
  const t = table === "prompts" ? prompts : submissions;
  const [row] = await db()
    .select({ n: count() })
    .from(t)
    .where(and(eq(t.authorId, authorId), gte(t.createdAt, since)));
  return row.n;
}

const author = {
  id: users.id,
  username: users.username,
  avatarTemplate: users.avatarTemplate,
};

export const PROMPT_SORTS = ["latest", "new", "answers", "hardest"] as const;
export type PromptSort = (typeof PROMPT_SORTS)[number];
export const DEFAULT_PROMPT_SORT: PromptSort = "latest";
export const isPromptSort = (value: unknown): value is PromptSort =>
  typeof value === "string" && (PROMPT_SORTS as readonly string[]).includes(value);

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
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
        excerpt: sql<string | null>`substr(${submissions.content}, 1, 900)`,
        model: { id: models.id, name: models.name },
        provider: { id: providers.id, name: providers.name },
        starSum: sql<number>`coalesce((select sum(r.stars) from ${ratings} r where r.submission_id = submissions.id), 0)`,
        votes: sql<number>`(select count(*) from ${ratings} r where r.submission_id = submissions.id)`,
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
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      answers: sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id and s.status = 'active')`,
      submissions: sql<number>`(select count(*) from ${submissions} s where s.prompt_id = prompts.id)`,
    })
    .from(prompts)
    .where(eq(prompts.id, id));
  return row ?? null;
}

export async function updatePrompt(input: {
  id: string;
  authorId: number;
  title: string;
  body: string;
  kind: PromptKind;
  locked: boolean;
}) {
  const set = input.locked
    ? { title: input.title, updatedAt: new Date() }
    : { title: input.title, body: input.body, kind: input.kind, updatedAt: new Date() };
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
      status: submissions.status,
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

export async function countActiveAnswers(promptId: string) {
  const [row] = await db()
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.promptId, promptId), eq(submissions.status, "active")));
  return row?.n ?? 0;
}
