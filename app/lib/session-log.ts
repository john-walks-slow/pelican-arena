/**
 * Extracts usage metadata from agent session logs, in the browser, so the raw
 * log (which may hold paths and secrets) never has to leave the machine.
 */

export interface LogMeta {
  source: LogSource;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  durationMs: number | null;
  turns: number;
  toolCalls: number;
}

export type LogSource = "claude-code" | "codex";

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  "claude-code": "Claude Code",
  codex: "Codex CLI",
};

type Json = Record<string, any>;

function parseLines(text: string): Json[] {
  const rows: Json[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // Logs written by a crashed process can end in a partial line.
    }
  }
  return rows;
}

function spanMs(timestamps: (string | undefined)[]): number | null {
  const times = timestamps
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((t) => !Number.isNaN(t));
  if (times.length < 2) return null;
  return Math.max(...times) - Math.min(...times);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function emptyMeta(source: LogSource): LogMeta {
  return {
    source,
    models: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    durationMs: null,
    turns: 0,
    toolCalls: 0,
  };
}

/** Claude Code writes one line per content block, each repeating the message usage. */
function parseClaudeCode(rows: Json[]): LogMeta {
  const meta = emptyMeta("claude-code");
  const seen = new Set<string>();
  const models = new Set<string>();

  for (const row of rows) {
    if (row.type === "user" && !row.isMeta && !row.isSidechain) {
      const content = row.message?.content;
      const isToolResult =
        Array.isArray(content) && content.some((c: Json) => c?.type === "tool_result");
      if (!isToolResult) meta.turns += 1;
    }
    if (row.type !== "assistant") continue;
    const message = row.message ?? {};
    for (const block of message.content ?? []) {
      if (block?.type === "tool_use") meta.toolCalls += 1;
    }
    const key = message.id ?? row.requestId ?? row.uuid;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (message.model && message.model !== "<synthetic>") models.add(message.model);
    const usage = message.usage ?? {};
    meta.inputTokens += num(usage.input_tokens);
    meta.outputTokens += num(usage.output_tokens);
    meta.cacheReadTokens += num(usage.cache_read_input_tokens);
    meta.cacheWriteTokens += num(usage.cache_creation_input_tokens);
    meta.reasoningTokens += num(usage.output_tokens_details?.thinking_tokens);
  }

  meta.models = [...models];
  meta.durationMs = spanMs(
    rows
      .filter((r) => (r.type === "user" || r.type === "assistant") && !r.isMeta)
      .map((r) => r.timestamp),
  );
  return meta;
}

interface CodexUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

/** Codex input_tokens include the cached part; split them like the other sources. */
function addCodexUsage(meta: LogMeta, usage: CodexUsage, sign = 1) {
  const cached = num(usage.cached_input_tokens);
  meta.inputTokens += sign * (num(usage.input_tokens) - cached);
  meta.cacheReadTokens += sign * cached;
  meta.outputTokens += sign * num(usage.output_tokens);
  meta.reasoningTokens += sign * num(usage.reasoning_output_tokens);
}

function parseCodex(rows: Json[]): LogMeta {
  const meta = emptyMeta("codex");
  const models = new Set<string>();
  const records = rows.filter((r) => r.type === "token_usage_record");

  for (const row of rows) {
    const payload = row.payload ?? {};
    if (row.type === "turn_context" && payload.model) models.add(payload.model);
    if (row.type === "event_msg" && payload.type === "user_message") meta.turns += 1;
    if (
      row.type === "response_item" &&
      (payload.type === "function_call" || payload.type === "custom_tool_call")
    ) {
      meta.toolCalls += 1;
    }
  }

  if (records.length > 0) {
    const seen = new Set<string>();
    for (const row of records) {
      const id = row.payload?.response_id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      addCodexUsage(meta, row.payload?.usage ?? {});
    }
  } else {
    // Older rollouts only carry cumulative token_count events, reset on resume.
    let previous: CodexUsage | null = null;
    for (const row of rows) {
      const info = row.type === "event_msg" && row.payload?.type === "token_count"
        ? row.payload.info
        : null;
      const total: CodexUsage | undefined = info?.total_token_usage;
      if (!total) continue;
      if (previous && num(total.input_tokens) >= num(previous.input_tokens)) {
        addCodexUsage(meta, total);
        addCodexUsage(meta, previous, -1);
      } else {
        addCodexUsage(meta, total);
      }
      previous = total;
    }
  }

  meta.models = [...models];
  meta.durationMs = spanMs(rows.map((r) => r.timestamp));
  return meta;
}

function detectSource(rows: Json[]): LogSource | null {
  if (rows.some((r) => r.type === "session_meta" || r.type === "turn_context")) {
    return "codex";
  }
  if (rows.some((r) => r.type === "assistant" && r.message?.role === "assistant")) {
    return "claude-code";
  }
  return null;
}

export class LogParseError extends Error {}

export function parseSessionLog(text: string): LogMeta {
  const rows = parseLines(text);
  const source = detectSource(rows);
  if (!source) {
    throw new LogParseError("无法识别日志格式，目前支持 Claude Code 与 Codex CLI 的 JSONL 日志");
  }
  return source === "codex" ? parseCodex(rows) : parseClaudeCode(rows);
}

export function totalTokens(meta: LogMeta): number {
  return meta.inputTokens + meta.outputTokens + meta.cacheReadTokens + meta.cacheWriteTokens;
}
