import { db } from '../db';
import { 
  groves, 
  farmers, 
  investors,
  tokenHoldings,
  harvests,
  revenueDistributions,
  farmerGroveBalances,
  investorWithdrawals,
  fundingRequests,
  loans
} from '../db/schema';
import { sql, count, sum, avg } from 'drizzle-orm';

async function getPlatformMetrics() {
  console.log('📊 Fetching Platform Economic Impact Metrics...\n');

  try {
    // 1. GROVES TOKENIZED
    const totalGroves = await db.select({ count: count() }).from(groves);
    const tokenizedGroves = await db.select({ count: count() })
      .from(groves)
      .where(sql`${groves.tokenId} IS NOT NULL`);
    
    console.log('🌳 GROVES TOKENIZED');
    console.log(`   Total Groves: ${totalGroves[0].count}`);
    console.log(`   Tokenized Groves: ${tokenizedGroves[0].count}`);

    // 2. CAPITAL RAISED
    const totalInvested = await db.select({ 
      total: sum(tokenHoldings.amountInvested) 
    }).from(tokenHoldings);
    
    const uniqueInvestors = await db.select({ 
      count: count(sql`DISTINCT ${tokenHoldings.investorId}`) 
    }).from(tokenHoldings);

    console.log('\n💰 CAPITAL RAISED');
    console.log(`   Total Invested: $${(Number(totalInvested[0].total) || 0).toFixed(2)} USDC`);
    console.log(`   Unique Investors: ${uniqueInvestors[0].count}`);

    // 3. REVENUE DISTRIBUTED
    const totalRevenue = await db.select({ 
      total: sum(harvests.totalRevenue) 
    }).from(harvests);

    const farmerEarnings = await db.select({ 
      total: sum(farmerGroveBalances.totalEarned) 
    }).from(farmerGroveBalances);

    const investorEarnings = await db.select({ 
      total: sum(revenueDistributions.amount) 
    }).from(revenueDistributions);

    const farmerWithdrawals = await db.select({ 
      total: sum(farmerGroveBalances.totalWithdrawn) 
    }).from(farmerGroveBalances);

    const investorWithdrawalTotal = await db.select({ 
      total: sum(investorWithdrawals.amount) 
    }).from(investorWithdrawals);

    console.log('\n📈 REVENUE DISTRIBUTED');
    console.log(`   Total Harvest Revenue: $${(Number(totalRevenue[0].total) || 0).toFixed(2)}`);
    console.log(`   Farmer Earnings: $${(Number(farmerEarnings[0].total) || 0).toFixed(2)}`);
    console.log(`   Investor Earnings: $${(Number(investorEarnings[0].total) || 0).toFixed(2)}`);
    console.log(`   Farmer Withdrawals: $${(Number(farmerWithdrawals[0].total) || 0).toFixed(2)}`);
    console.log(`   Investor Withdrawals: $${(Number(investorWithdrawalTotal[0].total) || 0).toFixed(2)}`);

    // 4. FARMERS EMPOWERED
    const totalFarmers = await db.select({ count: count() }).from(farmers);
    const farmersWithGroves = await db.select({ 
      count: count(sql`DISTINCT ${groves.farmerId}`) 
    }).from(groves);
    
    const avgCreditScore = await db.select({ 
      avg: avg(farmers.creditScore) 
    }).from(farmers);

    const farmersWithWithdrawals = await db.select({ 
      count: count(sql`DISTINCT ${farmerGroveBalances.farmerId}`) 
    }).from(farmerGroveBalances)
    .where(sql`${farmerGroveBalances.totalWithdrawn} > 0`);

    console.log('\n👨‍🌾 FARMERS EMPOWERED');
    console.log(`   Total Farmers: ${totalFarmers[0].count}`);
    console.log(`   Farmers with Groves: ${farmersWithGroves[0].count}`);
    console.log(`   Average Credit Score: ${(Number(avgCreditScore[0].avg) || 0).toFixed(0)}`);
    console.log(`   Farmers Who've Withdrawn: ${farmersWithWithdrawals[0].count}`);

    // 5. ADDITIONAL METRICS
    const totalTokensSold = await db.select({ 
      total: sum(groves.tokensSold) 
    }).from(groves);

    const totalHarvests = await db.select({ count: count() }).from(harvests);

    const approvedFunding = await db.select({ 
      count: count(),
      total: sum(fundingRequests.amountRequested)
    }).from(fundingRequests)
    .where(sql`${fundingRequests.status} = 'approved'`);

    const activeLoans = await db.select({ 
      count: count(),
      total: sum(loans.principalAmount)
    }).from(loans)
    .where(sql`${loans.status} = 'active'`);

    console.log('\n📊 ADDITIONAL METRICS');
    console.log(`   Total Tokens Sold: ${Number(totalTokensSold[0].total) || 0}`);
    console.log(`   Total Harvests Recorded: ${totalHarvests[0].count}`);
    console.log(`   Approved Funding Requests: ${approvedFunding[0].count}`);
    console.log(`   Total Funding Approved: $${(Number(approvedFunding[0].total) || 0).toFixed(2)}`);
    console.log(`   Active Loans: ${activeLoans[0].count}`);
    console.log(`   Total Active Loan Value: $${(Number(activeLoans[0].total) || 0).toFixed(2)}`);

    // 6. CALCULATE VALUE RETENTION
    const totalValue = Number(totalRevenue[0].total) || 0;
    const farmerValue = Number(farmerEarnings[0].total) || 0;
    const farmerPercentage = totalValue > 0 ? (farmerValue / totalValue * 100) : 0;

    console.log('\n🎯 VALUE RETENTION');
    console.log(`   Farmer Share: ${farmerPercentage.toFixed(1)}% (vs 10% traditional)`);
    console.log(`   Value Multiplier: ${(farmerPercentage / 10).toFixed(1)}x traditional models`);

    console.log('\n✅ Metrics collection complete!');

  } catch (error) {
    console.error('❌ Error fetching metrics:', error);
    throw error;
  }
}

getPlatformMetrics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
