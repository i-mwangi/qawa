import { real, sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";



export const assets = sqliteTable("assets", {
    token: text("token").unique().primaryKey().notNull(),
    name: text("name").notNull().unique().notNull(),
    symbol: text("symbol").notNull().unique().notNull(),
    timestamp: real("timestamp").notNull()
})

export const kyc = sqliteTable("kyc", {
    account: text("account").unique().primaryKey().notNull(),
    token: text("token").references(() => assets.token).notNull(),
})

export const transactions = sqliteTable("transactions", {
    hash: text("hash").unique().primaryKey().notNull(),
    account: text("account").notNull(),
    token: text("token").notNull(),
    amount: real("amount").notNull(),
    type: text("type").notNull(),
    timestamp: real("timestamp").notNull()
})

// Comprehensive Transaction History Table
export const transactionHistory = sqliteTable("transaction_history", {
    id: text("id").unique().primaryKey().notNull(),
    type: text("type").notNull(), // purchase, sale, distribution, loan, withdrawal, etc.
    amount: integer("amount").notNull(), // Amount in smallest unit (cents for USDC)
    asset: text("asset").notNull(), // USDC, KES, grove token symbol
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    status: text("status").notNull(), // pending, completed, failed, cancelled
    timestamp: integer("timestamp").notNull(),
    transactionHash: text("transaction_hash"),
    blockExplorerUrl: text("block_explorer_url"),
    metadata: text("metadata"), // JSON string for additional data
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        fromAddressIdx: index("transaction_history_from_idx").on(table.fromAddress),
        toAddressIdx: index("transaction_history_to_idx").on(table.toAddress),
        typeIdx: index("transaction_history_type_idx").on(table.type),
        statusIdx: index("transaction_history_status_idx").on(table.status),
        timestampIdx: index("transaction_history_timestamp_idx").on(table.timestamp)
    }
})

export const prices = sqliteTable("prices", {
    id: text("id").unique().primaryKey().notNull(),
    token: text("token").references(() => assets.token).notNull(),
    price: real("price").notNull(),
    timestamp: real("timestamp").notNull()
})

export const lendingReserves = sqliteTable("lendingReserves", {
    token: text("token").unique().primaryKey().notNull(),
    asset: text("asset").notNull().references(() => assets.token),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    timestamp: real("timestamp").notNull()
})

export const loans = sqliteTable("loans", {
    id: text("id").unique().primaryKey().notNull(),
    account: text("account").notNull(),
    collateralAsset: text("collateralAsset").notNull().references(() => assets.token),
    loanAmountUSDC: real("loanAmount").notNull(),
    collateralAmount: real("collateralAmount").notNull(),
    liquidationPrice: real("liquidationPrice").notNull(),
    repaymentAmount: real("repaymentAmount").notNull(),
    timestamp: real("timestamp").notNull(),
    deadline: real("deadline").notNull(), // When loan must be repaid
    isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
    isRepaid: integer("isRepaid", { mode: 'boolean' }).default(false).notNull()
}, (table) => {
    return {
        accountIdx: index("loans_account_idx").on(table.account),
        isActiveIdx: index("loans_is_active_idx").on(table.isActive)
    }
})

export const liquidations = sqliteTable("liquidations", {
    id: text("id").unique().primaryKey().notNull(),
    loanId: text("loanId").notNull().references(() => loans.id),
    account: text("account").notNull(),
    timestamp: real("timestamp").notNull()
})

export const loanRepayment = sqliteTable("loanRepayment", {
    id: text("id").unique().primaryKey().notNull(),
    loanId: text("loanId").notNull().references(() => loans.id),
    token: text("token").notNull().references(() => assets.token),
    account: text("account").notNull(),
    timestamp: real("timestamp").notNull(),
    paymentCategory: text("paymentCategory").notNull(), // 'early', 'on_time', 'late'
    daysEarlyLate: real("daysEarlyLate").notNull(), // Positive = late, Negative = early
    loanDuration: real("loanDuration").notNull(), // In days
    deadline: real("deadline").notNull() // Original loan deadline
}, (table) => {
    return {
        accountIdx: index("loan_repayment_account_idx").on(table.account),
        loanIdIdx: index("loan_repayment_loan_idx").on(table.loanId)
    }
})

export const providedLiquidity = sqliteTable("providedLiquidity", {
    id: text("id").unique().primaryKey().notNull(),
    asset: text("asset").notNull().references(() => assets.token),
    amount: real("amount").notNull(),
    account: text("account").notNull(),
    timestamp: real("timestamp").notNull()
})

export const withdrawnLiquidity = sqliteTable("withdrawnLiquidity", {
    id: text("id").unique().primaryKey().notNull(),
    asset: text("asset").notNull().references(() => assets.token),
    amount: real("amount").notNull(),
    account: text("account").notNull(),
    timestamp: real("timestamp").notNull()
})

// Credit Scoring System Tables
export const creditScores = sqliteTable("creditScores", {
    account: text("account").unique().primaryKey().notNull(),
    currentScore: integer("currentScore").default(500).notNull(),
    totalLoans: integer("totalLoans").default(0).notNull(),
    onTimePayments: integer("onTimePayments").default(0).notNull(),
    earlyPayments: integer("earlyPayments").default(0).notNull(),
    latePayments: integer("latePayments").default(0).notNull(),
    lastUpdated: real("lastUpdated").notNull(),
    createdAt: real("createdAt").notNull()
}, (table) => {
    return {
        accountIdx: index("credit_scores_account_idx").on(table.account),
        scoreIdx: index("credit_scores_score_idx").on(table.currentScore)
    }
})

export const realwordAssetTimeseries = sqliteTable("realwordAssetTimeseries", {
    id: text("id").unique().primaryKey().notNull(),
    open: real("open").notNull(),
    close: real("close").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    net: real("net").notNull(),
    gross: real("gross").notNull(),
    timestamp: real("timestamp").notNull(),
    asset: text("asset").notNull()
})

// Coffee Tree specific tables
export const coffeeGroves = sqliteTable("coffee_groves", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveName: text("grove_name").unique().notNull(),
    farmerAddress: text("farmer_address").notNull(),
    tokenAddress: text("token_address").unique(),
    tokenSymbol: text("token_symbol"),
    location: text("location").notNull(),
    coordinatesLat: real("coordinates_lat"),
    coordinatesLng: real("coordinates_lng"),
    treeCount: integer("tree_count").notNull(),
    coffeeVariety: text("coffee_variety").notNull(),
    plantingDate: integer("planting_date"),
    expectedYieldPerTree: integer("expected_yield_per_tree"),
    totalTokensIssued: integer("total_tokens_issued"),
    tokensSold: integer("tokens_sold").default(0).notNull(),
    tokensPerTree: integer("tokens_per_tree"),
    verificationStatus: text("verification_status").default("pending"),
    currentHealthScore: integer("current_health_score"),
    isTokenized: integer("is_tokenized", { mode: 'boolean' }).default(false),
    tokenizedAt: integer("tokenized_at"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        farmerAddressIdx: index("coffee_groves_farmer_address_idx").on(table.farmerAddress),
        groveNameIdx: index("coffee_groves_name_idx").on(table.groveName),
        tokensSoldIdx: index("coffee_groves_tokens_sold_idx").on(table.tokensSold)
    }
});

export const harvestRecords = sqliteTable("harvest_records", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    harvestDate: integer("harvest_date").notNull(),
    yieldKg: integer("yield_kg").notNull(),
    qualityGrade: integer("quality_grade").notNull(),
    salePricePerKg: integer("sale_price_per_kg").notNull(),
    totalRevenue: integer("total_revenue").notNull(),
    farmerShare: integer("farmer_share").notNull(),
    investorShare: integer("investor_share").notNull(),
    revenueDistributed: integer("revenue_distributed", { mode: 'boolean' }).default(false),
    transactionHash: text("transaction_hash"),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        groveIdIdx: index("harvest_records_grove_id_idx").on(table.groveId),
        harvestDateIdx: index("harvest_records_date_idx").on(table.harvestDate),
        revenueDistributedIdx: index("harvest_records_distributed_idx").on(table.revenueDistributed),

    }
});

export const tokenHoldings = sqliteTable("token_holdings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    holderAddress: text("holderAddress").notNull(),
    groveId: integer("groveId").notNull().references(() => coffeeGroves.id),
    tokenAmount: integer("tokenAmount").notNull(),
    purchasePrice: integer("purchasePrice").notNull(),
    purchaseDate: integer("purchaseDate").notNull(),
    isActive: integer("isActive", { mode: 'boolean' }).default(true)
}, (table) => {
    return {
        holderAddressIdx: index("token_holdings_holder_address_idx").on(table.holderAddress),
        groveIdIdx: index("token_holdings_grove_id_idx").on(table.groveId),
        isActiveIdx: index("token_holdings_is_active_idx").on(table.isActive)
    }
})


export const revenueDistributions = sqliteTable("revenue_distributions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    harvestId: integer("harvestId").notNull().references(() => harvestRecords.id),
    holderAddress: text("holderAddress").notNull(),
    tokenAmount: integer("tokenAmount").notNull(),
    revenueShare: integer("revenueShare").notNull(),
    distributionDate: integer("distributionDate").notNull(),
    transactionHash: text("transactionHash"),
    // Payment tracking fields
    paymentStatus: text("payment_status"), // 'pending' | 'completed' | 'failed'
    transactionId: text("transaction_id"),
    paidAt: integer("paid_at")
}, (table) => {
    return {
        holderAddressIdx: index("revenue_distributions_holder_idx").on(table.holderAddress),
        harvestIdIdx: index("revenue_distributions_harvest_idx").on(table.harvestId),
        paymentStatusIdx: index("revenue_distributions_payment_status_idx").on(table.paymentStatus)
    }
})

export const farmerVerifications = sqliteTable("farmer_verifications", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    farmerAddress: text("farmer_address").unique().notNull(),
    verificationStatus: text("verification_status").default("pending"),
    documentsHash: text("documents_hash"),
    verifierAddress: text("verifier_address"),
    verificationDate: integer("verification_date"),
    rejectionReason: text("rejection_reason"),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        farmerAddressIdx: index("farmer_verifications_address_idx").on(table.farmerAddress),
        verificationStatusIdx: index("farmer_verifications_status_idx").on(table.verificationStatus),
    }
});

export const farmers = sqliteTable("farmers", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    address: text("address").unique().notNull(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    location: text("location"),
    verificationStatus: text("verification_status").default("pending"),
    createdAt: integer("created_at").default(Date.now()),
    termsAcceptedAt: integer("terms_accepted_at"),
    termsVersion: text("terms_version"),
    termsIpAddress: text("terms_ip_address")
})

export const marketAlerts = sqliteTable("market_alerts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    farmerAddress: text("farmer_address").notNull(),
    alertType: text("alert_type").notNull(), // PRICE_SPIKE, PRICE_DROP, VOLATILITY, SEASONAL_CHANGE
    variety: integer("variety").notNull(), // CoffeeVariety enum value
    grade: integer("grade").notNull(),
    currentPrice: integer("current_price").notNull(), // Price in cents
    previousPrice: integer("previous_price").notNull(), // Price in cents
    changePercent: integer("change_percent").notNull(), // Percentage * 100
    message: text("message").notNull(),
    sentAt: integer("sent_at").notNull(),
    channel: text("channel").notNull(), // email, sms, push
    acknowledged: integer("acknowledged", { mode: 'boolean' }).default(false)
})

export const priceHistory = sqliteTable("price_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variety: integer("variety").notNull(), // CoffeeVariety enum value
    grade: integer("grade").notNull(),
    price: integer("price").notNull(), // Price in cents
    source: text("source").notNull(), // ICE, CME, CoffeeExchange, etc.
    region: text("region"),
    timestamp: integer("timestamp").notNull(),
    createdAt: integer("created_at").default(Date.now())
})

// Tree Monitoring System Tables
export const iotSensorData = sqliteTable("iot_sensor_data", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    sensorId: text("sensor_id").notNull(),
    sensorType: text("sensor_type").notNull(), // 'soil_moisture', 'temperature', 'humidity', 'ph', 'light', 'rainfall'
    value: real("value").notNull(),
    unit: text("unit").notNull(), // '%', 'C', 'F', 'pH', 'lux', 'mm'
    locationLat: real("location_lat"),
    locationLng: real("location_lng"),
    timestamp: integer("timestamp").notNull(),
    createdAt: integer("created_at").default(Date.now())
})

export const treeHealthRecords = sqliteTable("tree_health_records", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    healthScore: integer("health_score").notNull(),
    assessmentDate: integer("assessment_date").notNull(),
    soilMoistureScore: integer("soil_moisture_score"),
    temperatureScore: integer("temperature_score"),
    humidityScore: integer("humidity_score"),
    phScore: integer("ph_score"),
    lightScore: integer("light_score"),
    rainfallScore: integer("rainfall_score"),
    riskFactors: text("risk_factors"), // JSON array
    recommendations: text("recommendations"), // JSON array
    yieldImpactProjection: real("yield_impact_projection"),
    createdAt: integer("created_at").default(Date.now())
})

export const environmentalAlerts = sqliteTable("environmental_alerts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    sensorDataId: integer("sensor_data_id").references(() => iotSensorData.id),
    healthRecordId: integer("health_record_id").references(() => treeHealthRecords.id),
    farmerNotified: integer("farmer_notified", { mode: 'boolean' }).default(false),
    investorNotified: integer("investor_notified", { mode: 'boolean' }).default(false),
    acknowledged: integer("acknowledged", { mode: 'boolean' }).default(false),
    resolved: integer("resolved", { mode: 'boolean' }).default(false),
    createdAt: integer("created_at").default(Date.now()),
    resolvedAt: integer("resolved_at")
})

export const maintenanceActivities = sqliteTable("maintenance_activities", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    farmerAddress: text("farmer_address").notNull(),
    activityType: text("activity_type").notNull(),
    description: text("description").notNull(),
    cost: real("cost"),
    materialsUsed: text("materials_used"), // JSON array
    areaTreated: real("area_treated"),
    weatherConditions: text("weather_conditions"),
    notes: text("notes"),
    activityDate: integer("activity_date").notNull(),
    createdAt: integer("created_at").default(Date.now())
})

export const sensorConfigurations = sqliteTable("sensor_configurations", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    sensorType: text("sensor_type").notNull(),
    optimalMin: real("optimal_min").notNull(),
    optimalMax: real("optimal_max").notNull(),
    warningMin: real("warning_min").notNull(),
    warningMax: real("warning_max").notNull(),
    criticalMin: real("critical_min").notNull(),
    criticalMax: real("critical_max").notNull(),
    unit: text("unit").notNull(),
    readingFrequency: integer("reading_frequency").notNull(),
    alertThresholdCount: integer("alert_threshold_count").default(3),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
})

// Investor Verification System Tables
export const investorVerifications = sqliteTable("investor_verifications", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    investorAddress: text("investor_address").unique().notNull(),
    verificationStatus: text("verification_status").default("unverified"),
    verificationType: text("verification_type"),
    documentsHash: text("documents_hash"),
    identityDocumentHash: text("identity_document_hash"),
    proofOfAddressHash: text("proof_of_address_hash"),
    financialStatementHash: text("financial_statement_hash"),
    accreditationProofHash: text("accreditation_proof_hash"),
    verifierAddress: text("verifier_address"),
    verificationDate: integer("verification_date"),
    expiryDate: integer("expiry_date"),
    rejectionReason: text("rejection_reason"),
    accessLevel: text("access_level").default("none"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
})

export const investorVerificationHistory = sqliteTable("investor_verification_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    verificationId: integer("verification_id").notNull().references(() => investorVerifications.id),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    actionType: text("action_type").notNull(),
    verifierAddress: text("verifier_address"),
    reason: text("reason"),
    timestamp: integer("timestamp").default(Date.now())
})

export const investorProfiles = sqliteTable("investor_profiles", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    investorAddress: text("investor_address").unique().notNull(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    country: text("country"),
    investorType: text("investor_type"),
    riskTolerance: text("risk_tolerance"),
    investmentPreferences: text("investment_preferences"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now()),
    termsAcceptedAt: integer("terms_accepted_at"),
    termsVersion: text("terms_version"),
    termsIpAddress: text("terms_ip_address")
})

export const userSettings = sqliteTable("user_settings", {
    account: text("account").unique().primaryKey().notNull(),
    skipFarmerVerification: integer("skip_farmer_verification", { mode: 'boolean' }).default(false),
    skipInvestorVerification: integer("skip_investor_verification", { mode: 'boolean' }).default(false),
    demoBypass: integer("demo_bypass", { mode: 'boolean' }).default(false),
    updatedAt: integer("updated_at").default(Date.now())
})

// Withdrawal tables
export const farmerWithdrawals = sqliteTable("farmer_withdrawals", {
    id: text("id").unique().primaryKey().notNull(),
    farmerAddress: text("farmer_address").notNull(),
    groveId: integer("grove_id").references(() => coffeeGroves.id),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
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
})

export const liquidityWithdrawals = sqliteTable("liquidity_withdrawals", {
    id: text("id").unique().primaryKey().notNull(),
    providerAddress: text("provider_address").notNull(),
    assetAddress: text("asset_address").notNull(),
    lpTokenAmount: integer("lp_token_amount").notNull(),
    usdcReturned: integer("usdc_returned").notNull(),
    rewardsEarned: integer("rewards_earned").notNull(),
    status: text("status").notNull(),
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
})

export const farmerBalances = sqliteTable("farmer_balances", {
    farmerAddress: text("farmer_address").unique().primaryKey().notNull(),
    availableBalance: integer("available_balance").notNull().default(0),
    pendingBalance: integer("pending_balance").notNull().default(0),
    totalEarned: integer("total_earned").notNull().default(0),
    totalWithdrawn: integer("total_withdrawn").notNull().default(0),
    lastWithdrawalAt: integer("last_withdrawal_at"),
    updatedAt: integer("updated_at").default(Date.now())
});

export const farmerGroveBalances = sqliteTable("farmer_grove_balances", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    farmerAddress: text("farmer_address").notNull(),
    groveId: integer("grove_id").notNull(),
    thisMonthDistributed: integer("this_month_distributed").notNull().default(0),
    availableBalance: integer("available_balance").notNull().default(0),
    pendingDistribution: integer("pending_distribution").notNull().default(0),
    totalWithdrawn: integer("total_withdrawn").notNull().default(0),
    totalEarned: integer("total_earned").notNull().default(0),
    lastWithdrawalAt: integer("last_withdrawal_at"),
    lastCalculatedAt: integer("last_calculated_at"),
    updatedAt: integer("updated_at").default(Date.now())
});

export const investorWithdrawals = sqliteTable("investor_withdrawals", {
    id: text("id").unique().primaryKey().notNull(),
    investorAddress: text("investor_address").notNull(),
    amount: integer("amount").notNull(), // In cents
    status: text("status").notNull(), // 'pending' | 'completed' | 'failed'
    transactionHash: text("transaction_hash"),
    transactionId: text("transaction_id"),
    blockExplorerUrl: text("block_explorer_url"),
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at").notNull(),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        investorAddressIdx: index("investor_withdrawals_investor_idx").on(table.investorAddress),
        statusIdx: index("investor_withdrawals_status_idx").on(table.status),
        requestedAtIdx: index("investor_withdrawals_requested_idx").on(table.requestedAt)
    }
});

// Export earnings and distribution tables
export * from "./earnings-distribution";


// Milestone-Based Funding Request System Tables

export const groveFundingPools = sqliteTable("grove_funding_pools", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    
    // Total investment tracking
    totalInvestment: integer("total_investment").notNull().default(0),
    
    // Upfront Operations milestone (40%)
    upfrontAllocated: integer("upfront_allocated").notNull().default(0),
    upfrontDisbursed: integer("upfront_disbursed").notNull().default(0),
    upfrontAvailable: integer("upfront_available").notNull().default(0),
    
    // Maintenance milestone (30%)
    maintenanceAllocated: integer("maintenance_allocated").notNull().default(0),
    maintenanceDisbursed: integer("maintenance_disbursed").notNull().default(0),
    maintenanceAvailable: integer("maintenance_available").notNull().default(0),
    
    // Harvest Preparation milestone (30%)
    harvestAllocated: integer("harvest_allocated").notNull().default(0),
    harvestDisbursed: integer("harvest_disbursed").notNull().default(0),
    harvestAvailable: integer("harvest_available").notNull().default(0),
    
    // Platform fees
    platformFeesCollected: integer("platform_fees_collected").notNull().default(0),
    
    // Timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
}, (table) => {
    return {
        groveIdx: index("funding_pools_grove_idx").on(table.groveId)
    }
});

export const fundingRequests = sqliteTable("funding_requests", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    farmerAddress: text("farmer_address").notNull(),
    
    // Request details
    milestoneType: text("milestone_type").notNull(), // 'upfront', 'maintenance', 'harvest'
    amountRequested: integer("amount_requested").notNull(),
    amountApproved: integer("amount_approved"),
    purpose: text("purpose").notNull(),
    
    // Status tracking
    status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'disbursed'
    
    // Admin review
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    adminNotes: text("admin_notes"),
    
    // Disbursement tracking
    transactionId: text("transaction_id"),
    disbursedAt: integer("disbursed_at"),
    platformFee: integer("platform_fee"),
    
    // Timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
}, (table) => {
    return {
        statusIdx: index("funding_requests_status_idx").on(table.status),
        groveIdx: index("funding_requests_grove_idx").on(table.groveId),
        farmerIdx: index("funding_requests_farmer_idx").on(table.farmerAddress),
        milestoneIdx: index("funding_requests_milestone_idx").on(table.milestoneType)
    }
});

export const fundingRequestDocuments = sqliteTable("funding_request_documents", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id").notNull().references(() => fundingRequests.id),
    
    // File metadata
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // 'invoice', 'receipt', 'contract', 'photo', 'report', 'other'
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    
    // Storage information
    storagePath: text("storage_path").notNull(),
    fileHash: text("file_hash").notNull(),
    
    // Timestamp
    uploadedAt: integer("uploaded_at").notNull()
}, (table) => {
    return {
        requestIdx: index("documents_request_idx").on(table.requestId)
    }
});

export const platformFees = sqliteTable("platform_fees", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id").notNull().references(() => fundingRequests.id),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    
    // Fee details
    feeAmount: integer("fee_amount").notNull(),
    feePercentage: real("fee_percentage").notNull().default(3.0),
    
    // Timestamp
    collectedAt: integer("collected_at").notNull()
}, (table) => {
    return {
        requestIdx: index("platform_fees_request_idx").on(table.requestId),
        groveIdx: index("platform_fees_grove_idx").on(table.groveId),
        dateIdx: index("platform_fees_date_idx").on(table.collectedAt)
    }
});


// ============================================
// ENHANCED LENDING SYSTEM TABLES
// ============================================

export const lendingLoans = sqliteTable("lending_loans", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loanId: text("loan_id").unique().notNull(),
    borrowerAccount: text("borrower_account").notNull(),
    assetAddress: text("asset_address").notNull(),
    loanAmountUsdc: real("loan_amount_usdc").notNull(),
    collateralAmount: real("collateral_amount").notNull(),
    collateralTokenId: text("collateral_token_id").notNull(),
    repaymentAmount: real("repayment_amount").notNull(),
    interestRate: real("interest_rate").notNull().default(0.10),
    collateralizationRatio: real("collateralization_ratio").notNull().default(1.25),
    liquidationThreshold: real("liquidation_threshold").notNull().default(0.90),
    liquidationPrice: real("liquidation_price"),
    healthFactor: real("health_factor").notNull().default(1.0),
    status: text("status").notNull().default('active'), // 'active', 'repaid', 'liquidated', 'defaulted'
    takenAt: integer("taken_at").notNull(),
    dueDate: integer("due_date").notNull(),
    repaidAt: integer("repaid_at"),
    liquidatedAt: integer("liquidated_at"),
    transactionHash: text("transaction_hash"),
    createdAt: integer("created_at").default(Date.now()),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        borrowerIdx: index("lending_loans_borrower_idx").on(table.borrowerAccount),
        statusIdx: index("lending_loans_status_idx").on(table.status),
        dueDateIdx: index("lending_loans_due_date_idx").on(table.dueDate),
        healthFactorIdx: index("lending_loans_health_factor_idx").on(table.healthFactor),
        takenAtIdx: index("lending_loans_taken_at_idx").on(table.takenAt)
    }
});

export const lendingLoanCollateral = sqliteTable("lending_loan_collateral", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loanId: text("loan_id").notNull(),
    tokenId: text("token_id").notNull(),
    amount: real("amount").notNull(),
    initialPrice: real("initial_price").notNull(),
    currentPrice: real("current_price"),
    lockedAt: integer("locked_at").notNull(),
    unlockedAt: integer("unlocked_at"),
    lockTransactionHash: text("lock_transaction_hash"),
    unlockTransactionHash: text("unlock_transaction_hash"),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        loanIdIdx: index("lending_collateral_loan_id_idx").on(table.loanId),
        tokenIdIdx: index("lending_collateral_token_id_idx").on(table.tokenId)
    }
});

export const lendingLoanPayments = sqliteTable("lending_loan_payments", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    paymentId: text("payment_id").unique().notNull(),
    loanId: text("loan_id").notNull(),
    borrowerAccount: text("borrower_account").notNull(),
    paymentAmount: real("payment_amount").notNull(),
    paymentType: text("payment_type").notNull(), // 'partial', 'full', 'interest_only', 'principal'
    remainingBalance: real("remaining_balance").notNull(),
    paidAt: integer("paid_at").notNull(),
    transactionHash: text("transaction_hash"),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        loanIdIdx: index("lending_payments_loan_id_idx").on(table.loanId),
        borrowerIdx: index("lending_payments_borrower_idx").on(table.borrowerAccount),
        paidAtIdx: index("lending_payments_paid_at_idx").on(table.paidAt)
    }
});

export const lendingLiquidations = sqliteTable("lending_liquidations", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    liquidationId: text("liquidation_id").unique().notNull(),
    loanId: text("loan_id").notNull(),
    borrowerAccount: text("borrower_account").notNull(),
    collateralTokenId: text("collateral_token_id").notNull(),
    collateralAmount: real("collateral_amount").notNull(),
    collateralValueAtLiquidation: real("collateral_value_at_liquidation").notNull(),
    usdcRecovered: real("usdc_recovered").notNull(),
    liquidationPenalty: real("liquidation_penalty").notNull().default(0.05),
    liquidationPrice: real("liquidation_price").notNull(),
    healthFactorAtLiquidation: real("health_factor_at_liquidation").notNull(),
    liquidatedAt: integer("liquidated_at").notNull(),
    liquidatorAccount: text("liquidator_account"),
    liquidatorReward: real("liquidator_reward"),
    transactionHash: text("transaction_hash"),
    createdAt: integer("created_at").default(Date.now())
}, (table) => {
    return {
        loanIdIdx: index("lending_liquidations_loan_id_idx").on(table.loanId),
        borrowerIdx: index("lending_liquidations_borrower_idx").on(table.borrowerAccount),
        liquidatedAtIdx: index("lending_liquidations_liquidated_at_idx").on(table.liquidatedAt)
    }
});

export const lendingLoanHealthHistory = sqliteTable("lending_loan_health_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loanId: text("loan_id").notNull(),
    healthFactor: real("health_factor").notNull(),
    collateralPrice: real("collateral_price").notNull(),
    collateralValue: real("collateral_value").notNull(),
    checkedAt: integer("checked_at").notNull()
}, (table) => {
    return {
        loanIdIdx: index("lending_health_loan_id_idx").on(table.loanId),
        checkedAtIdx: index("lending_health_checked_at_idx").on(table.checkedAt)
    }
});

export const lendingPoolStats = sqliteTable("lending_pool_stats", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetAddress: text("asset_address").unique().notNull(),
    totalLiquidity: real("total_liquidity").notNull().default(0),
    availableLiquidity: real("available_liquidity").notNull().default(0),
    totalBorrowed: real("total_borrowed").notNull().default(0),
    totalLpTokens: real("total_lp_tokens").notNull().default(0),
    utilizationRate: real("utilization_rate").notNull().default(0),
    currentApy: real("current_apy").notNull().default(0),
    totalInterestEarned: real("total_interest_earned").notNull().default(0),
    totalLoansOriginated: integer("total_loans_originated").notNull().default(0),
    totalLoansRepaid: integer("total_loans_repaid").notNull().default(0),
    totalLiquidations: integer("total_liquidations").notNull().default(0),
    updatedAt: integer("updated_at").default(Date.now())
}, (table) => {
    return {
        assetIdx: index("lending_pool_stats_asset_idx").on(table.assetAddress)
    }
});
