/**
 * Request Validation Middleware
 * 
 * Provides validation utilities for API requests
 */

import { IncomingMessage, ServerResponse } from 'http'

/**
 * Validate account ID in request parameter
 * @param accountId - Account ID from request
 * @param res - Server response object
 * @returns boolean - true if valid, false if invalid (response already sent)
 */
export function validateAccountIdParam(accountId: string, res: ServerResponse): boolean {
  if (!accountId || accountId.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Account ID is required'
    }))
    return false
  }
  
  // Hedera account format: X.X.X where X is a number
  const hederaAccountRegex = /^\d+\.\d+\.\d+$/
  if (!hederaAccountRegex.test(accountId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: `Invalid account ID format: ${accountId}. Expected format: X.X.X (e.g., 0.0.123456)`
    }))
    return false
  }
  
  return true
}

/**
 * Validate user settings update request body
 * @param body - Request body
 * @param res - Server response object
 * @returns boolean - true if valid, false if invalid (response already sent)
 */
export function validateUserSettingsBody(body: any, res: ServerResponse): boolean {
  if (!body || typeof body !== 'object') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Request body must be a valid JSON object'
    }))
    return false
  }
  
  // Validate boolean flags if present
  const validBooleanKeys = ['skipFarmerVerification', 'skipInvestorVerification', 'demoBypass']
  for (const key of Object.keys(body)) {
    if (validBooleanKeys.includes(key)) {
      const value = body[key]
      if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: `Invalid value for ${key}: expected boolean, got ${typeof value}`
        }))
        return false
      }
    }
  }
  
  return true
}

/**
 * Ensure table exists with automatic creation fallback
 * @param db - Database instance
 * @returns Promise<void>
 */
export async function ensureUserSettingsTable(db: any): Promise<void> {
  // Skip for in-memory database
  if ((db as any).__dumpStorage) {
    return
  }
  
  try {
    // Try to create table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_settings (
        account TEXT PRIMARY KEY NOT NULL,
        skip_farmer_verification INTEGER DEFAULT 0,
        skip_investor_verification INTEGER DEFAULT 0,
        demo_bypass INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
  } catch (error) {
    // Table might already exist, log warning but don't fail
    console.warn('[Validation] Could not create user_settings table:', error)
  }
}
