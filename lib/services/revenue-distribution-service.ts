import { db } from '../../db/index.js';
import { coffeeGroves, harvestRecords, tokenHoldings, revenueDistributions, farmerBalances, farmerGroveBalances } from '../../db/schema/index.js';
import { eq, and, lte } from 'drizzle-orm';
import { transactionRecorder } from '../api/transaction-recording-service.js';
import { getHederaPaymentService, PaymentResult } from '../api/hedera-payment-service.js';

/**
 * Revenue Distribution Service
 * Handles revenue calculation and distribution for harvest events
 */

export interface RevenueSplit {
    farmerShare: number;
    investorPoolTotal: number;
    perTokenShare: number;
    tokenizationPercentage: number;
    baseFarmerShare: number;
    unsoldTokenBonus: number;
}

export interface RevenueSplitPreview {
    totalRevenue: number;
    tokenizationPercentage: number;
    farmerShare: {
        base: number;
        unsoldBonus: number;
        total: number;
        percentage: number;
    };
    investorShare: {
        total: number;
        perToken: number;
        percentage: number;
    };
}

export interface DistributionResult {
    success: boolean;
    distribution?: {
        harvestId: number;
        totalRevenue: number;
        farmerShare: number;
        investorPoolTotal: number;
        tokenHoldersCount: number;
        distributionsCreated: number;
    };
    error?: string;
}

export interface DistributionWithPayments extends DistributionResult {
    farmerPayment?: PaymentResult;
    investorPayments?: Array<{
        holderAddress: string;
        amount: number;
        payment: PaymentResult;
    }>;
    failedPayments?: number;
}

export class RevenueDistributionService {
    /**
     * Process investor payments in batches with concurrency limit
     * Requirements: 3.3, 3.4
     */
    private async processBatchInvestorPayments(
        holders: Array<{
            id: number;
            holderAddress: string;
            tokenAmount: number;
        }>,
        perTokenShare: number,
        harvestId: number,
        groveTokenAddress: string,
        distributionDate: number
    ): Promise<{
        investorPayments: Array<{
            holderAddress: string;
            amount: number;
            payment: PaymentResult;
        }>;
        distributionsCreated: number;
        failedPayments: number;
    }> {
        const paymentService = getHederaPaymentService();
        const investorPayments: Array<{
            holderAddress: string;
            amount: number;
            payment: PaymentResult;
        }> = [];
        
        let distributionsCreated = 0;
        let failedPayments = 0;
        const BATCH_SIZE = 10; // Process 10 payments concurrently

        // Process holders in batches
        for (let i = 0; i < holders.length; i += BATCH_SIZE) {
            const batch = holders.slice(i, i + BATCH_SIZE);
            
            // Create payment promises for this batch
            const paymentPromises = batch.map(async (holder) => {
                const holderShare = holder.tokenAmount * perTokenShare;

                // Create revenue distribution record with pending payment status
                const [distributionRecord] = await db.insert(revenueDistributions).values({
                    harvestId,
                    holderAddress: holder.holderAddress,
                    tokenAmount: holder.tokenAmount,
                    revenueShare: holderShare,
                    distributionDate,
                    paymentStatus: 'pending'
                }).returning();

                // Pay investor with USDC
                console.log(`[RevenueDistribution] Paying investor ${holder.holderAddress} ${holderShare} cents`);
                const investorPayment = await paymentService.transferFromTreasury(
                    holder.holderAddress,
                    holderShare,
                    `Harvest ${harvestId} revenue distribution`
                );

                return {
                    holder,
                    holderShare,
                    distributionRecord,
                    investorPayment
                };
            });

            // Wait for all payments in this batch to complete
            const results = await Promise.allSettled(paymentPromises);

            // Process results
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const { holder, holderShare, distributionRecord, investorPayment } = result.value;
                    
                    distributionsCreated++;
                    investorPayments.push({
                        holderAddress: holder.holderAddress,
                        amount: holderShare,
                        payment: investorPayment
                    });

                    // Update distribution record with payment result
                    if (investorPayment.success) {
                        await db.update(revenueDistributions)
                            .set({
                                paymentStatus: 'completed',
                                transactionId: investorPayment.transactionId,
                                transactionHash: investorPayment.transactionHash,
                                paidAt: Date.now()
                            })
                            .where(eq(revenueDistributions.id, distributionRecord.id));

                        // Record transaction in transaction history
                        await transactionRecorder.recordDistribution({
                            groveId: groveTokenAddress,
                            holderAddress: holder.holderAddress,
                            amount: holderShare,
                            distributionId: `harvest_${harvestId}_holder_${holder.id}`
                        });
                    } else {
                        failedPayments++;
                        await db.update(revenueDistributions)
                            .set({
                                paymentStatus: 'failed',
                                transactionHash: investorPayment.error
                            })
                            .where(eq(revenueDistributions.id, distributionRecord.id));

                        console.error(`[RevenueDistribution] Failed to pay investor ${holder.holderAddress}: ${investorPayment.error}`);
                    }
                } else {
                    // Promise rejected - log error
                    failedPayments++;
                    console.error(`[RevenueDistribution] Payment promise rejected:`, result.reason);
                }
            }

            console.log(`[RevenueDistribution] Batch ${Math.floor(i / BATCH_SIZE) + 1} completed: ${batch.length} payments processed`);
        }

        return {
            investorPayments,
            distributionsCreated,
            failedPayments
        };
    }

    /**
     * Calculate revenue split based on tokenization percentage
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
     */
    async calculateRevenueSplit(params: {
        groveId: number;
        totalRevenue: number;
        harvestDate: number;
    }): Promise<RevenueSplit> {
        const { groveId, totalRevenue, harvestDate } = params;

        try {
            // Get grove tokenization data
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                throw new Error('Grove not found');
            }

            const totalTokensIssued = grove.totalTokensIssued || 0;
            const tokensSold = grove.tokensSold || 0;

            // Calculate tokenization percentage (sold / issued)
            const tokenizationPercentage = totalTokensIssued > 0 
                ? tokensSold / totalTokensIssued 
                : 0;

            // Base shares: 30% farmer, 70% investor pool
            const baseFarmerShare = Math.floor(totalRevenue * 0.30);
            const investorPool = Math.floor(totalRevenue * 0.70);

            // Calculate unsold token bonus for farmer
            const unsoldPercentage = 1 - tokenizationPercentage;
            const unsoldTokenBonus = Math.floor(investorPool * unsoldPercentage);

            // Final farmer share = base + unsold bonus
            const farmerShare = baseFarmerShare + unsoldTokenBonus;

            // Investor distribution
            const investorPoolTotal = investorPool - unsoldTokenBonus;
            const perTokenShare = tokensSold > 0 
                ? Math.floor(investorPoolTotal / tokensSold) 
                : 0;

            return {
                farmerShare,
                investorPoolTotal,
                perTokenShare,
                tokenizationPercentage,
                baseFarmerShare,
                unsoldTokenBonus
            };

        } catch (error: any) {
            console.error('[RevenueDistribution] Error in calculateRevenueSplit:', error);
            throw error;
        }
    }

    /**
     * Distribute revenue to all token holders for a harvest
     * Requirements: 3.4, 4.1, 4.2, 4.3, 4.4, 4.5
     */
    async distributeRevenue(harvestId: number): Promise<DistributionResult> {
        try {
            // Step 1: Query harvest record
            const harvest = await db.query.harvestRecords.findFirst({
                where: eq(harvestRecords.id, harvestId)
            });

            if (!harvest) {
                return { success: false, error: 'Harvest record not found' };
            }

            if (harvest.revenueDistributed) {
                return { success: false, error: 'Revenue already distributed for this harvest' };
            }

            // Step 2: Get grove information
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, harvest.groveId)
            });

            if (!grove) {
                return { success: false, error: 'Grove not found' };
            }

            // Step 3: Calculate revenue split
            const revenueSplit = await this.calculateRevenueSplit({
                groveId: harvest.groveId,
                totalRevenue: harvest.totalRevenue,
                harvestDate: harvest.harvestDate
            });

            // Step 4: Get token holdings at harvest date timestamp
            const holders = await db.query.tokenHoldings.findMany({
                where: and(
                    eq(tokenHoldings.groveId, harvest.groveId),
                    eq(tokenHoldings.isActive, true),
                    lte(tokenHoldings.purchaseDate, harvest.harvestDate)
                )
            });

            console.log(`[RevenueDistribution] Found ${holders.length} token holders for harvest ${harvestId}`);

            // Step 5: Create revenue distribution records for each holder
            const distributionDate = Date.now();
            let distributionsCreated = 0;

            for (const holder of holders) {
                const holderShare = holder.tokenAmount * revenueSplit.perTokenShare;

                // Create revenue distribution record
                await db.insert(revenueDistributions).values({
                    harvestId,
                    holderAddress: holder.holderAddress,
                    tokenAmount: holder.tokenAmount,
                    revenueShare: holderShare,
                    distributionDate
                });

                // Record transaction in transaction history
                await transactionRecorder.recordDistribution({
                    groveId: grove.tokenAddress || harvest.groveId.toString(),
                    holderAddress: holder.holderAddress,
                    amount: holderShare,
                    distributionId: `harvest_${harvestId}_holder_${holder.id}`
                });

                distributionsCreated++;
            }

            // Step 6: Update farmer balance with farmer share
            const farmerAddress = grove.farmerAddress;
            
            // Get or create farmer balance record (global)
            const existingBalance = await db.query.farmerBalances.findFirst({
                where: eq(farmerBalances.farmerAddress, farmerAddress)
            });

            if (existingBalance) {
                await db.update(farmerBalances)
                    .set({
                        availableBalance: existingBalance.availableBalance + revenueSplit.farmerShare,
                        totalEarned: existingBalance.totalEarned + revenueSplit.farmerShare,
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerBalances.farmerAddress, farmerAddress));
            } else {
                await db.insert(farmerBalances).values({
                    farmerAddress,
                    availableBalance: revenueSplit.farmerShare,
                    pendingBalance: 0,
                    totalEarned: revenueSplit.farmerShare,
                    totalWithdrawn: 0,
                    updatedAt: Date.now()
                });
            }

            // Also update per-grove balance
            const existingGroveBalance = await db.query.farmerGroveBalances.findFirst({
                where: and(
                    eq(farmerGroveBalances.farmerAddress, farmerAddress),
                    eq(farmerGroveBalances.groveId, harvest.groveId)
                )
            });

            if (existingGroveBalance) {
                await db.update(farmerGroveBalances)
                    .set({
                        availableBalance: existingGroveBalance.availableBalance + revenueSplit.farmerShare,
                        totalEarned: existingGroveBalance.totalEarned + revenueSplit.farmerShare,
                        thisMonthDistributed: existingGroveBalance.thisMonthDistributed + revenueSplit.farmerShare,
                        lastCalculatedAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .where(and(
                        eq(farmerGroveBalances.farmerAddress, farmerAddress),
                        eq(farmerGroveBalances.groveId, harvest.groveId)
                    ));
            } else {
                await db.insert(farmerGroveBalances).values({
                    farmerAddress,
                    groveId: harvest.groveId,
                    availableBalance: revenueSplit.farmerShare,
                    totalEarned: revenueSplit.farmerShare,
                    thisMonthDistributed: revenueSplit.farmerShare,
                    pendingDistribution: 0,
                    totalWithdrawn: 0,
                    lastCalculatedAt: Date.now(),
                    updatedAt: Date.now()
                });
            }

            // Record farmer revenue transaction
            await transactionRecorder.recordDistribution({
                groveId: grove.tokenAddress || harvest.groveId.toString(),
                holderAddress: farmerAddress,
                amount: revenueSplit.farmerShare,
                distributionId: `harvest_${harvestId}_farmer`
            });

            // Step 7: Mark harvest as revenueDistributed = true
            await db.update(harvestRecords)
                .set({
                    revenueDistributed: true
                })
                .where(eq(harvestRecords.id, harvestId));

            console.log(`[RevenueDistribution] Distribution completed for harvest ${harvestId}: ${distributionsCreated} investors + farmer`);

            return {
                success: true,
                distribution: {
                    harvestId,
                    totalRevenue: harvest.totalRevenue,
                    farmerShare: revenueSplit.farmerShare,
                    investorPoolTotal: revenueSplit.investorPoolTotal,
                    tokenHoldersCount: holders.length,
                    distributionsCreated
                }
            };

        } catch (error: any) {
            console.error('[RevenueDistribution] Error in distributeRevenue:', error);
            return {
                success: false,
                error: error.message || 'Failed to distribute revenue'
            };
        }
    }

    /**
     * Distribute revenue with actual USDC payments
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
     */
    async distributeRevenueWithPayments(harvestId: number): Promise<DistributionWithPayments> {
        try {
            // Step 1: Query harvest record
            const harvest = await db.query.harvestRecords.findFirst({
                where: eq(harvestRecords.id, harvestId)
            });

            if (!harvest) {
                return { success: false, error: 'Harvest record not found' };
            }

            if (harvest.revenueDistributed) {
                return { success: false, error: 'Revenue already distributed for this harvest' };
            }

            // Step 2: Get grove information
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, harvest.groveId)
            });

            if (!grove) {
                return { success: false, error: 'Grove not found' };
            }

            // Step 3: Calculate revenue split
            const revenueSplit = await this.calculateRevenueSplit({
                groveId: harvest.groveId,
                totalRevenue: harvest.totalRevenue,
                harvestDate: harvest.harvestDate
            });

            // Step 4: Get token holdings at harvest date timestamp
            const holders = await db.query.tokenHoldings.findMany({
                where: and(
                    eq(tokenHoldings.groveId, harvest.groveId),
                    eq(tokenHoldings.isActive, true),
                    lte(tokenHoldings.purchaseDate, harvest.harvestDate)
                )
            });

            console.log(`[RevenueDistribution] Found ${holders.length} token holders for harvest ${harvestId}`);

            const distributionDate = Date.now();
            const farmerAddress = grove.farmerAddress;

            // Step 5: Update farmer balance (before payment)
            const existingBalance = await db.query.farmerBalances.findFirst({
                where: eq(farmerBalances.farmerAddress, farmerAddress)
            });

            if (existingBalance) {
                await db.update(farmerBalances)
                    .set({
                        availableBalance: existingBalance.availableBalance + revenueSplit.farmerShare,
                        totalEarned: existingBalance.totalEarned + revenueSplit.farmerShare,
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerBalances.farmerAddress, farmerAddress));
            } else {
                await db.insert(farmerBalances).values({
                    farmerAddress,
                    availableBalance: revenueSplit.farmerShare,
                    pendingBalance: 0,
                    totalEarned: revenueSplit.farmerShare,
                    totalWithdrawn: 0,
                    updatedAt: Date.now()
                });
            }

            // Also update per-grove balance
            const existingGroveBalance = await db.query.farmerGroveBalances.findFirst({
                where: and(
                    eq(farmerGroveBalances.farmerAddress, farmerAddress),
                    eq(farmerGroveBalances.groveId, harvest.groveId)
                )
            });

            if (existingGroveBalance) {
                await db.update(farmerGroveBalances)
                    .set({
                        availableBalance: existingGroveBalance.availableBalance + revenueSplit.farmerShare,
                        totalEarned: existingGroveBalance.totalEarned + revenueSplit.farmerShare,
                        thisMonthDistributed: existingGroveBalance.thisMonthDistributed + revenueSplit.farmerShare,
                        lastCalculatedAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .where(and(
                        eq(farmerGroveBalances.farmerAddress, farmerAddress),
                        eq(farmerGroveBalances.groveId, harvest.groveId)
                    ));
            } else {
                await db.insert(farmerGroveBalances).values({
                    farmerAddress,
                    groveId: harvest.groveId,
                    availableBalance: revenueSplit.farmerShare,
                    totalEarned: revenueSplit.farmerShare,
                    thisMonthDistributed: revenueSplit.farmerShare,
                    pendingDistribution: 0,
                    totalWithdrawn: 0,
                    lastCalculatedAt: Date.now(),
                    updatedAt: Date.now()
                });
            }

            // Step 6: Pay farmer with USDC
            console.log(`[RevenueDistribution] Paying farmer ${farmerAddress} ${revenueSplit.farmerShare} cents`);
            const paymentService = getHederaPaymentService();
            const farmerPayment = await paymentService.transferFromTreasury(
                farmerAddress,
                revenueSplit.farmerShare,
                `Harvest ${harvestId} farmer revenue`
            );

            // Record farmer revenue transaction
            await transactionRecorder.recordDistribution({
                groveId: grove.tokenAddress || harvest.groveId.toString(),
                holderAddress: farmerAddress,
                amount: revenueSplit.farmerShare,
                distributionId: `harvest_${harvestId}_farmer`
            });

            // Step 7: Process investor payments in batches
            const batchResult = await this.processBatchInvestorPayments(
                holders,
                revenueSplit.perTokenShare,
                harvestId,
                grove.tokenAddress || harvest.groveId.toString(),
                distributionDate
            );

            const { investorPayments, distributionsCreated, failedPayments } = batchResult;

            // Step 8: Mark harvest as revenueDistributed = true
            await db.update(harvestRecords)
                .set({
                    revenueDistributed: true
                })
                .where(eq(harvestRecords.id, harvestId));

            console.log(`[RevenueDistribution] Distribution with payments completed for harvest ${harvestId}`);
            console.log(`   Farmer payment: ${farmerPayment.success ? 'SUCCESS' : 'FAILED'}`);
            console.log(`   Investor payments: ${distributionsCreated - failedPayments}/${distributionsCreated} successful`);

            return {
                success: true,
                distribution: {
                    harvestId,
                    totalRevenue: harvest.totalRevenue,
                    farmerShare: revenueSplit.farmerShare,
                    investorPoolTotal: revenueSplit.investorPoolTotal,
                    tokenHoldersCount: holders.length,
                    distributionsCreated
                },
                farmerPayment,
                investorPayments,
                failedPayments
            };

        } catch (error: any) {
            console.error('[RevenueDistribution] Error in distributeRevenueWithPayments:', error);
            return {
                success: false,
                error: error.message || 'Failed to distribute revenue with payments'
            };
        }
    }

    /**
     * Retry failed payments from previous distributions
     * Requirements: 3.4
     */
    async retryFailedPayments(options?: {
        harvestId?: number;
        maxRetries?: number;
    }): Promise<{
        success: boolean;
        retriedCount: number;
        successCount: number;
        failedCount: number;
        results: Array<{
            distributionId: number;
            holderAddress: string;
            amount: number;
            success: boolean;
            error?: string;
        }>;
    }> {
        const maxRetries = options?.maxRetries || 3;
        const paymentService = getHederaPaymentService();

        try {
            // Query failed payments
            let failedDistributions;
            
            if (options?.harvestId) {
                // Retry failed payments for specific harvest
                failedDistributions = await db.query.revenueDistributions.findMany({
                    where: and(
                        eq(revenueDistributions.harvestId, options.harvestId),
                        eq(revenueDistributions.paymentStatus, 'failed')
                    )
                });
            } else {
                // Retry all failed payments
                failedDistributions = await db.query.revenueDistributions.findMany({
                    where: eq(revenueDistributions.paymentStatus, 'failed')
                });
            }

            console.log(`[RevenueDistribution] Found ${failedDistributions.length} failed payments to retry`);

            if (failedDistributions.length === 0) {
                return {
                    success: true,
                    retriedCount: 0,
                    successCount: 0,
                    failedCount: 0,
                    results: []
                };
            }

            const results: Array<{
                distributionId: number;
                holderAddress: string;
                amount: number;
                success: boolean;
                error?: string;
            }> = [];

            let successCount = 0;
            let failedCount = 0;

            // Retry each failed payment with exponential backoff
            for (const distribution of failedDistributions) {
                let retryCount = 0;
                let paymentSuccess = false;
                let lastError = '';

                while (retryCount < maxRetries && !paymentSuccess) {
                    // Exponential backoff: 1s, 2s, 4s
                    if (retryCount > 0) {
                        const delayMs = Math.pow(2, retryCount) * 1000;
                        console.log(`[RevenueDistribution] Waiting ${delayMs}ms before retry ${retryCount + 1}/${maxRetries}`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }

                    console.log(`[RevenueDistribution] Retrying payment to ${distribution.holderAddress} (attempt ${retryCount + 1}/${maxRetries})`);

                    // Get harvest info for memo
                    const harvest = await db.query.harvestRecords.findFirst({
                        where: eq(harvestRecords.id, distribution.harvestId)
                    });

                    if (!harvest) {
                        lastError = 'Harvest record not found';
                        break;
                    }

                    // Attempt payment
                    const paymentResult = await paymentService.transferFromTreasury(
                        distribution.holderAddress,
                        distribution.revenueShare,
                        `Harvest ${distribution.harvestId} revenue distribution (retry)`
                    );

                    if (paymentResult.success) {
                        // Update distribution record
                        await db.update(revenueDistributions)
                            .set({
                                paymentStatus: 'completed',
                                transactionId: paymentResult.transactionId,
                                transactionHash: paymentResult.transactionHash,
                                paidAt: Date.now()
                            })
                            .where(eq(revenueDistributions.id, distribution.id));

                        // Get grove info for transaction recording
                        const grove = await db.query.coffeeGroves.findFirst({
                            where: eq(coffeeGroves.id, harvest.groveId)
                        });

                        if (grove) {
                            // Record transaction in transaction history
                            await transactionRecorder.recordDistribution({
                                groveId: grove.tokenAddress || harvest.groveId.toString(),
                                holderAddress: distribution.holderAddress,
                                amount: distribution.revenueShare,
                                distributionId: `harvest_${distribution.harvestId}_holder_retry_${distribution.id}`
                            });
                        }

                        paymentSuccess = true;
                        successCount++;
                        console.log(`[RevenueDistribution] ✅ Retry successful for ${distribution.holderAddress}`);
                    } else {
                        lastError = paymentResult.error || 'Unknown error';
                        console.error(`[RevenueDistribution] ❌ Retry failed for ${distribution.holderAddress}: ${lastError}`);
                    }

                    retryCount++;
                }

                results.push({
                    distributionId: distribution.id,
                    holderAddress: distribution.holderAddress,
                    amount: distribution.revenueShare,
                    success: paymentSuccess,
                    error: paymentSuccess ? undefined : lastError
                });

                if (!paymentSuccess) {
                    failedCount++;
                }
            }

            console.log(`[RevenueDistribution] Retry completed: ${successCount} succeeded, ${failedCount} failed`);

            return {
                success: true,
                retriedCount: failedDistributions.length,
                successCount,
                failedCount,
                results
            };

        } catch (error: any) {
            console.error('[RevenueDistribution] Error in retryFailedPayments:', error);
            return {
                success: false,
                retriedCount: 0,
                successCount: 0,
                failedCount: 0,
                results: []
            };
        }
    }

    /**
     * Preview revenue split before harvest (for farmer planning)
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
     */
    async previewRevenueSplit(params: {
        groveId: number;
        totalRevenue: number;
    }): Promise<RevenueSplitPreview> {
        const { groveId, totalRevenue } = params;

        try {
            // Get current grove tokenization status
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                throw new Error('Grove not found');
            }

            const totalTokensIssued = grove.totalTokensIssued || 0;
            const tokensSold = grove.tokensSold || 0;

            // Calculate revenue split without saving
            const tokenizationPercentage = totalTokensIssued > 0 
                ? tokensSold / totalTokensIssued 
                : 0;

            const baseFarmerShare = Math.floor(totalRevenue * 0.30);
            const investorPool = Math.floor(totalRevenue * 0.70);
            
            const unsoldPercentage = 1 - tokenizationPercentage;
            const unsoldTokenBonus = Math.floor(investorPool * unsoldPercentage);
            
            const farmerTotal = baseFarmerShare + unsoldTokenBonus;
            const investorTotal = investorPool - unsoldTokenBonus;
            const perToken = tokensSold > 0 ? Math.floor(investorTotal / tokensSold) : 0;

            const farmerPercentage = totalRevenue > 0 
                ? Math.round((farmerTotal / totalRevenue) * 100) 
                : 0;
            const investorPercentage = totalRevenue > 0 
                ? Math.round((investorTotal / totalRevenue) * 100) 
                : 0;

            return {
                totalRevenue,
                tokenizationPercentage,
                farmerShare: {
                    base: baseFarmerShare,
                    unsoldBonus: unsoldTokenBonus,
                    total: farmerTotal,
                    percentage: farmerPercentage
                },
                investorShare: {
                    total: investorTotal,
                    perToken,
                    percentage: investorPercentage
                }
            };

        } catch (error: any) {
            console.error('[RevenueDistribution] Error in previewRevenueSplit:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const revenueDistributionService = new RevenueDistributionService();
