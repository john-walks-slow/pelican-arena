export type CatalogKind = "models" | "providers" | "harnesses" | "mods";

export interface CatalogEntry {
  id: string;
  name: string;
  /** Providers only: groups the picker by how the channel is obtained. */
  category?: string;
}

export type Catalog = Record<CatalogKind, CatalogEntry[]>;

/** Provider groups shown as headings in the picker, in display order. */
export const PROVIDER_CATEGORIES = [
  { id: "official", label: "官方订阅与 API" },
  { id: "coding", label: "编码套餐" },
  { id: "cloud", label: "云平台" },
  { id: "gateway", label: "聚合与中转" },
  { id: "free", label: "免费额度" },
  { id: "student", label: "学生优惠" },
  { id: "consumer", label: "消费级入口" },
  { id: "community", label: "社区渠道" },
  { id: "local", label: "本地与自建" },
  { id: "trial", label: "云厂商试用" },
  { id: "other", label: "其他" },
] as const;

export function providerCategoryLabel(category?: string) {
  return PROVIDER_CATEGORIES.find((c) => c.id === category)?.label ?? "其他";
}
