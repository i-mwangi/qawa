/**
 * User Settings Service
 * 
 * Handles user settings CRUD operations with validation, caching,
 * and error recovery mechanisms.
 */

import { db } from '../db/index.js'
import { userSettings } from '../db/schema/index.js'
import { eq } from 'drizzle-orm'
import { settingsCache } from '../lib/settings-cache.js'
import {
  withRetry,
  withFallback,
  isTableNotFoundError,
  logError
} from '../lib/error-recovery.js'

export interface UserSettings {
  account: string
  skipFarmerVerification: boolean
  skipInvestorVerification: boolean
  demoBypass: boolean
  updatedAt: number
}

/**
 * Default settings configuration
 * These values are used when creating new user accounts
 * Can be overridden via environment variables
 */
export interface DefaultSettingsConfig {
  skipFarmerVerification: boolean
  skipInvestorVerification: boolean
  demoBypass: boolean
}

/**
 * Hardcoded fallback defaults
 * Used when configuration is invalid or missing
 */
const FALLBACK_DEFAULTS: DefaultSettingsConfig = {
  skipFarmerVerification: false,
  skipInvestorVerification: false,
  demoBypass: false
}

/**
 * Current default settings configuration
 * Can be updated at runtime via setDefaultSettingsConfig()
 */
let defaultSettingsConfig: DefaultSettingsConfig = { ...FALLBACK_DEFAULTS }

/**
 * Load default settings from environment variables
 * Environment variables take precedence over hardcoded defaults
 */
function loadDefaultsFromEnvironment(): DefaultSettingsConfig {
  const config: DefaultSettingsConfig = { ...FALLBACK_DEFAULTS }

  // Load from environment variables if present
  if (process.env.DEFAULT_SKIP_FARMER_VERIFICATION !== undefined) {
    config.skipFarmerVerification = process.env.DEFAULT_SKIP_FARMER_VERIFICATION === 'true'
  }

  if (process.env.DEFAULT_SKIP_INVESTOR_VERIFICATION !== undefined) {
    config.skipInvestorVerification = process.env.DEFAULT_SKIP_INVESTOR_VERIFICATION === 'true'
  }

  if (process.env.DEFAULT_DEMO_BYPASS !== undefined) {
    config.demoBypass = process.env.DEFAULT_DEMO_BYPASS === 'true'
  }

  return config
}

// Initialize default settings from environment on module load
defaultSettingsConfig = loadDefaultsFromEnvironment()

/**
 * Get the current default settings configuration
 * @returns DefaultSettingsConfig
 */
export function getDefaultSettingsConfig(): DefaultSettingsConfig {
  return { ...defaultSettingsConfig }
}

/**
 * Set the default settings configuration
 * This affects only new accounts created after this call
 * Existing user settings are not modified
 * @param config - New default settings configuration
 * @throws Error if configuration is invalid
 */
export function setDefaultSettingsConfig(config: Partial<DefaultSettingsConfig>): void {
  // Validate configuration
  const validKeys = ['skipFarmerVerification', 'skipInvestorVerification', 'demoBypass']
  
  for (const key of Object.keys(config)) {
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid configuration key: ${key}. Valid keys are: ${validKeys.join(', ')}`)
    }

    const value = (config as any)[key]
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid value for ${key}: expected boolean, got ${typeof value}`)
    }
  }

  // Update configuration (merge with existing)
  defaultSettingsConfig = {
    ...defaultSettingsConfig,
    ...config
  }

  console.log('[UserSettings] Default settings configuration updated:', defaultSettingsConfig)
}

/**
 * Reset default settings to fallback values
 * Useful for testing or recovering from invalid configuration
 */
export function resetDefaultSettingsConfig(): void {
  defaultSettingsConfig = { ...FALLBACK_DEFAULTS }
  console.log('[UserSettings] Default settings configuration reset to fallback values')
}

/**
 * Initialize a new account with default settings
 * This creates a new settings record in the database
 * If settings already exist, returns the existing settings without modification
 * @param accountId - Hedera account ID
 * @returns Promise<UserSettings>
 */
export async function initializeAccountSettings(accountId: string): Promise<UserSettings> {
  // Validate account ID
  if (!validateAccountId(accountId)) {
    throw new Error(`Invalid account ID format: ${accountId}. Expected format: X.X.X (e.g., 0.0.123456)`)
  }

  try {
    // Check if settings already exist
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.account, accountId))
      .limit(1)

    if (existing.length > 0) {
      console.log(`[UserSettings] Account ${accountId} already has settings, returning existing settings`)
      const existingSettings: UserSettings = {
        account: existing[0].account,
        skipFarmerVerification: Boolean(existing[0].skipFarmerVerification),
        skipInvestorVerification: Boolean(existing[0].skipInvestorVerification),
        demoBypass: Boolean(existing[0].demoBypass),
        updatedAt: existing[0].updatedAt || Date.now()
      }

      // Cache the existing settings
      settingsCache.set(accountId, existingSettings)

      return existingSettings
    }

    // Create new settings with current defaults
    const now = Date.now()
    const newSettings = {
      account: accountId,
      skipFarmerVerification: defaultSettingsConfig.skipFarmerVerification,
      skipInvestorVerification: defaultSettingsConfig.skipInvestorVerification,
      demoBypass: defaultSettingsConfig.demoBypass,
      updatedAt: now
    }

    await db.insert(userSettings).values(newSettings)
    console.log(`[UserSettings] Initialized new account ${accountId} with default settings:`, defaultSettingsConfig)

    const result: UserSettings = {
      account: accountId,
      skipFarmerVerification: Boolean(newSettings.skipFarmerVerification),
      skipInvestorVerification: Boolean(newSettings.skipInvestorVerification),
      demoBypass: Boolean(newSettings.demoBypass),
      updatedAt: now
    }

    // Cache the new settings
    settingsCache.set(accountId, result)

    return result
  } catch (error) {
    // Check if it's a table not found error
    if (isTableNotFoundError(error)) {
      console.warn('[UserSettings] Table not found during initialization, attempting to create it')
      await ensureUserSettingsTable()

      // Check again if settings exist (might have been created by another process)
      const existing = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.account, accountId))
        .limit(1)

      if (existing.length > 0) {
        console.log(`[UserSettings] Account ${accountId} settings found after table creation`)
        const existingSettings: UserSettings = {
          account: existing[0].account,
          skipFarmerVerification: Boolean(existing[0].skipFarmerVerification),
          skipInvestorVerification: Boolean(existing[0].skipInvestorVerification),
          demoBypass: Boolean(existing[0].demoBypass),
          updatedAt: existing[0].updatedAt || Date.now()
        }

        settingsCache.set(accountId, existingSettings)
        return existingSettings
      }

      // Retry insert
      const now = Date.now()
      const newSettings = {
        account: accountId,
        skipFarmerVerification: defaultSettingsConfig.skipFarmerVerification,
        skipInvestorVerification: defaultSettingsConfig.skipInvestorVerification,
        demoBypass: defaultSettingsConfig.demoBypass,
        updatedAt: now
      }

      await db.insert(userSettings).values(newSettings)
      console.log(`[UserSettings] Successfully initialized account ${accountId} after table recovery`)

      const result: UserSettings = {
        account: accountId,
        skipFarmerVerification: Boolean(newSettings.skipFarmerVerification),
        skipInvestorVerification: Boolean(newSettings.skipInvestorVerification),
        demoBypass: Boolean(newSettings.demoBypass),
        updatedAt: now
      }

      settingsCache.set(accountId, result)
      return result
    }

    logError('initializeAccountSettings', error, { accountId })
    throw error
  }
}

/**
 * Validate Hedera account ID format
 * @param accountId - Account ID to validate (e.g., "0.0.123456")
 * @returns boolean
 */
export function validateAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') {
    return false
  }
  
  // Hedera account format: X.X.X where X is a number
  const hederaAccountRegex = /^\d+\.\d+\.\d+$/
  return hederaAccountRegex.test(accountId)
}

/**
 * Get default settings for a new account
 * Uses the current default settings configuration
 * @param accountId - Account ID to include in the settings object
 * @returns UserSettings
 */
export function getDefaultSettings(accountId: string = ''): UserSettings {
  return {
    account: accountId,
    skipFarmerVerification: defaultSettingsConfig.skipFarmerVerification,
    skipInvestorVerification: defaultSettingsConfig.skipInvestorVerification,
    demoBypass: defaultSettingsConfig.demoBypass,
    updatedAt: Date.now()
  }
}

/**
 * Ensure user_settings table exists
 * Attempts to create the table if it doesn't exist
 */
async function ensureUserSettingsTable(): Promise<void> {
  try {
    // Check if we're using in-memory DB
    const isInMemoryDB = !!(db as any).__dumpStorage

    if (isInMemoryDB) {
      // In-memory DB creates tables on-demand, no action needed
      return
    }

    // For SQLite, try to create the table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_settings (
        account TEXT PRIMARY KEY NOT NULL,
        skip_farmer_verification INTEGER DEFAULT 0,
        skip_investor_verification INTEGER DEFAULT 0,
        demo_bypass INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `

    if (db.execute) {
      await db.execute(createTableSQL)
      console.log('[UserSettings] Ensured user_settings table exists')
    }
  } catch (error) {
    // Log but don't throw - table might already exist
    console.warn('[UserSettings] Could not ensure table exists:', error)
  }
}

/**
 * Get user settings by account ID
 * Returns cached settings if available, otherwise fetches from database
 * @param accountId - Hedera account ID
 * @returns Promise<UserSettings>
 */
export async function getUserSettings(accountId: string): Promise<UserSettings> {
  // Validate account ID
  if (!validateAccountId(accountId)) {
    throw new Error(`Invalid account ID format: ${accountId}. Expected format: X.X.X (e.g., 0.0.123456)`)
  }
  
  // Check cache first
  const cached = settingsCache.get(accountId)
  if (cached) {
    console.log(`[UserSettings] Cache hit for account: ${accountId}`)
    return cached
  }
  
  console.log(`[UserSettings] Cache miss for account: ${accountId}`)
  
  // Fetch from database with retry logic and error recovery
  return await withFallback(
    async () => {
      return await withRetry(
        async () => {
          const result = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.account, accountId))
            .limit(1)

          return result[0] || null
        },
        {
          maxRetries: 3,
          baseDelay: 100,
          onRetry: (attempt, error) => {
            logError('getUserSettings', error, { accountId, attempt })
          }
        }
      )
    },
    async () => {
      // Fallback: return default settings
      console.log(`[UserSettings] Using fallback - returning default settings for account: ${accountId}`)
      return null
    }
  ).then(async (settings) => {
    if (settings) {
      // Convert database format to UserSettings interface
      const userSettingsData: UserSettings = {
        account: settings.account,
        skipFarmerVerification: Boolean(settings.skipFarmerVerification),
        skipInvestorVerification: Boolean(settings.skipInvestorVerification),
        demoBypass: Boolean(settings.demoBypass),
        updatedAt: settings.updatedAt || Date.now()
      }

      // Cache the settings
      settingsCache.set(accountId, userSettingsData)

      return userSettingsData
    }

    // No settings found, return defaults
    console.log(`[UserSettings] No settings found for account: ${accountId}, returning defaults`)
    const defaults = getDefaultSettings(accountId)

    // Cache the defaults (with shorter TTL)
    settingsCache.set(accountId, defaults, 60 * 1000) // 1 minute TTL for defaults

    return defaults
  }).catch(async (error) => {
    // Check if it's a table not found error
    if (isTableNotFoundError(error)) {
      console.warn('[UserSettings] Table not found, attempting to create it')
      
      try {
        await ensureUserSettingsTable()
        
        // Retry the query once after creating the table
        const result = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.account, accountId))
          .limit(1)

        if (result[0]) {
          const userSettingsData: UserSettings = {
            account: result[0].account,
            skipFarmerVerification: Boolean(result[0].skipFarmerVerification),
            skipInvestorVerification: Boolean(result[0].skipInvestorVerification),
            demoBypass: Boolean(result[0].demoBypass),
            updatedAt: result[0].updatedAt || Date.now()
          }

          settingsCache.set(accountId, userSettingsData)
          return userSettingsData
        }
      } catch (recoveryError) {
        logError('getUserSettings-recovery', recoveryError, { accountId })
      }
    }

    // Final fallback: return default settings
    logError('getUserSettings-final', error, { accountId })
    console.log(`[UserSettings] All recovery attempts failed, returning default settings`)
    return getDefaultSettings(accountId)
  })
}

/**
 * Update user settings (upsert: update if exists, insert if not)
 * @param accountId - Hedera account ID
 * @param settings - Partial settings to update
 * @returns Promise<UserSettings>
 */
export async function updateUserSettings(
  accountId: string,
  settings: Partial<Omit<UserSettings, 'account' | 'updatedAt'>>
): Promise<UserSettings> {
  // Validate account ID
  if (!validateAccountId(accountId)) {
    throw new Error(`Invalid account ID format: ${accountId}. Expected format: X.X.X (e.g., 0.0.123456)`)
  }
  
  // Validate boolean flags
  const validBooleanKeys = ['skipFarmerVerification', 'skipInvestorVerification', 'demoBypass']
  for (const key of Object.keys(settings)) {
    if (validBooleanKeys.includes(key)) {
      const value = (settings as any)[key]
      if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
        throw new Error(`Invalid value for ${key}: expected boolean, got ${typeof value}`)
      }
    }
  }
  
  const now = Date.now()

  try {
    // Try to update existing settings with retry logic and error recovery
    const updatedSettings = await withRetry(
      async () => {
        // First, check if settings exist
        const existing = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.account, accountId))
          .limit(1)

        if (existing.length > 0) {
          // Update existing settings
          const updateData: any = {
            ...settings,
            updatedAt: now
          }

          await db
            .update(userSettings)
            .set(updateData)
            .where(eq(userSettings.account, accountId))

          console.log(`[UserSettings] Updated settings for account: ${accountId}`)

          // Return merged settings
          return {
            account: accountId,
            skipFarmerVerification: settings.skipFarmerVerification ?? Boolean(existing[0].skipFarmerVerification),
            skipInvestorVerification: settings.skipInvestorVerification ?? Boolean(existing[0].skipInvestorVerification),
            demoBypass: settings.demoBypass ?? Boolean(existing[0].demoBypass),
            updatedAt: now
          }
        } else {
          // Insert new settings
          const defaults = getDefaultSettings(accountId)
          const insertData = {
            account: accountId,
            skipFarmerVerification: settings.skipFarmerVerification ?? defaults.skipFarmerVerification,
            skipInvestorVerification: settings.skipInvestorVerification ?? defaults.skipInvestorVerification,
            demoBypass: settings.demoBypass ?? defaults.demoBypass,
            updatedAt: now
          }

          await db.insert(userSettings).values(insertData)

          console.log(`[UserSettings] Created new settings for account: ${accountId}`)

          return {
            account: accountId,
            skipFarmerVerification: Boolean(insertData.skipFarmerVerification),
            skipInvestorVerification: Boolean(insertData.skipInvestorVerification),
            demoBypass: Boolean(insertData.demoBypass),
            updatedAt: now
          }
        }
      },
      {
        maxRetries: 3,
        baseDelay: 100,
        onRetry: (attempt, error) => {
          logError('updateUserSettings', error, { accountId, attempt, settings })
        }
      }
    )

    // Invalidate cache for this account
    settingsCache.invalidate(accountId)

    // Cache the new settings
    settingsCache.set(accountId, updatedSettings)

    return updatedSettings

  } catch (error) {
    // Check if it's a table not found error
    if (isTableNotFoundError(error)) {
      console.warn('[UserSettings] Table not found during update, attempting to create it')

      try {
        await ensureUserSettingsTable()

        // Retry the update once after creating the table
        const defaults = getDefaultSettings(accountId)
        const insertData = {
          account: accountId,
          skipFarmerVerification: settings.skipFarmerVerification ?? defaults.skipFarmerVerification,
          skipInvestorVerification: settings.skipInvestorVerification ?? defaults.skipInvestorVerification,
          demoBypass: settings.demoBypass ?? defaults.demoBypass,
          updatedAt: now
        }

        await db.insert(userSettings).values(insertData)

        const result: UserSettings = {
          account: accountId,
          skipFarmerVerification: Boolean(insertData.skipFarmerVerification),
          skipInvestorVerification: Boolean(insertData.skipInvestorVerification),
          demoBypass: Boolean(insertData.demoBypass),
          updatedAt: now
        }

        // Invalidate and update cache
        settingsCache.invalidate(accountId)
        settingsCache.set(accountId, result)

        console.log(`[UserSettings] Successfully created settings after table recovery`)
        return result

      } catch (recoveryError) {
        logError('updateUserSettings-recovery', recoveryError, { accountId, settings })
        throw recoveryError
      }
    }

    logError('updateUserSettings-final', error, { accountId, settings })
    throw error
  }
}
