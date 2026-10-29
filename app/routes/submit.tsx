import { FileArchive, FileCode2, FileText, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { data, Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/submit";
import { CatalogInput } from "~/components/combobox";
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
      const entries = buildBundle(
        isZip ? unzipBundle(bytes) : [{ path: ENTRY_FILE, data: bytes }],
      );
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
      <div className="rounded-card border border-border bg-raised p-3">
        <div className="flex items-center gap-3">
          <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{source.name}</div>
            <div className="num text-xs text-muted">
              {source.entries.length} 个文件 · {formatBytes(total)}
            </div>
          </div>
          <button type="button" className="btn-ghost size-8 px-0" aria-label="移除" onClick={() => setSource(null)}>
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        {source.entries.length > 1 && (
          <ul className="mt-3 max-h-40 overflow-y-auto border-t border-border pt-2 text-xs text-muted">
            {source.entries.map((e) => (
              <li key={e.path} className="flex justify-between gap-4 py-0.5">
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
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={12}
          className="field h-auto py-2 font-mono text-xs leading-5"
          placeholder="<!DOCTYPE html>…"
          spellCheck={false}
          autoFocus
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-control bg-surface hover:bg-raised"
        }`}
      >
        <Upload className="size-5 text-muted" strokeWidth={1.75} />
        <div className="text-sm font-medium">拖入或选择 HTML / zip 文件</div>
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
        className="mt-2 text-xs text-muted hover:text-ink"
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
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="num truncate">{v}</dd>
        </div>
      ))}
    </dl>
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
  const [mods, setMods] = useState<string[]>([]);
  const [customMod, setCustomMod] = useState("");
  const [attempt, setAttempt] = useState<"first" | "picked">("first");
  const [log, setLog] = useState<{ file: File; meta: LogMeta } | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const submitting = fetcher.state !== "idle";
  const serverError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const logModelHint = useMemo(() => {
    const raw = log?.meta.models[0];
    if (!raw) return null;
    return { raw, match: matchModel(raw, catalog.models) };
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

  function toggleMod(name: string) {
    setMods((cur) => (cur.includes(name) ? cur.filter((m) => m !== name) : [...cur, name]));
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
    <div className="mx-auto max-w-[720px]">
      <Link to={`/p/${prompt.id}`} className="text-sm text-muted hover:text-ink">
        {prompt.title}
      </Link>
      <h1 className="mt-1 text-title font-bold tracking-tight">交答案</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <section className="panel space-y-3 p-5 sm:p-6">
          <h2 className="text-section font-semibold">结果网页</h2>
          <BundlePicker bundle={bundle} html={html} setHtml={setHtml} />
        </section>

        <section className="panel space-y-5 p-5 sm:p-6">
          <h2 className="text-section font-semibold">生成方式</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <CatalogInput
              name={FIELDS.model}
              label="模型"
              options={catalog.models}
              value={model}
              onChange={setModel}
              placeholder="Claude Opus 4.5"
              required
              hint={
                logModelHint &&
                (logModelHint.match ? `日志记录：${logModelHint.raw}` : `日志记录：${logModelHint.raw}，目录中暂无对应模型`)
              }
            />
            <CatalogInput
              name={FIELDS.provider}
              label="提供方"
              options={catalog.providers}
              value={provider}
              onChange={setProvider}
              placeholder="官方 API、OpenRouter、某中转站…"
              required
            />
            <CatalogInput
              name={FIELDS.harness}
              label="客户端"
              options={catalog.harnesses}
              value={harness}
              onChange={setHarness}
              placeholder="Claude Code、Cherry Studio…"
            />
            <div>
              <label className="label" htmlFor="reasoning">
                思考强度<span className="ml-1 font-normal text-muted">可选</span>
              </label>
              <select id="reasoning" name={FIELDS.reasoning} className="field" defaultValue="">
                <option value="">未知</option>
                {REASONING_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {REASONING_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="label">增强</legend>
            <div className="flex flex-wrap gap-2">
              {modOptions.map((name) => {
                const on = mods.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleMod(name)}
                    className={`btn h-7 rounded-full border px-3 text-[13px] ${
                      on ? "border-accent bg-accent-soft text-accent-ink" : "border-control bg-surface text-ink hover:bg-raised"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
              <input
                value={customMod}
                onChange={(e) => setCustomMod(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = customMod.trim();
                    if (name && !mods.includes(name)) setMods([...mods, name]);
                    setCustomMod("");
                  }
                }}
                placeholder="其他，回车添加"
                maxLength={30}
                className="field h-7 w-36 rounded-full text-[13px]"
              />
            </div>
            <p className="hint">{mods.length === 0 ? "不选即为 vanilla：只用了模型本身。" : `已选 ${mods.length} 项`}</p>
          </fieldset>

          <fieldset>
            <legend className="label">这份结果是</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={FIELDS.attempt}
                  value="first"
                  checked={attempt === "first"}
                  onChange={() => setAttempt("first")}
                  className="accent-accent"
                />
                第一次生成的
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={FIELDS.attempt}
                  value="picked"
                  checked={attempt === "picked"}
                  onChange={() => setAttempt("picked")}
                  className="accent-accent"
                />
                跑了几次挑出来的
              </label>
              {attempt === "picked" && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  共跑了
                  <input
                    type="number"
                    name={FIELDS.attemptCount}
                    min={2}
                    max={1000}
                    className="field num h-8 w-20"
                  />
                  次
                </label>
              )}
            </div>
            <p className="hint">榜单默认只统计第一次生成的结果。</p>
          </fieldset>

          <div>
            <label className="label" htmlFor="notes">
              备注<span className="ml-1 font-normal text-muted">可选</span>
            </label>
            <textarea
              id="notes"
              name={FIELDS.notes}
              rows={3}
              maxLength={NOTES_LIMIT}
              className="field h-auto py-2"
              placeholder="温度、系统提示词、遇到的问题…"
            />
          </div>
        </section>

        <section className="panel space-y-3 p-5 sm:p-6">
          <div>
            <h2 className="text-section font-semibold">
              Session log<span className="ml-1.5 text-sm font-normal text-muted">可选</span>
            </h2>
            <p className="mt-1 text-sm text-muted">
              支持 Claude Code 与 Codex CLI 的 JSONL 日志。日志在你的浏览器里读取，默认只上传 token 和用时等统计。
            </p>
          </div>
          {log ? (
            <div className="rounded-card border border-border bg-raised p-4">
              <div className="mb-3 flex items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted" strokeWidth={1.75} />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{log.file.name}</div>
                <button
                  type="button"
                  className="btn-ghost size-8 px-0"
                  aria-label="移除日志"
                  onClick={() => {
                    setLog(null);
                    setPublishLog(false);
                  }}
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <LogSummary meta={log.meta} />
              <label className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-sm">
                <input
                  type="checkbox"
                  checked={publishLog}
                  onChange={(e) => setPublishLog(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  同时公开原始日志
                  <span className="block text-xs text-muted">
                    任何人都能下载。日志里可能有本机路径、文件内容和密钥，请先自行检查。
                  </span>
                </span>
              </label>
            </div>
          ) : (
            <div>
              <label className="btn-outline cursor-pointer">
                <FileText className="size-4" strokeWidth={1.75} />
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
        </section>

        {(clientError || serverError) && (
          <p className="text-sm text-negative" role="alert">
            {clientError || serverError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Link to={`/p/${prompt.id}`} className="btn-outline">
            取消
          </Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "上传中…" : "提交"}
          </button>
        </div>
      </form>
    </div>
  );
}
