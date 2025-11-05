/**
 * Settings Cache Manager
 * 
 * Manages in-memory cache for user settings with TTL support,
 * automatic cleanup, and statistics tracking.
 */

interface UserSettings {
  account: string
  skipFarmerVerification: boolean
  skipInvestorVerification: boolean
  demoBypass: boolean
  updatedAt: number
}

interface CacheEntry {
  settings: UserSettings
  expiresAt: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
}

/**
 * Settings cache with TTL support and automatic cleanup
 */
export class SettingsCache {
  private cache: Map<string, CacheEntry>
  private defaultTTL: number
  private stats: { hits: number; misses: number }
  private cleanupInterval: NodeJS.Timeout | null

  constructor(defaultTTL: number = 5 * 60 * 1000) { // Default: 5 minutes
    this.cache = new Map()
    this.defaultTTL = defaultTTL
    this.stats = { hits: 0, misses: 0 }
    this.cleanupInterval = null
    
    // Start automatic cleanup every minute
    this.startAutomaticCleanup()
  }

  /**
   * Get cached settings for an account
   * @param accountId - Account ID
   * @returns UserSettings | null
   */
  get(accountId: string): UserSettings | null {
    const entry = this.cache.get(accountId)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(accountId)
      this.stats.misses++
      return null
    }
    
    this.stats.hits++
    return entry.settings
  }

  /**
   * Set cached settings for an account
   * @param accountId - Account ID
   * @param settings - Settings to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set(accountId: string, settings: UserSettings, ttl?: number): void {
    const timeToLive = ttl ?? this.defaultTTL
    const expiresAt = Date.now() + timeToLive
    
    this.cache.set(accountId, {
      settings,
      expiresAt
    })
  }

  /**
   * Invalidate cache for a specific account
   * @param accountId - Account ID
   */
  invalidate(accountId: string): void {
    this.cache.delete(accountId)
  }

  /**
   * Clear all cached settings
   */
  clear(): void {
    this.cache.clear()
    this.stats.hits = 0
    this.stats.misses = 0
  }

  /**
   * Get cache statistics
   * @returns CacheStats
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100 // Round to 2 decimal places
    }
  }

  /**
   * Start automatic cleanup of expired entries
   * Runs every minute to remove stale entries
   */
  private startAutomaticCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
    }, 60 * 1000) // Run every minute
    
    // Prevent the interval from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    // Find all expired entries
    for (const [accountId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(accountId)
      }
    }
    
    // Remove expired entries
    for (const key of expiredKeys) {
      this.cache.delete(key)
    }
    
    if (expiredKeys.length > 0) {
      console.log(`[SettingsCache] Cleaned up ${expiredKeys.length} expired entries`)
    }
  }

  /**
   * Stop automatic cleanup (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Export singleton instance
export const settingsCache = new SettingsCache()
