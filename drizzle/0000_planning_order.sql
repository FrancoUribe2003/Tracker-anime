ALTER TABLE `user_anime` ADD `planning_order` integer;
--> statement-breakpoint
CREATE INDEX `user_anime_user_status_planning_order_idx` ON `user_anime` (`user_id`, `status`, `planning_order`);
