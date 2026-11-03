/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LogParseError, parseSessionLog } from "./session-log";
import { decodeSessionLog } from "./session-log-file";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseSessionLog", () => {
  it("counts each Claude Code message once even when split across lines", () => {
    const meta = parseSessionLog(fixture("claude-code.jsonl"));
    expect(meta).toMatchObject({
      source: "claude-code",
      models: ["claude-opus-4-5-20251101"],
      inputTokens: 120,
      outputTokens: 80,
      cacheReadTokens: 2200,
      cacheWriteTokens: 200,
      turns: 1,
      toolCalls: 1,
      durationMs: 60_000,
    });
  });

  it("derives Codex usage from cumulative totals without double counting repeats", () => {
    const meta = parseSessionLog(fixture("codex-legacy.jsonl"));
    expect(meta).toMatchObject({
      source: "codex",
      models: ["gpt-5.1-codex"],
      inputTokens: 700,
      cacheReadTokens: 1800,
      outputTokens: 300,
      reasoningTokens: 90,
      turns: 1,
      toolCalls: 2,
      durationMs: 120_000,
    });
  });

  it("parses modern Codex CLI sessions with item_completed UserMessage events", () => {
    const meta = parseSessionLog(fixture("codex-modern.jsonl"));
    expect(meta).toMatchObject({
      source: "codex",
      models: ["gpt-6.1-sol"],
      inputTokens: 600,
      cacheReadTokens: 1900,
      outputTokens: 300,
      reasoningTokens: 70,
      turns: 2,
      toolCalls: 2,
      durationMs: 50_000,
    });
  });

  it("accumulates multiple Codex turns even when earlier turns lack task_complete", () => {
    const rows = [
      { timestamp: "2026-11-03T07:58:00.000Z", type: "session_meta", payload: { timestamp: "2026-11-03T07:40:00.000Z" } },
      { timestamp: "2026-11-03T07:58:00.100Z", type: "turn_context", payload: { model: "gpt-6-astra", turn_id: "t1" } },
      { timestamp: "2026-11-03T07:58:01.000Z", type: "event_msg", payload: { type: "task_started", turn_id: "t1" } },
      { timestamp: "2026-11-03T07:58:30.000Z", type: "response_item", payload: { turn_id: "t1", type: "custom_tool_call" } },
      { timestamp: "2026-11-03T07:59:00.000Z", type: "event_msg", payload: { type: "task_started", turn_id: "t2" } },
      { timestamp: "2026-11-03T07:59:00.100Z", type: "turn_context", payload: { model: "gpt-6-astra", turn_id: "t2" } },
      { timestamp: "2026-11-03T08:00:00.000Z", type: "event_msg", payload: { type: "task_complete", turn_id: "t2", duration_ms: 60_000 } },
    ];
    const meta = parseSessionLog(rows.map((r) => JSON.stringify(r)).join("\n"));
    expect(meta.turns).toBe(2);
    // t1 spans 07:40:00 to 07:58:30 (18m30s = 1110s), t2 task_complete duration is 60s -> total 1170s = 1,170,000ms
    expect(meta.durationMs).toBe(1_170_000);
  });

  it("prefers per-response records with ids over token_count events", () => {
    const rows = [
      { type: "turn_context", payload: { model: "gpt-5.1" } },
      { type: "token_usage_record", payload: { response_id: "r1", usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3 } } },
      { type: "token_usage_record", payload: { response_id: "r1", usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3 } } },
      { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 999, output_tokens: 999 } } } },
    ];
    const meta = parseSessionLog(rows.map((r) => JSON.stringify(r)).join("\n"));
    expect(meta).toMatchObject({ inputTokens: 6, cacheReadTokens: 4, outputTokens: 3 });
  });

  it("reads pi sessions, preferring the served model over the route name", () => {
    const meta = parseSessionLog(fixture("pi.jsonl"));
    expect(meta).toMatchObject({
      source: "pi",
      models: ["claude-opus-4-5-20251101"],
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 1000,
      cacheWriteTokens: 200,
      reasoningTokens: 10,
      turns: 1,
      toolCalls: 1,
      durationMs: 60_000,
    });
  });

  it("counts only real user turns in DSH sessions", () => {
    const meta = parseSessionLog(fixture("dsh.jsonl"));
    expect(meta).toMatchObject({
      source: "dsh",
      models: ["deepseek-v4-flash-0731"],
      inputTokens: 100,
      outputTokens: 40,
      cacheReadTokens: 900,
      turns: 1,
      toolCalls: 1,
      durationMs: 60_000,
    });
  });

  it("reads opencode's exported JSON document", () => {
    const meta = parseSessionLog(fixture("opencode.json"));
    expect(meta).toMatchObject({
      source: "opencode",
      models: ["gpt-5.1"],
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 4000,
      reasoningTokens: 80,
      turns: 1,
      toolCalls: 1,
      durationMs: 60_000,
    });
  });

  it("unpacks DSH's zstd logs before parsing", () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("./__fixtures__/dsh.jsonl.zstd", import.meta.url)),
    );
    expect(parseSessionLog(decodeSessionLog(bytes))).toMatchObject({
      source: "dsh",
      inputTokens: 100,
      turns: 1,
    });
  });

  it("rejects files that are not a known log format", () => {
    expect(() => parseSessionLog('{"hello":"world"}\nnot json')).toThrow(LogParseError);
  });
});
