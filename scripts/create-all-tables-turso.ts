/**
 * Create all tables in Turso from schema definitions
 * This bypasses migrations and creates tables directly from the schema
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../db/schema/index.js';
import * as earningsSchema from '../db/schema/earnings-distribution.js';

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

const db = drizzle(client, { schema: { ...schema, ...earningsSchema } });

console.log('🚀 Creating all tables in Turso...\n');

async function createTables() {
  try {
    // Get list of existing tables
    const existingTables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    console.log(`📊 Existing tables: ${existingTables.rows.length}`);
    existingTables.rows.forEach((row: any) => {
      console.log(`  - ${row.name}`);
    });
    console.log();

    // Run migrations
    console.log('📝 Running migrations...');
    await migrate(db, { migrationsFolder: './db/migrations' });
    
    console.log('✅ Migrations completed!\n');

    // Verify tables were created
    const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    console.log(`✅ Schema applied successfully!`);
    console.log(`\n📊 Total tables in database: ${tables.rows.length}`);
    console.log('\n📋 All tables:');
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Failed to create tables:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTables();
