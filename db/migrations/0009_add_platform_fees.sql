-- Migration: Add platform_fees table
-- Description: Tracks platform fee collection for reporting and analytics
-- Created: 2024

CREATE TABLE IF NOT EXISTS platform_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    grove_id INTEGER NOT NULL,
    
    -- Fee details
    fee_amount INTEGER NOT NULL,  -- In cents
    fee_percentage REAL NOT NULL DEFAULT 3.0,
    
    -- Timestamp
    collected_at INTEGER NOT NULL,
    
    -- Foreign key constraints
    FOREIGN KEY (request_id) REFERENCES funding_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (grove_id) REFERENCES coffee_groves(id) ON DELETE CASCADE
);

-- Create indexes for reporting queries
CREATE INDEX IF NOT EXISTS idx_platform_fees_request ON platform_fees(request_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_grove ON platform_fees(grove_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_date ON platform_fees(collected_at);
