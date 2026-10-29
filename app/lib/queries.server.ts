import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
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

/** Gallery order shrinks stars toward a neutral 3 so one vote does not top the list. */
const PRIOR_VOTES = 3;
const SORT_PRIOR = 3;
const priorStars = sql.raw(String(SORT_PRIOR * PRIOR_VOTES));
const priorVotes = sql.raw(String(PRIOR_VOTES));

const CATALOG_TABLES = { models, providers, harnesses, mods };

export async function getCatalog(): Promise<Catalog> {
  const d = db();
  const [m, p, h, md] = await Promise.all(
    (Object.keys(CATALOG_TABLES) as CatalogKind[]).map((kind) =>
      d.select({ id: CATALOG_TABLES[kind].id, name: CATALOG_TABLES[kind].name })
        .from(CATALOG_TABLES[kind])
        .orderBy(CATALOG_TABLES[kind].name),
    ),
  );
  return { models: m, providers: p, harnesses: h, mods: md };
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

export async function listPrompts(limit = 60) {
  return db()
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      createdAt: prompts.createdAt,
      author,
      submissions: sql<number>`(select count(*) from ${submissions} s where s.prompt_id = ${prompts.id} and s.status = 'active')`,
      coverSubmissionId: sql<string | null>`(
        select s.id from ${submissions} s
        left join ${ratings} r on r.submission_id = s.id
        where s.prompt_id = ${prompts.id} and s.status = 'active'
        group by s.id
        order by (coalesce(sum(r.stars), 0) + ${priorStars}) * 1.0 / (count(r.stars) + ${priorVotes}) desc, s.created_at desc
        limit 1)`,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(eq(prompts.status, "active"))
    .orderBy(desc(prompts.createdAt))
    .limit(limit);
}

export async function getPrompt(id: string) {
  const [row] = await db()
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      status: prompts.status,
      createdAt: prompts.createdAt,
      author,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(eq(prompts.id, id));
  return row ?? null;
}

export interface SubmissionFilters {
  model?: string;
  provider?: string;
  harness?: string;
  mod?: string;
  vanilla?: boolean;
}

export type SubmissionSort = "top" | "new";

const submissionColumns = {
  id: submissions.id,
  promptId: submissions.promptId,
  reasoning: submissions.reasoning,
  createdAt: submissions.createdAt,
  totalBytes: submissions.totalBytes,
  logMeta: submissions.logMeta,
  model: { id: models.id, name: models.name },
  provider: { id: providers.id, name: providers.name },
  harness: { id: harnesses.id, name: harnesses.name },
  author,
  votes: sql<number>`(select count(*) from ${ratings} r where r.submission_id = ${submissions.id})`,
  starSum: sql<number>`coalesce((select sum(r.stars) from ${ratings} r where r.submission_id = ${submissions.id}), 0)`,
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

export async function listSubmissions(
  promptId: string,
  filters: SubmissionFilters,
  sort: SubmissionSort,
) {
  const conditions = [eq(submissions.promptId, promptId), eq(submissions.status, "active")];
  if (filters.model) conditions.push(eq(submissions.modelId, filters.model));
  if (filters.provider) conditions.push(eq(submissions.providerId, filters.provider));
  if (filters.harness) conditions.push(eq(submissions.harnessId, filters.harness));
  if (filters.mod) {
    conditions.push(
      sql`exists (select 1 from ${submissionMods} sm where sm.submission_id = ${submissions.id} and sm.mod_id = ${filters.mod})`,
    );
  }
  if (filters.vanilla) {
    conditions.push(
      sql`not exists (select 1 from ${submissionMods} sm where sm.submission_id = ${submissions.id})`,
    );
  }
  const order =
    sort === "top"
      ? [desc(sql`(${submissionColumns.starSum} + ${priorStars}) * 1.0 / (${submissionColumns.votes} + ${priorVotes})`), desc(submissions.createdAt)]
      : [desc(submissions.createdAt)];
  const rows = await submissionQuery().where(and(...conditions)).orderBy(...order).limit(200);
  return attachMods(rows);
}

export async function getSubmission(id: string) {
  const rows = await submissionQuery().where(eq(submissions.id, id));
  if (rows.length === 0) return null;
  const [row] = await attachMods(rows);
  const [extra] = await db()
    .select({
      files: submissions.files,
      notes: submissions.notes,
      hasRawLog: submissions.hasRawLog,
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
    d.select({ n: count() }).from(ratings),
  ]);
  return { prompts: p.n, submissions: s.n, ratings: r.n };
}
