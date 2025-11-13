-- Migration: Add Terms and Conditions Acceptance Tracking
-- Created: 2025-11-13
-- Description: Adds fields to track when users accept Terms and Conditions

-- Add terms acceptance fields to farmers table
ALTER TABLE farmers ADD COLUMN terms_accepted_at INTEGER;
ALTER TABLE farmers ADD COLUMN terms_version TEXT;
ALTER TABLE farmers ADD COLUMN terms_ip_address TEXT;

-- Add terms acceptance fields to investor_profiles table
ALTER TABLE investor_profiles ADD COLUMN terms_accepted_at INTEGER;
ALTER TABLE investor_profiles ADD COLUMN terms_version TEXT;
ALTER TABLE investor_profiles ADD COLUMN terms_ip_address TEXT;

-- Note: terms_accepted_at stores Unix timestamp (milliseconds)
-- terms_version stores the version of terms accepted (e.g., "1.0")
-- terms_ip_address stores the IP address from which terms were accepted (for audit trail)
