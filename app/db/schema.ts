import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { BundleFile } from "~/lib/bundle";
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
    status: text("status", { enum: ["active", "hidden"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("prompts_created_idx").on(t.createdAt)],
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

export const REASONING_LEVELS = ["off", "low", "medium", "high"] as const;
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
    /** "first": submitted as generated; "picked": best of several runs. */
    attempt: text("attempt", { enum: ["first", "picked"] }).notNull(),
    attemptCount: integer("attempt_count"),
    files: text("files", { mode: "json" }).$type<BundleFile[]>().notNull(),
    totalBytes: integer("total_bytes").notNull(),
    notes: text("notes"),
    logMeta: text("log_meta", { mode: "json" }).$type<LogMeta>(),
    hasRawLog: integer("has_raw_log", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: ["active", "hidden"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("submissions_prompt_idx").on(t.promptId),
    index("submissions_author_idx").on(t.authorId, t.createdAt),
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
  (t) => [primaryKey({ columns: [t.submissionId, t.modId] })],
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
    stars: integer("stars").notNull(),
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
