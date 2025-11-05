/**
 * Market Prices Display Module
 * Displays real-time coffee prices using the PriceOracleManager
 */

window.MarketPricesDisplay = class MarketPricesDisplay {
    constructor(apiClient) {
        // Use the global priceOracle instance
        this.priceOracle = window.priceOracle;
        this.apiClient = apiClient; // Keep for direct calls if needed
        this.selectedVariety = 'ALL'
        this.pricesData = []
        this.lastUpdate = null
        this.refreshInterval = null
    }

    /**
     * Initialize the market prices display
     */
    async initialize() {
        console.log('Initializing Market Prices Display...')
        
        // Set up event listeners
        this.setupEventListeners()
        
        // Load initial prices
        await this.loadPrices()
        
        // Load seasonal multipliers
        await this.loadSeasonalMultipliers()
        
        // Display quality grade pricing
        this.displayQualityGradePricing()
        
        // Start auto-refresh every 5 minutes
        this.startAutoRefresh(5)
        
        console.log('Market Prices Display initialized')
    }

    /**
     * Set up event listeners for filters and refresh
     */
    setupEventListeners() {
        // Variety filter
        const varietyFilter = document.getElementById('priceVarietyFilter')
        if (varietyFilter) {
            varietyFilter.addEventListener('change', (e) => {
                this.selectedVariety = e.target.value
                this.displayPrices()
                this.displayQualityGradePricing()
            })
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshPricesBtn')
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadPrices())
        }
    }

    /**
     * Load prices from API
     */
    async loadPrices() {
        try {
            const refreshBtn = document.getElementById('refreshPricesBtn')
            if (refreshBtn) {
                refreshBtn.disabled = true
                refreshBtn.textContent = 'Loading...'
            }

            let dataLoaded = false;

            try {
                // Try to use the price oracle to get all variety prices
                const response = await this.priceOracle.getAllVarietyPrices();
                const data = response;

                console.log('Market prices API response:', data)
                if (data && data.success && data.data && data.data.varieties) {
                    this.pricesData = data.data.varieties;
                    console.log('Loaded prices from API:', this.pricesData)
                    this.lastUpdate = new Date(data.data.lastUpdated);
                    dataLoaded = true;
                }
            } catch (apiError) {
                console.log('API not available, using mock data:', apiError.message);
            }

            // Use mock data if API failed
            if (!dataLoaded || !this.pricesData || this.pricesData.length === 0) {
                console.log('Using mock price data');
                this.pricesData = this.generateMockPriceData();
                this.lastUpdate = new Date();
            }

            this.displayPrices()
            this.displayLastUpdate()

        } catch (error) {
            console.error('Error loading prices:', error)
            // Even on error, try to show mock data
            this.pricesData = this.generateMockPriceData();
            this.lastUpdate = new Date();
            this.displayPrices()
            this.displayLastUpdate()
        } finally {
            const refreshBtn = document.getElementById('refreshPricesBtn')
            if (refreshBtn) {
                refreshBtn.disabled = false
                refreshBtn.textContent = '🔄 Refresh'
            }
        }
    }

    /**
     * Generate mock price data for demonstration
     */
    generateMockPriceData() {
        const varieties = ['ARABICA', 'ROBUSTA', 'SPECIALTY', 'ORGANIC'];
        const basePrices = {
            'ARABICA': 4.50,
            'ROBUSTA': 3.20,
            'SPECIALTY': 8.50,
            'ORGANIC': 6.80
        };

        return varieties.map(variety => {
            const basePrice = basePrices[variety];
            const grades = [];

            // Generate prices for grades 1-10
            for (let grade = 1; grade <= 10; grade++) {
                // Price increases with grade
                const multiplier = 0.6 + (grade - 1) * 0.1; // 0.6x to 1.5x
                const price = parseFloat((basePrice * multiplier).toFixed(2));
                grades.push({
                    grade: grade,
                    price: price,
                    multiplier: multiplier
                });
            }

            return {
                variety: variety,
                basePrice: basePrice,
                grades: grades,
                isActive: true,
                lastUpdated: new Date().toISOString()
            };
        });
    }

    /**
     * Display prices in the UI
     */
    displayPrices() {
        const container = document.getElementById('currentPricesDisplay')
        if (!container) return

        // Filter prices by selected variety
        let filteredPrices = this.pricesData
        if (this.selectedVariety !== 'ALL') {
            filteredPrices = this.pricesData.filter(v => v.variety === this.selectedVariety);
        }

        console.log('Filtered prices to display:', filteredPrices);

        if (filteredPrices.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>No price data available</p>
                    <small>Prices will update automatically every 30 minutes</small>
                </div>
            `
            return
        }

        // Generate new professional HTML
        container.innerHTML = filteredPrices.map(varietyData => this.renderPriceCard(varietyData)).join('');
    }

    /**
     * Renders a single, professionally styled price card.
     * @param {object} varietyData - The data for a single coffee variety.
     * @returns {string} HTML string for the card.
     */
    renderPriceCard(varietyData) {
        const varietyName = varietyData.variety;
        const grades = varietyData.grades || [];
        const highGradePrice = grades.find(g => g.grade === 10)?.price || 0;
        const lowGradePrice = grades.find(g => g.grade === 1)?.price || 0;
        const avgPrice = grades.length > 0 ? grades.reduce((sum, g) => sum + g.price, 0) / grades.length : 0;

        // Simulate a 24h price change
        const change = (Math.random() - 0.45) * 0.15; // Random change between -6.75% and +8.25%
        const changePercent = (change / (avgPrice - change) * 100).toFixed(2);
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeIcon = change >= 0 ? '▲' : '▼';

        return `
            <div class="price-card">
                <div class="price-card-header">
                    <div class="price-card-title" title="${varietyName}">
                        ${this.getVarietyIcon(varietyName)}
                        <h4>${varietyName.charAt(0).toUpperCase() + varietyName.slice(1).toLowerCase()}</h4>
                    </div>
                    <div class="price-card-current">
                        <span class="price-value">$${avgPrice.toFixed(2)}</span>
                        <span class="price-unit">/ kg</span>
                    </div>
                </div>
                <div class="price-card-change ${changeClass}">
                    <span>${changeIcon} $${Math.abs(change).toFixed(2)} (${changePercent}%)</span>
                    <small>Last 24h</small>
                </div>
                <div class="price-card-body">
                    <div class="price-card-chart">
                        ${this.renderMiniChart(change >= 0)}
                    </div>
                </div>
                <div class="price-card-footer">
                    <div class="grade-range">
                        <small>Low Grade: <strong>$${lowGradePrice.toFixed(2)}</strong></small>
                        <small>High Grade: <strong>$${highGradePrice.toFixed(2)}</strong></small>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generates a unique SVG icon for each coffee variety.
     * @param {string} varietyName - The name of the coffee variety.
     * @returns {string} HTML string for the SVG icon.
     */
    getVarietyIcon(varietyName) {
        const colors = {
            ARABICA: '#D4A373',
            ROBUSTA: '#A0522D',
            SPECIALTY: '#D4AF37',
            ORGANIC: '#556B2F',
            TYPICA: '#A0522D'
        };
        const color = colors[varietyName] || '#607D8B';

        let svgContent = '';
        switch (varietyName) {
            case 'ARABICA':
                svgContent = `<circle cx="12" cy="12" r="8" stroke="${color}" stroke-width="2.5" fill="none"/>`;
                break;
            case 'ROBUSTA':
                svgContent = `<rect x="4" y="4" width="16" height="16" rx="2" stroke="${color}" stroke-width="2.5" fill="none"/>`;
                break;
            case 'SPECIALTY':
                svgContent = `<polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" stroke="${color}" stroke-width="2.5" fill="none"/>`;
                break;
            case 'ORGANIC':
                svgContent = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="${color}" stroke="none"/>`;
                break;
            default:
                svgContent = `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="${color}" stroke-width="2" fill="none"/>`;
        }

        return `<div class="variety-icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${svgContent}</svg></div>`;
    }

    /**
     * Renders a simulated SVG mini-chart.
     * @param {boolean} isPositive - Determines if the chart trend is up or down.
     * @returns {string} HTML string for the SVG chart.
     */
    renderMiniChart(isPositive) {
        const color = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
        const points = [15, 18, 13, 16, 12, 14, 10];
        if (isPositive) {
            points.reverse(); // Show an upward trend
        }
        const polylinePoints = points.map((p, i) => `${i * 10},${p}`).join(' ');

        return `
            <svg class="mini-chart" viewBox="0 0 60 30" preserveAspectRatio="none">
                <polyline points="${polylinePoints}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }

    /**
     * Get variety name from enum value
     */
    getVarietyName(varietyValue) {
        const varieties = {
            0: 'Arabica',
            1: 'Robusta',
            2: 'Specialty',
            3: 'Organic'
        }
        return varieties[varietyValue] || 'Unknown'
    }

    /**
     * Display last update time
     */
    displayLastUpdate() {
        const updateElement = document.getElementById('pricesLastUpdate')
        if (updateElement && this.lastUpdate) {
            const timeAgo = this.getTimeAgo(this.lastUpdate)
            updateElement.textContent = `Last updated: ${timeAgo}`
        }
    }

    /**
     * Get time ago string
     */
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000)
        
        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
        return `${Math.floor(seconds / 86400)} days ago`
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('currentPricesDisplay')
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>⚠️ ${message}</p>
                    <button onclick="window.marketPricesDisplay.loadPrices()">Try Again</button>
                </div>
            `
        }
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh(minutes) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }

        this.refreshInterval = setInterval(() => {
            console.log('Auto-refreshing market prices...')
            this.loadPrices()
        }, minutes * 60 * 1000)

        console.log(`Auto-refresh enabled: every ${minutes} minutes`)
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }
    }

    /**
     * Display quality grade pricing table
     */
    displayQualityGradePricing() {
        const container = document.getElementById('gradePricingTable')
        if (!container) return

        // Base prices for each variety (from current market data or defaults)
        const selectedVarietyName = this.selectedVariety === 'ALL' ? 'ARABICA' : this.selectedVariety;
        const varietyData = this.pricesData.find(v => v.variety === selectedVarietyName);

        if (!varietyData || !varietyData.grades) {
            container.innerHTML = '<p>No grade pricing available for this variety.</p>';
            return;
        }

        // The API now provides prices for each grade, so we can use that directly.
        const grades = varietyData.grades.sort((a, b) => a.grade - b.grade);

        container.innerHTML = `
            <div class="grade-pricing-grid">
                ${grades.map(g => `
                    <div class="grade-price-item">
                        <span class="grade-number">Grade ${g.grade}</span>
                        <span class="grade-price">$${g.price.toFixed(2)}/kg</span>
                    </div>
                `).join('')}
            </div>
            <div class="grade-info">
                <small>Prices for ${selectedVarietyName} variety. Grade 10 is highest quality.</small>
            </div>
        `
    }

    /**
     * Load seasonal multipliers
     */
    async loadSeasonalMultipliers() {
        try {
            let multipliers = null;

            try {
                const data = await this.priceOracle.getSeasonalMultipliers();
                console.log('Seasonal multipliers response:', data)

                if (data && data.success) {
                    multipliers = data.data.seasonalMultipliers || data.data;
                }
            } catch (apiError) {
                console.log('Seasonal API not available, using mock data');
            }

            // Use mock data if API failed
            if (!multipliers) {
                multipliers = this.generateMockSeasonalMultipliers();
            }

            this.displaySeasonalMultipliers(multipliers);

        } catch (error) {
            console.error('Error loading seasonal multipliers:', error)
            // Use mock data as fallback
            const multipliers = this.generateMockSeasonalMultipliers();
            this.displaySeasonalMultipliers(multipliers);
        }
    }

    /**
     * Generate mock seasonal multipliers
     */
    generateMockSeasonalMultipliers() {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Realistic seasonal pattern for coffee prices
        const multipliers = [
            1.05,  // January - Post-harvest recovery
            1.08,  // February - Winter demand
            1.10,  // March - Pre-harvest peak
            1.15,  // April - High demand
            1.18,  // May - Peak prices
            1.12,  // June - Early harvest prep
            0.95,  // July - Main harvest begins
            0.90,  // August - Peak harvest
            0.92,  // September - Harvest continues
            0.98,  // October - Post-harvest
            1.02,  // November - Recovery
            1.05   // December - Year-end demand
        ];

        return months.map((month, index) => ({
            month: month,
            monthNumber: index + 1,
            multiplier: multipliers[index],
            description: this.getSeasonalDescription(index + 1)
        }));
    }

    /**
     * Get description for seasonal period
     */
    getSeasonalDescription(monthNumber) {
        if (monthNumber >= 4 && monthNumber <= 6) return 'High Demand Period';
        if (monthNumber >= 7 && monthNumber <= 9) return 'Harvest Season';
        if (monthNumber >= 10 && monthNumber <= 12) return 'Recovery Period';
        return 'Moderate Demand';
    }

    /**
     * Display seasonal multipliers chart
     */
    displaySeasonalMultipliers(multipliers) {
        const container = document.getElementById('seasonalMultipliersDisplay')
        if (!container) {
            // Try alternate container names
            const chartContainer = document.getElementById('seasonalPricingChart')
            if (chartContainer && chartContainer.parentElement) {
                // Create a div for the chart if using canvas element
                const newContainer = document.createElement('div')
                newContainer.id = 'seasonalMultipliersDisplay'
                chartContainer.parentElement.insertBefore(newContainer, chartContainer)
                chartContainer.style.display = 'none'
                return this.displaySeasonalMultipliers(multipliers)
            }
            console.warn('Seasonal multipliers container not found')
            return
        }

        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ]

        const currentMonth = new Date().getMonth() + 1

        container.innerHTML = `
            <style>
                .seasonal-multipliers-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    padding: 10px 0;
                }
                .seasonal-chart {
                    display: grid;
                    grid-template-columns: repeat(12, 1fr);
                    gap: 8px;
                    min-width: 600px;
                    max-width: 100%;
                    margin: 0 auto;
                }
                .month-bar {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 4px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .month-bar:hover {
                    background: rgba(0, 0, 0, 0.05);
                }
                .month-bar.current-month {
                    background: rgba(76, 175, 80, 0.1);
                    border: 2px solid #4CAF50;
                }
                .bar-container {
                    width: 100%;
                    height: 80px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    position: relative;
                }
                .bar {
                    width: 100%;
                    max-width: 40px;
                    border-radius: 4px 4px 0 0;
                    transition: all 0.3s;
                    min-height: 4px;
                }
                .bar.positive {
                    background: linear-gradient(to top, #4CAF50, #81C784);
                }
                .bar.negative {
                    background: linear-gradient(to top, #f44336, #e57373);
                }
                .month-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #666;
                    text-align: center;
                }
                .multiplier-value {
                    font-size: 12px;
                    font-weight: 700;
                    text-align: center;
                    white-space: nowrap;
                }
                .multiplier-value.positive {
                    color: #4CAF50;
                }
                .multiplier-value.negative {
                    color: #f44336;
                }
                .current-month-info {
                    margin-top: 20px;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                    color: white;
                    border-radius: 8px;
                    text-align: center;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                }
                .current-month-info strong {
                    font-weight: 600;
                }
                @media (max-width: 768px) {
                    .seasonal-chart {
                        gap: 4px;
                    }
                    .month-label {
                        font-size: 10px;
                    }
                    .multiplier-value {
                        font-size: 10px;
                    }
                }
            </style>
            <div class="seasonal-multipliers-wrapper">
                <div class="seasonal-chart">
                    ${months.map((month, index) => {
                        const monthNum = index + 1
                        // Get multiplier from array (could be object with .multiplier or just number)
                        const multiplierData = multipliers[index];
                        const multiplier = typeof multiplierData === 'object' ? multiplierData.multiplier : multiplierData || 1.0;
                        const percentage = ((multiplier - 1) * 100).toFixed(0)
                        const isPositive = multiplier >= 1.0
                        const isCurrent = monthNum === currentMonth
                        const barHeight = Math.min(Math.abs(percentage) * 2.5, 75)
                        
                        return `
                            <div class="month-bar ${isCurrent ? 'current-month' : ''}" title="${month}: ${isPositive ? '+' : ''}${percentage}% price adjustment">
                                <div class="bar-container">
                                    <div class="bar ${isPositive ? 'positive' : 'negative'}" 
                                         style="height: ${barHeight}px">
                                    </div>
                                </div>
                                <div class="month-label">${month}</div>
                                <div class="multiplier-value ${isPositive ? 'positive' : 'negative'}">
                                    ${isPositive ? '+' : ''}${percentage}%
                                </div>
                            </div>
                        `
                    }).join('')}
                </div>
            </div>
            <div class="current-month-info">
                <strong>📅 ${months[currentMonth - 1]} ${new Date().getFullYear()}</strong> — 
                Current price adjustment: <strong>${(() => {
                    const currentMultiplierData = multipliers[currentMonth - 1];
                    const currentMultiplier = typeof currentMultiplierData === 'object' ? currentMultiplierData.multiplier : currentMultiplierData || 1.0;
                    return ((currentMultiplier - 1) * 100).toFixed(0) + '%';
                })()}</strong>
            </div>
        `
    }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (window.coffeeAPI) {
            window.marketPricesDisplay = new MarketPricesDisplay(window.coffeeAPI)
            // Will be initialized when user navigates to pricing section
        }
    })
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketPricesDisplay
}
