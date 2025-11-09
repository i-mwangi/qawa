/**
 * Create all missing tables in Turso
 * Reads the generated migration and applies it with proper error handling
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  process.exit(1);
}

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

console.log('🚀 Creating missing tables in Turso...\n');

// Read the latest migration file
const migrationSql = readFileSync('./db/migrations/0003_warm_sentinels.sql', 'utf-8');

async function createTables() {
  try {
    // Get existing tables
    const existingResult = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    const existingTables = new Set(existingResult.rows.map((r: any) => r.name));
    console.log(`📊 Existing tables: ${existingTables.size}`);
    console.log();

    // Split migration into statements
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const statement of statements) {
      try {
        // Skip PRAGMA statements for now
        if (statement.startsWith('PRAGMA')) {
          continue;
        }

        // Execute the statement
        await client.execute(statement);
        created++;
        
        // Extract table name if it's a CREATE TABLE
        const match = statement.match(/CREATE TABLE [`"]?(\w+)[`"]?/i);
        if (match) {
          console.log(`✅ Created: ${match[1]}`);
        }
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          skipped++;
        } else if (error.message?.includes('no such table')) {
          // Skip errors about missing tables (for ALTER/DROP statements)
          skipped++;
        } else {
          errors++;
          console.error(`⚠️  Error:`, error.message.substring(0, 100));
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    // Verify final state
    const finalResult = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    console.log(`\n✅ Total tables in database: ${finalResult.rows.length}`);
    console.log('\n📋 All tables:');
    finalResult.rows.forEach((row: any) => {
      const isNew = !existingTables.has(row.name);
      console.log(`  ${isNew ? '🆕' : '  '} ${row.name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

createTables();
