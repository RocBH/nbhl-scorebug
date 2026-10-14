CREATE TABLE `game_overrides` (
	`game_id` text PRIMARY KEY NOT NULL,
	`visitor_score` integer,
	`home_score` integer,
	`period` integer
);
