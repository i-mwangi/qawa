-- Migration: Add Investor Withdrawals and Payment Tracking
-- Created: 2025-11-09
-- Description: Adds investor_withdrawals table and payment tracking fields to revenue_distributions

-- Investor Withdrawals Table
CREATE TABLE IF NOT EXISTS investor_withdrawals (
    id TEXT PRIMARY KEY NOT NULL,
    investor_address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL,
    transaction_hash TEXT,
    transaction_id TEXT,
    block_explorer_url TEXT,
    error_message TEXT,
    requested_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);


CREATE INDEX IF NOT EXISTS investor_withdrawals_investor_idx ON investor_withdrawals(investor_address);

CREATE INDEX IF NOT EXISTS investor_withdrawals_status_idx ON investor_withdrawals(status);

CREATE INDEX IF NOT EXISTS investor_withdrawals_requested_idx ON investor_withdrawals(requested_at);


-- Add payment tracking fields to revenue_distributions table
ALTER TABLE revenue_distributions ADD COLUMN payment_status TEXT;

ALTER TABLE revenue_distributions ADD COLUMN transaction_id TEXT;

ALTER TABLE revenue_distributions ADD COLUMN paid_at INTEGER;

CREATE INDEX IF NOT EXISTS revenue_distributions_payment_status_idx ON revenue_distributions(payment_status);

CREATE INDEX IF NOT EXISTS revenue_distributions_holder_idx ON revenue_distributions(holderAddress);

CREATE INDEX IF NOT EXISTS revenue_distributions_harvest_idx ON revenue_distributions(harvestId);
