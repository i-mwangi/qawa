/**
 * Auto Distribution Service
 * Automatically distributes earnings when harvest is reported
 */

import { db } from '../db';
import {
    harvestRecords,
    coffeeGroves,
    tokenHoldings
} from '../db/schema';
import {
    farmerGroveEarnings,
    investorTokenHoldings,
    investorEarnings
} from '../db/schema/earnings-distribution';
import { eq, and } from 'drizzle-orm';
import { balanceCalculationService } from './balance-calculation-service';

interface DistributionResult {
    success: boolean;
    harvestId: number;
    farmerEarningsCreated: number;
    investorEarningsCreated: number;
    totalDistributed: number;
    distributedAt: number;
    error?: string;
}

export class AutoDistributionService {

    /**
     * Automatically distribute earnings when harvest is reported
     * This is called immediately after harvest record is created
     */
    async distributeHarvestEarnings(harvestId: number): Promise<DistributionResult> {
        const now = Date.now();

        try {
            console.log(`\n💰 Starting automatic distribution for harvest ${harvestId}...`);

            // Get harvest with grove information
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(eq(harvestRecords.id, harvestId))
                .limit(1);

            if (harvestWithGrove.length === 0) {
                throw new Error(`Harvest ${harvestId} not found`);
            }

            const { harvest, grove } = harvestWithGrove[0];

            // Check if already distributed
            if (harvest.revenueDistributed) {
                console.log(`⚠️  Harvest ${harvestId} already distributed`);
                return {
                    success: false,
                    harvestId,
                    farmerEarningsCreated: 0,
                    investorEarningsCreated: 0,
                    totalDistributed: 0,
                    distributedAt: now,
                    error: 'Harvest already distributed'
                };
            }

            // Step 1: Create farmer earnings record
            console.log(`📝 Creating farmer earnings record...`);
            await db.insert(farmerGroveEarnings).values({
                farmerAddress: grove.farmerAddress,
                groveId: grove.id,
                harvestId: harvest.id,
                grossRevenue: harvest.totalRevenue,
                farmerShare: harvest.farmerShare,
                distributionStatus: 'distributed', // Immediately mark as distributed
                distributedAt: now,
                createdAt: now,
                updatedAt: now
            });

            console.log(`✅ Farmer earnings created: ${harvest.farmerShare / 100} for ${grove.farmerAddress}`);

            // Step 2: Get all active token holders for the grove
            console.log(`🔍 Finding token holders for grove ${grove.id}...`);
            
            // First check new investor_token_holdings table
            let holders = await db.query.investorTokenHoldings.findMany({
                where: and(
                    eq(investorTokenHoldings.groveId, grove.id),
                    eq(investorTokenHoldings.isActive, true)
                )
            });

            // If no holders in new table, check old tokenHoldings table for backward compatibility
            if (holders.length === 0) {
                const oldHolders = await db.query.tokenHoldings.findMany({
                    where: and(
                        eq(tokenHoldings.groveId, grove.id),
                        eq(tokenHoldings.isActive, true)
                    )
                });

                // Migrate old holders to new table
                if (oldHolders.length > 0) {
                    console.log(`📦 Migrating ${oldHolders.length} token holders to new table...`);
                    for (const oldHolder of oldHolders) {
                        await db.insert(investorTokenHoldings).values({
                            investorAddress: oldHolder.holderAddress,
                            groveId: oldHolder.groveId,
                            tokenAmount: oldHolder.tokenAmount,
                            acquisitionType: 'primary', // Assume primary for migrated data
                            purchasePrice: oldHolder.purchasePrice,
                            purchaseDate: oldHolder.purchaseDate,
                            isActive: true,
                            createdAt: now,
                            updatedAt: now
                        });
                    }
                    
                    // Re-fetch holders
                    holders = await db.query.investorTokenHoldings.findMany({
                        where: and(
                            eq(investorTokenHoldings.groveId, grove.id),
                            eq(investorTokenHoldings.isActive, true)
                        )
                    });
                }
            }

            if (holders.length === 0) {
                console.log(`⚠️  No token holders found for grove ${grove.groveName}`);
                
                // Still mark harvest as distributed even if no investors
                await db.update(harvestRecords)
                    .set({
                        revenueDistributed: true,
                        transactionHash: `auto_dist_${now}`
                    })
                    .where(eq(harvestRecords.id, harvestId));

                // Update farmer balance
                await balanceCalculationService.updateFarmerGroveBalance(grove.farmerAddress, grove.id);

                return {
                    success: true,
                    harvestId,
                    farmerEarningsCreated: 1,
                    investorEarningsCreated: 0,
                    totalDistributed: harvest.farmerShare,
                    distributedAt: now
                };
            }

            console.log(`👥 Found ${holders.length} token holders`);

            // Step 3: Calculate and create investor earnings
            const totalTokens = holders.reduce((sum, h) => sum + h.tokenAmount, 0);
            console.log(`🪙 Total tokens in circulation: ${totalTokens}`);

            let investorEarningsCreated = 0;

            for (const holder of holders) {
                const sharePercentage = holder.tokenAmount / totalTokens;
                const earningAmount = Math.floor(harvest.investorShare * sharePercentage);

                if (earningAmount > 0) {
                    await db.insert(investorEarnings).values({
                        investorAddress: holder.investorAddress,
                        earningType: holder.acquisitionType === 'primary' ? 'primary_market' : 'secondary_market',
                        sourceId: harvest.id,
                        groveId: grove.id,
                        holdingId: holder.id,
                        tokenAmount: holder.tokenAmount,
                        earningAmount,
                        status: 'unclaimed',
                        distributedAt: now,
                        createdAt: now,
                        updatedAt: now
                    });

                    investorEarningsCreated++;
                    console.log(`  ✅ ${holder.investorAddress}: ${earningAmount / 100} (${(sharePercentage * 100).toFixed(2)}%)`);
                }
            }

            console.log(`✅ Created ${investorEarningsCreated} investor earnings records`);

            // Step 4: Mark harvest as distributed
            await db.update(harvestRecords)
                .set({
                    revenueDistributed: true,
                    transactionHash: `auto_dist_${now}`
                })
                .where(eq(harvestRecords.id, harvestId));

            console.log(`✅ Harvest marked as distributed`);

            // Step 5: Update balances
            console.log(`📊 Updating balances...`);
            
            // Update farmer balance
            await balanceCalculationService.updateFarmerGroveBalance(grove.farmerAddress, grove.id);
            
            // Update investor balances
            for (const holder of holders) {
                await balanceCalculationService.updateInvestorBalance(holder.investorAddress);
            }

            console.log(`✅ Balances updated`);

            const totalDistributed = harvest.farmerShare + harvest.investorShare;

            console.log(`\n🎉 Distribution completed successfully!`);
            console.log(`   Harvest ID: ${harvestId}`);
            console.log(`   Total Distributed: ${totalDistributed / 100}`);
            console.log(`   Farmer Share: ${harvest.farmerShare / 100}`);
            console.log(`   Investor Share: ${harvest.investorShare / 100}`);
            console.log(`   Investors: ${investorEarningsCreated}\n`);

            return {
                success: true,
                harvestId,
                farmerEarningsCreated: 1,
                investorEarningsCreated,
                totalDistributed,
                distributedAt: now
            };

        } catch (error: any) {
            console.error('❌ Error distributing harvest earnings:', error);
            return {
                success: false,
                harvestId,
                farmerEarningsCreated: 0,
                investorEarningsCreated: 0,
                totalDistributed: 0,
                distributedAt: now,
                error: error.message || 'Unknown error'
            };
        }
    }

    /**
     * Get distribution status for a harvest
     */
    async getDistributionStatus(harvestId: number) {
        try {
            const harvest = await db.query.harvestRecords.findFirst({
                where: eq(harvestRecords.id, harvestId)
            });

            if (!harvest) {
                return null;
            }

            // Get farmer earnings
            const farmerEarning = await db.query.farmerGroveEarnings.findFirst({
                where: eq(farmerGroveEarnings.harvestId, harvestId)
            });

            // Get investor earnings
            const investorEarningsList = await db.query.investorEarnings.findMany({
                where: eq(investorEarnings.sourceId, harvestId)
            });

            return {
                harvestId,
                isDistributed: harvest.revenueDistributed,
                farmerEarning: farmerEarning ? {
                    amount: farmerEarning.farmerShare,
                    status: farmerEarning.distributionStatus,
                    distributedAt: farmerEarning.distributedAt
                } : null,
                investorEarnings: investorEarningsList.map(e => ({
                    investorAddress: e.investorAddress,
                    amount: e.earningAmount,
                    type: e.earningType,
                    status: e.status,
                    distributedAt: e.distributedAt
                })),
                totalInvestorEarnings: investorEarningsList.reduce((sum, e) => sum + e.earningAmount, 0)
            };
        } catch (error) {
            console.error('Error getting distribution status:', error);
            return null;
        }
    }

    /**
     * Retry failed distribution
     */
    async retryDistribution(harvestId: number): Promise<DistributionResult> {
        try {
            // Check if distribution already exists
            const existingFarmerEarning = await db.query.farmerGroveEarnings.findFirst({
                where: eq(farmerGroveEarnings.harvestId, harvestId)
            });

            if (existingFarmerEarning) {
                return {
                    success: false,
                    harvestId,
                    farmerEarningsCreated: 0,
                    investorEarningsCreated: 0,
                    totalDistributed: 0,
                    distributedAt: Date.now(),
                    error: 'Distribution already exists for this harvest'
                };
            }

            // Retry distribution
            return await this.distributeHarvestEarnings(harvestId);
        } catch (error: any) {
            console.error('Error retrying distribution:', error);
            return {
                success: false,
                harvestId,
                farmerEarningsCreated: 0,
                investorEarningsCreated: 0,
                totalDistributed: 0,
                distributedAt: Date.now(),
                error: error.message || 'Unknown error'
            };
        }
    }
}

// Export singleton instance
export const autoDistributionService = new AutoDistributionService();
