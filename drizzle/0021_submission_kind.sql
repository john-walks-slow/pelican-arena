ALTER TABLE `submissions` ADD `kind` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `submissions_status_kind_idx` ON `submissions` (`status`, `kind`);--> statement-breakpoint
UPDATE `submissions` SET `kind` = (SELECT `kind` FROM `prompts` WHERE `prompts`.`id` = `submissions`.`prompt_id`) WHERE EXISTS (SELECT 1 FROM `prompts` WHERE `prompts`.`id` = `submissions`.`prompt_id`);
