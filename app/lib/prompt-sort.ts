/** Sort vocabulary shared by the gallery, its continuation API and the loader. */
export const PROMPT_SORTS = ["latest", "new", "answers", "hardest"] as const;
export type PromptSort = (typeof PROMPT_SORTS)[number];
export const DEFAULT_PROMPT_SORT: PromptSort = "latest";
export const isPromptSort = (value: unknown): value is PromptSort =>
  typeof value === "string" && (PROMPT_SORTS as readonly string[]).includes(value);
