import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { BundleFile } from "~/lib/bundle";
import { PROMPT_KINDS } from "../lib/kinds";
import type { LogMeta } from "~/lib/session-log";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** Forum account, keyed by the immutable Linux DO user id. */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  name: text("name"),
  avatarTemplate: text("avatar_template"),
  trustLevel: integer("trust_level").notNull().default(0),
  silenced: integer("silenced", { mode: "boolean" }).notNull().default(false),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
});

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind", { enum: PROMPT_KINDS }).notNull().default("web"),
    status: text("status", { enum: ["active", "hidden"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("prompts_created_idx").on(t.createdAt),
    index("prompts_kind_created_idx").on(t.kind, t.createdAt),
  ],
);

/** Catalog tables share one shape: a slug id derived from the display name. */
const catalog = <TName extends string>(name: TName) =>
  sqliteTable(name, {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  });

export const models = catalog("models");
export const providers = catalog("providers");
export const harnesses = catalog("harnesses");
export const mods = catalog("mods");

export const REASONING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "auto",
] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompts.id),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id),
    harnessId: text("harness_id").references(() => harnesses.id),
    reasoning: text("reasoning", { enum: REASONING_LEVELS }),
    files: text("files", { mode: "json" }).$type<BundleFile[]>().notNull(),
    totalBytes: integer("total_bytes").notNull(),
    notes: text("notes"),
    /** Full Markdown source, kept in D1 so galleries and detail pages render without R2 reads. */
    content: text("content"),
    logMeta: text("log_meta", { mode: "json" }).$type<LogMeta>(),
    hasRawLog: integer("has_raw_log", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: ["active", "hidden"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("submissions_prompt_idx").on(t.promptId),
    index("submissions_author_idx").on(t.authorId, t.createdAt),
    index("submissions_model_idx").on(t.modelId),
    index("submissions_provider_idx").on(t.providerId),
    index("submissions_harness_idx").on(t.harnessId),
  ],
);

export const submissionMods = sqliteTable(
  "submission_mods",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id),
    modId: text("mod_id")
      .notNull()
      .references(() => mods.id),
  },
  (t) => [
    primaryKey({ columns: [t.submissionId, t.modId] }),
    index("submission_mods_mod_idx").on(t.modId),
  ],
);

export const ratings = sqliteTable(
  "ratings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id),
    stars: real("stars").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.submissionId] }),
    index("ratings_submission_idx").on(t.submissionId),
  ],
);

export type User = typeof users.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
