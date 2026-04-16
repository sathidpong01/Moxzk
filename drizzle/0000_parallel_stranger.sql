CREATE TABLE `album_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`original_key` text,
	`cleaned_key` text,
	`thumbnail_key` text,
	`regions_json` text DEFAULT '[]' NOT NULL,
	`brush_strokes_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`processing_mode` text DEFAULT 'full' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "album_pages_status_check" CHECK("album_pages"."status" in ('pending', 'processing', 'clean_done', 'translated', 'error')),
	CONSTRAINT "album_pages_processing_mode_check" CHECK("album_pages"."processing_mode" in ('full', 'clean_only')),
	CONSTRAINT "album_pages_regions_json_valid" CHECK(json_valid("album_pages"."regions_json")),
	CONSTRAINT "album_pages_brush_strokes_json_valid" CHECK(json_valid("album_pages"."brush_strokes_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_pages_album_page_number_uniq` ON `album_pages` (`album_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `album_pages_album_page_number_idx` ON `album_pages` (`album_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `album_pages_status_idx` ON `album_pages` (`status`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_key` text,
	`source_lang` text DEFAULT 'ja' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `albums_user_updated_idx` ON `albums` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`credential_hash` text,
	`credential_salt` text,
	`credential_algo` text,
	`credential_params_json` text,
	`provider_profile_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_identities_provider_check" CHECK("auth_identities"."provider" in ('password', 'google'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider_subject_uniq` ON `auth_identities` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `auth_identities_user_idx` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_identities_email_normalized_idx` ON `auth_identities` (`email_normalized`);--> statement-breakpoint
CREATE TABLE `email_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`email_normalized` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "email_tokens_type_check" CHECK("email_tokens"."type" in ('verify_email', 'reset_password'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_token_hash_uniq` ON `email_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `email_tokens_user_type_idx` ON `email_tokens` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `email_tokens_expires_at_idx` ON `email_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`redirect_target` text NOT NULL,
	`nonce_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "oauth_states_provider_check" CHECK("oauth_states"."provider" = 'google')
);
--> statement-breakpoint
CREATE INDEX `oauth_states_expires_at_idx` ON `oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `objects` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`album_id` text,
	`page_id` text,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `album_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "objects_kind_check" CHECK("objects"."kind" in ('original', 'cleaned', 'thumbnail', 'cover'))
);
--> statement-breakpoint
CREATE INDEX `objects_user_idx` ON `objects` (`user_id`);--> statement-breakpoint
CREATE INDEX `objects_album_idx` ON `objects` (`album_id`);--> statement-breakpoint
CREATE INDEX `objects_page_idx` ON `objects` (`page_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_uniq` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`email_verified_at` integer,
	`username` text,
	`avatar_url` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_plan_check" CHECK("users"."plan" in ('free', 'pro', 'team'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_normalized_uniq` ON `users` (`email_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uniq` ON `users` (`username`);