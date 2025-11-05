#!/usr/bin/env node
/**
 * Migration CLI Tool
 * 
 * Commands:
 * - pnpm migration:show - Show all applied migrations
 * - pnpm migration:rollback - Rollback the last migration
 * - pnpm migration:run - Run pending migrations
 */

import { showAppliedMigrations, rollbackLastMigration, runMigrations } from './migrate.js'

const command = process.argv[2]

async function main() {
  switch (command) {
    case 'show':
    case 'list':
      console.log('📋 Fetching applied migrations...\n')
      await showAppliedMigrations()
      break

    case 'rollback':
      console.log('🔄 Rolling back last migration...\n')
      const result = await rollbackLastMigration()
      if (result.success) {
        console.log(`\n✅ Successfully rolled back: ${result.migrationRolledBack}`)
      } else {
        console.error(`\n❌ Rollback failed: ${result.error}`)
        process.exit(1)
      }
      break

    case 'run':
    case 'migrate':
      console.log('🔄 Running pending migrations...\n')
      const migrationResult = await runMigrations()
      if (migrationResult.success) {
        console.log('\n✅ Migrations completed successfully')
      } else {
        console.error('\n❌ Migration failed')
        console.error('Errors:', migrationResult.errors)
        process.exit(1)
      }
      break

    default:
      console.log(`
Migration CLI Tool

Usage:
  pnpm migration:show      Show all applied migrations
  pnpm migration:rollback  Rollback the last migration
  pnpm migration:run       Run pending migrations

Examples:
  pnpm migration:show
  pnpm migration:rollback
  pnpm migration:run
      `)
      break
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
