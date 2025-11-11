import 'dotenv/config';
import { createClient } from '@libsql/client';

async function manuallyDistributeHarvest10() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing Turso credentials');
    process.exit(1);
  }
  
  try {
    const client = createClient({ url, authToken: token });
    
    console.log('\n🚀 Manually distributing harvest #10...\n');
    
    // Get harvest details
    const harvest = await client.execute({
      sql: 'SELECT * FROM harvest_records WHERE id = ?',
      args: [10]
    });
    
    if (harvest.rows.length === 0) {
      console.error('❌ Harvest #10 not found');
      process.exit(1);
    }
    
    const h = harvest.rows[0] as any;
    console.log('Harvest Details:');
    console.log(`  Grove ID: ${h.grove_id}`);
    console.log(`  Farmer Share: $${(h.farmer_share / 100).toFixed(2)}`);
    console.log(`  Investor Share: $${(h.investor_share / 100).toFixed(2)}`);
    console.log('');
    
    // Get grove details
    const grove = await client.execute({
      sql: 'SELECT * FROM coffee_groves WHERE id = ?',
      args: [h.grove_id]
    });
    
    if (grove.rows.length === 0) {
      console.error('❌ Grove not found');
      process.exit(1);
    }
    
    const g = grove.rows[0] as any;
    const farmerAddress = g.farmer_address;
    console.log(`Farmer Address: ${farmerAddress}`);
    console.log('');
    
    // Check if farmer_grove_balances record exists
    const existingBalance = await client.execute({
      sql: 'SELECT * FROM farmer_grove_balances WHERE farmer_address = ? AND grove_id = ?',
      args: [farmerAddress, h.grove_id]
    });
    
    if (existingBalance.rows.length > 0) {
      // Update existing balance
      const b = existingBalance.rows[0] as any;
      console.log('📝 Updating existing farmer_grove_balances...');
      console.log(`  Current Available: $${(b.available_balance / 100).toFixed(2)}`);
      console.log(`  Adding: $${(h.farmer_share / 100).toFixed(2)}`);
      
      await client.execute({
        sql: `
          UPDATE farmer_grove_balances
          SET available_balance = available_balance + ?,
              total_earned = total_earned + ?,
              this_month_distributed = this_month_distributed + ?,
              last_calculated_at = ?,
              updated_at = ?
          WHERE farmer_address = ? AND grove_id = ?
        `,
        args: [
          h.farmer_share,
          h.farmer_share,
          h.farmer_share,
          Date.now(),
          Date.now(),
          farmerAddress,
          h.grove_id
        ]
      });
    } else {
      // Create new balance record
      console.log('➕ Creating new farmer_grove_balances record...');
      
      await client.execute({
        sql: `
          INSERT INTO farmer_grove_balances (
            farmer_address, grove_id, this_month_distributed, available_balance,
            pending_distribution, total_withdrawn, total_earned,
            last_calculated_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          farmerAddress,
          h.grove_id,
          h.farmer_share,
          h.farmer_share,
          0,
          0,
          h.farmer_share,
          Date.now(),
          Date.now()
        ]
      });
    }
    
    // Mark harvest as distributed
    console.log('✅ Marking harvest as distributed...');
    await client.execute({
      sql: 'UPDATE harvest_records SET revenue_distributed = 1 WHERE id = ?',
      args: [10]
    });
    
    // Verify the update
    const verify = await client.execute({
      sql: 'SELECT * FROM farmer_grove_balances WHERE farmer_address = ? AND grove_id = ?',
      args: [farmerAddress, h.grove_id]
    });
    
    if (verify.rows.length > 0) {
      const b = verify.rows[0] as any;
      console.log('\n✅ Distribution Complete!');
      console.log('\n📊 Updated Balance:');
      console.log(`  Available Balance: $${(b.available_balance / 100).toFixed(2)}`);
      console.log(`  Total Earned: $${(b.total_earned / 100).toFixed(2)}`);
      console.log(`  This Month: $${(b.this_month_distributed / 100).toFixed(2)}`);
      console.log('\n🎉 Farmer can now withdraw from the dashboard!');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

manuallyDistributeHarvest10();
