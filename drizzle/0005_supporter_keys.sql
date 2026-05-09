ALTER TABLE `users` ADD `supporter_unlocked_at` integer;
--> statement-breakpoint
CREATE TABLE `supporter_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`redeemed_at` integer,
	`redeemed_by_user_id` text,
	FOREIGN KEY (`redeemed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `supporter_keys_redeemed_by_idx` ON `supporter_keys` (`redeemed_by_user_id`);
