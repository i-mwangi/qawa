import 'dotenv/config';
import { createClient } from '@libsql/client';

async function addFarmerGroveBalancesTotalWithdrawn() {
  console.log('Adding totalWithdrawn to farmer_grove_balances...\n');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    // Check current columns
    console.log('Checking current columns...');
    const columns = await client.execute(`PRAGMA table_info(farmer_grove_balances)`);
    console.log('Current columns:', columns.rows.map((r: any) => r.name).join(', '));
    
    const hasColumn = columns.rows.some((r: any) => r.name === 'totalWithdrawn');
    
    if (hasColumn) {
      console.log('\n✅ totalWithdrawn column already exists!');
    } else {
      console.log('\n➕ Adding totalWithdrawn column...');
      await client.execute(`
        ALTER TABLE farmer_grove_balances 
        ADD COLUMN totalWithdrawn REAL DEFAULT 0
      `);
      console.log('✅ totalWithdrawn column added successfully!');
    }
    
    // Verify
    console.log('\nVerifying...');
    const updatedColumns = await client.execute(`PRAGMA table_info(farmer_grove_balances)`);
    console.log('Updated columns:', updatedColumns.rows.map((r: any) => r.name).join(', '));
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addFarmerGroveBalancesTotalWithdrawn();
