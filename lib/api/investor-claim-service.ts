/**
 * Investor Claim Service
 * Handles investor earnings claims with partial claim support
 */

import { db } from '../db';
import {
    investorEarnings,
    investorClaims,
    investorBalances
} from '../db/schema/earnings-distribution';
import { eq, and, inArray } from 'drizzle-orm';
import { balanceCalculationService } from './balance-calculation-service';

interface ClaimRequest {
    investorAddress: string;
    earningIds: number[];
    amount: number;
}

interface ClaimResult {
    success: boolean;
    claimId?: string;
    transactionHash?: string;
    amount?: number;
    error?: string;
}

export class InvestorClaimService {

    /**
     * Process investor claim
     * Supports partial claims - investor can claim any portion of unclaimed earnings
     */
    async processInvestorClaim(request: ClaimRequest): Promise<ClaimResult> {
        const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const now = Date.now();

        try {
            // Validate amount
            if (request.amount <= 0) {
                return {
                    success: false,
                    error: 'Amount must be positive'
                };
            }

            // Validate earning IDs
            if (!request.earningIds || request.earningIds.length === 0) {
                return {
                    success: false,
                    error: 'At least one earning ID must be provided'
                };
            }

            // Get earnings and verify they belong to investor and are unclaimed
            const earnings = await db.query.investorEarnings.findMany({
                where: and(
                    eq(investorEarnings.investorAddress, request.investorAddress),
                    eq(investorEarnings.status, 'unclaimed'),
                    inArray(investorEarnings.id, request.earningIds)
                )
            });

            if (earnings.length === 0) {
                return {
                    success: false,
                    error: 'No unclaimed earnings found for the provided IDs'
                };
            }

            // Calculate total available from selected earnings
            const totalAvailable = earnings.reduce((sum, e) => sum + e.earningAmount, 0);

            // Convert request amount to cents
            const requestedAmountInCents = Math.floor(request.amount * 100);

            if (requestedAmountInCents > totalAvailable) {
                return {
                    success: false,
                    error: `Insufficient unclaimed earnings. Available: ${(totalAvailable / 100).toFixed(2)}, Requested: ${request.amount.toFixed(2)}`
                };
            }

            // Create pending claim record
            await db.insert(investorClaims).values({
                id: claimId,
                investorAddress: request.investorAddress,
                claimAmount: requestedAmountInCents,
                earningIds: JSON.stringify(request.earningIds),
                status: 'pending',
                requestedAt: now,
                createdAt: now,
                updatedAt: now
            });

            // Execute Hedera transaction
            // TODO: Integrate with Hedera for actual token transfer
            const transactionHash = await this.executeHederaTransfer(
                request.investorAddress,
                requestedAmountInCents
            );

            if (!transactionHash) {
                // Get the actual error message
                const errorMsg = 'Failed to execute Hedera transaction. Please ensure USDC token is associated with your wallet.';
                
                // Update claim as failed
                await db.update(investorClaims)
                    .set({
                        status: 'failed',
                        errorMessage: errorMsg,
                        updatedAt: Date.now()
                    })
                    .where(eq(investorClaims.id, claimId));

                return {
                    success: false,
                    claimId,
                    error: errorMsg
                };
            }

            // Update claim as completed
            const blockExplorerUrl = this.getBlockExplorerUrl(transactionHash);
            await db.update(investorClaims)
                .set({
                    status: 'completed',
                    transactionHash,
                    blockExplorerUrl,
                    completedAt: Date.now(),
                    updatedAt: Date.now()
                })
                .where(eq(investorClaims.id, claimId));

            // Mark earnings as claimed
            await db.update(investorEarnings)
                .set({
                    status: 'claimed',
                    claimedAt: Date.now(),
                    claimTxHash: transactionHash
                })
                .where(inArray(investorEarnings.id, request.earningIds));

            // Update investor balance
            await balanceCalculationService.updateInvestorBalance(request.investorAddress);

            console.log(`✅ Claim processed successfully: ${claimId}`);

            return {
                success: true,
                claimId,
                transactionHash,
                amount: request.amount
            };

        } catch (error: any) {
            console.error('Error processing investor claim:', error);

            // Check if it's a token association error
            const errorMsg = error.message || 'Unknown error';
            const isAssociationError = errorMsg.includes('associate') || errorMsg.includes('USDC token');

            // Update claim as failed
            try {
                await db.update(investorClaims)
                    .set({
                        status: 'failed',
                        errorMessage: error.message || 'Unknown error',
                        updatedAt: Date.now()
                    })
                    .where(eq(investorClaims.id, claimId));
            } catch (dbError) {
                console.error('Error updating claim record:', dbError);
            }

            // Return the actual error message (especially for token association errors)
            return {
                success: false,
                claimId,
                error: errorMsg
            };
        }
    }

    /**
     * Get unclaimed earnings for an investor
     */
    async getUnclaimedEarnings(investorAddress: string) {
        try {
            const earnings = await db.query.investorEarnings.findMany({
                where: and(
                    eq(investorEarnings.investorAddress, investorAddress),
                    eq(investorEarnings.status, 'unclaimed')
                ),
                orderBy: (table, { desc }) => [desc(table.distributedAt)]
            });

            // Group by earning type
            const grouped = {
                primaryMarket: earnings.filter(e => e.earningType === 'primary_market'),
                secondaryMarket: earnings.filter(e => e.earningType === 'secondary_market'),
                lpInterest: earnings.filter(e => e.earningType === 'lp_interest')
            };

            return {
                all: earnings,
                grouped,
                totals: {
                    primaryMarket: grouped.primaryMarket.reduce((sum, e) => sum + e.earningAmount, 0),
                    secondaryMarket: grouped.secondaryMarket.reduce((sum, e) => sum + e.earningAmount, 0),
                    lpInterest: grouped.lpInterest.reduce((sum, e) => sum + e.earningAmount, 0),
                    total: earnings.reduce((sum, e) => sum + e.earningAmount, 0)
                }
            };
        } catch (error) {
            console.error('Error getting unclaimed earnings:', error);
            throw error;
        }
    }

    /**
     * Get claim history for an investor
     */
    async getClaimHistory(investorAddress: string, limit: number = 50) {
        try {
            const claims = await db.query.investorClaims.findMany({
                where: eq(investorClaims.investorAddress, investorAddress),
                orderBy: (table, { desc }) => [desc(table.requestedAt)],
                limit
            });

            return claims.map(claim => ({
                ...claim,
                claimAmount: claim.claimAmount / 100, // Convert cents to dollars
                earningIds: JSON.parse(claim.earningIds)
            }));
        } catch (error) {
            console.error('Error getting claim history:', error);
            return [];
        }
    }

    /**
     * Get claimable amount for specific earning IDs
     */
    async getClaimableAmount(investorAddress: string, earningIds: number[]): Promise<number> {
        try {
            const earnings = await db.query.investorEarnings.findMany({
                where: and(
                    eq(investorEarnings.investorAddress, investorAddress),
                    eq(investorEarnings.status, 'unclaimed'),
                    inArray(investorEarnings.id, earningIds)
                )
            });

            const totalInCents = earnings.reduce((sum, e) => sum + e.earningAmount, 0);
            return totalInCents / 100; // Convert to dollars
        } catch (error) {
            console.error('Error getting claimable amount:', error);
            return 0;
        }
    }

    /**
     * Execute Hedera transfer (placeholder for actual implementation)
     */
    private async executeHederaTransfer(
        recipientAddress: string,
        amountInCents: number
    ): Promise<string | null> {
        try {
            const useBlockchain = process.env.USE_HEDERA_BLOCKCHAIN === 'true';
            
            if (useBlockchain) {
                console.log(`[Investor Claim] Using real blockchain transaction`);
                // Use the same Hedera withdrawal service as farmers
                const { getHederaWithdrawalService } = await import('./hedera-withdrawal-service');
                const hederaService = getHederaWithdrawalService();
                
                // Check token association
                const isAssociated = await hederaService.checkTokenAssociation(recipientAddress);
                if (!isAssociated) {
                    console.error(`[Investor Claim] Token not associated for ${recipientAddress}`);
                    throw new Error('Please associate USDC token in your HashPack wallet first');
                }
                
                // Execute transfer
                const result = await hederaService.transferUSDC(recipientAddress, amountInCents);
                
                if (!result.success) {
                    console.error(`[Investor Claim] Transfer failed:`, result.error);
                    return null;
                }
                
                console.log(`[Investor Claim] ✅ Transfer successful: ${result.transactionHash}`);
                return result.transactionHash;
                
            } else {
                // Mock transaction for development
                console.log(`[Investor Claim] Using mock transaction`);
                console.log(`[Investor Claim] Amount: $${amountInCents / 100} to ${recipientAddress}`);
                
                const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substring(2)}`;
                console.log(`[Investor Claim] Mock transaction: ${mockTxHash}`);
                
                return mockTxHash;
            }
        } catch (error: any) {
            console.error('[Investor Claim] Error executing transfer:', error);
            return null;
        }
    }

    /**
     * Get block explorer URL for transaction
     */
    private getBlockExplorerUrl(transactionHash: string): string {
        const network = process.env.HEDERA_NETWORK || 'testnet';
        return `https://hashscan.io/${network}/transaction/${transactionHash}`;
    }

    /**
     * Validate claim request
     */
    async validateClaimRequest(request: ClaimRequest): Promise<{
        isValid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        try {
            // Validate address format
            if (!this.isValidAddress(request.investorAddress)) {
                errors.push('Invalid investor address format');
            }

            // Validate amount
            if (request.amount <= 0) {
                errors.push('Amount must be positive');
            }

            // Validate earning IDs
            if (!request.earningIds || request.earningIds.length === 0) {
                errors.push('At least one earning ID must be provided');
            }

            // Check if earnings exist and are claimable
            const claimableAmount = await this.getClaimableAmount(
                request.investorAddress,
                request.earningIds
            );

            if (claimableAmount === 0) {
                errors.push('No claimable earnings found for the provided IDs');
            }

            if (request.amount > claimableAmount) {
                errors.push(`Requested amount (${request.amount}) exceeds claimable amount (${claimableAmount})`);
            }

            return {
                isValid: errors.length === 0,
                errors
            };
        } catch (error) {
            console.error('Error validating claim request:', error);
            errors.push('Validation error occurred');
            return {
                isValid: false,
                errors
            };
        }
    }

    /**
     * Validate address format
     */
    private isValidAddress(address: string): boolean {
        // Accept either Ethereum-style 0x... addresses or Hedera account IDs like 0.0.123456
        const eth = /^0x[a-fA-F0-9]{40}$/.test(address);
        const hedera = /^\d+\.\d+\.\d+$/.test(address);
        return eth || hedera;
    }
}

// Export singleton instance
export const investorClaimService = new InvestorClaimService();
