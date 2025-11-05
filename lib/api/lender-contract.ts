/**
 * Lender Contract Interaction Service
 * 
 * This service handles all interactions with the Lender smart contract
 * including liquidity provision, withdrawals, loan operations, and pool statistics.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    AccountId, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'

// Contract ABI for Lender
// const LENDER_ABI = require('../abi/Lender.json').abi

interface LiquidityResult {
    success: boolean
    amount?: number
    lpTokenAmount?: number
    usdcReturned?: number
    rewardsEarned?: number
    transactionId?: string
    error?: string
}

interface LoanResult {
    success: boolean
    loanAmount?: number
    collateralAmount?: number
    transactionId?: string
    error?: string
}

interface PoolStats {
    assetAddress: string
    lpTokenAddress: string
    totalLiquidity: number
    availableLiquidity: number
    totalBorrowed: number
    utilizationRate: number
    currentAPY: number
}

interface LoanDetails {
    loanAmountKES: number
    collateralAmountAsset: number
    liquidationKESPrice: number
    repayAmountKES: number
    isLiquidated: boolean
    isRepaid: boolean
    isOutstanding: boolean
}

export class LenderContract {
    private contractId: ContractId
    private client: any // Hedera client instance

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Provide liquidity to a lending pool
     */
    async provideLiquidity(
        assetAddress: string,
        amount: number
    ): Promise<LiquidityResult> {
        try {
            // Convert amount to uint64 format (assuming KES with appropriate decimals)
            const liquidityAmount = Math.floor(amount)

            // Execute contract function: provideLiquidity(address asset, uint64 amount)
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)
                .addUint64(liquidityAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('provideLiquidity', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            return {
                success: true,
                amount,
                lpTokenAmount: amount, // 1:1 ratio initially
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error providing liquidity:', error)
            return {
                success: false,
                error: error.message || 'Failed to provide liquidity'
            }
        }
    }

    /**
     * Withdraw liquidity from a lending pool
     */
    async withdrawLiquidity(
        assetAddress: string,
        lpTokenAmount: number
    ): Promise<LiquidityResult> {
        try {
            // Convert amount to uint64 format
            const withdrawAmount = Math.floor(lpTokenAmount)

            // Execute contract function: withdrawLiquidity(address asset, uint64 amount)
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)
                .addUint64(withdrawAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('withdrawLiquidity', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // In a real implementation, parse the contract event to get actual amounts
            // For now, calculate estimated returns (principal + 5% APY)
            const usdcReturned = lpTokenAmount * 1.05
            const rewardsEarned = lpTokenAmount * 0.05

            return {
                success: true,
                amount: lpTokenAmount,
                lpTokenAmount,
                usdcReturned,
                rewardsEarned,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error withdrawing liquidity:', error)
            return {
                success: false,
                error: error.message || 'Failed to withdraw liquidity'
            }
        }
    }

    /**
     * Take out a loan against collateral
     */
    async takeOutLoan(
        assetAddress: string,
        loanAmount: number
    ): Promise<LoanResult> {
        try {
            // Convert amount to uint64 format
            const loanAmountUint64 = Math.floor(loanAmount)

            // Execute contract function: takeOutLoan(address asset, uint64 amount)
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)
                .addUint64(loanAmountUint64)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(800_000)
                .setFunction('takeOutLoan', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get loan details to return collateral amount
            const loanDetails = await this.getLoanDetails(assetAddress, this.client.operatorAccountId.toString())

            return {
                success: true,
                loanAmount,
                collateralAmount: loanDetails?.collateralAmountAsset || 0,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error taking out loan:', error)
            return {
                success: false,
                error: error.message || 'Failed to take out loan'
            }
        }
    }

    /**
     * Repay an outstanding loan
     */
    async repayOutstandingLoan(
        assetAddress: string
    ): Promise<LoanResult> {
        try {
            // Execute contract function: repayOutstandingLoan(address asset)
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(600_000)
                .setFunction('repayOutstandingLoan', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            return {
                success: true,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error repaying loan:', error)
            return {
                success: false,
                error: error.message || 'Failed to repay loan'
            }
        }
    }

    /**
     * Get LP token address for an asset
     */
    async getLpTokenAddress(assetAddress: string): Promise<string | null> {
        try {
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getLpTokenAddress', params)

            const result = await query.execute(this.client)
            
            // Returns address
            return result.getAddress(0)

        } catch (error) {
            console.error('Error getting LP token address:', error)
            return null
        }
    }

    /**
     * Get reserve address for an asset
     */
    async getReserveAddress(assetAddress: string): Promise<string | null> {
        try {
            const params = new ContractFunctionParameters()
                .addAddress(assetAddress)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getReserveAddress', params)

            const result = await query.execute(this.client)
            
            // Returns address
            return result.getAddress(0)

        } catch (error) {
            console.error('Error getting reserve address:', error)
            return null
        }
    }

    /**
     * Get loan details for a borrower
     */
    async getLoanDetails(assetAddress: string, borrowerAddress: string): Promise<LoanDetails | null> {
        try {
            // First get the reserve address
            const reserveAddress = await this.getReserveAddress(assetAddress)
            if (!reserveAddress) {
                return null
            }

            // Query the reserve contract for loan details
            const reserveId = ContractId.fromString(reserveAddress)
            const params = new ContractFunctionParameters()
                .addAddress(borrowerAddress)

            const query = new ContractCallQuery()
                .setContractId(reserveId)
                .setGas(100_000)
                .setFunction('getLoan', params)

            const result = await query.execute(this.client)
            
            // Returns: Loan struct (loanAmountKES, collateralAmountAsset, liquidationKESPrice, repayAmountKES, isLiquidated, isRepaid, isOutstanding)
            return {
                loanAmountKES: Number(result.getUint64(0)),
                collateralAmountAsset: Number(result.getUint64(1)),
                liquidationKESPrice: Number(result.getUint64(2)),
                repayAmountKES: Number(result.getUint64(3)),
                isLiquidated: result.getBool(4),
                isRepaid: result.getBool(5),
                isOutstanding: result.getBool(6)
            }

        } catch (error) {
            console.error('Error getting loan details:', error)
            return null
        }
    }

    /**
     * Get pool statistics for an asset
     */
    async getPoolStatistics(assetAddress: string): Promise<PoolStats | null> {
        try {
            const lpTokenAddress = await this.getLpTokenAddress(assetAddress)
            if (!lpTokenAddress) {
                return null
            }

            // In a real implementation, we'd query the reserve contract for detailed stats
            // For now, return mock data structure
            return {
                assetAddress,
                lpTokenAddress,
                totalLiquidity: 0,
                availableLiquidity: 0,
                totalBorrowed: 0,
                utilizationRate: 0,
                currentAPY: 8.5
            }

        } catch (error) {
            console.error('Error getting pool statistics:', error)
            return null
        }
    }

    /**
     * Calculate loan terms for a given amount
     */
    async calculateLoanTerms(assetAddress: string, loanAmount: number): Promise<{
        collateralRequired: number
        liquidationPrice: number
        repaymentAmount: number
        interestRate: number
    } | null> {
        try {
            // Get current price from oracle (address 0x588104)
            // For now, use mock calculation
            const basePrice = 100 // Mock price
            
            // 125% collateralization ratio
            const collateralRequired = Math.ceil((loanAmount / basePrice) * 1.25)
            
            // 90% liquidation threshold
            const liquidationPrice = Math.floor(basePrice * 0.9)
            
            // 110% repayment
            const repaymentAmount = Math.ceil(loanAmount * 1.1)
            
            return {
                collateralRequired,
                liquidationPrice,
                repaymentAmount,
                interestRate: 10 // 10% interest
            }

        } catch (error) {
            console.error('Error calculating loan terms:', error)
            return null
        }
    }

    /**
     * Get all available lending pools
     */
    async getLendingPools(): Promise<PoolStats[]> {
        try {
            // In a real implementation, we'd query the contract for all registered pools
            // For now, return empty array
            return []

        } catch (error) {
            console.error('Error getting lending pools:', error)
            return []
        }
    }
}

/**
 * Helper function to calculate loan health factor
 */
export function calculateLoanHealth(
    collateralValue: number,
    loanAmount: number,
    currentPrice: number
): number {
    const collateralValueInKES = collateralValue * currentPrice
    return collateralValueInKES / loanAmount
}

/**
 * Helper function to check if loan is at risk
 */
export function isLoanAtRisk(healthFactor: number): boolean {
    return healthFactor < 1.2
}

/**
 * Helper function to check if loan should be liquidated
 */
export function shouldLiquidate(healthFactor: number): boolean {
    return healthFactor < 1.0
}
