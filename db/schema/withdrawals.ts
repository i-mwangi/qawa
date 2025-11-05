import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { coffeeGroves } from "./index";

/**
 * Farmer Withdrawal History Table
 * Tracks all withdrawals made by farmers from their harvest revenue share
 */
export const farmerWithdrawals = sqliteTable("farmer_withdrawals", {
    id: text("id").unique().primaryKey().notNull(),
    farmerAddress: text("farmer_address").notNull(),
    groveId: integer("grove_id").references(() => coffeeGroves.id),
    amount: integer("amount").notNull(), // Amount in smallest unit (cents for USDC)
    status: text("status").notNull(), // pending, completed, failed
    transactionHash: text("transaction_hash"),
    blockExplorerUrl: text("block_explorer_url"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at").notNull(),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        farmerAddressIdx: index("farmer_withdrawals_farmer_idx").on(table.farmerAddress),
        statusIdx: index("farmer_withdrawals_status_idx").on(table.status),
        requestedAtIdx: index("farmer_withdrawals_requested_idx").on(table.requestedAt)
    }
});

/**
 * Liquidity Provider Withdrawal History Table
 * Tracks all withdrawals made by liquidity providers from lending pools
 */
export const liquidityWithdrawals = sqliteTable("liquidity_withdrawals", {
    id: text("id").unique().primaryKey().notNull(),
    providerAddress: text("provider_address").notNull(),
    assetAddress: text("asset_address").notNull(), // USDC, KES, etc.
    lpTokenAmount: integer("lp_token_amount").notNull(), // LP tokens burned
    usdcReturned: integer("usdc_returned").notNull(), // USDC returned (principal + rewards)
    rewardsEarned: integer("rewards_earned").notNull(), // Rewards portion
    status: text("status").notNull(), // pending, completed, failed
    transactionHash: text("transaction_hash"),
    blockExplorerUrl: text("block_explorer_url"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at").notNull(),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        providerAddressIdx: index("liquidity_withdrawals_provider_idx").on(table.providerAddress),
        assetAddressIdx: index("liquidity_withdrawals_asset_idx").on(table.assetAddress),
        statusIdx: index("liquidity_withdrawals_status_idx").on(table.status),
        requestedAtIdx: index("liquidity_withdrawals_requested_idx").on(table.requestedAt)
    }
});

/**
 * Farmer Balance Tracking Table
 * Tracks available balance for each farmer
 */
export const farmerBalances = sqliteTable("farmer_balances", {
    farmerAddress: text("farmer_address").unique().primaryKey().notNull(),
    availableBalance: integer("available_balance").notNull().default(0), // Available to withdraw
    pendingBalance: integer("pending_balance").notNull().default(0), // Pending distribution
    totalEarned: integer("total_earned").notNull().default(0), // Total earned all time
    totalWithdrawn: integer("total_withdrawn").notNull().default(0), // Total withdrawn all time
    lastWithdrawalAt: integer("last_withdrawal_at"),
    updatedAt: integer("updated_at").default(Date.now())
});
