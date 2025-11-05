/**
 * CoffeeTreeManager Contract Interaction Service
 * 
 * This service handles all interactions with the CoffeeTreeManager smart contract
 * including token minting, burning, and KYC management operations.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    AccountId, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'
import { db } from '../db'
import { coffeeGroves } from '../db/schema'
import { eq } from 'drizzle-orm'

// Contract ABI for CoffeeTreeManager
const MANAGER_ABI = require('../abi/Issuer.json').abi

interface TokenOperationResult {
    success: boolean
    newSupply?: number
    transactionId?: string
    error?: string
}

interface KYCOperationResult {
    success: boolean
    accountAddress: string
    kycGranted: boolean
    transactionId?: string
    error?: string
}

interface TokenSupplyInfo {
    totalSupply: number
    circulatingSupply: number
    tokenAddress: string
}

interface TokenHolderInfo {
    address: string
    balance: number
    kycStatus: boolean
}

export class TreeManagerContract {
    private contractId: ContractId
    private client: any // Hedera client instance

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Mint new tokens for a grove
     */
    async mintTokens(amount: number): Promise<TokenOperationResult> {
        try {
            // Convert amount to uint64 format
            const tokenAmount = Math.floor(amount)

            // Execute contract function: mint(uint64 amount)
            const params = new ContractFunctionParameters()
                .addUint64(tokenAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('mint', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get the new total supply
            const newSupply = await this.getTotalSupply()

            return {
                success: true,
                newSupply,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error minting tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint tokens'
            }
        }
    }

    /**
     * Burn tokens from a grove
     */
    async burnTokens(amount: number): Promise<TokenOperationResult> {
        try {
            // Convert amount to uint64 format
            const tokenAmount = Math.floor(amount)

            // Execute contract function: burn(uint64 amount)
            const params = new ContractFunctionParameters()
                .addUint64(tokenAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('burn', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get the new total supply
            const newSupply = await this.getTotalSupply()

            return {
                success: true,
                newSupply,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error burning tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to burn tokens'
            }
        }
    }

    /**
     * Grant KYC approval to an account
     */
    async grantKYC(accountAddress: string): Promise<KYCOperationResult> {
        try {
            // Execute contract function: grantKYC(address account)
            const params = new ContractFunctionParameters()
                .addAddress(accountAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('grantKYC', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    accountAddress,
                    kycGranted: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            return {
                success: true,
                accountAddress,
                kycGranted: true,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error granting KYC:', error)
            return {
                success: false,
                accountAddress,
                kycGranted: false,
                error: error.message || 'Failed to grant KYC'
            }
        }
    }

    /**
     * Get total token supply
     */
    async getTotalSupply(): Promise<number> {
        try {
            // Query contract function: totalSupply()
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('totalSupply')

            const result = await query.execute(this.client)
            
            // Parse the result (uint64)
            const supply = result.getUint64(0)
            return Number(supply)

        } catch (error) {
            console.error('Error getting total supply:', error)
            return 0
        }
    }

    /**
     * Get token address for this grove
     */
    async getTokenAddress(): Promise<string> {
        try {
            // Query contract function: token()
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('token')

            const result = await query.execute(this.client)
            
            // Parse the result (address)
            const tokenAddress = result.getAddress(0)
            return tokenAddress

        } catch (error) {
            console.error('Error getting token address:', error)
            return ''
        }
    }

    /**
     * Get token supply information
     */
    async getTokenSupplyInfo(): Promise<TokenSupplyInfo> {
        try {
            const totalSupply = await this.getTotalSupply()
            const tokenAddress = await this.getTokenAddress()

            return {
                totalSupply,
                circulatingSupply: totalSupply, // For now, all tokens are circulating
                tokenAddress
            }

        } catch (error) {
            console.error('Error getting token supply info:', error)
            return {
                totalSupply: 0,
                circulatingSupply: 0,
                tokenAddress: ''
            }
        }
    }

    /**
     * Check KYC status for an account
     * Note: This requires querying the Hedera Token Service
     */
    async checkKYCStatus(accountAddress: string): Promise<boolean> {
        try {
            // In a real implementation, we would query the HTS for KYC status
            // For now, return a placeholder
            // This would use the Hedera SDK's TokenNftInfoQuery or similar
            
            console.log(`Checking KYC status for ${accountAddress}`)
            
            // Placeholder: In production, query HTS
            return false

        } catch (error) {
            console.error('Error checking KYC status:', error)
            return false
        }
    }
}

/**
 * Helper function to get TreeManagerContract instance for a grove
 */
export async function getTreeManagerForGrove(groveId: string, client: any): Promise<TreeManagerContract | null> {
    try {
        // Get grove from database
        const grove = await db.query.coffeeGroves.findFirst({
            where: eq(coffeeGroves.id, parseInt(groveId))
        })

        if (!grove) {
            console.error(`Grove ${groveId} not found`)
            return null
        }

        // In the Chai Coffee platform, each grove has a CoffeeTreeManager contract
        // The contract address should be stored in the tokenAddress field or a separate field
        // For now, we'll use the tokenAddress as the manager contract address
        // In production, this should be the actual CoffeeTreeManager contract address
        
        const managerContractAddress = grove.tokenAddress || process.env.TREE_MANAGER_CONTRACT_ID
        
        if (!managerContractAddress) {
            console.error(`Grove ${groveId} has no manager contract address configured`)
            return null
        }

        return new TreeManagerContract(managerContractAddress, client)

    } catch (error) {
        console.error('Error getting tree manager for grove:', error)
        return null
    }
}

export default TreeManagerContract
