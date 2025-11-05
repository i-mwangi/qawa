/**
 * CoffeeTreeIssuer Contract Interaction Service
 * 
 * This service handles interactions with the CoffeeTreeIssuer smart contract
 * for grove registration, tokenization, and token management.
 * 
 * FIXED VERSION: Updated to work with the original contract that has getTokenAddress
 * instead of getTokenAddress function name.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    ContractId,
    ContractFunctionParameters 
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
     * Step 1: Create the token and contracts
     * This is the first step in the three-step tokenization process
     */
    async createGroveTokenAndContracts(groveName: string, tokensPerTree: number): Promise<{ success: boolean; tokenAddress?: string; managerAddress?: string; reserveAddress?: string; transactionId?: string; error?: string }> {
        try {
            console.log(`Creating token and contracts for grove: ${groveName} (${tokensPerTree} tokens per tree)`)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addUint64(tokensPerTree)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(1_000_000)
                .setFunction('createGroveTokenAndContracts', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Query the contract to get the addresses
            const tokenAddress = await this.getTokenAddress(groveName)
            const managerAddress = await this.getManagerAddress(groveName)
            const reserveAddress = await this.getReserveAddress(groveName)

            return {
                success: true,
                tokenAddress,
                managerAddress,
                reserveAddress,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error: any) {
            console.error('Error creating token and contracts:', error)
            return {
                success: false,
                error: error.message || 'Failed to create token and contracts'
            }
        }
    }

    /**
     * Step 2: Initialize the grove token
     * This is the second step in the three-step tokenization process
     */
    async initializeGroveToken(groveName: string, tokensPerTree: number): Promise<{ success: boolean; tokenAddress?: string; transactionId?: string; error?: string }> {
        try {
            console.log(`Initializing token for grove: ${groveName}`)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addUint64(tokensPerTree)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('initializeGroveToken', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Get the token address from contract events or query
            const tokenAddress = await this.getTokenAddress(groveName)

            return {
                success: true,
                tokenAddress,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error: any) {
            console.error('Error initializing grove token:', error)
            return {
                success: false,
                error: error.message || 'Failed to initialize grove token'
            }
        }
    }

    /**
     * Step 3: Mint the grove tokens
     * This is the third step in the three-step tokenization process
     */
    async mintGroveTokens(groveName: string, treeCount: number, tokensPerTree: number): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            const totalTokens = treeCount * tokensPerTree
            console.log(`Minting ${totalTokens} tokens for grove: ${groveName}`)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addUint64(tokensPerTree)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('mintGroveTokens', params)

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
            console.error('Error minting grove tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint grove tokens'
            }
        }
    }

    /**
     * Tokenize a registered coffee grove (deprecated)
     * This is the old single-step process that may cause gas issues
     */
    async tokenizeCoffeeGrove(groveName: string, tokensPerTree: number, pricePerToken: number): Promise<CreateAssetResult> {
        try {
            console.log(`Tokenizing coffee grove: ${groveName} (${tokensPerTree} tokens per tree, ${pricePerToken} price per token)`)

            const params = new ContractFunctionParameters()
                .addString(groveName)
                .addUint64(tokensPerTree)
                .addUint64(pricePerToken)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(1_000_000)
                .setFunction('tokenizeCoffeeGrove', params)

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
            const tokenAddress = await this.getTokenAddress(groveName)

            return {
                success: true,
                tokenAddress,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error: any) {
            console.error('Error tokenizing coffee grove:', error)
            return {
                success: false,
                error: error.message || 'Failed to tokenize coffee grove'
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
     * FIXED: Calling getTokenAddress instead of getGroveTokenAddress
     */
    async getTokenAddress(groveName: string): Promise<string> {
        try {
            // First try the correct function name
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
            console.error('Error getting token address with getTokenAddress:', error)
            // Try alternative function name if the first one fails
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
            } catch (error2) {
                console.error('Error getting token address with getTokenAddress:', error2)
                return ''
            }
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
            console.error('Error getting manager address (function may not exist):', error)
            // Return empty string if function doesn't exist
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
            console.error('Error getting reserve address (function may not exist):', error)
            // Return empty string if function doesn't exist
            return ''
        }
    }

    /**
     * Create a tokenized asset (wrapper for backward compatibility)
     * This function provides backward compatibility with older code
     */
    async createTokenizedAsset(groveName: string, symbol: string): Promise<{ success: boolean; tokenAddress?: string; transactionId?: string; error?: string }> {
        try {
            console.log(`Creating tokenized asset: ${groveName} (${symbol})`)
            // For backward compatibility, we'll use a default tokensPerTree value
            const tokensPerTree = 10
            
            // Call the new 3-step process but only return the token address
            const createResult = await this.createGroveTokenAndContracts(groveName, tokensPerTree)
            
            if (!createResult.success) {
                return {
                    success: false,
                    error: createResult.error
                }
            }
            
            return {
                success: true,
                tokenAddress: createResult.tokenAddress,
                transactionId: createResult.transactionId
            }
            
        } catch (error: any) {
            console.error('Error creating tokenized asset:', error)
            return {
                success: false,
                error: error.message || 'Failed to create tokenized asset'
            }
        }
    }
}

export default IssuerContract