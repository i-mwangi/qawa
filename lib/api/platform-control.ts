/**
 * Platform Control Contract Interaction Service
 * 
 * This service handles all interactions with the PlatformControl smart contract
 * for administrative platform management including pause controls and emergency shutdowns.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'

interface ControlActionResult {
    success: boolean
    transactionId?: string
    error?: string
}

interface PlatformStatusResult {
    success: boolean
    tradingPaused?: boolean
    groveRegistrationPaused?: boolean
    harvestReportingPaused?: boolean
    tokenPurchasePaused?: boolean
    error?: string
}

interface ContractAddressesResult {
    success: boolean
    issuerContract?: string
    marketplaceContract?: string
    error?: string
}

export class PlatformControlContract {
    private contractId: ContractId
    private client: any // Hedera client instance

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Set the issuer contract address
     */
    async setIssuerContract(issuerAddress: string): Promise<ControlActionResult> {
        try {
            console.log(`Setting issuer contract to: ${issuerAddress}`)

            const params = new ContractFunctionParameters()
                .addAddress(issuerAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('setIssuerContract', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('Issuer contract address updated successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to set issuer contract:', error)
            return {
                success: false,
                error: error.message || 'Failed to set issuer contract address'
            }
        }
    }

    /**
     * Set the marketplace contract address
     */
    async setMarketplaceContract(marketplaceAddress: string): Promise<ControlActionResult> {
        try {
            console.log(`Setting marketplace contract to: ${marketplaceAddress}`)

            const params = new ContractFunctionParameters()
                .addAddress(marketplaceAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('setMarketplaceContract', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('Marketplace contract address updated successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to set marketplace contract:', error)
            return {
                success: false,
                error: error.message || 'Failed to set marketplace contract address'
            }
        }
    }

    /**
     * Pause trading on the platform
     */
    async pauseTrading(): Promise<ControlActionResult> {
        return this._executeControlFunction('pauseTrading', 'Trading paused')
    }

    /**
     * Resume trading on the platform
     */
    async resumeTrading(): Promise<ControlActionResult> {
        return this._executeControlFunction('resumeTrading', 'Trading resumed')
    }

    /**
     * Pause grove registration
     */
    async pauseGroveRegistration(): Promise<ControlActionResult> {
        return this._executeControlFunction('pauseGroveRegistration', 'Grove registration paused')
    }

    /**
     * Resume grove registration
     */
    async resumeGroveRegistration(): Promise<ControlActionResult> {
        return this._executeControlFunction('resumeGroveRegistration', 'Grove registration resumed')
    }

    /**
     * Pause harvest reporting
     */
    async pauseHarvestReporting(): Promise<ControlActionResult> {
        return this._executeControlFunction('pauseHarvestReporting', 'Harvest reporting paused')
    }

    /**
     * Resume harvest reporting
     */
    async resumeHarvestReporting(): Promise<ControlActionResult> {
        return this._executeControlFunction('resumeHarvestReporting', 'Harvest reporting resumed')
    }

    /**
     * Pause token purchases
     */
    async pauseTokenPurchase(): Promise<ControlActionResult> {
        return this._executeControlFunction('pauseTokenPurchase', 'Token purchases paused')
    }

    /**
     * Resume token purchases
     */
    async resumeTokenPurchase(): Promise<ControlActionResult> {
        return this._executeControlFunction('resumeTokenPurchase', 'Token purchases resumed')
    }

    /**
     * Emergency shutdown - pauses all platform operations
     */
    async emergencyShutdown(): Promise<ControlActionResult> {
        return this._executeControlFunction('emergencyShutdown', 'Emergency shutdown activated')
    }

    /**
     * Emergency resume - resumes all platform operations
     */
    async emergencyResume(): Promise<ControlActionResult> {
        return this._executeControlFunction('emergencyResume', 'Platform operations resumed')
    }

    /**
     * Get current platform status
     */
    async getPlatformStatus(): Promise<PlatformStatusResult> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getPlatformStatus')

            const result = await query.execute(this.client)

            return {
                success: true,
                tradingPaused: result.getBool(0),
                groveRegistrationPaused: result.getBool(1),
                harvestReportingPaused: result.getBool(2),
                tokenPurchasePaused: result.getBool(3)
            }
        } catch (error: any) {
            console.error('Failed to get platform status:', error)
            return {
                success: false,
                error: error.message || 'Failed to get platform status'
            }
        }
    }

    /**
     * Check if trading is allowed
     */
    async isTradingAllowed(): Promise<boolean> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('isTradingAllowed')

            const result = await query.execute(this.client)
            return result.getBool(0)
        } catch (error) {
            console.error('Failed to check trading status:', error)
            return false
        }
    }

    /**
     * Check if grove registration is allowed
     */
    async isGroveRegistrationAllowed(): Promise<boolean> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('isGroveRegistrationAllowed')

            const result = await query.execute(this.client)
            return result.getBool(0)
        } catch (error) {
            console.error('Failed to check grove registration status:', error)
            return false
        }
    }

    /**
     * Check if harvest reporting is allowed
     */
    async isHarvestReportingAllowed(): Promise<boolean> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('isHarvestReportingAllowed')

            const result = await query.execute(this.client)
            return result.getBool(0)
        } catch (error) {
            console.error('Failed to check harvest reporting status:', error)
            return false
        }
    }

    /**
     * Check if token purchase is allowed
     */
    async isTokenPurchaseAllowed(): Promise<boolean> {
        try {
            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('isTokenPurchaseAllowed')

            const result = await query.execute(this.client)
            return result.getBool(0)
        } catch (error) {
            console.error('Failed to check token purchase status:', error)
            return false
        }
    }

    /**
     * Transfer admin role to a new address
     */
    async transferAdmin(newAdminAddress: string): Promise<ControlActionResult> {
        try {
            console.log(`Transferring admin role to: ${newAdminAddress}`)

            const params = new ContractFunctionParameters()
                .addAddress(newAdminAddress)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('transferAdmin', params)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log('Admin role transferred successfully')

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error('Failed to transfer admin:', error)
            return {
                success: false,
                error: error.message || 'Failed to transfer admin role'
            }
        }
    }

    /**
     * Execute a control function (helper method)
     */
    private async _executeControlFunction(functionName: string, successMessage: string): Promise<ControlActionResult> {
        try {
            console.log(`Executing ${functionName}...`)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction(functionName)

            const response = await transaction.execute(this.client)
            await response.getReceipt(this.client)

            console.log(successMessage)

            return {
                success: true,
                transactionId: response.transactionId.toString()
            }
        } catch (error: any) {
            console.error(`Failed to execute ${functionName}:`, error)
            return {
                success: false,
                error: error.message || `Failed to execute ${functionName}`
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
let platformControlInstance: PlatformControlContract | null = null

export function getPlatformControlContract(contractAddress: string, client: any): PlatformControlContract {
    if (!platformControlInstance) {
        platformControlInstance = new PlatformControlContract(contractAddress, client)
    }
    return platformControlInstance
}
