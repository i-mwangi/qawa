-- Migration: Add funding_request_documents table
-- Description: Stores metadata for uploaded documents supporting funding requests
-- Created: 2024

CREATE TABLE IF NOT EXISTS funding_request_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    
    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('invoice', 'receipt', 'contract', 'photo', 'report', 'other')),
    file_size INTEGER NOT NULL,  -- In bytes
    mime_type TEXT NOT NULL,
    
    -- Storage information
    storage_path TEXT NOT NULL,  -- Path to file in storage
    file_hash TEXT NOT NULL,  -- SHA-256 hash for integrity verification
    
    -- Timestamp
    uploaded_at INTEGER NOT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (request_id) REFERENCES funding_requests(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_request ON funding_request_documents(request_id);
