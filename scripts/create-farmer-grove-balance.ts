import 'dotenv/config';
import { createClient } from '@libsql/client';

async function createFarmerGroveBalance() {
  const farmerAddress = '0.0.5792828';
  const groveId = 2;
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing Turso credentials');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    console.log(`\n🔧 Creating balance record for farmer ${farmerAddress}, grove ${groveId}\n`);
    
    // Calculate total earned from harvests (farmer gets 30%)
    const harvests = await client.execute({
      sql: `
        SELECT COALESCE(SUM(farmer_share), 0) as totalEarned
        FROM harvest_records h
        INNER JOIN coffee_groves g ON h.grove_id = g.id
        WHERE g.id = ? AND g.farmer_address = ?
      `,
      args: [groveId, farmerAddress]
    });
    
    const totalEarned = (harvests.rows[0] as any)?.totalEarned || 0;
    console.log('Total Earned from harvests:', (totalEarned / 100).toFixed(2), 'USDC');
    
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
    console.log('Total Withdrawn:', (totalWithdrawn / 100).toFixed(2), 'USDC');
    
    const availableBalance = totalEarned - totalWithdrawn;
    console.log('Available Balance:', (availableBalance / 100).toFixed(2), 'USDC');
    
    // Check if record exists
    const existing = await client.execute({
      sql: `SELECT id FROM farmer_grove_balances WHERE farmer_address = ? AND grove_id = ?`,
      args: [farmerAddress, groveId]
    });
    
    if (existing.rows.length > 0) {
      console.log('\n📝 Updating existing balance record...');
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
      console.log('\n➕ Creating new balance record...');
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
    
    console.log('✅ Balance record created/updated successfully!');
    
    // Verify
    const verify = await client.execute({
      sql: `SELECT * FROM farmer_grove_balances WHERE farmer_address = ? AND grove_id = ?`,
      args: [farmerAddress, groveId]
    });
    
    if (verify.rows.length > 0) {
      const b = verify.rows[0] as any;
      console.log('\n✅ Verified:');
      console.log('  Available Balance:', (b.available_balance / 100).toFixed(2), 'USDC');
      console.log('  Total Withdrawn:', (b.total_withdrawn / 100).toFixed(2), 'USDC');
      console.log('  Total Earned:', (b.total_earned / 100).toFixed(2), 'USDC');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

createFarmerGroveBalance();
