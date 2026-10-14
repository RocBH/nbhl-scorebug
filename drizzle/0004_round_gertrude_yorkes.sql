CREATE TABLE `sponsor_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`width` integer DEFAULT 240 NOT NULL,
	`right` integer DEFAULT 98 NOT NULL,
	`top` integer DEFAULT 75 NOT NULL,
	`opacity` integer DEFAULT 100 NOT NULL,
	`visible` integer DEFAULT true NOT NULL
);
