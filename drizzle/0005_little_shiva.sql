CREATE TABLE `shopping_list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`name_fr` text NOT NULL,
	`qty` real,
	`unit` text,
	`note` text,
	`ingredient_id` integer,
	`category` text DEFAULT 'autre' NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`menu_id` integer,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
