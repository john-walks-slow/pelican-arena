import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { models } from "~/db/schema";
import {
  CATALOG_SOURCE_URL,
  selectCatalogModels,
  type ModelsDevCatalog,
} from "./catalog-source";

/** Keeps each INSERT well under D1's bound-parameter limit. */
const CHUNK = 40;

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

  await db()
    .update(models)
    .set({ hidden: true })
    .where(
      and(
        eq(models.source, "models.dev"),
        notInArray(
          models.id,
          selected.map((model) => model.id),
        ),
      ),
    );

  return selected.length;
}
