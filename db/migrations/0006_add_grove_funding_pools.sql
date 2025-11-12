-- Migration: Add grove_funding_pools table
-- Description: Tracks investment pools and milestone allocations for each grove
-- Created: 2024

CREATE TABLE IF NOT EXISTS grove_funding_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grove_id INTEGER NOT NULL,
    
    -- Total investment tracking
    total_investment INTEGER NOT NULL DEFAULT 0,  -- Total USDC raised (in cents)
    
    -- Upfront Operations milestone (40%)
    upfront_allocated INTEGER NOT NULL DEFAULT 0,
    upfront_disbursed INTEGER NOT NULL DEFAULT 0,
    upfront_available INTEGER NOT NULL DEFAULT 0,
    
    -- Maintenance milestone (30%)
    maintenance_allocated INTEGER NOT NULL DEFAULT 0,
    maintenance_disbursed INTEGER NOT NULL DEFAULT 0,
    maintenance_available INTEGER NOT NULL DEFAULT 0,
    
    -- Harvest Preparation milestone (30%)
    harvest_allocated INTEGER NOT NULL DEFAULT 0,
    harvest_disbursed INTEGER NOT NULL DEFAULT 0,
    harvest_available INTEGER NOT NULL DEFAULT 0,
    
    -- Platform fees
    platform_fees_collected INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (grove_id) REFERENCES coffee_groves(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_funding_pools_grove ON grove_funding_pools(grove_id);
