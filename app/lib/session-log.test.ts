/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LogParseError, parseSessionLog } from "./session-log";

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

  it("rejects files that are not a known log format", () => {
    expect(() => parseSessionLog('{"hello":"world"}\nnot json')).toThrow(LogParseError);
  });
});
