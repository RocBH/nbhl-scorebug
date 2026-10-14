CREATE TABLE `game_event_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`game_id` text NOT NULL,
	`source_event_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer,
	`elapsed_seconds` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_game_event_logs_game` ON `game_event_logs` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_game_event_logs_source` ON `game_event_logs` (`session_id`,`source_event_id`);--> statement-breakpoint
CREATE TABLE `log_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`initialized` integer DEFAULT 0 NOT NULL,
	`last_period` integer
);
--> statement-breakpoint
ALTER TABLE `scorebug_settings` ADD `active_started_at` integer;