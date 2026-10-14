ALTER TABLE `scorebug_settings` ADD `manual_clock_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scorebug_settings` ADD `manual_clock_running` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scorebug_settings` ADD `manual_clock_remaining_seconds` integer DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE `scorebug_settings` ADD `manual_clock_ends_at` integer;