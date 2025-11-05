/**
 * USDC Contract Interaction Service
 * 
 * This service handles all interactions with the USDC stablecoin contract
 * including minting, burning, transfers, and airdrops for testing.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'

interface AirdropResult {
    success: boolean
    amount?: number
    transactionId?: string
    error?: string
}

interface TransferResult {
    success: boolean
    transactionId?: string
    error?: string
}

interface TokenInfoResult {
    success: boolean
    tokenAddress?: string
    error?: string
}

export class USDCContract {
    private contractId: ContractId
    private client: any // Hedera client instance
    private tokenAddress: string | null = null

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Initialize the USDC token (admin only, called once during deployment)
     */
    async initialize(): Promise<TokenInfoResult> {
        try {
            console.log('Initializing USDC token contract...')

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(1_000_000)
                .setFunction('initialize')
                .setPayableAmount(20) // 20 HBAR for token creation

            const response = await transaction.execute(this.client)
            const receipt = await response.getReceipt(this.client)

            console.log('USDC token initialized successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to initialize USDC token:', error)
            return {
                success: false,
                error: error.message || 'Failed to initialize USDC token'
            }
        }
    }

    /**
     * Get the USDC token address from the contract
     */
    async getTokenAddress(): Promise<string | null> {
        if (this.tokenAddress) {
            return this.tokenAddress
        }

        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getToken')

            const result = await query.execute(this.client)
            const tokenAddress = result.getAddress(0)
            
            this.tokenAddress = tokenAddress
            return tokenAddress
        } catch (error) {
            console.error('Failed to get USDC token address:', error)
            return null
        }
    }

    /**
     * Request USDC airdrop for testing purposes
     * This mints new USDC and sends it to the requester
     */
    async requestAirdrop(amount: number, recipientAccountId?: string): Promise<AirdropResult> {
        try {
            console.log(`Requesting USDC airdrop: ${amount} USDC`)

            // Convert amount to smallest unit (6 decimals for USDC)
            const amountInSmallestUnit = Math.floor(amount * 1_000_000)

            const params = new ContractFunctionParameters()
                .addUint64(amountInSmallestUnit)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(500_000)
                .setFunction('requestAirdrop', params)

            const response = await transaction.execute(this.client)
            const receipt = await response.getReceipt(this.client)

            console.log(`USDC airdrop successful: ${amount} USDC`)

            return {
                success: true,
                amount: amount,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('USDC airdrop failed:', error)
            return {
                success: false,
                error: error.message || 'Failed to request USDC airdrop'
            }
        }
    }

    /**
     * Mint USDC tokens (admin only)
     */
    async mint(amount: number): Promise<TransferResult> {
        try {
            console.log(`Minting USDC: ${amount}`)

            const amountInSmallestUnit = Math.floor(amount * 1_000_000)

            const params = new ContractFunctionParameters()
                .addInt64(amountInSmallestUnit)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('mint', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('USDC minted successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to mint USDC:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint USDC'
            }
        }
    }

    /**
     * Burn USDC tokens (admin only)
     */
    async burn(amount: number): Promise<TransferResult> {
        try {
            console.log(`Burning USDC: ${amount}`)

            const amountInSmallestUnit = Math.floor(amount * 1_000_000)

            const params = new ContractFunctionParameters()
                .addInt64(amountInSmallestUnit)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(300_000)
                .setFunction('burn', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('USDC burned successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to burn USDC:', error)
            return {
                success: false,
                error: error.message || 'Failed to burn USDC'
            }
        }
    }

    /**
     * Transfer USDC from one account to another
     */
    async transfer(recipient: string, amount: number): Promise<TransferResult> {
        try {
            console.log(`Transferring ${amount} USDC to ${recipient}`)

            const amountInSmallestUnit = Math.floor(amount * 1_000_000)

            const params = new ContractFunctionParameters()
                .addAddress(recipient)
                .addUint64(amountInSmallestUnit)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(400_000)
                .setFunction('transfer', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('USDC transfer successful')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to transfer USDC:', error)
            return {
                success: false,
                error: error.message || 'Failed to transfer USDC'
            }
        }
    }

    /**
     * Get contract ID
     */
    getContractId(): string {
        return this.contractId.toString()
    }
}

// Export singleton factory
let usdcContractInstance: USDCContract | null = null

export function getUSDCContract(contractAddress: string, client: any): USDCContract {
    if (!usdcContractInstance) {
        usdcContractInstance = new USDCContract(contractAddress, client)
    }
    return usdcContractInstance
}
