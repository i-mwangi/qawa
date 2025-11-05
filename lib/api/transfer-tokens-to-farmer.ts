/**
 * Transfer Tokens to Farmer
 * 
 * Utility to transfer unsold tokens from platform treasury to farmer
 * Use this after initial token sales are complete
 */

import { db } from '../db'
import { coffeeGroves } from '../db/schema'
import { eq } from 'drizzle-orm'
import { hederaTokenService } from './hedera-token-service'

interface TransferResult {
    success: boolean
    groveId: number
    groveName: string
    tokenId: string
    tokensTransferred: number
    error?: string
}

/**
 * Transfer unsold tokens to farmer
 * 
 * @param groveId - Database ID of the grove
 * @param percentage - Percentage of total supply to transfer (default: 30%)
 */
export async function transferTokensToFarmer(
    groveId: number,
    percentage: number = 30
): Promise<TransferResult> {
    try {
        // Get grove from database
        const grove = await db.query.coffeeGroves.findFirst({
            where: eq(coffeeGroves.id, groveId)
        })

        if (!grove) {
            return {
                success: false,
                groveId,
                groveName: '',
                tokenId: '',
                tokensTransferred: 0,
                error: 'Grove not found'
            }
        }

        if (!grove.isTokenized || !grove.tokenAddress) {
            return {
                success: false,
                groveId,
                groveName: grove.groveName,
                tokenId: '',
                tokensTransferred: 0,
                error: 'Grove not tokenized'
            }
        }

        // Calculate tokens to transfer
        const totalTokens = grove.totalTokensIssued || 0
        const tokensToTransfer = Math.floor(totalTokens * percentage / 100)

        console.log(`\n📤 Transferring tokens to farmer...`)
        console.log(`   Grove: ${grove.groveName}`)
        console.log(`   Token: ${grove.tokenAddress}`)
        console.log(`   Farmer: ${grove.farmerAddress}`)
        console.log(`   Total Supply: ${totalTokens}`)
        console.log(`   Transfer Amount: ${tokensToTransfer} (${percentage}%)`)

        // Transfer tokens
        const result = await hederaTokenService.transferTokens(
            grove.tokenAddress,
            grove.farmerAddress,
            tokensToTransfer
        )

        if (result.success) {
            console.log(`✅ Successfully transferred ${tokensToTransfer} tokens to farmer`)
            
            return {
                success: true,
                groveId: grove.id,
                groveName: grove.groveName,
                tokenId: grove.tokenAddress,
                tokensTransferred: tokensToTransfer
            }
        } else {
            console.error(`❌ Transfer failed: ${result.error}`)
            
            return {
                success: false,
                groveId: grove.id,
                groveName: grove.groveName,
                tokenId: grove.tokenAddress,
                tokensTransferred: 0,
                error: result.error
            }
        }

    } catch (error: any) {
        console.error('Error transferring tokens to farmer:', error)
        return {
            success: false,
            groveId,
            groveName: '',
            tokenId: '',
            tokensTransferred: 0,
            error: error.message || 'Unknown error'
        }
    }
}

/**
 * Transfer tokens to multiple farmers (batch operation)
 */
export async function batchTransferToFarmers(
    groveIds: number[],
    percentage: number = 30
): Promise<TransferResult[]> {
    const results: TransferResult[] = []

    for (const groveId of groveIds) {
        const result = await transferTokensToFarmer(groveId, percentage)
        results.push(result)
        
        // Small delay between transfers to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return results
}

/**
 * Get groves that need token transfer
 */
export async function getGrovesNeedingTransfer(): Promise<{
    groveId: number
    groveName: string
    tokenAddress: string
    farmerAddress: string
    totalTokens: number
}[]> {
    const groves = await db.query.coffeeGroves.findMany({
        where: eq(coffeeGroves.isTokenized, true)
    })

    return groves.map(grove => ({
        groveId: grove.id,
        groveName: grove.groveName,
        tokenAddress: grove.tokenAddress || '',
        farmerAddress: grove.farmerAddress,
        totalTokens: grove.totalTokensIssued || 0
    }))
}
