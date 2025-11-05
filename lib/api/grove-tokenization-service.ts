/**
 * Grove Tokenization Service
 * 
 * Orchestrates the complete tokenization process for coffee groves using Hedera SDK:
 * 1. Creates HTS tokens
 * 2. Mints initial token supply
 * 3. Updates database with token addresses
 */

import { hederaTokenService } from './hedera-token-service'
import { db } from '../db'
import { coffeeGroves } from '../db/schema'
import { eq } from 'drizzle-orm'

interface TokenizationParams {
    groveId: number
    groveName: string
    treeCount: number
    tokensPerTree?: number
    farmerAddress?: string // Farmer's Hedera account ID
}

interface TokenizationResult {
    success: boolean
    tokenAddress?: string
    tokenSymbol?: string
    totalTokens?: number
    managerAddress?: string
    reserveAddress?: string
    error?: string
}

export class GroveTokenizationService {
    constructor() {
        console.log('✅ Grove Tokenization Service initialized with Hedera SDK')
    }

    /**
     * Check if tokenization is available
     */
    isAvailable(): boolean {
        return true // Always available with Hedera SDK
    }

    /**
     * Tokenize a coffee grove using Hedera SDK
     */
    async tokenizeGrove(params: TokenizationParams): Promise<TokenizationResult> {
        try {
            const { groveId, groveName, treeCount, tokensPerTree = 10, farmerAddress } = params
            
            console.log(`\n🌳 Tokenizing Grove: ${groveName}`)
            console.log(`   Trees: ${treeCount}`)
            console.log(`   Tokens per tree: ${tokensPerTree}`)
            console.log(`   Farmer: ${farmerAddress || 'Platform Treasury'}`)
            
            const totalTokens = treeCount * tokensPerTree
            const symbol = `TREE-${groveName.substring(0, 6).toUpperCase()}`
            
            // Step 1: Create HTS token using Hedera SDK
            console.log(`\n📝 Step 1: Creating HTS token (${symbol})...`)
            
            const createResult = await hederaTokenService.createGroveToken(
                groveName,
                symbol,
                totalTokens
                // Don't pass farmerAddress - platform is treasury (avoids INVALID_SIGNATURE)
                // Tokens will be transferred to farmer in Step 3
            )
            
            if (!createResult.success || !createResult.tokenId) {
                return {
                    success: false,
                    error: createResult.error || 'Failed to create token'
                }
            }
            
            console.log(`✅ Token created: ${createResult.tokenId}`)
            console.log(`   Transaction: ${createResult.transactionId}`)
            
            // Step 2: Update database
            console.log(`\n💾 Step 2: Updating database...`)
            
            await db.update(coffeeGroves)
                .set({
                    tokenAddress: createResult.tokenId,
                    tokenSymbol: symbol,
                    totalTokensIssued: totalTokens,
                    isTokenized: true,
                    tokenizedAt: Date.now()
                })
                .where(eq(coffeeGroves.id, groveId))
            
            console.log(`✅ Database updated`)
            
            // Step 3: Optionally transfer some tokens to farmer immediately
            // This gives farmer ownership of a portion of tokens
            if (farmerAddress && process.env.TRANSFER_TOKENS_TO_FARMER === 'true') {
                const farmerSharePercentage = parseInt(process.env.FARMER_TOKEN_SHARE || '30')
                const farmerTokens = Math.floor(totalTokens * farmerSharePercentage / 100)
                
                console.log(`\n📤 Step 3: Transferring ${farmerSharePercentage}% of tokens to farmer...`)
                console.log(`   Farmer tokens: ${farmerTokens}`)
                console.log(`   Platform tokens: ${totalTokens - farmerTokens}`)
                
                const transferResult = await hederaTokenService.transferTokens(
                    createResult.tokenId,
                    farmerAddress,
                    farmerTokens
                )
                
                if (transferResult.success) {
                    console.log(`✅ Transferred ${farmerTokens} tokens to farmer`)
                } else {
                    console.log(`⚠️  Token transfer failed: ${transferResult.error}`)
                }
            } else {
                console.log(`\n📤 Step 3: Tokens remain in platform treasury`)
                console.log(`   Platform will transfer tokens to investors during purchases`)
                console.log(`   Farmer can view token on HashScan: https://hashscan.io/testnet/token/${createResult.tokenId}`)
            }
            
            console.log(`\n🎉 Tokenization complete!`)
            console.log(`   Token: ${createResult.tokenId}`)
            console.log(`   Symbol: ${symbol}`)
            console.log(`   Supply: ${totalTokens}`)
            console.log(`   Location: Treasury account (ready for investor purchases)`)
            
            return {
                success: true,
                tokenAddress: createResult.tokenId,
                tokenSymbol: symbol,
                totalTokens,
                managerAddress: 'N/A - Using Hedera SDK',
                reserveAddress: 'N/A - Using Hedera SDK'
            }

        } catch (error: any) {
            console.error('❌ Error tokenizing grove:', error)
            return {
                success: false,
                error: error.message || 'Failed to tokenize grove'
            }
        }
    }

    /**
     * Mint additional tokens for a grove
     */
    async mintAdditionalTokens(groveId: number, amount: number): Promise<{ success: boolean; error?: string }> {
        try {
            // Get grove from database
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            })

            if (!grove) {
                return {
                    success: false,
                    error: 'Grove not found'
                }
            }

            if (!grove.tokenAddress) {
                return {
                    success: false,
                    error: 'Grove not tokenized'
                }
            }

            console.log(`🪙 Minting ${amount} additional tokens for ${grove.groveName}`)

            const result = await hederaTokenService.mintTokens(grove.tokenAddress, amount)

            if (result.success) {
                // Update database
                await db.update(coffeeGroves)
                    .set({
                        totalTokensIssued: (grove.totalTokensIssued || 0) + amount
                    })
                    .where(eq(coffeeGroves.id, groveId))

                console.log(`✅ Minted ${amount} tokens successfully`)
            }

            return result

        } catch (error: any) {
            console.error('❌ Error minting tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint tokens'
            }
        }
    }

    /**
     * Grant investor KYC (Token Association)
     * Note: With Hedera SDK, users must associate tokens via HashPack
     */
    async grantInvestorKYC(groveId: number, investorAddress: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get grove from database
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            })

            if (!grove) {
                return {
                    success: false,
                    error: 'Grove not found'
                }
            }

            if (!grove.tokenAddress) {
                return {
                    success: false,
                    error: 'Grove not tokenized'
                }
            }

            console.log(`🔐 Token association for ${investorAddress} on ${grove.groveName}`)
            console.log(`⚠️  Note: User must associate token via HashPack`)

            // With Hedera SDK, users must associate tokens themselves via HashPack
            // This is a client-side operation, not a backend operation
            return {
                success: true,
                error: undefined
            }

        } catch (error: any) {
            console.error('❌ Error with token association:', error)
            return {
                success: false,
                error: error.message || 'Failed to process token association'
            }
        }
    }
}

// Export singleton instance
export const groveTokenizationService = new GroveTokenizationService()
