/**
 * Tree Monitoring API Service
 * 
 * Handles IoT sensor data ingestion, tree health scoring, and environmental alerts
 * for the coffee tree tokenization platform.
 */

import { IncomingMessage, ServerResponse } from 'http'
import { db } from '../db'
import { 
    iotSensorData, 
    treeHealthRecords, 
    environmentalAlerts, 
    maintenanceActivities, 
    sensorConfigurations,
    coffeeGroves 
} from '../db/schema'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { 
    IoTSensorData, 
    TreeHealthRecord, 
    EnvironmentalAlert, 
    MaintenanceActivity, 
    SensorConfiguration,
    IoTSensorDataRow,
    TreeHealthRecordRow,
    EnvironmentalAlertRow,
    MaintenanceActivityRow,
    SensorConfigurationRow
} from '../types'

// Enhanced request interface
interface EnhancedRequest extends IncomingMessage {
    body?: any
    params?: { [key: string]: string }
    query?: { [key: string]: string | string[] | undefined }
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

// Convert database row to interface
function convertSensorDataRow(row: IoTSensorDataRow): IoTSensorData {
    return {
        id: row.id,
        groveId: row.groveId,
        sensorId: row.sensorId,
        sensorType: row.sensorType as any,
        value: row.value,
        unit: row.unit,
        location: row.locationLat && row.locationLng ? {
            lat: row.locationLat,
            lng: row.locationLng
        } : undefined,
        timestamp: new Date(row.timestamp * 1000),
        createdAt: new Date((row.createdAt || 0) * 1000)
    }
}

function convertHealthRecordRow(row: TreeHealthRecordRow): TreeHealthRecord {
    return {
        id: row.id,
        groveId: row.groveId,
        healthScore: row.healthScore,
        assessmentDate: new Date(row.assessmentDate * 1000),
        soilMoistureScore: row.soilMoistureScore || undefined,
        temperatureScore: row.temperatureScore || undefined,
        humidityScore: row.humidityScore || undefined,
        phScore: row.phScore || undefined,
        lightScore: row.lightScore || undefined,
        rainfallScore: row.rainfallScore || undefined,
        riskFactors: row.riskFactors ? JSON.parse(row.riskFactors) : [],
        recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
        yieldImpactProjection: row.yieldImpactProjection || undefined,
        createdAt: new Date((row.createdAt || 0) * 1000)
    }
}

function convertAlertRow(row: EnvironmentalAlertRow): EnvironmentalAlert {
    return {
        id: row.id,
        groveId: row.groveId,
        alertType: row.alertType as any,
        severity: row.severity as any,
        title: row.title,
        message: row.message,
        sensorDataId: row.sensorDataId || undefined,
        healthRecordId: row.healthRecordId || undefined,
        farmerNotified: row.farmerNotified,
        investorNotified: row.investorNotified,
        acknowledged: row.acknowledged,
        resolved: row.resolved,
        createdAt: new Date((row.createdAt || 0) * 1000),
        resolvedAt: row.resolvedAt ? new Date(row.resolvedAt * 1000) : undefined
    }
}

export class TreeMonitoringAPI {
    
    /**
     * Ingest IoT sensor data from devices
     * POST /api/tree-monitoring/sensor-data
     */
    async ingestSensorData(req: EnhancedRequest, res: ServerResponse) {
        try {
            const { groveId, sensorId, sensorType, value, unit, location, timestamp } = req.body

            // Validate required fields
            if (!groveId || !sensorId || !sensorType || value === undefined || !unit) {
                return sendError(res, 400, 'Missing required fields: groveId, sensorId, sensorType, value, unit')
            }

            // Validate sensor type
            const validSensorTypes = ['soil_moisture', 'temperature', 'humidity', 'ph', 'light', 'rainfall']
            if (!validSensorTypes.includes(sensorType)) {
                return sendError(res, 400, `Invalid sensor type. Must be one of: ${validSensorTypes.join(', ')}`)
            }

            // Validate grove exists
            const grove = await db.select().from(coffeeGroves).where(eq(coffeeGroves.id, groveId)).limit(1)
            if (grove.length === 0) {
                return sendError(res, 404, 'Grove not found')
            }

            // Validate sensor data
            const validationResult = await this.validateSensorData(groveId, sensorType, value, unit)
            if (!validationResult.valid) {
                return sendError(res, 400, `Invalid sensor data: ${validationResult.error}`)
            }

            // Insert sensor data
            const sensorDataTimestamp = timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000)
            
            const [insertedData] = await db.insert(iotSensorData).values({
                groveId,
                sensorId,
                sensorType,
                value,
                unit,
                locationLat: location?.lat || null,
                locationLng: location?.lng || null,
                timestamp: sensorDataTimestamp
            }).returning()

            // Check if this reading triggers any alerts
            await this.checkForEnvironmentalAlerts(groveId, sensorType, value, insertedData.id)

            // Update tree health score if enough recent data is available
            await this.updateTreeHealthScore(groveId)

            sendResponse(res, 201, {
                success: true,
                message: 'Sensor data ingested successfully',
                data: convertSensorDataRow(insertedData as IoTSensorDataRow)
            })

        } catch (error) {
            console.error('Error ingesting sensor data:', error)
            sendError(res, 500, 'Failed to ingest sensor data')
        }
    }

    /**
     * Get sensor data for a grove
     * GET /api/tree-monitoring/sensor-data/:groveId
     */
    async getSensorData(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { sensorType, startDate, endDate, limit = '100' } = req.query as any
            const limitNum = Math.min(parseInt(limit) || 100, 1000) // Max 1000 records

            let query = db.select().from(iotSensorData).where(eq(iotSensorData.groveId, groveIdNum))

            // Filter by sensor type if provided
            if (sensorType) {
                query = query.where(and(
                    eq(iotSensorData.groveId, groveIdNum),
                    eq(iotSensorData.sensorType, sensorType as string)
                ))
            }

            // Filter by date range if provided
            if (startDate) {
                const startTimestamp = Math.floor(new Date(startDate as string).getTime() / 1000)
                query = query.where(and(
                    eq(iotSensorData.groveId, groveIdNum),
                    gte(iotSensorData.timestamp, startTimestamp)
                ))
            }

            if (endDate) {
                const endTimestamp = Math.floor(new Date(endDate as string).getTime() / 1000)
                query = query.where(and(
                    eq(iotSensorData.groveId, groveIdNum),
                    lte(iotSensorData.timestamp, endTimestamp)
                ))
            }

            const data = await query
                .orderBy(desc(iotSensorData.timestamp))
                .limit(limitNum)

            const convertedData = data.map(row => convertSensorDataRow(row as IoTSensorDataRow))

            sendResponse(res, 200, {
                success: true,
                data: convertedData,
                count: convertedData.length
            })

        } catch (error) {
            console.error('Error fetching sensor data:', error)
            sendError(res, 500, 'Failed to fetch sensor data')
        }
    }

    /**
     * Get tree health records for a grove
     * GET /api/tree-monitoring/health/:groveId
     */
    async getTreeHealth(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { limit = '50' } = req.query as any
            const limitNum = Math.min(parseInt(limit) || 50, 200)

            const healthRecords = await db.select()
                .from(treeHealthRecords)
                .where(eq(treeHealthRecords.groveId, groveIdNum))
                .orderBy(desc(treeHealthRecords.assessmentDate))
                .limit(limitNum)

            const convertedRecords = healthRecords.map(row => convertHealthRecordRow(row as TreeHealthRecordRow))

            sendResponse(res, 200, {
                success: true,
                data: convertedRecords,
                count: convertedRecords.length
            })

        } catch (error) {
            console.error('Error fetching tree health records:', error)
            sendError(res, 500, 'Failed to fetch tree health records')
        }
    }

    /**
     * Get environmental alerts for a grove
     * GET /api/tree-monitoring/alerts/:groveId
     */
    async getEnvironmentalAlerts(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { resolved = 'false', severity, limit = '50' } = req.query as any
            const limitNum = Math.min(parseInt(limit) || 50, 200)
            const showResolved = resolved === 'true'

            let query = db.select().from(environmentalAlerts).where(eq(environmentalAlerts.groveId, groveIdNum))

            if (!showResolved) {
                query = query.where(and(
                    eq(environmentalAlerts.groveId, groveIdNum),
                    eq(environmentalAlerts.resolved, false)
                ))
            }

            if (severity) {
                query = query.where(and(
                    eq(environmentalAlerts.groveId, groveIdNum),
                    eq(environmentalAlerts.severity, severity as string)
                ))
            }

            const alerts = await query
                .orderBy(desc(environmentalAlerts.createdAt))
                .limit(limitNum)

            const convertedAlerts = alerts.map(row => convertAlertRow(row as EnvironmentalAlertRow))

            sendResponse(res, 200, {
                success: true,
                data: convertedAlerts,
                count: convertedAlerts.length
            })

        } catch (error) {
            console.error('Error fetching environmental alerts:', error)
            sendError(res, 500, 'Failed to fetch environmental alerts')
        }
    }

    /**
     * Acknowledge an environmental alert
     * POST /api/tree-monitoring/alerts/:alertId/acknowledge
     */
    async acknowledgeAlert(req: EnhancedRequest, res: ServerResponse, alertId: string) {
        try {
            const alertIdNum = parseInt(alertId)
            if (isNaN(alertIdNum)) {
                return sendError(res, 400, 'Invalid alert ID')
            }

            const [updatedAlert] = await db.update(environmentalAlerts)
                .set({ acknowledged: true })
                .where(eq(environmentalAlerts.id, alertIdNum))
                .returning()

            if (!updatedAlert) {
                return sendError(res, 404, 'Alert not found')
            }

            sendResponse(res, 200, {
                success: true,
                message: 'Alert acknowledged successfully',
                data: convertAlertRow(updatedAlert as EnvironmentalAlertRow)
            })

        } catch (error) {
            console.error('Error acknowledging alert:', error)
            sendError(res, 500, 'Failed to acknowledge alert')
        }
    }

    /**
     * Resolve an environmental alert
     * POST /api/tree-monitoring/alerts/:alertId/resolve
     */
    async resolveAlert(req: EnhancedRequest, res: ServerResponse, alertId: string) {
        try {
            const alertIdNum = parseInt(alertId)
            if (isNaN(alertIdNum)) {
                return sendError(res, 400, 'Invalid alert ID')
            }

            const resolvedAt = Math.floor(Date.now() / 1000)

            const [updatedAlert] = await db.update(environmentalAlerts)
                .set({ 
                    resolved: true,
                    resolvedAt: resolvedAt
                })
                .where(eq(environmentalAlerts.id, alertIdNum))
                .returning()

            if (!updatedAlert) {
                return sendError(res, 404, 'Alert not found')
            }

            sendResponse(res, 200, {
                success: true,
                message: 'Alert resolved successfully',
                data: convertAlertRow(updatedAlert as EnvironmentalAlertRow)
            })

        } catch (error) {
            console.error('Error resolving alert:', error)
            sendError(res, 500, 'Failed to resolve alert')
        }
    }

    /**
     * Log maintenance activity
     * POST /api/tree-monitoring/maintenance
     */
    async logMaintenanceActivity(req: EnhancedRequest, res: ServerResponse) {
        try {
            const {
                groveId,
                farmerAddress,
                activityType,
                description,
                cost,
                materialsUsed,
                areaTreated,
                weatherConditions,
                notes,
                activityDate
            } = req.body

            // Validate required fields
            if (!groveId || !farmerAddress || !activityType || !description || !activityDate) {
                return sendError(res, 400, 'Missing required fields: groveId, farmerAddress, activityType, description, activityDate')
            }

            // Validate activity type
            const validActivityTypes = ['WATERING', 'FERTILIZING', 'PRUNING', 'PEST_TREATMENT', 'DISEASE_TREATMENT', 'SOIL_AMENDMENT']
            if (!validActivityTypes.includes(activityType)) {
                return sendError(res, 400, `Invalid activity type. Must be one of: ${validActivityTypes.join(', ')}`)
            }

            // Validate grove exists
            const grove = await db.select().from(coffeeGroves).where(eq(coffeeGroves.id, groveId)).limit(1)
            if (grove.length === 0) {
                return sendError(res, 404, 'Grove not found')
            }

            const activityTimestamp = Math.floor(new Date(activityDate).getTime() / 1000)

            const [insertedActivity] = await db.insert(maintenanceActivities).values({
                groveId,
                farmerAddress,
                activityType,
                description,
                cost: cost || null,
                materialsUsed: materialsUsed ? JSON.stringify(materialsUsed) : null,
                areaTreated: areaTreated || null,
                weatherConditions: weatherConditions || null,
                notes: notes || null,
                activityDate: activityTimestamp
            }).returning()

            sendResponse(res, 201, {
                success: true,
                message: 'Maintenance activity logged successfully',
                data: {
                    id: insertedActivity.id,
                    groveId: insertedActivity.groveId,
                    farmerAddress: insertedActivity.farmerAddress,
                    activityType: insertedActivity.activityType,
                    description: insertedActivity.description,
                    cost: insertedActivity.cost,
                    materialsUsed: insertedActivity.materialsUsed ? JSON.parse(insertedActivity.materialsUsed) : [],
                    areaTreated: insertedActivity.areaTreated,
                    weatherConditions: insertedActivity.weatherConditions,
                    notes: insertedActivity.notes,
                    activityDate: new Date(insertedActivity.activityDate * 1000),
                    createdAt: new Date((insertedActivity.createdAt || 0) * 1000)
                }
            })

        } catch (error) {
            console.error('Error logging maintenance activity:', error)
            sendError(res, 500, 'Failed to log maintenance activity')
        }
    }

    /**
     * Get maintenance activities for a grove
     * GET /api/tree-monitoring/maintenance/:groveId
     */
    async getMaintenanceActivities(req: EnhancedRequest, res: ServerResponse, groveId: string) {
        try {
            const groveIdNum = parseInt(groveId)
            if (isNaN(groveIdNum)) {
                return sendError(res, 400, 'Invalid grove ID')
            }

            const { activityType, startDate, endDate, limit = '50' } = req.query as any
            const limitNum = Math.min(parseInt(limit) || 50, 200)

            let query = db.select().from(maintenanceActivities).where(eq(maintenanceActivities.groveId, groveIdNum))

            if (activityType) {
                query = query.where(and(
                    eq(maintenanceActivities.groveId, groveIdNum),
                    eq(maintenanceActivities.activityType, activityType as string)
                ))
            }

            if (startDate) {
                const startTimestamp = Math.floor(new Date(startDate as string).getTime() / 1000)
                query = query.where(and(
                    eq(maintenanceActivities.groveId, groveIdNum),
                    gte(maintenanceActivities.activityDate, startTimestamp)
                ))
            }

            if (endDate) {
                const endTimestamp = Math.floor(new Date(endDate as string).getTime() / 1000)
                query = query.where(and(
                    eq(maintenanceActivities.groveId, groveIdNum),
                    lte(maintenanceActivities.activityDate, endTimestamp)
                ))
            }

            const activities = await query
                .orderBy(desc(maintenanceActivities.activityDate))
                .limit(limitNum)

            const convertedActivities = activities.map((row: MaintenanceActivityRow) => ({
                id: row.id,
                groveId: row.groveId,
                farmerAddress: row.farmerAddress,
                activityType: row.activityType,
                description: row.description,
                cost: row.cost,
                materialsUsed: row.materialsUsed ? JSON.parse(row.materialsUsed) : [],
                areaTreated: row.areaTreated,
                weatherConditions: row.weatherConditions,
                notes: row.notes,
                activityDate: new Date(row.activityDate * 1000),
                createdAt: new Date((row.createdAt || 0) * 1000)
            }))

            sendResponse(res, 200, {
                success: true,
                data: convertedActivities,
                count: convertedActivities.length
            })

        } catch (error) {
            console.error('Error fetching maintenance activities:', error)
            sendError(res, 500, 'Failed to fetch maintenance activities')
        }
    }

    // Private helper methods

    /**
     * Validate sensor data against expected ranges
     */
    private async validateSensorData(groveId: number, sensorType: string, value: number, unit: string): Promise<{ valid: boolean; error?: string }> {
        try {
            // Get sensor configuration for this grove and sensor type
            const config = await db.select()
                .from(sensorConfigurations)
                .where(and(
                    eq(sensorConfigurations.groveId, groveId),
                    eq(sensorConfigurations.sensorType, sensorType)
                ))
                .limit(1)

            // If no specific configuration, use default validation ranges
            const defaultRanges = this.getDefaultSensorRanges(sensorType, unit)
            const ranges = config.length > 0 ? {
                min: config[0].criticalMin,
                max: config[0].criticalMax,
                unit: config[0].unit
            } : defaultRanges

            if (!ranges) {
                return { valid: false, error: `Unknown sensor type: ${sensorType}` }
            }

            if (unit !== ranges.unit) {
                return { valid: false, error: `Invalid unit. Expected ${ranges.unit}, got ${unit}` }
            }

            if (value < ranges.min || value > ranges.max) {
                return { valid: false, error: `Value ${value} ${unit} is outside acceptable range (${ranges.min}-${ranges.max} ${ranges.unit})` }
            }

            return { valid: true }

        } catch (error) {
            console.error('Error validating sensor data:', error)
            return { valid: false, error: 'Validation failed' }
        }
    }

    /**
     * Get default sensor ranges for validation
     */
    private getDefaultSensorRanges(sensorType: string, unit: string) {
        const ranges: { [key: string]: { min: number; max: number; unit: string } } = {
            'soil_moisture': { min: 0, max: 100, unit: '%' },
            'temperature': unit === 'C' ? { min: -10, max: 50, unit: 'C' } : { min: 14, max: 122, unit: 'F' },
            'humidity': { min: 0, max: 100, unit: '%' },
            'ph': { min: 0, max: 14, unit: 'pH' },
            'light': { min: 0, max: 100000, unit: 'lux' },
            'rainfall': { min: 0, max: 500, unit: 'mm' }
        }

        return ranges[sensorType] || null
    }

    /**
     * Check if sensor reading triggers environmental alerts
     */
    private async checkForEnvironmentalAlerts(groveId: number, sensorType: string, value: number, sensorDataId: number) {
        try {
            // Get sensor configuration
            const config = await db.select()
                .from(sensorConfigurations)
                .where(and(
                    eq(sensorConfigurations.groveId, groveId),
                    eq(sensorConfigurations.sensorType, sensorType)
                ))
                .limit(1)

            if (config.length === 0) {
                return // No configuration, no alerts
            }

            const { criticalMin, criticalMax, warningMin, warningMax } = config[0]
            let alertType: string | null = null
            let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
            let title = ''
            let message = ''

            // Determine alert type and severity
            if (value <= criticalMin || value >= criticalMax) {
                severity = 'CRITICAL'
                if (sensorType === 'soil_moisture' && value <= criticalMin) {
                    alertType = 'DROUGHT_RISK'
                    title = 'Critical Drought Risk'
                    message = `Soil moisture critically low at ${value}%. Immediate irrigation required.`
                } else if (sensorType === 'temperature' && (value <= criticalMin || value >= criticalMax)) {
                    alertType = 'TEMPERATURE_EXTREME'
                    title = 'Extreme Temperature Alert'
                    message = `Temperature at critical level: ${value}°. Tree stress likely.`
                } else if (sensorType === 'ph' && (value <= criticalMin || value >= criticalMax)) {
                    alertType = 'NUTRIENT_DEFICIENCY'
                    title = 'Critical pH Level'
                    message = `Soil pH at critical level: ${value}. Nutrient absorption severely impacted.`
                }
            } else if (value <= warningMin || value >= warningMax) {
                severity = 'HIGH'
                if (sensorType === 'soil_moisture' && value <= warningMin) {
                    alertType = 'DROUGHT_RISK'
                    title = 'Low Soil Moisture'
                    message = `Soil moisture low at ${value}%. Consider irrigation soon.`
                } else if (sensorType === 'temperature' && (value <= warningMin || value >= warningMax)) {
                    alertType = 'TEMPERATURE_EXTREME'
                    title = 'Temperature Warning'
                    message = `Temperature outside optimal range: ${value}°. Monitor tree stress.`
                }
            }

            // Create alert if conditions are met
            if (alertType) {
                await db.insert(environmentalAlerts).values({
                    groveId,
                    alertType,
                    severity,
                    title,
                    message,
                    sensorDataId,
                    farmerNotified: false,
                    investorNotified: false,
                    acknowledged: false,
                    resolved: false
                })
            }

        } catch (error) {
            console.error('Error checking for environmental alerts:', error)
        }
    }

    /**
     * Update tree health score based on recent sensor data
     */
    private async updateTreeHealthScore(groveId: number) {
        try {
            // Get recent sensor data (last 24 hours)
            const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
            
            const recentData = await db.select()
                .from(iotSensorData)
                .where(and(
                    eq(iotSensorData.groveId, groveId),
                    gte(iotSensorData.timestamp, oneDayAgo)
                ))

            if (recentData.length === 0) {
                return // No recent data to calculate health score
            }

            // Calculate health scores for each sensor type
            const sensorScores: { [key: string]: number } = {}
            const sensorTypes = ['soil_moisture', 'temperature', 'humidity', 'ph', 'light', 'rainfall']

            for (const sensorType of sensorTypes) {
                const typeData = recentData.filter(d => d.sensorType === sensorType)
                if (typeData.length > 0) {
                    sensorScores[sensorType] = await this.calculateSensorHealthScore(groveId, sensorType, typeData)
                }
            }

            // Calculate overall health score (weighted average)
            const weights = {
                soil_moisture: 0.25,
                temperature: 0.20,
                humidity: 0.15,
                ph: 0.20,
                light: 0.10,
                rainfall: 0.10
            }

            let totalScore = 0
            let totalWeight = 0

            for (const [sensorType, score] of Object.entries(sensorScores)) {
                const weight = weights[sensorType as keyof typeof weights] || 0
                totalScore += score * weight
                totalWeight += weight
            }

            const overallHealthScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50

            // Generate risk factors and recommendations
            const { riskFactors, recommendations, yieldImpactProjection } = this.generateHealthAssessment(sensorScores)

            // Insert health record
            await db.insert(treeHealthRecords).values({
                groveId,
                healthScore: overallHealthScore,
                assessmentDate: Math.floor(Date.now() / 1000),
                soilMoistureScore: sensorScores.soil_moisture ? Math.round(sensorScores.soil_moisture) : null,
                temperatureScore: sensorScores.temperature ? Math.round(sensorScores.temperature) : null,
                humidityScore: sensorScores.humidity ? Math.round(sensorScores.humidity) : null,
                phScore: sensorScores.ph ? Math.round(sensorScores.ph) : null,
                lightScore: sensorScores.light ? Math.round(sensorScores.light) : null,
                rainfallScore: sensorScores.rainfall ? Math.round(sensorScores.rainfall) : null,
                riskFactors: JSON.stringify(riskFactors),
                recommendations: JSON.stringify(recommendations),
                yieldImpactProjection
            })

            // Update grove's current health score
            await db.update(coffeeGroves)
                .set({ currentHealthScore: overallHealthScore })
                .where(eq(coffeeGroves.id, groveId))

        } catch (error) {
            console.error('Error updating tree health score:', error)
        }
    }

    /**
     * Calculate health score for a specific sensor type
     */
    private async calculateSensorHealthScore(groveId: number, sensorType: string, data: any[]): Promise<number> {
        // Get sensor configuration
        const config = await db.select()
            .from(sensorConfigurations)
            .where(and(
                eq(sensorConfigurations.groveId, groveId),
                eq(sensorConfigurations.sensorType, sensorType)
            ))
            .limit(1)

        if (config.length === 0) {
            return 50 // Default neutral score if no configuration
        }

        const { optimalMin, optimalMax, warningMin, warningMax, criticalMin, criticalMax } = config[0]

        // Calculate average value from recent readings
        const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length

        // Score based on how close to optimal range
        if (avgValue >= optimalMin && avgValue <= optimalMax) {
            return 100 // Perfect score in optimal range
        } else if (avgValue >= warningMin && avgValue <= warningMax) {
            // Linear interpolation between optimal and warning ranges
            if (avgValue < optimalMin) {
                return 75 + (25 * (avgValue - warningMin) / (optimalMin - warningMin))
            } else {
                return 75 + (25 * (warningMax - avgValue) / (warningMax - optimalMax))
            }
        } else if (avgValue >= criticalMin && avgValue <= criticalMax) {
            // Linear interpolation between warning and critical ranges
            if (avgValue < warningMin) {
                return 25 + (50 * (avgValue - criticalMin) / (warningMin - criticalMin))
            } else {
                return 25 + (50 * (criticalMax - avgValue) / (criticalMax - warningMax))
            }
        } else {
            return 0 // Critical range exceeded
        }
    }

    /**
     * Generate risk factors and recommendations based on sensor scores
     */
    private generateHealthAssessment(sensorScores: { [key: string]: number }) {
        const riskFactors: string[] = []
        const recommendations: string[] = []
        let yieldImpactProjection = 0

        // Analyze each sensor type
        for (const [sensorType, score] of Object.entries(sensorScores)) {
            if (score < 25) {
                // Critical issues
                switch (sensorType) {
                    case 'soil_moisture':
                        riskFactors.push('SEVERE_DROUGHT_STRESS')
                        recommendations.push('Implement emergency irrigation immediately')
                        yieldImpactProjection -= 0.3
                        break
                    case 'temperature':
                        riskFactors.push('EXTREME_TEMPERATURE_STRESS')
                        recommendations.push('Provide shade cover or cooling measures')
                        yieldImpactProjection -= 0.25
                        break
                    case 'ph':
                        riskFactors.push('SEVERE_NUTRIENT_DEFICIENCY')
                        recommendations.push('Apply soil amendments to correct pH immediately')
                        yieldImpactProjection -= 0.2
                        break
                }
            } else if (score < 50) {
                // Moderate issues
                switch (sensorType) {
                    case 'soil_moisture':
                        riskFactors.push('DROUGHT_STRESS')
                        recommendations.push('Increase irrigation frequency')
                        yieldImpactProjection -= 0.15
                        break
                    case 'temperature':
                        riskFactors.push('TEMPERATURE_STRESS')
                        recommendations.push('Monitor temperature closely and consider protective measures')
                        yieldImpactProjection -= 0.1
                        break
                    case 'ph':
                        riskFactors.push('NUTRIENT_ABSORPTION_ISSUES')
                        recommendations.push('Test soil and apply appropriate amendments')
                        yieldImpactProjection -= 0.1
                        break
                }
            } else if (score < 75) {
                // Minor issues
                switch (sensorType) {
                    case 'soil_moisture':
                        recommendations.push('Monitor soil moisture levels closely')
                        yieldImpactProjection -= 0.05
                        break
                    case 'temperature':
                        recommendations.push('Continue monitoring temperature conditions')
                        break
                }
            }
        }

        // Cap yield impact projection
        yieldImpactProjection = Math.max(-1.0, Math.min(1.0, yieldImpactProjection))

        return { riskFactors, recommendations, yieldImpactProjection }
    }
}