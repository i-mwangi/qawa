-- Migration: Add funding_requests table
-- Description: Stores all funding requests from farmers with review and disbursement tracking
-- Created: 2024

CREATE TABLE IF NOT EXISTS funding_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grove_id INTEGER NOT NULL,
    farmer_address TEXT NOT NULL,
    
    -- Request details
    milestone_type TEXT NOT NULL CHECK(milestone_type IN ('upfront', 'maintenance', 'harvest')),
    amount_requested INTEGER NOT NULL,  -- In cents
    amount_approved INTEGER,  -- Actual approved amount (may differ from requested)
    purpose TEXT NOT NULL,  -- Description of fund usage
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'disbursed')),
    
    -- Admin review
    reviewed_by TEXT,  -- Admin account ID
    reviewed_at INTEGER,
    rejection_reason TEXT,
    admin_notes TEXT,
    
    -- Disbursement tracking
    transaction_id TEXT,  -- Hedera transaction ID
    disbursed_at INTEGER,
    platform_fee INTEGER,  -- 3% fee in cents
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (grove_id) REFERENCES coffee_groves(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_funding_requests_status ON funding_requests(status);
CREATE INDEX IF NOT EXISTS idx_funding_requests_grove ON funding_requests(grove_id);
CREATE INDEX IF NOT EXISTS idx_funding_requests_farmer ON funding_requests(farmer_address);
CREATE INDEX IF NOT EXISTS idx_funding_requests_milestone ON funding_requests(milestone_type);
