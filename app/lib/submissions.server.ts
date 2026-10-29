import { env } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { ratings, submissionMods, submissions } from "~/db/schema";
import {
  buildBundle,
  BUNDLE_LIMITS,
  contentTypeFor,
  describeBundle,
  readTextBundle,
  type BundleEntry,
  type BundleFile,
} from "./bundle";
import { newId } from "./ids";
import type { PromptKind } from "./kinds";
import { ensureCatalogEntry } from "./queries.server";
import type { LogMeta } from "./session-log";
import type { SubmissionMeta } from "./submission-input";
import { bundleKey } from "./usercontent.server";

export const rawLogKey = (submissionId: string) => `logs/${submissionId}.jsonl`;

/** Reads the parallel file/path fields the submit page sends. */
export async function readBundleEntries(form: FormData): Promise<BundleEntry[]> {
  const files = form.getAll("file");
  const paths = form.getAll("path");
  if (files.length !== paths.length) throw new Error("文件与路径数量不一致");
  if (files.length > BUNDLE_LIMITS.maxFiles) throw new Error(`文件数超过 ${BUNDLE_LIMITS.maxFiles} 个`);
  return Promise.all(
    files.map(async (file, i) => {
      if (!(file instanceof File)) throw new Error("文件格式错误");
      return { path: String(paths[i]), data: new Uint8Array(await file.arrayBuffer()) };
    }),
  );
}

export async function createSubmission(input: {
  promptId: string;
  authorId: number;
  kind: PromptKind;
  entries: BundleEntry[];
  meta: SubmissionMeta;
  rawLog: File | null;
}) {
  const files = buildBundle(input.entries, input.kind);
  const text = input.kind === "web" ? null : readTextBundle(input.kind, files[0].data);
  const content = input.kind === "markdown" ? text : null;
  const id = newId(14);
  const { meta } = input;

  const [modelId, providerId, harnessId, modIds] = await Promise.all([
    ensureCatalogEntry("models", meta.model),
    ensureCatalogEntry("providers", meta.provider),
    meta.harness ? ensureCatalogEntry("harnesses", meta.harness) : null,
    Promise.all(meta.mods.map((m) => ensureCatalogEntry("mods", m))),
  ]);

  await Promise.all(
    files.map((f) =>
      env.FILES.put(bundleKey(id, f.path), f.data, {
        httpMetadata: { contentType: contentTypeFor(f.path) },
      }),
    ),
  );
  if (input.rawLog) {
    await env.FILES.put(rawLogKey(id), input.rawLog.stream(), {
      httpMetadata: { contentType: "application/x-ndjson" },
    });
  }

  const manifest = describeBundle(files);
  await db().insert(submissions).values({
    id,
    promptId: input.promptId,
    authorId: input.authorId,
    modelId,
    providerId,
    harnessId,
    reasoning: meta.reasoning,
    files: manifest,
    totalBytes: manifest.reduce((s, f) => s + f.size, 0),
    notes: meta.notes,
    content,
    logMeta: meta.logMeta,
    hasRawLog: Boolean(input.rawLog),
  });
  const uniqueMods = [...new Set(modIds)];
  if (uniqueMods.length > 0) {
    await db()
      .insert(submissionMods)
      .values(uniqueMods.map((modId) => ({ submissionId: id, modId })));
  }
  return id;
}

export class SubmissionLockedError extends Error {}

/** Updates an answer in place, replacing its bundle only when new entries are given. */
export async function updateSubmission(input: {
  id: string;
  authorId: number;
  kind: PromptKind;
  currentFiles: BundleFile[];
  currentContent: string | null;
  currentLogMeta: LogMeta | null;
  currentHasRawLog: boolean;
  entries: BundleEntry[] | null;
  meta: SubmissionMeta;
  removeRawLog: boolean;
}) {
  const { meta } = input;
  const [modelId, providerId, harnessId, modIds] = await Promise.all([
    ensureCatalogEntry("models", meta.model),
    ensureCatalogEntry("providers", meta.provider),
    meta.harness ? ensureCatalogEntry("harnesses", meta.harness) : null,
    Promise.all(meta.mods.map((m) => ensureCatalogEntry("mods", m))),
  ]);

  let files: BundleFile[] = input.currentFiles;
  let content = input.currentContent;
  let entries: BundleEntry[] | null = null;
  if (input.entries) {
    entries = buildBundle(input.entries, input.kind);
    files = describeBundle(entries);
    content = input.kind === "markdown" ? readTextBundle(input.kind, entries[0].data) : null;
    await Promise.all(
      entries.map((f) =>
        env.FILES.put(bundleKey(input.id, f.path), f.data, {
          httpMetadata: { contentType: contentTypeFor(f.path) },
        }),
      ),
    );
  }

  const result = await db()
    .update(submissions)
    .set({
      modelId,
      providerId,
      harnessId,
      reasoning: meta.reasoning,
      files,
      totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      notes: meta.notes,
      content,
      logMeta: input.currentLogMeta,
      hasRawLog: input.removeRawLog ? false : input.currentHasRawLog,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(submissions.id, input.id),
        eq(submissions.authorId, input.authorId),
        eq(submissions.status, "active"),
        sql`not exists (select 1 from ratings where ratings.submission_id = submissions.id and ratings.user_id <> ${input.authorId})`,
      ),
    );
  if (result.meta.changes === 0) throw new SubmissionLockedError();

  if (entries) {
    const keep = new Set(files.map((f) => f.path));
    const stale = input.currentFiles.filter((f) => !keep.has(f.path));
    await Promise.all(stale.map((f) => env.FILES.delete(bundleKey(input.id, f.path))));
  }
  if (input.removeRawLog && input.currentHasRawLog) {
    await env.FILES.delete(rawLogKey(input.id));
  }

  await db().delete(submissionMods).where(eq(submissionMods.submissionId, input.id));
  const uniqueMods = [...new Set(modIds)];
  if (uniqueMods.length > 0) {
    await db()
      .insert(submissionMods)
      .values(uniqueMods.map((modId) => ({ submissionId: input.id, modId })));
  }
}

export async function setSubmissionStatus(
  id: string,
  authorId: number,
  status: "active" | "hidden",
) {
  const [row] = await db()
    .select({ authorId: submissions.authorId })
    .from(submissions)
    .where(eq(submissions.id, id));
  if (!row) return "not_found" as const;
  if (row.authorId !== authorId) return "forbidden" as const;
  await db()
    .update(submissions)
    .set({ status })
    .where(and(eq(submissions.id, id), eq(submissions.authorId, authorId)));
  return "ok" as const;
}
