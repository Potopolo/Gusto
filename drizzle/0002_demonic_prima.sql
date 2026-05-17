DROP INDEX IF EXISTS `ingredients_name_canonical_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_ciqual_code_unique` ON `ingredients` (`ciqual_code`);