/**
 * CoffeePriceOracle Contract Interaction Service
 * 
 * This service handles all interactions with the CoffeePriceOracle smart contract
 * including fetching variety-specific prices, seasonal pricing, and projected revenue calculations.
 */

import { 
    ContractExecuteTransaction, 
    ContractCallQuery, 
    ContractId,
    ContractFunctionParameters 
} from '@hashgraph/sdk'

// Contract ABI for CoffeePriceOracle
const PRICE_ORACLE_ABI = require('../abi/PriceOracle.json').abi

// Coffee variety enum matching the contract
export enum CoffeeVariety {
    ARABICA = 0,
    ROBUSTA = 1,
    SPECIALTY = 2,
    ORGANIC = 3
}

interface CoffeePriceData {
    basePrice: number
    lastUpdated: number
    isActive: boolean
}

interface SeasonalPriceResult {
    price: number
    variety: CoffeeVariety
    grade: number
    month: number
    multiplier: number
}

interface ProjectedRevenueResult {
    projectedRevenue: number
    pricePerKg: number
    expectedYieldKg: number
    variety: CoffeeVariety
    grade: number
    harvestMonth: number
}

interface PriceValidationResult {
    isValid: boolean
    reason: string
    suggestedPrice?: number
}

export class PriceOracleContract {
    private contractId: ContractId
    private client: any // Hedera client instance
    private priceCache: Map<string, { price: number; timestamp: number }> = new Map()
    private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

    constructor(contractAddress: string, client: any) {
        this.contractId = ContractId.fromString(contractAddress)
        this.client = client
    }

    /**
     * Get coffee price for a specific variety and grade
     */
    async getCoffeePrice(variety: CoffeeVariety, grade: number): Promise<number> {
        try {
            // Check cache first
            const cacheKey = `${variety}-${grade}`
            const cached = this.priceCache.get(cacheKey)
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.price
            }

            // Query contract
            const params = new ContractFunctionParameters()
                .addUint8(variety)
                .addUint8(grade)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getCoffeePrice', params)

            const result = await query.execute(this.client)
            
            // Parse result - returns uint64 price
            const priceBigNum = result.getUint64(0)
            const price = typeof priceBigNum === 'number' ? priceBigNum : Number(priceBigNum)
            const priceInUSDC = price / 1_000_000 // Convert from scaled value

            // Update cache
            this.priceCache.set(cacheKey, { price: priceInUSDC, timestamp: Date.now() })

            return priceInUSDC

        } catch (error) {
            console.error('Error getting coffee price:', error)
            throw new Error(`Failed to get coffee price: ${error.message}`)
        }
    }

    /**
     * Get seasonal coffee price with monthly adjustment
     */
    async getSeasonalCoffeePrice(
        variety: CoffeeVariety,
        grade: number,
        month: number
    ): Promise<SeasonalPriceResult> {
        try {
            const params = new ContractFunctionParameters()
                .addUint8(variety)
                .addUint8(grade)
                .addUint8(month)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getSeasonalCoffeePrice', params)

            const result = await query.execute(this.client)
            
            // Parse result - returns uint64 seasonally adjusted price
            const priceBigNum = result.getUint64(0)
            const price = typeof priceBigNum === 'number' ? priceBigNum : Number(priceBigNum)
            const priceInUSDC = price / 1_000_000

            // Get the multiplier for context
            const multiplier = await this.getSeasonalMultiplier(month)

            return {
                price: priceInUSDC,
                variety,
                grade,
                month,
                multiplier
            }

        } catch (error) {
            console.error('Error getting seasonal coffee price:', error)
            throw new Error(`Failed to get seasonal coffee price: ${error.message}`)
        }
    }

    /**
     * Get seasonal multiplier for a specific month
     */
    async getSeasonalMultiplier(month: number): Promise<number> {
        try {
            const params = new ContractFunctionParameters()
                .addUint8(month)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('seasonalMultipliers', params)

            const result = await query.execute(this.client)
            
            // Parse result - returns (uint64 multiplier, bool isSet)
            const multiplierBigNum = result.getUint64(0)
            const multiplier = typeof multiplierBigNum === 'number' ? multiplierBigNum : Number(multiplierBigNum)
            const isSet = result.getBool(1)

            if (!isSet) {
                return 1.0 // Default to 1.0x if not set
            }

            return multiplier / 1000 // Convert from scaled value (1000 = 1.0x)

        } catch (error) {
            console.error('Error getting seasonal multiplier:', error)
            return 1.0 // Default to 1.0x on error
        }
    }

    /**
     * Calculate projected revenue for a coffee grove
     */
    async calculateProjectedRevenue(
        groveTokenAddress: string,
        variety: CoffeeVariety,
        grade: number,
        expectedYieldKg: number,
        harvestMonth: number
    ): Promise<ProjectedRevenueResult> {
        try {
            const params = new ContractFunctionParameters()
                .addAddress(groveTokenAddress)
                .addUint8(variety)
                .addUint8(grade)
                .addUint64(expectedYieldKg)
                .addUint8(harvestMonth)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(150_000)
                .setFunction('calculateProjectedRevenue', params)

            const result = await query.execute(this.client)
            
            // Parse result - returns uint64 projected revenue
            const projectedRevenueBigNum = result.getUint64(0)
            const projectedRevenue = typeof projectedRevenueBigNum === 'number' ? projectedRevenueBigNum : Number(projectedRevenueBigNum)

            // Get the price per kg for context
            const seasonalPrice = await this.getSeasonalCoffeePrice(variety, grade, harvestMonth)

            return {
                projectedRevenue,
                pricePerKg: seasonalPrice.price,
                expectedYieldKg,
                variety,
                grade,
                harvestMonth
            }

        } catch (error) {
            console.error('Error calculating projected revenue:', error)
            throw new Error(`Failed to calculate projected revenue: ${error.message}`)
        }
    }

    /**
     * Get coffee price data including metadata
     */
    async getCoffeePriceData(variety: CoffeeVariety, grade: number): Promise<CoffeePriceData> {
        try {
            const params = new ContractFunctionParameters()
                .addUint8(variety)
                .addUint8(grade)

            const query = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100_000)
                .setFunction('getCoffeePriceData', params)

            const result = await query.execute(this.client)
            
            // Parse result - returns (uint64 price, uint64 lastUpdated, bool isActive)
            const priceBigNum = result.getUint64(0)
            const price = typeof priceBigNum === 'number' ? priceBigNum : Number(priceBigNum)
            const lastUpdatedBigNum = result.getUint64(1)
            const lastUpdated = typeof lastUpdatedBigNum === 'number' ? lastUpdatedBigNum : Number(lastUpdatedBigNum)
            const isActive = result.getBool(2)

            return {
                basePrice: price / 1_000_000,
                lastUpdated,
                isActive
            }

        } catch (error) {
            console.error('Error getting coffee price data:', error)
            throw new Error(`Failed to get coffee price data: ${error.message}`)
        }
    }

    /**
     * Get all prices for a specific variety (grades 1-10)
     */
    async getAllGradePrices(variety: CoffeeVariety): Promise<Map<number, number>> {
        const prices = new Map<number, number>()

        for (let grade = 1; grade <= 10; grade++) {
            try {
                const price = await this.getCoffeePrice(variety, grade)
                prices.set(grade, price)
            } catch (error) {
                console.error(`Error getting price for grade ${grade}:`, error)
                // Continue with other grades
            }
        }

        return prices
    }

    /**
     * Get all seasonal multipliers (months 1-12)
     */
    async getAllSeasonalMultipliers(): Promise<Map<number, number>> {
        const multipliers = new Map<number, number>()

        for (let month = 1; month <= 12; month++) {
            try {
                const multiplier = await this.getSeasonalMultiplier(month)
                multipliers.set(month, multiplier)
            } catch (error) {
                console.error(`Error getting multiplier for month ${month}:`, error)
                multipliers.set(month, 1.0) // Default to 1.0x
            }
        }

        return multipliers
    }

    /**
     * Validate a proposed sale price against market rates
     * Price should be within 50%-200% of market rate
     */
    async validateSalePrice(
        variety: CoffeeVariety,
        grade: number,
        proposedPrice: number,
        harvestMonth?: number
    ): Promise<PriceValidationResult> {
        try {
            let marketPrice: number

            if (harvestMonth) {
                const seasonalPrice = await this.getSeasonalCoffeePrice(variety, grade, harvestMonth)
                marketPrice = seasonalPrice.price
            } else {
                marketPrice = await this.getCoffeePrice(variety, grade)
            }

            const minPrice = marketPrice * 0.5
            const maxPrice = marketPrice * 2.0

            if (proposedPrice < minPrice) {
                return {
                    isValid: false,
                    reason: `Price too low. Minimum acceptable: $${minPrice.toFixed(2)}/kg`,
                    suggestedPrice: marketPrice
                }
            }

            if (proposedPrice > maxPrice) {
                return {
                    isValid: false,
                    reason: `Price too high. Maximum acceptable: $${maxPrice.toFixed(2)}/kg`,
                    suggestedPrice: marketPrice
                }
            }

            return {
                isValid: true,
                reason: 'Price is within acceptable range',
                suggestedPrice: marketPrice
            }

        } catch (error) {
            console.error('Error validating sale price:', error)
            return {
                isValid: false,
                reason: `Validation failed: ${error.message}`
            }
        }
    }

    /**
     * Check if price data is stale (>24 hours old)
     */
    async isPriceStale(variety: CoffeeVariety, grade: number): Promise<boolean> {
        try {
            const priceData = await this.getCoffeePriceData(variety, grade)
            const now = Math.floor(Date.now() / 1000) // Current time in seconds
            const ageInHours = (now - priceData.lastUpdated) / 3600

            return ageInHours > 24

        } catch (error) {
            console.error('Error checking price staleness:', error)
            return true // Assume stale on error
        }
    }

    /**
     * Clear price cache (useful for testing or forced refresh)
     */
    clearCache(): void {
        this.priceCache.clear()
    }

    /**
     * Update coffee price (admin only - for testing/demo purposes)
     */
    async updateCoffeePrice(
        variety: CoffeeVariety,
        grade: number,
        price: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Convert price to uint64 format (scaled by 1,000,000)
            const scaledPrice = Math.floor(price * 1_000_000)

            const params = new ContractFunctionParameters()
                .addUint8(variety)
                .addUint8(grade)
                .addUint64(scaledPrice)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('updateCoffeePrice', params)

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            if (receipt.status.toString() !== 'SUCCESS') {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt.status}`
                }
            }

            // Clear cache for this variety/grade
            const cacheKey = `${variety}-${grade}`
            this.priceCache.delete(cacheKey)

            return {
                success: true,
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error) {
            console.error('Error updating coffee price:', error)
            return {
                success: false,
                error: error.message || 'Failed to update coffee price'
            }
        }
    }

    /**
     * Update seasonal multiplier (admin only - for testing/demo purposes)
     */
    async updateSeasonalMultiplier(
        month: number,
        multiplier: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            // Convert multiplier to uint64 format (scaled by 1000, so 1.2 = 1200)
            const scaledMultiplier = Math.floor(multiplier * 1000)

            const params = new ContractFunctionParameters()
                .addUint8(month)
                .addUint64(scaledMultiplier)

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(200_000)
                .setFunction('updateSeasonalMultiplier', params)

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
            console.error('Error updating seasonal multiplier:', error)
            return {
                success: false,
                error: error.message || 'Failed to update seasonal multiplier'
            }
        }
    }
}

/**
 * Helper function to convert variety name to enum
 */
export function varietyNameToEnum(varietyName: string): CoffeeVariety {
    const normalized = varietyName.toUpperCase()
    switch (normalized) {
        case 'ARABICA':
            return CoffeeVariety.ARABICA
        case 'ROBUSTA':
            return CoffeeVariety.ROBUSTA
        case 'SPECIALTY':
            return CoffeeVariety.SPECIALTY
        case 'ORGANIC':
            return CoffeeVariety.ORGANIC
        default:
            return CoffeeVariety.ARABICA // Default to Arabica
    }
}

/**
 * Helper function to convert enum to variety name
 */
export function varietyEnumToName(variety: CoffeeVariety): string {
    switch (variety) {
        case CoffeeVariety.ARABICA:
            return 'Arabica'
        case CoffeeVariety.ROBUSTA:
            return 'Robusta'
        case CoffeeVariety.SPECIALTY:
            return 'Specialty'
        case CoffeeVariety.ORGANIC:
            return 'Organic'
        default:
            return 'Arabica'
    }
}
