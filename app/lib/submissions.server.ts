import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { db } from "~/db/client.server";
import { submissionMods, submissions } from "~/db/schema";
import {
  assertUploadSizes,
  buildBundle,
  BUNDLE_LIMITS,
  BundleError,
  contentTypeFor,
  describeBundle,
  readTextBundle,
  type BundleEntry,
} from "./bundle";
import { newId } from "./ids";
import type { PromptKind } from "./kinds";
import { ensureCatalogEntry } from "./queries.server";
import { thumbnailKey } from "./screenshot.server";
import type { SubmissionMeta } from "./submission-input";
import { bundleKey } from "./usercontent.server";

/** The whole multipart body: bundle allowance plus thumbnail and form fields. */
export const MAX_SUBMIT_BODY_BYTES = BUNDLE_LIMITS.totalBytes + 2 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 1024 * 1024;

/** Reads the parallel file/path fields the submit page sends. */
export async function readBundleEntries(form: FormData): Promise<BundleEntry[]> {
  const files = form.getAll("file");
  const paths = form.getAll("path");
  if (files.length !== paths.length) throw new BundleError("文件与路径数量不一致");
  if (files.length > BUNDLE_LIMITS.maxFiles) {
    throw new BundleError(`文件数超过 ${BUNDLE_LIMITS.maxFiles} 个`);
  }

  // Reject on declared sizes before copying each file into a second buffer.
  // The multipart body is already parsed by this point, so this bounds the
  // extra memory a bundle can pin rather than the initial request body.
  for (const file of files) {
    if (!(file instanceof File)) throw new BundleError("文件格式错误");
  }
  assertUploadSizes(files.map((file) => (file as File).size));

  return Promise.all(
    files.map(async (file, i) => ({
      path: String(paths[i]),
      data: new Uint8Array(await (file as File).arrayBuffer()),
    })),
  );
}

export async function createSubmission(input: {
  promptId: string;
  authorId: number;
  kind: PromptKind;
  entries: BundleEntry[];
  meta: SubmissionMeta;
  thumbnail?: Uint8Array | null;
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

  if (input.thumbnail && input.thumbnail.byteLength > MAX_THUMBNAIL_BYTES) {
    throw new BundleError("缩略图过大");
  }

  const writes: Promise<unknown>[] = files.map((f) =>
    env.FILES.put(bundleKey(id, f.path), f.data, {
      httpMetadata: { contentType: contentTypeFor(f.path) },
    }),
  );

  const thumbnailWritten = Boolean(input.thumbnail && input.thumbnail.byteLength > 0);
  if (thumbnailWritten) {
    writes.push(
      env.FILES.put(thumbnailKey(id), input.thumbnail!, {
        httpMetadata: { contentType: "image/webp" },
      }).catch((err) => console.warn("Failed to save client thumbnail to R2:", err)),
    );
  }

  const cleanupFiles = () =>
    Promise.allSettled([
      ...files.map((f) => env.FILES.delete(bundleKey(id, f.path))),
      ...(thumbnailWritten ? [env.FILES.delete(thumbnailKey(id))] : []),
    ]);

  // Wait for every write to settle before cleaning up: deleting keys while a
  // sibling PUT is still in flight would leave the object behind as an orphan.
  const results = await Promise.allSettled(writes);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    await cleanupFiles();
    throw failure.reason;
  }

  const manifest = describeBundle(files);
  const uniqueMods = [...new Set(modIds)];
  try {
    const insert = db().insert(submissions).values({
      id,
      promptId: input.promptId,
      kind: input.kind,
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
    });
    if (uniqueMods.length > 0) {
      // D1 batches run in one transaction, so a failure cannot leave an answer
      // row without its mods.
      await db().batch([
        insert,
        db()
          .insert(submissionMods)
          .values(uniqueMods.map((modId) => ({ submissionId: id, modId }))),
      ]);
    } else {
      await insert;
    }
  } catch (error) {
    // If the rollback itself fails we keep the uploaded files: an orphan object
    // is recoverable, whereas a row pointing at deleted files is not.
    try {
      await db().delete(submissions).where(eq(submissions.id, id));
    } catch (rollbackError) {
      console.error("Failed to roll back submission", id, rollbackError);
      throw error;
    }
    await cleanupFiles();
    throw error;
  }
  return id;
}

/** Updates an answer's generation metadata, notes, and parsed session-log stats. */
export async function updateSubmission(input: {
  id: string;
  authorId: number;
  meta: SubmissionMeta;
}) {
  const { meta } = input;
  const [modelId, providerId, harnessId, modIds] = await Promise.all([
    ensureCatalogEntry("models", meta.model),
    ensureCatalogEntry("providers", meta.provider),
    meta.harness ? ensureCatalogEntry("harnesses", meta.harness) : null,
    Promise.all(meta.mods.map((m) => ensureCatalogEntry("mods", m))),
  ]);

  const result = await db()
    .update(submissions)
    .set({
      modelId,
      providerId,
      harnessId,
      reasoning: meta.reasoning,
      notes: meta.notes,
      logMeta: meta.logMeta,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(submissions.id, input.id),
        eq(submissions.authorId, input.authorId),
        eq(submissions.status, "active"),
      ),
    );
  if (result.meta.changes === 0) return false;

  const uniqueMods = [...new Set(modIds)];
  const removeMods = db()
    .delete(submissionMods)
    .where(eq(submissionMods.submissionId, input.id));
  if (uniqueMods.length > 0) {
    // Replace the tag set atomically so a failed insert cannot drop the old one.
    await db().batch([
      removeMods,
      db()
        .insert(submissionMods)
        .values(uniqueMods.map((modId) => ({ submissionId: input.id, modId }))),
    ]);
  } else {
    await removeMods;
  }
  return true;
}

/** Authors may only toggle their own answer between public and withdrawn. */
export async function setSubmissionStatus(
  id: string,
  authorId: number,
  status: "active" | "hidden",
) {
  const [row] = await db()
    .select({ authorId: submissions.authorId, status: submissions.status })
    .from(submissions)
    .where(eq(submissions.id, id));
  if (!row) return "not_found" as const;
  if (row.authorId !== authorId) return "forbidden" as const;
  const from = status === "hidden" ? "active" : "hidden";
  if (row.status !== from) return "conflict" as const;
  const result = await db()
    .update(submissions)
    .set({ status })
    .where(
      and(
        eq(submissions.id, id),
        eq(submissions.authorId, authorId),
        eq(submissions.status, from),
      ),
    );
  return result.meta.changes > 0 ? ("ok" as const) : ("conflict" as const);
}
