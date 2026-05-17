CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_fr` text NOT NULL,
	`category` text NOT NULL,
	`owned` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_name_fr_unique` ON `equipment` (`name_fr`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`age` integer,
	`sex` text,
	`height_cm` real,
	`activity_level` text DEFAULT 'moderate' NOT NULL,
	`goal_phase` text DEFAULT 'loss' NOT NULL,
	`daily_points_target` integer DEFAULT 22 NOT NULL,
	`macro_targets` text,
	`dietary_prefs` text,
	`enable_weight_tracking` integer DEFAULT true NOT NULL,
	`points_formula_config` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`label_fr` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
