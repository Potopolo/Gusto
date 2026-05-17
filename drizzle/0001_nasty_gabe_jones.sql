CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_fr` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_fr` text NOT NULL,
	`name_canonical` text NOT NULL,
	`category` text,
	`seasonality_months` text,
	`default_unit` text,
	`ean` text,
	`ciqual_code` text,
	`nutrition_per_100g` text,
	`nutrition_source` text,
	`fetched_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_canonical_unique` ON `ingredients` (`name_canonical`);--> statement-breakpoint
CREATE TABLE `recipe_categories` (
	`recipe_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_equipment` (
	`recipe_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer,
	`raw_text` text NOT NULL,
	`quantity` real,
	`unit` text,
	`ingredient_hint` text,
	`optional` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` integer NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`source_url` text,
	`author_attribution` text,
	`name_fr` text NOT NULL,
	`intro_md` text,
	`instructions_md` text NOT NULL,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`servings` integer,
	`servings_unit` text,
	`photo_url` text,
	`raw_html_cache` text,
	`fetched_at` integer,
	`notes` text,
	`nutrition_per_serving` text,
	`points_per_serving` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_slug_unique` ON `recipes` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_source_url_unique` ON `recipes` (`source_url`);