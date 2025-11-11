import 'dotenv/config';
import { createClient } from '@libsql/client';

async function initializeAllGroveBalances() {
  const farmerAddress = '0.0.5792828';
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing Turso credentials');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    console.log(`\n🔧 Initializing balance records for all groves of farmer ${farmerAddress}\n`);
    
    // Get all groves for this farmer
    const groves = await client.execute({
      sql: `SELECT id, grove_name FROM coffee_groves WHERE farmer_address = ?`,
      args: [farmerAddress]
    });
    
    console.log(`Found ${groves.rows.length} groves\n`);
    
    for (const grove of groves.rows) {
      const groveId = (grove as any).id;
      const groveName = (grove as any).grove_name;
      
      console.log(`📊 Processing Grove ${groveId}: ${groveName}`);
      
      // Calculate total earned from harvests
      const harvests = await client.execute({
        sql: `
          SELECT COALESCE(SUM(farmer_share), 0) as totalEarned
          FROM harvest_records
          WHERE grove_id = ?
        `,
        args: [groveId]
      });
      
      const totalEarned = (harvests.rows[0] as any)?.totalEarned || 0;
      
      // Calculate total withdrawn
      const withdrawals = await client.execute({
        sql: `
          SELECT COALESCE(SUM(amount), 0) as totalWithdrawn
          FROM farmer_withdrawals
          WHERE farmer_address = ? AND grove_id = ? AND status = 'completed'
        `,
        args: [farmerAddress, groveId]
      });
      
      const totalWithdrawn = (withdrawals.rows[0] as any)?.totalWithdrawn || 0;
      const availableBalance = totalEarned - totalWithdrawn;
      
      console.log(`  Total Earned: $${(totalEarned / 100).toFixed(2)}`);
      console.log(`  Total Withdrawn: $${(totalWithdrawn / 100).toFixed(2)}`);
      console.log(`  Available: $${(availableBalance / 100).toFixed(2)}`);
      
      // Check if record exists
      const existing = await client.execute({
        sql: `SELECT id FROM farmer_grove_balances WHERE farmer_address = ? AND grove_id = ?`,
        args: [farmerAddress, groveId]
      });
      
      if (existing.rows.length > 0) {
        console.log(`  ✏️  Updating existing record...`);
        await client.execute({
          sql: `
            UPDATE farmer_grove_balances
            SET total_earned = ?,
                total_withdrawn = ?,
                available_balance = ?,
                updated_at = ?
            WHERE farmer_address = ? AND grove_id = ?
          `,
          args: [totalEarned, totalWithdrawn, availableBalance, Date.now(), farmerAddress, groveId]
        });
      } else {
        console.log(`  ➕ Creating new record...`);
        await client.execute({
          sql: `
            INSERT INTO farmer_grove_balances (
              farmer_address, grove_id, this_month_distributed, available_balance,
              pending_distribution, total_withdrawn, total_earned,
              last_calculated_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            farmerAddress, groveId, 0, availableBalance,
            0, totalWithdrawn, totalEarned,
            Date.now(), Date.now()
          ]
        });
      }
      
      console.log(`  ✅ Done\n`);
    }
    
    console.log('✅ All grove balances initialized successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

initializeAllGroveBalances();
