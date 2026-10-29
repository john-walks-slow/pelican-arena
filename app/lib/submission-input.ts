import { REASONING_LEVELS, type ReasoningLevel } from "~/db/schema";
import { isLogSource, type LogMeta } from "./session-log";

/** Form field names shared by the submit page and its action. */
export const FIELDS = {
  file: "file",
  model: "model",
  provider: "provider",
  harness: "harness",
  mods: "mods",
  reasoning: "reasoning",
  notes: "notes",
  logMeta: "logMeta",
  rawLog: "rawLog",
} as const;

export const NOTES_LIMIT = 1000;
export const RAW_LOG_LIMIT = 20 * 1024 * 1024;

export interface SubmissionMeta {
  model: string;
  provider: string;
  harness: string | null;
  mods: string[];
  reasoning: ReasoningLevel | null;
  notes: string | null;
  logMeta: LogMeta | null;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export function parseSubmissionMeta(form: FormData): { meta?: SubmissionMeta; error?: string } {
  const model = text(form, FIELDS.model);
  const provider = text(form, FIELDS.provider);
  if (!model) return { error: "请填写模型" };
  if (!provider) return { error: "请填写提供方" };

  const reasoning = text(form, FIELDS.reasoning);
  const notes = text(form, FIELDS.notes);
  if (notes.length > NOTES_LIMIT) return { error: `备注最多 ${NOTES_LIMIT} 字` };

  let logMeta: LogMeta | null = null;
  const rawMeta = text(form, FIELDS.logMeta);
  if (rawMeta) {
    try {
      logMeta = sanitizeLogMeta(JSON.parse(rawMeta));
    } catch {
      return { error: "日志信息格式错误" };
    }
  }

  const mods = [
    ...new Set(
      form
        .getAll(FIELDS.mods)
        .map((m) => String(m).trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);

  return {
    meta: {
      model,
      provider,
      harness: text(form, FIELDS.harness) || null,
      mods,
      reasoning: (REASONING_LEVELS as readonly string[]).includes(reasoning)
        ? (reasoning as ReasoningLevel)
        : null,
      notes: notes || null,
      logMeta,
    },
  };
}

const count = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;

/** Log metadata comes from the browser, so only known numeric fields are kept. */
function sanitizeLogMeta(raw: any): LogMeta {
  if (!isLogSource(raw?.source)) throw new Error("source");
  return {
    source: raw.source,
    models: Array.isArray(raw.models)
      ? raw.models.filter((m: unknown) => typeof m === "string").map((m: string) => m.slice(0, 100)).slice(0, 10)
      : [],
    inputTokens: count(raw.inputTokens),
    outputTokens: count(raw.outputTokens),
    cacheReadTokens: count(raw.cacheReadTokens),
    cacheWriteTokens: count(raw.cacheWriteTokens),
    reasoningTokens: count(raw.reasoningTokens),
    durationMs: raw.durationMs == null ? null : count(raw.durationMs),
    turns: count(raw.turns),
    toolCalls: count(raw.toolCalls),
  };
}
