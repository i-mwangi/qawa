/**
 * Tree Health Dashboard
 * 
 * Real-time tree health visualization for farmers and investors
 */

class TreeHealthDashboard {
    constructor() {
        this.currentGroveId = null
        this.healthData = []
        this.sensorData = []
        this.alerts = []
        this.maintenanceActivities = []
        this.refreshInterval = null
        this.charts = {}
        
        this.init()
    }

    init() {
        this.setupEventListeners()
        this.loadGroveSelector()
        this.startAutoRefresh()
    }

    setupEventListeners() {
        // Grove selection
        document.getElementById('grove-selector')?.addEventListener('change', (e) => {
            this.currentGroveId = e.target.value
            if (this.currentGroveId) {
                this.loadDashboardData()
            }
        })

        // Refresh button
        document.getElementById('refresh-dashboard')?.addEventListener('click', () => {
            this.loadDashboardData()
        })

        // Alert acknowledgment
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('acknowledge-alert')) {
                const alertId = e.target.dataset.alertId
                this.acknowledgeAlert(alertId)
            }
            if (e.target.classList.contains('resolve-alert')) {
                const alertId = e.target.dataset.alertId
                this.resolveAlert(alertId)
            }
        })

        // Time range selector
        document.getElementById('time-range')?.addEventListener('change', (e) => {
            this.loadSensorData(e.target.value)
        })
    }

    async loadGroveSelector() {
        try {
            // This would typically load from the farmer's groves
            // For now, we'll use a mock implementation
            const groves = [
                { id: 1, name: 'Grove A - Arabica Premium', location: 'Costa Rica' },
                { id: 2, name: 'Grove B - Robusta Estate', location: 'Colombia' },
                { id: 3, name: 'Grove C - Organic Blend', location: 'Guatemala' }
            ]

            const selector = document.getElementById('grove-selector')
            if (selector) {
                selector.innerHTML = '<option value="">Select a grove...</option>'
                groves.forEach(grove => {
                    const option = document.createElement('option')
                    option.value = grove.id
                    option.textContent = `${grove.name} (${grove.location})`
                    selector.appendChild(option)
                })
            }
        } catch (error) {
            console.error('Error loading grove selector:', error)
        }
    }

    async loadDashboardData() {
        if (!this.currentGroveId) return

        try {
            await Promise.all([
                this.loadHealthData(),
                this.loadSensorData('24h'),
                this.loadAlerts(),
                this.loadMaintenanceActivities()
            ])

            this.renderDashboard()
        } catch (error) {
            console.error('Error loading dashboard data:', error)
            this.showError('Failed to load dashboard data')
        }
    }

    async loadHealthData() {
        try {
            const response = await fetch(`/api/tree-monitoring/health/${this.currentGroveId}?limit=30`)
            const result = await response.json()
            
            if (result.success) {
                this.healthData = result.data
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error loading health data:', error)
            this.healthData = []
        }
    }

    async loadSensorData(timeRange = '24h') {
        try {
            const now = new Date()
            let startDate = new Date()
            
            switch (timeRange) {
                case '1h':
                    startDate.setHours(now.getHours() - 1)
                    break
                case '24h':
                    startDate.setDate(now.getDate() - 1)
                    break
                case '7d':
                    startDate.setDate(now.getDate() - 7)
                    break
                case '30d':
                    startDate.setDate(now.getDate() - 30)
                    break
            }

            const response = await fetch(
                `/api/tree-monitoring/sensor-data/${this.currentGroveId}?startDate=${startDate.toISOString()}&limit=1000`
            )
            const result = await response.json()
            
            if (result.success) {
                this.sensorData = result.data
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error loading sensor data:', error)
            this.sensorData = []
        }
    }

    async loadAlerts() {
        try {
            const response = await fetch(`/api/tree-monitoring/alerts/${this.currentGroveId}?resolved=false&limit=50`)
            const result = await response.json()
            
            if (result.success) {
                this.alerts = result.data
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error loading alerts:', error)
            this.alerts = []
        }
    }

    async loadMaintenanceActivities() {
        try {
            const response = await fetch(`/api/tree-monitoring/maintenance/${this.currentGroveId}?limit=20`)
            const result = await response.json()
            
            if (result.success) {
                this.maintenanceActivities = result.data
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error loading maintenance activities:', error)
            this.maintenanceActivities = []
        }
    }

    renderDashboard() {
        this.renderHealthOverview()
        this.renderSensorCharts()
        this.renderAlerts()
        this.renderMaintenanceLog()
        this.renderRecommendations()
        this.renderYieldProjections()
    }

    renderHealthOverview() {
        const container = document.getElementById('health-overview')
        if (!container) return

        const latestHealth = this.healthData[0]
        if (!latestHealth) {
            container.innerHTML = '<p>No health data available</p>'
            return
        }

        const healthScore = latestHealth.healthScore
        const healthClass = this.getHealthClass(healthScore)
        const healthStatus = this.getHealthStatus(healthScore)

        container.innerHTML = `
            <div class="health-score-card">
                <div class="health-score ${healthClass}">
                    <div class="score-value">${healthScore}</div>
                    <div class="score-label">Health Score</div>
                </div>
                <div class="health-status">
                    <h3>${healthStatus}</h3>
                    <p>Last updated: ${new Date(latestHealth.assessmentDate).toLocaleString()}</p>
                </div>
            </div>
            
            <div class="health-breakdown">
                <h4>Health Breakdown</h4>
                <div class="health-metrics">
                    ${this.renderHealthMetric('Soil Moisture', latestHealth.soilMoistureScore)}
                    ${this.renderHealthMetric('Temperature', latestHealth.temperatureScore)}
                    ${this.renderHealthMetric('Humidity', latestHealth.humidityScore)}
                    ${this.renderHealthMetric('pH Level', latestHealth.phScore)}
                    ${this.renderHealthMetric('Light', latestHealth.lightScore)}
                    ${this.renderHealthMetric('Rainfall', latestHealth.rainfallScore)}
                </div>
            </div>
        `
    }

    renderHealthMetric(label, score) {
        if (score === null || score === undefined) {
            return `
                <div class="health-metric">
                    <span class="metric-label">${label}</span>
                    <span class="metric-value no-data">No data</span>
                </div>
            `
        }

        const healthClass = this.getHealthClass(score)
        return `
            <div class="health-metric">
                <span class="metric-label">${label}</span>
                <span class="metric-value ${healthClass}">${score}</span>
            </div>
        `
    }

    renderSensorCharts() {
        const container = document.getElementById('sensor-charts')
        if (!container) return

        // Group sensor data by type
        const sensorGroups = this.groupSensorDataByType()
        
        container.innerHTML = `
            <div class="chart-grid">
                ${Object.keys(sensorGroups).map(sensorType => `
                    <div class="chart-container">
                        <h4>${this.formatSensorType(sensorType)}</h4>
                        <canvas id="chart-${sensorType}" width="400" height="200"></canvas>
                        <div class="chart-stats">
                            ${this.renderSensorStats(sensorGroups[sensorType])}
                        </div>
                    </div>
                `).join('')}
            </div>
        `

        // Render charts (simplified version - in a real implementation, you'd use Chart.js or similar)
        Object.keys(sensorGroups).forEach(sensorType => {
            this.renderSensorChart(sensorType, sensorGroups[sensorType])
        })
    }

    groupSensorDataByType() {
        const groups = {}
        this.sensorData.forEach(reading => {
            if (!groups[reading.sensorType]) {
                groups[reading.sensorType] = []
            }
            groups[reading.sensorType].push(reading)
        })
        return groups
    }

    renderSensorChart(sensorType, data) {
        const canvas = document.getElementById(`chart-${sensorType}`)
        if (!canvas) return

        // Simplified chart rendering - in a real implementation, use Chart.js
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        if (data.length === 0) {
            ctx.fillStyle = '#666'
            ctx.font = '16px Arial'
            ctx.textAlign = 'center'
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2)
            return
        }

        // Draw simple line chart
        const padding = 40
        const chartWidth = canvas.width - 2 * padding
        const chartHeight = canvas.height - 2 * padding

        // Find min/max values
        const values = data.map(d => d.value)
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const valueRange = maxValue - minValue || 1

        // Draw axes
        ctx.strokeStyle = '#ddd'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padding, padding)
        ctx.lineTo(padding, canvas.height - padding)
        ctx.lineTo(canvas.width - padding, canvas.height - padding)
        ctx.stroke()

        // Draw data line
        ctx.strokeStyle = this.getSensorColor(sensorType)
        ctx.lineWidth = 2
        ctx.beginPath()

        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * chartWidth
            const y = canvas.height - padding - ((point.value - minValue) / valueRange) * chartHeight
            
            if (index === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })
        
        ctx.stroke()

        // Add labels
        ctx.fillStyle = '#333'
        ctx.font = '12px Arial'
        ctx.textAlign = 'left'
        ctx.fillText(`Min: ${minValue.toFixed(1)}`, padding, canvas.height - 5)
        ctx.textAlign = 'right'
        ctx.fillText(`Max: ${maxValue.toFixed(1)}`, canvas.width - padding, canvas.height - 5)
    }

    renderSensorStats(data) {
        if (data.length === 0) return '<span class="no-data">No data</span>'

        const values = data.map(d => d.value)
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const latest = values[values.length - 1]

        return `
            <div class="stats-grid">
                <div class="stat">
                    <span class="stat-label">Current</span>
                    <span class="stat-value">${latest.toFixed(1)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Average</span>
                    <span class="stat-value">${avg.toFixed(1)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Range</span>
                    <span class="stat-value">${min.toFixed(1)} - ${max.toFixed(1)}</span>
                </div>
            </div>
        `
    }

    renderAlerts() {
        const container = document.getElementById('alerts-panel')
        if (!container) return

        if (this.alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <h4>No Active Alerts</h4>
                    <p>Your grove is in good condition!</p>
                </div>
            `
            return
        }

        container.innerHTML = `
            <h4>Active Alerts (${this.alerts.length})</h4>
            <div class="alerts-list">
                ${this.alerts.map(alert => `
                    <div class="alert-card ${alert.severity.toLowerCase()}">
                        <div class="alert-header">
                            <span class="alert-title">${alert.title}</span>
                            <span class="alert-severity ${alert.severity.toLowerCase()}">${alert.severity}</span>
                        </div>
                        <div class="alert-message">${alert.message}</div>
                        <div class="alert-time">${new Date(alert.createdAt).toLocaleString()}</div>
                        <div class="alert-actions">
                            ${!alert.acknowledged ? `
                                <button class="btn btn-sm acknowledge-alert" data-alert-id="${alert.id}">
                                    Acknowledge
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-success resolve-alert" data-alert-id="${alert.id}">
                                Resolve
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `
    }

    renderMaintenanceLog() {
        const container = document.getElementById('maintenance-log')
        if (!container) return

        if (this.maintenanceActivities.length === 0) {
            container.innerHTML = '<p>No recent maintenance activities</p>'
            return
        }

        container.innerHTML = `
            <h4>Recent Maintenance</h4>
            <div class="maintenance-list">
                ${this.maintenanceActivities.slice(0, 10).map(activity => `
                    <div class="maintenance-item">
                        <div class="maintenance-header">
                            <span class="activity-type">${this.formatActivityType(activity.activityType)}</span>
                            <span class="activity-date">${new Date(activity.activityDate).toLocaleDateString()}</span>
                        </div>
                        <div class="activity-description">${activity.description}</div>
                        ${activity.cost ? `<div class="activity-cost">Cost: $${(activity.cost / 100).toFixed(2)}</div>` : ''}
                        ${activity.notes ? `<div class="activity-notes">${activity.notes}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `
    }

    renderRecommendations() {
        const container = document.getElementById('recommendations')
        if (!container) return

        const latestHealth = this.healthData[0]
        if (!latestHealth || !latestHealth.recommendations) {
            container.innerHTML = '<p>No recommendations available</p>'
            return
        }

        const recommendations = latestHealth.recommendations
        const riskFactors = latestHealth.riskFactors || []

        container.innerHTML = `
            <h4>Care Recommendations</h4>
            ${riskFactors.length > 0 ? `
                <div class="risk-factors">
                    <h5>Risk Factors Identified:</h5>
                    <ul>
                        ${riskFactors.map(risk => `<li class="risk-factor">${this.formatRiskFactor(risk)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            <div class="recommendations-list">
                ${recommendations.map(rec => `
                    <div class="recommendation-item">
                        <i class="icon-lightbulb"></i>
                        <span>${rec}</span>
                    </div>
                `).join('')}
            </div>
        `
    }

    renderYieldProjections() {
        const container = document.getElementById('yield-projections')
        if (!container) return

        const latestHealth = this.healthData[0]
        if (!latestHealth) {
            container.innerHTML = '<p>No yield projection data available</p>'
            return
        }

        const yieldImpact = latestHealth.yieldImpactProjection || 0
        const baseYield = 5000 // kg per season (would come from grove data)
        const projectedYield = baseYield * (1 + yieldImpact)
        const impactPercent = (yieldImpact * 100).toFixed(1)

        container.innerHTML = `
            <h4>Yield Projections</h4>
            <div class="yield-stats">
                <div class="yield-stat">
                    <span class="stat-label">Base Yield</span>
                    <span class="stat-value">${baseYield.toLocaleString()} kg</span>
                </div>
                <div class="yield-stat">
                    <span class="stat-label">Projected Yield</span>
                    <span class="stat-value">${projectedYield.toLocaleString()} kg</span>
                </div>
                <div class="yield-stat">
                    <span class="stat-label">Impact</span>
                    <span class="stat-value ${yieldImpact >= 0 ? 'positive' : 'negative'}">
                        ${yieldImpact >= 0 ? '+' : ''}${impactPercent}%
                    </span>
                </div>
            </div>
            <div class="yield-explanation">
                ${yieldImpact > 0.1 ? 
                    '<p class="positive">Current conditions are favorable for above-average yield.</p>' :
                    yieldImpact < -0.1 ?
                    '<p class="negative">Current conditions may reduce expected yield. Follow recommendations to improve.</p>' :
                    '<p class="neutral">Current conditions are within normal range for expected yield.</p>'
                }
            </div>
        `
    }

    async acknowledgeAlert(alertId) {
        try {
            const response = await fetch(`/api/tree-monitoring/alerts/${alertId}/acknowledge`, {
                method: 'POST'
            })
            const result = await response.json()
            
            if (result.success) {
                this.loadAlerts() // Refresh alerts
                this.showSuccess('Alert acknowledged')
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error acknowledging alert:', error)
            this.showError('Failed to acknowledge alert')
        }
    }

    async resolveAlert(alertId) {
        try {
            const response = await fetch(`/api/tree-monitoring/alerts/${alertId}/resolve`, {
                method: 'POST'
            })
            const result = await response.json()
            
            if (result.success) {
                this.loadAlerts() // Refresh alerts
                this.showSuccess('Alert resolved')
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error resolving alert:', error)
            this.showError('Failed to resolve alert')
        }
    }

    startAutoRefresh() {
        // Refresh dashboard every 5 minutes
        this.refreshInterval = setInterval(() => {
            if (this.currentGroveId) {
                this.loadDashboardData()
            }
        }, 5 * 60 * 1000)
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }
    }

    // Utility methods
    getHealthClass(score) {
        if (score >= 80) return 'excellent'
        if (score >= 60) return 'good'
        if (score >= 40) return 'fair'
        return 'poor'
    }

    getHealthStatus(score) {
        if (score >= 80) return 'Excellent Health'
        if (score >= 60) return 'Good Health'
        if (score >= 40) return 'Fair Health'
        return 'Poor Health'
    }

    formatSensorType(type) {
        const types = {
            'soil_moisture': 'Soil Moisture',
            'temperature': 'Temperature',
            'humidity': 'Humidity',
            'ph': 'pH Level',
            'light': 'Light Intensity',
            'rainfall': 'Rainfall'
        }
        return types[type] || type
    }

    formatActivityType(type) {
        const types = {
            'WATERING': 'Watering',
            'FERTILIZING': 'Fertilizing',
            'PRUNING': 'Pruning',
            'PEST_TREATMENT': 'Pest Treatment',
            'DISEASE_TREATMENT': 'Disease Treatment',
            'SOIL_AMENDMENT': 'Soil Amendment'
        }
        return types[type] || type
    }

    formatRiskFactor(risk) {
        const risks = {
            'SEVERE_DROUGHT_STRESS': 'Severe drought stress detected',
            'EXTREME_TEMPERATURE_STRESS': 'Extreme temperature conditions',
            'SEVERE_NUTRIENT_DEFICIENCY': 'Severe nutrient deficiency',
            'DROUGHT_STRESS': 'Drought stress conditions',
            'TEMPERATURE_STRESS': 'Temperature stress',
            'NUTRIENT_ABSORPTION_ISSUES': 'Nutrient absorption problems'
        }
        return risks[risk] || risk
    }

    getSensorColor(sensorType) {
        const colors = {
            'soil_moisture': '#3498db',
            'temperature': '#e74c3c',
            'humidity': '#2ecc71',
            'ph': '#f39c12',
            'light': '#f1c40f',
            'rainfall': '#9b59b6'
        }
        return colors[sensorType] || '#95a5a6'
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div')
        notification.className = 'notification success'
        notification.textContent = message
        document.body.appendChild(notification)
        
        setTimeout(() => {
            notification.remove()
        }, 3000)
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div')
        notification.className = 'notification error'
        notification.textContent = message
        document.body.appendChild(notification)
        
        setTimeout(() => {
            notification.remove()
        }, 5000)
    }

    destroy() {
        this.stopAutoRefresh()
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tree-health-dashboard')) {
        window.treeHealthDashboard = new TreeHealthDashboard()
    }
})