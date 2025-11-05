CREATE TABLE `assets` (
	`token` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`timestamp` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_token_unique` ON `assets` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_name_unique` ON `assets` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_symbol_unique` ON `assets` (`symbol`);--> statement-breakpoint
CREATE TABLE `coffee_groves` (
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
	`created_at` integer DEFAULT 1761231316225,
	`updated_at` integer DEFAULT 1761231316225
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coffee_groves_grove_name_unique` ON `coffee_groves` (`grove_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `coffee_groves_token_address_unique` ON `coffee_groves` (`token_address`);--> statement-breakpoint
CREATE INDEX `coffee_groves_farmer_address_idx` ON `coffee_groves` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `coffee_groves_name_idx` ON `coffee_groves` (`grove_name`);--> statement-breakpoint
CREATE TABLE `environmental_alerts` (
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
	`created_at` integer DEFAULT 1761231316227,
	`resolved_at` integer,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_data_id`) REFERENCES `iot_sensor_data`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`health_record_id`) REFERENCES `tree_health_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `farmer_balances` (
	`farmer_address` text PRIMARY KEY NOT NULL,
	`available_balance` integer DEFAULT 0 NOT NULL,
	`pending_balance` integer DEFAULT 0 NOT NULL,
	`total_earned` integer DEFAULT 0 NOT NULL,
	`total_withdrawn` integer DEFAULT 0 NOT NULL,
	`last_withdrawal_at` integer,
	`updated_at` integer DEFAULT 1761231316229
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_balances_farmer_address_unique` ON `farmer_balances` (`farmer_address`);--> statement-breakpoint
CREATE TABLE `farmer_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`farmer_address` text NOT NULL,
	`verification_status` text DEFAULT 'pending',
	`documents_hash` text,
	`verifier_address` text,
	`verification_date` integer,
	`rejection_reason` text,
	`created_at` integer DEFAULT 1761231316226
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_verifications_farmer_address_unique` ON `farmer_verifications` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_verifications_address_idx` ON `farmer_verifications` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_verifications_status_idx` ON `farmer_verifications` (`verification_status`);--> statement-breakpoint
CREATE TABLE `farmer_withdrawals` (
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
	`created_at` integer DEFAULT 1761231316229,
	`updated_at` integer DEFAULT 1761231316229,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farmer_withdrawals_id_unique` ON `farmer_withdrawals` (`id`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_farmer_idx` ON `farmer_withdrawals` (`farmer_address`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_status_idx` ON `farmer_withdrawals` (`status`);--> statement-breakpoint
CREATE INDEX `farmer_withdrawals_requested_idx` ON `farmer_withdrawals` (`requested_at`);--> statement-breakpoint
CREATE TABLE `farmers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`location` text,
	`verification_status` text DEFAULT 'pending',
	`created_at` integer DEFAULT 1761231316226
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farmers_address_unique` ON `farmers` (`address`);--> statement-breakpoint
CREATE TABLE `harvest_records` (
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
	`created_at` integer DEFAULT 1761231316225,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `harvest_records_grove_id_idx` ON `harvest_records` (`grove_id`);--> statement-breakpoint
CREATE INDEX `harvest_records_date_idx` ON `harvest_records` (`harvest_date`);--> statement-breakpoint
CREATE INDEX `harvest_records_distributed_idx` ON `harvest_records` (`revenue_distributed`);--> statement-breakpoint
CREATE TABLE `investor_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investor_address` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`country` text,
	`investor_type` text,
	`risk_tolerance` text,
	`investment_preferences` text,
	`created_at` integer DEFAULT 1761231316228,
	`updated_at` integer DEFAULT 1761231316228
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_profiles_investor_address_unique` ON `investor_profiles` (`investor_address`);--> statement-breakpoint
CREATE TABLE `investor_verification_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verification_id` integer NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`action_type` text NOT NULL,
	`verifier_address` text,
	`reason` text,
	`timestamp` integer DEFAULT 1761231316228,
	FOREIGN KEY (`verification_id`) REFERENCES `investor_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `investor_verifications` (
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
	`created_at` integer DEFAULT 1761231316228,
	`updated_at` integer DEFAULT 1761231316228
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_verifications_investor_address_unique` ON `investor_verifications` (`investor_address`);--> statement-breakpoint
CREATE TABLE `iot_sensor_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grove_id` integer NOT NULL,
	`sensor_id` text NOT NULL,
	`sensor_type` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`location_lat` real,
	`location_lng` real,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT 1761231316227,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kyc` (
	`account` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	FOREIGN KEY (`token`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kyc_account_unique` ON `kyc` (`account`);--> statement-breakpoint
CREATE TABLE `lendingReserves` (
	`token` text PRIMARY KEY NOT NULL,
	`asset` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`asset`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lendingReserves_token_unique` ON `lendingReserves` (`token`);--> statement-breakpoint
CREATE TABLE `liquidations` (
	`id` text PRIMARY KEY NOT NULL,
	`loanId` text NOT NULL,
	`account` text NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liquidations_id_unique` ON `liquidations` (`id`);--> statement-breakpoint
CREATE TABLE `liquidity_withdrawals` (
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
	`created_at` integer DEFAULT 1761231316229,
	`updated_at` integer DEFAULT 1761231316229
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liquidity_withdrawals_id_unique` ON `liquidity_withdrawals` (`id`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_provider_idx` ON `liquidity_withdrawals` (`provider_address`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_asset_idx` ON `liquidity_withdrawals` (`asset_address`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_status_idx` ON `liquidity_withdrawals` (`status`);--> statement-breakpoint
CREATE INDEX `liquidity_withdrawals_requested_idx` ON `liquidity_withdrawals` (`requested_at`);--> statement-breakpoint
CREATE TABLE `loanRepayment` (
	`id` text PRIMARY KEY NOT NULL,
	`loanId` text NOT NULL,
	`token` text NOT NULL,
	`account` text NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`token`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loanRepayment_id_unique` ON `loanRepayment` (`id`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`collateralAsset` text NOT NULL,
	`loanAmount` real NOT NULL,
	`collateralAmount` real NOT NULL,
	`liquidationPrice` real NOT NULL,
	`repaymentAmount` real NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`collateralAsset`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loans_id_unique` ON `loans` (`id`);--> statement-breakpoint
CREATE TABLE `maintenance_activities` (
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
	`created_at` integer DEFAULT 1761231316227,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `market_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`farmer_address` text NOT NULL,
	`alert_type` text NOT NULL,
	`variety` integer NOT NULL,
	`grade` integer NOT NULL,
	`current_price` integer NOT NULL,
	`previous_price` integer NOT NULL,
	`change_percent` integer NOT NULL,
	`message` text NOT NULL,
	`sent_at` integer NOT NULL,
	`channel` text NOT NULL,
	`acknowledged` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variety` integer NOT NULL,
	`grade` integer NOT NULL,
	`price` integer NOT NULL,
	`source` text NOT NULL,
	`region` text,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT 1761231316227
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`price` real NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`token`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prices_id_unique` ON `prices` (`id`);--> statement-breakpoint
CREATE TABLE `providedLiquidity` (
	`id` text PRIMARY KEY NOT NULL,
	`asset` text NOT NULL,
	`amount` real NOT NULL,
	`account` text NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`asset`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providedLiquidity_id_unique` ON `providedLiquidity` (`id`);--> statement-breakpoint
CREATE TABLE `realwordAssetTimeseries` (
	`id` text PRIMARY KEY NOT NULL,
	`open` real NOT NULL,
	`close` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`net` real NOT NULL,
	`gross` real NOT NULL,
	`timestamp` real NOT NULL,
	`asset` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `realwordAssetTimeseries_id_unique` ON `realwordAssetTimeseries` (`id`);--> statement-breakpoint
CREATE TABLE `revenue_distributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`harvest_id` integer NOT NULL,
	`holder_address` text NOT NULL,
	`token_amount` integer NOT NULL,
	`revenue_share` integer NOT NULL,
	`distribution_date` integer NOT NULL,
	`transaction_hash` text,
	FOREIGN KEY (`harvest_id`) REFERENCES `harvest_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sensor_configurations` (
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
	`created_at` integer DEFAULT 1761231316227,
	`updated_at` integer DEFAULT 1761231316228,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `token_holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holder_address` text NOT NULL,
	`grove_id` integer NOT NULL,
	`token_amount` integer NOT NULL,
	`purchase_price` integer NOT NULL,
	`purchase_date` integer NOT NULL,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `token_holdings_holder_address_idx` ON `token_holdings` (`holder_address`);--> statement-breakpoint
CREATE INDEX `token_holdings_grove_id_idx` ON `token_holdings` (`grove_id`);--> statement-breakpoint
CREATE INDEX `token_holdings_is_active_idx` ON `token_holdings` (`is_active`);--> statement-breakpoint
CREATE TABLE `transaction_history` (
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
	`created_at` integer DEFAULT 1761231316224,
	`updated_at` integer DEFAULT 1761231316224
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_history_id_unique` ON `transaction_history` (`id`);--> statement-breakpoint
CREATE INDEX `transaction_history_from_idx` ON `transaction_history` (`from_address`);--> statement-breakpoint
CREATE INDEX `transaction_history_to_idx` ON `transaction_history` (`to_address`);--> statement-breakpoint
CREATE INDEX `transaction_history_type_idx` ON `transaction_history` (`type`);--> statement-breakpoint
CREATE INDEX `transaction_history_status_idx` ON `transaction_history` (`status`);--> statement-breakpoint
CREATE INDEX `transaction_history_timestamp_idx` ON `transaction_history` (`timestamp`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`hash` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`token` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`timestamp` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_hash_unique` ON `transactions` (`hash`);--> statement-breakpoint
CREATE TABLE `tree_health_records` (
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
	`created_at` integer DEFAULT 1761231316227,
	FOREIGN KEY (`grove_id`) REFERENCES `coffee_groves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`account` text PRIMARY KEY NOT NULL,
	`skip_farmer_verification` integer DEFAULT false,
	`skip_investor_verification` integer DEFAULT false,
	`demo_bypass` integer DEFAULT false,
	`updated_at` integer DEFAULT 1761231316228
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_account_unique` ON `user_settings` (`account`);--> statement-breakpoint
CREATE TABLE `withdrawnLiquidity` (
	`id` text PRIMARY KEY NOT NULL,
	`asset` text NOT NULL,
	`amount` real NOT NULL,
	`account` text NOT NULL,
	`timestamp` real NOT NULL,
	FOREIGN KEY (`asset`) REFERENCES `assets`(`token`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `withdrawnLiquidity_id_unique` ON `withdrawnLiquidity` (`id`);