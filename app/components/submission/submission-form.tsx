import { FileText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { Markdown } from "~/components/markdown";
import { SectionHeading } from "~/components/section-heading";
import { SessionLogHelp } from "~/components/session-log-help";
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
import { FIELDS } from "~/lib/submission-input";
import { useFileBundle } from "~/lib/use-file-bundle";

export interface SubmissionInitial {
  model: string;
  provider: string;
  harness: string;
  reasoning: string;
  mods: string[];
  notes: string;
  files: { path: string; size: number }[];
  logMeta: LogMeta | null;
  hasRawLog: boolean;
}

interface SubmissionFormProps {
  mode: "create" | "edit";
  prompt: { title: string; kind: PromptKind };
  catalog: Catalog;
  initial?: SubmissionInitial;
  initialText?: string | null;
  useFileMode?: boolean;
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
  name,
  placeholder,
  rows = 9,
  minHeight = "min-h-[196px]",
  autoFocus = false,
}: {
  kind: PromptKind;
  value: string;
  onChange: (value: string) => void;
  name?: string;
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
      {name && <input type="hidden" name={name} value={value} />}
      {preview ? (
        <div className={`flex ${minHeight} flex-1 flex-col overflow-hidden rounded-control border border-border bg-white`}>
          {kind === "web" ? (
            <iframe
              srcDoc={value}
              title="HTML 预览"
              sandbox={SANDBOX}
              allow="fullscreen; autoplay"
              referrerPolicy="no-referrer"
              className="min-h-[196px] flex-1 border-0"
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
  edit,
  useFileMode,
}: {
  kind: PromptKind;
  bundle: ReturnType<typeof useFileBundle>;
  edit: boolean;
  useFileMode: boolean;
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

  const uploadLabel = edit
    ? useFileMode
      ? `选择新的 ${kind === "markdown" ? "Markdown" : kind === "svg" ? "SVG" : "HTML / zip"}`
      : "选择 HTML / zip"
    : `拖入或选择 ${kind === "web" ? "HTML / zip" : `.${meta.extension}`}`;

  const hint = edit
    ? kind === "web"
      ? "zip 需包含 index.html"
      : `替换 ${meta.entry}`
    : kind === "web"
      ? `zip 需包含 index.html，解压后不超过 ${formatBytes(BUNDLE_LIMITS.totalBytes)}`
      : `单个文件，不超过 ${formatBytes(singleFileLimit(kind))}`;

  return (
    <FileDropZone
      accept={meta.accept}
      label={uploadLabel}
      hint={hint}
      error={error}
      onPick={pickFile}
      className={edit ? "min-h-[132px]" : undefined}
    />
  );
}

function FileList({ files }: { files: { path: string; size: number }[] }) {
  return (
    <ul className="mt-3 space-y-1 rounded-control border border-border bg-raised/40 px-3 py-2.5 font-mono text-xs text-muted">
      {files.slice(0, 6).map((file) => (
        <li key={file.path} className="flex justify-between gap-4">
          <span className="truncate">{file.path}</span>
          <span className="num shrink-0">{formatBytes(file.size)}</span>
        </li>
      ))}
      {files.length > 6 && <li>…</li>}
    </ul>
  );
}

export function SubmissionForm({
  mode,
  prompt,
  catalog,
  initial,
  initialText = null,
  useFileMode = false,
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
  const [text, setText] = useState(initialText ?? "");
  const [workMode, setWorkMode] = useState<"upload" | "paste">("upload");
  const [webMode, setWebMode] = useState<"keep" | "replace">("keep");
  const [webSource, setWebSource] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [log, setLog] = useState<{ file: File; meta: LogMeta } | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState(false);
  const [removeRawLog, setRemoveRawLog] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const logMeta = isEdit ? initial?.logMeta ?? null : log?.meta ?? null;
  const logModelHint = logMeta?.models[0] ?? null;

  const dirty = isEdit
    ? Boolean(
        initial &&
          (model !== initial.model ||
            provider !== initial.provider ||
            harness !== initial.harness ||
            reasoning !== initial.reasoning ||
            notes !== initial.notes ||
            text !== (initialText ?? "") ||
            pasteText.length > 0 ||
            bundle.picked !== null ||
            webMode !== "keep" ||
            removeRawLog ||
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
          : isEdit && useFileMode && !bundle.picked
            ? "替换文件"
            : isEdit && kind !== "web" && !useFileMode && !text.trim()
              ? meta.resultTitle
              : isEdit && kind === "web" && webMode === "replace" && webSource === "paste" && !pasteText.trim()
                ? "HTML 源码"
                : isEdit && kind === "web" && webMode === "replace" && webSource === "upload" && !bundle.picked
                  ? "替换文件"
                  : null;

  const ready = blockedReason === null;

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
      if (!harness && catalog.harnesses.some((h) => h.name === sourceHarness)) {
        setHarness(sourceHarness);
      }
    } catch (e) {
      setLog(null);
      setLogError(e instanceof LogParseError ? e.message : "无法读取日志文件");
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    const form = new FormData(event.currentTarget);

    let entries: BundleEntry[] | null = null;
    try {
      if (!isEdit) {
        if (workMode === "upload") {
          if (!bundle.picked) throw new BundleError(`请上传或粘贴${meta.resultTitle}`);
          entries = bundle.picked.entries;
        } else {
          if (!text.trim()) throw new BundleError(`请上传或粘贴${meta.resultTitle}`);
          const bytes = new TextEncoder().encode(text);
          if (kind !== "web") readTextBundle(kind, bytes);
          entries = buildBundle([{ path: meta.entry, data: bytes }], kind);
        }
      } else if (useFileMode) {
        if (!bundle.picked) throw new BundleError("请选择替换文件");
        form.set("replace", "1");
        entries = bundle.picked.entries;
      } else if (kind === "web" && webMode === "replace") {
        form.set("replace", "1");
        if (webSource === "paste") {
          if (!pasteText.trim()) throw new BundleError("请粘贴 HTML 源码");
          entries = buildBundle(
            [{ path: meta.entry, data: new TextEncoder().encode(pasteText) }],
            "web",
          );
        } else {
          if (!bundle.picked) throw new BundleError("请选择替换文件");
          entries = bundle.picked.entries;
        }
      }

      if (entries) {
        for (const entry of entries) {
          form.append("file", new Blob([entry.data as BlobPart]), entry.path);
          form.append("path", entry.path);
        }
      }
    } catch (err) {
      setClientError(err instanceof BundleError ? err.message : String(err));
      return;
    }

    for (const mod of mods) form.append(FIELDS.mods, mod);
    if (!isEdit && log) {
      form.set(FIELDS.logMeta, JSON.stringify(log.meta));
      if (publishLog) form.set(FIELDS.rawLog, log.file);
    }
    fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
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
          <div className="min-w-0">
            <DialogTitle>{isEdit ? "编辑答案" : "提交答案"}</DialogTitle>
            <DialogDescription className="mt-0.5 truncate">
              给「{prompt.title}」
            </DialogDescription>
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
                      hint={kind === "web" ? "不修改文件就保留原内容" : "保存时覆盖原文件"}
                      aside={
                        <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">
                          {meta.label}
                        </span>
                      }
                    />

                    {kind === "web" && (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Segmented
                          label="作品文件"
                          value={webMode}
                          onChange={setWebMode}
                          options={[
                            { value: "keep", label: "保留原文件" },
                            { value: "replace", label: "替换文件" },
                          ]}
                        />
                        <span className="num text-xs text-muted">
                          {initial?.files.length ?? 0} 个文件 ·{" "}
                          {formatBytes((initial?.files ?? []).reduce((sum, file) => sum + file.size, 0))}
                        </span>
                      </div>
                    )}

                    {kind === "web" && webMode === "keep" && initial && (
                      <FileList files={initial.files} />
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
                          <div className="mt-3">
                            <SourceEditor
                              kind="web"
                              value={pasteText}
                              onChange={setPasteText}
                              placeholder="粘贴完整的 HTML 源码…"
                              rows={10}
                            />
                          </div>
                        ) : (
                          <div className="mt-3">
                            <BundlePicker
                              kind={kind}
                              bundle={bundle}
                              edit
                              useFileMode={useFileMode}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {kind !== "web" && !useFileMode && (
                      <div className="mt-3">
                        <SourceEditor
                          kind={kind}
                          value={text}
                          onChange={setText}
                          name="text"
                          rows={12}
                          minHeight="min-h-[260px]"
                        />
                      </div>
                    )}
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
                        <BundlePicker
                          kind={kind}
                          bundle={bundle}
                          edit={false}
                          useFileMode={false}
                        />
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

                <section className="border-t border-border pt-6">
                  <SectionHeading
                    title="Session log"
                    hint={isEdit ? "只读" : "可选"}
                    aside={
                      !isEdit && !log ? (
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
                      ) : undefined
                    }
                  />
                  {!isEdit && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      从日志里读取 token 和用时，自动填写模型与客户端。原始文件不会上传。
                    </p>
                  )}

                  {!isEdit && logError && <p className="mt-1.5 text-xs text-negative">{logError}</p>}

                  {logMeta ? (
                    <div className="mt-2.5 rounded-control border border-border bg-raised/60 px-3 py-2.5">
                      {!isEdit && log && (
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
                      )}
                      <div className={!isEdit && log ? "mt-2.5 border-t border-border pt-2.5" : ""}>
                        <SessionLogSummary meta={logMeta} />
                      </div>
                      {!isEdit && log && (
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
                      )}
                    </div>
                  ) : isEdit ? (
                    <p className="mt-2 text-xs text-muted">没有日志信息。</p>
                  ) : null}

                  {isEdit && initial?.hasRawLog && (
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

                  {!isEdit && <SessionLogHelp />}
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
                disabled={!ready || submitting}
              >
                {submitting
                  ? isEdit
                    ? "保存中…"
                    : "提交中…"
                  : isEdit
                    ? "保存修改"
                    : "提交"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
