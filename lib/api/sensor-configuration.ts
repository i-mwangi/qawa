/**
 * Sensor Configuration Service
 * 
 * Manages sensor configurations and thresholds for coffee grove monitoring
 */

import { db } from '../db'
import { sensorConfigurations } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export interface SensorThresholds {
    sensorType: string
    optimalMin: number
    optimalMax: number
    warningMin: number
    warningMax: number
    criticalMin: number
    criticalMax: number
    unit: string
    readingFrequency: number // minutes
    alertThresholdCount: number
}

// Default sensor configurations for coffee trees
const DEFAULT_COFFEE_SENSOR_CONFIGS: SensorThresholds[] = [
    {
        sensorType: 'soil_moisture',
        optimalMin: 60,
        optimalMax: 80,
        warningMin: 40,
        warningMax: 90,
        criticalMin: 20,
        criticalMax: 95,
        unit: '%',
        readingFrequency: 60, // Every hour
        alertThresholdCount: 3
    },
    {
        sensorType: 'temperature',
        optimalMin: 18,
        optimalMax: 24,
        warningMin: 15,
        warningMax: 28,
        criticalMin: 10,
        criticalMax: 35,
        unit: 'C',
        readingFrequency: 30, // Every 30 minutes
        alertThresholdCount: 2
    },
    {
        sensorType: 'humidity',
        optimalMin: 60,
        optimalMax: 80,
        warningMin: 45,
        warningMax: 90,
        criticalMin: 30,
        criticalMax: 95,
        unit: '%',
        readingFrequency: 60, // Every hour
        alertThresholdCount: 3
    },
    {
        sensorType: 'ph',
        optimalMin: 6.0,
        optimalMax: 6.8,
        warningMin: 5.5,
        warningMax: 7.2,
        criticalMin: 4.5,
        criticalMax: 8.0,
        unit: 'pH',
        readingFrequency: 1440, // Daily
        alertThresholdCount: 2
    },
    {
        sensorType: 'light',
        optimalMin: 15000,
        optimalMax: 35000,
        warningMin: 10000,
        warningMax: 45000,
        criticalMin: 5000,
        criticalMax: 60000,
        unit: 'lux',
        readingFrequency: 120, // Every 2 hours
        alertThresholdCount: 4
    },
    {
        sensorType: 'rainfall',
        optimalMin: 3,
        optimalMax: 8,
        warningMin: 1,
        warningMax: 12,
        criticalMin: 0,
        criticalMax: 20,
        unit: 'mm',
        readingFrequency: 360, // Every 6 hours
        alertThresholdCount: 2
    }
]

export class SensorConfigurationService {
    
    /**
     * Initialize default sensor configurations for a grove
     */
    async initializeGroveConfigurations(groveId: number): Promise<void> {
        try {
            // Check if configurations already exist
            const existingConfigs = await db.select()
                .from(sensorConfigurations)
                .where(eq(sensorConfigurations.groveId, groveId))

            if (existingConfigs.length > 0) {
                console.log(`Sensor configurations already exist for grove ${groveId}`)
                return
            }

            // Insert default configurations
            const configsToInsert = DEFAULT_COFFEE_SENSOR_CONFIGS.map(config => ({
                groveId,
                sensorType: config.sensorType,
                optimalMin: config.optimalMin,
                optimalMax: config.optimalMax,
                warningMin: config.warningMin,
                warningMax: config.warningMax,
                criticalMin: config.criticalMin,
                criticalMax: config.criticalMax,
                unit: config.unit,
                readingFrequency: config.readingFrequency,
                alertThresholdCount: config.alertThresholdCount
            }))

            await db.insert(sensorConfigurations).values(configsToInsert)
            
            console.log(`Initialized ${configsToInsert.length} sensor configurations for grove ${groveId}`)

        } catch (error) {
            console.error(`Error initializing sensor configurations for grove ${groveId}:`, error)
            throw error
        }
    }

    /**
     * Update sensor configuration for a specific grove and sensor type
     */
    async updateSensorConfiguration(
        groveId: number, 
        sensorType: string, 
        updates: Partial<SensorThresholds>
    ): Promise<void> {
        try {
            const updateData: any = {}
            
            if (updates.optimalMin !== undefined) updateData.optimalMin = updates.optimalMin
            if (updates.optimalMax !== undefined) updateData.optimalMax = updates.optimalMax
            if (updates.warningMin !== undefined) updateData.warningMin = updates.warningMin
            if (updates.warningMax !== undefined) updateData.warningMax = updates.warningMax
            if (updates.criticalMin !== undefined) updateData.criticalMin = updates.criticalMin
            if (updates.criticalMax !== undefined) updateData.criticalMax = updates.criticalMax
            if (updates.readingFrequency !== undefined) updateData.readingFrequency = updates.readingFrequency
            if (updates.alertThresholdCount !== undefined) updateData.alertThresholdCount = updates.alertThresholdCount
            
            updateData.updatedAt = Math.floor(Date.now() / 1000)

            await db.update(sensorConfigurations)
                .set(updateData)
                .where(and(
                    eq(sensorConfigurations.groveId, groveId),
                    eq(sensorConfigurations.sensorType, sensorType)
                ))

            console.log(`Updated sensor configuration for grove ${groveId}, sensor type ${sensorType}`)

        } catch (error) {
            console.error(`Error updating sensor configuration:`, error)
            throw error
        }
    }

    /**
     * Get sensor configurations for a grove
     */
    async getGroveConfigurations(groveId: number): Promise<SensorThresholds[]> {
        try {
            const configs = await db.select()
                .from(sensorConfigurations)
                .where(eq(sensorConfigurations.groveId, groveId))

            return configs.map(config => ({
                sensorType: config.sensorType,
                optimalMin: config.optimalMin,
                optimalMax: config.optimalMax,
                warningMin: config.warningMin,
                warningMax: config.warningMax,
                criticalMin: config.criticalMin,
                criticalMax: config.criticalMax,
                unit: config.unit,
                readingFrequency: config.readingFrequency,
                alertThresholdCount: config.alertThresholdCount || 3
            }))

        } catch (error) {
            console.error(`Error fetching sensor configurations for grove ${groveId}:`, error)
            throw error
        }
    }

    /**
     * Get configuration for a specific sensor type
     */
    async getSensorConfiguration(groveId: number, sensorType: string): Promise<SensorThresholds | null> {
        try {
            const config = await db.select()
                .from(sensorConfigurations)
                .where(and(
                    eq(sensorConfigurations.groveId, groveId),
                    eq(sensorConfigurations.sensorType, sensorType)
                ))
                .limit(1)

            if (config.length === 0) {
                return null
            }

            const c = config[0]
            return {
                sensorType: c.sensorType,
                optimalMin: c.optimalMin,
                optimalMax: c.optimalMax,
                warningMin: c.warningMin,
                warningMax: c.warningMax,
                criticalMin: c.criticalMin,
                criticalMax: c.criticalMax,
                unit: c.unit,
                readingFrequency: c.readingFrequency,
                alertThresholdCount: c.alertThresholdCount || 3
            }

        } catch (error) {
            console.error(`Error fetching sensor configuration:`, error)
            return null
        }
    }

    /**
     * Initialize configurations for all existing groves that don't have them
     */
    async initializeAllMissingConfigurations(): Promise<void> {
        try {
            // This would typically be called during system startup or migration
            // For now, we'll just log that this method exists
            console.log('SensorConfigurationService: initializeAllMissingConfigurations method available')
            
        } catch (error) {
            console.error('Error initializing missing configurations:', error)
            throw error
        }
    }
}

// Export singleton instance
export const sensorConfigService = new SensorConfigurationService()