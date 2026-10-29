import { env } from "cloudflare:workers";
import { db } from "~/db/client.server";
import { submissionMods, submissions } from "~/db/schema";
import {
  buildBundle,
  BUNDLE_LIMITS,
  contentTypeFor,
  describeBundle,
  readTextBundle,
  type BundleEntry,
} from "./bundle";
import { newId } from "./ids";
import type { PromptKind } from "./kinds";
import { ensureCatalogEntry } from "./queries.server";
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
