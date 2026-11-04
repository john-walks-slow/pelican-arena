CREATE TABLE `submission_doubts` (
	`user_id` integer NOT NULL,
	`submission_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `submission_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submission_doubts_submission_idx` ON `submission_doubts` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `submission_doubts_user_idx` ON `submission_doubts` (`user_id`, `created_at`);
