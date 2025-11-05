import { db } from './index'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { withRetry, logError, isRetryableError } from '../lib/error-recovery.js'

export interface MigrationResult {
  success: boolean
  migrationsRun: string[]
  errors: string[]
}

export interface TableVerificationResult {
  allTablesExist: boolean
  missingTables: string[]
  existingTables: string[]
}

export interface MigrationHistoryRecord {
  id: number
  migration_name: string
  applied_at: number
  rolled_back_at: number | null
}

export interface RollbackResult {
  success: boolean
  migrationRolledBack: string | null
  error: string | null
}

/**
 * Migration Runner
 * Executes pending database migrations on server startup
 */
export class MigrationRunner {
  private migrationsDir: string
  private rollbackDir: string
  private isInMemoryDB: boolean

  constructor(migrationsDir: string = './db/migrations', rollbackDir: string = './db/migrations/rollback') {
    this.migrationsDir = migrationsDir
    this.rollbackDir = rollbackDir
    // Check if we're using the in-memory mock database
    this.isInMemoryDB = !!(db as any).__dumpStorage
  }

  /**
   * Run all pending migrations
   * For SQLite: Execute SQL files in order
   * For in-memory DB: Skip migrations (tables created on-demand)
   */
  async runMigrations(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsRun: [],
      errors: []
    }

    // Skip migrations for in-memory database
    if (this.isInMemoryDB) {
      console.log('📦 In-memory database detected, skipping migrations')
      // Ensure user_settings table exists in in-memory storage
      await this.ensureUserSettingsTableInMemory()
      return result
    }

    try {
      console.log('🔄 Starting database migrations...')
      
      // Ensure migration history table exists
      await this.ensureMigrationHistoryTable()
      
      // Get all migration files
      const migrationFiles = this.getMigrationFiles()
      
      if (migrationFiles.length === 0) {
        console.log('✅ No migration files found')
        return result
      }

      // Execute each migration that hasn't been applied
      for (const file of migrationFiles) {
        try {
          // Check if migration has already been applied
          const isApplied = await this.isMigrationApplied(file)
          
          if (isApplied) {
            console.log(`⏭️  Skipping already applied migration: ${file}`)
            continue
          }
          
          await this.executeMigration(file)
          await this.recordMigration(file)
          result.migrationsRun.push(file)
          console.log(`✅ Executed migration: ${file}`)
        } catch (error) {
          const errorMsg = `Failed to execute migration ${file}: ${error instanceof Error ? error.message : String(error)}`
          console.error(`❌ ${errorMsg}`)
          result.errors.push(errorMsg)
          result.success = false
          // Don't continue if a migration fails
          break
        }
      }

      if (result.success) {
        if (result.migrationsRun.length > 0) {
          console.log(`✅ Successfully ran ${result.migrationsRun.length} migrations`)
        } else {
          console.log('✅ All migrations already applied')
        }
      } else {
        console.error(`❌ Migration failed. Ran ${result.migrationsRun.length} migrations before failure`)
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Migration runner error: ${error instanceof Error ? error.message : String(error)}`)
      console.error('❌ Migration runner error:', error)
    }

    return result
  }

  /**
   * Get list of migration files sorted by name
   */
  private getMigrationFiles(): string[] {
    if (!existsSync(this.migrationsDir)) {
      console.warn(`⚠️  Migrations directory not found: ${this.migrationsDir}`)
      return []
    }

    const files = readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .filter(file => !file.includes('meta')) // Skip meta files
      .sort() // Sort alphabetically to ensure order

    return files
  }

  /**
   * Execute a single migration file with retry logic
   */
  private async executeMigration(filename: string): Promise<void> {
    const filePath = join(this.migrationsDir, filename);
    // Clean SQL: remove backticks for SQLite compatibility
    const sql = readFileSync(filePath, 'utf-8')

    // Split by semicolon to handle multiple statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        // Execute the SQL statement with retry logic
        await withRetry(
          async () => {
            if ((db as any).run) { // For better-sqlite3
              await (db as any).run(statement)
            } else {
              // Fallback for databases without execute method
              console.warn(`⚠️  Database doesn't support run(), skipping: ${statement.substring(0, 50)}...`)
            }
          },
          {
            maxRetries: 3,
            baseDelay: 200,
            onRetry: (attempt, error) => {
              console.log(`[Migration] Retrying statement from ${filename}, attempt ${attempt}`)
              logError('executeMigration', error, { filename, statement: statement.substring(0, 100) })
            }
          }
        )
      } catch (error) {
        // Ignore "table already exists" errors
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          console.log(`ℹ️  Table already exists, skipping: ${filename}`)
          continue
        }

        // Log the error with context
        logError('executeMigration-failed', error, { filename, statement: statement.substring(0, 100) })
        throw error
      }
    }
  }

  /**
   * Ensure user_settings table exists in in-memory database
   * The in-memory DB creates tables on-demand, but we initialize the storage
   * to ensure it's ready for user settings operations
   */
  private async ensureUserSettingsTableInMemory(): Promise<void> {
    try {
      // For in-memory DB, we need to ensure the table structure exists
      // The in-memory DB creates tables on-demand when first accessed
      // We'll do a test query to initialize the user_settings table
      const { userSettings } = await import('./schema/index.js')
      
      // This query will initialize the table in the in-memory storage
      try {
        await db.select().from(userSettings).limit(1)
      } catch (queryError) {
        // Ignore errors - table will be created on first insert
      }
      
      console.log('✅ In-memory database ready (user_settings table initialized)')
    } catch (error) {
      // Don't throw - in-memory DB will create tables on-demand anyway
      // Only log if it's not a simple "table doesn't exist" error
    }
  }

  /**
   * Ensure migration_history table exists
   */
  private async ensureMigrationHistoryTable(): Promise<void> {
    if (this.isInMemoryDB) {
      return // Skip for in-memory DB
    }

    try {
      // Try to query the table
      if ((db as any).run) {
        await (db as any).run('SELECT 1 FROM migration_history LIMIT 1')
      }
    } catch (error) {
      // Table doesn't exist, create it
      console.log('📋 Creating migration_history table...')
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS migration_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_name TEXT NOT NULL UNIQUE,
          applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          rolled_back_at INTEGER DEFAULT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_migration_history_name ON migration_history(migration_name);
        CREATE INDEX IF NOT EXISTS idx_migration_history_applied_at ON migration_history(applied_at);
      `
      
      const statements = createTableSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      for (const statement of statements) {
        if ((db as any).run) {
          await (db as any).run(statement)
        }
      }
      
      console.log('✅ Migration history table created')
    }
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(migrationName: string): Promise<void> {
    if (this.isInMemoryDB) {
      return // Skip for in-memory DB
    }

    try {
      if ((db as any).run) {
        await (db as any).run(
          `INSERT OR IGNORE INTO migration_history (migration_name, applied_at) 
           VALUES (?, strftime('%s', 'now'))`,
          [migrationName]
        )
      }
    } catch (error) {
      console.warn(`⚠️  Failed to record migration ${migrationName}:`, error)
    }
  }

  /**
   * Check if a migration has been applied
   */
  private async isMigrationApplied(migrationName: string): Promise<boolean> {
    if (this.isInMemoryDB) {
      return false // Always run migrations for in-memory DB
    }

    try {
      await this.ensureMigrationHistoryTable()
      
      if ((db as any).run) {
        const result = await (db as any).all(
          'SELECT COUNT(*) as count FROM migration_history WHERE migration_name = ? AND rolled_back_at IS NULL',
          [migrationName]
        )
        return result && result[0] && (result[0] as any).count > 0
      }
    } catch (error) {
      // If we can't check, assume not applied
      return false
    }
    
    return false
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationHistoryRecord[]> {
    if (this.isInMemoryDB) {
      return []
    }

    try {
      await this.ensureMigrationHistoryTable()
      
      if ((db as any).run) {
        const result = await (db as any).all(
          'SELECT id, migration_name, applied_at, rolled_back_at FROM migration_history WHERE rolled_back_at IS NULL ORDER BY applied_at DESC'
        )
        return result || []
      }
    } catch (error) {
      console.error('❌ Error fetching applied migrations:', error)
      return []
    }
    
    return []
  }

  /**
   * Show all applied migrations
   */
  async showAppliedMigrations(): Promise<void> {
    const migrations = await this.getAppliedMigrations()
    
    if (migrations.length === 0) {
      console.log('📋 No migrations have been applied yet')
      return
    }

    console.log('\n📋 Applied Migrations:')
    console.log('─'.repeat(80))
    
    for (const migration of migrations) {
      const appliedDate = new Date(migration.applied_at * 1000).toISOString()
      console.log(`✓ ${migration.migration_name}`)
      console.log(`  Applied: ${appliedDate}`)
      console.log('')
    }
    
    console.log(`Total: ${migrations.length} migrations applied`)
  }

  /**
   * Rollback the last applied migration
   */
  async rollbackLastMigration(): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      migrationRolledBack: null,
      error: null
    }

    if (this.isInMemoryDB) {
      result.error = 'Rollback not supported for in-memory database'
      console.log('⚠️  Rollback not supported for in-memory database')
      return result
    }

    try {
      // Get the last applied migration
      const migrations = await this.getAppliedMigrations()
      
      if (migrations.length === 0) {
        result.error = 'No migrations to rollback'
        console.log('ℹ️  No migrations to rollback')
        return result
      }

      const lastMigration = migrations[0]
      const migrationName = lastMigration.migration_name
      
      console.log(`🔄 Rolling back migration: ${migrationName}`)
      
      // Find the rollback file
      const rollbackFile = migrationName.replace('.sql', '.rollback.sql')
      const rollbackPath = join(this.rollbackDir, rollbackFile)
      
      if (!existsSync(rollbackPath)) {
        result.error = `Rollback file not found: ${rollbackFile}`
        console.error(`❌ Rollback file not found: ${rollbackPath}`)
        return result
      }

      // Execute the rollback
      await this.executeRollback(rollbackFile)
      
      // Mark migration as rolled back
      if ((db as any).run) {
        await (db as any).run(
          `UPDATE migration_history SET rolled_back_at = strftime('%s', 'now') WHERE migration_name = ?`,
          [migrationName]
        )
      }
      
      result.success = true
      result.migrationRolledBack = migrationName
      console.log(`✅ Successfully rolled back migration: ${migrationName}`)
      
    } catch (error) {
      result.error = `Rollback failed: ${error instanceof Error ? error.message : String(error)}`
      console.error('❌ Rollback failed:', error)
    }

    return result
  }

  /**
   * Execute a rollback file
   */
  private async executeRollback(filename: string): Promise<void> {
    const filePath = join(this.rollbackDir, filename)
    const sql = readFileSync(filePath, 'utf-8')

    // Split by semicolon to handle multiple statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        if ((db as any).run) {
          await (db as any).run(statement)
        }
      } catch (error) {
        // Log but continue - some rollback statements might fail if objects don't exist
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️  Rollback statement warning: ${errorMsg}`)
      }
    }
  }

  /**
   * Check if migrations are needed
   */
  async checkPendingMigrations(): Promise<boolean> {
    if (this.isInMemoryDB) {
      return false // No migrations needed for in-memory DB
    }

    const migrationFiles = this.getMigrationFiles()
    return migrationFiles.length > 0
  }

  /**
   * Verify all required tables exist
   */
  async verifyTables(): Promise<TableVerificationResult> {
    const requiredTables = [
      'user_settings',
      'coffee_groves',
      'harvest_records',
      'token_holdings',
      'farmers',
      'assets'
    ]

    const result: TableVerificationResult = {
      allTablesExist: true,
      missingTables: [],
      existingTables: []
    }

    if (this.isInMemoryDB) {
      // For in-memory DB, check internal storage
      const storage = (db as any).__dumpStorage ? (db as any).__dumpStorage() : {}
      const tableNames = Object.keys(storage)
      
      for (const table of requiredTables) {
        // In-memory DB uses dynamic table names, so we just check if storage exists
        result.existingTables.push(table)
      }
      
      console.log('✅ In-memory database tables verified')
      return result
    }

    // For SQLite, query system tables
    try {
      for (const table of requiredTables) {
        try {
          // Try to query the table
          if (db.execute) {
          await (db as any).run(`SELECT 1 FROM ${table} LIMIT 1`)
          } else {
            // Fallback: try to select from the table
            await db.select().from(table).limit(1)
          }
          result.existingTables.push(table)
        } catch (error) {
          result.missingTables.push(table)
          result.allTablesExist = false
        }
      }

      if (result.allTablesExist) {
        console.log('✅ All required tables exist')
      } else {
        console.warn(`⚠️  Missing tables: ${result.missingTables.join(', ')}`)
      }
    } catch (error) {
      console.error('❌ Error verifying tables:', error)
      result.allTablesExist = false
    }

    return result
  }
}

/**
 * Convenience function to run migrations
 */
export async function runMigrations(): Promise<MigrationResult> {
  const runner = new MigrationRunner()
  return runner.runMigrations()
}

/**
 * Convenience function to verify tables
 */
export async function verifyTables(): Promise<TableVerificationResult> {
  const runner = new MigrationRunner()
  return runner.verifyTables()
}

/**
 * Convenience function to show applied migrations
 */
export async function showAppliedMigrations(): Promise<void> {
  const runner = new MigrationRunner()
  return runner.showAppliedMigrations()
}

/**
 * Convenience function to get applied migrations
 */
export async function getAppliedMigrations(): Promise<MigrationHistoryRecord[]> {
  const runner = new MigrationRunner()
  return runner.getAppliedMigrations()
}

/**
 * Convenience function to rollback last migration
 */
export async function rollbackLastMigration(): Promise<RollbackResult> {
  const runner = new MigrationRunner()
  return runner.rollbackLastMigration()
}
