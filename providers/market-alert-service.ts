import { CoffeeMarketProvider, MarketAlert, CoffeeVariety, MarketCondition } from './coffee-market-provider.js'
import { db } from '../db/index.js'
import { farmers, marketAlerts, priceHistory } from '../db/schema/index.js'
import { eq, and, gte, desc } from 'drizzle-orm'

export interface FarmerNotificationPreferences {
    farmerAddress: string
    emailNotifications: boolean
    priceAlerts: boolean
    volatilityAlerts: boolean
    marketConditionAlerts: boolean
    priceChangeThreshold: number // Percentage
    varieties: CoffeeVariety[]
}

export interface NotificationChannel {
    sendAlert(farmerAddress: string, alert: MarketAlert): Promise<boolean>
    sendMarketUpdate(farmerAddress: string, condition: MarketCondition): Promise<boolean>
}

// Email notification channel (mock implementation)
class EmailNotificationChannel implements NotificationChannel {
    async sendAlert(farmerAddress: string, alert: MarketAlert): Promise<boolean> {
        try {
            // In a real implementation, this would send actual emails
            console.log(`📧 Email Alert to ${farmerAddress}:`)
            console.log(`   ${alert.message}`)
            console.log(`   Current Price: $${alert.currentPrice.toFixed(2)}/kg`)
            console.log(`   Change: ${alert.changePercent.toFixed(2)}%`)
            
            // Store alert in database
            await db.insert(marketAlerts).values({
                farmerAddress,
                alertType: alert.alertType,
                variety: alert.variety,
                grade: alert.grade,
                currentPrice: Math.round(alert.currentPrice * 100),
                previousPrice: Math.round(alert.previousPrice * 100),
                changePercent: Math.round(alert.changePercent * 100),
                message: alert.message,
                sentAt: new Date(),
                channel: 'email'
            })
            
            return true
        } catch (error) {
            console.error('Failed to send email alert:', error)
            return false
        }
    }

    async sendMarketUpdate(farmerAddress: string, condition: MarketCondition): Promise<boolean> {
        try {
            console.log(`📧 Market Update to ${farmerAddress}:`)
            console.log(`   ${CoffeeVariety[condition.variety]} Market: ${condition.trend}`)
            console.log(`   Volatility: ${condition.volatility.toFixed(2)}%`)
            console.log(`   Recommendation: ${condition.recommendation}`)
            console.log(`   Confidence: ${condition.confidence.toFixed(0)}%`)
            
            return true
        } catch (error) {
            console.error('Failed to send market update:', error)
            return false
        }
    }
}

// SMS notification channel (mock implementation)
class SMSNotificationChannel implements NotificationChannel {
    async sendAlert(farmerAddress: string, alert: MarketAlert): Promise<boolean> {
        try {
            console.log(`📱 SMS Alert to ${farmerAddress}:`)
            console.log(`   ${CoffeeVariety[alert.variety]} ${alert.alertType}: ${alert.changePercent.toFixed(1)}% change`)
            
            return true
        } catch (error) {
            console.error('Failed to send SMS alert:', error)
            return false
        }
    }

    async sendMarketUpdate(farmerAddress: string, condition: MarketCondition): Promise<boolean> {
        try {
            console.log(`📱 SMS Update to ${farmerAddress}:`)
            console.log(`   ${CoffeeVariety[condition.variety]} market is ${condition.trend.toLowerCase()}`)
            
            return true
        } catch (error) {
            console.error('Failed to send SMS update:', error)
            return false
        }
    }
}

export class MarketAlertService {
    private marketProvider: CoffeeMarketProvider
    private notificationChannels: NotificationChannel[]
    private farmerPreferences: Map<string, FarmerNotificationPreferences> = new Map()

    constructor(marketProvider: CoffeeMarketProvider) {
        this.marketProvider = marketProvider
        this.notificationChannels = [
            new EmailNotificationChannel(),
            new SMSNotificationChannel()
        ]
        
        // Subscribe to market alerts
        this.marketProvider.subscribeToAlerts(this.handleMarketAlert.bind(this))
        
        // Load farmer preferences
        this.loadFarmerPreferences()
    }

    /**
     * Load farmer notification preferences from database
     */
    private async loadFarmerPreferences() {
        try {
            const farmersData = await db.select().from(farmers)
            
            farmersData.forEach(farmer => {
                this.farmerPreferences.set(farmer.address, {
                    farmerAddress: farmer.address,
                    emailNotifications: true, // Default preferences
                    priceAlerts: true,
                    volatilityAlerts: true,
                    marketConditionAlerts: true,
                    priceChangeThreshold: 5,
                    varieties: [CoffeeVariety.ARABICA, CoffeeVariety.ROBUSTA] // Default varieties
                })
            })
            
            console.log(`Loaded preferences for ${farmersData.length} farmers`)
        } catch (error) {
            console.error('Error loading farmer preferences:', error)
        }
    }

    /**
     * Update farmer notification preferences
     */
    public async updateFarmerPreferences(preferences: FarmerNotificationPreferences): Promise<boolean> {
        try {
            this.farmerPreferences.set(preferences.farmerAddress, preferences)
            
            // In a real implementation, save to database
            console.log(`Updated preferences for farmer ${preferences.farmerAddress}`)
            return true
        } catch (error) {
            console.error('Error updating farmer preferences:', error)
            return false
        }
    }

    /**
     * Handle market alert from provider
     */
    private async handleMarketAlert(alert: MarketAlert) {
        console.log(`Processing market alert: ${alert.alertType} for ${CoffeeVariety[alert.variety]}`)
        
        // Find farmers interested in this variety
        const interestedFarmers = Array.from(this.farmerPreferences.values()).filter(pref => {
            return pref.varieties.includes(alert.variety) &&
                   this.shouldSendAlert(pref, alert)
        })

        // Send alerts to interested farmers
        for (const farmer of interestedFarmers) {
            await this.sendAlertToFarmer(farmer.farmerAddress, alert)
        }
    }

    /**
     * Check if alert should be sent based on farmer preferences
     */
    private shouldSendAlert(preferences: FarmerNotificationPreferences, alert: MarketAlert): boolean {
        switch (alert.alertType) {
            case 'PRICE_SPIKE':
            case 'PRICE_DROP':
                return preferences.priceAlerts && 
                       Math.abs(alert.changePercent) >= preferences.priceChangeThreshold
            case 'VOLATILITY':
                return preferences.volatilityAlerts
            case 'SEASONAL_CHANGE':
                return preferences.marketConditionAlerts
            default:
                return false
        }
    }

    /**
     * Send alert to specific farmer
     */
    private async sendAlertToFarmer(farmerAddress: string, alert: MarketAlert) {
        const preferences = this.farmerPreferences.get(farmerAddress)
        if (!preferences || !preferences.emailNotifications) {
            return
        }

        // Send through all notification channels
        for (const channel of this.notificationChannels) {
            try {
                await channel.sendAlert(farmerAddress, alert)
            } catch (error) {
                console.error(`Failed to send alert via channel:`, error)
            }
        }
    }

    /**
     * Send market condition updates to farmers
     */
    public async sendMarketUpdates() {
        console.log('Sending market condition updates to farmers...')
        
        const varieties = [CoffeeVariety.ARABICA, CoffeeVariety.ROBUSTA, CoffeeVariety.SPECIALTY, CoffeeVariety.ORGANIC]
        
        for (const variety of varieties) {
            const condition = this.marketProvider.getMarketConditions(variety)
            
            // Find farmers interested in this variety
            const interestedFarmers = Array.from(this.farmerPreferences.values()).filter(pref => 
                pref.varieties.includes(variety) && pref.marketConditionAlerts
            )

            // Send updates
            for (const farmer of interestedFarmers) {
                for (const channel of this.notificationChannels) {
                    try {
                        await channel.sendMarketUpdate(farmer.farmerAddress, condition)
                    } catch (error) {
                        console.error(`Failed to send market update:`, error)
                    }
                }
            }
        }
    }

    /**
     * Get market alerts history for a farmer
     */
    public async getAlertsHistory(farmerAddress: string, limit: number = 50): Promise<any[]> {
        try {
            const alerts = await db.select()
                .from(marketAlerts)
                .where(eq(marketAlerts.farmerAddress, farmerAddress))
                .orderBy(desc(marketAlerts.sentAt))
                .limit(limit)
            
            return alerts
        } catch (error) {
            console.error('Error fetching alerts history:', error)
            return []
        }
    }

    /**
     * Get price trends and analysis for farmers
     */
    public async getPriceTrends(variety: CoffeeVariety, days: number = 30): Promise<{
        trend: 'BULLISH' | 'BEARISH' | 'STABLE'
        averagePrice: number
        priceChange: number
        volatility: number
        recommendation: string
    }> {
        const history = this.marketProvider.getPriceHistory(variety)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        
        const recentHistory = history.filter(h => h.timestamp >= cutoffDate)
        
        if (recentHistory.length === 0) {
            return {
                trend: 'STABLE',
                averagePrice: 0,
                priceChange: 0,
                volatility: 0,
                recommendation: 'Insufficient data for analysis'
            }
        }

        const prices = recentHistory.map(h => h.price)
        const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
        const firstPrice = prices[0]
        const lastPrice = prices[prices.length - 1]
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100

        // Calculate volatility
        const mean = averagePrice
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
        const volatility = Math.sqrt(variance) / mean * 100

        let trend: 'BULLISH' | 'BEARISH' | 'STABLE'
        let recommendation: string

        if (priceChange > 5) {
            trend = 'BULLISH'
            recommendation = 'Prices are trending upward. Consider timing your sales for maximum profit.'
        } else if (priceChange < -5) {
            trend = 'BEARISH'
            recommendation = 'Prices are declining. Consider holding inventory if possible or focus on quality improvements.'
        } else {
            trend = 'STABLE'
            recommendation = 'Market is stable. Good time for planning and consistent sales.'
        }

        return {
            trend,
            averagePrice,
            priceChange,
            volatility,
            recommendation
        }
    }

    /**
     * Start periodic market updates
     */
    public startPeriodicUpdates(intervalHours: number = 24) {
        const sendUpdates = async () => {
            try {
                await this.sendMarketUpdates()
            } catch (error) {
                console.error('Error in periodic market updates:', error)
            }
        }

        // Send initial update
        sendUpdates()
        
        // Schedule regular updates
        setInterval(sendUpdates, intervalHours * 60 * 60 * 1000)
        console.log(`Started periodic market updates every ${intervalHours} hours`)
    }
}