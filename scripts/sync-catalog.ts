import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATALOG_SOURCE_URL,
  selectCatalogModels,
  type ModelsDevCatalog,
} from "../app/lib/catalog-source";

/**
 * Writes the model catalog as SQL. Used to bootstrap a fresh database and to
 * push a sync by hand when the daily Worker cron has not run yet.
 *
 *   npm run catalog:sql                 # print INSERT OR IGNORE statements
 *   npm run catalog:sync -- --local     # apply to the local D1
 *   npm run catalog:sync -- --remote    # apply to the deployed D1
 */
const args = new Set(process.argv.slice(2));
const apply = args.has("--local") || args.has("--remote");

const response = await fetch(CATALOG_SOURCE_URL, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`models.dev 返回 ${response.status}`);

const selected = selectCatalogModels((await response.json()) as ModelsDevCatalog);
if (selected.length < 20) throw new Error("模型源返回的数据过少，已跳过同步");

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const values = selected
  .map(
    (model) =>
      `  (${quote(model.id)}, ${quote(model.name)}, ${quote(model.family ?? "")}, ${quote(model.releaseDate)}, ${model.cost ? quote(JSON.stringify(model.cost)) : "NULL"}, 'models.dev')`,
  )
  .join(",\n");

const sql = `INSERT INTO \`models\` (\`id\`, \`name\`, \`family\`, \`release_date\`, \`cost\`, \`source\`) VALUES
${values}
ON CONFLICT(\`id\`) DO UPDATE SET
  \`cost\` = excluded.\`cost\`,
  \`family\` = excluded.\`family\`,
  \`release_date\` = excluded.\`release_date\`;
`;

if (!apply) {
  process.stdout.write(sql);
  process.exit(0);
}

const root = join(import.meta.dirname, "..");
const file = join(root, "tmp", "catalog-sync.sql");
mkdirSync(join(root, "tmp"), { recursive: true });
writeFileSync(file, sql);

const target = args.has("--remote") ? "--remote" : "--local";
const result = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pelican-arena-apac", target, `--file=${file}`],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 1);
