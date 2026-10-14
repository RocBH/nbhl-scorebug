ALTER TABLE `scorebug_settings` ADD `game_queue` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `scorebug_settings` ADD `queue_index` integer DEFAULT 0 NOT NULL;