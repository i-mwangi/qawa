import axios from 'axios'
import { getClient, getEnv } from '../utils.js'
import { 
    ContractExecuteTransaction, 
    ContractFunctionParameters,
    ContractCallQuery
} from '@hashgraph/sdk'
import { CoffeePriceScraper } from './coffee-price-scraper.js'

// Coffee market data interfaces
export interface CoffeeMarketPrice {
    variety: CoffeeVariety
    grade: number
    pricePerKg: number
    currency: string
    timestamp: Date
    source: string
    region?: string
}

export interface MarketAlert {
    variety: CoffeeVariety
    grade: number
    alertType: 'PRICE_SPIKE' | 'PRICE_DROP' | 'VOLATILITY' | 'SEASONAL_CHANGE'
    currentPrice: number
    previousPrice: number
    changePercent: number
    timestamp: Date
    message: string
}

export interface PriceHistoryEntry {
    variety: CoffeeVariety
    grade: number
    price: number
    timestamp: Date
    source: string
}

export enum CoffeeVariety {
    ARABICA = 0,
    ROBUSTA = 1,
    SPECIALTY = 2,
    ORGANIC = 3
}

export interface MarketCondition {
    variety: CoffeeVariety
    trend: 'BULLISH' | 'BEARISH' | 'STABLE'
    volatility: number
    recommendation: string
    confidence: number
}

// External API configurations
const COFFEE_APIS = {
    ICE: {
        baseUrl: 'https://api.ice.com/v1',
        endpoints: {
            arabica: '/futures/coffee-c',
            robusta: '/futures/coffee-robusta'
        },
        apiKey: process.env.ICE_API_KEY
    },
    CME: {
        baseUrl: 'https://api.cmegroup.com/v1',
        endpoints: {
            coffee: '/market-data/coffee'
        },
        apiKey: process.env.CME_API_KEY
    },
    COFFEE_EXCHANGE: {
        baseUrl: 'https://api.coffeeexchange.com/v2',
        endpoints: {
            prices: '/prices',
            historical: '/historical'
        },
        apiKey: process.env.COFFEE_EXCHANGE_API_KEY
    }
}

export class CoffeeMarketProvider {
    private client = getClient()
    private admin = getEnv()
    private contractId: string
    private priceHistory: Map<string, PriceHistoryEntry[]> = new Map()
    private alertThresholds = {
        priceChangePercent: 5, // Alert if price changes more than 5%
        volatilityThreshold: 10 // Alert if volatility exceeds 10%
    }
    private alertSubscribers: ((alert: MarketAlert) => void)[] = []
    private scraper: CoffeePriceScraper

    constructor(contractId: string) {
        this.contractId = contractId
        this.scraper = new CoffeePriceScraper()
        this.initializePriceHistory()
    }

    /**
     * Initialize price history from stored data
     */
    private async initializePriceHistory() {
        // In a real implementation, this would load from database
        console.log('Initializing coffee price history...')
        
        // Initialize with some sample data for each variety
        Object.values(CoffeeVariety).forEach(variety => {
            if (typeof variety === 'number') {
                const key = `${variety}-1`
                this.priceHistory.set(key, [])
            }
        })
    }

    /**
     * Subscribe to market alerts
     */
    public subscribeToAlerts(callback: (alert: MarketAlert) => void) {
        this.alertSubscribers.push(callback)
    }

    /**
     * Unsubscribe from market alerts
     */
    public unsubscribeFromAlerts(callback: (alert: MarketAlert) => void) {
        const index = this.alertSubscribers.indexOf(callback)
        if (index > -1) {
            this.alertSubscribers.splice(index, 1)
        }
    }

    /**
     * Emit alert to all subscribers
     */
    private emitAlert(alert: MarketAlert) {
        this.alertSubscribers.forEach(callback => {
            try {
                callback(alert)
            } catch (error) {
                console.error('Error in alert callback:', error)
            }
        })
    }

    /**
     * Fetch coffee prices from ICE (Intercontinental Exchange)
     */
    private async fetchICEPrices(): Promise<CoffeeMarketPrice[]> {
        const prices: CoffeeMarketPrice[] = []
        
        try {
            // Fetch Arabica prices (Coffee C futures)
            if (COFFEE_APIS.ICE.apiKey) {
                const arabicaResponse = await axios.get(
                    `${COFFEE_APIS.ICE.baseUrl}${COFFEE_APIS.ICE.endpoints.arabica}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${COFFEE_APIS.ICE.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                )

                if (arabicaResponse.data && arabicaResponse.data.price) {
                    prices.push({
                        variety: CoffeeVariety.ARABICA,
                        grade: 1,
                        pricePerKg: arabicaResponse.data.price * 2.20462, // Convert from cents/lb to $/kg
                        currency: 'USD',
                        timestamp: new Date(),
                        source: 'ICE',
                        region: 'Global'
                    })
                }

                // Fetch Robusta prices
                const robustaResponse = await axios.get(
                    `${COFFEE_APIS.ICE.baseUrl}${COFFEE_APIS.ICE.endpoints.robusta}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${COFFEE_APIS.ICE.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                )

                if (robustaResponse.data && robustaResponse.data.price) {
                    prices.push({
                        variety: CoffeeVariety.ROBUSTA,
                        grade: 1,
                        pricePerKg: robustaResponse.data.price * 2.20462,
                        currency: 'USD',
                        timestamp: new Date(),
                        source: 'ICE',
                        region: 'Global'
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching ICE prices:', error)
            // Return fallback prices if API fails
            prices.push(...this.getFallbackPrices('ICE'))
        }

        return prices
    }

    /**
     * Fetch coffee prices from CME Group
     */
    private async fetchCMEPrices(): Promise<CoffeeMarketPrice[]> {
        const prices: CoffeeMarketPrice[] = []
        
        try {
            if (COFFEE_APIS.CME.apiKey) {
                const response = await axios.get(
                    `${COFFEE_APIS.CME.baseUrl}${COFFEE_APIS.CME.endpoints.coffee}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${COFFEE_APIS.CME.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                )

                if (response.data && response.data.contracts) {
                    response.data.contracts.forEach((contract: any) => {
                        if (contract.lastPrice) {
                            prices.push({
                                variety: contract.product === 'ARABICA' ? CoffeeVariety.ARABICA : CoffeeVariety.ROBUSTA,
                                grade: 1,
                                pricePerKg: contract.lastPrice * 2.20462,
                                currency: 'USD',
                                timestamp: new Date(contract.timestamp),
                                source: 'CME',
                                region: 'Global'
                            })
                        }
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching CME prices:', error)
            prices.push(...this.getFallbackPrices('CME'))
        }

        return prices
    }

    /**
     * Fetch coffee prices from Coffee Exchange API
     */
    private async fetchCoffeeExchangePrices(): Promise<CoffeeMarketPrice[]> {
        const prices: CoffeeMarketPrice[] = []
        
        try {
            if (COFFEE_APIS.COFFEE_EXCHANGE.apiKey) {
                const response = await axios.get(
                    `${COFFEE_APIS.COFFEE_EXCHANGE.baseUrl}${COFFEE_APIS.COFFEE_EXCHANGE.endpoints.prices}`,
                    {
                        headers: {
                            'X-API-Key': COFFEE_APIS.COFFEE_EXCHANGE.apiKey,
                            'Content-Type': 'application/json'
                        },
                        params: {
                            varieties: 'arabica,robusta,specialty,organic',
                            regions: 'global,central-america,south-america,africa,asia'
                        },
                        timeout: 10000
                    }
                )

                if (response.data && response.data.prices) {
                    response.data.prices.forEach((priceData: any) => {
                        const variety = this.mapVarietyString(priceData.variety)
                        if (variety !== undefined) {
                            prices.push({
                                variety,
                                grade: priceData.grade || 1,
                                pricePerKg: priceData.pricePerKg,
                                currency: priceData.currency || 'USD',
                                timestamp: new Date(priceData.timestamp),
                                source: 'CoffeeExchange',
                                region: priceData.region
                            })
                        }
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching Coffee Exchange prices:', error)
            prices.push(...this.getFallbackPrices('CoffeeExchange'))
        }

        return prices
    }

    /**
     * Map variety string to enum
     */
    private mapVarietyString(varietyStr: string): CoffeeVariety | undefined {
        switch (varietyStr.toLowerCase()) {
            case 'arabica': return CoffeeVariety.ARABICA
            case 'robusta': return CoffeeVariety.ROBUSTA
            case 'specialty': return CoffeeVariety.SPECIALTY
            case 'organic': return CoffeeVariety.ORGANIC
            default: return undefined
        }
    }

    /**
     * Get fallback prices when APIs fail
     */
    private getFallbackPrices(source: string): CoffeeMarketPrice[] {
        const timestamp = new Date()
        return [
            {
                variety: CoffeeVariety.ARABICA,
                grade: 1,
                pricePerKg: 4.50, // Fallback price
                currency: 'USD',
                timestamp,
                source: `${source}_FALLBACK`,
                region: 'Global'
            },
            {
                variety: CoffeeVariety.ROBUSTA,
                grade: 1,
                pricePerKg: 2.80,
                currency: 'USD',
                timestamp,
                source: `${source}_FALLBACK`,
                region: 'Global'
            }
        ]
    }

    /**
     * Fetch prices using web scraping (fallback method)
     */
    private async fetchScrapedPrices(): Promise<CoffeeMarketPrice[]> {
        const prices: CoffeeMarketPrice[] = []
        
        try {
            console.log('Fetching prices via web scraping...')
            const scrapedPrices = await this.scraper.fetchAllPrices()
            
            scrapedPrices.forEach(scraped => {
                const variety = this.mapVarietyString(scraped.variety)
                if (variety !== undefined) {
                    prices.push({
                        variety,
                        grade: 1,
                        pricePerKg: scraped.price,
                        currency: 'USD',
                        timestamp: scraped.timestamp,
                        source: scraped.source,
                        region: 'Global'
                    })
                }
            })
            
            console.log(`Successfully scraped ${prices.length} prices`)
        } catch (error) {
            console.error('Error fetching scraped prices:', error)
        }
        
        return prices
    }

    /**
     * Fetch all coffee prices from multiple sources
     */
    public async fetchAllPrices(): Promise<CoffeeMarketPrice[]> {
        const allPrices: CoffeeMarketPrice[] = []

        // Try API sources first (if API keys are configured)
        const hasApiKeys = COFFEE_APIS.ICE.apiKey || COFFEE_APIS.CME.apiKey || COFFEE_APIS.COFFEE_EXCHANGE.apiKey
        
        if (hasApiKeys) {
            // Fetch from all sources in parallel
            const [icePrices, cmePrices, exchangePrices] = await Promise.allSettled([
                this.fetchICEPrices(),
                this.fetchCMEPrices(),
                this.fetchCoffeeExchangePrices()
            ])

            // Collect successful results
            if (icePrices.status === 'fulfilled') {
                allPrices.push(...icePrices.value)
            }
            if (cmePrices.status === 'fulfilled') {
                allPrices.push(...cmePrices.value)
            }
            if (exchangePrices.status === 'fulfilled') {
                allPrices.push(...exchangePrices.value)
            }
        }

        // If no API prices were fetched, use web scraping
        if (allPrices.length === 0) {
            console.log('No API keys configured, using web scraping...')
            const scrapedPrices = await this.fetchScrapedPrices()
            allPrices.push(...scrapedPrices)
        }

        // If scraping also failed, use fallback prices
        if (allPrices.length === 0) {
            console.log('Web scraping failed, using fallback prices')
            allPrices.push(...this.getFallbackPrices('FALLBACK'))
        }

        // Update price history and check for alerts
        this.updatePriceHistory(allPrices)
        this.checkForAlerts(allPrices)

        return allPrices
    }

    /**
     * Update price history with new prices
     */
    private updatePriceHistory(prices: CoffeeMarketPrice[]) {
        prices.forEach(price => {
            const key = `${price.variety}-${price.grade}`
            const history = this.priceHistory.get(key) || []
            
            const entry: PriceHistoryEntry = {
                variety: price.variety,
                grade: price.grade,
                price: price.pricePerKg,
                timestamp: price.timestamp,
                source: price.source
            }

            history.push(entry)
            
            // Keep only last 1000 entries
            if (history.length > 1000) {
                history.splice(0, history.length - 1000)
            }
            
            this.priceHistory.set(key, history)
        })
    }

    /**
     * Check for price alerts and market conditions
     */
    private checkForAlerts(currentPrices: CoffeeMarketPrice[]) {
        currentPrices.forEach(price => {
            const key = `${price.variety}-${price.grade}`
            const history = this.priceHistory.get(key) || []
            
            if (history.length > 0) {
                const previousPrice = history[history.length - 1]?.price
                if (previousPrice) {
                    const changePercent = ((price.pricePerKg - previousPrice) / previousPrice) * 100
                    
                    // Check for significant price changes
                    if (Math.abs(changePercent) >= this.alertThresholds.priceChangePercent) {
                        const alert: MarketAlert = {
                            variety: price.variety,
                            grade: price.grade,
                            alertType: changePercent > 0 ? 'PRICE_SPIKE' : 'PRICE_DROP',
                            currentPrice: price.pricePerKg,
                            previousPrice,
                            changePercent,
                            timestamp: new Date(),
                            message: `${CoffeeVariety[price.variety]} price ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(2)}%`
                        }
                        
                        this.emitAlert(alert)
                    }
                    
                    // Check for volatility
                    const volatility = this.calculateVolatility(history.slice(-20)) // Last 20 data points
                    if (volatility > this.alertThresholds.volatilityThreshold) {
                        const alert: MarketAlert = {
                            variety: price.variety,
                            grade: price.grade,
                            alertType: 'VOLATILITY',
                            currentPrice: price.pricePerKg,
                            previousPrice,
                            changePercent,
                            timestamp: new Date(),
                            message: `High volatility detected for ${CoffeeVariety[price.variety]} (${volatility.toFixed(2)}%)`
                        }
                        
                        this.emitAlert(alert)
                    }
                }
            }
        })
    }

    /**
     * Calculate price volatility
     */
    private calculateVolatility(history: PriceHistoryEntry[]): number {
        if (history.length < 2) return 0
        
        const prices = history.map(h => h.price)
        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
        
        return Math.sqrt(variance) / mean * 100 // Return as percentage
    }

    /**
     * Get price history for a specific variety and grade
     */
    public getPriceHistory(variety: CoffeeVariety, grade: number = 1): PriceHistoryEntry[] {
        const key = `${variety}-${grade}`
        return this.priceHistory.get(key) || []
    }

    /**
     * Get current market conditions and recommendations
     */
    public getMarketConditions(variety: CoffeeVariety, grade: number = 1): MarketCondition {
        const history = this.getPriceHistory(variety, grade)
        
        if (history.length < 10) {
            return {
                variety,
                trend: 'STABLE',
                volatility: 0,
                recommendation: 'Insufficient data for analysis',
                confidence: 0
            }
        }

        const recentPrices = history.slice(-10).map(h => h.price)
        const olderPrices = history.slice(-20, -10).map(h => h.price)
        
        const recentAvg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length
        const olderAvg = olderPrices.reduce((sum, p) => sum + p, 0) / olderPrices.length
        
        const trendChange = (recentAvg - olderAvg) / olderAvg * 100
        const volatility = this.calculateVolatility(history.slice(-20))
        
        let trend: 'BULLISH' | 'BEARISH' | 'STABLE'
        let recommendation: string
        let confidence: number
        
        if (trendChange > 2) {
            trend = 'BULLISH'
            recommendation = 'Consider holding or buying - prices trending upward'
            confidence = Math.min(Math.abs(trendChange) * 10, 100)
        } else if (trendChange < -2) {
            trend = 'BEARISH'
            recommendation = 'Consider selling - prices trending downward'
            confidence = Math.min(Math.abs(trendChange) * 10, 100)
        } else {
            trend = 'STABLE'
            recommendation = 'Market is stable - good time for long-term planning'
            confidence = 100 - volatility
        }

        return {
            variety,
            trend,
            volatility,
            recommendation,
            confidence: Math.max(0, Math.min(100, confidence))
        }
    }

    /**
     * Update smart contract with latest prices
     */
    public async updateContractPrices(prices: CoffeeMarketPrice[]): Promise<boolean> {
        try {
            // Group prices by variety for batch update
            const pricesByVariety = new Map<CoffeeVariety, CoffeeMarketPrice>()
            
            prices.forEach(price => {
                const existing = pricesByVariety.get(price.variety)
                if (!existing || price.timestamp > existing.timestamp) {
                    pricesByVariety.set(price.variety, price)
                }
            })

            // Update contract for each variety
            for (const [variety, price] of pricesByVariety) {
                const transaction = new ContractExecuteTransaction()
                    .setContractId(this.contractId)
                    .setGas(100000)
                    .setFunction(
                        'updateCoffeePrice',
                        new ContractFunctionParameters()
                            .addUint8(variety)
                            .addUint64(Math.round(price.pricePerKg * 100)) // Convert to cents
                            .addString(price.source)
                    )

                const response = await transaction.execute(this.client)
                const receipt = await response.getReceipt(this.client)
                
                if (receipt.status.toString() !== 'SUCCESS') {
                    console.error(`Failed to update price for variety ${variety}`)
                    return false
                }
            }

            console.log(`Successfully updated prices for ${pricesByVariety.size} varieties`)
            return true
            
        } catch (error) {
            console.error('Error updating contract prices:', error)
            return false
        }
    }

    /**
     * Validate price against market rates
     */
    public validatePrice(variety: CoffeeVariety, grade: number, reportedPrice: number): {
        isValid: boolean
        deviation: number
        marketPrice: number
        message: string
    } {
        const history = this.getPriceHistory(variety, grade)
        
        if (history.length === 0) {
            return {
                isValid: true,
                deviation: 0,
                marketPrice: reportedPrice,
                message: 'No market data available for validation'
            }
        }

        const latestPrice = history[history.length - 1].price
        const deviation = Math.abs((reportedPrice - latestPrice) / latestPrice * 100)
        
        const isValid = deviation <= 20 // Allow 20% deviation
        
        return {
            isValid,
            deviation,
            marketPrice: latestPrice,
            message: isValid 
                ? 'Price is within acceptable market range'
                : `Price deviates ${deviation.toFixed(2)}% from market rate`
        }
    }

    /**
     * Start automatic price updates
     */
    public startPriceUpdates(intervalMinutes: number = 30) {
        const updatePrices = async () => {
            try {
                console.log('Fetching latest coffee prices...')
                const prices = await this.fetchAllPrices()
                
                if (prices.length > 0) {
                    await this.updateContractPrices(prices)
                    console.log(`Updated ${prices.length} prices successfully`)
                } else {
                    console.warn('No prices fetched from any source')
                }
            } catch (error) {
                console.error('Error in automatic price update:', error)
            }
        }

        // Initial update
        updatePrices()
        
        // Schedule regular updates
        setInterval(updatePrices, intervalMinutes * 60 * 1000)
        console.log(`Started automatic price updates every ${intervalMinutes} minutes`)
    }
}
                