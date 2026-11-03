import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { BundleFile } from "~/lib/bundle";
import { PROMPT_KINDS } from "../lib/kinds";
import {
  MODERATION_ACTIONS,
  PROMPT_STATUSES,
  REPORT_REASON_IDS,
  REPORT_STATUSES,
  REPORT_TARGETS,
  SUBMISSION_STATUSES,
} from "../lib/moderation";
import type { ModelCost } from "~/lib/cost";
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
  rulesAcceptedAt: integer("rules_accepted_at", { mode: "timestamp_ms" }),
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
    allowSearch: integer("allow_search", { mode: "boolean" }).notNull().default(false),
    allowLibraries: integer("allow_libraries", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: PROMPT_STATUSES })
      .notNull()
      .default("active"),
    /** Latest moderation reason, shown to the author. */
    moderationNote: text("moderation_note"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("prompts_created_idx").on(t.createdAt),
    index("prompts_kind_created_idx").on(t.kind, t.createdAt),
    index("prompts_status_created_idx").on(t.status, t.createdAt),
  ],
);

/** Catalog tables share one shape: a slug id derived from the display name. */
const catalog = <TName extends string>(name: TName) =>
  sqliteTable(name, {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  });

/** Models are synced from models.dev; see `app/lib/catalog-source.ts`. */
export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  family: text("family"),
  releaseDate: text("release_date"),
  /** JSON array of supported effort levels; null when the source is silent. */
  reasoning: text("reasoning"),
  /** Model pricing per 1M tokens from models.dev; null for manual entries. */
  cost: text("cost", { mode: "json" }).$type<ModelCost>(),
  source: text("source").notNull().default("manual"),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

/** Providers are curated: rank keeps the picker ordered by how people actually use them. */
export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rank: integer("rank").notNull().default(1000),
  /** Kept for grouping in the data; the picker shows one flat, curated list. */
  category: text("category").notNull().default("other"),
  createdAt: createdAt(),
});

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
    kind: text("kind", { enum: PROMPT_KINDS }).notNull().default("web"),
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
    status: text("status", { enum: SUBMISSION_STATUSES })
      .notNull()
      .default("active"),
    moderationNote: text("moderation_note"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("submissions_prompt_idx").on(t.promptId),
    index("submissions_author_idx").on(t.authorId, t.createdAt),
    index("submissions_model_idx").on(t.modelId),
    index("submissions_provider_idx").on(t.providerId),
    index("submissions_harness_idx").on(t.harnessId),
    index("submissions_status_kind_idx").on(t.status, t.kind),
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
    /** Set when the vote is first cast; edits keep the original time. */
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.submissionId] }),
    index("ratings_submission_idx").on(t.submissionId),
    index("ratings_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Reports on either a prompt or an answer; the target decides what is checked. */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type", { enum: REPORT_TARGETS }).notNull(),
    targetId: text("target_id").notNull(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason", { enum: REPORT_REASON_IDS }).notNull(),
    note: text("note"),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("reports_unique").on(t.targetType, t.targetId, t.reporterId),
    index("reports_open_idx").on(t.status, t.createdAt),
    index("reports_reporter_idx").on(t.reporterId, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
  ],
);

/** Bearer tokens for automated moderators; only the SHA-256 of the secret is stored. */
export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

/** Every moderation decision. A row with neither actor was taken by the system. */
export const moderationLog = sqliteTable(
  "moderation_log",
  {
    id: text("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id),
    actorTokenId: text("actor_token_id").references(() => apiTokens.id),
    targetType: text("target_type", { enum: ["prompt", "submission"] }).notNull(),
    targetId: text("target_id").notNull(),
    action: text("action", { enum: MODERATION_ACTIONS }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("moderation_log_created_idx").on(t.createdAt),
    index("moderation_log_target_idx").on(t.targetType, t.targetId),
  ],
);

export type User = typeof users.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
