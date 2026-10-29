import { useMemo, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  redirect,
  useFetcher,
  useLocation,
  useParams,
} from "react-router";
import { FileText, X } from "lucide-react";
import type { Route } from "./+types/submit";
import { Markdown } from "~/components/markdown";
import { SectionHeading } from "~/components/section-heading";
import { SessionLogSummary } from "~/components/submission/session-log-summary";
import { FileDropZone } from "~/components/submission/file-drop-zone";
import { InlineWorkPreview } from "~/components/submission/inline-work-preview";
import { PickedBundleCard } from "~/components/submission/picked-bundle-card";
import { SubmissionMetaFields } from "~/components/submission/meta-fields";
import { SessionLogHelp } from "~/components/session-log-help";
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
  BUNDLE_LIMITS,
  formatBytes,
  readTextBundle,
  singleFileLimit,
  unzipBundle,
  type BundleEntry,
} from "~/lib/bundle";
import type { CatalogEntry } from "~/lib/catalog";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { KIND_META, type PromptKind } from "~/lib/kinds";
import { matchModel } from "~/lib/model-match";
import { safeFrom, withFrom } from "~/lib/navigation";
import { getCatalog, getPrompt } from "~/lib/queries.server";
import { SANDBOX } from "~/lib/sandbox";
import { flashToast } from "~/lib/session.server";
import { LOG_SOURCE_LABELS, LogParseError, type LogMeta } from "~/lib/session-log";
import { readSessionLogFile } from "~/lib/session-log-file";
import { FIELDS, parseSubmissionMeta, RAW_LOG_LIMIT } from "~/lib/submission-input";
import { createSubmission, readBundleEntries } from "~/lib/submissions.server";
import { useDialogClose } from "~/lib/use-dialog-close";
import { useFileBundle } from "~/lib/use-file-bundle";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `提交答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  return {
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog: await getCatalog(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const limitError = await dailyLimitError(user, "submit");
  if (limitError) return data({ error: limitError }, { status: 429 });

  const form = await request.formData();
  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  const rawLog = form.get(FIELDS.rawLog);
  const rawLogFile = rawLog instanceof File && rawLog.size > 0 ? rawLog : null;
  if (rawLogFile && rawLogFile.size > RAW_LOG_LIMIT) {
    return data({ error: `日志超过 ${formatBytes(RAW_LOG_LIMIT)}` }, { status: 400 });
  }

  try {
    const entries = await readBundleEntries(form);
    const id = await createSubmission({
      promptId: prompt.id,
      authorId: user.id,
      kind: prompt.kind,
      entries,
      meta,
      rawLog: rawLogFile,
    });
    const from = safeFrom(new URL(request.url).searchParams.get("from"));
    return redirect(withFrom(`/s/${id}`, from), {
      headers: { "Set-Cookie": await flashToast(request, "已提交，感谢你的参与") },
    });
  } catch (e) {
    if (e instanceof BundleError) return data({ error: e.message }, { status: 400 });
    throw e;
  }
}

function WorkSection({
  mode,
  setMode,
  bundle,
  kind,
  text,
  setText,
}: {
  mode: "upload" | "paste";
  setMode: (mode: "upload" | "paste") => void;
  bundle: ReturnType<typeof useFileBundle>;
  kind: PromptKind;
  text: string;
  setText: (v: string) => void;
}) {
  const [previewPaste, setPreviewPaste] = useState(false);
  const { picked, setPicked, error, pickFile } = bundle;
  const meta = KIND_META[kind];

  const pasteLabel =
    kind === "markdown" ? "Markdown" : kind === "svg" ? "SVG 源码" : "HTML 源码";
  const uploadLabel = kind === "web" ? "HTML / zip" : `.${meta.extension}`;

  const validatedSvgSrc = useMemo(() => {
    if (kind !== "svg" || !previewPaste || !text.trim()) return null;
    try {
      readTextBundle("svg", new TextEncoder().encode(text));
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    } catch {
      return null;
    }
  }, [kind, previewPaste, text]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <SectionHeading
        title="结果"
        badge={
          <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {meta.label}
          </span>
        }
        aside={
          <Segmented
            label="作品录入方式"
            value={mode}
            onChange={(id) => {
              setMode(id);
              setPreviewPaste(false);
            }}
            options={[
              { value: "upload", label: "上传文件" },
              { value: "paste", label: `粘贴${kind === "markdown" ? "文本" : "源码"}` },
            ]}
          />
        }
      />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {mode === "upload" ? (
          picked ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-border bg-raised/60">
              <PickedBundleCard picked={picked} kind={kind} onRemove={() => setPicked(null)} />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <InlineWorkPreview kind={kind} entries={picked.entries} name={picked.name} />
              </div>
            </div>
          ) : (
            <FileDropZone
              accept={meta.accept}
              label={`拖入或选择 ${uploadLabel}`}
              hint={
                kind === "web"
                  ? `zip 需包含 index.html，解压后不超过 ${formatBytes(BUNDLE_LIMITS.totalBytes)}`
                  : `单个文件，不超过 ${formatBytes(singleFileLimit(kind))}`
              }
              error={error}
              onPick={pickFile}
            />
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {previewPaste ? (
              <div className="flex min-h-[196px] flex-1 flex-col overflow-hidden rounded-control border border-border bg-white">
                {kind === "web" ? (
                  <iframe
                    srcDoc={text}
                    title="HTML 预览"
                    sandbox={SANDBOX}
                    allow="fullscreen; autoplay"
                    referrerPolicy="no-referrer"
                    className="min-h-[196px] flex-1 border-0"
                  />
                ) : kind === "markdown" ? (
                  <div className="flex-1 overflow-y-auto scroll-thin bg-ground/50 p-3.5">
                    <Markdown>{text}</Markdown>
                  </div>
                ) : validatedSvgSrc ? (
                  <div className="flex flex-1 items-center justify-center bg-ground/50 p-2">
                    <img
                      src={validatedSvgSrc}
                      alt="SVG 预览"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <p className="p-3.5 text-xs text-negative">不是有效的 SVG 源码。</p>
                )}
              </div>
            ) : (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                className="min-h-[196px] flex-1 font-mono text-xs leading-relaxed"
                placeholder={`在此粘贴 ${pasteLabel}…`}
                spellCheck={false}
                autoFocus
              />
            )}
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
              {text.trim() ? (
                <button
                  type="button"
                  className="font-medium text-ink hover:text-accent"
                  onClick={() => setPreviewPaste((v) => !v)}
                >
                  {previewPaste ? "返回编辑源码" : "预览效果"}
                </button>
              ) : (
                <span>保存为 {meta.entry}</span>
              )}
              <span className="num">{formatBytes(new Blob([text]).size)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

async function resolveModelName(raw: string): Promise<CatalogEntry | null> {
  try {
    const res = await fetch(`/api/catalog?kind=models&resolve=${encodeURIComponent(raw)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { match: CatalogEntry | null };
    return data.match;
  } catch {
    return null;
  }
}

export default function Submit({ loaderData }: Route.ComponentProps) {
  const { prompt, catalog } = loaderData;
  const kind = prompt.kind;
  const meta = KIND_META[kind];
  const { search } = useLocation();
  const { open, close } = useDialogClose(`/p/${prompt.id}${search}`);
  const fetcher = useFetcher<{ error: string }>();

  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const bundle = useFileBundle(kind);
  const [text, setText] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [harness, setHarness] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [mods, setMods] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [log, setLog] = useState<{ file: File; meta: LogMeta } | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  const dirty = Boolean(
    bundle.picked || text.trim() || model || provider || harness || mods.length > 0 || notes.trim() || log,
  );

  const hasWork = mode === "upload" ? Boolean(bundle.picked) : text.trim().length > 0;
  const ready = hasWork && model.trim().length > 0 && provider.trim().length > 0;

  const logModelHint = useMemo(() => log?.meta.models[0] ?? null, [log]);

  async function pickLog(file: File) {
    setLogError(null);
    try {
      const parsed = await readSessionLogFile(file);
      const logMeta = parsed.meta;
      const upload = new File([parsed.text], parsed.name, { type: "application/x-ndjson" });
      setLog({ file: upload, meta: logMeta });
      const raw = logMeta.models[0];
      if (raw && !model) {
        const match = matchModel(raw, catalog.models) ?? (await resolveModelName(raw));
        setModel(match?.name ?? raw);
      }
      const sourceHarness = LOG_SOURCE_LABELS[logMeta.source];
      if (!harness && catalog.harnesses.some((h) => h.name === sourceHarness)) setHarness(sourceHarness);
    } catch (e) {
      setLog(null);
      setLogError(e instanceof LogParseError ? e.message : "无法读取日志文件");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const form = new FormData(e.currentTarget);

    let entries: BundleEntry[];
    try {
      if (mode === "upload" && bundle.picked) {
        entries = bundle.picked.entries;
      } else if (mode === "paste" && text.trim()) {
        const bytes = new TextEncoder().encode(text);
        if (kind !== "web") readTextBundle(kind, bytes);
        entries = buildBundle([{ path: meta.entry, data: bytes }], kind);
      } else {
        throw new BundleError(`请上传或粘贴${meta.resultTitle}`);
      }
    } catch (err) {
      setClientError(err instanceof BundleError ? err.message : String(err));
      return;
    }

    for (const entry of entries) {
      form.append("file", new Blob([entry.data as BlobPart]), entry.path);
      form.append("path", entry.path);
    }
    for (const m of mods) form.append(FIELDS.mods, m);
    if (log) {
      form.set(FIELDS.logMeta, JSON.stringify(log.meta));
      if (publishLog) form.set(FIELDS.rawLog, log.file);
    }
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
            <DialogTitle>提交答案</DialogTitle>
            <DialogDescription className="mt-0.5 truncate">
              给「{prompt.title}」
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-6 p-5">
                <WorkSection
                  mode={mode}
                  setMode={setMode}
                  bundle={bundle}
                  kind={kind}
                  text={text}
                  setText={setText}
                />

                <section className="border-t border-border pt-6">
                  <SectionHeading
                    title="Session log"
                    hint="可选"
                    aside={
                      !log && (
                        <Button asChild variant="outline" size="sm">
                          <label className="cursor-pointer gap-1.5">
                            <FileText className="size-3.5 text-muted" strokeWidth={1.75} />
                            选择日志文件
                            <input
                              type="file"
                              accept=".jsonl,.json,.log,.txt,.zstd,.zst"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) pickLog(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </Button>
                      )
                    }
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    从日志里读取 token 和用时，自动填写模型与客户端。原始文件不会上传。
                  </p>

                  {logError && <p className="mt-1.5 text-xs text-negative">{logError}</p>}

                  {log && (
                    <div className="mt-2.5 rounded-control border border-border bg-raised/60 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FileText className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">{log.file.name}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="移除日志"
                          onClick={() => {
                            setLog(null);
                            setPublishLog(false);
                          }}
                        >
                          <X className="size-4" strokeWidth={1.75} />
                        </Button>
                      </div>
                      <div className="mt-2.5 border-t border-border pt-2.5">
                        <SessionLogSummary meta={log.meta} />
                      </div>
                      <label className="mt-2.5 flex cursor-pointer items-start gap-2 border-t border-border pt-2.5 text-xs">
                        <input
                          type="checkbox"
                          checked={publishLog}
                          onChange={(e) => setPublishLog(e.target.checked)}
                          className="mt-0.5 accent-accent"
                        />
                        <span>
                          公开原始日志
                          <span className="block text-muted">
                            任何人可下载。日志里可能有本机路径和密钥，请先检查。
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  <SessionLogHelp />
                </section>
              </div>

              <aside className="border-t border-border px-5 pt-6 pb-5 lg:border-t-0 lg:border-l lg:bg-raised/60 lg:p-5">
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
                  logModelHint={logModelHint}
                />
              </aside>
            </div>
          </DialogBody>

          <DialogFooter className="max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5">
            {(clientError || serverError) && (
              <p className="min-w-0 flex-1 text-xs text-negative max-sm:truncate" role="alert">
                {clientError || serverError}
              </p>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" variant="primary" disabled={!ready || submitting}>
                {submitting ? "提交中…" : "提交"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { promptId = "" } = useParams();
  const { search } = useLocation();
  const { open, close } = useDialogClose(promptId ? `/p/${promptId}${search}` : "/");
  let title = "无法提交答案";
  let message = "加载失败，请稍后再试。";
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) title = "没有提交权限";
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
