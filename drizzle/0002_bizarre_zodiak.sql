ALTER TABLE `objects` ADD `sha256` text;--> statement-breakpoint
CREATE INDEX `objects_user_hash_idx` ON `objects` (`user_id`,`sha256`);