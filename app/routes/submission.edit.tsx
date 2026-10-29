import { env } from "cloudflare:workers";
import { useState } from "react";
import {
  data,
  isRouteErrorResponse,
  redirect,
  useFetcher,
  useLocation,
  useParams,
} from "react-router";
import type { Route } from "./+types/submission.edit";
import { SectionHeading } from "~/components/section-heading";
import { FileDropZone } from "~/components/submission/file-drop-zone";
import { InlineWorkPreview } from "~/components/submission/inline-work-preview";
import { PickedBundleCard } from "~/components/submission/picked-bundle-card";
import { SessionLogSummary } from "~/components/submission/session-log-summary";
import { SubmissionMetaFields } from "~/components/submission/meta-fields";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Segmented } from "~/components/ui/segmented";
import { Textarea } from "~/components/ui/textarea";
import {
  buildBundle,
  BundleError,
  formatBytes,
  readTextBundle,
  type BundleEntry,
} from "~/lib/bundle";
import { flashToast, requireUser } from "~/lib/session.server";
import {
  countOtherRatings,
  getCatalog,
  getPrompt,
  getSubmission,
} from "~/lib/queries.server";
import { KIND_META } from "~/lib/kinds";
import { safeFrom } from "~/lib/navigation";
import { FIELDS, parseSubmissionMeta } from "~/lib/submission-input";
import {
  readBundleEntries,
  SubmissionLockedError,
  updateSubmission,
} from "~/lib/submissions.server";
import { bundleKey } from "~/lib/usercontent.server";
import { useDialogClose } from "~/lib/use-dialog-close";
import { useFileBundle } from "~/lib/use-file-bundle";

const PREFILL_LIMIT = 512 * 1024;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `编辑答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const otherRatings = await countOtherRatings(submission.id, user.id);
  if (otherRatings > 0) {
    throw data(`已有 ${otherRatings} 人打分，答案不能再修改。需要更换内容，请撤回后重新提交。`, {
      status: 403,
    });
  }

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  let initialText: string | null = null;
  if (prompt.kind !== "web") {
    const entry = KIND_META[prompt.kind].entry;
    const object = await env.FILES.get(bundleKey(submission.id, entry));
    if (object && object.size <= PREFILL_LIMIT) initialText = await object.text();
  }

  return {
    submission: {
      id: submission.id,
      promptId: submission.promptId,
      model: submission.model.name,
      provider: submission.provider.name,
      harness: submission.harness?.name ?? "",
      reasoning: submission.reasoning ?? "",
      mods: submission.mods.map((m) => m.name),
      notes: submission.notes ?? "",
      files: submission.files,
      logMeta: submission.logMeta,
      hasRawLog: submission.hasRawLog,
    },
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog: await getCatalog(),
    initialText,
    useFileMode: prompt.kind !== "web" && initialText === null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const otherRatings = await countOtherRatings(submission.id, user.id);
  if (otherRatings > 0) {
    return data({ error: `已有 ${otherRatings} 人打分，答案不能再修改` }, { status: 403 });
  }

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const form = await request.formData();
  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  try {
    let entries: BundleEntry[] | null = null;
    const replace = form.get("replace") === "1";
    if (replace) {
      entries = await readBundleEntries(form);
      if (entries.length === 0) return data({ error: "请选择要替换的文件" }, { status: 400 });
    } else if (prompt.kind !== "web") {
      const text = String(form.get("text") ?? "");
      if (!text.trim()) return data({ error: `请填写${KIND_META[prompt.kind].resultTitle}` }, { status: 400 });
      const bytes = new TextEncoder().encode(text);
      readTextBundle(prompt.kind, bytes);
      entries = buildBundle(
        [{ path: KIND_META[prompt.kind].entry, data: bytes }],
        prompt.kind,
      );
    }

    await updateSubmission({
      id: submission.id,
      authorId: user.id,
      kind: prompt.kind,
      currentFiles: submission.files,
      currentContent: submission.content,
      currentLogMeta: submission.logMeta,
      currentHasRawLog: submission.hasRawLog,
      entries,
      meta,
      removeRawLog: form.get("removeRawLog") === "1",
    });
  } catch (e) {
    if (e instanceof BundleError) return data({ error: e.message }, { status: 400 });
    if (e instanceof SubmissionLockedError) {
      return data({ error: "刚刚有人打分，答案已锁定" }, { status: 409 });
    }
    throw e;
  }

  const from = safeFrom(new URL(request.url).searchParams.get("from"));
  return redirect(from ?? `/s/${submission.id}`, {
    headers: { "Set-Cookie": await flashToast(request, "答案已更新") },
  });
}

export default function EditSubmission({ loaderData }: Route.ComponentProps) {
  const { submission: initial, prompt, catalog, initialText, useFileMode } = loaderData;
  const kind = prompt.kind;
  const meta = KIND_META[kind];
  const { search } = useLocation();
  const from = safeFrom(new URLSearchParams(search).get("from"));
  const { open, close } = useDialogClose(from ?? `/s/${initial.id}`);
  const fetcher = useFetcher<{ error: string }>();

  const [model, setModel] = useState(initial.model);
  const [provider, setProvider] = useState(initial.provider);
  const [harness, setHarness] = useState(initial.harness);
  const [reasoning, setReasoning] = useState(initial.reasoning);
  const [mods, setMods] = useState<string[]>(initial.mods);
  const [notes, setNotes] = useState(initial.notes);
  const [text, setText] = useState(initialText ?? "");
  const [webMode, setWebMode] = useState<"keep" | "replace">("keep");
  const [webSource, setWebSource] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [removeRawLog, setRemoveRawLog] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const bundle = useFileBundle(kind);

  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const needsFile = useFileMode || (kind === "web" && webMode === "replace" && webSource === "upload");
  const blockedReason = !model.trim()
    ? "模型"
    : !provider.trim()
      ? "提供方"
      : needsFile && !bundle.picked
        ? "替换文件"
        : kind !== "web" && !useFileMode && !text.trim()
          ? meta.resultTitle
          : kind === "web" && webMode === "replace" && webSource === "paste" && !pasteText.trim()
            ? "HTML 源码"
            : null;

  const dirty =
    model !== initial.model ||
    provider !== initial.provider ||
    harness !== initial.harness ||
    reasoning !== initial.reasoning ||
    notes !== initial.notes ||
    text !== (initialText ?? "") ||
    pasteText.length > 0 ||
    bundle.picked !== null ||
    webMode !== "keep" ||
    removeRawLog ||
    mods.join("\u0000") !== initial.mods.join("\u0000");

  const log = initial.logMeta;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const form = new FormData(e.currentTarget);

    try {
      if (useFileMode) {
        if (!bundle.picked) throw new BundleError("请选择替换文件");
        form.set("replace", "1");
        for (const entry of bundle.picked.entries) {
          form.append("file", new Blob([entry.data as BlobPart]), entry.path);
          form.append("path", entry.path);
        }
      } else if (kind === "web" && webMode === "replace") {
        form.set("replace", "1");
        if (webSource === "paste") {
          if (!pasteText.trim()) throw new BundleError("请粘贴 HTML 源码");
          const entries = buildBundle(
            [{ path: meta.entry, data: new TextEncoder().encode(pasteText) }],
            "web",
          );
          for (const entry of entries) {
            form.append("file", new Blob([entry.data as BlobPart]), entry.path);
            form.append("path", entry.path);
          }
        } else {
          if (!bundle.picked) throw new BundleError("请选择替换文件");
          for (const entry of bundle.picked.entries) {
            form.append("file", new Blob([entry.data as BlobPart]), entry.path);
            form.append("path", entry.path);
          }
        }
      }
    } catch (err) {
      setClientError(err instanceof BundleError ? err.message : String(err));
      return;
    }

    for (const mod of mods) form.append(FIELDS.mods, mod);
    fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && close()}>
      <DialogContent
        className="sm:max-w-[880px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (dirty || submitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DialogTitle>编辑答案</DialogTitle>
              <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">
                {meta.label}
              </span>
            </div>
            <DialogDescription className="mt-0.5 truncate">
              给「{prompt.title}」
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_316px] lg:gap-5">
              <div className="flex min-w-0 flex-col gap-6">
                <section>
                  <SectionHeading
                    title={meta.resultTitle}
                    hint={kind === "web" ? "不修改文件就保留原内容" : "保存时覆盖原文件"}
                  />

                  {kind === "web" && (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Segmented
                        label="作品文件"
                        value={webMode}
                        onChange={(value) => setWebMode(value)}
                        options={[
                          { value: "keep", label: "保留原文件" },
                          { value: "replace", label: "替换文件" },
                        ]}
                      />
                      <span className="num text-xs text-muted">
                        {initial.files.length} 个文件 · {formatBytes(initial.files.reduce((sum, f) => sum + f.size, 0))}
                      </span>
                    </div>
                  )}

                  {kind === "web" && webMode === "keep" && (
                    <ul className="mt-3 space-y-1 rounded-control border border-border bg-raised/40 px-3 py-2.5 font-mono text-xs text-muted">
                      {initial.files.slice(0, 6).map((file) => (
                        <li key={file.path} className="flex justify-between gap-4">
                          <span className="truncate">{file.path}</span>
                          <span className="num shrink-0">{formatBytes(file.size)}</span>
                        </li>
                      ))}
                      {initial.files.length > 6 && <li>…</li>}
                    </ul>
                  )}

                  {(useFileMode || (kind === "web" && webMode === "replace")) && (
                    <div className="mt-3">
                      {kind === "web" && (
                        <Segmented
                          label="文件来源"
                          value={webSource}
                          onChange={setWebSource}
                          options={[
                            { value: "upload", label: "上传文件" },
                            { value: "paste", label: "粘贴 HTML" },
                          ]}
                        />
                      )}

                      {kind === "web" && webSource === "paste" ? (
                        <Textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          rows={10}
                          className="mt-3 min-h-[196px] font-mono text-xs leading-relaxed"
                          placeholder="粘贴完整的 HTML 源码…"
                          spellCheck={false}
                        />
                      ) : bundle.picked ? (
                        <div className="mt-3 overflow-hidden rounded-control border border-border bg-raised/60">
                          <PickedBundleCard
                            picked={bundle.picked}
                            kind={kind}
                            onRemove={() => bundle.setPicked(null)}
                          />
                          <InlineWorkPreview
                            kind={kind}
                            entries={bundle.picked.entries}
                            name={bundle.picked.name}
                          />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <FileDropZone
                            accept={meta.accept}
                            label={
                              useFileMode
                                ? `选择新的 ${kind === "markdown" ? "Markdown" : kind === "svg" ? "SVG" : "HTML / zip"}`
                                : "选择 HTML / zip"
                            }
                            hint={
                              kind === "web"
                                ? "zip 需包含 index.html"
                                : `替换 ${meta.entry}`
                            }
                            error={bundle.error}
                            onPick={bundle.pickFile}
                            className="min-h-[132px]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {kind !== "web" && !useFileMode && (
                    <div className="mt-3">
                      <Textarea
                        name="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={12}
                        className="min-h-[260px] font-mono text-xs leading-relaxed"
                        spellCheck={false}
                      />
                      <div className="mt-1.5 flex justify-between text-xs text-muted">
                        <span>保存为 {meta.entry}</span>
                        <span className="num">{formatBytes(new Blob([text]).size)}</span>
                      </div>
                    </div>
                  )}
                </section>

                <section className="border-t border-border pt-6">
                  <SectionHeading title="Session log" hint="只读" />
                  {log ? (
                    <div className="mt-2.5 rounded-control border border-border bg-raised/50 px-3 py-2.5">
                      <SessionLogSummary meta={log} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted">没有日志信息。</p>
                  )}
                  {initial.hasRawLog && (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="removeRawLog"
                        value="1"
                        checked={removeRawLog}
                        onChange={(e) => setRemoveRawLog(e.target.checked)}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        移除公开的原始日志
                        <span className="block text-muted">移除后不可恢复，解析出的统计会保留。</span>
                      </span>
                    </label>
                  )}
                </section>
              </div>

              <aside className="border-t border-border pt-6 lg:rounded-card lg:border lg:border-border lg:bg-ground/60 lg:px-4 lg:pt-3 lg:pb-4">
                <SectionHeading title="生成信息" />
                <SubmissionMetaFields
                  catalog={catalog}
                  model={model}
                  setModel={setModel}
                  provider={provider}
                  setProvider={setProvider}
                  harness={harness}
                  setHarness={setHarness}
                  reasoning={reasoning}
                  setReasoning={setReasoning}
                  mods={mods}
                  setMods={setMods}
                  notes={notes}
                  setNotes={setNotes}
                />
              </aside>
            </div>
          </DialogBody>

          <DialogFooter className="max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5">
            {clientError || serverError ? (
              <p className="min-w-0 flex-1 text-xs text-negative" role="alert">
                {clientError || serverError}
              </p>
            ) : blockedReason ? (
              <p className="min-w-0 flex-1 text-xs text-muted">还需要：{blockedReason}</p>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>
                取消
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || Boolean(blockedReason)}
              >
                {submitting ? "保存中…" : "保存修改"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { submissionId = "" } = useParams();
  const { search } = useLocation();
  const from = safeFrom(new URLSearchParams(search).get("from"));
  const { open, close } = useDialogClose(from ?? `/s/${submissionId}`);
  let title = "无法编辑答案";
  let message = "加载失败，请稍后再试。";
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) title = "答案已锁定";
    if (typeof error.data === "string") message = error.data;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{message}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4 text-sm text-muted">{message}</DialogBody>
        <DialogFooter className="justify-end">
          <Button type="button" variant="primary" onClick={close}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
