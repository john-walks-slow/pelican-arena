ALTER TABLE `models` ADD `family` text;--> statement-breakpoint
ALTER TABLE `models` ADD `release_date` text;--> statement-breakpoint
ALTER TABLE `models` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `synced_at` integer;