import { db } from "../db";
import { 
    coffeeGroves, 
    harvestRecords, 
    tokenHoldings, 
    revenueDistributions,
    farmerVerifications,
    farmers,
    treeHealthRecords,
    iotSensorData,
    environmentalAlerts,
    maintenanceActivities,
    priceHistory
} from "../db/schema";
import { eq, and, gte, lte, desc, asc, sum, avg, count, sql } from "drizzle-orm";

/**
 * Coffee Grove Performance Analytics
 */
export class CoffeeGroveAnalytics {
    
    /**
     * Get grove performance analysis including yield tracking and revenue
     */
    static async getGrovePerformance(groveId: number, timeframe?: { start: number, end: number }) {
        const grove = await db.query.coffeeGroves.findFirst({
            where: eq(coffeeGroves.id, groveId)
        });
        
        if (!grove) {
            throw new Error("Grove not found");
        }
        
        // Build harvest query with optional timeframe
        let harvestQuery = db.select({
            totalHarvests: count(),
            totalYieldKg: sum(harvestRecords.yieldKg),
            totalRevenue: sum(harvestRecords.totalRevenue),
            averageQuality: avg(harvestRecords.qualityGrade),
            averageYieldPerHarvest: avg(harvestRecords.yieldKg),
            distributedHarvests: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 1 THEN 1 ELSE 0 END)`,
            pendingRevenue: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 0 THEN ${harvestRecords.totalRevenue} ELSE 0 END)`
        }).from(harvestRecords).where(eq(harvestRecords.groveId, groveId));
        
        if (timeframe) {
            harvestQuery = harvestQuery.where(
                and(
                    eq(harvestRecords.groveId, groveId),
                    gte(harvestRecords.harvestDate, timeframe.start),
                    lte(harvestRecords.harvestDate, timeframe.end)
                )
            );
        }
        
        const harvestStats = await harvestQuery;
        
        // Get recent harvests
        const recentHarvests = await db.select()
            .from(harvestRecords)
            .where(eq(harvestRecords.groveId, groveId))
            .orderBy(desc(harvestRecords.harvestDate))
            .limit(10);
        
        // Get yield trend (monthly aggregation)
        const yieldTrend = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`,
            totalYield: sum(harvestRecords.yieldKg),
            averageQuality: avg(harvestRecords.qualityGrade),
            harvestCount: count()
        })
        .from(harvestRecords)
        .where(eq(harvestRecords.groveId, groveId))
        .groupBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`);
        
        // Calculate yield per tree
        const yieldPerTree = harvestStats[0]?.totalYieldKg && grove.treeCount 
            ? Number(harvestStats[0].totalYieldKg) / grove.treeCount 
            : 0;
        
        // Calculate expected vs actual yield
        const expectedTotalYield = grove.treeCount * (grove.expectedYieldPerTree || 0);
        const actualTotalYield = Number(harvestStats[0]?.totalYieldKg || 0);
        const yieldEfficiency = expectedTotalYield > 0 ? (actualTotalYield / expectedTotalYield) * 100 : 0;
        
        return {
            grove,
            performance: {
                ...harvestStats[0],
                yieldPerTree,
                expectedTotalYield,
                actualTotalYield,
                yieldEfficiency: Math.round(yieldEfficiency * 100) / 100
            },
            recentHarvests,
            yieldTrend
        };
    }
    
    /**
     * Get grove health analytics including sensor data and alerts
     */
    static async getGroveHealthAnalytics(groveId: number, days: number = 30) {
        const cutoffDate = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
        
        // Get latest health record
        const latestHealth = await db.select()
            .from(treeHealthRecords)
            .where(eq(treeHealthRecords.groveId, groveId))
            .orderBy(desc(treeHealthRecords.assessmentDate))
            .limit(1);
        
        // Get health trend
        const healthTrend = await db.select({
            date: sql<string>`date(${treeHealthRecords.assessmentDate}, 'unixepoch')`,
            healthScore: treeHealthRecords.healthScore,
            soilMoistureScore: treeHealthRecords.soilMoistureScore,
            temperatureScore: treeHealthRecords.temperatureScore,
            humidityScore: treeHealthRecords.humidityScore,
            yieldImpactProjection: treeHealthRecords.yieldImpactProjection
        })
        .from(treeHealthRecords)
        .where(
            and(
                eq(treeHealthRecords.groveId, groveId),
                gte(treeHealthRecords.assessmentDate, cutoffDate)
            )
        )
        .orderBy(asc(treeHealthRecords.assessmentDate));
        
        // Get recent sensor data summary
        const sensorSummary = await db.select({
            sensorType: iotSensorData.sensorType,
            avgValue: avg(iotSensorData.value),
            minValue: sql<number>`MIN(${iotSensorData.value})`,
            maxValue: sql<number>`MAX(${iotSensorData.value})`,
            readingCount: count(),
            unit: iotSensorData.unit
        })
        .from(iotSensorData)
        .where(
            and(
                eq(iotSensorData.groveId, groveId),
                gte(iotSensorData.timestamp, cutoffDate)
            )
        )
        .groupBy(iotSensorData.sensorType, iotSensorData.unit);
        
        // Get active alerts
        const activeAlerts = await db.select()
            .from(environmentalAlerts)
            .where(
                and(
                    eq(environmentalAlerts.groveId, groveId),
                    eq(environmentalAlerts.resolved, false)
                )
            )
            .orderBy(desc(environmentalAlerts.createdAt));
        
        // Get alert statistics
        const alertStats = await db.select({
            totalAlerts: count(),
            criticalAlerts: sql<number>`SUM(CASE WHEN ${environmentalAlerts.severity} = 'critical' THEN 1 ELSE 0 END)`,
            warningAlerts: sql<number>`SUM(CASE WHEN ${environmentalAlerts.severity} = 'warning' THEN 1 ELSE 0 END)`,
            resolvedAlerts: sql<number>`SUM(CASE WHEN ${environmentalAlerts.resolved} = 1 THEN 1 ELSE 0 END)`,
            acknowledgedAlerts: sql<number>`SUM(CASE WHEN ${environmentalAlerts.acknowledged} = 1 THEN 1 ELSE 0 END)`
        })
        .from(environmentalAlerts)
        .where(
            and(
                eq(environmentalAlerts.groveId, groveId),
                gte(environmentalAlerts.createdAt, cutoffDate)
            )
        );
        
        return {
            latestHealth: latestHealth[0] || null,
            healthTrend,
            sensorSummary,
            activeAlerts,
            alertStats: alertStats[0] || {
                totalAlerts: 0,
                criticalAlerts: 0,
                warningAlerts: 0,
                resolvedAlerts: 0,
                acknowledgedAlerts: 0
            }
        };
    }
    
    /**
     * Get maintenance activity analysis
     */
    static async getMaintenanceAnalytics(groveId: number, timeframe?: { start: number, end: number }) {
        let query = db.select({
            totalActivities: count(),
            totalCost: sum(maintenanceActivities.cost),
            averageCost: avg(maintenanceActivities.cost),
            totalAreaTreated: sum(maintenanceActivities.areaTreated)
        }).from(maintenanceActivities).where(eq(maintenanceActivities.groveId, groveId));
        
        if (timeframe) {
            query = query.where(
                and(
                    eq(maintenanceActivities.groveId, groveId),
                    gte(maintenanceActivities.activityDate, timeframe.start),
                    lte(maintenanceActivities.activityDate, timeframe.end)
                )
            );
        }
        
        const stats = await query;
        
        // Get activity breakdown by type
        const activityBreakdown = await db.select({
            activityType: maintenanceActivities.activityType,
            count: count(),
            totalCost: sum(maintenanceActivities.cost),
            averageCost: avg(maintenanceActivities.cost)
        })
        .from(maintenanceActivities)
        .where(eq(maintenanceActivities.groveId, groveId))
        .groupBy(maintenanceActivities.activityType)
        .orderBy(desc(count()));
        
        // Get recent activities
        const recentActivities = await db.select()
            .from(maintenanceActivities)
            .where(eq(maintenanceActivities.groveId, groveId))
            .orderBy(desc(maintenanceActivities.activityDate))
            .limit(10);
        
        return {
            stats: stats[0] || { totalActivities: 0, totalCost: 0, averageCost: 0, totalAreaTreated: 0 },
            activityBreakdown,
            recentActivities
        };
    }
}

/**
 * Investor Portfolio Analytics
 */
export class InvestorPortfolioAnalytics {
    
    /**
     * Get comprehensive investor portfolio analytics
     */
    static async getInvestorPortfolio(investorAddress: string) {
        // Get all token holdings
        const holdings = await db.select({
            holding: tokenHoldings,
            grove: coffeeGroves
        })
        .from(tokenHoldings)
        .innerJoin(coffeeGroves, eq(tokenHoldings.groveId, coffeeGroves.id))
        .where(
            and(
                eq(tokenHoldings.holderAddress, investorAddress),
                eq(tokenHoldings.isActive, true)
            )
        );
        
        // Get revenue distributions
        const distributions = await db.select({
            distribution: revenueDistributions,
            harvest: harvestRecords,
            grove: coffeeGroves
        })
        .from(revenueDistributions)
        .innerJoin(harvestRecords, eq(revenueDistributions.harvestId, harvestRecords.id))
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(revenueDistributions.holderAddress, investorAddress))
        .orderBy(desc(revenueDistributions.distributionDate));
        
        // Calculate portfolio statistics
        const totalInvestment = holdings.reduce((sum, h) => sum + h.holding.purchasePrice, 0);
        const totalTokens = holdings.reduce((sum, h) => sum + h.holding.tokenAmount, 0);
        const totalEarnings = distributions.reduce((sum, d) => sum + d.distribution.revenueShare, 0);
        
        // Calculate returns
        const totalReturn = totalEarnings;
        const returnPercentage = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;
        
        // Get earnings by grove
        const earningsByGrove = await db.select({
            groveId: coffeeGroves.id,
            groveName: coffeeGroves.groveName,
            totalEarnings: sum(revenueDistributions.revenueShare),
            distributionCount: count()
        })
        .from(revenueDistributions)
        .innerJoin(harvestRecords, eq(revenueDistributions.harvestId, harvestRecords.id))
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(revenueDistributions.holderAddress, investorAddress))
        .groupBy(coffeeGroves.id, coffeeGroves.groveName);
        
        // Get monthly earnings trend
        const monthlyEarnings = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${revenueDistributions.distributionDate}, 'unixepoch'))`,
            totalEarnings: sum(revenueDistributions.revenueShare),
            distributionCount: count()
        })
        .from(revenueDistributions)
        .where(eq(revenueDistributions.holderAddress, investorAddress))
        .groupBy(sql`strftime('%Y-%m', datetime(${revenueDistributions.distributionDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${revenueDistributions.distributionDate}, 'unixepoch'))`);
        
        return {
            summary: {
                totalInvestment,
                totalTokens,
                totalEarnings,
                totalReturn,
                returnPercentage: Math.round(returnPercentage * 100) / 100,
                activeGroves: holdings.length,
                totalDistributions: distributions.length
            },
            holdings,
            recentDistributions: distributions.slice(0, 10),
            earningsByGrove,
            monthlyEarnings
        };
    }
    
    /**
     * Calculate return projections based on historical data
     */
    static async getReturnProjections(investorAddress: string) {
        const portfolio = await this.getInvestorPortfolio(investorAddress);
        
        // Calculate average monthly return
        const monthlyEarnings = portfolio.monthlyEarnings;
        const avgMonthlyReturn = monthlyEarnings.length > 0 
            ? monthlyEarnings.reduce((sum, m) => sum + Number(m.totalEarnings), 0) / monthlyEarnings.length
            : 0;
        
        // Project future returns
        const projections = {
            nextMonth: avgMonthlyReturn,
            next3Months: avgMonthlyReturn * 3,
            next6Months: avgMonthlyReturn * 6,
            nextYear: avgMonthlyReturn * 12
        };
        
        // Calculate annualized return rate
        const annualizedReturn = portfolio.summary.totalInvestment > 0 
            ? (avgMonthlyReturn * 12 / portfolio.summary.totalInvestment) * 100
            : 0;
        
        return {
            projections,
            annualizedReturn: Math.round(annualizedReturn * 100) / 100,
            avgMonthlyReturn,
            basedOnMonths: monthlyEarnings.length
        };
    }
}

/**
 * Farmer Earnings Analytics
 */
export class FarmerEarningsAnalytics {
    
    /**
     * Get comprehensive farmer earnings and harvest analysis
     */
    static async getFarmerEarnings(farmerAddress: string, timeframe?: { start: number, end: number }) {
        // Get farmer's groves
        const farmerGroves = await db.select()
            .from(coffeeGroves)
            .where(eq(coffeeGroves.farmerAddress, farmerAddress));
        
        if (farmerGroves.length === 0) {
            return {
                summary: { totalEarnings: 0, totalHarvests: 0, totalYield: 0, averageQuality: 0 },
                groveBreakdown: [],
                harvestHistory: [],
                monthlyEarnings: []
            };
        }
        
        const groveIds = farmerGroves.map(g => g.id);
        
        // Build harvest query
        let harvestQuery = db.select({
            totalHarvests: count(),
            totalYield: sum(harvestRecords.yieldKg),
            totalRevenue: sum(harvestRecords.totalRevenue),
            totalFarmerShare: sum(harvestRecords.farmerShare),
            averageQuality: avg(harvestRecords.qualityGrade),
            distributedHarvests: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 1 THEN 1 ELSE 0 END)`,
            pendingRevenue: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 0 THEN ${harvestRecords.farmerShare} ELSE 0 END)`
        }).from(harvestRecords).where(sql`${harvestRecords.groveId} IN (${groveIds.join(',')})`);
        
        if (timeframe) {
            harvestQuery = harvestQuery.where(
                and(
                    sql`${harvestRecords.groveId} IN (${groveIds.join(',')})`,
                    gte(harvestRecords.harvestDate, timeframe.start),
                    lte(harvestRecords.harvestDate, timeframe.end)
                )
            );
        }
        
        const summary = await harvestQuery;
        
        // Get earnings breakdown by grove
        const groveBreakdown = await db.select({
            grove: coffeeGroves,
            totalHarvests: count(harvestRecords.id),
            totalYield: sum(harvestRecords.yieldKg),
            totalEarnings: sum(harvestRecords.farmerShare),
            averageQuality: avg(harvestRecords.qualityGrade),
            lastHarvestDate: sql<number>`MAX(${harvestRecords.harvestDate})`
        })
        .from(coffeeGroves)
        .leftJoin(harvestRecords, eq(coffeeGroves.id, harvestRecords.groveId))
        .where(eq(coffeeGroves.farmerAddress, farmerAddress))
        .groupBy(coffeeGroves.id);
        
        // Get harvest history
        const harvestHistory = await db.select({
            harvest: harvestRecords,
            grove: coffeeGroves
        })
        .from(harvestRecords)
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(coffeeGroves.farmerAddress, farmerAddress))
        .orderBy(desc(harvestRecords.harvestDate))
        .limit(20);
        
        // Get monthly earnings
        const monthlyEarnings = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`,
            totalEarnings: sum(harvestRecords.farmerShare),
            totalYield: sum(harvestRecords.yieldKg),
            harvestCount: count()
        })
        .from(harvestRecords)
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(coffeeGroves.farmerAddress, farmerAddress))
        .groupBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`);
        
        return {
            summary: summary[0] || { 
                totalEarnings: 0, 
                totalHarvests: 0, 
                totalYield: 0, 
                averageQuality: 0,
                distributedHarvests: 0,
                pendingRevenue: 0
            },
            groveBreakdown,
            harvestHistory,
            monthlyEarnings,
            groveCount: farmerGroves.length
        };
    }
    
    /**
     * Get farmer performance metrics and comparisons
     */
    static async getFarmerPerformanceMetrics(farmerAddress: string) {
        const earnings = await this.getFarmerEarnings(farmerAddress);
        
        // Calculate performance metrics
        const totalTrees = earnings.groveBreakdown.reduce((sum, g) => sum + g.grove.treeCount, 0);
        const yieldPerTree = totalTrees > 0 ? Number(earnings.summary.totalYield || 0) / totalTrees : 0;
        const earningsPerTree = totalTrees > 0 ? Number(earnings.summary.totalEarnings || 0) / totalTrees : 0;
        
        // Get industry averages (simplified - would need more data in production)
        const industryAvgYieldPerTree = 5000; // 5kg per tree average
        const industryAvgQuality = 75; // 75% quality average
        
        const yieldEfficiency = industryAvgYieldPerTree > 0 ? (yieldPerTree / industryAvgYieldPerTree) * 100 : 0;
        const qualityRating = Number(earnings.summary.averageQuality || 0);
        const qualityVsIndustry = industryAvgQuality > 0 ? (qualityRating / industryAvgQuality) * 100 : 0;
        
        return {
            metrics: {
                totalTrees,
                yieldPerTree: Math.round(yieldPerTree * 100) / 100,
                earningsPerTree: Math.round(earningsPerTree * 100) / 100,
                yieldEfficiency: Math.round(yieldEfficiency * 100) / 100,
                qualityRating: Math.round(qualityRating * 100) / 100,
                qualityVsIndustry: Math.round(qualityVsIndustry * 100) / 100
            },
            benchmarks: {
                industryAvgYieldPerTree,
                industryAvgQuality
            }
        };
    }
}

/**
 * Market Trend Analysis
 */
export class MarketTrendAnalytics {
    
    /**
     * Get coffee price trends and correlations
     */
    static async getCoffeePriceTrends(variety: number, grade: number, days: number = 90) {
        const cutoffDate = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
        
        // Get price history
        const priceData = await db.select()
            .from(priceHistory)
            .where(
                and(
                    eq(priceHistory.variety, variety),
                    eq(priceHistory.grade, grade),
                    gte(priceHistory.timestamp, cutoffDate)
                )
            )
            .orderBy(asc(priceHistory.timestamp));
        
        if (priceData.length === 0) {
            return {
                trend: [],
                statistics: { min: 0, max: 0, average: 0, volatility: 0, change: 0 },
                correlation: null
            };
        }
        
        // Calculate statistics
        const prices = priceData.map(p => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        
        // Calculate volatility (standard deviation)
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance);
        
        // Calculate price change
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        const change = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
        
        // Group by day for trend analysis
        const dailyTrend = await db.select({
            date: sql<string>`date(${priceHistory.timestamp}, 'unixepoch')`,
            avgPrice: avg(priceHistory.price),
            minPrice: sql<number>`MIN(${priceHistory.price})`,
            maxPrice: sql<number>`MAX(${priceHistory.price})`,
            priceCount: count()
        })
        .from(priceHistory)
        .where(
            and(
                eq(priceHistory.variety, variety),
                eq(priceHistory.grade, grade),
                gte(priceHistory.timestamp, cutoffDate)
            )
        )
        .groupBy(sql`date(${priceHistory.timestamp}, 'unixepoch')`)
        .orderBy(sql`date(${priceHistory.timestamp}, 'unixepoch')`);
        
        return {
            trend: dailyTrend,
            statistics: {
                min,
                max,
                average: Math.round(average * 100) / 100,
                volatility: Math.round(volatility * 100) / 100,
                change: Math.round(change * 100) / 100
            },
            dataPoints: priceData.length
        };
    }
    
    /**
     * Analyze correlation between harvest yields and market prices
     */
    static async getYieldPriceCorrelation(timeframe?: { start: number, end: number }) {
        // Get harvest data with corresponding price data
        let query = db.select({
            harvestDate: harvestRecords.harvestDate,
            yieldKg: harvestRecords.yieldKg,
            qualityGrade: harvestRecords.qualityGrade,
            salePricePerKg: harvestRecords.salePricePerKg,
            groveName: coffeeGroves.groveName,
            coffeeVariety: coffeeGroves.coffeeVariety
        })
        .from(harvestRecords)
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(harvestRecords.revenueDistributed, true));
        
        if (timeframe) {
            query = query.where(
                and(
                    eq(harvestRecords.revenueDistributed, true),
                    gte(harvestRecords.harvestDate, timeframe.start),
                    lte(harvestRecords.harvestDate, timeframe.end)
                )
            );
        }
        
        const harvestData = await query.orderBy(asc(harvestRecords.harvestDate));
        
        // Calculate correlations (simplified)
        const yieldPriceData = harvestData.map(h => ({
            yield: h.yieldKg,
            price: h.salePricePerKg,
            quality: h.qualityGrade
        }));
        
        // Group by month for trend analysis
        const monthlyAggregates = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`,
            avgYield: avg(harvestRecords.yieldKg),
            avgPrice: avg(harvestRecords.salePricePerKg),
            avgQuality: avg(harvestRecords.qualityGrade),
            totalRevenue: sum(harvestRecords.totalRevenue),
            harvestCount: count()
        })
        .from(harvestRecords)
        .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
        .where(eq(harvestRecords.revenueDistributed, true))
        .groupBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`);
        
        return {
            rawData: yieldPriceData,
            monthlyTrends: monthlyAggregates,
            summary: {
                totalHarvests: harvestData.length,
                avgYield: harvestData.reduce((sum, h) => sum + h.yieldKg, 0) / harvestData.length,
                avgPrice: harvestData.reduce((sum, h) => sum + h.salePricePerKg, 0) / harvestData.length,
                avgQuality: harvestData.reduce((sum, h) => sum + h.qualityGrade, 0) / harvestData.length
            }
        };
    }
    
    /**
     * Get market insights and recommendations
     */
    static async getMarketInsights() {
        // Get recent price movements
        const recentPrices = await db.select({
            variety: priceHistory.variety,
            grade: priceHistory.grade,
            currentPrice: sql<number>`MAX(${priceHistory.price})`,
            previousPrice: sql<number>`LAG(${priceHistory.price}) OVER (PARTITION BY ${priceHistory.variety}, ${priceHistory.grade} ORDER BY ${priceHistory.timestamp})`,
            priceChange: sql<number>`(MAX(${priceHistory.price}) - LAG(${priceHistory.price}) OVER (PARTITION BY ${priceHistory.variety}, ${priceHistory.grade} ORDER BY ${priceHistory.timestamp}))`,
            lastUpdate: sql<number>`MAX(${priceHistory.timestamp})`
        })
        .from(priceHistory)
        .groupBy(priceHistory.variety, priceHistory.grade)
        .orderBy(desc(sql`MAX(${priceHistory.timestamp})`));
        
        // Get harvest season analysis
        const seasonalData = await db.select({
            month: sql<string>`strftime('%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`,
            avgYield: avg(harvestRecords.yieldKg),
            avgPrice: avg(harvestRecords.salePricePerKg),
            harvestCount: count()
        })
        .from(harvestRecords)
        .where(eq(harvestRecords.revenueDistributed, true))
        .groupBy(sql`strftime('%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`);
        
        return {
            recentPrices,
            seasonalTrends: seasonalData,
            insights: {
                bestHarvestMonths: seasonalData
                    .sort((a, b) => Number(b.avgPrice) - Number(a.avgPrice))
                    .slice(0, 3),
                highestYieldMonths: seasonalData
                    .sort((a, b) => Number(b.avgYield) - Number(a.avgYield))
                    .slice(0, 3)
            }
        };
    }
}

/**
 * Platform-wide Analytics Dashboard
 */
export class PlatformAnalytics {
    
    /**
     * Get comprehensive platform statistics
     */
    static async getPlatformStats() {
        // Grove statistics
        const groveStats = await db.select({
            totalGroves: count(),
            verifiedGroves: sql<number>`SUM(CASE WHEN ${coffeeGroves.verificationStatus} = 'verified' THEN 1 ELSE 0 END)`,
            tokenizedGroves: sql<number>`SUM(CASE WHEN ${coffeeGroves.tokenAddress} IS NOT NULL THEN 1 ELSE 0 END)`,
            totalTrees: sum(coffeeGroves.treeCount),
            avgTreesPerGrove: avg(coffeeGroves.treeCount)
        }).from(coffeeGroves);
        
        // Farmer statistics
        const farmerStats = await db.select({
            totalFarmers: count(),
            verifiedFarmers: sql<number>`SUM(CASE WHEN ${farmers.verificationStatus} = 'verified' THEN 1 ELSE 0 END)`,
            pendingFarmers: sql<number>`SUM(CASE WHEN ${farmers.verificationStatus} = 'pending' THEN 1 ELSE 0 END)`
        }).from(farmers);
        
        // Investment statistics
        const investmentStats = await db.select({
            totalInvestors: sql<number>`COUNT(DISTINCT ${tokenHoldings.holderAddress})`,
            totalInvestment: sum(tokenHoldings.purchasePrice),
            activeHoldings: sql<number>`SUM(CASE WHEN ${tokenHoldings.isActive} = 1 THEN 1 ELSE 0 END)`,
            totalTokensHeld: sum(tokenHoldings.tokenAmount)
        }).from(tokenHoldings);
        
        // Revenue statistics
        const revenueStats = await db.select({
            totalHarvests: count(),
            totalRevenue: sum(harvestRecords.totalRevenue),
            distributedRevenue: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 1 THEN ${harvestRecords.totalRevenue} ELSE 0 END)`,
            pendingRevenue: sql<number>`SUM(CASE WHEN ${harvestRecords.revenueDistributed} = 0 THEN ${harvestRecords.totalRevenue} ELSE 0 END)`,
            totalYield: sum(harvestRecords.yieldKg),
            avgQuality: avg(harvestRecords.qualityGrade)
        }).from(harvestRecords);
        
        // Distribution statistics
        const distributionStats = await db.select({
            totalDistributions: count(),
            totalDistributedAmount: sum(revenueDistributions.revenueShare),
            uniqueRecipients: sql<number>`COUNT(DISTINCT ${revenueDistributions.holderAddress})`
        }).from(revenueDistributions);
        
        return {
            groves: groveStats[0] || { totalGroves: 0, verifiedGroves: 0, tokenizedGroves: 0, totalTrees: 0, avgTreesPerGrove: 0 },
            farmers: farmerStats[0] || { totalFarmers: 0, verifiedFarmers: 0, pendingFarmers: 0 },
            investments: investmentStats[0] || { totalInvestors: 0, totalInvestment: 0, activeHoldings: 0, totalTokensHeld: 0 },
            revenue: revenueStats[0] || { totalHarvests: 0, totalRevenue: 0, distributedRevenue: 0, pendingRevenue: 0, totalYield: 0, avgQuality: 0 },
            distributions: distributionStats[0] || { totalDistributions: 0, totalDistributedAmount: 0, uniqueRecipients: 0 }
        };
    }
    
    /**
     * Get platform growth metrics over time
     */
    static async getPlatformGrowthMetrics(days: number = 90) {
        const cutoffDate = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
        
        // Monthly growth in groves
        const groveGrowth = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${coffeeGroves.createdAt}, 'unixepoch'))`,
            newGroves: count(),
            cumulativeGroves: sql<number>`SUM(COUNT(*)) OVER (ORDER BY strftime('%Y-%m', datetime(${coffeeGroves.createdAt}, 'unixepoch')))`
        })
        .from(coffeeGroves)
        .where(gte(coffeeGroves.createdAt, cutoffDate))
        .groupBy(sql`strftime('%Y-%m', datetime(${coffeeGroves.createdAt}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${coffeeGroves.createdAt}, 'unixepoch'))`);
        
        // Monthly investment growth
        const investmentGrowth = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${tokenHoldings.purchaseDate}, 'unixepoch'))`,
            newInvestment: sum(tokenHoldings.purchasePrice),
            newInvestors: sql<number>`COUNT(DISTINCT ${tokenHoldings.holderAddress})`,
            cumulativeInvestment: sql<number>`SUM(SUM(${tokenHoldings.purchasePrice})) OVER (ORDER BY strftime('%Y-%m', datetime(${tokenHoldings.purchaseDate}, 'unixepoch')))`
        })
        .from(tokenHoldings)
        .where(gte(tokenHoldings.purchaseDate, cutoffDate))
        .groupBy(sql`strftime('%Y-%m', datetime(${tokenHoldings.purchaseDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${tokenHoldings.purchaseDate}, 'unixepoch'))`);
        
        // Monthly harvest activity
        const harvestGrowth = await db.select({
            month: sql<string>`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`,
            harvestCount: count(),
            totalYield: sum(harvestRecords.yieldKg),
            totalRevenue: sum(harvestRecords.totalRevenue)
        })
        .from(harvestRecords)
        .where(gte(harvestRecords.harvestDate, cutoffDate))
        .groupBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime(${harvestRecords.harvestDate}, 'unixepoch'))`);
        
        return {
            groveGrowth,
            investmentGrowth,
            harvestGrowth
        };
    }
}