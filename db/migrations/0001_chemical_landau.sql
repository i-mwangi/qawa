PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_coffee_groves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_name` text NOT NULL,
	`farmer_address` text NOT NULL,
	`token_address` text,
	`location` text NOT NULL,
	`coordinates_lat` real,
	`coordinates_lng` real,
	`tree_count` integer NOT NULL,
	`coffee_variety` text NOT NULL,
	`planting_date` integer,
	`expected_yield_per_tree` integer,
	`total_tokens_issued` integer,
	`tokens_per_tree` integer,
	`verification_status` text DEFAULT 'pending',
	`current_health_score` integer,
	`created_at` integer DEFAULT 1761231419162,
	`updated_at` integer DEFAULT 1761231419162
);
--> statement-breakpoint
INSERT INTO `__new_coffee_groves`("id", "grove_name", "farmer_address", "token_address", "location", "coordinates_lat", "coordinates_lng", "tree_count", "coffee_variety", "planting_date", "expected_yield_per_tree", "total_tokens_issued", "tokens_per_tree", "verification_status", "current_health_score", "created_at", "updated_at") SELECT "id", "grove_name", "farmer_address", "token_address", "location", "coordinates_lat", "coordinates_lng", "tree_count", "coffee_variety", "planting_date", "expected_yield_per_tree", "total_tokens_issued", "tokens_per_tree", "verification_status", "current_health_score", "created_at", "updated_at" FROM `coffee_groves`;--> statement-breakpoint
DROP TABLE `coffee_groves`;--> statement-breakpoint
ALTER TABLE `__new_coffee_groves` RENAME TO `coffee_groves`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `coffee_groves_grove_name_unique` ON `coffee_groves` (`grove_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `coffee_groves_token_address_unique` ON `coffee_groves` (`token_address`);--> statement-breakpoint
CREATE INDEX `coffee_groves_farmer_address_idx` ON `coffee_groves` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `coffee_groves_name_idx` ON `coffee_groves` (`grove_name`);--> statement-breakpoint
CREATE TABLE `__new_environmental_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`alert_type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`sensor_data_id` integer,
	`health_record_id` integer,
	`farmer_notified` integer DEFAULT false,
	`investor_notified` integer DEFAULT false,
	`acknowledged` integer DEFAULT false,
	`resolved` integer DEFAULT false,
	`created_at` integer DEFAULT 1761231419164,
	`resolved_at` integer,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_data_id`) REFERENCES `iot_sensor_data`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`health_record_id`) REFERENCES `tree_health_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_environmental_alerts`("id", "grove_id", "alert_type", "severity", "title", "message", "sensor_data_id", "health_record_id", "farmer_notified", "investor_notified", "acknowledged", "resolved", "created_at", "resolved_at") SELECT "id", "grove_id", "alert_type", "severity", "title", "message", "sensor_data_id", "health_record_id", "farmer_notified", "investor_notified", "acknowledged", "resolved", "created_at", "resolved_at" FROM `environmental_alerts`;--> statement-breakpoint
DROP TABLE `environmental_alerts`;--> statement-breakpoint
ALTER TABLE `__new_environmental_alerts` RENAME TO `environmental_alerts`;--> statement-breakpoint
CREATE TABLE `__new_farmer_balances` (
	`farmer_address` text PRIMARY KEY NOT NULL,
	`available_balance` integer DEFAULT 0 NOT NULL,
	`pending_balance` integer DEFAULT 0 NOT NULL,
	`total_earned` integer DEFAULT 0 NOT NULL,
	`total_withdrawn` integer DEFAULT 0 NOT NULL,
	`last_withdrawal_at` integer,
	`updated_at` integer DEFAULT 1761231419166
);
--> statement-breakpoint
INSERT INTO `__new_farmer_balances`("farmer_address", "available_balance", "pending_balance", "total_earned", "total_withdrawn", "last_withdrawal_at", "updated_at") SELECT "farmer_address", "available_balance", "pending_balance", "total_earned", "total_withdrawn", "last_withdrawal_at", "updated_at" FROM `farmer_balances`;--> statement-breakpoint
DROP TABLE `farmer_balances`;--> statement-breakpoint
ALTER TABLE `__new_farmer_balances` RENAME TO `farmer_balances`;--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_balances_farmer_address_unique` ON `farmer_balances` (`farmer_address`);--> statement-breakpoint
CREATE TABLE `__new_farmer_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`farmer_address` text NOT NULL,
	`verification_status` text DEFAULT 'pending',
	`documents_hash` text,
	`verifier_address` text,
	`verification_date` integer,
	`rejection_reason` text,
	`created_at` integer DEFAULT 1761231419163
);
--> statement-breakpoint
INSERT INTO `__new_farmer_verifications`("id", "farmer_address", "verification_status", "documents_hash", "verifier_address", "verification_date", "rejection_reason", "created_at") SELECT "id", "farmer_address", "verification_status", "documents_hash", "verifier_address", "verification_date", "rejection_reason", "created_at" FROM `farmer_verifications`;--> statement-breakpoint
DROP TABLE `farmer_verifications`;--> statement-breakpoint
ALTER TABLE `__new_farmer_verifications` RENAME TO `farmer_verifications`;--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_verifications_farmer_address_unique` ON `farmer_verifications` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_verifications_address_idx` ON `farmer_verifications` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_verifications_status_idx` ON `farmer_verifications` (`verification_status`);--> statement-breakpoint
CREATE TABLE `__new_farmer_withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`farmer_address` text NOT NULL,
	`grove_id` integer,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`transaction_hash` text,
	`block_explorer_url` text,
	`error_message` text,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT 1761231419166,
	`updated_at` integer DEFAULT 1761231419166,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_farmer_withdrawals`("id", "farmer_address", "grove_id", "amount", "status", "transaction_hash", "block_explorer_url", "error_message", "requested_at", "completed_at", "created_at", "updated_at") SELECT "id", "farmer_address", "grove_id", "amount", "status", "transaction_hash", "block_explorer_url", "error_message", "requested_at", "completed_at", "created_at", "updated_at" FROM `farmer_withdrawals`;--> statement-breakpoint
DROP TABLE `farmer_withdrawals`;--> statement-breakpoint
ALTER TABLE `__new_farmer_withdrawals` RENAME TO `farmer_withdrawals`;--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_withdrawals_id_unique` ON `farmer_withdrawals` (`id`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_farmer_idx` ON `farmer_withdrawals` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_status_idx` ON `farmer_withdrawals` (`status`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_requested_idx` ON `farmer_withdrawals` (`requested_at`);--> statement-breakpoint
CREATE TABLE `__new_farmers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`location` text,
	`verification_status` text DEFAULT 'pending',
	`created_at` integer DEFAULT 1761231419164
);
--> statement-breakpoint
INSERT INTO `__new_farmers`("id", "address", "name", "email", "phone", "location", "verification_status", "created_at") SELECT "id", "address", "name", "email", "phone", "location", "verification_status", "created_at" FROM `farmers`;--> statement-breakpoint
DROP TABLE `farmers`;--> statement-breakpoint
ALTER TABLE `__new_farmers` RENAME TO `farmers`;--> statement-breakpoint
CREATE UNIQUE INDEX `farmers_address_unique` ON `farmers` (`address`);--> statement-breakpoint
CREATE TABLE `__new_harvest_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`harvest_date` integer NOT NULL,
	`yield_kg` integer NOT NULL,
	`quality_grade` integer NOT NULL,
	`sale_price_per_kg` integer NOT NULL,
	`total_revenue` integer NOT NULL,
	`farmer_share` integer NOT NULL,
	`investor_share` integer NOT NULL,
	`revenue_distributed` integer DEFAULT false,
	`transaction_hash` text,
	`created_at` integer DEFAULT 1761231419163,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_harvest_records`("id", "grove_id", "harvest_date", "yield_kg", "quality_grade", "sale_price_per_kg", "total_revenue", "farmer_share", "investor_share", "revenue_distributed", "transaction_hash", "created_at") SELECT "id", "grove_id", "harvest_date", "yield_kg", "quality_grade", "sale_price_per_kg", "total_revenue", "farmer_share", "investor_share", "revenue_distributed", "transaction_hash", "created_at" FROM `harvest_records`;--> statement-breakpoint
DROP TABLE `harvest_records`;--> statement-breakpoint
ALTER TABLE `__new_harvest_records` RENAME TO `harvest_records`;--> statement-breakpoint
CREATE INDEX `harvest_records_grove_id_idx` ON `harvest_records` (`grove_id`);--> statement-breakpoint
CREATE INDEX `harvest_records_date_idx` ON `harvest_records` (`harvest_date`);--> statement-breakpoint
CREATE INDEX `harvest_records_distributed_idx` ON `harvest_records` (`revenue_distributed`);--> statement-breakpoint
CREATE TABLE `__new_investor_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_address` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`country` text,
	`investor_type` text,
	`risk_tolerance` text,
	`investment_preferences` text,
	`created_at` integer DEFAULT 1761231419165,
	`updated_at` integer DEFAULT 1761231419165
);
--> statement-breakpoint
INSERT INTO `__new_investor_profiles`("id", "investor_address", "name", "email", "phone", "country", "investor_type", "risk_tolerance", "investment_preferences", "created_at", "updated_at") SELECT "id", "investor_address", "name", "email", "phone", "country", "investor_type", "risk_tolerance", "investment_preferences", "created_at", "updated_at" FROM `investor_profiles`;--> statement-breakpoint
DROP TABLE `investor_profiles`;--> statement-breakpoint
ALTER TABLE `__new_investor_profiles` RENAME TO `investor_profiles`;--> statement-breakpoint
CREATE UNIQUE INDEX `investor_profiles_investor_address_unique` ON `investor_profiles` (`investor_address`);--> statement-breakpoint
CREATE TABLE `__new_investor_verification_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verification_id` integer NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`action_type` text NOT NULL,
	`verifier_address` text,
	`reason` text,
	`timestamp` integer DEFAULT 1761231419165,
	FOREIGN KEY (`verification_id`) REFERENCES `investor_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_investor_verification_history`("id", "verification_id", "previous_status", "new_status", "action_type", "verifier_address", "reason", "timestamp") SELECT "id", "verification_id", "previous_status", "new_status", "action_type", "verifier_address", "reason", "timestamp" FROM `investor_verification_history`;--> statement-breakpoint
DROP TABLE `investor_verification_history`;--> statement-breakpoint
ALTER TABLE `__new_investor_verification_history` RENAME TO `investor_verification_history`;--> statement-breakpoint
CREATE TABLE `__new_investor_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_address` text NOT NULL,
	`verification_status` text DEFAULT 'unverified',
	`verification_type` text,
	`documents_hash` text,
	`identity_document_hash` text,
	`proof_of_address_hash` text,
	`financial_statement_hash` text,
	`accreditation_proof_hash` text,
	`verifier_address` text,
	`verification_date` integer,
	`expiry_date` integer,
	`rejection_reason` text,
	`access_level` text DEFAULT 'none',
	`created_at` integer DEFAULT 1761231419165,
	`updated_at` integer DEFAULT 1761231419165
);
--> statement-breakpoint
INSERT INTO `__new_investor_verifications`("id", "investor_address", "verification_status", "verification_type", "documents_hash", "identity_document_hash", "proof_of_address_hash", "financial_statement_hash", "accreditation_proof_hash", "verifier_address", "verification_date", "expiry_date", "rejection_reason", "access_level", "created_at", "updated_at") SELECT "id", "investor_address", "verification_status", "verification_type", "documents_hash", "identity_document_hash", "proof_of_address_hash", "financial_statement_hash", "accreditation_proof_hash", "verifier_address", "verification_date", "expiry_date", "rejection_reason", "access_level", "created_at", "updated_at" FROM `investor_verifications`;--> statement-breakpoint
DROP TABLE `investor_verifications`;--> statement-breakpoint
ALTER TABLE `__new_investor_verifications` RENAME TO `investor_verifications`;--> statement-breakpoint
CREATE UNIQUE INDEX `investor_verifications_investor_address_unique` ON `investor_verifications` (`investor_address`);--> statement-breakpoint
CREATE TABLE `__new_iot_sensor_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`sensor_id` text NOT NULL,
	`sensor_type` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`location_lat` real,
	`location_lng` real,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT 1761231419164,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_iot_sensor_data`("id", "grove_id", "sensor_id", "sensor_type", "value", "unit", "location_lat", "location_lng", "timestamp", "created_at") SELECT "id", "grove_id", "sensor_id", "sensor_type", "value", "unit", "location_lat", "location_lng", "timestamp", "created_at" FROM `iot_sensor_data`;--> statement-breakpoint
DROP TABLE `iot_sensor_data`;--> statement-breakpoint
ALTER TABLE `__new_iot_sensor_data` RENAME TO `iot_sensor_data`;--> statement-breakpoint
CREATE TABLE `__new_liquidity_withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_address` text NOT NULL,
	`asset_address` text NOT NULL,
	`lp_token_amount` integer NOT NULL,
	`usdc_returned` integer NOT NULL,
	`rewards_earned` integer NOT NULL,
	`status` text NOT NULL,
	`transaction_hash` text,
	`block_explorer_url` text,
	`error_message` text,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT 1761231419166,
	`updated_at` integer DEFAULT 1761231419166
);
--> statement-breakpoint
INSERT INTO `__new_liquidity_withdrawals`("id", "provider_address", "asset_address", "lp_token_amount", "usdc_returned", "rewards_earned", "status", "transaction_hash", "block_explorer_url", "error_message", "requested_at", "completed_at", "created_at", "updated_at") SELECT "id", "provider_address", "asset_address", "lp_token_amount", "usdc_returned", "rewards_earned", "status", "transaction_hash", "block_explorer_url", "error_message", "requested_at", "completed_at", "created_at", "updated_at" FROM `liquidity_withdrawals`;--> statement-breakpoint
DROP TABLE `liquidity_withdrawals`;--> statement-breakpoint
ALTER TABLE `__new_liquidity_withdrawals` RENAME TO `liquidity_withdrawals`;--> statement-breakpoint
CREATE UNIQUE INDEX `liquidity_withdrawals_id_unique` ON `liquidity_withdrawals` (`id`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_provider_idx` ON `liquidity_withdrawals` (`provider_address`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_asset_idx` ON `liquidity_withdrawals` (`asset_address`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_status_idx` ON `liquidity_withdrawals` (`status`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_requested_idx` ON `liquidity_withdrawals` (`requested_at`);--> statement-breakpoint
CREATE TABLE `__new_maintenance_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`farmer_address` text NOT NULL,
	`activity_type` text NOT NULL,
	`description` text NOT NULL,
	`cost` real,
	`materials_used` text,
	`area_treated` real,
	`weather_conditions` text,
	`notes` text,
	`activity_date` integer NOT NULL,
	`created_at` integer DEFAULT 1761231419165,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_maintenance_activities`("id", "grove_id", "farmer_address", "activity_type", "description", "cost", "materials_used", "area_treated", "weather_conditions", "notes", "activity_date", "created_at") SELECT "id", "grove_id", "farmer_address", "activity_type", "description", "cost", "materials_used", "area_treated", "weather_conditions", "notes", "activity_date", "created_at" FROM `maintenance_activities`;--> statement-breakpoint
DROP TABLE `maintenance_activities`;--> statement-breakpoint
ALTER TABLE `__new_maintenance_activities` RENAME TO `maintenance_activities`;--> statement-breakpoint
CREATE TABLE `__new_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variety` integer NOT NULL,
	`grade` integer NOT NULL,
	`price` integer NOT NULL,
	`source` text NOT NULL,
	`region` text,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT 1761231419164
);
--> statement-breakpoint
INSERT INTO `__new_price_history`("id", "variety", "grade", "price", "source", "region", "timestamp", "created_at") SELECT "id", "variety", "grade", "price", "source", "region", "timestamp", "created_at" FROM `price_history`;--> statement-breakpoint
DROP TABLE `price_history`;--> statement-breakpoint
ALTER TABLE `__new_price_history` RENAME TO `price_history`;--> statement-breakpoint
CREATE TABLE `__new_sensor_configurations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`sensor_type` text NOT NULL,
	`optimal_min` real NOT NULL,
	`optimal_max` real NOT NULL,
	`warning_min` real NOT NULL,
	`warning_max` real NOT NULL,
	`critical_min` real NOT NULL,
	`critical_max` real NOT NULL,
	`unit` text NOT NULL,
	`reading_frequency` integer NOT NULL,
	`alert_threshold_count` integer DEFAULT 3,
	`created_at` integer DEFAULT 1761231419165,
	`updated_at` integer DEFAULT 1761231419165,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sensor_configurations`("id", "grove_id", "sensor_type", "optimal_min", "optimal_max", "warning_min", "warning_max", "critical_min", "critical_max", "unit", "reading_frequency", "alert_threshold_count", "created_at", "updated_at") SELECT "id", "grove_id", "sensor_type", "optimal_min", "optimal_max", "warning_min", "warning_max", "critical_min", "critical_max", "unit", "reading_frequency", "alert_threshold_count", "created_at", "updated_at" FROM `sensor_configurations`;--> statement-breakpoint
DROP TABLE `sensor_configurations`;--> statement-breakpoint
ALTER TABLE `__new_sensor_configurations` RENAME TO `sensor_configurations`;--> statement-breakpoint
CREATE TABLE `__new_transaction_history` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`asset` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`status` text NOT NULL,
	`timestamp` integer NOT NULL,
	`transaction_hash` text,
	`block_explorer_url` text,
	`metadata` text,
	`created_at` integer DEFAULT 1761231419160,
	`updated_at` integer DEFAULT 1761231419161
);
--> statement-breakpoint
INSERT INTO `__new_transaction_history`("id", "type", "amount", "asset", "from_address", "to_address", "status", "timestamp", "transaction_hash", "block_explorer_url", "metadata", "created_at", "updated_at") SELECT "id", "type", "amount", "asset", "from_address", "to_address", "status", "timestamp", "transaction_hash", "block_explorer_url", "metadata", "created_at", "updated_at" FROM `transaction_history`;--> statement-breakpoint
DROP TABLE `transaction_history`;--> statement-breakpoint
ALTER TABLE `__new_transaction_history` RENAME TO `transaction_history`;--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_history_id_unique` ON `transaction_history` (`id`);--> statement-breakpoint
CREATE INDEX `transaction_history_from_idx` ON `transaction_history` (`from_address`);--> statement-breakpoint
CREATE INDEX `transaction_history_to_idx` ON `transaction_history` (`to_address`);--> statement-breakpoint
CREATE INDEX `transaction_history_type_idx` ON `transaction_history` (`type`);--> statement-breakpoint
CREATE INDEX `transaction_history_status_idx` ON `transaction_history` (`status`);--> statement-breakpoint
CREATE INDEX `transaction_history_timestamp_idx` ON `transaction_history` (`timestamp`);--> statement-breakpoint
CREATE TABLE `__new_tree_health_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`health_score` integer NOT NULL,
	`assessment_date` integer NOT NULL,
	`soil_moisture_score` integer,
	`temperature_score` integer,
	`humidity_score` integer,
	`ph_score` integer,
	`light_score` integer,
	`rainfall_score` integer,
	`risk_factors` text,
	`recommendations` text,
	`yield_impact_projection` real,
	`created_at` integer DEFAULT 1761231419164,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tree_health_records`("id", "grove_id", "health_score", "assessment_date", "soil_moisture_score", "temperature_score", "humidity_score", "ph_score", "light_score", "rainfall_score", "risk_factors", "recommendations", "yield_impact_projection", "created_at") SELECT "id", "grove_id", "health_score", "assessment_date", "soil_moisture_score", "temperature_score", "humidity_score", "ph_score", "light_score", "rainfall_score", "risk_factors", "recommendations", "yield_impact_projection", "created_at" FROM `tree_health_records`;--> statement-breakpoint
DROP TABLE `tree_health_records`;--> statement-breakpoint
ALTER TABLE `__new_tree_health_records` RENAME TO `tree_health_records`;--> statement-breakpoint
CREATE TABLE `__new_user_settings` (
	`account` text PRIMARY KEY NOT NULL,
	`skip_farmer_verification` integer DEFAULT false,
	`skip_investor_verification` integer DEFAULT false,
	`demo_bypass` integer DEFAULT false,
	`updated_at` integer DEFAULT 1761231419165
);
--> statement-breakpoint
INSERT INTO `__new_user_settings`("account", "skip_farmer_verification", "skip_investor_verification", "demo_bypass", "updated_at") SELECT "account", "skip_farmer_verification", "skip_investor_verification", "demo_bypass", "updated_at" FROM `user_settings`;--> statement-breakpoint
DROP TABLE `user_settings`;--> statement-breakpoint
ALTER TABLE `__new_user_settings` RENAME TO `user_settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_account_unique` ON `user_settings` (`account`);