import { db } from '../../db/index.js';
import { groveFundingPools, coffeeGroves } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Funding Pool Service
 * Manages grove funding pools and milestone allocations (40/30/30 split)
 */

export interface MilestoneFunds {
    upfront: {
        allocated: number;
        disbursed: number;
        available: number;
    };
    maintenance: {
        allocated: number;
        disbursed: number;
        available: number;
    };
    harvest: {
        allocated: number;
        disbursed: number;
        available: number;
    };
    totalInvestment: number;
    platformFeesCollected: number;
}

export interface FundingPool {
    id: number;
    groveId: number;
    totalInvestment: number;
    upfrontAllocated: number;
    upfrontDisbursed: number;
    upfrontAvailable: number;
    maintenanceAllocated: number;
    maintenanceDisbursed: number;
    maintenanceAvailable: number;
    harvestAllocated: number;
    harvestDisbursed: number;
    harvestAvailable: number;
    platformFeesCollected: number;
    createdAt: number;
    updatedAt: number;
}

export class FundingPoolService {
    /**
     * Create funding pool when grove is tokenized
     */
    async createFundingPool(groveId: number): Promise<void> {
        try {
            // Check if grove exists
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                throw new Error(`Grove ${groveId} not found`);
            }

            // Check if pool already exists
            const existingPool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            if (existingPool) {
                console.log(`[FundingPool] Pool already exists for grove ${groveId}`);
                return;
            }

            // Create new funding pool with zero balances
            const now = Date.now();
            await db.insert(groveFundingPools).values({
                groveId,
                totalInvestment: 0,
                upfrontAllocated: 0,
                upfrontDisbursed: 0,
                upfrontAvailable: 0,
                maintenanceAllocated: 0,
                maintenanceDisbursed: 0,
                maintenanceAvailable: 0,
                harvestAllocated: 0,
                harvestDisbursed: 0,
                harvestAvailable: 0,
                platformFeesCollected: 0,
                createdAt: now,
                updatedAt: now
            });

            console.log(`[FundingPool] Created funding pool for grove ${groveId}`);
        } catch (error: any) {
            console.error('[FundingPool] Error creating funding pool:', error);
            throw error;
        }
    }

    /**
     * Add investment to funding pool with 40/30/30 milestone split
     * Called when tokens are purchased
     */
    async addInvestment(groveId: number, amount: number): Promise<void> {
        try {
            if (amount <= 0) {
                throw new Error('Investment amount must be greater than zero');
            }

            // Get existing pool
            const pool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            if (!pool) {
                // Create pool if it doesn't exist
                await this.createFundingPool(groveId);
                // Retry after creation
                return this.addInvestment(groveId, amount);
            }

            // Calculate milestone allocations (40/30/30)
            const upfrontAmount = Math.floor(amount * 0.40);
            const maintenanceAmount = Math.floor(amount * 0.30);
            const harvestAmount = amount - upfrontAmount - maintenanceAmount; // Remainder to avoid rounding issues

            // Update pool with new investment
            await db.update(groveFundingPools)
                .set({
                    totalInvestment: pool.totalInvestment + amount,
                    upfrontAllocated: pool.upfrontAllocated + upfrontAmount,
                    upfrontAvailable: pool.upfrontAvailable + upfrontAmount,
                    maintenanceAllocated: pool.maintenanceAllocated + maintenanceAmount,
                    maintenanceAvailable: pool.maintenanceAvailable + maintenanceAmount,
                    harvestAllocated: pool.harvestAllocated + harvestAmount,
                    harvestAvailable: pool.harvestAvailable + harvestAmount,
                    updatedAt: Date.now()
                })
                .where(eq(groveFundingPools.groveId, groveId));

            console.log(`[FundingPool] Added ${amount} cents to grove ${groveId} pool (40/30/30 split)`);
        } catch (error: any) {
            console.error('[FundingPool] Error adding investment:', error);
            throw error;
        }
    }

    /**
     * Get available funds per milestone for a grove
     */
    async getAvailableFunds(groveId: number): Promise<MilestoneFunds | null> {
        try {
            const pool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            if (!pool) {
                return null;
            }

            return {
                upfront: {
                    allocated: pool.upfrontAllocated,
                    disbursed: pool.upfrontDisbursed,
                    available: pool.upfrontAvailable
                },
                maintenance: {
                    allocated: pool.maintenanceAllocated,
                    disbursed: pool.maintenanceDisbursed,
                    available: pool.maintenanceAvailable
                },
                harvest: {
                    allocated: pool.harvestAllocated,
                    disbursed: pool.harvestDisbursed,
                    available: pool.harvestAvailable
                },
                totalInvestment: pool.totalInvestment,
                platformFeesCollected: pool.platformFeesCollected
            };
        } catch (error: any) {
            console.error('[FundingPool] Error getting available funds:', error);
            throw error;
        }
    }

    /**
     * Validate if requested amount is available for milestone
     */
    async validateMilestoneAmount(
        groveId: number,
        milestone: 'upfront' | 'maintenance' | 'harvest',
        amount: number
    ): Promise<{ valid: boolean; available: number; error?: string }> {
        try {
            const pool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            if (!pool) {
                return {
                    valid: false,
                    available: 0,
                    error: 'Funding pool not found for this grove'
                };
            }

            let available = 0;
            switch (milestone) {
                case 'upfront':
                    available = pool.upfrontAvailable;
                    break;
                case 'maintenance':
                    available = pool.maintenanceAvailable;
                    break;
                case 'harvest':
                    available = pool.harvestAvailable;
                    break;
                default:
                    return {
                        valid: false,
                        available: 0,
                        error: 'Invalid milestone type'
                    };
            }

            if (amount > available) {
                return {
                    valid: false,
                    available,
                    error: `Insufficient funds. Available: ${available} cents, Requested: ${amount} cents`
                };
            }

            return {
                valid: true,
                available
            };
        } catch (error: any) {
            console.error('[FundingPool] Error validating milestone amount:', error);
            return {
                valid: false,
                available: 0,
                error: error.message || 'Validation failed'
            };
        }
    }

    /**
     * Record disbursement and update available funds
     * Called after successful fund transfer to farmer
     */
    async recordDisbursement(
        groveId: number,
        milestone: 'upfront' | 'maintenance' | 'harvest',
        amount: number,
        platformFee: number
    ): Promise<void> {
        try {
            const pool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            if (!pool) {
                throw new Error(`Funding pool not found for grove ${groveId}`);
            }

            // Prepare update based on milestone
            let updateData: any = {
                platformFeesCollected: pool.platformFeesCollected + platformFee,
                updatedAt: Date.now()
            };

            switch (milestone) {
                case 'upfront':
                    updateData.upfrontDisbursed = pool.upfrontDisbursed + amount;
                    updateData.upfrontAvailable = pool.upfrontAvailable - amount;
                    break;
                case 'maintenance':
                    updateData.maintenanceDisbursed = pool.maintenanceDisbursed + amount;
                    updateData.maintenanceAvailable = pool.maintenanceAvailable - amount;
                    break;
                case 'harvest':
                    updateData.harvestDisbursed = pool.harvestDisbursed + amount;
                    updateData.harvestAvailable = pool.harvestAvailable - amount;
                    break;
                default:
                    throw new Error('Invalid milestone type');
            }

            // Update pool
            await db.update(groveFundingPools)
                .set(updateData)
                .where(eq(groveFundingPools.groveId, groveId));

            console.log(`[FundingPool] Recorded disbursement for grove ${groveId}: ${amount} cents from ${milestone} milestone`);
        } catch (error: any) {
            console.error('[FundingPool] Error recording disbursement:', error);
            throw error;
        }
    }

    /**
     * Get full funding pool details
     */
    async getFundingPool(groveId: number): Promise<FundingPool | null> {
        try {
            const pool = await db.query.groveFundingPools.findFirst({
                where: eq(groveFundingPools.groveId, groveId)
            });

            return pool || null;
        } catch (error: any) {
            console.error('[FundingPool] Error getting funding pool:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const fundingPoolService = new FundingPoolService();
