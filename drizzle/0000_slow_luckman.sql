CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`source` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_source_unique` ON `records` (`source`);