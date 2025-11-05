/**
 * CoffeeRevenueReserve Contract Interaction Service
 * 
 * This service handles all interactions with the CoffeeRevenueReserve smart contract
 * including revenue distribution, batch processing, and farmer withdrawals.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    AccountId, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'
import { db } from '../db'
import { coffeeGroves, tokenHoldings } from '../db/schema'
import { eq } from 'drizzle-orm'

// Contract ABI for CoffeeRevenueReserve
// const RESERVE_ABI = require('../abi/Reserve.json').abi

interface DistributionResult {
    success: boolean
    distributionId?: number
    transactionId?: string
    error?: string
}

interface BatchProcessResult {
    success: boolean
    successfulTransfers: number
    failedTransfers: number
    transactionId?: string
    error?: string
}

interface WithdrawalResult {
    success: boolean
    amount: number
    transactionId?: string
    error?: string
}

export class RevenueReserveContract {
    private contractId: ContractId
    private client: any // Hedera client instance

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Create a new revenue distribution on the contract
     */
    async distributeRevenue(
        groveTokenAddress: string,
        totalRevenue: number
    ): Promise<DistributionResult> {
        try {
            // Convert totalRevenue to uint64 format (assuming USDC with 6 decimals)
            const revenueAmount = Math.floor(totalRevenue * 1_000_000)

            // Execute contract function: distributeRevenue(address token, uint64 totalRevenue)
            const params = new ContractFunctionParameters()
                .addAddress(groveTokenAddress)
                .addUint64(revenueAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('distributeRevenue', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get the distribution ID from contract events
            // In a real implementation, we'd parse the RevenueDistributed event
            const distributionId = await this.getLatestDistributionId()

            return {
                success: true,
                distributionId,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error distributing revenue:', error)
            return {
                success: false,
                error: error.message || 'Failed to distribute revenue'
            }
        }
    }

    /**
     * Process a batch of token holders for distribution
     */
    async distributeRevenueToHolders(
        distributionId: number,
        holders: string[],
        tokenAmounts: number[]
    ): Promise<BatchProcessResult> {
        try {
            if (holders.length !== tokenAmounts.length) {
                return {
                    success: false,
                    successfulTransfers: 0,
                    failedTransfers: 0,
                    error: 'Holders and token amounts arrays must have the same length'
                }
            }

            // Validate batch size (max 50 per contract requirement)
            if (holders.length > 50) {
                return {
                    success: false,
                    successfulTransfers: 0,
                    failedTransfers: holders.length,
                    error: 'Batch size exceeds maximum of 50 holders'
                }
            }

            // Convert token amounts to uint64 format
            const tokenAmountsUint64 = tokenAmounts.map(amount => Math.floor(amount))

            // Execute contract function: distributeRevenueToHolders(uint256 distributionId, address[] holders, uint64[] tokenAmounts)
            const params = new ContractFunctionParameters()
                .addUint256(distributionId)
                .addAddressArray(holders)
                .addUint64Array(tokenAmountsUint64)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(1_000_000) // Higher gas for batch processing
                .setFunction('distributeRevenueToHolders', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    successfulTransfers: 0,
                    failedTransfers: holders.length,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // In a real implementation, we'd parse the BatchDistributionCompleted event
            // to get the actual success/failure counts
            return {
                success: true,
                successfulTransfers: holders.length,
                failedTransfers: 0,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error processing batch distribution:', error)
            return {
                success: false,
                successfulTransfers: 0,
                failedTransfers: holders.length,
                error: error.message || 'Failed to process batch distribution'
            }
        }
    }

    /**
     * Withdraw farmer's share from the reserve
     */
    async withdrawFarmerShare(
        amount: number,
        farmerAddress: string
    ): Promise<WithdrawalResult> {
        try {
            // Convert amount to uint64 format (assuming USDC with 6 decimals)
            const withdrawAmount = Math.floor(amount * 1_000_000)

            // Execute contract function: withdrawFarmerShare(uint64 amount, address farmerAddress)
            const params = new ContractFunctionParameters()
                .addUint64(withdrawAmount)
                .addAddress(farmerAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('withdrawFarmerShare', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    amount: 0,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            return {
                success: true,
                amount,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error withdrawing farmer share:', error)
            return {
                success: false,
                amount: 0,
                error: error.message || 'Failed to withdraw farmer share'
            }
        }
    }

    /**
     * Get the latest distribution ID from the contract
     */
    async getLatestDistributionId(): Promise<number> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('distributionCounter')

            const result = await query.execute(this.client)
            
            // Parse the result to get the distribution counter
            // The result is a BigNumber, convert to number
            const counter = result.getUint256(0).toNumber()
            return counter - 1 // Counter is incremented, so latest is counter - 1

        } catch (error) {
            console.error('Error getting latest distribution ID:', error)
            return 0
        }
    }

    /**
     * Get distribution details from the contract
     */
    async getDistribution(distributionId: number): Promise<any> {
        try {
            const params = new ContractFunctionParameters()
                .addUint256(distributionId)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getDistribution', params)

            const result = await query.execute(this.client)
            
            // Parse the result
            // Returns: (uint256 distributionDate, uint64 totalRevenue, uint64 totalTokenHolders, bool completed)
            return {
                distributionDate: result.getUint256(0).toNumber(),
                totalRevenue: result.getUint64(1),
                totalTokenHolders: result.getUint64(2),
                completed: result.getBool(3)
            }

        } catch (error) {
            console.error('Error getting distribution:', error)
            return null
        }
    }

    /**
     * Get holder's share from a specific distribution
     */
    async getHolderShare(distributionId: number, holderAddress: string): Promise<any> {
        try {
            const params = new ContractFunctionParameters()
                .addUint256(distributionId)
                .addAddress(holderAddress)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getHolderShare', params)

            const result = await query.execute(this.client)
            
            // Returns: (uint64 share, bool claimed)
            return {
                share: result.getUint64(0),
                claimed: result.getBool(1)
            }

        } catch (error) {
            console.error('Error getting holder share:', error)
            return null
        }
    }

    /**
     * Get holder's total earnings across all distributions
     */
    async getHolderTotalEarnings(holderAddress: string): Promise<number> {
        try {
            const params = new ContractFunctionParameters()
                .addAddress(holderAddress)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getHolderTotalEarnings', params)

            const result = await query.execute(this.client)
            
            // Returns uint256 total earnings
            return result.getUint256(0).toNumber()

        } catch (error) {
            console.error('Error getting holder total earnings:', error)
            return 0
        }
    }

    /**
     * Get reserve statistics
     */
    async getReserveStats(): Promise<any> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getReserveStats')

            const result = await query.execute(this.client)
            
            // Returns: (uint256 totalReserve, uint256 totalDistributed, uint256 farmerWithdrawn, uint256 distributionCount)
            return {
                totalReserve: result.getUint256(0).toNumber(),
                totalDistributed: result.getUint256(1).toNumber(),
                farmerWithdrawn: result.getUint256(2).toNumber(),
                distributionCount: result.getUint256(3).toNumber()
            }

        } catch (error) {
            console.error('Error getting reserve stats:', error)
            return null
        }
    }

    /**
     * Validate distribution before processing
     */
    async validateDistribution(
        distributionId: number,
        holders: string[],
        tokenAmounts: number[]
    ): Promise<{ isValid: boolean; reason: string }> {
        try {
            const params = new ContractFunctionParameters()
                .addUint256(distributionId)
                .addAddressArray(holders)
                .addUint64Array(tokenAmounts.map(a => Math.floor(a)))

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('validateDistribution', params)

            const result = await query.execute(this.client)
            
            // Returns: (bool isValid, string reason)
            return {
                isValid: result.getBool(0),
                reason: result.getString(1)
            }

        } catch (error) {
            console.error('Error validating distribution:', error)
            return {
                isValid: false,
                reason: error.message || 'Validation failed'
            }
        }
    }

    /**
     * Get farmer's available balance
     */
    async getFarmerBalance(farmerAddress: string): Promise<number> {
        try {
            // Query the reserve stats to get farmer's available balance
            const stats = await this.getReserveStats()
            
            if (!stats) {
                return 0
            }

            // In a real implementation, we'd have a specific function to get farmer balance
            // For now, we'll use the total reserve as a proxy
            return stats.totalReserve

        } catch (error) {
            console.error('Error getting farmer balance:', error)
            return 0
        }
    }

    /**
     * Retry failed transfers for a distribution
     */
    async retryFailedTransfers(
        distributionId: number,
        failedHolders: string[],
        amounts: number[]
    ): Promise<BatchProcessResult> {
        try {
            if (failedHolders.length !== amounts.length) {
                return {
                    success: false,
                    successfulTransfers: 0,
                    failedTransfers: 0,
                    error: 'Failed holders and amounts arrays must have the same length'
                }
            }

            // Convert amounts to uint64 format
            const amountsUint64 = amounts.map(amount => Math.floor(amount * 1_000_000))

            // Execute contract function: retryFailedTransfers
            const params = new ContractFunctionParameters()
                .addUint256(distributionId)
                .addAddressArray(failedHolders)
                .addUint64Array(amountsUint64)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(800_000)
                .setFunction('retryFailedTransfers', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    successfulTransfers: 0,
                    failedTransfers: failedHolders.length,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            return {
                success: true,
                successfulTransfers: failedHolders.length,
                failedTransfers: 0,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error retrying failed transfers:', error)
            return {
                success: false,
                successfulTransfers: 0,
                failedTransfers: failedHolders.length,
                error: error.message || 'Failed to retry transfers'
            }
        }
    }
}

/**
 * Helper function to get token holders for a grove
 */
export async function getGroveTokenHolders(groveId: number): Promise<{
    holders: string[]
    tokenAmounts: number[]
}> {
    try {
        const holdings = await db.query.tokenHoldings.findMany({
            where: eq(tokenHoldings.groveId, groveId)
        })

        const holders = holdings.map(h => h.holderAddress)
        const tokenAmounts = holdings.map(h => h.tokenAmount)

        return { holders, tokenAmounts }

    } catch (error) {
        console.error('Error getting grove token holders:', error)
        return { holders: [], tokenAmounts: [] }
    }
}

/**
 * Helper function to process distribution in batches
 */
export async function processBatchedDistribution(
    contract: RevenueReserveContract,
    distributionId: number,
    holders: string[],
    tokenAmounts: number[],
    batchSize: number = 50
): Promise<{
    success: boolean
    totalProcessed: number
    totalFailed: number
    batches: BatchProcessResult[]
}> {
    const batches: BatchProcessResult[] = []
    let totalProcessed = 0
    let totalFailed = 0

    for (let i = 0; i < holders.length; i += batchSize) {
        const batchHolders = holders.slice(i, i + batchSize)
        const batchAmounts = tokenAmounts.slice(i, i + batchSize)

        const result = await contract.distributeRevenueToHolders(
            distributionId,
            batchHolders,
            batchAmounts
        )

        batches.push(result)
        totalProcessed += result.successfulTransfers
        totalFailed += result.failedTransfers

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < holders.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    return {
        success: totalFailed === 0,
        totalProcessed,
        totalFailed,
        batches
    }
}
