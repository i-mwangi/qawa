/**
 * Hedera API Router
 * Replaces smart contract endpoints with Hedera SDK operations
 */

import { IncomingMessage, ServerResponse } from 'http'
import { hederaTokenService } from './hedera-token-service'
import { hederaOperationsService } from './hedera-operations-service'
import { hederaLendingService } from './hedera-lending-service'

// Utility functions
function sendResponse(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message })
}

export class HederaAPIRouter {

    /**
     * GROVE OPERATIONS
     */

    // POST /api/groves/register
    async registerGrove(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { farmerAddress, groveName, location, treeCount, coffeeVariety, tokensPerTree } = body

            if (!farmerAddress || !groveName || !location || !treeCount || !coffeeVariety || !tokensPerTree) {
                sendError(res, 400, 'Missing required fields')
                return
            }

            const result = await hederaOperationsService.registerAndTokenizeGrove(
                farmerAddress,
                groveName,
                location,
                treeCount,
                coffeeVariety,
                tokensPerTree
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        groveId: result.groveId,
                        tokenId: result.tokenId,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to register grove')
            }

        } catch (error: any) {
            console.error('Error registering grove:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/groves/:groveId/mint
    async mintTokens(req: IncomingMessage, res: ServerResponse, groveId: number) {
        try {
            const body = (req as any).body
            const { amount } = body

            if (!amount || amount <= 0) {
                sendError(res, 400, 'Invalid amount')
                return
            }

            const result = await hederaOperationsService.mintGroveTokens(groveId, amount)

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        transactionId: result.transactionId,
                        newTotalSupply: result.newTotalSupply
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to mint tokens')
            }

        } catch (error: any) {
            console.error('Error minting tokens:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/groves/:groveId/burn
    async burnTokens(req: IncomingMessage, res: ServerResponse, groveId: number) {
        try {
            const body = (req as any).body
            const { amount } = body

            if (!amount || amount <= 0) {
                sendError(res, 400, 'Invalid amount')
                return
            }

            const result = await hederaOperationsService.burnGroveTokens(groveId, amount)

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        transactionId: result.transactionId,
                        newTotalSupply: result.newTotalSupply
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to burn tokens')
            }

        } catch (error: any) {
            console.error('Error burning tokens:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/groves/:groveId/harvest
    async reportHarvest(req: IncomingMessage, res: ServerResponse, groveId: number) {
        try {
            const body = (req as any).body
            const { yieldKg, qualityGrade, pricePerKg } = body

            if (!yieldKg || !qualityGrade || !pricePerKg) {
                sendError(res, 400, 'Missing required fields')
                return
            }

            const result = await hederaOperationsService.reportHarvest(
                groveId,
                yieldKg,
                qualityGrade,
                pricePerKg
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        harvestId: result.harvestId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to report harvest')
            }

        } catch (error: any) {
            console.error('Error reporting harvest:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/harvests/:harvestId/distribute
    async distributeRevenue(req: IncomingMessage, res: ServerResponse, harvestId: number) {
        try {
            const result = await hederaOperationsService.distributeRevenueToInvestors(harvestId)

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to distribute revenue')
            }

        } catch (error: any) {
            console.error('Error distributing revenue:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    /**
     * FARMER OPERATIONS
     */

    // POST /api/farmers/withdraw
    async farmerWithdraw(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { farmerAddress, amount } = body

            if (!farmerAddress || !amount || amount <= 0) {
                sendError(res, 400, 'Invalid parameters')
                return
            }

            const result = await hederaOperationsService.processFarmerWithdrawal(
                farmerAddress,
                amount
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        amount: result.amount,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to process withdrawal')
            }

        } catch (error: any) {
            console.error('Error processing farmer withdrawal:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    /**
     * INVESTOR OPERATIONS
     */

    // POST /api/investors/claim
    async investorClaim(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { investorAddress, groveId } = body

            if (!investorAddress || !groveId) {
                sendError(res, 400, 'Invalid parameters')
                return
            }

            const result = await hederaOperationsService.processInvestorClaim(
                investorAddress,
                groveId
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        amount: result.amount,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to process claim')
            }

        } catch (error: any) {
            console.error('Error processing investor claim:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/investors/purchase
    async purchaseTokens(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { investorAddress, groveId, tokenAmount, usdcAmount } = body

            if (!investorAddress || !groveId || !tokenAmount || !usdcAmount) {
                sendError(res, 400, 'Missing required fields')
                return
            }

            const result = await hederaOperationsService.purchaseGroveTokens(
                investorAddress,
                groveId,
                tokenAmount,
                usdcAmount
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to purchase tokens')
            }

        } catch (error: any) {
            console.error('Error purchasing tokens:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    /**
     * LENDING OPERATIONS
     */

    // POST /api/lending/provide
    async provideLiquidity(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { providerAddress, assetAddress, amount } = body

            if (!providerAddress || !assetAddress || !amount || amount <= 0) {
                sendError(res, 400, 'Invalid parameters')
                return
            }

            const result = await hederaLendingService.provideLiquidity(
                providerAddress,
                assetAddress,
                amount
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        positionId: result.positionId,
                        lpTokens: result.lpTokens,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to provide liquidity')
            }

        } catch (error: any) {
            console.error('Error providing liquidity:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/lending/withdraw
    async withdrawLiquidity(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { providerAddress, assetAddress, lpTokenAmount } = body

            if (!providerAddress || !assetAddress || !lpTokenAmount || lpTokenAmount <= 0) {
                sendError(res, 400, 'Invalid parameters')
                return
            }

            const result = await hederaLendingService.withdrawLiquidity(
                providerAddress,
                assetAddress,
                lpTokenAmount
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        lpTokens: result.lpTokens,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to withdraw liquidity')
            }

        } catch (error: any) {
            console.error('Error withdrawing liquidity:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/lending/loan
    async takeOutLoan(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { borrowerAddress, assetAddress, loanAmount, collateralTokenId, collateralAmount } = body

            if (!borrowerAddress || !assetAddress || !loanAmount || !collateralTokenId || !collateralAmount) {
                sendError(res, 400, 'Missing required fields')
                return
            }

            const result = await hederaLendingService.takeOutLoan(
                borrowerAddress,
                assetAddress,
                loanAmount,
                collateralTokenId,
                collateralAmount
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        loanId: result.loanId,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to take out loan')
            }

        } catch (error: any) {
            console.error('Error taking out loan:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // POST /api/lending/repay
    async repayLoan(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = (req as any).body
            const { borrowerAddress, assetAddress } = body

            if (!borrowerAddress || !assetAddress) {
                sendError(res, 400, 'Invalid parameters')
                return
            }

            const result = await hederaLendingService.repayLoan(
                borrowerAddress,
                assetAddress
            )

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        loanId: result.loanId,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 400, result.error || 'Failed to repay loan')
            }

        } catch (error: any) {
            console.error('Error repaying loan:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }

    // GET /api/lending/pools/:assetAddress/stats
    async getPoolStats(req: IncomingMessage, res: ServerResponse, assetAddress: string) {
        try {
            const result = await hederaLendingService.getPoolStatistics(assetAddress)

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: result.stats
                })
            } else {
                sendError(res, 400, result.error || 'Failed to get pool stats')
            }

        } catch (error: any) {
            console.error('Error getting pool stats:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }
}

// Export singleton instance
export const hederaAPIRouter = new HederaAPIRouter()
