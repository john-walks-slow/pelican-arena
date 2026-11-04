import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { models } from "~/db/schema";
import {
  CATALOG_SOURCE_URL,
  selectCatalogModels,
  type ModelsDevCatalog,
} from "./catalog-source";

/** D1 allows at most 100 bound parameters per statement. Each row uses 9. */
const CHUNK = 10;

/**
 * Replaces the synced part of the model catalog with what models.dev publishes.
 * Missing entries are hidden rather than deleted, so old submissions still resolve.
 */
export async function syncModelCatalog() {
  const response = await fetch(CATALOG_SOURCE_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`models.dev 返回 ${response.status}`);

  const selected = selectCatalogModels((await response.json()) as ModelsDevCatalog);
  if (selected.length < 20) throw new Error("模型源返回的数据过少，已跳过同步");

  const syncedAt = new Date();

  // Upsert first so a failed sync leaves the previous catalog visible. Marking
  // stale entries afterwards also avoids D1's 100 bound-parameter limit on a
  // `notInArray(selectedIds)` query.
  for (let i = 0; i < selected.length; i += CHUNK) {
    const rows = selected.slice(i, i + CHUNK).map((model) => ({
      ...model,
      reasoning: model.reasoning ? JSON.stringify(model.reasoning) : null,
      cost: model.cost ?? null,
      source: "models.dev",
      hidden: false,
      syncedAt,
    }));
    await db()
      .insert(models)
      .values(rows)
      .onConflictDoUpdate({
        target: models.id,
        set: {
          name: sql`excluded.name`,
          family: sql`excluded.family`,
          releaseDate: sql`excluded.release_date`,
          reasoning: sql`excluded.reasoning`,
          cost: sql`excluded.cost`,
          source: "models.dev",
          hidden: false,
          syncedAt,
        },
      });
  }

  // Anything from an earlier sync that was not refreshed above is stale.
  // Models are hidden rather than deleted so historical answers still resolve.
  await db()
    .update(models)
    .set({ hidden: true })
    .where(
      and(
        eq(models.source, "models.dev"),
        or(isNull(models.syncedAt), lt(models.syncedAt, syncedAt)),
      ),
    );

  return selected.length;
}
