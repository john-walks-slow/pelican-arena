ALTER TABLE `prompts` ADD `kind` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
CREATE INDEX `prompts_kind_created_idx` ON `prompts` (`kind`,`created_at`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `content` text;--> statement-breakpoint
CREATE INDEX `submissions_model_idx` ON `submissions` (`model_id`);--> statement-breakpoint
CREATE INDEX `submissions_provider_idx` ON `submissions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `submissions_harness_idx` ON `submissions` (`harness_id`);--> statement-breakpoint
CREATE INDEX `submission_mods_mod_idx` ON `submission_mods` (`mod_id`);