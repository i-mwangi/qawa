-- Migration: Add Earnings and Distribution Tables
-- Created: 2025-10-26
-- Description: Adds comprehensive tables for tracking farmer and investor earnings, distributions, and claims

-- Farmer Grove Earnings Table
CREATE TABLE IF NOT EXISTS farmer_grove_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_address TEXT NOT NULL,
    grove_id INTEGER NOT NULL REFERENCES coffee_groves(id),
    harvest_id INTEGER NOT NULL REFERENCES harvest_records(id),
    
    -- Earnings breakdown
    gross_revenue INTEGER NOT NULL,
    farmer_share INTEGER NOT NULL,
    
    -- Distribution status
    distribution_status TEXT NOT NULL DEFAULT 'pending',
    distributed_at INTEGER,
    withdrawn_at INTEGER,
    
    -- Transaction tracking
    distribution_tx_hash TEXT,
    withdrawal_tx_hash TEXT,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS farmer_grove_earnings_farmer_idx ON farmer_grove_earnings(farmer_address);
CREATE INDEX IF NOT EXISTS farmer_grove_earnings_grove_idx ON farmer_grove_earnings(grove_id);
CREATE INDEX IF NOT EXISTS farmer_grove_earnings_harvest_idx ON farmer_grove_earnings(harvest_id);
CREATE INDEX IF NOT EXISTS farmer_grove_earnings_status_idx ON farmer_grove_earnings(distribution_status);
CREATE INDEX IF NOT EXISTS farmer_grove_earnings_distributed_idx ON farmer_grove_earnings(distributed_at);

-- Investor Token Holdings Table (Enhanced)
CREATE TABLE IF NOT EXISTS investor_token_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investor_address TEXT NOT NULL,
    grove_id INTEGER NOT NULL REFERENCES coffee_groves(id),
    token_amount INTEGER NOT NULL,
    
    -- Market tracking
    acquisition_type TEXT NOT NULL,
    purchase_price INTEGER NOT NULL,
    purchase_date INTEGER NOT NULL,
    
    -- Secondary market tracking
    previous_owner TEXT,
    transfer_tx_hash TEXT,
    
    is_active INTEGER DEFAULT 1,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS investor_token_holdings_investor_idx ON investor_token_holdings(investor_address);
CREATE INDEX IF NOT EXISTS investor_token_holdings_grove_idx ON investor_token_holdings(grove_id);
CREATE INDEX IF NOT EXISTS investor_token_holdings_acquisition_idx ON investor_token_holdings(acquisition_type);
CREATE INDEX IF NOT EXISTS investor_token_holdings_active_idx ON investor_token_holdings(is_active);

-- Investor Earnings Table
CREATE TABLE IF NOT EXISTS investor_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investor_address TEXT NOT NULL,
    
    -- Source tracking
    earning_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    grove_id INTEGER REFERENCES coffee_groves(id),
    
    -- Token holding reference
    holding_id INTEGER REFERENCES investor_token_holdings(id),
    token_amount INTEGER,
    
    -- Earnings amount
    earning_amount INTEGER NOT NULL,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'unclaimed',
    claimed_at INTEGER,
    claim_tx_hash TEXT,
    
    -- Distribution tracking
    distributed_at INTEGER,
    distribution_tx_hash TEXT,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS investor_earnings_investor_idx ON investor_earnings(investor_address);
CREATE INDEX IF NOT EXISTS investor_earnings_type_idx ON investor_earnings(earning_type);
CREATE INDEX IF NOT EXISTS investor_earnings_status_idx ON investor_earnings(status);
CREATE INDEX IF NOT EXISTS investor_earnings_grove_idx ON investor_earnings(grove_id);
CREATE INDEX IF NOT EXISTS investor_earnings_distributed_idx ON investor_earnings(distributed_at);
CREATE INDEX IF NOT EXISTS investor_earnings_claimed_idx ON investor_earnings(claimed_at);

-- LP Token Interest Tracking Table
CREATE TABLE IF NOT EXISTS lp_token_interest (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_address TEXT NOT NULL,
    lp_token_address TEXT NOT NULL,
    asset_address TEXT NOT NULL,
    
    -- Interest calculation
    principal_amount INTEGER NOT NULL,
    interest_earned INTEGER NOT NULL,
    interest_rate INTEGER NOT NULL,
    
    -- Period tracking
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'accrued',
    claimed_at INTEGER,
    claim_tx_hash TEXT,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS lp_token_interest_provider_idx ON lp_token_interest(provider_address);
CREATE INDEX IF NOT EXISTS lp_token_interest_token_idx ON lp_token_interest(lp_token_address);
CREATE INDEX IF NOT EXISTS lp_token_interest_status_idx ON lp_token_interest(status);
CREATE INDEX IF NOT EXISTS lp_token_interest_period_idx ON lp_token_interest(period_end);

-- Investor Claims Table
CREATE TABLE IF NOT EXISTS investor_claims (
    id TEXT PRIMARY KEY NOT NULL,
    investor_address TEXT NOT NULL,
    
    -- Claim details
    claim_amount INTEGER NOT NULL,
    earning_ids TEXT NOT NULL,
    
    -- Transaction tracking
    status TEXT NOT NULL,
    transaction_hash TEXT,
    block_explorer_url TEXT,
    error_message TEXT,
    
    -- Gas fees
    gas_fee_amount INTEGER,
    
    requested_at INTEGER NOT NULL,
    completed_at INTEGER,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS investor_claims_investor_idx ON investor_claims(investor_address);
CREATE INDEX IF NOT EXISTS investor_claims_status_idx ON investor_claims(status);
CREATE INDEX IF NOT EXISTS investor_claims_requested_idx ON investor_claims(requested_at);

-- Investor Balance Summary Table
CREATE TABLE IF NOT EXISTS investor_balances (
    investor_address TEXT PRIMARY KEY NOT NULL,
    
    -- Earnings breakdown
    total_earnings_all_time INTEGER NOT NULL DEFAULT 0,
    total_earnings_this_month INTEGER NOT NULL DEFAULT 0,
    
    -- Unclaimed breakdown by source
    unclaimed_primary_market INTEGER NOT NULL DEFAULT 0,
    unclaimed_secondary_market INTEGER NOT NULL DEFAULT 0,
    unclaimed_lp_interest INTEGER NOT NULL DEFAULT 0,
    total_unclaimed INTEGER NOT NULL DEFAULT 0,
    
    -- Claimed
    total_claimed INTEGER NOT NULL DEFAULT 0,
    
    -- Tracking
    last_claim_at INTEGER,
    last_calculated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Farmer Grove Balances Table
CREATE TABLE IF NOT EXISTS farmer_grove_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_address TEXT NOT NULL,
    grove_id INTEGER NOT NULL REFERENCES coffee_groves(id),
    
    -- This month's distribution
    this_month_distributed INTEGER NOT NULL DEFAULT 0,
    
    -- Available balance (distributed but not withdrawn)
    available_balance INTEGER NOT NULL DEFAULT 0,
    
    -- Pending distribution (calculated but not distributed)
    pending_distribution INTEGER NOT NULL DEFAULT 0,
    
    -- Total withdrawn
    total_withdrawn INTEGER NOT NULL DEFAULT 0,
    
    -- Total earned all time
    total_earned INTEGER NOT NULL DEFAULT 0,
    
    last_withdrawal_at INTEGER,
    last_calculated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS farmer_grove_balances_farmer_idx ON farmer_grove_balances(farmer_address);
CREATE INDEX IF NOT EXISTS farmer_grove_balances_grove_idx ON farmer_grove_balances(grove_id);
CREATE UNIQUE INDEX IF NOT EXISTS farmer_grove_balances_unique_idx ON farmer_grove_balances(farmer_address, grove_id);

-- Secondary Market Transfers Table
CREATE TABLE IF NOT EXISTS secondary_market_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grove_id INTEGER NOT NULL REFERENCES coffee_groves(id),
    
    -- Transfer details
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    token_amount INTEGER NOT NULL,
    transfer_price INTEGER NOT NULL,
    
    -- Transaction tracking
    transaction_hash TEXT,
    status TEXT NOT NULL,
    
    transfer_date INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS secondary_market_transfers_grove_idx ON secondary_market_transfers(grove_id);
CREATE INDEX IF NOT EXISTS secondary_market_transfers_from_idx ON secondary_market_transfers(from_address);
CREATE INDEX IF NOT EXISTS secondary_market_transfers_to_idx ON secondary_market_transfers(to_address);
CREATE INDEX IF NOT EXISTS secondary_market_transfers_date_idx ON secondary_market_transfers(transfer_date);
