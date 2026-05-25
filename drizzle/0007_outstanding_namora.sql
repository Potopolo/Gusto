CREATE INDEX `menu_slots_menu_idx` ON `menu_slots` (`menu_id`);--> statement-breakpoint
CREATE INDEX `recipe_categories_recipe_idx` ON `recipe_categories` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_categories_category_idx` ON `recipe_categories` (`category_id`);--> statement-breakpoint
CREATE INDEX `recipe_equipment_recipe_idx` ON `recipe_equipment` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredients_ingredient_idx` ON `recipe_ingredients` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `recipe_tags_recipe_idx` ON `recipe_tags` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_list_idx` ON `shopping_list_items` (`list_id`);--> statement-breakpoint
CREATE INDEX `shopping_lists_household_idx` ON `shopping_lists` (`household_id`);--> statement-breakpoint
CREATE INDEX `shopping_lists_menu_idx` ON `shopping_lists` (`menu_id`);