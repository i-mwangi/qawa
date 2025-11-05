/**
 * Hedera Operations Service
 * Handles all business logic for grove operations, replacing smart contracts
 */

import { hederaTokenService } from './hedera-token-service'
import { db } from '../db/index'
import { coffeeGroves, harvestRecords, farmerBalances } from '../db/schema/index'
import { investorTokenHoldings } from '../db/schema/earnings-distribution'
import { eq, and } from 'drizzle-orm'

interface GroveTokenizationResult {
    success: boolean
    groveId?: number
    tokenId?: string
    transactionId?: string
    error?: string
}

interface WithdrawalResult {
    success: boolean
    amount?: number
    transactionId?: string
    error?: string
}

interface EarningsClaimResult {
    success: boolean
    amount?: number
    transactionId?: string
    error?: string
}

export class HederaOperationsService {

    /**
     * 1. GROVE REGISTRATION & TOKENIZATION
     * Replaces: CoffeeTreeIssuer.registerCoffeeGrove() + tokenizeCoffeeGrove()
     */
    async registerAndTokenizeGrove(
        farmerAddress: string,
        groveName: string,
        location: string,
        treeCount: number,
        coffeeVariety: string,
        tokensPerTree: number
    ): Promise<GroveTokenizationResult> {
        try {
            console.log(`Registering grove: ${groveName}`)

            // 1. Create token using Hedera SDK
            const symbol = `TREE-${groveName.substring(0, 6).toUpperCase()}`
            const initialSupply = treeCount * tokensPerTree

            const tokenResult = await hederaTokenService.createGroveToken(
                groveName,
                symbol,
                initialSupply
            )

            if (!tokenResult.success || !tokenResult.tokenId) {
                return {
                    success: false,
                    error: tokenResult.error || 'Token creation failed'
                }
            }

            // 2. Store grove in database
            const [grove] = await db.insert(coffeeGroves).values({
                groveName: groveName,
                farmerAddress,
                location,
                treeCount,
                coffeeVariety,
                tokenAddress: tokenResult.tokenId,
                totalTokensIssued: initialSupply,
                tokensPerTree,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }).returning()

            console.log(`✅ Grove registered with ID: ${grove.id}`)

            return {
                success: true,
                groveId: grove.id,
                tokenId: tokenResult.tokenId,
                transactionId: tokenResult.transactionId
            }

        } catch (error: any) {
            console.error('Error registering grove:', error)
            return {
                success: false,
                error: error.message || 'Failed to register grove'
            }
        }
    }

    /**
     * 2. MINT ADDITIONAL TOKENS
     * Replaces: CoffeeTreeManager.mint()
     */
    async mintGroveTokens(
        groveId: number,
        amount: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Get grove from database
            const [grove] = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.id, groveId))
                .limit(1)

            if (!grove || !grove.tokenAddress) {
                return { success: false, error: 'Grove not found or not tokenized' }
            }

            // Mint tokens using Hedera SDK
            const result = await hederaTokenService.mintTokens(
                grove.tokenAddress,
                amount
            )

            if (result.success) {
                // Update total tokens in database
                await db.update(coffeeGroves)
                    .set({ totalTokensIssued: result.newTotalSupply })
                    .where(eq(coffeeGroves.id, groveId))
            }

            return result

        } catch (error: any) {
            console.error('Error minting tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint tokens'
            }
        }
    }

    /**
     * 3. BURN TOKENS
     * Replaces: CoffeeTreeManager.burn()
     */
    async burnGroveTokens(
        groveId: number,
        amount: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Get grove from database
            const [grove] = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.id, groveId))
                .limit(1)

            if (!grove || !grove.tokenAddress) {
                return { success: false, error: 'Grove not found or not tokenized' }
            }

            // Burn tokens using Hedera SDK
            const result = await hederaTokenService.burnTokens(
                grove.tokenAddress,
                amount
            )

            if (result.success) {
                // Update total tokens in database
                await db.update(coffeeGroves)
                    .set({ totalTokensIssued: result.newTotalSupply })
                    .where(eq(coffeeGroves.id, groveId))
            }

            return result

        } catch (error: any) {
            console.error('Error burning tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to burn tokens'
            }
        }
    }

    /**
     * 4. HARVEST REPORTING
     * Replaces: CoffeeTreeIssuer.reportHarvest()
     * Note: This is stored in database, not on-chain
     */
    async reportHarvest(
        groveId: number,
        yieldKg: number,
        qualityGrade: number,
        pricePerKg: number
    ): Promise<{ success: boolean; harvestId?: number; error?: string }> {
        try {
            const totalRevenue = yieldKg * pricePerKg
            const farmerShare = Math.floor(totalRevenue * 0.3) // 30% to farmer
            const investorShare = totalRevenue - farmerShare // 70% to investors

            const [harvest] = await db.insert(harvestRecords).values({
                groveId,
                harvestDate: Date.now(),
                yieldKg,
                qualityGrade,
                salePricePerKg: pricePerKg,
                totalRevenue,
                farmerShare,
                investorShare,
                revenueDistributed: false,
                createdAt: Date.now()
            }).returning()

            console.log(`✅ Harvest reported with ID: ${harvest.id}`)

            return {
                success: true,
                harvestId: harvest.id
            }

        } catch (error: any) {
            console.error('Error reporting harvest:', error)
            return {
                success: false,
                error: error.message || 'Failed to report harvest'
            }
        }
    }

    /**
     * 5. REVENUE DISTRIBUTION TO INVESTORS
     * Replaces: CoffeeTreeIssuer.distributeRevenue()
     */
    async distributeRevenueToInvestors(
        harvestId: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Get harvest details
            const [harvest] = await db.select()
                .from(harvestRecords)
                .where(eq(harvestRecords.id, harvestId))
                .limit(1)

            if (!harvest) {
                return { success: false, error: 'Harvest not found' }
            }

            if (harvest.revenueDistributed) {
                return { success: false, error: 'Revenue already distributed' }
            }

            // Get grove details
            const [grove] = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.id, harvest.groveId))
                .limit(1)

            if (!grove || !grove.tokenAddress) {
                return { success: false, error: 'Grove not found or not tokenized' }
            }

            // Get all investors for this grove
            const groveInvestors = await db.select()
                .from(investorTokenHoldings)
                .where(eq(investorTokenHoldings.groveId, harvest.groveId))

            if (groveInvestors.length === 0) {
                return { success: false, error: 'No investors found for this grove' }
            }

            // Calculate distribution based on token holdings
            const totalTokens = grove.totalTokensIssued || 0
            const recipients = groveInvestors.map(investor => {
                const share = (investor.tokenAmount / totalTokens) * harvest.investorShare
                return {
                    accountId: investor.investorAddress,
                    amount: Math.floor(share)
                }
            }).filter(r => r.amount > 0)

            // Use USDC token for revenue distribution (you'll need USDC token ID)
            const usdcTokenId = process.env.USDC_TOKEN_ID || '0.0.123456'

            // Batch transfer USDC to all investors
            const result = await hederaTokenService.batchTransferTokens(
                usdcTokenId,
                recipients,
                `Revenue distribution for harvest ${harvestId}`
            )

            if (result.success) {
                // Mark harvest as distributed
                await db.update(harvestRecords)
                    .set({ revenueDistributed: true })
                    .where(eq(harvestRecords.id, harvestId))

                console.log(`✅ Revenue distributed to ${recipients.length} investors`)
            }

            return result

        } catch (error: any) {
            console.error('Error distributing revenue:', error)
            return {
                success: false,
                error: error.message || 'Failed to distribute revenue'
            }
        }
    }

    /**
     * 6. FARMER WITHDRAWAL
     * Replaces: CoffeeRevenueReserve.withdrawFarmerShare()
     */
    async processFarmerWithdrawal(
        farmerAddress: string,
        amount: number
    ): Promise<WithdrawalResult> {
        try {
            // Get farmer balance from database
            const [balance] = await db.select()
                .from(farmerBalances)
                .where(eq(farmerBalances.farmerAddress, farmerAddress))
                .limit(1)

            if (!balance || balance.availableBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient balance'
                }
            }

            // Transfer USDC to farmer
            const usdcTokenId = process.env.USDC_TOKEN_ID || '0.0.123456'
            
            const result = await hederaTokenService.transferTokens(
                usdcTokenId,
                farmerAddress,
                amount,
                'Farmer revenue withdrawal'
            )

            if (result.success) {
                // Update farmer balance in database
                await db.update(farmerBalances)
                    .set({
                        availableBalance: balance.availableBalance - amount,
                        totalWithdrawn: balance.totalWithdrawn + amount,
                        lastWithdrawalDate: new Date()
                    })
                    .where(eq(farmerBalances.farmerAddress, farmerAddress))

                console.log(`✅ Farmer withdrawal processed: ${amount}`)
            }

            return {
                success: result.success,
                amount,
                transactionId: result.transactionId,
                error: result.error
            }

        } catch (error: any) {
            console.error('Error processing farmer withdrawal:', error)
            return {
                success: false,
                error: error.message || 'Failed to process withdrawal'
            }
        }
    }

    /**
     * 7. INVESTOR EARNINGS CLAIM
     * Replaces: CoffeeRevenueReserve.claimRevenue()
     */
    async processInvestorClaim(
        investorAddress: string,
        groveId: number
    ): Promise<EarningsClaimResult> {
        try {
            // Note: This needs to be updated to use investorEarnings table
            // For now, returning error as this needs proper earnings tracking implementation
            return {
                success: false,
                error: 'Investor earnings claim needs to be implemented with investorEarnings table'
            }

        } catch (error: any) {
            console.error('Error processing investor claim:', error)
            return {
                success: false,
                error: error.message || 'Failed to process claim'
            }
        }
    }

    /**
     * 8. TOKEN PURCHASE (Investor buys grove tokens)
     * Replaces: CoffeeTreeIssuer.purchaseTreeTokens()
     */
    async purchaseGroveTokens(
        investorAddress: string,
        groveId: number,
        tokenAmount: number,
        usdcAmount: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Get grove
            const [grove] = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.id, groveId))
                .limit(1)

            if (!grove || !grove.tokenAddress) {
                return { success: false, error: 'Grove not found or not tokenized' }
            }

            // Transfer grove tokens to investor
            const result = await hederaTokenService.transferTokens(
                grove.tokenAddress,
                investorAddress,
                tokenAmount,
                `Purchase ${tokenAmount} tokens for grove ${groveId}`
            )

            if (result.success) {
                // Update or create investor token holding record
                const [existingHolding] = await db.select()
                    .from(investorTokenHoldings)
                    .where(
                        and(
                            eq(investorTokenHoldings.investorAddress, investorAddress),
                            eq(investorTokenHoldings.groveId, groveId),
                            eq(investorTokenHoldings.isActive, true)
                        )
                    )
                    .limit(1)

                if (existingHolding) {
                    await db.update(investorTokenHoldings)
                        .set({
                            tokenAmount: existingHolding.tokenAmount + tokenAmount,
                            updatedAt: Date.now()
                        })
                        .where(eq(investorTokenHoldings.id, existingHolding.id))
                } else {
                    await db.insert(investorTokenHoldings).values({
                        investorAddress,
                        groveId,
                        tokenAmount,
                        acquisitionType: 'primary',
                        purchasePrice: usdcAmount,
                        purchaseDate: Date.now(),
                        isActive: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    })
                }

                console.log(`✅ Token purchase completed: ${tokenAmount} tokens`)
            }

            return result

        } catch (error: any) {
            console.error('Error purchasing tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to purchase tokens'
            }
        }
    }
}

// Export singleton instance
export const hederaOperationsService = new HederaOperationsService()
