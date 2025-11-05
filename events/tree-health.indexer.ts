import { db } from "../db/index.js";
import { 
    iotSensorData, 
    treeHealthRecords, 
    environmentalAlerts, 
    maintenanceActivities,
    sensorConfigurations,
    coffeeGroves
} from "../db/schema/index.js";
import { treeHealthFireStore } from "../lib/stores.js";
import { indexFirestore } from "./utils.js";

console.log("STARTED TREE HEALTH INDEXER");

await indexFirestore({
    contract: 'tree-health-monitoring',
    processor: async (key, data) => {
        console.log("Processing tree health event:", key);
        console.log("Event data:", data);
        
        switch (data.type) {
            case "SensorDataReceived": {
                console.log("Sensor Data Received", data);
                
                // Find the grove by ID or name
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove) {
                    await db.insert(iotSensorData).values({
                        groveId: grove.id,
                        sensorId: data.sensorId || "",
                        sensorType: data.sensorType || "",
                        value: Number(data.value) || 0,
                        unit: data.unit || "",
                        locationLat: data.locationLat ? Number(data.locationLat) : null,
                        locationLng: data.locationLng ? Number(data.locationLng) : null,
                        timestamp: Math.floor(data.sensorTimestamp || data.timestamp / 1000),
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "HealthScoreUpdated": {
                console.log("Health Score Updated", data);
                
                // Find the grove
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove) {
                    // Update grove health score
                    await db.update(coffeeGroves)
                        .set({
                            currentHealthScore: Number(data.healthScore) || 0,
                            updatedAt: Math.floor(data.timestamp / 1000)
                        })
                        .where((fields, ops) => ops.eq(fields.id, grove.id));
                    
                    // Create health record
                    await db.insert(treeHealthRecords).values({
                        groveId: grove.id,
                        healthScore: Number(data.healthScore) || 0,
                        assessmentDate: Math.floor(data.assessmentDate || data.timestamp / 1000),
                        soilMoistureScore: data.soilMoistureScore ? Number(data.soilMoistureScore) : null,
                        temperatureScore: data.temperatureScore ? Number(data.temperatureScore) : null,
                        humidityScore: data.humidityScore ? Number(data.humidityScore) : null,
                        phScore: data.phScore ? Number(data.phScore) : null,
                        lightScore: data.lightScore ? Number(data.lightScore) : null,
                        rainfallScore: data.rainfallScore ? Number(data.rainfallScore) : null,
                        riskFactors: data.riskFactors ? JSON.stringify(data.riskFactors) : null,
                        recommendations: data.recommendations ? JSON.stringify(data.recommendations) : null,
                        yieldImpactProjection: data.yieldImpactProjection ? Number(data.yieldImpactProjection) : null,
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "EnvironmentalAlertTriggered": {
                console.log("Environmental Alert Triggered", data);
                
                // Find the grove
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove) {
                    await db.insert(environmentalAlerts).values({
                        groveId: grove.id,
                        alertType: data.alertType || "",
                        severity: data.severity || "medium",
                        title: data.title || "",
                        message: data.message || "",
                        sensorDataId: data.sensorDataId ? Number(data.sensorDataId) : null,
                        healthRecordId: data.healthRecordId ? Number(data.healthRecordId) : null,
                        farmerNotified: Boolean(data.farmerNotified),
                        investorNotified: Boolean(data.investorNotified),
                        acknowledged: false,
                        resolved: false,
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "AlertAcknowledged": {
                console.log("Alert Acknowledged", data);
                
                // Update alert acknowledgment
                if (data.alertId) {
                    const alert = await db.query.environmentalAlerts.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.alertId))
                    });
                    
                    if (alert) {
                        await db.update(environmentalAlerts)
                            .set({
                                acknowledged: true
                            })
                            .where((fields, ops) => ops.eq(fields.id, alert.id));
                    }
                }
                break;
            }
            
            case "AlertResolved": {
                console.log("Alert Resolved", data);
                
                // Update alert resolution
                if (data.alertId) {
                    const alert = await db.query.environmentalAlerts.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.alertId))
                    });
                    
                    if (alert) {
                        await db.update(environmentalAlerts)
                            .set({
                                resolved: true,
                                resolvedAt: Math.floor(data.timestamp / 1000)
                            })
                            .where((fields, ops) => ops.eq(fields.id, alert.id));
                    }
                }
                break;
            }
            
            case "MaintenanceActivityLogged": {
                console.log("Maintenance Activity Logged", data);
                
                // Find the grove
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove) {
                    await db.insert(maintenanceActivities).values({
                        groveId: grove.id,
                        farmerAddress: data.farmerAddress || grove.farmerAddress,
                        activityType: data.activityType || "",
                        description: data.description || "",
                        cost: data.cost ? Number(data.cost) : null,
                        materialsUsed: data.materialsUsed ? JSON.stringify(data.materialsUsed) : null,
                        areaTreated: data.areaTreated ? Number(data.areaTreated) : null,
                        weatherConditions: data.weatherConditions || null,
                        notes: data.notes || null,
                        activityDate: Math.floor(data.activityDate || data.timestamp / 1000),
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "SensorConfigurationUpdated": {
                console.log("Sensor Configuration Updated", data);
                
                // Find the grove
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove) {
                    // Check if configuration exists
                    const existingConfig = await db.query.sensorConfigurations.findFirst({
                        where: (fields, ops) => ops.and(
                            ops.eq(fields.groveId, grove.id),
                            ops.eq(fields.sensorType, data.sensorType)
                        )
                    });
                    
                    const configData = {
                        groveId: grove.id,
                        sensorType: data.sensorType || "",
                        optimalMin: Number(data.optimalMin) || 0,
                        optimalMax: Number(data.optimalMax) || 0,
                        warningMin: Number(data.warningMin) || 0,
                        warningMax: Number(data.warningMax) || 0,
                        criticalMin: Number(data.criticalMin) || 0,
                        criticalMax: Number(data.criticalMax) || 0,
                        unit: data.unit || "",
                        readingFrequency: Number(data.readingFrequency) || 0,
                        alertThresholdCount: Number(data.alertThresholdCount) || 3,
                        updatedAt: Math.floor(data.timestamp / 1000)
                    };
                    
                    if (existingConfig) {
                        await db.update(sensorConfigurations)
                            .set(configData)
                            .where((fields, ops) => ops.eq(fields.id, existingConfig.id));
                    } else {
                        await db.insert(sensorConfigurations).values({
                            ...configData,
                            createdAt: Math.floor(data.timestamp / 1000)
                        });
                    }
                }
                break;
            }
            
            case "YieldProjectionUpdated": {
                console.log("Yield Projection Updated", data);
                
                // Find the grove and update expected yield
                let grove;
                if (data.groveId) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.id, Number(data.groveId))
                    });
                } else if (data.groveName) {
                    grove = await db.query.coffeeGroves.findFirst({
                        where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                    });
                }
                
                if (grove && data.expectedYieldPerTree) {
                    await db.update(coffeeGroves)
                        .set({
                            expectedYieldPerTree: Number(data.expectedYieldPerTree),
                            updatedAt: Math.floor(data.timestamp / 1000)
                        })
                        .where((fields, ops) => ops.eq(fields.id, grove.id));
                }
                break;
            }
            
            default: {
                console.log("Unknown tree health event type", data.type);
            }
        }
    },
    store: treeHealthFireStore
});

console.log("ENDED TREE HEALTH INDEXER");