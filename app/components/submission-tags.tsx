import type { CatalogEntry } from "~/lib/catalog";

/** The mod badges, or "vanilla" when the run had none. */
export function ModTags({ mods }: { mods: CatalogEntry[] }) {
  if (mods.length === 0) {
    return (
      <span className="inline-flex h-5 items-center rounded-full border border-border bg-raised/60 px-2 text-[11px] font-medium text-muted">
        vanilla
      </span>
    );
  }
  return (
    <>
      {mods.map((m) => (
        <span
          key={m.id}
          className="inline-flex h-5 items-center rounded-full border border-accent/20 bg-accent-soft px-2 text-[11px] font-medium text-accent-ink"
        >
          {m.name}
        </span>
      ))}
    </>
  );
}
