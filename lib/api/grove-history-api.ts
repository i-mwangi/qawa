/**
 * Grove History API
 * Provides harvest history and performance data for groves
 * Used by investors for due diligence and earnings tracking
 */

import { IncomingMessage, ServerResponse } from 'http'
import { db } from '../db'
import { harvestRecords, coffeeGroves, investorTokenHoldings, revenueDistributions } from '../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

interface GroveHistoryResponse {
    grove: {
        id: number
        name: string
        totalTokens: number
        availableTokens: number
        farmerAddress: string
    }
    harvests: {
        id: number
        harvestDate: number
        yieldKg: number
        qualityGrade: number
        salePricePerKg: number
        totalRevenue: number
        farmerShare: number
        investorShare: number
        distributed: boolean
    }[]
    stats: {
        totalHarvests: number
        totalRevenue: number
        averageQuality: number
        averageYield: number
        lastHarvestDate: number | null
    }
}

interface InvestorEarningsResponse {
    investor: {
        address: string
        tokenAmount: number
        purchaseDate: number
        ownershipPercentage: number
    }
    harvests: {
        id: number
        harvestDate: number
        totalRevenue: number
        investorShare: number
        eligible: boolean
        yourEarnings: number
        reason: string
        status: string
    }[]
    summary: {
        totalEarnings: number
        eligibleHarvests: number
        ineligibleHarvests: number
        availableToClaim: number
    }
}

function sendJSON(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end(JSON.stringify(data))
}

export class GroveHistoryAPI {
    
    /**
     * Get complete harvest history for a grove (public)
     * GET /api/groves/:groveId/history
     */
    async getGroveHistory(req: IncomingMessage, res: ServerResponse, groveId: number) {
        try {
            console.log(`[Grove History API] Fetching history for grove ${groveId}`);
            
            // Get grove info
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            })

            console.log(`[Grove History API] Grove found:`, grove ? 'Yes' : 'No');

            if (!grove) {
                console.log(`[Grove History API] Grove ${groveId} not found`);
                sendJSON(res, 404, { success: false, error: 'Grove not found' })
                return
            }

            // Get all harvests for this grove
            const harvests = await db.query.harvestRecords.findMany({
                where: eq(harvestRecords.groveId, groveId),
                orderBy: [desc(harvestRecords.harvestDate)]
            })

            // Calculate stats
            const stats = {
                totalHarvests: harvests.length,
                totalRevenue: harvests.reduce((sum, h) => sum + h.totalRevenue, 0),
                averageQuality: harvests.length > 0 
                    ? harvests.reduce((sum, h) => sum + h.qualityGrade, 0) / harvests.length 
                    : 0,
                averageYield: harvests.length > 0
                    ? harvests.reduce((sum, h) => sum + h.yieldKg, 0) / harvests.length
                    : 0,
                lastHarvestDate: harvests.length > 0 ? harvests[0].harvestDate : null
            }

            const response: GroveHistoryResponse = {
                grove: {
                    id: grove.id,
                    name: grove.groveName,
                    totalTokens: grove.totalTokensIssued || 0,
                    availableTokens: grove.totalTokensIssued || 0, // TODO: Calculate actual available
                    farmerAddress: grove.farmerAddress
                },
                harvests: harvests.map(h => ({
                    id: h.id,
                    harvestDate: h.harvestDate,
                    yieldKg: h.yieldKg,
                    qualityGrade: h.qualityGrade,
                    salePricePerKg: h.salePricePerKg,
                    totalRevenue: h.totalRevenue,
                    farmerShare: h.farmerShare,
                    investorShare: h.investorShare,
                    distributed: h.revenueDistributed
                })),
                stats
            }

            console.log(`[Grove History API] Sending response with ${harvests.length} harvests`);
            console.log(`[Grove History API] Response structure:`, JSON.stringify({ success: true, data: response }, null, 2));
            
            sendJSON(res, 200, { success: true, data: response })

        } catch (error: any) {
            console.error('Error getting grove history:', error)
            sendJSON(res, 500, { success: false, error: error.message })
        }
    }

    /**
     * Get investor-specific earnings with eligibility
     * GET /api/investor/:address/earnings/:groveId
     */
    async getInvestorEarnings(
        req: IncomingMessage, 
        res: ServerResponse, 
        investorAddress: string,
        groveId: number
    ) {
        try {
            // Get investor's token holding
            const holding = await db.query.investorTokenHoldings.findFirst({
                where: and(
                    eq(investorTokenHoldings.investorAddress, investorAddress),
                    eq(investorTokenHoldings.groveId, groveId),
                    eq(investorTokenHoldings.isActive, true)
                )
            })

            if (!holding) {
                sendJSON(res, 404, { 
                    success: false, 
                    error: 'No token holdings found for this investor and grove' 
                })
                return
            }

            // Get grove info
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            })

            if (!grove) {
                sendJSON(res, 404, { success: false, error: 'Grove not found' })
                return
            }

            const totalTokens = grove.totalTokensIssued || 1
            const ownershipPercentage = (holding.tokenAmount / totalTokens) * 100

            // Get all harvests
            const harvests = await db.query.harvestRecords.findMany({
                where: eq(harvestRecords.groveId, groveId),
                orderBy: [desc(harvestRecords.harvestDate)]
            })

            // Calculate earnings for each harvest
            const harvestsWithEarnings = harvests.map(harvest => {
                const eligible = harvest.harvestDate >= holding.purchaseDate
                const yourEarnings = eligible 
                    ? Math.floor((harvest.investorShare * holding.tokenAmount) / totalTokens)
                    : 0

                return {
                    id: harvest.id,
                    harvestDate: harvest.harvestDate,
                    totalRevenue: harvest.totalRevenue,
                    investorShare: harvest.investorShare,
                    eligible,
                    yourEarnings,
                    reason: eligible
                        ? 'You owned tokens during this harvest'
                        : 'You purchased tokens after this harvest',
                    status: harvest.revenueDistributed ? 'distributed' : 'pending'
                }
            })

            // Calculate summary
            const eligibleHarvests = harvestsWithEarnings.filter(h => h.eligible)
            const ineligibleHarvests = harvestsWithEarnings.filter(h => !h.eligible)
            const totalEarnings = eligibleHarvests.reduce((sum, h) => sum + h.yourEarnings, 0)

            // Get unclaimed earnings
            const unclaimedEarnings = await db.query.investorEarnings.findMany({
                where: and(
                    eq(investorTokenHoldings.investorAddress, investorAddress),
                    eq(investorTokenHoldings.groveId, groveId)
                )
            })

            const availableToClaim = unclaimedEarnings
                .filter(e => e.status === 'unclaimed')
                .reduce((sum, e) => sum + e.earningAmount, 0)

            const response: InvestorEarningsResponse = {
                investor: {
                    address: investorAddress,
                    tokenAmount: holding.tokenAmount,
                    purchaseDate: holding.purchaseDate,
                    ownershipPercentage
                },
                harvests: harvestsWithEarnings,
                summary: {
                    totalEarnings,
                    eligibleHarvests: eligibleHarvests.length,
                    ineligibleHarvests: ineligibleHarvests.length,
                    availableToClaim
                }
            }

            sendJSON(res, 200, { success: true, data: response })

        } catch (error: any) {
            console.error('Error getting investor earnings:', error)
            sendJSON(res, 500, { success: false, error: error.message })
        }
    }
}

export const groveHistoryAPI = new GroveHistoryAPI()
