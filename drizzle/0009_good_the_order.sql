CREATE TABLE `control_users` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`role` text DEFAULT 'operator' NOT NULL
);
