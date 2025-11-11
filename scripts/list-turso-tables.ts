import 'dotenv/config';
import { createClient } from '@libsql/client';

async function listTables() {
  console.log('Listing all tables in Turso database...\n');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    console.log('Tables found:', tables.rows.length);
    console.log('─'.repeat(50));
    
    for (const row of tables.rows) {
      const tableName = row.name as string;
      console.log(`\n📋 ${tableName}`);
      
      // Get column info
      const columns = await client.execute(`PRAGMA table_info(${tableName})`);
      console.log('   Columns:', columns.rows.map((r: any) => r.name).join(', '));
    }
    
    console.log('\n' + '─'.repeat(50));
    console.log('✅ Done!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listTables();
