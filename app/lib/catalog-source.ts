import { slugify } from "./ids";

/** The subset of models.dev/api.json that the catalog reads. */
export interface RemoteModel {
  id: string;
  name: string;
  family?: string;
  type?: string;
  status?: string;
  canonical_model_id?: string;
  release_date?: string;
  modalities?: { output?: string[] };
  reasoning?: boolean;
  reasoning_options?: Array<{ type: string; values?: string[] }>;
}

export interface RemoteProvider {
  id: string;
  name: string;
  models?: Record<string, RemoteModel>;
}

export type ModelsDevCatalog = Record<string, RemoteProvider>;

export interface CatalogModel {
  id: string;
  name: string;
  family: string | null;
  releaseDate: string;
  /** Effort levels the model advertises; null when the source has no answer. */
  reasoning: string[] | null;
}

export const CATALOG_SOURCE_URL = "https://models.dev/api.json";

/**
 * Providers we trust for model names, in priority order. The regex keeps only
 * the vendor's own models: Alibaba and Volcengine also host Kimi/GLM, which are
 * already covered by the original vendor and would show up as duplicates.
 */
const PROVIDER_FAMILIES: Record<string, RegExp | null> = {
  openai: null,
  anthropic: /^claude/i,
  google: /^(gemini|gemma)/i,
  xai: /^grok/i,
  mistral: /^(mistral|codestral|ministral|devstral|magistral)/i,
  meta: /^(llama|meta)/i,
  deepseek: /^deepseek/i,
  moonshotai: /^kimi/i,
  "moonshotai-cn": /^kimi/i,
  zhipuai: /^glm/i,
  zai: /^glm/i,
  alibaba: /^qwen/i,
  "alibaba-cn": /^qwen/i,
  minimax: /^minimax/i,
  "minimax-cn": /^minimax/i,
  volcengine: /^(doubao|seed)/i,
  stepfun: /^step/i,
  "stepfun-ai": /^step/i,
};

/** Non-chat modalities leak into the feed without a `type`, so match their names too. */
const NON_CHAT = /(embed|rerank|tts|whisper|transcri|imagen|dall-?e|sora|veo|lyria|nano-?banana|audio|realtime|moderation|voice|voxtral|image)/i;

/** Speed tiers and free mirrors are the same model, not another entry. */
const VARIANT = /(-highspeed|-fast|:free)$/i;

/** Aliases that point at another model and would duplicate it in the picker. */
const ALIAS_NAME = /\b(latest|custom tools|computer use)\b/i;

/** Patch bumps like "Mistral Large 4.0.8" are the same model as the minor release. */
const PATCH_NAME = /\b\d+\.\d+\.\d+\b/;

const MONTHS = 24;

/** Same order as REASONING_LEVELS in the schema. */
const REASONING_ORDER = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

const REASONING_ALIASES: Record<string, string> = { none: "off", default: "auto" };

function selectReasoning(model: RemoteModel): string[] | null {
  if (model.reasoning === false) return [];
  const effort = model.reasoning_options?.find((option) => option.type === "effort");
  if (!effort?.values?.length) return null;
  const levels = effort.values
    .map((value) => REASONING_ALIASES[value] ?? value)
    .filter((value) => REASONING_ORDER.includes(value));
  return [...new Set(levels)].sort(
    (a, b) => REASONING_ORDER.indexOf(a) - REASONING_ORDER.indexOf(b),
  );
}

function isChatModel(model: RemoteModel) {
  if (model.status === "deprecated") return false;
  if (model.type && model.type !== "chat") return false;
  const output = model.modalities?.output ?? ["text"];
  return output.includes("text");
}

/** "Claude Opus 4.5 (latest)" and "DeepSeek V4.1 Flash 1017" name the same model. */
function cleanName(name: string) {
  return name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+\d{4}$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAlias(model: RemoteModel) {
  if (!/-latest$/i.test(model.id)) return false;
  if (!model.canonical_model_id) return true;
  return !model.canonical_model_id.endsWith(`/${model.id}`);
}

/** Older than 24 months: still usable, but not what the picker should lead with. */
function cutoffDate(now: Date) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - MONTHS);
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Turns the models.dev feed into the models people actually use in the arena:
 * current chat models from the vendors themselves, newest first.
 */
export function selectCatalogModels(
  catalog: ModelsDevCatalog,
  now = new Date(),
): CatalogModel[] {
  const cutoff = cutoffDate(now);
  const candidates: CatalogModel[] = [];

  for (const [providerId, familyPattern] of Object.entries(PROVIDER_FAMILIES)) {
    const provider = catalog[providerId];
    if (!provider?.models) continue;

    for (const model of Object.values(provider.models)) {
      if (!isChatModel(model)) continue;
      if (!model.release_date || model.release_date < cutoff) continue;
      if (VARIANT.test(model.id)) continue;
      if (isAlias(model)) continue;

      const name = cleanName(model.name);
      if (!name || name.includes("/")) continue;
      if (ALIAS_NAME.test(name) || PATCH_NAME.test(name)) continue;

      const family = model.family ?? "";
      if (NON_CHAT.test(`${model.id} ${name} ${family}`)) continue;
      if (familyPattern && !familyPattern.test(name)) continue;

      candidates.push({
        id: slugify(name),
        name,
        family: model.family ?? null,
        releaseDate: model.release_date,
        reasoning: selectReasoning(model),
      });
    }
  }

  const byName = new Map<string, CatalogModel>();
  for (const model of candidates) {
    const key = model.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, model);
  }

  const byFamily = new Map<string, CatalogModel[]>();
  for (const model of byName.values()) {
    const key = (model.family ?? model.name).toLowerCase();
    const list = byFamily.get(key) ?? [];
    list.push(model);
    byFamily.set(key, list);
  }

  const newestFirst = (a: CatalogModel, b: CatalogModel) =>
    b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name);

  const capped = [...byFamily.values()].flatMap((list) => list.sort(newestFirst).slice(0, 3));

  const byId = new Map<string, CatalogModel>();
  for (const model of capped.sort(newestFirst)) {
    if (!byId.has(model.id)) byId.set(model.id, model);
  }

  return [...byId.values()].sort(newestFirst);
}
