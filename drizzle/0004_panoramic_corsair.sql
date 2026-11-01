CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` integer,
	`actor_token_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_token_id`) REFERENCES `api_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moderation_log_created_idx` ON `moderation_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_log_target_idx` ON `moderation_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `submission_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`reporter_id` integer NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_reports_unique` ON `submission_reports` (`submission_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `submission_reports_open_idx` ON `submission_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `submission_reports_reporter_idx` ON `submission_reports` (`reporter_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `prompts` ADD `moderation_note` text;--> statement-breakpoint
CREATE INDEX `prompts_status_created_idx` ON `prompts` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `moderation_note` text;