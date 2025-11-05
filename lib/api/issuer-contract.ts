/**
 * CoffeeTreeIssuer Contract Interaction Service
 * 
 * This service handles interactions with the CoffeeTreeIssuer smart contract
 * for grove registration, tokenization, and token management.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    ContractId,
    ContractFunctionParameters,
    Hbar
} from '@hashgraph/sdk'

interface TokenizeGroveResult {
    success: boolean
    tokenAddress?: string
    managerContractAddress?: string
    reserveContractAddress?: string
    transactionId?: string
    error?: string
}

interface CreateAssetResult {
    success: boolean
    tokenAddress?: string
    transactionId?: string
    error?: string
}

export class IssuerContract {
    private contractId: ContractId
    private client: any // Hedera client instance

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Create a tokenized asset (HTS token) for a grove
     * This is the first step before tokenization
     */
    async createTokenizedAsset(name: string, symbol: string): Promise<CreateAssetResult> {
        try {
            console.log(`Creating tokenized asset: ${name} (${symbol})`)

            const params = new ContractFunctionParameters()
                .addString(name)
                .addString(symbol)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(5_000_000) // Increased gas limit to 5M
                .setPayableAmount(new Hbar(10)) // ~$1.68 USD buffer for HTS fees
                .setFunction('createTokenizedAsset', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get the token address from contract events or query
            // For now, we'll query the contract to get the token address
            const tokenAddress = await this.getTokenAddress(name)

            return {
                success: true,
                tokenAddress,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error: any) {
            console.error('Error creating tokenized asset:', error)
            return {
                success: false,
                error: error.message || 'Failed to create tokenized asset'
            }
        }
    }

    /**
     * Mint tokens for a grove
     */
    async mintTokens(groveName: string, amount: number): Promise<{ success: boolean; error?: string; transactionId?: string }> {
        try {
            console.log(`Minting ${amount} tokens for grove: ${groveName}`)

            const tokenAmount = Math.floor(amount)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addUint64(tokenAmount)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('mint', params)

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

        } catch (error: any) {
            console.error('Error minting tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint tokens'
            }
        }
    }

    /**
     * Grant KYC to an account for a specific grove token
     */
    async grantKYC(groveName: string, accountAddress: string): Promise<{ success: boolean; error?: string; transactionId?: string }> {
        try {
            console.log(`Granting KYC for ${accountAddress} on grove: ${groveName}`)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addAddress(accountAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('grantKYC', params)

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

        } catch (error: any) {
            console.error('Error granting KYC:', error)
            return {
                success: false,
                error: error.message || 'Failed to grant KYC'
            }
        }
    }

    /**
     * Get token address for a grove by name
     */
    async getTokenAddress(groveName: string): Promise<string> {
        try {
            const params = new ContractFunctionParameters()
                .addString(groveName)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getTokenAddress', params)

            const result = await query.execute(this.client)
            const tokenAddress = result.getAddress(0)
            
            return tokenAddress

        } catch (error) {
            console.error('Error getting token address:', error)
            return ''
        }
    }

    /**
     * Get manager contract address for a grove
     */
    async getManagerAddress(groveName: string): Promise<string> {
        try {
            const params = new ContractFunctionParameters()
                .addString(groveName)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getManagerAddress', params)

            const result = await query.execute(this.client)
            const managerAddress = result.getAddress(0)
            
            return managerAddress

        } catch (error) {
            console.error('Error getting manager address:', error)
            return ''
        }
    }

    /**
     * Get reserve contract address for a grove
     */
    async getReserveAddress(groveName: string): Promise<string> {
        try {
            const params = new ContractFunctionParameters()
                .addString(groveName)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getReserveAddress', params)

            const result = await query.execute(this.client)
            const reserveAddress = result.getAddress(0)
            
            return reserveAddress

        } catch (error) {
            console.error('Error getting reserve address:', error)
            return ''
        }
    }
}

export default IssuerContract
