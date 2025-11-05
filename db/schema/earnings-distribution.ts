import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { coffeeGroves, harvestRecords } from "./index";

/**
 * Farmer Grove Earnings Table
 * Tracks earnings per grove per farmer with distribution status
 */
export const farmerGroveEarnings = sqliteTable("farmer_grove_earnings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    farmerAddress: text("farmer_address").notNull(),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    harvestId: integer("harvest_id").notNull().references(() => harvestRecords.id),
    
    // Earnings breakdown
    grossRevenue: integer("gross_revenue").notNull(), // Total revenue from harvest
    farmerShare: integer("farmer_share").notNull(), // Farmer's portion
    
    // Distribution status
    distributionStatus: text("distribution_status").notNull().default("pending"), // pending, distributed, withdrawn
    distributedAt: integer("distributed_at"),
    withdrawnAt: integer("withdrawn_at"),
    
    // Transaction tracking
    distributionTxHash: text("distribution_tx_hash"),
    withdrawalTxHash: text("withdrawal_tx_hash"),
    
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        farmerAddressIdx: index("farmer_grove_earnings_farmer_idx").on(table.farmerAddress),
        groveIdIdx: index("farmer_grove_earnings_grove_idx").on(table.groveId),
        harvestIdIdx: index("farmer_grove_earnings_harvest_idx").on(table.harvestId),
        distributionStatusIdx: index("farmer_grove_earnings_status_idx").on(table.distributionStatus),
        distributedAtIdx: index("farmer_grove_earnings_distributed_idx").on(table.distributedAt)
    }
});

/**
 * Investor Token Holdings Table (Enhanced)
 * Tracks both primary and secondary market token holdings
 */
export const investorTokenHoldings = sqliteTable("investor_token_holdings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    investorAddress: text("investor_address").notNull(),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    tokenAmount: integer("token_amount").notNull(),
    
    // Market tracking
    acquisitionType: text("acquisition_type").notNull(), // primary, secondary
    purchasePrice: integer("purchase_price").notNull(),
    purchaseDate: integer("purchase_date").notNull(),
    
    // Secondary market tracking
    previousOwner: text("previous_owner"), // For secondary market purchases
    transferTxHash: text("transfer_tx_hash"),
    
    isActive: integer("is_active", { mode: 'boolean' }).default(true),
    
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        investorAddressIdx: index("investor_token_holdings_investor_idx").on(table.investorAddress),
        groveIdIdx: index("investor_token_holdings_grove_idx").on(table.groveId),
        acquisitionTypeIdx: index("investor_token_holdings_acquisition_idx").on(table.acquisitionType),
        isActiveIdx: index("investor_token_holdings_active_idx").on(table.isActive)
    }
});

/**
 * Investor Earnings Table
 * Tracks all earnings for investors from various sources
 */
export const investorEarnings = sqliteTable("investor_earnings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    investorAddress: text("investor_address").notNull(),
    
    // Source tracking
    earningType: text("earning_type").notNull(), // primary_market, secondary_market, lp_interest
    sourceId: integer("source_id").notNull(), // References harvestId or liquidityProvisionId
    groveId: integer("grove_id").references(() => coffeeGroves.id), // Null for LP interest
    
    // Token holding reference
    holdingId: integer("holding_id").references(() => investorTokenHoldings.id),
    tokenAmount: integer("token_amount"), // Number of tokens earning from
    
    // Earnings amount
    earningAmount: integer("earning_amount").notNull(),
    
    // Status tracking
    status: text("status").notNull().default("unclaimed"), // unclaimed, claimed
    claimedAt: integer("claimed_at"),
    claimTxHash: text("claim_tx_hash"),
    
    // Distribution tracking
    distributedAt: integer("distributed_at"),
    distributionTxHash: text("distribution_tx_hash"),
    
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        investorAddressIdx: index("investor_earnings_investor_idx").on(table.investorAddress),
        earningTypeIdx: index("investor_earnings_type_idx").on(table.earningType),
        statusIdx: index("investor_earnings_status_idx").on(table.status),
        groveIdIdx: index("investor_earnings_grove_idx").on(table.groveId),
        distributedAtIdx: index("investor_earnings_distributed_idx").on(table.distributedAt),
        claimedAtIdx: index("investor_earnings_claimed_idx").on(table.claimedAt)
    }
});

/**
 * LP Token Interest Tracking Table
 * Tracks interest earned from liquidity provision
 */
export const lpTokenInterest = sqliteTable("lp_token_interest", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerAddress: text("provider_address").notNull(),
    lpTokenAddress: text("lp_token_address").notNull(), // HTS LP token ID
    assetAddress: text("asset_address").notNull(), // Underlying asset (USDC, etc.)
    
    // Interest calculation
    principalAmount: integer("principal_amount").notNull(), // Original liquidity provided
    interestEarned: integer("interest_earned").notNull(), // Interest accrued
    interestRate: integer("interest_rate").notNull(), // Rate in basis points (e.g., 500 = 5%)
    
    // Period tracking
    periodStart: integer("period_start").notNull(),
    periodEnd: integer("period_end").notNull(),
    
    // Status
    status: text("status").notNull().default("accrued"), // accrued, withdrawn, claimed
    claimedAt: integer("claimed_at"),
    claimTxHash: text("claim_tx_hash"),
    
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        providerAddressIdx: index("lp_token_interest_provider_idx").on(table.providerAddress),
        lpTokenAddressIdx: index("lp_token_interest_token_idx").on(table.lpTokenAddress),
        statusIdx: index("lp_token_interest_status_idx").on(table.status),
        periodEndIdx: index("lp_token_interest_period_idx").on(table.periodEnd)
    }
});

/**
 * Investor Claims Table
 * Tracks all claim transactions by investors
 */
export const investorClaims = sqliteTable("investor_claims", {
    id: text("id").unique().primaryKey().notNull(),
    investorAddress: text("investor_address").notNull(),
    
    // Claim details
    claimAmount: integer("claim_amount").notNull(), // Total amount claimed
    earningIds: text("earning_ids").notNull(), // JSON array of earning IDs claimed
    
    // Transaction tracking
    status: text("status").notNull(), // pending, completed, failed
    transactionHash: text("transaction_hash"),
    blockExplorerUrl: text("block_explorer_url"),
    errorMessage: text("error_message"),
    
    // Gas fees
    gasFeeAmount: integer("gas_fee_amount"),
    
    requestedAt: integer("requested_at").notNull(),
    completedAt: integer("completed_at"),
    
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        investorAddressIdx: index("investor_claims_investor_idx").on(table.investorAddress),
        statusIdx: index("investor_claims_status_idx").on(table.status),
        requestedAtIdx: index("investor_claims_requested_idx").on(table.requestedAt)
    }
});

/**
 * Investor Balance Summary Table
 * Aggregated view of investor earnings and claims
 */
export const investorBalances = sqliteTable("investor_balances", {
    investorAddress: text("investor_address").unique().primaryKey().notNull(),
    
    // Earnings breakdown
    totalEarningsAllTime: integer("total_earnings_all_time").notNull().default(0),
    totalEarningsThisMonth: integer("total_earnings_this_month").notNull().default(0),
    
    // Unclaimed breakdown by source
    unclaimedPrimaryMarket: integer("unclaimed_primary_market").notNull().default(0),
    unclaimedSecondaryMarket: integer("unclaimed_secondary_market").notNull().default(0),
    unclaimedLpInterest: integer("unclaimed_lp_interest").notNull().default(0),
    totalUnclaimed: integer("total_unclaimed").notNull().default(0),
    
    // Claimed
    totalClaimed: integer("total_claimed").notNull().default(0),
    
    // Tracking
    lastClaimAt: integer("last_claim_at"),
    lastCalculatedAt: integer("last_calculated_at").default(Date.now()),
    
    updatedAt: integer("updated_at").default(Date.now())
});

/**
 * Farmer Balance Summary Table (Enhanced)
 * Aggregated view of farmer earnings per grove
 */
export const farmerGroveBalances = sqliteTable("farmer_grove_balances", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    farmerAddress: text("farmer_address").notNull(),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    
    // This month's distribution
    thisMonthDistributed: integer("this_month_distributed").notNull().default(0),
    
    // Available balance (distributed but not withdrawn)
    availableBalance: integer("available_balance").notNull().default(0),
    
    // Pending distribution (calculated but not distributed)
    pendingDistribution: integer("pending_distribution").notNull().default(0),
    
    // Total withdrawn
    totalWithdrawn: integer("total_withdrawn").notNull().default(0),
    
    // Total earned all time
    totalEarned: integer("total_earned").notNull().default(0),
    
    lastWithdrawalAt: integer("last_withdrawal_at"),
    lastCalculatedAt: integer("last_calculated_at").default(Date.now()),
    
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        farmerAddressIdx: index("farmer_grove_balances_farmer_idx").on(table.farmerAddress),
        groveIdIdx: index("farmer_grove_balances_grove_idx").on(table.groveId),
        uniqueFarmerGrove: index("farmer_grove_balances_unique_idx").on(table.farmerAddress, table.groveId)
    }
});

/**
 * Secondary Market Transfers Table
 * Tracks token transfers between investors on the platform
 */
export const secondaryMarketTransfers = sqliteTable("secondary_market_transfers", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    
    // Transfer details
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    tokenAmount: integer("token_amount").notNull(),
    transferPrice: integer("transfer_price").notNull(),
    
    // Transaction tracking
    transactionHash: text("transaction_hash"),
    status: text("status").notNull(), // pending, completed, failed
    
    transferDate: integer("transfer_date").notNull(),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        groveIdIdx: index("secondary_market_transfers_grove_idx").on(table.groveId),
        fromAddressIdx: index("secondary_market_transfers_from_idx").on(table.fromAddress),
        toAddressIdx: index("secondary_market_transfers_to_idx").on(table.toAddress),
        transferDateIdx: index("secondary_market_transfers_date_idx").on(table.transferDate)
    }
});
