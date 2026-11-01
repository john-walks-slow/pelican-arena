CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reporter_id` integer NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `reports` (`id`, `target_type`, `target_id`, `reporter_id`, `reason`, `note`, `status`, `created_at`, `resolved_at`)
SELECT `id`, 'submission', `submission_id`, `reporter_id`, `reason`, `note`, `status`, `created_at`, `resolved_at` FROM `submission_reports`;
--> statement-breakpoint
DROP TABLE `submission_reports`;--> statement-breakpoint
CREATE UNIQUE INDEX `reports_unique` ON `reports` (`target_type`,`target_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `reports_open_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_target_idx` ON `reports` (`target_type`,`target_id`);--> statement-breakpoint
ALTER TABLE `ratings` ADD `created_at` integer;--> statement-breakpoint
CREATE INDEX `ratings_user_created_idx` ON `ratings` (`user_id`,`created_at`);
