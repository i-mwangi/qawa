/**
 * Investor Withdrawal Service
 * Handles investor earnings withdrawals and balance tracking
 * Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.3
 */

import { db } from '../../db/index.js';
import { revenueDistributions, investorWithdrawals } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { getHederaPaymentService, PaymentResult, HederaPaymentService } from '../api/hedera-payment-service.js';

export interface InvestorBalance {
    totalEarned: number;
    totalWithdrawn: number;
    availableBalance: number;
    pendingDistributions: number;
}

export interface WithdrawalRequest {
    investorAddress: string;
    amount: number;
    groveId?: number; // Optional: withdraw from specific grove
}

export interface Withdrawal {
    id: string;
    investorAddress: string;
    amount: number;
    status: string;
    transactionHash?: string;
    transactionId?: string;
    blockExplorerUrl?: string;
    errorMessage?: string;
    requestedAt: number;
    completedAt?: number;
}

export class InvestorWithdrawalService {
    private hederaPaymentService: HederaPaymentService;

    constructor() {
        // Initialize Hedera payment service
        this.hederaPaymentService = getHederaPaymentService();
        console.log('✅ Investor Withdrawal Service initialized');
    }

    /**
     * Get investor's current balance
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     */
    async getBalance(investorAddress: string): Promise<InvestorBalance> {
        try {
            console.log(`[InvestorWithdrawal] Getting balance for ${investorAddress}`);

            // Query all revenue distributions for investor
            const distributions = await db.query.revenueDistributions.findMany({
                where: eq(revenueDistributions.holderAddress, investorAddress)
            });

            // Sum total earned amount
            const totalEarned = distributions.reduce((sum: number, dist) => sum + dist.revenueShare, 0);

            console.log(`[InvestorWithdrawal] Total earned: ${totalEarned} cents (${(totalEarned / 100).toFixed(2)})`);

            // Query all completed withdrawals
            const withdrawals = await db.query.investorWithdrawals.findMany({
                where: and(
                    eq(investorWithdrawals.investorAddress, investorAddress),
                    eq(investorWithdrawals.status, 'completed')
                )
            });

            // Sum total withdrawn amount
            const totalWithdrawn = withdrawals.reduce((sum: number, withdrawal) => sum + withdrawal.amount, 0);

            console.log(`[InvestorWithdrawal] Total withdrawn: ${totalWithdrawn} cents (${(totalWithdrawn / 100).toFixed(2)})`);

            // Calculate available balance (earned - withdrawn)
            const availableBalance = totalEarned - totalWithdrawn;

            console.log(`[InvestorWithdrawal] Available balance: ${availableBalance} cents (${(availableBalance / 100).toFixed(2)})`);

            // Count pending distributions (distributions without payment status or with pending status)
            const pendingDistributions = distributions.filter(
                (dist) => !dist.paymentStatus || dist.paymentStatus === 'pending'
            ).length;

            return {
                totalEarned,
                totalWithdrawn,
                availableBalance,
                pendingDistributions
            };

        } catch (error: any) {
            console.error('[InvestorWithdrawal] Error getting balance:', error);
            throw new Error(`Failed to get investor balance: ${error.message}`);
        }
    }

    /**
     * Process withdrawal request
     * Requirements: 2.1, 2.2, 2.3, 2.4
     */
    async processWithdrawal(request: WithdrawalRequest): Promise<PaymentResult> {
        const { investorAddress, amount } = request;

        try {
            console.log(`[InvestorWithdrawal] Processing withdrawal for ${investorAddress}: ${amount} cents (${(amount / 100).toFixed(2)})`);

            // Validate withdrawal amount against available balance
            const balance = await this.getBalance(investorAddress);

            if (amount <= 0) {
                return {
                    success: false,
                    error: 'Withdrawal amount must be greater than zero',
                    status: 'FAILED'
                };
            }

            if (amount > balance.availableBalance) {
                return {
                    success: false,
                    error: `Insufficient balance. Available: ${(balance.availableBalance / 100).toFixed(2)}, Requested: ${(amount / 100).toFixed(2)}`,
                    status: 'FAILED'
                };
            }

            // Create withdrawal record with pending status
            const withdrawalId = `withdrawal_${investorAddress}_${Date.now()}`;
            const requestedAt = Date.now();

            await db.insert(investorWithdrawals).values({
                id: withdrawalId,
                investorAddress,
                amount,
                status: 'pending',
                requestedAt,
                createdAt: requestedAt,
                updatedAt: requestedAt
            });

            console.log(`[InvestorWithdrawal] Created withdrawal record: ${withdrawalId}`);

            // Call HederaPaymentService to transfer USDC
            const paymentResult = await this.hederaPaymentService.transferFromTreasury(
                investorAddress,
                amount,
                `Investor withdrawal: ${withdrawalId}`
            );

            // Update withdrawal record with transaction details
            if (paymentResult.success) {
                await db.update(investorWithdrawals)
                    .set({
                        status: 'completed',
                        transactionHash: paymentResult.transactionHash,
                        transactionId: paymentResult.transactionId,
                        blockExplorerUrl: paymentResult.blockExplorerUrl,
                        completedAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .where(eq(investorWithdrawals.id, withdrawalId));

                console.log(`[InvestorWithdrawal] ✅ Withdrawal completed successfully`);
                console.log(`   Transaction ID: ${paymentResult.transactionId}`);
                console.log(`   Explorer: ${paymentResult.blockExplorerUrl}`);
            } else {
                // Update withdrawal record with error
                await db.update(investorWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: paymentResult.error,
                        updatedAt: Date.now()
                    })
                    .where(eq(investorWithdrawals.id, withdrawalId));

                console.error(`[InvestorWithdrawal] ❌ Withdrawal failed: ${paymentResult.error}`);
            }

            return paymentResult;

        } catch (error: any) {
            console.error('[InvestorWithdrawal] Error processing withdrawal:', error);
            return {
                success: false,
                error: error.message || 'Failed to process withdrawal',
                status: 'FAILED'
            };
        }
    }

    /**
     * Get withdrawal history
     * Requirements: 5.3
     */
    async getWithdrawalHistory(investorAddress: string): Promise<Withdrawal[]> {
        try {
            console.log(`[InvestorWithdrawal] Getting withdrawal history for ${investorAddress}`);

            // Query investor_withdrawals table by address
            const withdrawalRecords = await db.query.investorWithdrawals.findMany({
                where: eq(investorWithdrawals.investorAddress, investorAddress),
                orderBy: (withdrawals, { desc }) => [desc(withdrawals.requestedAt)]
            });

            // Format withdrawal records for API response
            const formattedWithdrawals: Withdrawal[] = withdrawalRecords.map((record) => ({
                id: record.id,
                investorAddress: record.investorAddress,
                amount: record.amount,
                status: record.status,
                transactionHash: record.transactionHash || undefined,
                transactionId: record.transactionId || undefined,
                blockExplorerUrl: record.blockExplorerUrl || undefined,
                errorMessage: record.errorMessage || undefined,
                requestedAt: record.requestedAt,
                completedAt: record.completedAt || undefined
            }));

            console.log(`[InvestorWithdrawal] Found ${formattedWithdrawals.length} withdrawal records`);

            return formattedWithdrawals;

        } catch (error: any) {
            console.error('[InvestorWithdrawal] Error getting withdrawal history:', error);
            throw new Error(`Failed to get withdrawal history: ${error.message}`);
        }
    }
}

// Export singleton instance
export const investorWithdrawalService = new InvestorWithdrawalService();
