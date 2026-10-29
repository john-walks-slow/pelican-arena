import type { CatalogEntry } from "~/lib/catalog";

/** The mod badges, or "vanilla" when the run had none. */
export function ModTags({ mods }: { mods: CatalogEntry[] }) {
  if (mods.length === 0) return <span className="pill-neutral">vanilla</span>;
  return (
    <>
      {mods.map((m) => (
        <span key={m.id} className="pill-accent">
          {m.name}
        </span>
      ))}
    </>
  );
}

export function AttemptTag({ attempt, count }: { attempt: "first" | "picked"; count: number | null }) {
  if (attempt === "first") return null;
  return <span className="pill-warning">{count ? `${count} 选 1` : "挑选过"}</span>;
}
