import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function addTotalWithdrawnColumn() {
  console.log('Checking and adding totalWithdrawn column...\n');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    // Check if farmers table exists
    console.log('Checking farmers table...');
    const tableCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='farmers'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ farmers table does not exist');
      process.exit(1);
    }
    
    console.log('✅ farmers table exists');
    
    // Check current columns
    console.log('\nChecking current columns...');
    const columns = await client.execute(`PRAGMA table_info(farmers)`);
    console.log('Current columns:', columns.rows.map((r: any) => r.name).join(', '));
    
    const hasColumn = columns.rows.some((r: any) => r.name === 'totalWithdrawn');
    
    if (hasColumn) {
      console.log('\n✅ totalWithdrawn column already exists!');
    } else {
      console.log('\n➕ Adding totalWithdrawn column...');
      await client.execute(`
        ALTER TABLE farmers 
        ADD COLUMN totalWithdrawn REAL DEFAULT 0
      `);
      console.log('✅ totalWithdrawn column added successfully!');
    }
    
    // Verify
    console.log('\nVerifying...');
    const updatedColumns = await client.execute(`PRAGMA table_info(farmers)`);
    console.log('Updated columns:', updatedColumns.rows.map((r: any) => r.name).join(', '));
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addTotalWithdrawnColumn();
