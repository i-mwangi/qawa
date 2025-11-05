import { db } from './index'
import { ConnectionPoolRecovery, withRetry, logError } from '../lib/error-recovery.js'

export interface HealthCheckResult {
  healthy: boolean
  connection: boolean
  tables: TableCheckResult
  timestamp: number
  databaseType: 'sqlite' | 'in-memory'
  diagnostics: string[]
}

export interface TableCheckResult {
  allPresent: boolean
  missing: string[]
  present: string[]
}

/**
 * Database Health Check Module
 * Verifies database connectivity and table existence
 */
export class DatabaseHealthCheck {
  private isInMemoryDB: boolean
  private connectionPoolRecovery?: ConnectionPoolRecovery

  constructor() {
    // Check if we're using the in-memory mock database
    this.isInMemoryDB = !!(db as any).__dumpStorage
  }

  /**
   * Start connection pool monitoring
   * Automatically attempts recovery on connection failures
   */
  startConnectionMonitoring(): void {
    if (this.connectionPoolRecovery) {
      console.log('[HealthCheck] Connection monitoring already started')
      return
    }

    this.connectionPoolRecovery = new ConnectionPoolRecovery({
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000
    })

    this.connectionPoolRecovery.startMonitoring(async () => {
      return await this.checkConnection()
    })

    console.log('[HealthCheck] Started connection pool monitoring')
  }

  /**
   * Stop connection pool monitoring
   */
  stopConnectionMonitoring(): void {
    if (this.connectionPoolRecovery) {
      this.connectionPoolRecovery.stopMonitoring()
      this.connectionPoolRecovery = undefined
      console.log('[HealthCheck] Stopped connection pool monitoring')
    }
  }

  /**
   * Get connection pool health status
   */
  getConnectionPoolStatus(): { healthy: boolean; timeSinceLastCheck: number } | null {
    if (!this.connectionPoolRecovery) {
      return null
    }

    return {
      healthy: this.connectionPoolRecovery.getHealthStatus(),
      timeSinceLastCheck: this.connectionPoolRecovery.getTimeSinceLastCheck()
    }
  }

  /**
   * Run comprehensive health check
   * @returns Promise<HealthCheckResult>
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    const diagnostics: string[] = []
    const timestamp = Date.now()

    diagnostics.push(`Health check started at ${new Date(timestamp).toISOString()}`)
    diagnostics.push(`Database type: ${this.isInMemoryDB ? 'in-memory' : 'SQLite'}`)

    // Check database connection
    const connectionOk = await this.checkConnection()
    diagnostics.push(`Connection check: ${connectionOk ? 'PASS' : 'FAIL'}`)

    // Check tables
    const tableCheck = await this.checkTables()
    diagnostics.push(`Table check: ${tableCheck.allPresent ? 'PASS' : 'FAIL'}`)
    
    if (tableCheck.present.length > 0) {
      diagnostics.push(`Tables present: ${tableCheck.present.join(', ')}`)
    }
    
    if (tableCheck.missing.length > 0) {
      diagnostics.push(`Tables missing: ${tableCheck.missing.join(', ')}`)
    }

    const healthy = connectionOk && tableCheck.allPresent

    return {
      healthy,
      connection: connectionOk,
      tables: tableCheck,
      timestamp,
      databaseType: this.isInMemoryDB ? 'in-memory' : 'sqlite',
      diagnostics
    }
  }

  /**
   * Check database connection with retry logic
   * @returns Promise<boolean>
   */
  async checkConnection(): Promise<boolean> {
    try {
      return await withRetry(
        async () => {
          if (this.isInMemoryDB) {
            // For in-memory DB, check if the storage is accessible
            const storage = (db as any).__dumpStorage
            if (typeof storage === 'function') {
              storage() // Try to access storage
              return true
            }
            return false
          }

          // For SQLite with drizzle, use raw SQL execution
          if ((db as any).run) {
            // Use the run method for raw SQL
            (db as any).run('SELECT 1')
            return true
          }

          // Try to access the underlying SQLite instance
          if ((db as any)._.session?.db) {
            const sqliteDb = (db as any)._.session.db
            sqliteDb.prepare('SELECT 1').get()
            return true
          }

          // Last resort: try a simple table query
          await db.select().from('sqlite_master').limit(1)
          return true
        },
        {
          maxRetries: 3,
          baseDelay: 100,
          onRetry: (attempt, error) => {
            console.log(`[HealthCheck] Connection check retry attempt ${attempt}`)
            logError('checkConnection', error, { attempt })
          }
        }
      )
    } catch (error) {
      logError('checkConnection-failed', error)
      return false
    }
  }

  /**
   * Verify required tables exist
   * @returns Promise<TableCheckResult>
   */
  async checkTables(): Promise<TableCheckResult> {
    const requiredTables = [
      'user_settings',
      'coffee_groves',
      'harvest_records',
      'token_holdings',
      'farmers',
      'assets',
      'kyc',
      'transactions',
      'transaction_history',
      'prices',
      'lendingReserves',
      'loans',
      'liquidations',
      'loanRepayment',
      'providedLiquidity',
      'withdrawnLiquidity',
      'realwordAssetTimeseries',
      'revenue_distributions',
      'farmer_verifications',
      'market_alerts',
      'price_history',
      'iot_sensor_data',
      'tree_health_records',
      'environmental_alerts',
      'maintenance_activities',
      'sensor_configurations',
      'investor_verifications',
      'investor_verification_history',
      'investor_profiles'
    ]

    const result: TableCheckResult = {
      allPresent: true,
      missing: [],
      present: []
    }

    if (this.isInMemoryDB) {
      // For in-memory DB, tables are created on-demand
      // We'll mark all as present since they'll be created when accessed
      result.present = [...requiredTables]
      result.allPresent = true
      return result
    }

    // For SQLite, query system tables to check existence
    try {
      for (const table of requiredTables) {
        const exists = await this.tableExists(table)
        if (exists) {
          result.present.push(table)
        } else {
          result.missing.push(table)
          result.allPresent = false
        }
      }
    } catch (error) {
      console.error('Error checking tables:', error)
      result.allPresent = false
    }

    return result
  }

  /**
   * Check if a specific table exists
   * @param tableName - Name of the table to check
   * @returns Promise<boolean>
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      // Access the underlying SQLite instance
      if ((db as any)._.session?.db) {
        const sqliteDb = (db as any)._.session.db
        const result = sqliteDb.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tableName)
        return !!result
      }

      // Fallback: try to query the table directly
      // This will throw if the table doesn't exist
      const schema = await import('./schema/index')
      const tableObj = (schema as any)[tableName]
      if (tableObj) {
        await db.select().from(tableObj).limit(1)
        return true
      }

      return false
    } catch (error) {
      // Table doesn't exist or query failed
      return false
    }
  }

  /**
   * Get detailed diagnostics for troubleshooting
   * @returns Promise<string[]>
   */
  async getDiagnostics(): Promise<string[]> {
    const diagnostics: string[] = []

    try {
      // Database type
      diagnostics.push(`Database Type: ${this.isInMemoryDB ? 'In-Memory' : 'SQLite'}`)

      // Connection status
      const connected = await this.checkConnection()
      diagnostics.push(`Connection Status: ${connected ? 'Connected' : 'Disconnected'}`)

      // Table status
      const tableCheck = await this.checkTables()
      diagnostics.push(`Total Tables Expected: ${tableCheck.present.length + tableCheck.missing.length}`)
      diagnostics.push(`Tables Present: ${tableCheck.present.length}`)
      diagnostics.push(`Tables Missing: ${tableCheck.missing.length}`)

      if (tableCheck.missing.length > 0) {
        diagnostics.push(`Missing Tables: ${tableCheck.missing.join(', ')}`)
      }

      // In-memory specific diagnostics
      if (this.isInMemoryDB) {
        try {
          const storage = (db as any).__dumpStorage()
          const tableCount = Object.keys(storage).length
          diagnostics.push(`In-Memory Tables: ${tableCount}`)
          
          // Show data counts
          for (const [tableName, data] of Object.entries(storage)) {
            const count = Array.isArray(data) ? data.length : 0
            diagnostics.push(`  - ${tableName}: ${count} records`)
          }
        } catch (error) {
          diagnostics.push(`Error accessing in-memory storage: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // SQLite specific diagnostics
      if (!this.isInMemoryDB) {
        try {
          // Get all tables using the underlying SQLite instance
          if ((db as any)._.session?.db) {
            const sqliteDb = (db as any)._.session.db
            const tables = sqliteDb.prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).all()
            diagnostics.push(`SQLite Tables Found: ${tables ? tables.length : 0}`)
            
            if (tables && tables.length > 0) {
              tables.forEach((table: any) => {
                diagnostics.push(`  - ${table.name}`)
              })
            }
          }
        } catch (error) {
          diagnostics.push(`Error querying SQLite tables: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

    } catch (error) {
      diagnostics.push(`Error generating diagnostics: ${error instanceof Error ? error.message : String(error)}`)
    }

    return diagnostics
  }
}

/**
 * Convenience function to run health check
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const healthCheck = new DatabaseHealthCheck()
  return healthCheck.runHealthCheck()
}

/**
 * Convenience function to check connection
 */
export async function checkConnection(): Promise<boolean> {
  const healthCheck = new DatabaseHealthCheck()
  return healthCheck.checkConnection()
}

/**
 * Convenience function to check tables
 */
export async function checkTables(): Promise<TableCheckResult> {
  const healthCheck = new DatabaseHealthCheck()
  return healthCheck.checkTables()
}

/**
 * Convenience function to get diagnostics
 */
export async function getDiagnostics(): Promise<string[]> {
  const healthCheck = new DatabaseHealthCheck()
  return healthCheck.getDiagnostics()
}
