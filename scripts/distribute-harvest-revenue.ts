import 'dotenv/config';
import { db } from '../db/index.js';
import { harvestRecords } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { RevenueDistributionService } from '../lib/services/revenue-distribution-service.js';

async function distributeHarvestRevenue() {
  const harvestId = process.argv[2];
  
  if (!harvestId) {
    console.error('❌ Please provide a harvest ID');
    console.log('Usage: npx tsx scripts/distribute-harvest-revenue.ts <harvestId>');
    process.exit(1);
  }
  
  console.log(`\n🚀 Distributing revenue for harvest #${harvestId}...\n`);
  
  try {
    const service = new RevenueDistributionService();
    const result = await service.distributeRevenue(parseInt(harvestId));
    
    if (result.success && result.distribution) {
      console.log('\n✅ Revenue distributed successfully!');
      console.log('\n📊 Distribution Summary:');
      console.log(`  Harvest ID: ${result.distribution.harvestId}`);
      console.log(`  Total Revenue: $${(result.distribution.totalRevenue / 100).toFixed(2)}`);
      console.log(`  Farmer Share: $${(result.distribution.farmerShare / 100).toFixed(2)}`);
      console.log(`  Investor Pool: $${(result.distribution.investorPoolTotal / 100).toFixed(2)}`);
      console.log(`  Token Holders: ${result.distribution.tokenHoldersCount}`);
      console.log(`  Distributions Created: ${result.distribution.distributionsCreated}`);
    } else {
      console.error('\n❌ Distribution failed:', result.error);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

distributeHarvestRevenue();
