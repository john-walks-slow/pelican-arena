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

export const LOG_SOURCES = ["claude-code", "codex", "pi", "dsh", "opencode"] as const;

export type LogSource = (typeof LOG_SOURCES)[number];

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  "claude-code": "Claude Code",
  codex: "Codex CLI",
  pi: "pi",
  dsh: "DSH",
  opencode: "OpenCode",
};

export function isLogSource(value: unknown): value is LogSource {
  return typeof value === "string" && (LOG_SOURCES as readonly string[]).includes(value);
}

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

const toTime = (t: unknown): number => {
  if (typeof t === "number") return Number.isFinite(t) ? t : NaN;
  if (typeof t === "string" && t) return Date.parse(t);
  return NaN;
};

function spanMs(timestamps: unknown[]): number | null {
  const times = timestamps.map(toTime).filter((t) => !Number.isNaN(t));
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
  const turnIds = new Set<string>();
  let userTurns = 0;

  for (const row of rows) {
    const payload = row.payload ?? {};
    if (row.type === "turn_context") {
      if (payload.model) models.add(payload.model);
      if (payload.turn_id) turnIds.add(payload.turn_id);
    }
    if (row.type === "event_msg") {
      if (payload.type === "task_started" && payload.turn_id) {
        turnIds.add(payload.turn_id);
      }
      if (
        payload.type === "user_message" ||
        (payload.type === "item_completed" && payload.item?.type === "UserMessage")
      ) {
        userTurns += 1;
      }
    }
    if (
      row.type === "response_item" &&
      (payload.type === "function_call" || payload.type === "custom_tool_call")
    ) {
      meta.toolCalls += 1;
    }
  }

  meta.turns = userTurns > 0 ? userTurns : turnIds.size;

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

interface PiUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
}

/** pi appends one line per message; a session also holds model and thinking changes. */
function parsePi(rows: Json[]): LogMeta {
  const meta = emptyMeta("pi");
  const models = new Set<string>();
  const times: unknown[] = [];

  for (const row of rows) {
    if (row.type !== "message") continue;
    const message = row.message ?? {};
    times.push(message.timestamp ?? row.timestamp);
    const content = Array.isArray(message.content) ? message.content : [];

    if (message.role === "user") {
      meta.turns += 1;
      continue;
    }
    if (message.role !== "assistant") continue;

    // responseModel is the model actually served; model may only be the route name.
    const model = message.responseModel ?? message.model;
    if (model) models.add(model);
    for (const block of content) {
      if (block?.type === "toolCall") meta.toolCalls += 1;
    }
    const usage: PiUsage = message.usage ?? {};
    meta.inputTokens += num(usage.input);
    meta.outputTokens += num(usage.output);
    meta.cacheReadTokens += num(usage.cacheRead);
    meta.cacheWriteTokens += num(usage.cacheWrite);
    meta.reasoningTokens += num(usage.reasoning);
  }

  meta.models = [...models];
  meta.durationMs = spanMs(times);
  return meta;
}

interface DshUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

/** DSH persists one JSONL record per session event, compressed with zstd by default. */
function parseDsh(rows: Json[]): LogMeta {
  const meta = emptyMeta("dsh");
  const models = new Set<string>();
  const times: unknown[] = [];

  for (const row of rows) {
    times.push(row.time);
    const data = row.data ?? {};
    if (row.type === "user/message" && data.source?.kind === "user") meta.turns += 1;
    if (row.type === "tool/call") meta.toolCalls += 1;
    if (row.type !== "assistant/message") continue;

    const source = data.message?.source ?? {};
    const model = source.replayState?.response?.responseModel ?? source.model;
    if (model) models.add(model);
    const usage: DshUsage = data.usage ?? {};
    meta.inputTokens += num(usage.inputTokens);
    meta.outputTokens += num(usage.outputTokens);
    meta.cacheReadTokens += num(usage.cacheReadTokens);
    meta.cacheWriteTokens += num(usage.cacheWriteTokens);
    meta.reasoningTokens += num(usage.reasoningTokens);
  }

  meta.models = [...models];
  meta.durationMs = spanMs(times);
  return meta;
}

/** opencode exports one JSON document: session info plus every message and part. */
function parseOpencode(exported: Json): LogMeta {
  const meta = emptyMeta("opencode");
  const info = exported.info ?? {};
  const messages: Json[] = Array.isArray(exported.messages) ? exported.messages : [];
  const models = new Set<string>();
  const times: unknown[] = [];

  if (info.model?.id) models.add(String(info.model.id));
  for (const message of messages) {
    const messageInfo = message?.info ?? {};
    times.push(messageInfo.time?.created, messageInfo.time?.completed);
    if (messageInfo.role === "user") meta.turns += 1;
    if (messageInfo.role !== "assistant") continue;
    if (messageInfo.modelID) models.add(String(messageInfo.modelID));
    for (const part of message?.parts ?? []) {
      if (part?.type === "tool") meta.toolCalls += 1;
    }
  }

  const tokens = info.tokens ?? {};
  meta.inputTokens = num(tokens.input);
  meta.outputTokens = num(tokens.output);
  meta.reasoningTokens = num(tokens.reasoning);
  meta.cacheReadTokens = num(tokens.cache?.read);
  meta.cacheWriteTokens = num(tokens.cache?.write);
  meta.models = [...models];
  meta.durationMs = spanMs(times.length > 1 ? times : [info.time?.created, info.time?.updated]);
  return meta;
}

function detectSource(rows: Json[]): LogSource | null {
  if (
    rows.some(
      (r) =>
        r.type === "assistant/message" ||
        r.type === "user/message" ||
        r.type === "turn/start" ||
        r.type === "tool/call",
    )
  ) {
    return "dsh";
  }
  if (rows.some((r) => r.type === "message" && r.message?.role)) return "pi";
  if (rows.some((r) => r.type === "session_meta" || r.type === "turn_context")) {
    return "codex";
  }
  if (rows.some((r) => r.type === "assistant" && r.message?.role === "assistant")) {
    return "claude-code";
  }
  return null;
}

export class LogParseError extends Error {}

function parseOpencodeDocument(text: string): LogMeta | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  let document: Json;
  try {
    document = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!document.info || !Array.isArray(document.messages)) return null;
  return parseOpencode(document);
}

export function parseSessionLog(text: string): LogMeta {
  const opencode = parseOpencodeDocument(text);
  if (opencode) return opencode;

  const rows = parseLines(text);
  const source = detectSource(rows);
  if (!source) {
    throw new LogParseError(
      "无法识别日志格式。支持 Claude Code、Codex CLI、pi、DSH 与 opencode 导出的日志",
    );
  }
  switch (source) {
    case "codex":
      return parseCodex(rows);
    case "pi":
      return parsePi(rows);
    case "dsh":
      return parseDsh(rows);
    default:
      return parseClaudeCode(rows);
  }
}

export function totalTokens(meta: LogMeta): number {
  return meta.inputTokens + meta.outputTokens + meta.cacheReadTokens + meta.cacheWriteTokens;
}
