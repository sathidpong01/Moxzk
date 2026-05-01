CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`subject_hash` text,
	`ip_hash` text,
	`user_agent_hash` text,
	`success` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "auth_attempts_action_check" CHECK("auth_attempts"."action" in ('register', 'login', 'google_start', 'google_desktop_start', 'google_desktop_claim')),
	CONSTRAINT "auth_attempts_success_check" CHECK("auth_attempts"."success" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_action_subject_created_idx` ON `auth_attempts` (`action`,`subject_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_attempts_action_ip_created_idx` ON `auth_attempts` (`action`,`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_attempts_created_at_idx` ON `auth_attempts` (`created_at`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`ip_hash` text,
	`user_agent_hash` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "security_events_type_check" CHECK("security_events"."type" in ('auth_rate_limited', 'auth_account_locked', 'auth_challenge_required', 'profile_updated', 'password_changed', 'session_revoked', 'account_deleted')),
	CONSTRAINT "security_events_metadata_json_valid" CHECK(json_valid("security_events"."metadata_json"))
);
--> statement-breakpoint
CREATE INDEX `security_events_user_created_idx` ON `security_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_type_created_idx` ON `security_events` (`type`,`created_at`);
