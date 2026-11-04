import { CircleAlert, FileText, Undo2, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useGate } from "~/components/gate-dialog";
import { Markdown } from "~/components/markdown";
import { SectionHeading } from "~/components/section-heading";
import { SessionLogHelp } from "~/components/session-log-help";
import { FileDropZone } from "~/components/submission/file-drop-zone";
import { InlineWorkPreview } from "~/components/submission/inline-work-preview";
import { PickedBundleCard } from "~/components/submission/picked-bundle-card";
import { SessionLogSummary } from "~/components/submission/session-log-summary";
import { MetaFieldsSkeleton, SubmissionMetaFields } from "~/components/submission/meta-fields";
import { Button } from "~/components/ui/button";
import { DisabledTooltip } from "~/components/ui/tooltip";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { ModelCost } from "~/lib/cost";
import { Segmented } from "~/components/ui/segmented";
import { Textarea } from "~/components/ui/textarea";
import {
  buildBundle,
  BundleError,
  BUNDLE_LIMITS,
  formatBytes,
  readTextBundle,
  singleFileLimit,
  type BundleEntry,
} from "~/lib/bundle";
import type { Catalog, CatalogEntry } from "~/lib/catalog";
import { KIND_META, type PromptKind } from "~/lib/kinds";
import { matchModel } from "~/lib/model-match";
import { SANDBOX } from "~/lib/sandbox";
import { LOG_SOURCE_LABELS, LogParseError, type LogMeta } from "~/lib/session-log";
import { readSessionLogFile } from "~/lib/session-log-file";
import { captureClientThumbnail } from "~/lib/client-thumbnail";
import { FIELDS } from "~/lib/submission-input";
import { useFileBundle } from "~/lib/use-file-bundle";

export interface SubmissionInitial {
  status?: string;
  model: string;
  provider: string;
  harness: string;
  reasoning: string;
  mods: string[];
  notes: string;
  files: { path: string; size: number }[];
  logMeta: LogMeta | null;
}

interface SubmissionFormProps {
  mode: "create" | "edit";
  prompt: { title: string; kind: PromptKind };
  catalog: Promise<Catalog>;
  initial?: SubmissionInitial;
  open: boolean;
  onClose: () => void;
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

function SourceEditor({
  kind,
  value,
  onChange,
  placeholder,
  rows = 9,
  minHeight = "min-h-[196px]",
  autoFocus = false,
}: {
  kind: PromptKind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
  autoFocus?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const meta = KIND_META[kind];

  const svgSrc = useMemo(() => {
    if (kind !== "svg" || !preview || !value.trim()) return null;
    try {
      readTextBundle("svg", new TextEncoder().encode(value));
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
    } catch {
      return null;
    }
  }, [kind, preview, value]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {preview ? (
        <div className={`flex ${minHeight} flex-1 flex-col overflow-hidden rounded-control border border-border bg-surface`}>
          {kind === "web" ? (
            <iframe
              srcDoc={value}
              title="HTML 预览"
              sandbox={SANDBOX}
              allow="fullscreen; autoplay"
              referrerPolicy="no-referrer"
              className="min-h-[196px] flex-1 border-0 bg-white"
            />
          ) : kind === "markdown" ? (
            <div className="flex-1 overflow-y-auto scroll-thin bg-ground/50 p-3.5">
              <Markdown>{value}</Markdown>
            </div>
          ) : svgSrc ? (
            <div className="flex flex-1 items-center justify-center bg-ground/50 p-2">
              <img
                src={svgSrc}
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={`${minHeight} flex-1 font-mono text-xs leading-relaxed`}
          placeholder={placeholder}
          spellCheck={false}
          autoFocus={autoFocus}
        />
      )}
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
        {value.trim() ? (
          <button
            type="button"
            className="font-medium text-ink hover:text-accent"
            onClick={() => setPreview((current) => !current)}
          >
            {preview ? "返回编辑源码" : "预览效果"}
          </button>
        ) : (
          <span>保存为 {meta.entry}</span>
        )}
        <span className="num">{formatBytes(new Blob([value]).size)}</span>
      </div>
    </div>
  );
}

function BundlePicker({
  kind,
  bundle,
}: {
  kind: PromptKind;
  bundle: ReturnType<typeof useFileBundle>;
}) {
  const meta = KIND_META[kind];
  const { picked, setPicked, error, pickFile } = bundle;

  if (picked) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-border bg-raised/60">
        <PickedBundleCard picked={picked} kind={kind} onRemove={() => setPicked(null)} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <InlineWorkPreview kind={kind} entries={picked.entries} name={picked.name} />
        </div>
      </div>
    );
  }

  return (
    <FileDropZone
      accept={meta.accept}
      label={`拖入或选择 ${kind === "web" ? "HTML / zip" : `.${meta.extension}`}`}
      hint={
        kind === "web"
          ? `zip 需包含 index.html，入口不超过 ${formatBytes(BUNDLE_LIMITS.htmlBytes)}，解压后不超过 ${formatBytes(BUNDLE_LIMITS.totalBytes)}`
          : `单个文件，不超过 ${formatBytes(singleFileLimit(kind))}`
      }
      error={error}
      onPick={pickFile}
    />
  );
}

function FileList({ files }: { files: { path: string; size: number }[] }) {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  return (
    <div className="mt-3 rounded-control border border-border bg-raised/40 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>已提交文件</span>
        <span className="num">
          {files.length} 个文件 · {formatBytes(total)}
        </span>
      </div>
      <ul className="space-y-1 border-t border-border pt-2 font-mono text-xs text-muted">
        {files.slice(0, 6).map((file) => (
          <li key={file.path} className="flex justify-between gap-4">
            <span className="truncate">{file.path}</span>
            <span className="num shrink-0">{formatBytes(file.size)}</span>
          </li>
        ))}
        {files.length > 6 && <li>…</li>}
      </ul>
    </div>
  );
}

export function SubmissionForm({
  mode,
  prompt,
  catalog,
  initial,
  open,
  onClose,
}: SubmissionFormProps) {
  const isEdit = mode === "edit";
  const kind = prompt.kind;
  const meta = KIND_META[kind];
  const bundle = useFileBundle(kind);
  const fetcher = useFetcher<{ error: string }>();

  const [model, setModel] = useState(initial?.model ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [harness, setHarness] = useState(initial?.harness ?? "");
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? "");
  const [mods, setMods] = useState<string[]>(initial?.mods ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [text, setText] = useState("");
  const [workMode, setWorkMode] = useState<"upload" | "paste">(
    kind === "markdown" ? "paste" : "upload",
  );
  const [log, setLog] = useState<{ name: string | null; meta: LogMeta } | null>(
    initial?.logMeta ? { name: null, meta: initial.logMeta } : null,
  );
  const [draggingLog, setDraggingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const gate = useGate();
  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  useEffect(() => {
    if (serverError && (serverError.includes("最多") || serverError.includes("上限"))) {
      gate.open({ reason: "daily_limit", action: "submit", message: serverError });
    } else if (serverError && serverError.includes("内容规则")) {
      gate.openRules();
    }
  }, [serverError, gate]);
  const logMeta = log?.meta ?? null;
  const logModelHint = logMeta?.models[0] ?? null;
  const [modelCost, setModelCost] = useState<ModelCost | null>(null);

  useEffect(() => {
    const name = model.trim();
    if (!name) {
      setModelCost(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/catalog?kind=models&find=${encodeURIComponent(name)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => {
        if (controller.signal.aborted) return;
        const data = raw as { model?: { cost?: ModelCost | null } | null } | null;
        setModelCost(data?.model?.cost ?? null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [model]);

  const dirty = isEdit
    ? Boolean(
        initial &&
          (model !== initial.model ||
            provider !== initial.provider ||
            harness !== initial.harness ||
            reasoning !== initial.reasoning ||
            notes !== initial.notes ||
            JSON.stringify(logMeta) !== JSON.stringify(initial.logMeta ?? null) ||
            mods.join("\u0000") !== initial.mods.join("\u0000")),
      )
    : Boolean(
        bundle.picked ||
          text.trim() ||
          model ||
          provider ||
          harness ||
          mods.length > 0 ||
          notes.trim() ||
          log,
      );

  const blockedReason = !model.trim()
    ? "模型"
    : !provider.trim()
      ? "提供方"
      : !isEdit && workMode === "upload" && !bundle.picked
        ? meta.resultTitle
        : !isEdit && workMode === "paste" && !text.trim()
          ? meta.resultTitle
          : null;

  const ready = blockedReason === null;

  async function pickLog(file: File) {
    setLogError(null);
    try {
      const parsed = await readSessionLogFile(file);
      const nextMeta = parsed.meta;
      setLog({ name: parsed.name, meta: nextMeta });
      const raw = nextMeta.models[0];
      if (raw && !model) {
        const match = matchModel(raw, (await catalog).models) ?? (await resolveModelName(raw));
        setModel(match?.name ?? raw);
      }
      const sourceHarness = LOG_SOURCE_LABELS[nextMeta.source];
      if (!harness && (await catalog).harnesses.some((h) => h.name === sourceHarness)) {
        setHarness(sourceHarness);
      }
    } catch (e) {
      if (!isEdit) setLog(null);
      setLogError(e instanceof LogParseError ? e.message : "无法读取日志文件");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    const form = new FormData(event.currentTarget);

    if (!isEdit) {
      let entries: BundleEntry[];
      try {
        if (workMode === "upload") {
          if (!bundle.picked) throw new BundleError(`请上传或粘贴${meta.resultTitle}`);
          entries = bundle.picked.entries;
        } else {
          if (!text.trim()) throw new BundleError(`请上传或粘贴${meta.resultTitle}`);
          const bytes = new TextEncoder().encode(text);
          if (kind !== "web") readTextBundle(kind, bytes);
          entries = buildBundle([{ path: meta.entry, data: bytes }], kind);
        }
        for (const entry of entries) {
          form.append("file", new Blob([entry.data as BlobPart]), entry.path);
          form.append("path", entry.path);
        }

        // 尝试在客户端生成缩略图（双轨制：客户端优先，失败则由服务端兜底）
        const entryFile = entries.find((e) => e.path === meta.entry) ?? entries[0];
        if (entryFile) {
          setCapturing(true);
          try {
            const thumbBlob = await captureClientThumbnail(kind, entryFile.data);
            if (thumbBlob) {
              form.append("thumbnail", thumbBlob, "thumb.webp");
            }
          } catch (e) {
            console.warn("Client thumbnail capture skipped:", e);
          } finally {
            setCapturing(false);
          }
        }
      } catch (err) {
        setCapturing(false);
        setClientError(err instanceof BundleError ? err.message : String(err));
        return;
      }
    }

    for (const mod of mods) form.append(FIELDS.mods, mod);
    if (logMeta) form.set(FIELDS.logMeta, JSON.stringify(logMeta));
    else form.delete(FIELDS.logMeta);

    fetcher.submit(form, {
      method: "post",
      encType: isEdit ? "application/x-www-form-urlencoded" : "multipart/form-data",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
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
          <div className="flex items-center justify-between gap-3 min-w-0 pr-8">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <DialogTitle>{isEdit ? "编辑答案" : "提交答案"}</DialogTitle>
                <button
                  type="button"
                  onClick={gate.viewRules}
                  title="查看内容规则"
                  aria-label="查看内容规则"
                  className="inline-flex size-6 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-accent focus-visible:outline-none"
                >
                  <CircleAlert className="size-4 text-accent" strokeWidth={2} />
                </button>
              </div>
              <DialogDescription className="mt-0.5 truncate">
                给「{prompt.title}」
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-6 p-5">
                {isEdit ? (
                  <section>
                    <SectionHeading
                      title="结果"
                      hint="不可修改；如需更换作品请撤回后重新提交"
                      aside={
                        <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">
                          {meta.label}
                        </span>
                      }
                    />
                    {initial && <FileList files={initial.files} />}
                  </section>
                ) : (
                  <section className="flex min-h-0 flex-1 flex-col">
                    <SectionHeading
                      title="结果"
                      aside={
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">
                            {meta.label}
                          </span>
                          <Segmented
                            label="作品录入方式"
                            value={workMode}
                            onChange={setWorkMode}
                            options={[
                              { value: "upload", label: "上传文件" },
                              { value: "paste", label: `粘贴${kind === "markdown" ? "文本" : "源码"}` },
                            ]}
                          />
                        </div>
                      }
                    />

                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                      {workMode === "upload" ? (
                        <BundlePicker kind={kind} bundle={bundle} />
                      ) : (
                        <SourceEditor
                          kind={kind}
                          value={text}
                          onChange={setText}
                          placeholder={`在此粘贴 ${
                            kind === "markdown" ? "Markdown" : kind === "svg" ? "SVG 源码" : "HTML 源码"
                          }…`}
                          autoFocus
                        />
                      )}
                    </div>
                  </section>
                )}

                <section
                  className="border-t border-border pt-6"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      e.preventDefault();
                      pickLog(file);
                    }
                  }}
                >
                  <SectionHeading
                    title="Session log"
                    hint="可选"
                    aside={
                      log ? (
                        <Button asChild variant="outline" size="sm">
                          <label
                            className="cursor-pointer gap-1.5"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const file = e.dataTransfer.files[0];
                              if (file) pickLog(file);
                            }}
                          >
                            <FileText className="size-3.5 text-muted pointer-events-none" strokeWidth={1.75} />
                            更换日志文件
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
                      ) : null
                    }
                  />

                  {logMeta ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDraggingLog(true);
                      }}
                      onDragLeave={() => setDraggingLog(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggingLog(false);
                        const file = e.dataTransfer.files[0];
                        if (file) pickLog(file);
                      }}
                      className={`mt-2.5 rounded-control border px-3 py-2.5 transition-colors ${
                        draggingLog ? "border-accent bg-accent-soft" : "border-border bg-raised/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="size-4 shrink-0 text-muted pointer-events-none" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1 truncate text-sm font-medium pointer-events-none">
                          {log?.name ?? `${LOG_SOURCE_LABELS[logMeta.source]} 日志`}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="移除日志"
                          onClick={() => {
                            setLog(null);
                            setLogError(null);
                          }}
                        >
                          <X className="size-4" strokeWidth={1.75} />
                        </Button>
                      </div>
                      <div className="mt-2.5 border-t border-border pt-2.5 pointer-events-none">
                        <SessionLogSummary meta={logMeta} cost={modelCost} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5">
                      <FileDropZone
                        icon={FileText}
                        accept=".jsonl,.json,.log,.txt,.zstd,.zst"
                        label="拖入或选择日志文件"
                        hint="支持 Claude Code、Codex、pi、DSH 与 OpenCode，在浏览器本地解析 token 消耗与耗时信息，日志文件不会上传。"
                        error={logError}
                        onPick={pickLog}
                        className="min-h-[84px] py-4"
                      />
                    </div>
                  )}

                  {logMeta && logError && <p className="mt-1.5 text-xs text-negative">{logError}</p>}

                  <SessionLogHelp />
                </section>
              </div>

              <aside className="border-t border-border px-5 pt-6 pb-5 lg:border-t-0 lg:border-l lg:bg-raised/60 lg:p-5">
                <SectionHeading title="生成信息" />
                <Suspense fallback={<MetaFieldsSkeleton />}>
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
                </Suspense>
              </aside>
            </div>
          </DialogBody>

          <DialogFooter className="max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5">
            {isEdit && (
              <div className="mr-auto">
                <DisabledTooltip
                  disabled={Boolean(initial?.status && initial.status !== "active")}
                  content="处理中或已下架的答案不支持撤回"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={Boolean(initial?.status && initial.status !== "active") || submitting}
                    className="text-muted hover:text-negative"
                    onClick={() => setWithdrawOpen(true)}
                  >
                    <Undo2 className="size-4" strokeWidth={1.75} />
                    撤回答案
                  </Button>
                </DisabledTooltip>
              </div>
            )}
            {clientError || serverError ? (
              <p className="min-w-0 flex-1 text-xs text-negative max-sm:truncate" role="alert">
                {clientError || serverError}
              </p>
            ) : blockedReason ? (
              <p className="min-w-0 flex-1 text-xs text-muted">还需要：{blockedReason}</p>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!ready || submitting || capturing}
              >
                {submitting
                  ? isEdit
                    ? "保存中…"
                    : "提交中…"
                  : capturing
                    ? "生成预览中…"
                    : isEdit
                      ? "保存修改"
                      : "提交"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="撤回这份答案？"
        description="撤回后会从题目页与统计中消失，答案链接立即失效。文件与评分记录会保留，你可以在「我的」里恢复。"
        confirmLabel="撤回"
        destructive
        busy={submitting}
        onConfirm={() => {
          fetcher.submit({ intent: "withdraw" }, { method: "post" });
        }}
      />
    </Dialog>
  );
}
