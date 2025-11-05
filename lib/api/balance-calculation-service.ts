/**
 * Balance Calculation Service
 * Handles automatic calculation and updating of farmer and investor balances
 */

import { db } from '../db';
import {
    farmerGroveEarnings,
    farmerGroveBalances,
    investorEarnings,
    investorBalances,
    investorClaims,
    lpTokenInterest
} from '../db/schema/earnings-distribution';
import { farmerWithdrawals } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export class BalanceCalculationService {

    /**
     * Update farmer balance for a specific grove
     * Called after harvest distribution or withdrawal
     */
    async updateFarmerGroveBalance(farmerAddress: string, groveId: number): Promise<void> {
        try {
            const now = Date.now();
            const startOfMonth = this.getStartOfMonth();

            // Get all earnings for this grove
            const earnings = await db.query.farmerGroveEarnings.findMany({
                where: and(
                    eq(farmerGroveEarnings.farmerAddress, farmerAddress),
                    eq(farmerGroveEarnings.groveId, groveId)
                )
            });

            // Calculate this month's distributed
            const thisMonthDistributed = earnings
                .filter(e => 
                    e.distributionStatus === 'distributed' && 
                    e.distributedAt && 
                    e.distributedAt >= startOfMonth
                )
                .reduce((sum, e) => sum + e.farmerShare, 0);

            // Calculate available balance (distributed but not withdrawn)
            const availableBalance = earnings
                .filter(e => 
                    e.distributionStatus === 'distributed' && 
                    !e.withdrawnAt
                )
                .reduce((sum, e) => sum + e.farmerShare, 0);

            // Calculate pending distribution
            const pendingDistribution = earnings
                .filter(e => e.distributionStatus === 'pending')
                .reduce((sum, e) => sum + e.farmerShare, 0);

            // Calculate total earned
            const totalEarned = earnings.reduce((sum, e) => sum + e.farmerShare, 0);

            // Get total withdrawn
            const withdrawals = await db.query.farmerWithdrawals.findMany({
                where: and(
                    eq(farmerWithdrawals.farmerAddress, farmerAddress),
                    eq(farmerWithdrawals.groveId, groveId),
                    eq(farmerWithdrawals.status, 'completed')
                )
            });

            const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

            // Upsert balance record
            const existingBalance = await db.query.farmerGroveBalances.findFirst({
                where: and(
                    eq(farmerGroveBalances.farmerAddress, farmerAddress),
                    eq(farmerGroveBalances.groveId, groveId)
                )
            });

            if (existingBalance) {
                await db.update(farmerGroveBalances)
                    .set({
                        thisMonthDistributed,
                        availableBalance,
                        pendingDistribution,
                        totalWithdrawn,
                        totalEarned,
                        lastCalculatedAt: now,
                        updatedAt: now
                    })
                    .where(and(
                        eq(farmerGroveBalances.farmerAddress, farmerAddress),
                        eq(farmerGroveBalances.groveId, groveId)
                    ));
            } else {
                await db.insert(farmerGroveBalances).values({
                    farmerAddress,
                    groveId,
                    thisMonthDistributed,
                    availableBalance,
                    pendingDistribution,
                    totalWithdrawn,
                    totalEarned,
                    lastCalculatedAt: now,
                    updatedAt: now
                });
            }

            console.log(`✅ Updated farmer balance for ${farmerAddress}, grove ${groveId}`);
        } catch (error) {
            console.error('Error updating farmer grove balance:', error);
            throw error;
        }
    }

    /**
     * Update investor balance aggregating all sources
     * Called after earnings distribution or claim
     */
    async updateInvestorBalance(investorAddress: string): Promise<void> {
        try {
            const now = Date.now();
            const startOfMonth = this.getStartOfMonth();

            // Get all earnings
            const earnings = await db.query.investorEarnings.findMany({
                where: eq(investorEarnings.investorAddress, investorAddress)
            });

            // Calculate total earnings all time
            const totalEarningsAllTime = earnings.reduce((sum, e) => sum + e.earningAmount, 0);

            // Calculate this month's earnings
            const totalEarningsThisMonth = earnings
                .filter(e => e.distributedAt && e.distributedAt >= startOfMonth)
                .reduce((sum, e) => sum + e.earningAmount, 0);

            // Calculate unclaimed by type
            const unclaimed = earnings.filter(e => e.status === 'unclaimed');

            const unclaimedPrimaryMarket = unclaimed
                .filter(e => e.earningType === 'primary_market')
                .reduce((sum, e) => sum + e.earningAmount, 0);

            const unclaimedSecondaryMarket = unclaimed
                .filter(e => e.earningType === 'secondary_market')
                .reduce((sum, e) => sum + e.earningAmount, 0);

            const unclaimedLpInterest = unclaimed
                .filter(e => e.earningType === 'lp_interest')
                .reduce((sum, e) => sum + e.earningAmount, 0);

            const totalUnclaimed = unclaimedPrimaryMarket + unclaimedSecondaryMarket + unclaimedLpInterest;

            // Calculate total claimed
            const totalClaimed = earnings
                .filter(e => e.status === 'claimed')
                .reduce((sum, e) => sum + e.earningAmount, 0);

            // Get last claim date
            const lastClaim = await db.query.investorClaims.findFirst({
                where: and(
                    eq(investorClaims.investorAddress, investorAddress),
                    eq(investorClaims.status, 'completed')
                ),
                orderBy: (table, { desc }) => [desc(table.completedAt)]
            });

            // Upsert balance record
            const existingBalance = await db.query.investorBalances.findFirst({
                where: eq(investorBalances.investorAddress, investorAddress)
            });

            if (existingBalance) {
                await db.update(investorBalances)
                    .set({
                        totalEarningsAllTime,
                        totalEarningsThisMonth,
                        unclaimedPrimaryMarket,
                        unclaimedSecondaryMarket,
                        unclaimedLpInterest,
                        totalUnclaimed,
                        totalClaimed,
                        lastClaimAt: lastClaim?.completedAt || existingBalance.lastClaimAt,
                        lastCalculatedAt: now,
                        updatedAt: now
                    })
                    .where(eq(investorBalances.investorAddress, investorAddress));
            } else {
                await db.insert(investorBalances).values({
                    investorAddress,
                    totalEarningsAllTime,
                    totalEarningsThisMonth,
                    unclaimedPrimaryMarket,
                    unclaimedSecondaryMarket,
                    unclaimedLpInterest,
                    totalUnclaimed,
                    totalClaimed,
                    lastClaimAt: lastClaim?.completedAt || null,
                    lastCalculatedAt: now,
                    updatedAt: now
                });
            }

            console.log(`✅ Updated investor balance for ${investorAddress}`);
        } catch (error) {
            console.error('Error updating investor balance:', error);
            throw error;
        }
    }

    /**
     * Get farmer balance for a specific grove
     */
    async getFarmerGroveBalance(farmerAddress: string, groveId: number) {
        try {
            let balance = await db.query.farmerGroveBalances.findFirst({
                where: and(
                    eq(farmerGroveBalances.farmerAddress, farmerAddress),
                    eq(farmerGroveBalances.groveId, groveId)
                )
            });

            // If no balance exists, calculate it
            if (!balance) {
                await this.updateFarmerGroveBalance(farmerAddress, groveId);
                balance = await db.query.farmerGroveBalances.findFirst({
                    where: and(
                        eq(farmerGroveBalances.farmerAddress, farmerAddress),
                        eq(farmerGroveBalances.groveId, groveId)
                    )
                });
            }

            return balance || {
                farmerAddress,
                groveId,
                thisMonthDistributed: 0,
                availableBalance: 0,
                pendingDistribution: 0,
                totalWithdrawn: 0,
                totalEarned: 0
            };
        } catch (error) {
            console.error('Error getting farmer grove balance:', error);
            throw error;
        }
    }

    /**
     * Get all grove balances for a farmer
     */
    async getAllFarmerGroveBalances(farmerAddress: string) {
        try {
            const balances = await db.query.farmerGroveBalances.findMany({
                where: eq(farmerGroveBalances.farmerAddress, farmerAddress)
            });

            return balances;
        } catch (error) {
            console.error('Error getting all farmer grove balances:', error);
            throw error;
        }
    }

    /**
     * Get investor balance
     */
    async getInvestorBalance(investorAddress: string) {
        try {
            let balance = await db.query.investorBalances.findFirst({
                where: eq(investorBalances.investorAddress, investorAddress)
            });

            // If no balance exists, calculate it
            if (!balance) {
                await this.updateInvestorBalance(investorAddress);
                balance = await db.query.investorBalances.findFirst({
                    where: eq(investorBalances.investorAddress, investorAddress)
                });
            }

            return balance || {
                investorAddress,
                totalEarningsAllTime: 0,
                totalEarningsThisMonth: 0,
                unclaimedPrimaryMarket: 0,
                unclaimedSecondaryMarket: 0,
                unclaimedLpInterest: 0,
                totalUnclaimed: 0,
                totalClaimed: 0
            };
        } catch (error) {
            console.error('Error getting investor balance:', error);
            throw error;
        }
    }

    /**
     * Recalculate all balances for a farmer
     */
    async recalculateAllFarmerBalances(farmerAddress: string): Promise<void> {
        try {
            // Get all groves for this farmer
            const balances = await db.query.farmerGroveBalances.findMany({
                where: eq(farmerGroveBalances.farmerAddress, farmerAddress)
            });

            // Update each grove balance
            for (const balance of balances) {
                await this.updateFarmerGroveBalance(farmerAddress, balance.groveId);
            }

            console.log(`✅ Recalculated all balances for farmer ${farmerAddress}`);
        } catch (error) {
            console.error('Error recalculating farmer balances:', error);
            throw error;
        }
    }

    /**
     * Get start of current month timestamp
     */
    private getStartOfMonth(): number {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return startOfMonth.getTime();
    }
}

// Export singleton instance
export const balanceCalculationService = new BalanceCalculationService();
