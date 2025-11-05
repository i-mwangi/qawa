import { db } from '../db'
import { harvestRecords, coffeeGroves, tokenHoldings, revenueDistributions } from '../db/schema'
import { eq, and, sql, desc } from 'drizzle-orm'
import { hederaOperationsService } from './hedera-operations-service'
import { withdrawalService } from './withdrawal-service'
import { RevenueReserveContract } from './revenue-reserve-contract'
import { getClient } from '../utils'

/**
 * Revenue Distribution Service
 * 
 * This service handles the automatic calculation and tracking of revenue distributions
 * for coffee tree token holders based on harvest reports.
 */

interface TokenHolder {
    holderAddress: string
    tokenAmount: number
    sharePercentage: number
}

interface DistributionCalculation {
    harvestId: number
    groveName: string
    totalRevenue: number
    investorShare: number
    farmerShare: number
    tokenHolders: TokenHolder[]
    distributions: {
        holderAddress: string
        tokenAmount: number
        revenueShare: number
    }[]
}

export class RevenueDistributionService {

    /**
     * Calculate revenue distribution for a specific harvest
     */
    async calculateDistribution(harvestId: number): Promise<DistributionCalculation | null> {
        try {
            // Get harvest with grove information
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(eq(harvestRecords.id, harvestId))
                .limit(1)

            if (harvestWithGrove.length === 0) {
                throw new Error(`Harvest ${harvestId} not found`)
            }

            const { harvest, grove } = harvestWithGrove[0]

            if (harvest.revenueDistributed) {
                throw new Error(`Revenue already distributed for harvest ${harvestId}`)
            }

            // Get current token holders for the grove
            const holders = await db.query.tokenHoldings.findMany({
                where: and(
                    eq(tokenHoldings.groveId, grove.id),
                    eq(tokenHoldings.isActive, true)
                )
            })

            if (holders.length === 0) {
                throw new Error(`No active token holders found for grove ${grove.groveName}`)
            }

            // Calculate total tokens in circulation
            const totalTokens = holders.reduce((sum, holder) => sum + holder.tokenAmount, 0)

            if (totalTokens === 0) {
                throw new Error(`No tokens in circulation for grove ${grove.groveName}`)
            }

            // Calculate token holder shares
            const tokenHolders: TokenHolder[] = holders.map(holder => ({
                holderAddress: holder.holderAddress,
                tokenAmount: holder.tokenAmount,
                sharePercentage: (holder.tokenAmount / totalTokens) * 100
            }))

            // Calculate individual distributions
            const distributions = tokenHolders.map(holder => {
                const revenueShare = Math.floor((harvest.investorShare * holder.tokenAmount) / totalTokens)
                return {
                    holderAddress: holder.holderAddress,
                    tokenAmount: holder.tokenAmount,
                    revenueShare
                }
            })

            return {
                harvestId: harvest.id,
                groveName: grove.groveName,
                totalRevenue: harvest.totalRevenue,
                investorShare: harvest.investorShare,
                farmerShare: harvest.farmerShare,
                tokenHolders,
                distributions
            }

        } catch (error) {
            console.error('Error calculating distribution:', error)
            throw error
        }
    }

    /**
     * Record revenue distribution in the database
     */
    async recordDistribution(
        harvestId: number,
        distributions: { holderAddress: string; tokenAmount: number; revenueShare: number }[],
        transactionHash?: string
    ): Promise<void> {
        try {
            // Insert distribution records
            const distributionRecords = distributions.map(dist => ({
                harvestId,
                holderAddress: dist.holderAddress,
                tokenAmount: dist.tokenAmount,
                revenueShare: dist.revenueShare,
                distributionDate: Date.now(),
                transactionHash: transactionHash || null
            }))

            await db.insert(revenueDistributions).values(distributionRecords)

            console.log(`Recorded ${distributions.length} revenue distributions for harvest ${harvestId}`)

        } catch (error) {
            console.error('Error recording distribution:', error)
            throw error
        }
    }

    /**
     * Get all pending harvests that need revenue distribution
     */
    async getPendingDistributions(): Promise<{
        harvestId: number
        groveName: string
        farmerAddress: string
        totalRevenue: number
        harvestDate: number
        daysSinceHarvest: number
    }[]> {
        try {
            const pendingHarvests = await db.select({
                harvestId: harvestRecords.id,
                groveName: coffeeGroves.groveName,
                farmerAddress: coffeeGroves.farmerAddress,
                totalRevenue: harvestRecords.totalRevenue,
                harvestDate: harvestRecords.harvestDate
            })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(eq(harvestRecords.revenueDistributed, false))

            const now = Date.now()
            return pendingHarvests.map(harvest => ({
                ...harvest,
                daysSinceHarvest: Math.floor((now - harvest.harvestDate) / (24 * 60 * 60 * 1000))
            }))

        } catch (error) {
            console.error('Error getting pending distributions:', error)
            throw error
        }
    }

    /**
     * Get distribution history for a token holder
     */
    async getHolderDistributionHistory(holderAddress: string): Promise<{
        harvestId: number
        groveName: string
        tokenAmount: number
        revenueShare: number
        distributionDate: number
        transactionHash: string | null
    }[]> {
        try {
            let distributions = []
            
            try {
                distributions = await db.select({
                    harvestId: revenueDistributions.harvestId,
                    groveName: coffeeGroves.groveName,
                    tokenAmount: revenueDistributions.tokenAmount,
                    revenueShare: revenueDistributions.revenueShare,
                    distributionDate: revenueDistributions.distributionDate,
                    transactionHash: revenueDistributions.transactionHash
                })
                    .from(revenueDistributions)
                    .innerJoin(harvestRecords, eq(revenueDistributions.harvestId, harvestRecords.id))
                    .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                    .where(eq(revenueDistributions.holderAddress, holderAddress))
                    .orderBy(desc(revenueDistributions.distributionDate))
            } catch (error) {
                console.warn('Failed to get distribution history, using empty array:', error)
                distributions = []
            }

            return distributions.map(distribution => ({
                harvestId: distribution.harvestId || 0,
                groveName: distribution.groveName || 'Unknown Grove',
                tokenAmount: distribution.tokenAmount || 0,
                revenueShare: distribution.revenueShare || 0,
                distributionDate: distribution.distributionDate || 0,
                transactionHash: distribution.transactionHash || null
            }))

        } catch (error) {
            console.error('Error getting holder distribution history:', error)
            return [] // Return empty array instead of throwing error
        }
    }

    /**
     * Get total earnings for a token holder
     */
    async getHolderTotalEarnings(holderAddress: string): Promise<{
        totalEarnings: number
        totalDistributions: number
        averageEarningsPerDistribution: number
        groves: {
            groveName: string
            totalEarnings: number
            distributionCount: number
        }[]
    }> {
        try {
            // Get total earnings
            let totalEarnings = 0
            let totalDistributions = 0
            
            try {
                const totalStats = await db.select({
                    totalEarnings: sql<number>`COALESCE(sum(${revenueDistributions.revenueShare}), 0)`,
                    totalDistributions: sql<number>`count(*)`
                })
                    .from(revenueDistributions)
                    .where(eq(revenueDistributions.holderAddress, holderAddress))

                const total = totalStats[0]
                totalEarnings = total?.totalEarnings || 0
                totalDistributions = total?.totalDistributions || 0
            } catch (error) {
                console.warn('Failed to get total earnings, using defaults:', error)
                // Continue with defaults
            }
            
            const averageEarningsPerDistribution = totalDistributions > 0 ? totalEarnings / totalDistributions : 0

            // Get earnings by grove
            let groveStats = []
            
            try {
                groveStats = await db.select({
                    groveName: coffeeGroves.groveName,
                    totalEarnings: sql<number>`COALESCE(sum(${revenueDistributions.revenueShare}), 0)`,
                    distributionCount: sql<number>`count(*)`
                })
                    .from(revenueDistributions)
                    .innerJoin(harvestRecords, eq(revenueDistributions.harvestId, harvestRecords.id))
                    .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                    .where(eq(revenueDistributions.holderAddress, holderAddress))
                    .groupBy(coffeeGroves.groveName)
            } catch (error) {
                console.warn('Failed to get grove stats, using empty array:', error)
                groveStats = []
            }

            return {
                totalEarnings,
                totalDistributions,
                averageEarningsPerDistribution: Math.round(averageEarningsPerDistribution * 100) / 100,
                groves: groveStats.map(grove => ({
                    groveName: grove.groveName,
                    totalEarnings: grove.totalEarnings || 0,
                    distributionCount: grove.distributionCount || 0
                }))
            }

        } catch (error) {
            console.error('Error getting holder total earnings:', error)
            throw error
        }
    }

    /**
     * Validate distribution calculation
     */
    async validateDistribution(calculation: DistributionCalculation): Promise<{
        isValid: boolean
        errors: string[]
        warnings: string[]
    }> {
        const errors: string[] = []
        const warnings: string[] = []

        try {
            // Check if harvest exists and is not already distributed
            const harvest = await db.query.harvestRecords.findFirst({
                where: eq(harvestRecords.id, calculation.harvestId)
            })

            if (!harvest) {
                errors.push(`Harvest ${calculation.harvestId} not found`)
                return { isValid: false, errors, warnings }
            }

            if (harvest.revenueDistributed) {
                errors.push(`Revenue already distributed for harvest ${calculation.harvestId}`)
            }

            // Validate revenue amounts
            if (calculation.totalRevenue !== harvest.totalRevenue) {
                errors.push(`Total revenue mismatch: expected ${harvest.totalRevenue}, got ${calculation.totalRevenue}`)
            }

            if (calculation.investorShare !== harvest.investorShare) {
                errors.push(`Investor share mismatch: expected ${harvest.investorShare}, got ${calculation.investorShare}`)
            }

            // Validate distribution amounts
            const totalDistributed = calculation.distributions.reduce((sum, dist) => sum + dist.revenueShare, 0)
            if (Math.abs(totalDistributed - calculation.investorShare) > 1) { // Allow 1 unit difference for rounding
                errors.push(`Distribution total (${totalDistributed}) does not match investor share (${calculation.investorShare})`)
            }

            // Check for duplicate holders
            const holderAddresses = calculation.distributions.map(d => d.holderAddress)
            const uniqueAddresses = new Set(holderAddresses)
            if (holderAddresses.length !== uniqueAddresses.size) {
                errors.push('Duplicate holder addresses in distribution')
            }

            // Validate token amounts
            const totalTokens = calculation.tokenHolders.reduce((sum, holder) => sum + holder.tokenAmount, 0)
            const distributionTokens = calculation.distributions.reduce((sum, dist) => sum + dist.tokenAmount, 0)
            if (totalTokens !== distributionTokens) {
                errors.push(`Token amount mismatch: holders have ${totalTokens}, distributions have ${distributionTokens}`)
            }

            // Warnings for edge cases
            if (calculation.distributions.length === 0) {
                warnings.push('No distributions calculated')
            }

            if (calculation.distributions.some(d => d.revenueShare === 0)) {
                warnings.push('Some holders will receive zero revenue')
            }

            const maxShare = Math.max(...calculation.distributions.map(d => d.revenueShare))
            const minShare = Math.min(...calculation.distributions.map(d => d.revenueShare))
            if (maxShare > minShare * 100) {
                warnings.push('Large disparity in revenue shares between holders')
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            }

        } catch (error) {
            console.error('Error validating distribution:', error)
            errors.push(`Validation error: ${error.message}`)
            return { isValid: false, errors, warnings }
        }
    }

    /**
     * Get distribution summary for reporting
     */
    async getDistributionSummary(harvestId: number): Promise<{
        harvestId: number
        groveName: string
        farmerAddress: string
        totalRevenue: number
        farmerShare: number
        investorShare: number
        totalHolders: number
        distributionDate: number | null
        isDistributed: boolean
        distributions: {
            holderAddress: string
            tokenAmount: number
            revenueShare: number
            sharePercentage: number
        }[]
    } | null> {
        try {
            // Get harvest with grove information
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(eq(harvestRecords.id, harvestId))
                .limit(1)

            if (harvestWithGrove.length === 0) {
                return null
            }

            const { harvest, grove } = harvestWithGrove[0]

            // Get distributions if they exist
            const distributions = await db.query.revenueDistributions.findMany({
                where: eq(revenueDistributions.harvestId, harvestId)
            })

            const totalTokens = distributions.reduce((sum, dist) => sum + dist.tokenAmount, 0)

            return {
                harvestId: harvest.id,
                groveName: grove.groveName,
                farmerAddress: grove.farmerAddress,
                totalRevenue: harvest.totalRevenue,
                farmerShare: harvest.farmerShare,
                investorShare: harvest.investorShare,
                totalHolders: distributions.length,
                distributionDate: distributions.length > 0 ? distributions[0].distributionDate : null,
                isDistributed: harvest.revenueDistributed,
                distributions: distributions.map(dist => ({
                    holderAddress: dist.holderAddress,
                    tokenAmount: dist.tokenAmount,
                    revenueShare: dist.revenueShare,
                    sharePercentage: totalTokens > 0 ? (dist.tokenAmount / totalTokens) * 100 : 0
                }))
            }

        } catch (error) {
            console.error('Error getting distribution summary:', error)
            throw error
        }
    }

    /**
     * Distribute revenue on-chain via Hedera smart contract
     */
    async distributeRevenueOnChain(harvestId: number): Promise<{
        success: boolean
        transactionId?: string
        error?: string
    }> {
        try {
            // Get harvest and grove info
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(eq(harvestRecords.id, harvestId))
                .limit(1)

            if (harvestWithGrove.length === 0) {
                return { success: false, error: 'Harvest not found' }
            }

            const { harvest, grove } = harvestWithGrove[0]

            if (!grove.tokenAddress) {
                return { success: false, error: 'Grove not tokenized - no token address' }
            }

            // Check if revenue reserve contract is configured
            const reserveContractAddress = process.env.REVENUE_RESERVE_CONTRACT_ID
            if (!reserveContractAddress) {
                console.warn('⚠️  REVENUE_RESERVE_CONTRACT_ID not configured - skipping on-chain distribution')
                return { success: false, error: 'Revenue reserve contract not configured' }
            }

            console.log(`\n💰 Distributing revenue on-chain for harvest ${harvestId}...`)
            console.log(`   Grove: ${grove.groveName}`)
            console.log(`   Token: ${grove.tokenAddress}`)
            console.log(`   Total Revenue: ${harvest.totalRevenue}`)
            console.log(`   Investor Share: ${harvest.investorShare}`)

            // Initialize revenue reserve contract
            const client = getClient()
            const reserveContract = new RevenueReserveContract(reserveContractAddress, client)

            // Call distributeRevenue on the smart contract
            const result = await reserveContract.distributeRevenue(
                grove.tokenAddress,
                harvest.investorShare
            )

            if (result.success) {
                console.log(`✅ Revenue distributed on-chain`)
                console.log(`   Transaction ID: ${result.transactionId}`)
                console.log(`   Distribution ID: ${result.distributionId}`)

                // Mark harvest as distributed in database
                await db.update(harvestRecords)
                    .set({
                        revenueDistributed: true,
                        transactionHash: result.transactionId
                    })
                    .where(eq(harvestRecords.id, harvestId))

                // Move farmer's share from pending to available balance
                try {
                    await withdrawalService.movePendingToAvailable(
                        grove.farmerAddress,
                        harvest.farmerShare
                    );
                    console.log(`✅ Moved farmer's share (${harvest.farmerShare}) from pending to available`);
                } catch (balanceError) {
                    console.error('⚠️  Failed to update farmer balance:', balanceError);
                    // Don't fail the distribution if balance update fails
                }

                return {
                    success: true,
                    transactionId: result.transactionId
                }
            } else {
                console.error(`❌ On-chain distribution failed: ${result.error}`)
                return {
                    success: false,
                    error: result.error
                }
            }

        } catch (error: any) {
            console.error('Error distributing revenue on-chain:', error)
            return {
                success: false,
                error: error.message || 'Unknown error'
            }
        }
    }
}

// Export singleton instance
export const revenueDistributionService = new RevenueDistributionService()