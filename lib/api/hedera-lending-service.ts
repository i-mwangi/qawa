/**
 * Hedera Lending Service
 * Handles lending pool operations using Hedera SDK
 * Replaces LenderContract smart contract functionality
 */

import { hederaTokenService } from './hedera-token-service'
import { db } from '../db/index'
import { providedLiquidity, withdrawnLiquidity, loans, assets } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'

interface LiquidityResult {
    success: boolean
    positionId?: number
    lpTokens?: number
    transactionId?: string
    error?: string
}

interface LoanResult {
    success: boolean
    loanId?: number
    transactionId?: string
    error?: string
}

export class HederaLendingService {
    private usdcTokenId: string
    private lpTokenIds: Map<string, string> // Map of asset -> LP token ID

    constructor() {
        this.usdcTokenId = process.env.USDC_TOKEN_ID || '0.0.123456'
        this.lpTokenIds = new Map()
    }

    /**
     * Ensure asset exists in database (for foreign key constraint)
     */
    private async ensureAssetExists(assetSymbol: string, assetName: string): Promise<void> {
        try {
            // Check if asset already exists
            const existing = await db.select()
                .from(assets)
                .where(eq(assets.token, assetSymbol))
                .limit(1)

            if (existing.length === 0) {
                // Insert asset if it doesn't exist
                await db.insert(assets).values({
                    token: assetSymbol,
                    name: assetName,
                    symbol: assetSymbol,
                    timestamp: Date.now()
                })
                console.log(`✅ Asset ${assetSymbol} added to database`)
            }
        } catch (error: any) {
            // Ignore duplicate key errors
            if (!error.message?.includes('UNIQUE constraint')) {
                console.warn(`⚠️ Failed to ensure asset exists:`, error.message)
            }
        }
    }

    /**
     * Initialize LP token for a lending pool
     */
    async initializeLendingPool(
        assetName: string,
        assetSymbol: string
    ): Promise<{ success: boolean; lpTokenId?: string; error?: string }> {
        try {
            // Create LP token for this pool
            const lpTokenName = `${assetName} Liquidity Pool Token`
            const lpTokenSymbol = `LP-${assetSymbol}`

            const result = await hederaTokenService.createGroveToken(
                lpTokenName,
                lpTokenSymbol,
                0 // No initial supply
            )

            if (result.success && result.tokenId) {
                this.lpTokenIds.set(assetSymbol, result.tokenId)
                console.log(`✅ LP token created for ${assetName}: ${result.tokenId}`)
            }

            return {
                success: result.success,
                lpTokenId: result.tokenId,
                error: result.error
            }

        } catch (error: any) {
            console.error('Error initializing lending pool:', error)
            return {
                success: false,
                error: error.message || 'Failed to initialize lending pool'
            }
        }
    }

    /**
     * 11. PROVIDE LIQUIDITY
     * Replaces: LenderContract.provideLiquidity()
     */
    async provideLiquidity(
        providerAddress: string,
        assetAddress: string,
        usdcAmount: number
    ): Promise<LiquidityResult> {
        try {
            console.log(`💰 Processing liquidity provision: ${usdcAmount} USDC from ${providerAddress}`)

            // Get LP token ID from environment
            const lpTokenId = process.env.LP_USDC_TOKEN_ID
            if (!lpTokenId) {
                return {
                    success: false,
                    error: 'LP token not configured. Run create-lp-usdc-token.mjs first.'
                }
            }

            // Calculate LP tokens to mint (1:1 for simplicity)
            const lpTokenAmount = usdcAmount

            // Step 1: Check if user is associated with LP token
            console.log(`🔍 Checking LP token association for ${providerAddress}...`)
            const associationCheck = await hederaTokenService.getTokenBalance(providerAddress, lpTokenId)
            if (!associationCheck.isAssociated) {
                console.error(`❌ User not associated with LP token ${lpTokenId}`)
                return {
                    success: false,
                    error: `TOKEN_NOT_ASSOCIATED: You need to associate the LP token ${lpTokenId} with your wallet before providing liquidity. Please open HashPack, go to Settings > Tokens, and associate this token.`
                }
            }
            console.log(`✅ User is associated with LP token`)

            // Step 2: Mint LP tokens
            console.log(`🏭 Minting ${lpTokenAmount} LP-USDC tokens...`)
            const mintResult = await hederaTokenService.mintTokens(
                lpTokenId,
                lpTokenAmount
            )

            if (!mintResult.success) {
                console.error(`❌ Failed to mint LP tokens:`, mintResult.error)
                return {
                    success: false,
                    error: `Failed to mint LP tokens: ${mintResult.error}`
                }
            }
            console.log(`✅ Minted ${lpTokenAmount} LP tokens: ${mintResult.transactionId}`)

            // Step 3: Transfer LP tokens to provider
            console.log(`📥 Transferring ${lpTokenAmount} LP-USDC to ${providerAddress}...`)
            const transferResult = await hederaTokenService.transferTokens(
                lpTokenId,
                providerAddress,
                lpTokenAmount,
                `LP tokens for ${usdcAmount} USDC liquidity`
            )

            if (!transferResult.success) {
                console.error(`❌ Failed to transfer LP tokens:`, transferResult.error)
                // Rollback: Burn the minted tokens
                console.log(`🔄 Rolling back: Burning minted tokens...`)
                await hederaTokenService.burnTokens(lpTokenId, lpTokenAmount)
                return {
                    success: false,
                    error: `Failed to transfer LP tokens: ${transferResult.error}`
                }
            }

            console.log(`✅ LP tokens transferred: ${transferResult.transactionId}`)

            // Step 4: Record position in database
            console.log(`💾 Recording position in database...`)
            const positionId = Date.now()
            
            try {
                // Ensure asset exists in database first (for foreign key)
                await this.ensureAssetExists(assetAddress, `${assetAddress} Stablecoin`)
                
                await db.insert(providedLiquidity).values({
                    id: `lp_${positionId}_${providerAddress.slice(-6)}`,
                    asset: assetAddress,
                    amount: usdcAmount,
                    account: providerAddress,
                    timestamp: Date.now()
                })
                console.log(`✅ Position recorded in database`)
            } catch (dbError: any) {
                console.warn(`⚠️ Failed to record in database (non-critical):`, dbError.message)
                console.warn(`   Blockchain transactions succeeded, database record skipped`)
            }

            console.log(`✅ Liquidity provision complete!`)
            console.log(`   Mint TX: ${mintResult.transactionId}`)
            console.log(`   Transfer TX: ${transferResult.transactionId}`)
            console.log(`   Position ID: ${positionId}`)

            return {
                success: true,
                positionId,
                lpTokens: lpTokenAmount,
                transactionId: transferResult.transactionId
            }

        } catch (error: any) {
            console.error('Error providing liquidity:', error)
            return {
                success: false,
                error: error.message || 'Failed to provide liquidity'
            }
        }
    }

    /**
     * 11. WITHDRAW LIQUIDITY
     * Replaces: LenderContract.withdrawLiquidity()
     */
    async withdrawLiquidity(
        providerAddress: string,
        assetAddress: string,
        lpTokenAmount: number
    ): Promise<{
        success: boolean;
        usdcReturned?: number;
        rewardsEarned?: number;
        transactionId?: string;
        error?: string;
    }> {
        try {
            console.log(`💸 Processing liquidity withdrawal: ${lpTokenAmount} LP tokens from ${providerAddress}`)

            // Get LP token ID from environment
            const lpTokenId = process.env.LP_USDC_TOKEN_ID
            if (!lpTokenId) {
                return {
                    success: false,
                    error: 'LP token not configured'
                }
            }

            // Step 1: Calculate USDC to return (1:1 + mock interest)
            const baseUSDC = lpTokenAmount
            const mockInterest = Math.floor(baseUSDC * 0.05) // 5% mock interest
            const totalUSDC = baseUSDC + mockInterest
            console.log(`💰 Returning ${totalUSDC} USDC (${baseUSDC} principal + ${mockInterest} interest)`)

            // Step 2: Verify user transferred LP tokens to treasury
            const treasuryId = process.env.HEDERA_OPERATOR_ID
            if (!treasuryId) {
                return {
                    success: false,
                    error: 'Treasury account not configured'
                }
            }

            console.log(`🔍 Checking treasury LP token balance...`)
            const treasuryBalance = await hederaTokenService.getTokenBalance(treasuryId, lpTokenId)
            
            if (!treasuryBalance.success || (treasuryBalance.balance || 0) < lpTokenAmount) {
                console.error(`❌ Insufficient LP tokens in treasury. Has: ${treasuryBalance.balance || 0}, needs: ${lpTokenAmount}`)
                return {
                    success: false,
                    error: `Please transfer ${lpTokenAmount} LP tokens to the platform treasury (${treasuryId}) first. Current treasury balance: ${treasuryBalance.balance || 0} LP tokens.`
                }
            }
            console.log(`✅ Treasury has ${treasuryBalance.balance} LP tokens`)

            // Step 4: Burn LP tokens from treasury
            console.log(`🔥 Burning ${lpTokenAmount} LP tokens from treasury...`)
            const burnResult = await hederaTokenService.burnTokens(
                lpTokenId,
                lpTokenAmount
            )

            if (!burnResult.success) {
                console.error(`❌ Failed to burn LP tokens:`, burnResult.error)
                return {
                    success: false,
                    error: `Failed to burn LP tokens: ${burnResult.error}`
                }
            }
            console.log(`✅ LP tokens burned: ${burnResult.transactionId}`)

            // Step 4: Transfer USDC back to provider
            console.log(`📤 Transferring ${totalUSDC} USDC to ${providerAddress}...`)
            const usdcTokenId = process.env.USDC_TOKEN_ID
            if (!usdcTokenId) {
                return {
                    success: false,
                    error: 'USDC token not configured'
                }
            }

            const transferResult = await hederaTokenService.transferTokens(
                usdcTokenId,
                providerAddress,
                totalUSDC,
                `Liquidity withdrawal: ${lpTokenAmount} LP tokens`
            )

            if (!transferResult.success) {
                console.error(`❌ Failed to transfer USDC:`, transferResult.error)
                
                // Check if it's a token association error
                if (transferResult.error && transferResult.error.includes('TOKEN_NOT_ASSOCIATED')) {
                    return {
                        success: false,
                        error: `USDC_NOT_ASSOCIATED: Your LP tokens have been burned, but we cannot send your USDC back yet. Please associate USDC token (${usdcTokenId}) in your wallet, then contact support to complete your withdrawal.`
                    }
                }
                
                return {
                    success: false,
                    error: `Failed to transfer USDC: ${transferResult.error}`
                }
            }
            console.log(`✅ USDC transferred: ${transferResult.transactionId}`)

            // Step 5: Record withdrawal in database
            console.log(`💾 Recording withdrawal in database...`)
            
            try {
                // Ensure asset exists in database first (for foreign key)
                await this.ensureAssetExists(assetAddress, `${assetAddress} Stablecoin`)
                
                await db.insert(withdrawnLiquidity).values({
                    id: `lw_${Date.now()}_${providerAddress.slice(-6)}`,
                    asset: assetAddress,
                    amount: totalUSDC,
                    account: providerAddress,
                    timestamp: Date.now()
                })
                console.log(`✅ Withdrawal recorded in database`)
            } catch (dbError: any) {
                console.warn(`⚠️ Failed to record in database (non-critical):`, dbError.message)
                console.warn(`   Blockchain transactions succeeded, database record skipped`)
            }

            console.log(`✅ Liquidity withdrawal complete!`)
            console.log(`   Burn TX: ${burnResult.transactionId}`)
            console.log(`   Transfer TX: ${transferResult.transactionId}`)
            console.log(`   USDC returned: ${totalUSDC} (${baseUSDC} + ${mockInterest} interest)`)

            return {
                success: true,
                usdcReturned: totalUSDC,
                rewardsEarned: mockInterest,
                transactionId: transferResult.transactionId
            }

        } catch (error: any) {
            console.error('Error withdrawing liquidity:', error)
            return {
                success: false,
                error: error.message || 'Failed to withdraw liquidity'
            }
        }
    }

    /**
     * 12. TAKE OUT LOAN
     * Replaces: LenderContract.takeOutLoan()
     */
    async takeOutLoan(
        borrowerAddress: string,
        assetAddress: string,
        loanAmount: number,
        collateralTokenId: string,
        collateralAmount: number
    ): Promise<LoanResult> {
        try {
            console.log(`Processing loan: ${loanAmount} USDC`)

            // Check if borrower already has active loan
            const [existingLoan] = await db.select()
                .from(loans)
                .where(eq(loans.account, borrowerAddress))
                .limit(1)

            if (existingLoan) {
                return {
                    success: false,
                    error: 'Borrower already has an active loan'
                }
            }

            // Calculate loan terms
            const interestRate = 0.10 // 10%
            const repaymentAmount = Math.floor(loanAmount * (1 + interestRate))
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 180) // 180 days

            // Transfer USDC loan amount to borrower
            const transferResult = await hederaTokenService.transferTokens(
                this.usdcTokenId,
                borrowerAddress,
                loanAmount,
                `Loan disbursement: ${loanAmount} USDC`
            )

            if (!transferResult.success) {
                return {
                    success: false,
                    error: transferResult.error
                }
            }

            // Record loan in database
            // Note: Collateral should be transferred from borrower via HashPack first
            const liquidationPrice = collateralAmount * 0.75 // 75% of collateral value
            const [loan] = await db.insert(loans).values({
                id: `${borrowerAddress}-${assetAddress}-${Date.now()}`,
                account: borrowerAddress,
                collateralAsset: collateralTokenId,
                loanAmountUSDC: loanAmount,
                collateralAmount,
                liquidationPrice,
                repaymentAmount,
                timestamp: Date.now()
            }).returning()

            console.log(`✅ Loan disbursed: ${loanAmount} USDC`)

            return {
                success: true,
                loanId: loan.id,
                transactionId: transferResult.transactionId
            }

        } catch (error: any) {
            console.error('Error taking out loan:', error)
            return {
                success: false,
                error: error.message || 'Failed to take out loan'
            }
        }
    }

    /**
     * 12. REPAY LOAN
     * Replaces: LenderContract.repayLoan()
     */
    async repayLoan(
        borrowerAddress: string,
        assetAddress: string
    ): Promise<LoanResult> {
        try {
            console.log(`Processing loan repayment for ${borrowerAddress}`)

            // Get active loan
            const [loan] = await db.select()
                .from(loans)
                .where(eq(loans.account, borrowerAddress))
                .limit(1)

            if (!loan) {
                return {
                    success: false,
                    error: 'No active loan found'
                }
            }

            // Note: Borrower should send repayment amount via HashPack first
            // Here we just return the collateral

            // Return collateral to borrower
            const transferResult = await hederaTokenService.transferTokens(
                loan.collateralAsset,
                borrowerAddress,
                loan.collateralAmount,
                `Collateral return for loan ${loan.id}`
            )

            if (!transferResult.success) {
                return {
                    success: false,
                    error: transferResult.error
                }
            }

            // Record loan repayment
            await db.insert(loans).values({
                id: `${loan.id}-repaid`,
                account: borrowerAddress,
                collateralAsset: loan.collateralAsset,
                loanAmountUSDC: -loan.loanAmountUSDC, // Negative to indicate repayment
                collateralAmount: loan.collateralAmount,
                liquidationPrice: loan.liquidationPrice,
                repaymentAmount: loan.repaymentAmount,
                timestamp: Date.now()
            })

            console.log(`✅ Loan repaid, collateral returned`)

            return {
                success: true,
                loanId: loan.id,
                transactionId: transferResult.transactionId
            }

        } catch (error: any) {
            console.error('Error repaying loan:', error)
            return {
                success: false,
                error: error.message || 'Failed to repay loan'
            }
        }
    }

    /**
     * Get lending pool statistics
     */
    async getPoolStatistics(assetAddress: string): Promise<{
        success: boolean
        stats?: {
            totalLiquidity: number
            availableLiquidity: number
            totalBorrowed: number
            utilizationRate: number
            currentAPY: number
        }
        error?: string
    }> {
        try {
            // Get all liquidity positions
            const positions = await db.select()
                .from(providedLiquidity)
                .where(eq(providedLiquidity.asset, assetAddress))

            const totalLiquidity = positions.reduce((sum, p) => sum + p.amount, 0)

            // Get all loans (positive amounts are borrows)
            const activeLoans = await db.select()
                .from(loans)
                .where(eq(loans.collateralAsset, assetAddress))

            const totalBorrowed = activeLoans
                .filter(l => l.loanAmountUSDC > 0)
                .reduce((sum, l) => sum + l.loanAmountUSDC, 0)
            const availableLiquidity = totalLiquidity - totalBorrowed
            const utilizationRate = totalLiquidity > 0 ? totalBorrowed / totalLiquidity : 0
            const currentAPY = 8.5 + (utilizationRate * 10) // Base 8.5% + utilization bonus

            return {
                success: true,
                stats: {
                    totalLiquidity,
                    availableLiquidity,
                    totalBorrowed,
                    utilizationRate,
                    currentAPY
                }
            }

        } catch (error: any) {
            console.error('Error getting pool statistics:', error)
            return {
                success: false,
                error: error.message || 'Failed to get pool statistics'
            }
        }
    }
}

// Export singleton instance
export const hederaLendingService = new HederaLendingService()
