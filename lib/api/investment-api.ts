/**
 * Investment API Endpoints
 * Handles primary market token purchases and portfolio tracking
 */

import { IncomingMessage, ServerResponse } from 'http'
import { db } from '../db'
import { tokenHoldings, coffeeGroves } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { transactionRecorder } from './transaction-recording-service'

// Utility functions for response handling
function sendResponse(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-bypass'
    })
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message })
}

export class InvestmentAPI {
    /**
     * Handle primary market token purchase
     * POST /api/investment/purchase-tokens
     */
    async purchaseTokens(req: IncomingMessage, res: ServerResponse) {
        try {
            const { groveId, tokenAmount, investorAddress } = (req as any).body || {}
            
            console.log('[InvestmentAPI] Purchase request received:', { groveId, tokenAmount, investorAddress });

            // Validate required fields
            if (!groveId || !tokenAmount || !investorAddress) {
                console.error('[InvestmentAPI] Missing required parameters:', { groveId, tokenAmount, investorAddress });
                sendError(res, 400, 'Missing required parameters: groveId, tokenAmount, investorAddress')
                return
            }

            // Validate token amount is positive
            if (tokenAmount <= 0) {
                sendError(res, 400, 'Token amount must be positive')
                return
            }

            // Convert groveId to integer if it's a string
            const groveIdInt = typeof groveId === 'string' ? parseInt(groveId, 10) : groveId

            // Query grove to verify it exists
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveIdInt)
            })

            if (!grove) {
                sendError(res, 404, 'Grove not found')
                return
            }

            // Calculate available tokens
            const totalTokens = grove.totalTokensIssued || (grove.treeCount * (grove.tokensPerTree || 1))

            // Get total tokens already sold
            const soldTokensResult = await db
                .select({ total: sql<number>`COALESCE(SUM(${tokenHoldings.tokenAmount}), 0)` })
                .from(tokenHoldings)
                .where(and(
                    eq(tokenHoldings.groveId, groveIdInt),
                    eq(tokenHoldings.isActive, true)
                ))

            const soldTokens = Number(soldTokensResult[0]?.total || 0)
            const availableTokens = totalTokens - soldTokens

            // Validate sufficient tokens available
            if (tokenAmount > availableTokens) {
                sendError(res, 400, `Insufficient tokens available. Available: ${availableTokens}, Requested: ${tokenAmount}`)
                return
            }

            // Calculate purchase price (using a base price of $25 per token for now)
            const pricePerToken = 2500 // $25.00 in cents
            const totalCost = tokenAmount * pricePerToken

            // Record the purchase in tokenHoldings table
            const purchaseDate = Date.now()
            console.log('[InvestmentAPI] Inserting holding:', {
                holderAddress: investorAddress,
                groveId: groveIdInt,
                tokenAmount,
                purchasePrice: pricePerToken,
                purchaseDate
            });
            
            const result = await db.insert(tokenHoldings).values({
                holderAddress: investorAddress,
                groveId: groveIdInt,
                tokenAmount: tokenAmount,
                purchasePrice: pricePerToken,
                purchaseDate: purchaseDate,
                isActive: true
            }).returning()

            const holding = result[0]
            console.log('[InvestmentAPI] Holding created:', holding.id);

            // Record transaction in history
            await transactionRecorder.recordPurchase({
                buyerAddress: investorAddress,
                groveId: groveId.toString(),
                tokenAmount: tokenAmount,
                usdcAmount: totalCost,
                transactionHash: `0x${Date.now().toString(16)}`
            })

            // Return success response
            sendResponse(res, 200, {
                success: true,
                data: {
                    holdingId: holding.id,
                    groveId: grove.id,
                    groveName: grove.groveName,
                    tokenAmount: tokenAmount,
                    pricePerToken: pricePerToken / 100, // Convert cents to dollars
                    totalCost: totalCost / 100, // Convert cents to dollars
                    purchaseDate: purchaseDate
                },
                message: 'Tokens purchased successfully'
            })
            
            console.log('[InvestmentAPI] Purchase successful!');

        } catch (error) {
            console.error('Error purchasing tokens:', error)
            sendError(res, 500, 'Failed to purchase tokens')
        }
    }

    /**
     * Get investor portfolio
     * GET /api/investment/portfolio?investorAddress={address}
     */
    async getPortfolio(req: IncomingMessage, res: ServerResponse) {
        try {
            const { investorAddress } = (req as any).query || {}

            // Validate investor address is provided
            if (!investorAddress || investorAddress === 'undefined') {
                // Return empty portfolio instead of error for better UX
                sendResponse(res, 200, {
                    success: true,
                    portfolio: {
                        holdings: [],
                        totalInvestment: 0,
                        totalHoldings: 0
                    }
                })
                return
            }

            // Query token holdings with grove details
            const holdings = await db
                .select({
                    holdingId: tokenHoldings.id,
                    groveId: coffeeGroves.id,
                    groveName: coffeeGroves.groveName,
                    tokenAmount: tokenHoldings.tokenAmount,
                    purchasePrice: tokenHoldings.purchasePrice,
                    purchaseDate: tokenHoldings.purchaseDate,
                    location: coffeeGroves.location,
                    coffeeVariety: coffeeGroves.coffeeVariety,
                    currentHealthScore: coffeeGroves.currentHealthScore,
                    treeCount: coffeeGroves.treeCount
                })
                .from(tokenHoldings)
                .innerJoin(coffeeGroves, eq(tokenHoldings.groveId, coffeeGroves.id))
                .where(and(
                    eq(tokenHoldings.holderAddress, investorAddress),
                    eq(tokenHoldings.isActive, true)
                ))
                .orderBy(sql`${tokenHoldings.purchaseDate} DESC`)

            // Calculate totals
            const totalInvestment = holdings.reduce((sum, holding) => {
                return sum + (holding.tokenAmount * holding.purchasePrice)
            }, 0)

            const totalHoldings = holdings.reduce((sum, holding) => {
                return sum + holding.tokenAmount
            }, 0)

            // Calculate current value (for now, same as investment - can be enhanced with market prices)
            const currentValue = totalInvestment

            // Calculate returns
            const totalReturns = currentValue - totalInvestment
            const roi = totalInvestment > 0 ? (totalReturns / totalInvestment) * 100 : 0

            // Format response
            const formattedHoldings = holdings.map(holding => ({
                holdingId: holding.holdingId,
                groveId: holding.groveId,
                groveName: holding.groveName,
                tokenAmount: holding.tokenAmount,
                purchasePrice: holding.purchasePrice / 100, // Convert cents to dollars
                purchaseDate: holding.purchaseDate,
                location: holding.location,
                coffeeVariety: holding.coffeeVariety,
                currentHealthScore: holding.currentHealthScore || 0,
                treeCount: holding.treeCount
            }))

            // Return portfolio data
            sendResponse(res, 200, {
                success: true,
                portfolio: {
                    holdings: formattedHoldings,
                    totalInvestment: totalInvestment / 100, // Convert cents to dollars
                    totalHoldings: totalHoldings,
                    currentValue: currentValue / 100, // Convert cents to dollars
                    totalReturns: totalReturns / 100, // Convert cents to dollars
                    roi: roi
                }
            })

        } catch (error) {
            console.error('Error fetching portfolio:', error)
            sendError(res, 500, 'Failed to fetch portfolio')
        }
    }
}
