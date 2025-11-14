-- Migration: Add Lending & Loan Tables
-- Created: 2024
-- Description: Complete schema for lending pools, loans, collateral, payments, and liquidations

-- ============================================
-- LOANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    borrower_account TEXT NOT NULL,
    asset_address TEXT NOT NULL,
    loan_amount_usdc REAL NOT NULL,
    collateral_amount REAL NOT NULL,
    collateral_token_id TEXT NOT NULL,
    repayment_amount REAL NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0.10,
    collateralization_ratio REAL NOT NULL DEFAULT 1.25,
    liquidation_threshold REAL NOT NULL DEFAULT 0.90,
    liquidation_price REAL,
    health_factor REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'repaid', 'liquidated', 'defaulted'
    taken_at INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    repaid_at INTEGER,
    liquidated_at INTEGER,
    transaction_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================
-- LOAN COLLATERAL TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS loan_collateral (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT NOT NULL,
    token_id TEXT NOT NULL,
    amount REAL NOT NULL,
    initial_price REAL NOT NULL,
    current_price REAL,
    locked_at INTEGER NOT NULL,
    unlocked_at INTEGER,
    lock_transaction_hash TEXT,
    unlock_transaction_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE
);

-- ============================================
-- LOAN PAYMENT HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    loan_id TEXT NOT NULL,
    borrower_account TEXT NOT NULL,
    payment_amount REAL NOT NULL,
    payment_type TEXT NOT NULL, -- 'partial', 'full', 'interest_only', 'principal'
    remaining_balance REAL NOT NULL,
    paid_at INTEGER NOT NULL,
    transaction_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE
);

-- ============================================
-- LIQUIDATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS liquidations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    liquidation_id TEXT UNIQUE NOT NULL,
    loan_id TEXT NOT NULL,
    borrower_account TEXT NOT NULL,
    collateral_token_id TEXT NOT NULL,
    collateral_amount REAL NOT NULL,
    collateral_value_at_liquidation REAL NOT NULL,
    usdc_recovered REAL NOT NULL,
    liquidation_penalty REAL NOT NULL DEFAULT 0.05,
    liquidation_price REAL NOT NULL,
    health_factor_at_liquidation REAL NOT NULL,
    liquidated_at INTEGER NOT NULL,
    liquidator_account TEXT,
    liquidator_reward REAL,
    transaction_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE
);

-- ============================================
-- LOAN HEALTH HISTORY (for monitoring)
-- ============================================
CREATE TABLE IF NOT EXISTS loan_health_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT NOT NULL,
    health_factor REAL NOT NULL,
    collateral_price REAL NOT NULL,
    collateral_value REAL NOT NULL,
    checked_at INTEGER NOT NULL,
    FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE
);

-- ============================================
-- LENDING POOL STATISTICS (enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS lending_pool_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_address TEXT NOT NULL,
    total_liquidity REAL NOT NULL DEFAULT 0,
    available_liquidity REAL NOT NULL DEFAULT 0,
    total_borrowed REAL NOT NULL DEFAULT 0,
    total_lp_tokens REAL NOT NULL DEFAULT 0,
    utilization_rate REAL NOT NULL DEFAULT 0,
    current_apy REAL NOT NULL DEFAULT 0,
    total_interest_earned REAL NOT NULL DEFAULT 0,
    total_loans_originated INTEGER NOT NULL DEFAULT 0,
    total_loans_repaid INTEGER NOT NULL DEFAULT 0,
    total_liquidations INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(asset_address)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Loans indexes
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_account);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_health_factor ON loans(health_factor);
CREATE INDEX IF NOT EXISTS idx_loans_taken_at ON loans(taken_at);

-- Collateral indexes
CREATE INDEX IF NOT EXISTS idx_loan_collateral_loan_id ON loan_collateral(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_collateral_token_id ON loan_collateral(token_id);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_borrower ON loan_payments(borrower_account);
CREATE INDEX IF NOT EXISTS idx_loan_payments_paid_at ON loan_payments(paid_at);

-- Liquidation indexes
CREATE INDEX IF NOT EXISTS idx_liquidations_loan_id ON liquidations(loan_id);
CREATE INDEX IF NOT EXISTS idx_liquidations_borrower ON liquidations(borrower_account);
CREATE INDEX IF NOT EXISTS idx_liquidations_liquidated_at ON liquidations(liquidated_at);

-- Health history indexes
CREATE INDEX IF NOT EXISTS idx_loan_health_loan_id ON loan_health_history(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_health_checked_at ON loan_health_history(checked_at);

-- Pool stats indexes
CREATE INDEX IF NOT EXISTS idx_pool_stats_asset ON lending_pool_stats(asset_address);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATING
-- ============================================

-- Update loans.updated_at on any change
CREATE TRIGGER IF NOT EXISTS update_loans_timestamp 
AFTER UPDATE ON loans
BEGIN
    UPDATE loans SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Update pool stats when loan is created
CREATE TRIGGER IF NOT EXISTS update_pool_on_loan_create
AFTER INSERT ON loans
BEGIN
    UPDATE lending_pool_stats 
    SET 
        total_borrowed = total_borrowed + NEW.loan_amount_usdc,
        available_liquidity = available_liquidity - NEW.loan_amount_usdc,
        utilization_rate = CASE 
            WHEN total_liquidity > 0 THEN (total_borrowed + NEW.loan_amount_usdc) / total_liquidity 
            ELSE 0 
        END,
        total_loans_originated = total_loans_originated + 1,
        updated_at = unixepoch()
    WHERE asset_address = NEW.asset_address;
END;

-- Update pool stats when loan is repaid
CREATE TRIGGER IF NOT EXISTS update_pool_on_loan_repay
AFTER UPDATE OF status ON loans
WHEN NEW.status = 'repaid' AND OLD.status = 'active'
BEGIN
    UPDATE lending_pool_stats 
    SET 
        total_borrowed = total_borrowed - NEW.loan_amount_usdc,
        available_liquidity = available_liquidity + NEW.repayment_amount,
        utilization_rate = CASE 
            WHEN total_liquidity > 0 THEN (total_borrowed - NEW.loan_amount_usdc) / total_liquidity 
            ELSE 0 
        END,
        total_interest_earned = total_interest_earned + (NEW.repayment_amount - NEW.loan_amount_usdc),
        total_loans_repaid = total_loans_repaid + 1,
        updated_at = unixepoch()
    WHERE asset_address = NEW.asset_address;
END;

-- Update pool stats when loan is liquidated
CREATE TRIGGER IF NOT EXISTS update_pool_on_loan_liquidate
AFTER UPDATE OF status ON loans
WHEN NEW.status = 'liquidated' AND OLD.status = 'active'
BEGIN
    UPDATE lending_pool_stats 
    SET 
        total_borrowed = total_borrowed - NEW.loan_amount_usdc,
        total_liquidations = total_liquidations + 1,
        updated_at = unixepoch()
    WHERE asset_address = NEW.asset_address;
END;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Initialize USDC lending pool stats
INSERT OR IGNORE INTO lending_pool_stats (
    asset_address,
    total_liquidity,
    available_liquidity,
    total_borrowed,
    total_lp_tokens,
    utilization_rate,
    current_apy
) VALUES (
    'USDC',
    0,
    0,
    0,
    0,
    0,
    0.12
);

-- Initialize KES lending pool stats (if needed)
INSERT OR IGNORE INTO lending_pool_stats (
    asset_address,
    total_liquidity,
    available_liquidity,
    total_borrowed,
    total_lp_tokens,
    utilization_rate,
    current_apy
) VALUES (
    'KES',
    0,
    0,
    0,
    0,
    0,
    0.15
);
