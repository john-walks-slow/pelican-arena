import { ArrowLeft, Check, FileArchive, FileCode2, FileText, Plus, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { data, Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/submit";
import { Button } from "~/components/ui/button";
import { Combobox } from "~/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { REASONING_LEVELS } from "~/db/schema";
import {
  buildBundle,
  BundleError,
  BUNDLE_LIMITS,
  ENTRY_FILE,
  formatBytes,
  unzipBundle,
  type BundleEntry,
} from "~/lib/bundle";
import { formatCount, formatDuration, REASONING_LABELS } from "~/lib/format";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { matchModel } from "~/lib/model-match";
import { getCatalog, getPrompt } from "~/lib/queries.server";
import {
  LOG_SOURCE_LABELS,
  LogParseError,
  parseSessionLog,
  totalTokens,
  type LogMeta,
} from "~/lib/session-log";
import { FIELDS, NOTES_LIMIT, parseSubmissionMeta, RAW_LOG_LIMIT } from "~/lib/submission-input";
import { createSubmission, readBundleEntries } from "~/lib/submissions.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `交答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  return { prompt: { id: prompt.id, title: prompt.title }, catalog: await getCatalog() };
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
      entries,
      meta,
      rawLog: rawLogFile,
    });
    return redirect(`/s/${id}`);
  } catch (e) {
    if (e instanceof BundleError) return data({ error: e.message }, { status: 400 });
    throw e;
  }
}

type Source = { kind: "file"; name: string; entries: BundleEntry[] } | { kind: "paste" };

function useBundleSource() {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFile(file: File) {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isZip = file.name.toLowerCase().endsWith(".zip");
      if (!isZip && file.size > BUNDLE_LIMITS.htmlBytes) {
        throw new BundleError(`HTML 文件超过 ${formatBytes(BUNDLE_LIMITS.htmlBytes)}`);
      }
      const entries = buildBundle(isZip ? unzipBundle(bytes) : [{ path: ENTRY_FILE, data: bytes }]);
      setSource({ kind: "file", name: file.name, entries });
    } catch (e) {
      setSource(null);
      setError(e instanceof BundleError ? e.message : "无法读取文件，请确认是 HTML 或 zip");
    }
  }

  return { source, setSource, error, pickFile };
}

function BundlePicker({
  bundle,
  html,
  setHtml,
}: {
  bundle: ReturnType<typeof useBundleSource>;
  html: string;
  setHtml: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { source, setSource, error, pickFile } = bundle;

  if (source?.kind === "file") {
    const total = source.entries.reduce((s, e) => s + e.data.byteLength, 0);
    const Icon = source.entries.length > 1 ? FileArchive : FileCode2;
    return (
      <div className="rounded-control border border-border bg-raised/60 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{source.name}</div>
            <div className="num text-xs text-muted">
              {source.entries.length} 个文件 · {formatBytes(total)}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="移除"
            onClick={() => setSource(null)}
          >
            <X className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        {source.entries.length > 1 && (
          <ul className="mt-2 max-h-36 space-y-0.5 overflow-y-auto scroll-thin border-t border-border pt-2 font-mono text-xs text-muted">
            {source.entries.map((e) => (
              <li key={e.path} className="flex justify-between gap-4">
                <span className="truncate">{e.path}</span>
                <span className="num shrink-0">{formatBytes(e.data.byteLength)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (source?.kind === "paste") {
    return (
      <div>
        <Textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={10}
          className="font-mono text-xs leading-relaxed"
          placeholder="<!DOCTYPE html>…"
          spellCheck={false}
          autoFocus
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <button type="button" className="hover:text-ink" onClick={() => setSource(null)}>
            改为上传文件
          </button>
          <span className="num">{formatBytes(new Blob([html]).size)}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) pickFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-control hover:bg-raised/60"
        }`}
      >
        <Upload className="size-4 text-muted" strokeWidth={1.75} />
        <div className="text-sm font-medium">拖入或选择 HTML / zip</div>
        <div className="text-xs text-muted">
          zip 需包含 index.html，解压后不超过 {formatBytes(BUNDLE_LIMITS.totalBytes)}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.zip,text/html,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pickFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <button
        type="button"
        className="mt-1.5 text-xs text-muted hover:text-ink"
        onClick={() => setSource({ kind: "paste" })}
      >
        或者直接粘贴 HTML 源码
      </button>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </div>
  );
}

function LogSummary({ meta }: { meta: LogMeta }) {
  const rows = [
    ["来源", LOG_SOURCE_LABELS[meta.source]],
    ["模型", meta.models.join("、") || "—"],
    ["总 token", formatCount(totalTokens(meta))],
    ["输入 / 输出", `${formatCount(meta.inputTokens)} / ${formatCount(meta.outputTokens)}`],
    ["缓存读取", formatCount(meta.cacheReadTokens)],
    ["用时", meta.durationMs == null ? "—" : formatDuration(meta.durationMs)],
    ["轮数 / 工具调用", `${meta.turns} / ${meta.toolCalls}`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="num truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 first:border-0 first:pt-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Submit({ loaderData }: Route.ComponentProps) {
  const { prompt, catalog } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const bundle = useBundleSource();
  const [html, setHtml] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [harness, setHarness] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [mods, setMods] = useState<string[]>([]);
  const [customMod, setCustomMod] = useState("");
  const [log, setLog] = useState<{ file: File; meta: LogMeta } | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  const logModelHint = useMemo(() => {
    const raw = log?.meta.models[0];
    return raw ? { raw, match: matchModel(raw, catalog.models) } : null;
  }, [log, catalog.models]);

  async function pickLog(file: File) {
    setLogError(null);
    try {
      const meta = parseSessionLog(await file.text());
      setLog({ file, meta });
      const raw = meta.models[0];
      if (raw && !model) setModel(matchModel(raw, catalog.models)?.name ?? raw);
      const sourceHarness = LOG_SOURCE_LABELS[meta.source];
      if (!harness && catalog.harnesses.some((h) => h.name === sourceHarness)) setHarness(sourceHarness);
    } catch (e) {
      setLog(null);
      setLogError(e instanceof LogParseError ? e.message : "无法读取日志文件");
    }
  }

  function addMod(name: string) {
    const clean = name.trim();
    if (clean && !mods.includes(clean)) setMods([...mods, clean]);
    setCustomMod("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const form = new FormData(e.currentTarget);

    let entries: BundleEntry[];
    try {
      if (bundle.source?.kind === "file") entries = bundle.source.entries;
      else if (bundle.source?.kind === "paste" && html.trim()) {
        entries = buildBundle([{ path: ENTRY_FILE, data: new TextEncoder().encode(html) }]);
      } else throw new BundleError("请上传或粘贴结果网页");
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

  const modOptions = [...new Set([...catalog.mods.map((m) => m.name), ...mods])];

  return (
    <div className="mx-auto max-w-[680px]">
      <Link to={`/p/${prompt.id}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        {prompt.title}
      </Link>
      <h1 className="mt-2 text-title font-bold tracking-tight">交答案</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-8">
        <Section title="结果网页">
          <BundlePicker bundle={bundle} html={html} setHtml={setHtml} />
        </Section>

        <Section title="生成信息">
          <div className="grid gap-4 sm:grid-cols-2">
            <Combobox
              name={FIELDS.model}
              label="模型"
              options={catalog.models}
              value={model}
              onChange={setModel}
              placeholder="选择或输入模型"
              required
              hint={
                logModelHint &&
                (logModelHint.match ? `日志记录：${logModelHint.raw}` : `日志记录：${logModelHint.raw}`)
              }
            />
            <Combobox
              name={FIELDS.provider}
              label="提供方"
              options={catalog.providers}
              value={provider}
              onChange={setProvider}
              placeholder="官方 API、OpenRouter、某中转站…"
              required
            />
            <Combobox
              name={FIELDS.harness}
              label="客户端"
              options={catalog.harnesses}
              value={harness}
              onChange={setHarness}
              placeholder="Claude Code、Cherry Studio…"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" htmlFor="reasoning">
                思考强度
              </label>
              <input type="hidden" name={FIELDS.reasoning} value={reasoning} />
              <Select value={reasoning || "unknown"} onValueChange={(v) => setReasoning(v === "unknown" ? "" : v)}>
                <SelectTrigger id="reasoning">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">未知</SelectItem>
                  {REASONING_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {REASONING_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium">增强</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {modOptions.map((name) => {
                const on = mods.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (on ? setMods(mods.filter((m) => m !== name)) : setMods([...mods, name]))}
                    className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors ${
                      on
                        ? "border-accent/30 bg-accent-soft font-medium text-accent-ink"
                        : "border-control text-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
              <div className="inline-flex items-center gap-1">
                <input
                  value={customMod}
                  onChange={(e) => setCustomMod(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMod(customMod);
                    }
                  }}
                  placeholder="其他"
                  maxLength={30}
                  className="h-7 w-20 rounded-full border border-control px-2.5 text-xs placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="添加增强"
                  onClick={() => addMod(customMod)}
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {mods.length === 0 ? "不选即为 vanilla。" : `已选 ${mods.length} 项`}
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium" htmlFor="notes">
              备注
            </label>
            <Textarea
              id="notes"
              name={FIELDS.notes}
              rows={2}
              maxLength={NOTES_LIMIT}
              className="mt-1.5"
              placeholder="温度、系统提示词、遇到的问题…"
            />
          </div>
        </Section>

        <Section
          title="Session log"
          hint="支持 Claude Code 与 Codex CLI 的 JSONL 日志。日志在浏览器里读取，默认只上传 token 和用时等统计。"
        >
          {log ? (
            <div className="rounded-control border border-border bg-raised/60 px-3 py-2.5">
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
                <LogSummary meta={log.meta} />
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
          ) : (
            <div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-control bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-raised">
                <FileText className="size-3.5 text-muted" strokeWidth={1.75} />
                选择日志文件
                <input
                  type="file"
                  accept=".jsonl,.json,.log,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) pickLog(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {logError && <p className="mt-1 text-xs text-negative">{logError}</p>}
            </div>
          )}
        </Section>

        {(clientError || serverError) && (
          <p className="text-sm text-negative" role="alert">
            {clientError || serverError}
          </p>
        )}

        <div className="flex justify-end gap-1.5">
          <Button asChild variant="outline">
            <Link to={`/p/${prompt.id}`}>取消</Link>
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "提交中…" : "提交"}
          </Button>
        </div>
      </form>
    </div>
  );
}
