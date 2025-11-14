import { IncomingMessage, ServerResponse } from 'http'
import { LenderContract } from './lender-contract'
import { withdrawalService } from './withdrawal-service'
import { transactionRecorder } from './transaction-recording-service'
import { hederaLendingService } from './hedera-lending-service'
import { db } from '../../db/index.js'
import { providedLiquidity } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'

// Mock data for lending pools since we don't have actual contracts in this environment
const MOCK_POOLS = [
    {
        assetAddress: 'USDC',
        assetName: 'USDC Stablecoin',
        lpTokenAddress: 'LP-USDC-001',
        totalLiquidity: 150000,
        availableLiquidity: 95000,
        totalBorrowed: 55000,
        utilizationRate: 0.367,
        currentAPY: 8.5,
        totalLPTokens: 150000
    },
    {
        assetAddress: 'KES',
        assetName: 'Kenyan Shilling',
        lpTokenAddress: 'LP-KES-001',
        totalLiquidity: 75000,
        availableLiquidity: 45000,
        totalBorrowed: 30000,
        utilizationRate: 0.4,
        currentAPY: 12.0,
        totalLPTokens: 75000
    }
]

// Mock loan data
const MOCK_LOANS = new Map<string, any>()

// Utility functions (copied from server.ts)
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

export class LendingAPI {

    /**
     * Get lending configuration (LP token ID, treasury ID, etc.)
     */
    async getConfig(req: IncomingMessage, res: ServerResponse) {
        try {
            const lpTokenId = process.env.LP_USDC_TOKEN_ID
            const treasuryId = process.env.HEDERA_OPERATOR_ID

            sendResponse(res, 200, {
                success: true,
                lpTokenId,
                treasuryId
            })
        } catch (error) {
            console.error('Error fetching lending config:', error)
            sendError(res, 500, 'Failed to fetch lending configuration')
        }
    }

    /**
     * Get all available lending pools
     */
    async getLendingPools(req: IncomingMessage, res: ServerResponse) {
        try {
            sendResponse(res, 200, {
                success: true,
                pools: MOCK_POOLS
            })
        } catch (error) {
            console.error('Error fetching lending pools:', error)
            sendError(res, 500, 'Failed to fetch lending pools')
        }
    }

    /**
     * Provide liquidity to a lending pool
     */
    async provideLiquidity(req: IncomingMessage, res: ServerResponse) {
        try {
            const { assetAddress, amount, providerAddress } = (req as any).body || {}

            if (!assetAddress || !amount || !providerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, amount, providerAddress')
                return
            }

            if (amount <= 0) {
                sendError(res, 400, 'Amount must be positive')
                return
            }

            console.log(`[Lending API] Providing liquidity: ${amount} ${assetAddress} from ${providerAddress}`)

            // Use real Hedera lending service
            const result = await hederaLendingService.provideLiquidity(
                providerAddress,
                assetAddress,
                amount
            )

            if (!result.success) {
                // Check if it's a token association error
                if (result.error && result.error.includes('TOKEN_NOT_ASSOCIATED')) {
                    sendError(res, 400, result.error)
                } else {
                    sendError(res, 500, result.error || 'Failed to provide liquidity')
                }
                return
            }

            // Record transaction in history
            try {
                await transactionRecorder.recordLiquidityProvided({
                    providerAddress,
                    assetAddress,
                    amount,
                    lpTokensMinted: result.lpTokens || amount,
                    transactionHash: result.transactionId || ''
                })
            } catch (recordError) {
                console.warn('Failed to record transaction (non-critical):', recordError)
            }

            sendResponse(res, 200, {
                success: true,
                assetAddress,
                amount,
                lpTokensMinted: result.lpTokens,
                transactionHash: result.transactionId,
                providedAt: new Date().toISOString()
            })
        } catch (error: any) {
            console.error('Error providing liquidity:', error)
            sendError(res, 500, 'Failed to provide liquidity')
        }
    }

    /**
     * Withdraw liquidity from a lending pool
     */
    async withdrawLiquidity(req: IncomingMessage, res: ServerResponse) {
        try {
            const { assetAddress, lpTokenAmount, providerAddress } = (req as any).body || {}

            if (!assetAddress || !lpTokenAmount || !providerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, lpTokenAmount, providerAddress')
                return
            }

            if (lpTokenAmount <= 0) {
                sendError(res, 400, 'LP token amount must be positive')
                return
            }

            // Find the pool
            const pool = MOCK_POOLS.find(p => p.assetAddress === assetAddress)
            if (!pool) {
                sendError(res, 404, 'Lending pool not found')
                return
            }

            console.log(`[Lending API] Withdrawing liquidity: ${lpTokenAmount} LP tokens from ${providerAddress}`)

            // Use real Hedera lending service
            const result = await hederaLendingService.withdrawLiquidity(
                providerAddress,
                assetAddress,
                lpTokenAmount
            )

            if (!result.success) {
                sendError(res, 400, result.error || 'Withdrawal failed')
                return
            }

            // Record transaction in history
            await transactionRecorder.recordLiquidityWithdrawn({
                providerAddress,
                assetAddress,
                lpTokenAmount,
                usdcReceived: result.usdcReturned || lpTokenAmount,
                transactionHash: result.transactionId || ''
            })

            const blockExplorerUrl = result.transactionId 
                ? `https://hashscan.io/testnet/transaction/${result.transactionId}`
                : undefined

            sendResponse(res, 200, {
                success: true,
                data: {
                    assetAddress,
                    lpTokensBurned: lpTokenAmount,
                    usdcReturned: result.usdcReturned,
                    rewardsEarned: result.rewardsEarned || 0,
                    transactionHash: result.transactionId,
                    blockExplorerUrl,
                    withdrawnAt: new Date().toISOString()
                }
            })
        } catch (error) {
            console.error('Error withdrawing liquidity:', error)
            sendError(res, 500, 'Failed to withdraw liquidity')
        }
    }

    /**
     * Get pool statistics
     */
    async getPoolStatistics(req: IncomingMessage, res: ServerResponse) {
        try {
            const { assetAddress } = (req as any).query || {}

            if (!assetAddress) {
                sendError(res, 400, 'Missing required parameter: assetAddress')
                return
            }

            // Find the pool
            const pool = MOCK_POOLS.find(p => p.assetAddress === assetAddress)
            if (!pool) {
                sendError(res, 404, 'Lending pool not found')
                return
            }

            // In a real implementation, this would fetch real statistics from the contract
            // For now, we'll enhance the mock data with more statistics
            const stats = {
                ...pool,
                totalProviders: Math.floor(Math.random() * 50) + 10,
                totalBorrowers: Math.floor(Math.random() * 20) + 5,
                averageLoanSize: Math.floor(pool.totalBorrowed / (Math.random() * 10 + 5))
            }

            sendResponse(res, 200, {
                success: true,
                pool: stats
            })
        } catch (error) {
            console.error('Error fetching pool statistics:', error)
            sendError(res, 500, 'Failed to fetch pool statistics')
        }
    }

    /**
     * Calculate loan terms
     */
    async calculateLoanTerms(req: IncomingMessage, res: ServerResponse) {
        try {
            const { assetAddress, loanAmount, collateralTokenId, collateralAmount } = (req as any).body || {}

            if (!assetAddress || !loanAmount) {
                sendError(res, 400, 'Missing required parameters: assetAddress, loanAmount')
                return
            }

            if (loanAmount <= 0) {
                sendError(res, 400, 'Loan amount must be positive')
                return
            }

            // Import price oracle
            const { priceOracleService } = await import('../services/price-oracle-service.js')

            // Get collateral token price if provided
            let collateralPrice = 10.0; // Default
            if (collateralTokenId) {
                collateralPrice = await priceOracleService.getTokenPrice(collateralTokenId)
            }

            // Calculate terms
            const collateralizationRatio = 1.25
            const interestRate = 0.10
            const liquidationThreshold = 0.90
            
            const requiredCollateralValue = loanAmount * collateralizationRatio
            const requiredCollateralAmount = collateralAmount || (requiredCollateralValue / collateralPrice)
            const repaymentAmount = loanAmount * (1 + interestRate)
            const liquidationPrice = loanAmount / (requiredCollateralAmount * liquidationThreshold)
            const maxLoanDuration = 180 // days

            sendResponse(res, 200, {
                success: true,
                data: {
                    loanAmount,
                    collateralRequired: requiredCollateralAmount,
                    collateralPrice,
                    collateralizationRatio,
                    liquidationPrice,
                    liquidationThreshold,
                    repaymentAmount,
                    interestRate,
                    interestAmount: loanAmount * interestRate,
                    maxLoanDuration,
                    dueDate: Date.now() + (maxLoanDuration * 24 * 60 * 60 * 1000)
                }
            })
        } catch (error) {
            console.error('Error calculating loan terms:', error)
            sendError(res, 500, 'Failed to calculate loan terms')
        }
    }

    /**
     * Take out a loan (REAL IMPLEMENTATION)
     */
    async takeOutLoan(req: IncomingMessage, res: ServerResponse) {
        try {
            const { assetAddress, loanAmount, borrowerAddress, collateralTokenId, collateralAmount } = (req as any).body || {}

            if (!assetAddress || !loanAmount || !borrowerAddress || !collateralTokenId || !collateralAmount) {
                sendError(res, 400, 'Missing required parameters: assetAddress, loanAmount, borrowerAddress, collateralTokenId, collateralAmount')
                return
            }

            if (loanAmount <= 0) {
                sendError(res, 400, 'Loan amount must be positive')
                return
            }

            if (collateralAmount <= 0) {
                sendError(res, 400, 'Collateral amount must be positive')
                return
            }

            console.log(`[Lending API] Processing loan origination for ${borrowerAddress}`)

            // Import services
            const { loanManagementService } = await import('../services/loan-management-service.js')
            const { priceOracleService } = await import('../services/price-oracle-service.js')

            // Check if borrower already has an active loan
            const existingLoans = await loanManagementService.getBorrowerLoans(borrowerAddress)
            const activeLoans = existingLoans.filter(loan => loan.status === 'active')
            
            if (activeLoans.length > 0) {
                sendError(res, 400, 'You already have an active loan. Please repay it before taking a new one.')
                return
            }

            // Get collateral price
            const collateralPrice = await priceOracleService.getTokenPrice(collateralTokenId)

            // Create loan
            const loan = await loanManagementService.createLoan({
                borrowerAccount: borrowerAddress,
                assetAddress,
                loanAmount,
                collateralTokenId,
                collateralAmount,
                collateralPrice
            })

            // Record transaction in history
            await transactionRecorder.recordLoan({
                borrowerAddress,
                assetAddress,
                loanAmount,
                collateralAmount,
                transactionHash: loan.transactionHash || ''
            })

            const blockExplorerUrl = loan.transactionHash 
                ? `https://hashscan.io/testnet/transaction/${loan.transactionHash}`
                : undefined

            sendResponse(res, 200, {
                success: true,
                data: {
                    loanId: loan.loanId,
                    borrowerAddress: loan.borrowerAccount,
                    assetAddress: loan.assetAddress,
                    loanAmount: loan.loanAmountUsdc,
                    collateralAmount: loan.collateralAmount,
                    collateralTokenId: loan.collateralTokenId,
                    repaymentAmount: loan.repaymentAmount,
                    interestRate: loan.interestRate,
                    healthFactor: loan.healthFactor,
                    liquidationPrice: loan.liquidationPrice,
                    status: loan.status,
                    takenAt: loan.takenAt,
                    dueDate: loan.dueDate,
                    transactionHash: loan.transactionHash,
                    blockExplorerUrl
                }
            })
        } catch (error: any) {
            console.error('Error taking out loan:', error)
            sendError(res, 500, error.message || 'Failed to take out loan')
        }
    }

    /**
     * Repay a loan (REAL IMPLEMENTATION)
     */
    async repayLoan(req: IncomingMessage, res: ServerResponse) {
        try {
            const { loanId, borrowerAddress, paymentAmount } = (req as any).body || {}

            if (!loanId || !borrowerAddress) {
                sendError(res, 400, 'Missing required parameters: loanId, borrowerAddress')
                return
            }

            console.log(`[Lending API] Processing loan repayment for ${loanId}`)

            // Import service
            const { loanManagementService } = await import('../services/loan-management-service.js')

            // Get loan details
            const loan = await loanManagementService.getLoan(loanId)
            if (!loan) {
                sendError(res, 404, 'Loan not found')
                return
            }

            if (loan.status !== 'active') {
                sendError(res, 400, `Loan is not active. Status: ${loan.status}`)
                return
            }

            if (loan.borrowerAccount !== borrowerAddress) {
                sendError(res, 403, 'You are not authorized to repay this loan')
                return
            }

            // Use full repayment amount if not specified
            const actualPaymentAmount = paymentAmount || loan.repaymentAmount

            // Process repayment
            await loanManagementService.processRepayment({
                loanId,
                borrowerAccount: borrowerAddress,
                paymentAmount: actualPaymentAmount
            })

            // Get updated loan
            const updatedLoan = await loanManagementService.getLoan(loanId)

            // Record transaction in history
            await transactionRecorder.recordLoanRepayment({
                borrowerAddress,
                assetAddress: loan.assetAddress,
                repaymentAmount: actualPaymentAmount,
                transactionHash: updatedLoan?.transactionHash || ''
            })

            const blockExplorerUrl = updatedLoan?.transactionHash 
                ? `https://hashscan.io/testnet/transaction/${updatedLoan.transactionHash}`
                : undefined

            sendResponse(res, 200, {
                success: true,
                data: {
                    loanId: loan.loanId,
                    paymentAmount: actualPaymentAmount,
                    repaymentAmount: loan.repaymentAmount,
                    collateralReturned: loan.collateralAmount,
                    collateralTokenId: loan.collateralTokenId,
                    status: updatedLoan?.status || 'repaid',
                    transactionHash: updatedLoan?.transactionHash,
                    blockExplorerUrl,
                    repaidAt: updatedLoan?.repaidAt || Date.now()
                }
            })
        } catch (error: any) {
            console.error('Error repaying loan:', error)
            sendError(res, 500, error.message || 'Failed to repay loan')
        }
    }

    /**
     * Get loan details (REAL IMPLEMENTATION)
     */
    async getLoanDetails(req: IncomingMessage, res: ServerResponse, loanId: string) {
        try {
            if (!loanId) {
                sendError(res, 400, 'Missing required parameter: loanId')
                return
            }

            console.log(`[Lending API] Fetching loan details for ${loanId}`)

            // Import services
            const { loanManagementService } = await import('../services/loan-management-service.js')
            const { priceOracleService } = await import('../services/price-oracle-service.js')

            // Get loan
            const loan = await loanManagementService.getLoan(loanId)
            if (!loan) {
                sendError(res, 404, 'Loan not found')
                return
            }

            // Get current collateral price
            const currentPrice = await priceOracleService.getTokenPrice(loan.collateralTokenId)

            // Calculate current health factor
            const currentCollateralValue = loan.collateralAmount * currentPrice
            const currentHealthFactor = (currentCollateralValue * loan.liquidationThreshold) / loan.loanAmountUsdc

            // Get collateral details
            const { lendingLoanCollateral } = await import('../../db/schema/index.js')
            const { eq } = await import('drizzle-orm')
            
            const collateral = await db.select()
                .from(lendingLoanCollateral)
                .where(eq(lendingLoanCollateral.loanId, loanId))
                .limit(1)

            const blockExplorerUrl = loan.transactionHash 
                ? `https://hashscan.io/testnet/transaction/${loan.transactionHash}`
                : undefined

            sendResponse(res, 200, {
                success: true,
                loan: {
                    ...loan,
                    currentPrice,
                    currentHealthFactor,
                    currentCollateralValue,
                    collateralDetails: collateral[0] || null,
                    blockExplorerUrl,
                    isAtRisk: currentHealthFactor < 1.1,
                    daysUntilDue: Math.ceil((loan.dueDate - Date.now()) / (24 * 60 * 60 * 1000))
                }
            })
        } catch (error) {
            console.error('Error fetching loan details:', error)
            sendError(res, 500, 'Failed to fetch loan details')
        }
    }

    /**
     * Get all loans for a borrower
     */
    async getBorrowerLoans(req: IncomingMessage, res: ServerResponse, borrowerAddress: string) {
        try {
            if (!borrowerAddress) {
                sendError(res, 400, 'Missing required parameter: borrowerAddress')
                return
            }

            console.log(`[Lending API] Fetching loans for borrower ${borrowerAddress}`)

            // Import service
            const { loanManagementService } = await import('../services/loan-management-service.js')

            // Get loans
            const loans = await loanManagementService.getBorrowerLoans(borrowerAddress)

            sendResponse(res, 200, {
                success: true,
                loans,
                count: loans.length
            })
        } catch (error) {
            console.error('Error fetching borrower loans:', error)
            sendError(res, 500, 'Failed to fetch borrower loans')
        }
    }

    /**
     * Get loans at risk of liquidation
     */
    async getLoansAtRisk(req: IncomingMessage, res: ServerResponse) {
        try {
            console.log('[Lending API] Fetching loans at risk')

            // Import service
            const { loanManagementService } = await import('../services/loan-management-service.js')

            // Get at-risk loans
            const loans = await loanManagementService.getLoansAtRisk()

            sendResponse(res, 200, {
                success: true,
                loans,
                count: loans.length
            })
        } catch (error) {
            console.error('Error fetching loans at risk:', error)
            sendError(res, 500, 'Failed to fetch loans at risk')
        }
    }

    /**
     * Get liquidity positions for a user (Demo Mode - reads from database)
     * GET /api/lending/liquidity-positions/:userAddress
     */
    async getLiquidityPositions(req: IncomingMessage, res: ServerResponse, userAddress: string) {
        try {
            console.log('[Lending API] Fetching liquidity positions for:', userAddress);

            // Query database for user's liquidity positions
            const positions = await db.select()
                .from(providedLiquidity)
                .where(eq(providedLiquidity.account, userAddress));

            console.log('[Lending API] Found positions:', positions.length);

            // Transform positions to include calculated fields
            const enrichedPositions = positions.map(pos => {
                // Calculate mock earnings (in real implementation, this would come from smart contract)
                const daysActive = Math.floor((Date.now() - pos.timestamp) / (1000 * 60 * 60 * 24));
                const dailyAPY = 0.12 / 365; // 12% APY
                const mockEarnings = pos.amount * dailyAPY * daysActive;

                return {
                    id: pos.id,
                    poolName: pos.asset === 'USDC' ? 'USDC Pool' : `${pos.asset} Pool`,
                    assetAddress: pos.asset,
                    lpTokenBalance: pos.amount, // 1:1 ratio for demo
                    lpTokenPrice: 1.0 + (mockEarnings / pos.amount), // Price increases with earnings
                    initialInvestment: pos.amount,
                    currentAPY: 12.0,
                    poolShare: 0.67, // Mock pool share
                    providedDate: pos.timestamp,
                    // Calculated fields
                    daysActive: daysActive,
                    unclaimedEarnings: mockEarnings,
                    // Demo mode indicator
                    isDemoMode: true
                };
            });

            // If no positions found, add mock demo positions for demonstration
            if (enrichedPositions.length === 0) {
                const now = Date.now();
                const mockPositions = [
                    {
                        id: 'demo-1',
                        poolName: 'USDC Lending Pool',
                        assetAddress: '0.0.USDC',
                        lpTokenBalance: 5000,
                        lpTokenPrice: 1.045,
                        initialInvestment: 5000,
                        currentAPY: 12.5,
                        poolShare: 2.34,
                        providedDate: now - (45 * 24 * 60 * 60 * 1000), // 45 days ago
                        daysActive: 45,
                        unclaimedEarnings: 225,
                        isDemoMode: true
                    },
                    {
                        id: 'demo-2',
                        poolName: 'USDC Lending Pool',
                        assetAddress: '0.0.USDC',
                        lpTokenBalance: 2500,
                        lpTokenPrice: 1.023,
                        initialInvestment: 2500,
                        currentAPY: 11.8,
                        poolShare: 1.17,
                        providedDate: now - (23 * 24 * 60 * 60 * 1000), // 23 days ago
                        daysActive: 23,
                        unclaimedEarnings: 57.5,
                        isDemoMode: true
                    }
                ];

                sendResponse(res, 200, {
                    success: true,
                    positions: mockPositions,
                    count: mockPositions.length,
                    demoMode: true,
                    message: 'Demo Mode: Showing sample liquidity positions for demonstration'
                });
                return;
            }

            sendResponse(res, 200, {
                success: true,
                positions: enrichedPositions,
                count: enrichedPositions.length,
                demoMode: true,
                message: 'Demo Mode: Positions shown are from database, not blockchain'
            });

        } catch (error) {
            console.error('[Lending API] Error fetching liquidity positions:', error);
            
            // Return mock positions instead of error (graceful degradation)
            const now = Date.now();
            const mockPositions = [
                {
                    id: 'demo-1',
                    poolName: 'USDC Lending Pool',
                    assetAddress: '0.0.USDC',
                    lpTokenBalance: 5000,
                    lpTokenPrice: 1.045,
                    initialInvestment: 5000,
                    currentAPY: 12.5,
                    poolShare: 2.34,
                    providedDate: now - (45 * 24 * 60 * 60 * 1000), // 45 days ago
                    daysActive: 45,
                    unclaimedEarnings: 225,
                    isDemoMode: true
                },
                {
                    id: 'demo-2',
                    poolName: 'USDC Lending Pool',
                    assetAddress: '0.0.USDC',
                    lpTokenBalance: 2500,
                    lpTokenPrice: 1.023,
                    initialInvestment: 2500,
                    currentAPY: 11.8,
                    poolShare: 1.17,
                    providedDate: now - (23 * 24 * 60 * 60 * 1000), // 23 days ago
                    daysActive: 23,
                    unclaimedEarnings: 57.5,
                    isDemoMode: true
                }
            ];

            sendResponse(res, 200, {
                success: true,
                positions: mockPositions,
                count: mockPositions.length,
                demoMode: true,
                message: 'Demo Mode: Showing sample liquidity positions for demonstration'
            });
        }
    }

    /**
     * Get liquidation history
     * GET /api/lending/liquidations
     */
    async getLiquidationHistory(req: IncomingMessage, res: ServerResponse) {
        try {
            const { limit } = (req as any).query || {};
            
            console.log('[Lending API] Fetching liquidation history');

            // Import liquidation service
            const { liquidationService } = await import('../services/liquidation-service.js');

            // Get liquidation history
            const liquidations = await liquidationService.getLiquidationHistory(
                limit ? parseInt(limit) : 50
            );

            sendResponse(res, 200, {
                success: true,
                liquidations,
                count: liquidations.length
            });

        } catch (error) {
            console.error('[Lending API] Error fetching liquidation history:', error);
            sendError(res, 500, 'Failed to fetch liquidation history');
        }
    }

    /**
     * Get liquidations for a borrower
     * GET /api/lending/liquidations/borrower/:account
     */
    async getBorrowerLiquidations(req: IncomingMessage, res: ServerResponse, borrowerAccount: string) {
        try {
            if (!borrowerAccount) {
                sendError(res, 400, 'Missing required parameter: borrowerAccount');
                return;
            }

            console.log(`[Lending API] Fetching liquidations for borrower: ${borrowerAccount}`);

            // Import liquidation service
            const { liquidationService } = await import('../services/liquidation-service.js');

            // Get borrower liquidations
            const liquidations = await liquidationService.getBorrowerLiquidations(borrowerAccount);

            sendResponse(res, 200, {
                success: true,
                liquidations,
                count: liquidations.length
            });

        } catch (error) {
            console.error('[Lending API] Error fetching borrower liquidations:', error);
            sendError(res, 500, 'Failed to fetch borrower liquidations');
        }
    }

    /**
     * Manually trigger liquidation (admin only)
     * POST /api/lending/liquidations/execute
     */
    async executeLiquidation(req: IncomingMessage, res: ServerResponse) {
        try {
            const { loanId } = (req as any).body || {};

            if (!loanId) {
                sendError(res, 400, 'Missing required parameter: loanId');
                return;
            }

            console.log(`[Lending API] Manually executing liquidation for: ${loanId}`);

            // Import liquidation service
            const { liquidationService } = await import('../services/liquidation-service.js');

            // Execute liquidation
            const result = await liquidationService.executeLiquidation(loanId);

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    data: result
                });
            } else {
                sendError(res, 400, result.error || 'Liquidation failed');
            }

        } catch (error: any) {
            console.error('[Lending API] Error executing liquidation:', error);
            sendError(res, 500, error.message || 'Failed to execute liquidation');
        }
    }

    /**
     * Get liquidation monitoring status
     * GET /api/lending/liquidations/status
     */
    async getLiquidationStatus(req: IncomingMessage, res: ServerResponse) {
        try {
            console.log('[Lending API] Fetching liquidation monitoring status');

            // Import liquidation service
            const { liquidationService } = await import('../services/liquidation-service.js');

            // Get status
            const status = liquidationService.getMonitoringStatus();

            sendResponse(res, 200, {
                success: true,
                status
            });

        } catch (error) {
            console.error('[Lending API] Error fetching liquidation status:', error);
            sendError(res, 500, 'Failed to fetch liquidation status');
        }
    }
}
