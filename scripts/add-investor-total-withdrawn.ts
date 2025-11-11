import 'dotenv/config';
import { createClient } from '@libsql/client';

async function addInvestorTotalWithdrawn() {
  console.log('Checking and adding totalWithdrawn column to investors...\n');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    // Check if investors table exists
    console.log('Checking investors table...');
    const tableCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='investors'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ investors table does not exist');
      process.exit(1);
    }
    
    console.log('✅ investors table exists');
    
    // Check current columns
    console.log('\nChecking current columns...');
    const columns = await client.execute(`PRAGMA table_info(investors)`);
    console.log('Current columns:', columns.rows.map((r: any) => r.name).join(', '));
    
    const hasColumn = columns.rows.some((r: any) => r.name === 'totalWithdrawn');
    
    if (hasColumn) {
      console.log('\n✅ totalWithdrawn column already exists!');
    } else {
      console.log('\n➕ Adding totalWithdrawn column...');
      await client.execute(`
        ALTER TABLE investors 
        ADD COLUMN totalWithdrawn REAL DEFAULT 0
      `);
      console.log('✅ totalWithdrawn column added successfully!');
    }
    
    // Verify
    console.log('\nVerifying...');
    const updatedColumns = await client.execute(`PRAGMA table_info(investors)`);
    console.log('Updated columns:', updatedColumns.rows.map((r: any) => r.name).join(', '));
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addInvestorTotalWithdrawn();
