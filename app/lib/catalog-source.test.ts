import { describe, expect, it } from "vitest";
import {
  selectCatalogModels,
  type ModelsDevCatalog,
  type RemoteModel,
  type RemoteProvider,
} from "./catalog-source";

const NOW = new Date("2026-11-01T00:00:00Z");

const model = (id: string, name: string, extra: Partial<RemoteModel> = {}): RemoteModel => ({
  id,
  name,
  release_date: "2026-06-01",
  modalities: { output: ["text"] },
  ...extra,
});

const provider = (models: RemoteModel[]): RemoteProvider => ({
  id: "test",
  name: "Test",
  models: Object.fromEntries(models.map((m) => [m.id, m])),
});

const catalog = (providers: Record<string, RemoteProvider>): ModelsDevCatalog => providers;

describe("selectCatalogModels", () => {
  it("keeps chat models from the vendor itself and drops its resold models", () => {
    const result = selectCatalogModels(
      catalog({
        alibaba: provider([
          model("qwen3.8-max", "Qwen3.8 Max"),
          model("kimi-k3", "Kimi K3"),
          model("glm-5.3", "GLM-5.3"),
        ]),
        moonshotai: provider([model("kimi-k3", "Kimi K3")]),
      }),
      NOW,
    );

    expect(result.map((m) => m.name)).toContain("Qwen3.8 Max");
    expect(result.map((m) => m.name)).toContain("Kimi K3");
    expect(result.filter((m) => m.name === "Kimi K3")).toHaveLength(1);
    expect(result.map((m) => m.name)).not.toContain("GLM-5.3");
  });

  it("drops non-chat, deprecated, old and aliased models", () => {
    const result = selectCatalogModels(
      catalog({
        openai: provider([
          model("text-embedding-3-large", "text-embedding-3-large"),
          model("gpt-image-2", "GPT Image 2", { type: "image" }),
          model("gpt-4o-mini-tts", "GPT-4o mini TTS", { type: "speech" }),
          model("gpt-4o", "GPT-4o", { release_date: "2024-05-13" }),
          model("gpt-5.2", "GPT-5.2", { status: "deprecated" }),
          model("gpt-daybreak-red-latest", "GPT Daybreak Red", {
            canonical_model_id: "openai/gpt-daybreak-red",
          }),
          model("gpt-6", "GPT-6"),
        ]),
      }),
      NOW,
    );

    expect(result.map((m) => m.name)).toEqual(["GPT-6"]);
  });

  it("collapses speed tiers, free mirrors and patch versions", () => {
    const result = selectCatalogModels(
      catalog({
        minimax: provider([
          model("MiniMax-M3", "MiniMax-M3"),
          model("MiniMax-M3-highspeed", "MiniMax-M3 HighSpeed"),
          model("MiniMax-M3:free", "MiniMax-M3 (free)"),
        ]),
        mistral: provider([
          model("mistral-large-4", "Mistral Large 4"),
          model("mistral-large-4.0.8", "Mistral Large 4.0.8"),
        ]),
      }),
      NOW,
    );

    expect(result.map((m) => m.name)).toEqual(["MiniMax-M3", "Mistral Large 4"]);
  });

  it("cleans provider suffixes and release stamps from names", () => {
    const result = selectCatalogModels(
      catalog({
        anthropic: provider([model("claude-opus-4-5", "Claude Opus 4.5 (latest)")]),
        deepseek: provider([
          model("deepseek-v4.1-flash", "DeepSeek V4.1 Flash 1017", { release_date: "2026-06-02" }),
        ]),
      }),
      NOW,
    );

    expect(result.map((m) => m.name)).toEqual(["DeepSeek V4.1 Flash", "Claude Opus 4.5"]);
    expect(result[1].id).toBe("claude-opus-4.5");
  });

  it("keeps the three newest models per family, newest first", () => {
    const result = selectCatalogModels(
      catalog({
        openai: provider([
          model("gpt-6.1", "GPT-6.1", { release_date: "2026-10-01", family: "gpt" }),
          model("gpt-6", "GPT-6", { release_date: "2026-09-01", family: "gpt" }),
          model("gpt-5.6", "GPT-5.6", { release_date: "2026-07-01", family: "gpt" }),
          model("gpt-5.5", "GPT-5.5", { release_date: "2026-04-01", family: "gpt" }),
          model("gpt-5.4", "GPT-5.4", { release_date: "2026-03-01", family: "gpt" }),
        ]),
      }),
      NOW,
    );

    expect(result.map((m) => m.name)).toEqual(["GPT-6.1", "GPT-6", "GPT-5.6"]);
  });

  it("reads effort levels from the model metadata", () => {
    const result = selectCatalogModels(
      catalog({
        openai: provider([
          model("gpt-effort", "GPT Effort", {
            reasoning: true,
            reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
          }),
          model("gpt-plain", "GPT Plain", { reasoning: false }),
          model("gpt-unknown", "GPT Unknown", { reasoning: true }),
        ]),
      }),
      NOW,
    );

    const byName = Object.fromEntries(result.map((m) => [m.name, m.reasoning]));
    expect(byName["GPT Effort"]).toEqual(["off", "low", "high"]);
    expect(byName["GPT Plain"]).toEqual([]);
    expect(byName["GPT Unknown"]).toBeNull();
  });

  it("prefers the vendor entry when two providers carry the same name", () => {
    const result = selectCatalogModels(
      catalog({
        deepseek: provider([model("deepseek-v4", "DeepSeek V4")]),
        volcengine: provider([model("doubao-deepseek-v4", "DeepSeek V4")]),
        moonshotai: provider([model("kimi-k3", "Kimi K3")]),
      }),
      NOW,
    );

    expect(result.find((m) => m.name === "DeepSeek V4")?.id).toBe("deepseek-v4");
  });

  it("extracts and retains model pricing rates", () => {
    const result = selectCatalogModels(
      catalog({
        openai: provider([
          model("gpt-5", "GPT-5", {
            cost: { input: 2.5, output: 10, cache_read: 1.25, cache_write: 3.75 },
          }),
        ]),
      }),
      NOW,
    );

    const m = result.find((item) => item.name === "GPT-5");
    expect(m?.cost).toEqual({ input: 2.5, output: 10, cache_read: 1.25, cache_write: 3.75 });
  });
});
