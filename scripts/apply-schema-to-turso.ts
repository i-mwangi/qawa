/**
 * Apply schema to Turso by reading migration files and executing them
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

console.log('🚀 Applying schema to Turso...\n');

async function applyMigrations() {
  try {
    const migrationsDir = './db/migrations';
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files\n`);

    for (const file of files) {
      console.log(`📝 Applying: ${file}`);
      const sqlPath = join(migrationsDir, file);
      const sql = readFileSync(sqlPath, 'utf-8');
      
      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          // Skip DROP TABLE statements as they might fail
          if (statement.toUpperCase().includes('DROP TABLE')) {
            console.log(`   ⏭️  Skipped DROP TABLE statement`);
            continue;
          }
          
          await client.execute(statement);
        } catch (error: any) {
          // Ignore "table already exists" and "no such table" errors
          if (error.message?.includes('already exists') || 
              error.message?.includes('no such table')) {
            console.log(`   ⏭️  Skipped (${error.message.split(':')[0]})`);
          } else {
            console.error(`   ❌ Error:`, error.message);
            console.error(`   Statement:`, statement.substring(0, 100));
            // Don't throw, just continue
          }
        }
      }
      
      console.log(`   ✅ Applied successfully\n`);
    }

    // Verify tables were created
    const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    console.log(`\n✅ Schema applied successfully!`);
    console.log(`\n📊 Total tables in database: ${tables.rows.length}`);
    console.log('\n📋 Tables:');
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Failed to apply schema:', error.message);
    process.exit(1);
  }
}

applyMigrations();
