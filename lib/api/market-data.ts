import { Request, Response } from 'express'
import { CoffeeMarketProvider, CoffeeVariety, MarketAlert } from '../providers/coffee-market-provider.js'
import { MarketAlertService } from '../providers/market-alert-service.js'
import { db } from '../db/index.js'
import { priceHistory, marketAlerts, farmers, coffeeGroves, harvestRecords } from '../db/schema/index.js'
import { eq, and, gte, desc, asc, sql } from 'drizzle-orm'

let marketProvider: CoffeeMarketProvider
let alertService: MarketAlertService

// Initialize market services
export function initializeMarketServices(contractId: string) {
    marketProvider = new CoffeeMarketProvider(contractId)
    alertService = new MarketAlertService(marketProvider)
    
    // Start automatic price updates every 30 minutes
    marketProvider.startPriceUpdates(30)
    
    // Start periodic market updates every 24 hours
    alertService.startPeriodicUpdates(24)
    
    console.log('Market services initialized')
}

/**
 * Get current coffee prices from all sources
 */
export async function getCurrentPrices(req: Request, res: Response) {
    try {
        const { variety, source } = req.query
        
        // Fetch latest prices
        const prices = await marketProvider.fetchAllPrices()
        
        // Filter by variety if specified
        let filteredPrices = prices
        if (variety) {
            const varietyEnum = mapVarietyString(variety as string)
            if (varietyEnum !== undefined) {
                filteredPrices = prices.filter(p => p.variety === varietyEnum)
            }
        }
        
        // Filter by source if specified
        if (source) {
            filteredPrices = filteredPrices.filter(p => 
                p.source.toLowerCase().includes((source as string).toLowerCase())
            )
        }
        
        res.json({
            success: true,
            data: {
                prices: filteredPrices,
                lastUpdated: new Date(),
                totalSources: [...new Set(prices.map(p => p.source))].length
            }
        })
        
    } catch (error:any) {
        console.error('Error fetching current prices:', error)
        if (error && error.stack) console.error(error.stack)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch current prices',
            detail: error?.message || String(error)
        })
    }
}

/**
 * Get price history for a specific variety
 */
export async function getPriceHistory(req: Request, res: Response) {
    try {
        const { variety, grade = 1, days = 30, source } = req.query
        
        if (!variety) {
            return res.status(400).json({
                success: false,
                error: 'Variety parameter is required'
            })
        }
        
        const varietyEnum = mapVarietyString(variety as string)
        if (varietyEnum === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Invalid variety specified'
            })
        }
        
        // Calculate date range
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string))
        const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000)
        
        // Build query conditions
        let conditions = and(
            eq(priceHistory.variety, varietyEnum),
            eq(priceHistory.grade, parseInt(grade as string)),
            gte(priceHistory.timestamp, cutoffTimestamp)
        )
        
        // Query database
        let query = db.select().from(priceHistory).where(conditions)
        
        if (source) {
            query = query.where(eq(priceHistory.source, source as string))
        }
        
        const history = await query.orderBy(asc(priceHistory.timestamp))
        
        // Convert to client format
        const formattedHistory = history.map(h => ({
            variety: h.variety,
            grade: h.grade,
            price: h.price / 100, // Convert from cents to dollars
            source: h.source,
            region: h.region,
            timestamp: new Date(h.timestamp * 1000)
        }))
        
        // Calculate statistics
        const prices = formattedHistory.map(h => h.price)
        const stats = prices.length > 0 ? {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: prices.reduce((sum, p) => sum + p, 0) / prices.length,
            latest: prices[prices.length - 1],
            change: prices.length > 1 ? 
                ((prices[prices.length - 1] - prices[0]) / prices[0] * 100) : 0
        } : null
        
        res.json({
            success: true,
            data: {
                variety: CoffeeVariety[varietyEnum],
                grade: parseInt(grade as string),
                history: formattedHistory,
                statistics: stats,
                period: `${days} days`
            }
        })
        
    } catch (error) {
        console.error('Error fetching price history:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch price history'
        })
    }
}

/**
 * Get market conditions and recommendations
 */
export async function getMarketConditions(req: Request, res: Response) {
    try {
        const { variety, grade = 1 } = req.query
        
        if (!variety) {
            return res.status(400).json({
                success: false,
                error: 'Variety parameter is required'
            })
        }
        
        const varietyEnum = mapVarietyString(variety as string)
        if (varietyEnum === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Invalid variety specified'
            })
        }
        
        // Get market conditions
        const conditions = marketProvider.getMarketConditions(varietyEnum, parseInt(grade as string))
        
        // Get price trends
        const trends = await alertService.getPriceTrends(varietyEnum, 30)
        
        res.json({
            success: true,
            data: {
                variety: CoffeeVariety[varietyEnum],
                grade: parseInt(grade as string),
                conditions,
                trends,
                lastUpdated: new Date()
            }
        })
        
    } catch (error) {
        console.error('Error fetching market conditions:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market conditions'
        })
    }
}

/**
 * Validate a reported price against market rates
 */
export async function validatePrice(req: Request, res: Response) {
    try {
        const { variety, grade = 1, price } = req.body
        
        if (!variety || !price) {
            return res.status(400).json({
                success: false,
                error: 'Variety and price are required'
            })
        }
        
        const varietyEnum = mapVarietyString(variety)
        if (varietyEnum === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Invalid variety specified'
            })
        }
        
        const validation = marketProvider.validatePrice(
            varietyEnum, 
            parseInt(grade), 
            parseFloat(price)
        )
        
        res.json({
            success: true,
            data: validation
        })
        
    } catch (error) {
        console.error('Error validating price:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to validate price'
        })
    }
}

/**
 * Get market alerts for a farmer
 */
export async function getMarketAlerts(req: Request, res: Response) {
    try {
        const { farmerAddress } = req.params
        const { limit = 50, acknowledged } = req.query
        
        if (!farmerAddress) {
            return res.status(400).json({
                success: false,
                error: 'Farmer address is required'
            })
        }
        
        let query = db.select().from(marketAlerts)
            .where(eq(marketAlerts.farmerAddress, farmerAddress))
            .orderBy(desc(marketAlerts.sentAt))
            .limit(parseInt(limit as string))
        
        if (acknowledged !== undefined) {
            const ackValue = acknowledged === 'true'
            query = query.where(eq(marketAlerts.acknowledged, ackValue))
        }
        
        const alerts = await query
        
        // Format alerts for client
        const formattedAlerts = alerts.map(alert => ({
            id: alert.id,
            alertType: alert.alertType,
            variety: CoffeeVariety[alert.variety],
            grade: alert.grade,
            currentPrice: alert.currentPrice / 100,
            previousPrice: alert.previousPrice / 100,
            changePercent: alert.changePercent / 100,
            message: alert.message,
            sentAt: new Date(alert.sentAt * 1000),
            channel: alert.channel,
            acknowledged: alert.acknowledged
        }))
        
        res.json({
            success: true,
            data: {
                alerts: formattedAlerts,
                total: formattedAlerts.length
            }
        })
        
    } catch (error) {
        console.error('Error fetching market alerts:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market alerts'
        })
    }
}

/**
 * Acknowledge market alerts
 */
export async function acknowledgeAlert(req: Request, res: Response) {
    try {
        const { alertId } = req.params
        const { farmerAddress } = req.body
        
        if (!alertId || !farmerAddress) {
            return res.status(400).json({
                success: false,
                error: 'Alert ID and farmer address are required'
            })
        }
        
        // Update alert as acknowledged
        const result = await db.update(marketAlerts)
            .set({ acknowledged: true })
            .where(and(
                eq(marketAlerts.id, parseInt(alertId)),
                eq(marketAlerts.farmerAddress, farmerAddress)
            ))
        
        res.json({
            success: true,
            message: 'Alert acknowledged successfully'
        })
        
    } catch (error) {
        console.error('Error acknowledging alert:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert'
        })
    }
}

/**
 * Update farmer notification preferences
 */
export async function updateNotificationPreferences(req: Request, res: Response) {
    try {
        const { farmerAddress } = req.params
        const preferences = req.body
        
        if (!farmerAddress) {
            return res.status(400).json({
                success: false,
                error: 'Farmer address is required'
            })
        }
        
        // Validate preferences
        const validatedPreferences = {
            farmerAddress,
            emailNotifications: preferences.emailNotifications ?? true,
            priceAlerts: preferences.priceAlerts ?? true,
            volatilityAlerts: preferences.volatilityAlerts ?? true,
            marketConditionAlerts: preferences.marketConditionAlerts ?? true,
            priceChangeThreshold: preferences.priceChangeThreshold ?? 5,
            varieties: preferences.varieties ?? [CoffeeVariety.ARABICA, CoffeeVariety.ROBUSTA]
        }
        
        // Update preferences in alert service
        const success = await alertService.updateFarmerPreferences(validatedPreferences)
        
        if (success) {
            res.json({
                success: true,
                message: 'Notification preferences updated successfully'
            })
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update preferences'
            })
        }
        
    } catch (error) {
        console.error('Error updating notification preferences:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to update notification preferences'
        })
    }
}

/**
 * Trigger manual price update
 */
export async function triggerPriceUpdate(req: Request, res: Response) {
    try {
        console.log('Manual price update triggered')
        const prices = await marketProvider.fetchAllPrices()
        
        if (prices.length > 0) {
            const updateSuccess = await marketProvider.updateContractPrices(prices)
            
            res.json({
                success: true,
                data: {
                    pricesUpdated: prices.length,
                    contractUpdated: updateSuccess,
                    lastUpdate: new Date()
                }
            })
        } else {
            res.status(500).json({
                success: false,
                error: 'No prices could be fetched from any source'
            })
        }
        
    } catch (error) {
        console.error('Error in manual price update:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to update prices'
        })
    }
}

/**
 * Get market statistics and overview
 */
export async function getMarketOverview(req: Request, res: Response) {
    try {
        const varieties = [CoffeeVariety.ARABICA, CoffeeVariety.ROBUSTA, CoffeeVariety.SPECIALTY, CoffeeVariety.ORGANIC]
        const overview = []
        
        for (const variety of varieties) {
            const conditions = marketProvider.getMarketConditions(variety)
            const trends = await alertService.getPriceTrends(variety, 7) // 7-day trends
            
            overview.push({
                variety: CoffeeVariety[variety],
                conditions,
                weeklyTrends: trends
            })
        }
        
        // Get recent alerts count
        let recentAlertsCount = [] as any[]
        try {
            const cutoffTimestamp = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)

            if (typeof db.select === 'function') {
                // Drizzle-style query
                recentAlertsCount = await db.select()
                    .from(marketAlerts)
                    .where(gte(marketAlerts.sentAt, cutoffTimestamp))
            } else if (db && db.query && db.query.marketAlerts && typeof db.query.marketAlerts.findMany === 'function') {
                // In-memory mock DB: fetch all and filter in JS since the mock
                // does not implement SQL-style operators like `gte`.
                const all = await db.query.marketAlerts.findMany()
                recentAlertsCount = (all || []).filter(a => (a.sentAt || 0) >= cutoffTimestamp)
            } else {
                recentAlertsCount = []
            }
        } catch (dbErr:any) {
            console.error('Failed to query recent market alerts:', dbErr)
            if (dbErr && dbErr.stack) console.error(dbErr.stack)
        }

        // Get platform statistics
        let totalGroves = 0
        let activeFarmers = 0
        let totalRevenue = 0

        try {
            // Get total groves count
            const grovesResult = await db.select({ count: sql<number>`count(*)` })
                .from(coffeeGroves)
            totalGroves = grovesResult[0]?.count || 0

            // Get active farmers count (unique farmer addresses)
            const farmersResult = await db.select({ 
                count: sql<number>`count(distinct ${coffeeGroves.farmerAddress})` 
            })
                .from(coffeeGroves)
            activeFarmers = farmersResult[0]?.count || 0

            // Get total revenue from all harvests
            const revenueResult = await db.select({ 
                total: sql<number>`sum(${harvestRecords.totalRevenue})` 
            })
                .from(harvestRecords)
            totalRevenue = revenueResult[0]?.total || 0

        } catch (statsErr: any) {
            console.error('Failed to query platform statistics:', statsErr)
            // Continue with zeros if stats query fails
        }

        res.json({
            success: true,
            data: {
                varieties: overview,
                recentAlertsCount: recentAlertsCount?.length || 0,
                lastUpdated: new Date()
            },
            // Add platform stats at root level for backward compatibility
            totalGroves,
            activeFarmers,
            totalRevenue
        })
        
    } catch (error:any) {
        console.error('Error fetching market overview:', error)
        if (error && error.stack) console.error(error.stack)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market overview',
            detail: error?.message || String(error)
        })
    }
}

// Helper function to map variety string to enum
function mapVarietyString(varietyStr: string): CoffeeVariety | undefined {
    switch (varietyStr.toLowerCase()) {
        case 'arabica': return CoffeeVariety.ARABICA
        case 'robusta': return CoffeeVariety.ROBUSTA
        case 'specialty': return CoffeeVariety.SPECIALTY
        case 'organic': return CoffeeVariety.ORGANIC
        default: return undefined
    }
}