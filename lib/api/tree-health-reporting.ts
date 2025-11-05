/**
 * Tree Health Reporting Service
 * 
 * Generates comprehensive health reports, trend analysis, and yield impact projections
 */

import { IncomingMessage, ServerResponse } from 'http'
import { db } from '../db'
import { 
    iotSensorData, 
    treeHealthRecords, 
    environmentalAlerts,
    maintenanceActivities,
    coffeeGroves,
    harvestRecords
} from '../db/schema'
import { eq, and, desc, gte, lte, sql, avg, count, min, max } from 'drizzle-orm'

// Enhanced request interface
interface EnhancedRequest extends IncomingMessage {
    body?: any
    params?: { [key: string]: string }
    query?: { [key: string]: string | string[] | undefined }
}

// Report interfaces
interface HealthTrendReport {
    groveId: number
    groveName: string
    reportPeriod: {
        startDate: Date
        endDate: Date
    }
    overallTrend: 'improving' | 'stable' | 'declining'
    currentHealthScore: number
    averageHealthScore: number
    healthScoreTrend: number[]
    sensorTrends: {
        [sensorType: string]: {
            current: number
            average: number
            trend: 'improving' | 'stable' | 'declining'
            readings: { date: Date; value: number }[]
        }
    }
    alertsSummary: {
        total: number
        critical: number
        high: number
        resolved: number
        activeAlerts: any[]
    }
    maintenanceImpact: {
        activitiesCount: number
        totalCost: number
        mostCommonActivity: string
        healthImprovementAfterMaintenance: number
    }
    yieldProjections: {
        currentProjection: number
        historicalComparison: number
        impactFactors: string[]
    }
    recommendations: string[]
}

interface GroveComparisonReport {
    reportDate: Date
    groves: {
        id: number
        name: string
        healthScore: number
        rank: number
        strengths: string[]
        weaknesses: string[]
        yieldProjection: number
    }[]
    insights: {
        bestPerforming: any
        needsAttention: any[]
        commonIssues: string[]
        bestPractices: string[]
    }
}

// Utility functions
function sendResponse(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message })
}

export class TreeHealthReportingService {

    /**
     * Generate comprehensive health trend report for a grove
     * GET /api/tree-monitoring/reports/health-trend/:groveId
     */
    async generateHealthTrendReport(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { days = '30' } = req.query as any
            const daysNum = parseInt(days)
            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(endDate.getDate() - daysNum)

            // Get grove information
            const grove = await db.select().from(coffeeGroves).where(eq(coffeeGroves.id, groveIdNum)).limit(1)
            if (grove.length === 0) {
                return sendError(res, 404, 'Grove not found')
            }

            const report = await this.buildHealthTrendReport(groveIdNum, grove[0].groveName, startDate, endDate)

            sendResponse(res, 200, {
                success: true,
                data: report
            })

        } catch (error) {
            console.error('Error generating health trend report:', error)
            sendError(res, 500, 'Failed to generate health trend report')
        }
    }

    /**
     * Generate grove comparison report
     * GET /api/tree-monitoring/reports/grove-comparison
     */
    async generateGroveComparisonReport(req: EnhancedRequest, res: ServerResponse) {
        try {
            const { farmerAddress } = req.query as any
            
            if (!farmerAddress) {
                return sendError(res, 400, 'Farmer address is required')
            }

            const report = await this.buildGroveComparisonReport(farmerAddress)

            sendResponse(res, 200, {
                success: true,
                data: report
            })

        } catch (error) {
            console.error('Error generating grove comparison report:', error)
            sendError(res, 500, 'Failed to generate grove comparison report')
        }
    }

    /**
     * Generate yield impact analysis
     * GET /api/tree-monitoring/reports/yield-impact/:groveId
     */
    async generateYieldImpactAnalysis(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const analysis = await this.buildYieldImpactAnalysis(groveIdNum)

            sendResponse(res, 200, {
                success: true,
                data: analysis
            })

        } catch (error) {
            console.error('Error generating yield impact analysis:', error)
            sendError(res, 500, 'Failed to generate yield impact analysis')
        }
    }

    /**
     * Generate maintenance effectiveness report
     * GET /api/tree-monitoring/reports/maintenance-effectiveness/:groveId
     */
    async generateMaintenanceEffectivenessReport(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { days = '90' } = req.query as any
            const daysNum = parseInt(days)

            const report = await this.buildMaintenanceEffectivenessReport(groveIdNum, daysNum)

            sendResponse(res, 200, {
                success: true,
                data: report
            })

        } catch (error) {
            console.error('Error generating maintenance effectiveness report:', error)
            sendError(res, 500, 'Failed to generate maintenance effectiveness report')
        }
    }

    /**
     * Generate environmental risk assessment
     * GET /api/tree-monitoring/reports/risk-assessment/:groveId
     */
    async generateRiskAssessment(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const assessment = await this.buildRiskAssessment(groveIdNum)

            sendResponse(res, 200, {
                success: true,
                data: assessment
            })

        } catch (error) {
            console.error('Error generating risk assessment:', error)
            sendError(res, 500, 'Failed to generate risk assessment')
        }
    }

    // Private helper methods

    private async buildHealthTrendReport(groveId: number, groveName: string, startDate: Date, endDate: Date): Promise<HealthTrendReport> {
        const startTimestamp = Math.floor(startDate.getTime() / 1000)
        const endTimestamp = Math.floor(endDate.getTime() / 1000)

        // Get health records for the period
        const healthRecords = await db.select()
            .from(treeHealthRecords)
            .where(and(
                eq(treeHealthRecords.groveId, groveId),
                gte(treeHealthRecords.assessmentDate, startTimestamp),
                lte(treeHealthRecords.assessmentDate, endTimestamp)
            ))
            .orderBy(desc(treeHealthRecords.assessmentDate))

        // Get sensor data trends
        const sensorData = await db.select()
            .from(iotSensorData)
            .where(and(
                eq(iotSensorData.groveId, groveId),
                gte(iotSensorData.timestamp, startTimestamp),
                lte(iotSensorData.timestamp, endTimestamp)
            ))
            .orderBy(desc(iotSensorData.timestamp))

        // Get alerts summary
        const alerts = await db.select()
            .from(environmentalAlerts)
            .where(and(
                eq(environmentalAlerts.groveId, groveId),
                gte(environmentalAlerts.createdAt, startTimestamp)
            ))

        // Get maintenance activities
        const maintenance = await db.select()
            .from(maintenanceActivities)
            .where(and(
                eq(maintenanceActivities.groveId, groveId),
                gte(maintenanceActivities.activityDate, startTimestamp),
                lte(maintenanceActivities.activityDate, endTimestamp)
            ))

        // Calculate trends and metrics
        const currentHealthScore = healthRecords.length > 0 ? healthRecords[0].healthScore : 0
        const averageHealthScore = healthRecords.length > 0 
            ? Math.round(healthRecords.reduce((sum, r) => sum + r.healthScore, 0) / healthRecords.length)
            : 0

        const healthScoreTrend = healthRecords.slice(0, 30).reverse().map(r => r.healthScore)
        const overallTrend = this.calculateTrend(healthScoreTrend)

        // Build sensor trends
        const sensorTrends = this.buildSensorTrends(sensorData)

        // Build alerts summary
        const alertsSummary = {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'CRITICAL').length,
            high: alerts.filter(a => a.severity === 'HIGH').length,
            resolved: alerts.filter(a => a.resolved).length,
            activeAlerts: alerts.filter(a => !a.resolved).slice(0, 5)
        }

        // Build maintenance impact analysis
        const maintenanceImpact = this.buildMaintenanceImpact(maintenance, healthRecords)

        // Build yield projections
        const yieldProjections = await this.buildYieldProjections(groveId, healthRecords)

        // Generate recommendations
        const recommendations = this.generateRecommendations(healthRecords, alerts, sensorTrends)

        return {
            groveId,
            groveName,
            reportPeriod: { startDate, endDate },
            overallTrend,
            currentHealthScore,
            averageHealthScore,
            healthScoreTrend,
            sensorTrends,
            alertsSummary,
            maintenanceImpact,
            yieldProjections,
            recommendations
        }
    }

    private async buildGroveComparisonReport(farmerAddress: string): Promise<GroveComparisonReport> {
        // Get farmer's groves
        const groves = await db.select()
            .from(coffeeGroves)
            .where(eq(coffeeGroves.farmerAddress, farmerAddress))

        const groveComparisons = []

        for (const grove of groves) {
            // Get latest health record
            const latestHealth = await db.select()
                .from(treeHealthRecords)
                .where(eq(treeHealthRecords.groveId, grove.id))
                .orderBy(desc(treeHealthRecords.assessmentDate))
                .limit(1)

            const healthScore = latestHealth.length > 0 ? latestHealth[0].healthScore : 0
            const yieldProjection = latestHealth.length > 0 ? (latestHealth[0].yieldImpactProjection || 0) : 0

            // Analyze strengths and weaknesses
            const { strengths, weaknesses } = this.analyzeGrovePerformance(latestHealth[0])

            groveComparisons.push({
                id: grove.id,
                name: grove.groveName,
                healthScore,
                rank: 0, // Will be calculated after sorting
                strengths,
                weaknesses,
                yieldProjection
            })
        }

        // Sort by health score and assign ranks
        groveComparisons.sort((a, b) => b.healthScore - a.healthScore)
        groveComparisons.forEach((grove, index) => {
            grove.rank = index + 1
        })

        // Generate insights
        const insights = this.generateGroveInsights(groveComparisons)

        return {
            reportDate: new Date(),
            groves: groveComparisons,
            insights
        }
    }

    private async buildYieldImpactAnalysis(groveId: number) {
        // Get health records and harvest data
        const healthRecords = await db.select()
            .from(treeHealthRecords)
            .where(eq(treeHealthRecords.groveId, groveId))
            .orderBy(desc(treeHealthRecords.assessmentDate))
            .limit(12) // Last 12 assessments

        const harvests = await db.select()
            .from(harvestRecords)
            .where(eq(harvestRecords.groveId, groveId))
            .orderBy(desc(harvestRecords.harvestDate))
            .limit(5) // Last 5 harvests

        // Calculate correlations between health scores and yields
        const correlationAnalysis = this.calculateHealthYieldCorrelation(healthRecords, harvests)

        // Project future yields based on current health trends
        const futureProjections = this.projectFutureYields(healthRecords)

        // Identify key impact factors
        const impactFactors = this.identifyYieldImpactFactors(healthRecords)

        return {
            groveId,
            currentHealthScore: healthRecords.length > 0 ? healthRecords[0].healthScore : 0,
            correlationAnalysis,
            futureProjections,
            impactFactors,
            recommendations: this.generateYieldOptimizationRecommendations(healthRecords, correlationAnalysis)
        }
    }

    private async buildMaintenanceEffectivenessReport(groveId: number, days: number) {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)

        const startTimestamp = Math.floor(startDate.getTime() / 1000)
        const endTimestamp = Math.floor(endDate.getTime() / 1000)

        // Get maintenance activities
        const activities = await db.select()
            .from(maintenanceActivities)
            .where(and(
                eq(maintenanceActivities.groveId, groveId),
                gte(maintenanceActivities.activityDate, startTimestamp),
                lte(maintenanceActivities.activityDate, endTimestamp)
            ))
            .orderBy(desc(maintenanceActivities.activityDate))

        // Get health records before and after maintenance
        const healthRecords = await db.select()
            .from(treeHealthRecords)
            .where(and(
                eq(treeHealthRecords.groveId, groveId),
                gte(treeHealthRecords.assessmentDate, startTimestamp - 7 * 24 * 60 * 60) // Include week before
            ))
            .orderBy(desc(treeHealthRecords.assessmentDate))

        // Analyze effectiveness of each activity type
        const effectivenessAnalysis = this.analyzeMaintenanceEffectiveness(activities, healthRecords)

        // Calculate ROI for maintenance activities
        const roiAnalysis = this.calculateMaintenanceROI(activities, healthRecords)

        return {
            groveId,
            reportPeriod: { startDate, endDate },
            totalActivities: activities.length,
            totalCost: activities.reduce((sum, a) => sum + (a.cost || 0), 0),
            effectivenessAnalysis,
            roiAnalysis,
            recommendations: this.generateMaintenanceRecommendations(effectivenessAnalysis)
        }
    }

    private async buildRiskAssessment(groveId: number) {
        // Get recent sensor data and health records
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

        const recentSensorData = await db.select()
            .from(iotSensorData)
            .where(and(
                eq(iotSensorData.groveId, groveId),
                gte(iotSensorData.timestamp, thirtyDaysAgo)
            ))

        const recentHealthRecords = await db.select()
            .from(treeHealthRecords)
            .where(and(
                eq(treeHealthRecords.groveId, groveId),
                gte(treeHealthRecords.assessmentDate, thirtyDaysAgo)
            ))
            .orderBy(desc(treeHealthRecords.assessmentDate))

        const activeAlerts = await db.select()
            .from(environmentalAlerts)
            .where(and(
                eq(environmentalAlerts.groveId, groveId),
                eq(environmentalAlerts.resolved, false)
            ))

        // Assess various risk categories
        const riskAssessment = {
            overallRiskLevel: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            riskCategories: {
                environmental: this.assessEnvironmentalRisk(recentSensorData, activeAlerts),
                disease: this.assessDiseaseRisk(recentHealthRecords, recentSensorData),
                pest: this.assessPestRisk(recentHealthRecords, recentSensorData),
                yield: this.assessYieldRisk(recentHealthRecords),
                financial: this.assessFinancialRisk(recentHealthRecords)
            },
            immediateActions: [] as string[],
            preventiveActions: [] as string[],
            monitoringRecommendations: [] as string[]
        }

        // Determine overall risk level
        const riskLevels = Object.values(riskAssessment.riskCategories).map(r => r.level)
        if (riskLevels.includes('CRITICAL')) {
            riskAssessment.overallRiskLevel = 'CRITICAL'
        } else if (riskLevels.includes('HIGH')) {
            riskAssessment.overallRiskLevel = 'HIGH'
        } else if (riskLevels.includes('MEDIUM')) {
            riskAssessment.overallRiskLevel = 'MEDIUM'
        }

        // Generate action recommendations
        riskAssessment.immediateActions = this.generateImmediateActions(riskAssessment.riskCategories)
        riskAssessment.preventiveActions = this.generatePreventiveActions(riskAssessment.riskCategories)
        riskAssessment.monitoringRecommendations = this.generateMonitoringRecommendations(riskAssessment.riskCategories)

        return riskAssessment
    }

    // Utility methods for analysis

    private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
        if (values.length < 2) return 'stable'

        const firstHalf = values.slice(0, Math.floor(values.length / 2))
        const secondHalf = values.slice(Math.floor(values.length / 2))

        const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length

        const difference = secondAvg - firstAvg
        if (difference > 5) return 'improving'
        if (difference < -5) return 'declining'
        return 'stable'
    }

    private buildSensorTrends(sensorData: any[]) {
        const trends: any = {}
        const sensorTypes = ['soil_moisture', 'temperature', 'humidity', 'ph', 'light', 'rainfall']

        sensorTypes.forEach(type => {
            const typeData = sensorData.filter(d => d.sensorType === type)
            if (typeData.length > 0) {
                const values = typeData.map(d => d.value)
                const current = values[0]
                const average = values.reduce((sum, v) => sum + v, 0) / values.length
                const trend = this.calculateTrend(values.slice(0, 20))

                trends[type] = {
                    current,
                    average: Math.round(average * 100) / 100,
                    trend,
                    readings: typeData.slice(0, 50).map(d => ({
                        date: new Date(d.timestamp * 1000),
                        value: d.value
                    }))
                }
            }
        })

        return trends
    }

    private buildMaintenanceImpact(maintenance: any[], healthRecords: any[]) {
        const totalCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0)
        const activitiesCount = maintenance.length

        // Find most common activity
        const activityCounts: { [key: string]: number } = {}
        maintenance.forEach(m => {
            activityCounts[m.activityType] = (activityCounts[m.activityType] || 0) + 1
        })
        const mostCommonActivity = Object.keys(activityCounts).reduce((a, b) => 
            activityCounts[a] > activityCounts[b] ? a : b, 'WATERING')

        // Calculate health improvement after maintenance (simplified)
        const healthImprovementAfterMaintenance = healthRecords.length > 1 
            ? healthRecords[0].healthScore - healthRecords[healthRecords.length - 1].healthScore
            : 0

        return {
            activitiesCount,
            totalCost,
            mostCommonActivity,
            healthImprovementAfterMaintenance
        }
    }

    private async buildYieldProjections(groveId: number, healthRecords: any[]) {
        const currentProjection = healthRecords.length > 0 
            ? (healthRecords[0].yieldImpactProjection || 0) * 100
            : 0

        // Get historical harvest data for comparison
        const historicalHarvests = await db.select()
            .from(harvestRecords)
            .where(eq(harvestRecords.groveId, groveId))
            .orderBy(desc(harvestRecords.harvestDate))
            .limit(5)

        const historicalComparison = historicalHarvests.length > 0
            ? historicalHarvests.reduce((sum, h) => sum + h.yieldKg, 0) / historicalHarvests.length
            : 5000 // Default expected yield

        const impactFactors = []
        if (healthRecords.length > 0) {
            const latest = healthRecords[0]
            if (latest.soilMoistureScore < 50) impactFactors.push('Low soil moisture')
            if (latest.temperatureScore < 50) impactFactors.push('Temperature stress')
            if (latest.phScore < 50) impactFactors.push('pH imbalance')
        }

        return {
            currentProjection,
            historicalComparison,
            impactFactors
        }
    }

    private generateRecommendations(healthRecords: any[], alerts: any[], sensorTrends: any): string[] {
        const recommendations = []

        // Health-based recommendations
        if (healthRecords.length > 0) {
            const latest = healthRecords[0]
            if (latest.healthScore < 60) {
                recommendations.push('Overall tree health needs improvement - follow specific sensor recommendations')
            }
            if (latest.recommendations) {
                recommendations.push(...latest.recommendations)
            }
        }

        // Alert-based recommendations
        const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.resolved)
        if (criticalAlerts.length > 0) {
            recommendations.push('Address critical alerts immediately to prevent tree damage')
        }

        // Sensor trend recommendations
        Object.entries(sensorTrends).forEach(([type, data]: [string, any]) => {
            if (data.trend === 'declining') {
                recommendations.push(`Monitor ${type.replace('_', ' ')} closely - showing declining trend`)
            }
        })

        return recommendations.slice(0, 10) // Limit to top 10 recommendations
    }

    private analyzeGrovePerformance(healthRecord: any) {
        const strengths = []
        const weaknesses = []

        if (!healthRecord) {
            return { strengths: ['No data available'], weaknesses: ['Insufficient monitoring data'] }
        }

        // Analyze individual metrics
        const metrics = {
            'Soil Moisture': healthRecord.soilMoistureScore,
            'Temperature': healthRecord.temperatureScore,
            'Humidity': healthRecord.humidityScore,
            'pH Level': healthRecord.phScore,
            'Light': healthRecord.lightScore,
            'Rainfall': healthRecord.rainfallScore
        }

        Object.entries(metrics).forEach(([metric, score]) => {
            if (score !== null && score !== undefined) {
                if (score >= 80) {
                    strengths.push(`Excellent ${metric.toLowerCase()}`)
                } else if (score < 50) {
                    weaknesses.push(`Poor ${metric.toLowerCase()}`)
                }
            }
        })

        if (strengths.length === 0) strengths.push('Stable conditions')
        if (weaknesses.length === 0) weaknesses.push('No major issues identified')

        return { strengths, weaknesses }
    }

    private generateGroveInsights(groves: any[]) {
        const bestPerforming = groves[0]
        const needsAttention = groves.filter(g => g.healthScore < 60)
        
        // Find common issues
        const allWeaknesses = groves.flatMap(g => g.weaknesses)
        const weaknessCounts: { [key: string]: number } = {}
        allWeaknesses.forEach(w => {
            weaknessCounts[w] = (weaknessCounts[w] || 0) + 1
        })
        const commonIssues = Object.entries(weaknessCounts)
            .filter(([_, count]) => count > 1)
            .map(([issue, _]) => issue)

        // Find best practices
        const allStrengths = groves.filter(g => g.healthScore >= 80).flatMap(g => g.strengths)
        const strengthCounts: { [key: string]: number } = {}
        allStrengths.forEach(s => {
            strengthCounts[s] = (strengthCounts[s] || 0) + 1
        })
        const bestPractices = Object.entries(strengthCounts)
            .filter(([_, count]) => count > 1)
            .map(([practice, _]) => practice)

        return {
            bestPerforming,
            needsAttention,
            commonIssues,
            bestPractices
        }
    }

    private calculateHealthYieldCorrelation(healthRecords: any[], harvests: any[]) {
        // Simplified correlation analysis
        if (healthRecords.length === 0 || harvests.length === 0) {
            return {
                correlation: 0,
                confidence: 'low',
                insights: ['Insufficient data for correlation analysis']
            }
        }

        // This would be a more sophisticated statistical analysis in a real implementation
        const avgHealthScore = healthRecords.reduce((sum, h) => sum + h.healthScore, 0) / healthRecords.length
        const avgYield = harvests.reduce((sum, h) => sum + h.yieldKg, 0) / harvests.length

        return {
            correlation: 0.75, // Mock correlation
            confidence: 'medium',
            insights: [
                `Average health score: ${avgHealthScore.toFixed(1)}`,
                `Average yield: ${avgYield.toFixed(0)} kg`,
                'Higher health scores generally correlate with better yields'
            ]
        }
    }

    private projectFutureYields(healthRecords: any[]) {
        if (healthRecords.length === 0) {
            return {
                nextHarvest: 5000,
                confidence: 'low',
                factors: ['No health data available']
            }
        }

        const currentHealth = healthRecords[0].healthScore
        const baseYield = 5000 // kg
        const projectedYield = baseYield * (1 + (currentHealth - 70) / 100)

        return {
            nextHarvest: Math.max(0, Math.round(projectedYield)),
            confidence: healthRecords.length > 5 ? 'high' : 'medium',
            factors: [
                `Current health score: ${currentHealth}`,
                'Based on recent health trends',
                'Weather conditions not factored'
            ]
        }
    }

    private identifyYieldImpactFactors(healthRecords: any[]) {
        const factors = []

        if (healthRecords.length > 0) {
            const latest = healthRecords[0]
            
            if (latest.soilMoistureScore < 60) factors.push('Soil moisture stress')
            if (latest.temperatureScore < 60) factors.push('Temperature stress')
            if (latest.phScore < 60) factors.push('Nutrient availability issues')
            if (latest.riskFactors) {
                factors.push(...JSON.parse(latest.riskFactors))
            }
        }

        return factors.length > 0 ? factors : ['No significant impact factors identified']
    }

    private generateYieldOptimizationRecommendations(healthRecords: any[], correlationAnalysis: any) {
        const recommendations = []

        if (correlationAnalysis.correlation > 0.5) {
            recommendations.push('Focus on maintaining high health scores to optimize yields')
        }

        if (healthRecords.length > 0) {
            const latest = healthRecords[0]
            if (latest.healthScore < 70) {
                recommendations.push('Improve overall tree health to increase yield potential')
            }
            if (latest.recommendations) {
                recommendations.push(...JSON.parse(latest.recommendations))
            }
        }

        return recommendations.slice(0, 5)
    }

    private analyzeMaintenanceEffectiveness(activities: any[], healthRecords: any[]) {
        // Group activities by type and analyze their impact
        const activityTypes = ['WATERING', 'FERTILIZING', 'PRUNING', 'PEST_TREATMENT', 'DISEASE_TREATMENT', 'SOIL_AMENDMENT']
        const effectiveness: any = {}

        activityTypes.forEach(type => {
            const typeActivities = activities.filter(a => a.activityType === type)
            if (typeActivities.length > 0) {
                effectiveness[type] = {
                    count: typeActivities.length,
                    totalCost: typeActivities.reduce((sum, a) => sum + (a.cost || 0), 0),
                    averageCost: typeActivities.reduce((sum, a) => sum + (a.cost || 0), 0) / typeActivities.length,
                    effectiveness: 'medium', // Would be calculated based on health improvements
                    recommendations: this.getActivityRecommendations(type)
                }
            }
        })

        return effectiveness
    }

    private calculateMaintenanceROI(activities: any[], healthRecords: any[]) {
        const totalCost = activities.reduce((sum, a) => sum + (a.cost || 0), 0)
        const healthImprovement = healthRecords.length > 1 
            ? healthRecords[0].healthScore - healthRecords[healthRecords.length - 1].healthScore
            : 0

        // Simplified ROI calculation
        const estimatedYieldIncrease = healthImprovement * 50 // kg per health point
        const estimatedRevenue = estimatedYieldIncrease * 3 // $3 per kg
        const roi = totalCost > 0 ? ((estimatedRevenue - totalCost) / totalCost) * 100 : 0

        return {
            totalInvestment: totalCost,
            estimatedReturn: estimatedRevenue,
            roi: Math.round(roi),
            paybackPeriod: roi > 0 ? Math.round(12 / (roi / 100)) : null // months
        }
    }

    private generateMaintenanceRecommendations(effectivenessAnalysis: any) {
        const recommendations = []

        Object.entries(effectivenessAnalysis).forEach(([type, data]: [string, any]) => {
            if (data.effectiveness === 'low') {
                recommendations.push(`Review ${type.toLowerCase()} practices for better effectiveness`)
            }
            if (data.averageCost > 10000) { // $100
                recommendations.push(`Consider cost optimization for ${type.toLowerCase()} activities`)
            }
        })

        return recommendations
    }

    private getActivityRecommendations(activityType: string): string[] {
        const recommendations: { [key: string]: string[] } = {
            'WATERING': ['Monitor soil moisture levels', 'Water during cooler hours', 'Use drip irrigation for efficiency'],
            'FERTILIZING': ['Test soil before fertilizing', 'Use organic fertilizers when possible', 'Follow recommended application rates'],
            'PRUNING': ['Prune during dormant season', 'Remove diseased branches first', 'Maintain proper tree shape'],
            'PEST_TREATMENT': ['Use integrated pest management', 'Monitor pest populations regularly', 'Apply treatments at optimal timing'],
            'DISEASE_TREATMENT': ['Identify disease accurately before treatment', 'Improve air circulation', 'Remove infected plant material'],
            'SOIL_AMENDMENT': ['Test soil pH regularly', 'Add organic matter annually', 'Ensure proper drainage']
        }

        return recommendations[activityType] || ['Follow best practices for this activity']
    }

    private assessEnvironmentalRisk(sensorData: any[], alerts: any[]) {
        const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL')
        const highAlerts = alerts.filter(a => a.severity === 'HIGH')

        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const factors = []

        if (criticalAlerts.length > 0) {
            level = 'CRITICAL'
            factors.push(`${criticalAlerts.length} critical environmental alerts`)
        } else if (highAlerts.length > 2) {
            level = 'HIGH'
            factors.push(`${highAlerts.length} high-priority environmental alerts`)
        } else if (alerts.length > 5) {
            level = 'MEDIUM'
            factors.push('Multiple environmental concerns detected')
        }

        return { level, factors, description: 'Environmental conditions assessment' }
    }

    private assessDiseaseRisk(healthRecords: any[], sensorData: any[]) {
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const factors = []

        // Check for conditions that promote disease
        const highHumidity = sensorData.filter(d => d.sensorType === 'humidity' && d.value > 85).length
        const poorAirflow = healthRecords.some(h => h.riskFactors && JSON.parse(h.riskFactors).includes('DISEASE_RISK'))

        if (poorAirflow) {
            level = 'HIGH'
            factors.push('Disease risk factors identified in health assessment')
        } else if (highHumidity > 10) {
            level = 'MEDIUM'
            factors.push('High humidity conditions favor disease development')
        }

        return { level, factors, description: 'Disease susceptibility assessment' }
    }

    private assessPestRisk(healthRecords: any[], sensorData: any[]) {
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const factors = []

        const pestRiskDetected = healthRecords.some(h => 
            h.riskFactors && JSON.parse(h.riskFactors).includes('PEST_RISK'))

        if (pestRiskDetected) {
            level = 'MEDIUM'
            factors.push('Pest risk indicators detected')
        }

        return { level, factors, description: 'Pest infestation risk assessment' }
    }

    private assessYieldRisk(healthRecords: any[]) {
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const factors = []

        if (healthRecords.length > 0) {
            const avgHealth = healthRecords.reduce((sum, h) => sum + h.healthScore, 0) / healthRecords.length
            const yieldImpact = healthRecords[0].yieldImpactProjection || 0

            if (avgHealth < 40 || yieldImpact < -0.3) {
                level = 'CRITICAL'
                factors.push('Severe yield reduction expected')
            } else if (avgHealth < 60 || yieldImpact < -0.1) {
                level = 'HIGH'
                factors.push('Moderate yield reduction likely')
            } else if (avgHealth < 75) {
                level = 'MEDIUM'
                factors.push('Minor yield impact possible')
            }
        }

        return { level, factors, description: 'Yield performance risk assessment' }
    }

    private assessFinancialRisk(healthRecords: any[]) {
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const factors = []

        if (healthRecords.length > 0) {
            const yieldImpact = healthRecords[0].yieldImpactProjection || 0
            
            if (yieldImpact < -0.5) {
                level = 'CRITICAL'
                factors.push('Severe financial impact from yield loss')
            } else if (yieldImpact < -0.2) {
                level = 'HIGH'
                factors.push('Significant financial impact expected')
            } else if (yieldImpact < 0) {
                level = 'MEDIUM'
                factors.push('Minor financial impact from reduced yields')
            }
        }

        return { level, factors, description: 'Financial impact risk assessment' }
    }

    private generateImmediateActions(riskCategories: any): string[] {
        const actions = []

        Object.entries(riskCategories).forEach(([category, risk]: [string, any]) => {
            if (risk.level === 'CRITICAL') {
                switch (category) {
                    case 'environmental':
                        actions.push('Address critical environmental alerts immediately')
                        break
                    case 'disease':
                        actions.push('Implement disease control measures urgently')
                        break
                    case 'yield':
                        actions.push('Take emergency measures to protect yield')
                        break
                }
            }
        })

        return actions
    }

    private generatePreventiveActions(riskCategories: any): string[] {
        const actions = []

        Object.entries(riskCategories).forEach(([category, risk]: [string, any]) => {
            if (risk.level === 'HIGH' || risk.level === 'MEDIUM') {
                switch (category) {
                    case 'environmental':
                        actions.push('Improve environmental monitoring and controls')
                        break
                    case 'disease':
                        actions.push('Implement preventive disease management practices')
                        break
                    case 'pest':
                        actions.push('Establish integrated pest management program')
                        break
                }
            }
        })

        return actions
    }

    private generateMonitoringRecommendations(riskCategories: any): string[] {
        const recommendations = []

        Object.entries(riskCategories).forEach(([category, risk]: [string, any]) => {
            if (risk.level !== 'LOW') {
                switch (category) {
                    case 'environmental':
                        recommendations.push('Increase frequency of environmental sensor readings')
                        break
                    case 'disease':
                        recommendations.push('Monitor for early disease symptoms weekly')
                        break
                    case 'pest':
                        recommendations.push('Conduct regular pest population surveys')
                        break
                }
            }
        })

        return recommendations
    }
}