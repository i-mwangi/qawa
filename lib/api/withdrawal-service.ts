/**
 * Withdrawal Service
 * Handles farmer and liquidity provider withdrawals with Hedera integration
 */

import { db } from '../db'
import { farmerWithdrawals, liquidityWithdrawals, farmerBalances } from '../db/schema/index'
import { eq, desc } from 'drizzle-orm'
import { hederaOperationsService } from './hedera-operations-service'
import { hederaLendingService } from './hedera-lending-service'
import { getEnv } from '../utils'

interface WithdrawalRequest {
    address: string
    amount: number
    groveId?: number
}

interface WithdrawalResult {
    success: boolean
    withdrawalId?: string
    transactionHash?: string
    amount?: number
    error?: string
}

export class WithdrawalService {
    constructor() {
        console.log('✅ Withdrawal Service initialized with Hedera SDK')
    }

    /**
     * Process farmer withdrawal
     */
    async processFarmerWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResult> {
        const withdrawalId = `fw_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        const now = Date.now()

        try {
            // Validate amount
            if (request.amount <= 0) {
                return {
                    success: false,
                    error: 'Amount must be positive'
                }
            }

            // Check farmer balance
            const balance = await this.getFarmerBalance(request.address)
            const requestedAmountInCents = Math.floor(request.amount * 100)
            
            if (balance.availableBalance < requestedAmountInCents) {
                return {
                    success: false,
                    error: `Insufficient balance. Available: ${(balance.availableBalance / 100).toFixed(2)}`
                }
            }

            // Check 30% withdrawal limit
            if (requestedAmountInCents > balance.maxWithdrawable) {
                return {
                    success: false,
                    error: `Withdrawal exceeds 30% limit. Maximum: ${(balance.maxWithdrawable / 100).toFixed(2)}`
                }
            }

            // Create pending withdrawal record
            await db.insert(farmerWithdrawals).values({
                id: withdrawalId,
                farmerAddress: request.address,
                groveId: request.groveId || null,
                amount: Math.floor(request.amount * 100), // Convert to cents
                status: 'pending',
                requestedAt: now,
                createdAt: now,
                updatedAt: now
            })

            // Execute withdrawal using Hedera SDK
            const contractResult = await hederaOperationsService.processFarmerWithdrawal(
                request.address,
                request.amount
            )

            if (!contractResult.success) {
                // Update withdrawal record as failed
                await db.update(farmerWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: contractResult.error,
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerWithdrawals.id, withdrawalId))

                return {
                    success: false,
                    withdrawalId,
                    error: contractResult.error
                }
            }

            // Update withdrawal record as completed
            const blockExplorerUrl = this.getBlockExplorerUrl(contractResult.transactionId!)
            await db.update(farmerWithdrawals)
                .set({
                    status: 'completed',
                    transactionHash: contractResult.transactionId,
                    blockExplorerUrl,
                    completedAt: Date.now(),
                    updatedAt: Date.now()
                })
                .where(eq(farmerWithdrawals.id, withdrawalId))

            // Update farmer balance
            await this.updateFarmerBalance(request.address, -request.amount)

            return {
                success: true,
                withdrawalId,
                transactionHash: contractResult.transactionId,
                amount: request.amount
            }

        } catch (error: any) {
            console.error('Error processing farmer withdrawal:', error)

            // Update withdrawal record as failed
            try {
                await db.update(farmerWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: error.message || 'Unknown error',
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerWithdrawals.id, withdrawalId))
            } catch (dbError) {
                console.error('Error updating withdrawal record:', dbError)
            }

            return {
                success: false,
                withdrawalId,
                error: error.message || 'Failed to process withdrawal'
            }
        }
    }

    /**
     * Process liquidity provider withdrawal
     */
    async processLiquidityWithdrawal(
        providerAddress: string,
        assetAddress: string,
        lpTokenAmount: number
    ): Promise<WithdrawalResult> {
        const withdrawalId = `lw_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        const now = Date.now()

        try {
            // Validate amount
            if (lpTokenAmount <= 0) {
                return {
                    success: false,
                    error: 'LP token amount must be positive'
                }
            }

            // Create pending withdrawal record (we'll update with actual amounts after contract call)
            await db.insert(liquidityWithdrawals).values({
                id: withdrawalId,
                providerAddress,
                assetAddress,
                lpTokenAmount: Math.floor(lpTokenAmount * 100),
                usdcReturned: 0, // Will be updated
                rewardsEarned: 0, // Will be updated
                status: 'pending',
                requestedAt: now,
                createdAt: now,
                updatedAt: now
            })

            // Execute withdrawal using Hedera SDK
            const contractResult = await hederaLendingService.withdrawLiquidity(
                providerAddress,
                assetAddress,
                lpTokenAmount
            )

            if (!contractResult.success) {
                // Update withdrawal record as failed
                await db.update(liquidityWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: contractResult.error,
                        updatedAt: Date.now()
                    })
                    .where(eq(liquidityWithdrawals.id, withdrawalId))

                return {
                    success: false,
                    withdrawalId,
                    error: contractResult.error
                }
            }

            // Update withdrawal record as completed
            const blockExplorerUrl = this.getBlockExplorerUrl(contractResult.transactionId!)
            await db.update(liquidityWithdrawals)
                .set({
                    status: 'completed',
                    usdcReturned: Math.floor((contractResult.usdcReturned || 0) * 100),
                    rewardsEarned: Math.floor((contractResult.rewardsEarned || 0) * 100),
                    transactionHash: contractResult.transactionId,
                    blockExplorerUrl,
                    completedAt: Date.now(),
                    updatedAt: Date.now()
                })
                .where(eq(liquidityWithdrawals.id, withdrawalId))

            return {
                success: true,
                withdrawalId,
                transactionHash: contractResult.transactionId,
                amount: contractResult.usdcReturned
            }

        } catch (error: any) {
            console.error('Error processing liquidity withdrawal:', error)

            // Update withdrawal record as failed
            try {
                await db.update(liquidityWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: error.message || 'Unknown error',
                        updatedAt: Date.now()
                    })
                    .where(eq(liquidityWithdrawals.id, withdrawalId))
            } catch (dbError) {
                console.error('Error updating withdrawal record:', dbError)
            }

            return {
                success: false,
                withdrawalId,
                error: error.message || 'Failed to process withdrawal'
            }
        }
    }

    /**
     * Get farmer balance
     */
    async getFarmerBalance(farmerAddress: string): Promise<any> {
        try {
            const balance = await db.query.farmerBalances.findFirst({
                where: eq(farmerBalances.farmerAddress, farmerAddress)
            })

            if (!balance) {
                // Create initial balance record
                await db.insert(farmerBalances).values({
                    farmerAddress,
                    availableBalance: 0,
                    pendingBalance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    updatedAt: Date.now()
                })

                return {
                    availableBalance: 0,
                    pendingBalance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    lastWithdrawalAt: null,
                    maxWithdrawable: 0
                }
            }

            // Calculate max withdrawable (30% of available balance)
            const maxWithdrawable = Math.floor(balance.availableBalance * 0.3)

            return {
                ...balance,
                maxWithdrawable
            }
        } catch (error) {
            console.error('Error getting farmer balance:', error)
            return {
                availableBalance: 0,
                pendingBalance: 0,
                totalEarned: 0,
                totalWithdrawn: 0,
                lastWithdrawalAt: null,
                maxWithdrawable: 0
            }
        }
    }

    /**
     * Update farmer balance
     */
    async updateFarmerBalance(farmerAddress: string, amountChange: number): Promise<void> {
        try {
            const balance = await this.getFarmerBalance(farmerAddress)
            const amountInCents = Math.floor(amountChange * 100)

            await db.update(farmerBalances)
                .set({
                    availableBalance: balance.availableBalance + amountInCents,
                    totalWithdrawn: amountChange < 0 
                        ? balance.totalWithdrawn + Math.abs(amountInCents)
                        : balance.totalWithdrawn,
                    lastWithdrawalAt: amountChange < 0 ? Date.now() : balance.lastWithdrawalAt,
                    updatedAt: Date.now()
                })
                .where(eq(farmerBalances.farmerAddress, farmerAddress))
        } catch (error) {
            console.error('Error updating farmer balance:', error)
            throw error
        }
    }

    /**
     * Add pending balance when harvest is reported
     * This moves revenue to pending status until distribution
     */
    async addPendingBalance(farmerAddress: string, amount: number): Promise<void> {
        try {
            const balance = await this.getFarmerBalance(farmerAddress)
            const amountInCents = Math.floor(amount * 100)

            await db.update(farmerBalances)
                .set({
                    pendingBalance: balance.pendingBalance + amountInCents,
                    totalEarned: balance.totalEarned + amountInCents,
                    updatedAt: Date.now()
                })
                .where(eq(farmerBalances.farmerAddress, farmerAddress))

            console.log(`✅ Added ${amount} to pending balance for ${farmerAddress}`)
        } catch (error) {
            console.error('Error adding pending balance:', error)
            throw error
        }
    }

    /**
     * Move balance from pending to available after on-chain distribution
     * This is called when revenue is successfully distributed on-chain
     */
    async movePendingToAvailable(farmerAddress: string, amount: number): Promise<void> {
        try {
            const balance = await this.getFarmerBalance(farmerAddress)
            const amountInCents = Math.floor(amount * 100)

            // Ensure we don't move more than what's pending
            const actualAmount = Math.min(amountInCents, balance.pendingBalance)

            await db.update(farmerBalances)
                .set({
                    pendingBalance: balance.pendingBalance - actualAmount,
                    availableBalance: balance.availableBalance + actualAmount,
                    updatedAt: Date.now()
                })
                .where(eq(farmerBalances.farmerAddress, farmerAddress))

            console.log(`✅ Moved ${actualAmount / 100} from pending to available for ${farmerAddress}`)
        } catch (error) {
            console.error('Error moving pending to available:', error)
            throw error
        }
    }

    /**
     * Get farmer withdrawal history
     */
    async getFarmerWithdrawalHistory(farmerAddress: string, limit: number = 50): Promise<any[]> {
        try {
            const withdrawals = await db.select()
                .from(farmerWithdrawals)
                .where(eq(farmerWithdrawals.farmerAddress, farmerAddress))
                .orderBy(desc(farmerWithdrawals.requestedAt))
                .limit(limit)

            return withdrawals.map((w: any) => ({
                ...w,
                amount: w.amount / 100 // Convert cents to dollars
            }))
        } catch (error) {
            console.error('Error getting farmer withdrawal history:', error)
            return []
        }
    }

    /**
     * Get liquidity withdrawal history
     */
    async getLiquidityWithdrawalHistory(providerAddress: string, limit: number = 50): Promise<any[]> {
        try {
            const withdrawals = await db.select()
                .from(liquidityWithdrawals)
                .where(eq(liquidityWithdrawals.providerAddress, providerAddress))
                .orderBy(desc(liquidityWithdrawals.requestedAt))
                .limit(limit)

            return withdrawals.map((w: any) => ({
                ...w,
                lpTokenAmount: w.lpTokenAmount / 100,
                usdcReturned: w.usdcReturned / 100,
                rewardsEarned: w.rewardsEarned / 100
            }))
        } catch (error) {
            console.error('Error getting liquidity withdrawal history:', error)
            return []
        }
    }

    /**
     * Get block explorer URL for transaction
     */
    private getBlockExplorerUrl(transactionId: string): string {
        const env = getEnv()
        const network = env.NETWORK === 'testnet' ? 'testnet' : 'mainnet'
        return `https://hashscan.io/${network}/transaction/${transactionId}`
    }
}

// Export singleton instance
export const withdrawalService = new WithdrawalService()
