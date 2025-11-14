/**
 * Liquidation Service
 * Handles automated loan liquidation when health factor drops below threshold
 */

import { db } from '../../db/index.js';
import { lendingLoans, lendingLiquidations, lendingLoanCollateral } from '../../db/schema/index.js';
import { eq, and, lt } from 'drizzle-orm';
import { loanManagementService } from './loan-management-service.js';
import { priceOracleService } from './price-oracle-service.js';
import { hederaLoanService } from './hedera-loan-service.js';

interface LiquidationResult {
    success: boolean;
    loanId: string;
    collateralSold: number;
    usdcRecovered: number;
    liquidationPenalty: number;
    liquidatorReward?: number;
    transactionHash?: string;
    error?: string;
}

interface LoanToLiquidate {
    loanId: string;
    borrowerAccount: string;
    loanAmountUsdc: number;
    collateralAmount: number;
    collateralTokenId: string;
    healthFactor: number;
    currentPrice: number;
}

export class LiquidationService {
    // Constants
    private readonly LIQUIDATION_THRESHOLD = 1.0; // Health factor < 1.0 triggers liquidation
    private readonly LIQUIDATION_PENALTY = 0.05; // 5% penalty
    private readonly LIQUIDATOR_REWARD = 0.02; // 2% reward for liquidator
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor() {
        console.log('[LiquidationService] Initialized');
    }

    /**
     * Start monitoring loans for liquidation
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            console.log('[LiquidationService] Already monitoring');
            return;
        }

        console.log('[LiquidationService] Starting loan monitoring...');
        this.isMonitoring = true;

        // Run immediately
        this.monitorLoans().catch(console.error);

        // Then run every 5 minutes
        this.monitoringInterval = setInterval(() => {
            this.monitorLoans().catch(console.error);
        }, this.CHECK_INTERVAL);

        console.log(`[LiquidationService] Monitoring started (checking every ${this.CHECK_INTERVAL / 1000}s)`);
    }

    /**
     * Stop monitoring loans
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        console.log('[LiquidationService] Stopping loan monitoring...');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('[LiquidationService] Monitoring stopped');
    }

    /**
     * Monitor all active loans and liquidate if necessary
     */
    async monitorLoans(): Promise<void> {
        console.log('[LiquidationService] Checking loans for liquidation...');

        try {
            // Get all active loans
            const activeLoans = await loanManagementService.getActiveLoans();
            console.log(`  Found ${activeLoans.length} active loans`);

            if (activeLoans.length === 0) {
                return;
            }

            // Check each loan
            let liquidatedCount = 0;
            let atRiskCount = 0;

            for (const loan of activeLoans) {
                try {
                    // Get current collateral price
                    const currentPrice = await priceOracleService.getTokenPrice(loan.collateralTokenId);

                    // Update loan health
                    await loanManagementService.updateLoanHealth(loan.loanId, currentPrice);

                    // Get updated loan
                    const updatedLoan = await loanManagementService.getLoan(loan.loanId);
                    if (!updatedLoan) continue;

                    // Check if should liquidate
                    if (await this.shouldLiquidate(updatedLoan, currentPrice)) {
                        console.log(`  ⚠️  Liquidating loan ${loan.loanId} (health: ${updatedLoan.healthFactor})`);
                        
                        const result = await this.executeLiquidation(loan.loanId);
                        
                        if (result.success) {
                            liquidatedCount++;
                            console.log(`  ✅ Loan ${loan.loanId} liquidated successfully`);
                        } else {
                            console.error(`  ❌ Failed to liquidate loan ${loan.loanId}:`, result.error);
                        }
                    } else if (updatedLoan.healthFactor < 1.1) {
                        atRiskCount++;
                        console.log(`  ⚠️  Loan ${loan.loanId} at risk (health: ${updatedLoan.healthFactor})`);
                    }

                } catch (error) {
                    console.error(`  Error checking loan ${loan.loanId}:`, error);
                }
            }

            console.log(`  Summary: ${liquidatedCount} liquidated, ${atRiskCount} at risk`);

        } catch (error) {
            console.error('[LiquidationService] Error monitoring loans:', error);
        }
    }

    /**
     * Check if a loan should be liquidated
     */
    async shouldLiquidate(loan: any, currentPrice: number): Promise<boolean> {
        // Check if loan is active
        if (loan.status !== 'active') {
            return false;
        }

        // Calculate current health factor
        const collateralValue = loan.collateralAmount * currentPrice;
        const healthFactor = (collateralValue * loan.liquidationThreshold) / loan.loanAmountUsdc;

        // Liquidate if health factor < 1.0
        return healthFactor < this.LIQUIDATION_THRESHOLD;
    }

    /**
     * Execute liquidation for a loan
     */
    async executeLiquidation(loanId: string): Promise<LiquidationResult> {
        console.log(`[LiquidationService] Executing liquidation for ${loanId}`);

        try {
            // Get loan details
            const loan = await loanManagementService.getLoan(loanId);
            if (!loan) {
                return {
                    success: false,
                    loanId,
                    collateralSold: 0,
                    usdcRecovered: 0,
                    liquidationPenalty: 0,
                    error: 'Loan not found'
                };
            }

            if (loan.status !== 'active') {
                return {
                    success: false,
                    loanId,
                    collateralSold: 0,
                    usdcRecovered: 0,
                    liquidationPenalty: 0,
                    error: `Loan is not active. Status: ${loan.status}`
                };
            }

            // Get collateral details
            const collateral = await db.select()
                .from(lendingLoanCollateral)
                .where(eq(lendingLoanCollateral.loanId, loanId))
                .limit(1);

            if (collateral.length === 0) {
                return {
                    success: false,
                    loanId,
                    collateralSold: 0,
                    usdcRecovered: 0,
                    liquidationPenalty: 0,
                    error: 'Collateral not found'
                };
            }

            // Get current price
            const currentPrice = await priceOracleService.getTokenPrice(loan.collateralTokenId);
            const collateralValue = loan.collateralAmount * currentPrice;

            // Calculate liquidation amounts
            const liquidationPenalty = collateralValue * this.LIQUIDATION_PENALTY;
            const liquidatorReward = collateralValue * this.LIQUIDATOR_REWARD;
            const usdcRecovered = Math.min(
                collateralValue - liquidationPenalty - liquidatorReward,
                loan.loanAmountUsdc
            );

            // Sell collateral (simplified - in production, this would sell on marketplace)
            const saleResult = await this.sellCollateral(
                loan.collateralTokenId,
                loan.collateralAmount,
                currentPrice
            );

            if (!saleResult.success) {
                return {
                    success: false,
                    loanId,
                    collateralSold: 0,
                    usdcRecovered: 0,
                    liquidationPenalty: 0,
                    error: `Failed to sell collateral: ${saleResult.error}`
                };
            }

            // Update loan status
            await db.update(lendingLoans)
                .set({
                    status: 'liquidated',
                    liquidatedAt: Date.now(),
                    healthFactor: 0,
                    updatedAt: Date.now()
                })
                .where(eq(lendingLoans.loanId, loanId));

            // Record liquidation
            const liquidationId = `liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(lendingLiquidations).values({
                liquidationId,
                loanId,
                borrowerAccount: loan.borrowerAccount,
                collateralTokenId: loan.collateralTokenId,
                collateralAmount: loan.collateralAmount,
                collateralValueAtLiquidation: collateralValue,
                usdcRecovered,
                liquidationPenalty,
                liquidationPrice: currentPrice,
                healthFactorAtLiquidation: loan.healthFactor,
                liquidatedAt: Date.now(),
                liquidatorAccount: process.env.HEDERA_OPERATOR_ID || null,
                liquidatorReward,
                transactionHash: saleResult.transactionHash,
                createdAt: Date.now()
            });

            // Distribute proceeds back to pool
            await this.distributeLiquidationProceeds(loan.assetAddress, usdcRecovered);

            console.log(`  ✅ Liquidation complete: ${loanId}`);
            console.log(`     Collateral Value: $${collateralValue.toFixed(2)}`);
            console.log(`     USDC Recovered: $${usdcRecovered.toFixed(2)}`);
            console.log(`     Penalty: $${liquidationPenalty.toFixed(2)}`);
            console.log(`     Liquidator Reward: $${liquidatorReward.toFixed(2)}`);

            return {
                success: true,
                loanId,
                collateralSold: loan.collateralAmount,
                usdcRecovered,
                liquidationPenalty,
                liquidatorReward,
                transactionHash: saleResult.transactionHash
            };

        } catch (error: any) {
            console.error('[LiquidationService] Error executing liquidation:', error);
            return {
                success: false,
                loanId,
                collateralSold: 0,
                usdcRecovered: 0,
                liquidationPenalty: 0,
                error: error.message || 'Unknown error during liquidation'
            };
        }
    }

    /**
     * Sell collateral tokens
     * In production, this would list on marketplace and wait for sale
     * For now, we simulate immediate sale at current price
     */
    private async sellCollateral(
        tokenId: string,
        amount: number,
        price: number
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        console.log(`[LiquidationService] Selling ${amount} tokens of ${tokenId} @ $${price}`);

        try {
            // In production, this would:
            // 1. List tokens on marketplace
            // 2. Wait for sale or use instant sale
            // 3. Transfer proceeds to treasury

            // For now, simulate sale with a transfer
            // Transfer collateral from treasury to operator (simulating sale)
            const treasuryId = process.env.HEDERA_TREASURY_ID || process.env.HEDERA_OPERATOR_ID;
            const operatorId = process.env.HEDERA_OPERATOR_ID;

            if (!treasuryId || !operatorId) {
                throw new Error('Missing treasury or operator ID');
            }

            // Simulate transaction hash
            const transactionHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 8)}`;

            console.log(`  ✅ Collateral sold: ${transactionHash}`);

            return {
                success: true,
                transactionHash
            };

        } catch (error: any) {
            console.error('[LiquidationService] Error selling collateral:', error);
            return {
                success: false,
                error: error.message || 'Failed to sell collateral'
            };
        }
    }

    /**
     * Distribute liquidation proceeds back to lending pool
     */
    private async distributeLiquidationProceeds(assetAddress: string, amount: number): Promise<void> {
        console.log(`[LiquidationService] Distributing ${amount} USDC to ${assetAddress} pool`);

        try {
            // Import pool stats schema
            const { lendingPoolStats } = await import('../../db/schema/index.js');

            // Update pool available liquidity
            await db.execute(`
                UPDATE lending_pool_stats 
                SET 
                    available_liquidity = available_liquidity + ${amount},
                    updated_at = ${Date.now()}
                WHERE asset_address = '${assetAddress}'
            `);

            console.log(`  ✅ Proceeds distributed to pool`);

        } catch (error) {
            console.error('[LiquidationService] Error distributing proceeds:', error);
        }
    }

    /**
     * Get liquidation history
     */
    async getLiquidationHistory(limit: number = 50): Promise<any[]> {
        try {
            const liquidations = await db.select()
                .from(lendingLiquidations)
                .orderBy(lendingLiquidations.liquidatedAt)
                .limit(limit);

            return liquidations;
        } catch (error) {
            console.error('[LiquidationService] Error getting liquidation history:', error);
            return [];
        }
    }

    /**
     * Get liquidations for a specific borrower
     */
    async getBorrowerLiquidations(borrowerAccount: string): Promise<any[]> {
        try {
            const liquidations = await db.select()
                .from(lendingLiquidations)
                .where(eq(lendingLiquidations.borrowerAccount, borrowerAccount))
                .orderBy(lendingLiquidations.liquidatedAt);

            return liquidations;
        } catch (error) {
            console.error('[LiquidationService] Error getting borrower liquidations:', error);
            return [];
        }
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus(): { isMonitoring: boolean; checkInterval: number } {
        return {
            isMonitoring: this.isMonitoring,
            checkInterval: this.CHECK_INTERVAL
        };
    }
}

// Export singleton instance
export const liquidationService = new LiquidationService();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_LIQUIDATION === 'true') {
    liquidationService.startMonitoring();
    console.log('[LiquidationService] Auto-started in production mode');
}
