/**
 * Advanced Pricing Module
 * Handles variety-specific and seasonal coffee pricing
 */

/**
 * Coffee variety enumeration
 */
const CoffeeVariety = {
    ARABICA: 'ARABICA',
    ROBUSTA: 'ROBUSTA',
    SPECIALTY: 'SPECIALTY',
    ORGANIC: 'ORGANIC',
    TYPICA: 'TYPICA'
};

/**
 * Coffee grade enumeration (1-10 scale)
 * Grade 1 = Lowest quality
 * Grade 10 = Highest quality
 */
const CoffeeGrade = {
    MIN: 1,
    MAX: 10,
    
    /**
     * Validate if a grade is within acceptable range
     * @param {number} grade - Grade to validate
     * @returns {boolean} True if valid
     */
    isValid(grade) {
        return Number.isInteger(grade) && grade >= this.MIN && grade <= this.MAX;
    },
    
    /**
     * Get grade description
     * @param {number} grade - Grade value
     * @returns {string} Grade description
     */
    getDescription(grade) {
        if (!this.isValid(grade)) return 'Invalid';
        if (grade <= 3) return 'Low Quality';
        if (grade <= 6) return 'Medium Quality';
        if (grade <= 8) return 'High Quality';
        return 'Premium Quality';
    }
};

/**
 * Validate variety (case-insensitive)
 * @param {string} variety - Coffee variety to validate
 * @returns {boolean} True if valid
 */
function isValidVariety(variety) {
    if (!variety) return false;
    const upperVariety = variety.toUpperCase();
    return Object.values(CoffeeVariety).includes(upperVariety);
}

/**
 * Normalize variety to uppercase
 * @param {string} variety - Coffee variety to normalize
 * @returns {string} Normalized variety
 */
function normalizeVariety(variety) {
    if (!variety) return '';
    return variety.toUpperCase();
}

/**
 * Custom error class for pricing-related errors
 */
class PricingError extends Error {
    constructor(message, variety = null, grade = null) {
        super(message);
        this.name = 'PricingError';
        this.variety = variety;
        this.grade = grade;
    }
}

/**
 * Custom error class for stale price data
 */
class StalePriceError extends Error {
    constructor(message, lastUpdated) {
        super(message);
        this.name = 'StalePriceError';
        this.lastUpdated = lastUpdated;
    }
}

/**
 * PriceOracleManager
 * Manages coffee price fetching, calculations, and validations
 */
class PriceOracleManager {
    /**
     * Initialize the Price Oracle Manager
     * @param {CoffeeTreeAPI} apiClient - API client instance for backend communication
     */
    constructor(apiClient) {
        if (!apiClient) {
            throw new Error('API client is required for PriceOracleManager');
        }
        
        this.apiClient = apiClient;
        
        // Cache for price data (5 minute TTL as per design)
        this.priceCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Stale price threshold (24 hours as per requirements)
        this.stalePriceThreshold = 24 * 60 * 60 * 1000; // 24 hours
        
        // Price validation bounds (50%-200% range as per requirements)
        this.minPriceMultiplier = 0.5;  // 50%
        this.maxPriceMultiplier = 2.0;  // 200%
        
        console.log('PriceOracleManager initialized');
    }
    
    /**
     * Get coffee variety enum
     * @returns {Object} CoffeeVariety enum
     */
    static get Variety() {
        return CoffeeVariety;
    }
    
    /**
     * Get coffee grade enum
     * @returns {Object} CoffeeGrade enum
     */
    static get Grade() {
        return CoffeeGrade;
    }
    
    /**
     * Validate variety
     * @param {string} variety - Coffee variety to validate
     * @returns {boolean} True if valid
     */
    isValidVariety(variety) {
        return isValidVariety(variety);
    }
    
    /**
     * Validate grade
     * @param {number} grade - Coffee grade to validate
     * @returns {boolean} True if valid
     */
    isValidGrade(grade) {
        return CoffeeGrade.isValid(grade);
    }
    
    /**
     * Check if price data is stale (>24 hours old)
     * @param {string} lastUpdated - ISO timestamp of last update
     * @returns {boolean} True if stale
     */
    isPriceStale(lastUpdated) {
        if (!lastUpdated) return true;
        
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const now = Date.now();
        
        return (now - lastUpdateTime) > this.stalePriceThreshold;
    }
    
    /**
     * Get cache key for price data
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade
     * @returns {string} Cache key
     */
    getCacheKey(variety, grade) {
        // Normalize variety for cache key
        const normalizedVariety = normalizeVariety(variety);
        return `${normalizedVariety}_${grade}`;
    }
    
    /**
     * Get cached price data if available and not expired
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade
     * @returns {Object|null} Cached price data or null
     */
    getCachedPrice(variety, grade) {
        // Normalize variety for cache lookup
        const normalizedVariety = normalizeVariety(variety);
        const key = this.getCacheKey(normalizedVariety, grade);
        const cached = this.priceCache.get(key);
        
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            // Cache expired
            this.priceCache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Set cached price data
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade
     * @param {Object} data - Price data to cache
     */
    setCachedPrice(variety, grade, data) {
        // Normalize variety for cache storage
        const normalizedVariety = normalizeVariety(variety);
        const key = this.getCacheKey(normalizedVariety, grade);
        this.priceCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Get coffee prices for a specific variety and grade
     * Implements caching with 5-minute TTL and stale price detection
     * @param {string} variety - Coffee variety (ARABICA, ROBUSTA, SPECIALTY, ORGANIC)
     * @param {number} grade - Coffee grade (1-10)
     * @returns {Promise<Object>} Price data with basePrice, lastUpdated, isActive, isStale
     * @throws {PricingError} If variety or grade is invalid
     */
    async getCoffeePrices(variety, grade) {
        // Normalize variety
        const normalizedVariety = normalizeVariety(variety);
        
        // Validate inputs
        if (!this.isValidVariety(normalizedVariety)) {
            throw new PricingError(`Invalid coffee variety: ${variety}`, variety, grade);
        }
        
        if (!this.isValidGrade(grade)) {
            throw new PricingError(`Invalid coffee grade: ${grade}. Must be between 1-10`, variety, grade);
        }
        
        // Check cache first
        const cached = this.getCachedPrice(normalizedVariety, grade);
        if (cached) {
            // If cached data is stale, don't use it and fetch fresh data
            if (cached.isStale) {
                console.log(`Cached price for ${normalizedVariety} grade ${grade} is stale, fetching fresh data`);
                // Remove stale cache entry
                const cacheKey = this.getCacheKey(normalizedVariety, grade);
                this.priceCache.delete(cacheKey);
            } else {
                console.log(`Using cached price for ${normalizedVariety} grade ${grade}`);
                return cached;
            }
        }
        
        try {
            // Fetch from API
            const priceData = await this.apiClient.getCoffeePrices(normalizedVariety, grade);
            
            // Check if price is stale
            const isStale = this.isPriceStale(priceData.lastUpdated);
            
            // Add stale flag to response
            const enrichedData = {
                ...priceData,
                isStale: isStale
            };
            
            // Warn if price is stale
            if (isStale) {
                console.warn(`Price data for ${normalizedVariety} grade ${grade} is stale (last updated: ${priceData.lastUpdated})`);
            }
            
            // Cache the result only if not stale
            if (!isStale) {
                this.setCachedPrice(normalizedVariety, grade, enrichedData);
            }
            
            return enrichedData;
        } catch (error) {
            console.error(`Error fetching coffee prices for ${normalizedVariety} grade ${grade}:`, error);
            throw new PricingError(
                `Failed to fetch coffee prices: ${error.message}`,
                variety,
                grade
            );
        }
    }
    
    /**
     * Get seasonal coffee price with monthly multiplier applied
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade (1-10)
     * @param {number} month - Month (1-12)
     * @returns {Promise<Object>} Seasonal price data with basePrice, seasonalPrice, multiplier, month
     * @throws {PricingError} If inputs are invalid
     */
    async getSeasonalPrice(variety, grade, month) {
        // Normalize variety
        const normalizedVariety = normalizeVariety(variety);
        
        // Validate inputs
        if (!this.isValidVariety(normalizedVariety)) {
            throw new PricingError(`Invalid coffee variety: ${variety}`, variety, grade);
        }
        
        if (!this.isValidGrade(grade)) {
            throw new PricingError(`Invalid coffee grade: ${grade}. Must be between 1-10`, variety, grade);
        }
        
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            throw new PricingError(`Invalid month: ${month}. Must be between 1-12`, variety, grade);
        }
        
        try {
            // Fetch seasonal price from API
            const seasonalData = await this.apiClient.getSeasonalPrice(normalizedVariety, grade, month);
            
            // Check if base price is stale
            const isStale = this.isPriceStale(seasonalData.lastUpdated);
            
            if (isStale) {
                console.warn(`Seasonal price data for ${normalizedVariety} grade ${grade} month ${month} is stale`);
            }
            
            return {
                ...seasonalData,
                isStale: isStale
            };
        } catch (error) {
            console.error(`Error fetching seasonal price for ${normalizedVariety} grade ${grade} month ${month}:`, error);
            throw new PricingError(
                `Failed to fetch seasonal price: ${error.message}`,
                variety,
                grade
            );
        }
    }
    
    /**
     * Get all variety prices (convenience method for displaying price tables)
     * @returns {Promise<Array>} Array of price data for all varieties and grades
     */
    async getAllVarietyPrices() {
        try {
            const allPrices = await this.apiClient.getAllVarietyPrices();
            
            // Check for stale prices and add flags
            return allPrices.map(priceData => ({
                ...priceData,
                isStale: this.isPriceStale(priceData.lastUpdated)
            }));
        } catch (error) {
            console.error('Error fetching all variety prices:', error);
            throw new PricingError(`Failed to fetch all variety prices: ${error.message}`);
        }
    }
    
    /**
     * Get seasonal multipliers for all months
     * @returns {Promise<Object>} Object with month keys (1-12) and multiplier values
     */
    async getSeasonalMultipliers() {
        try {
            return await this.apiClient.getSeasonalMultipliers();
        } catch (error) {
            console.error('Error fetching seasonal multipliers:', error);
            throw new PricingError(`Failed to fetch seasonal multipliers: ${error.message}`);
        }
    }
    
    /**
     * Apply seasonal multiplier to a base price
     * Utility method for price calculations
     * @param {number} basePrice - Base price per kg in USDC
     * @param {number} multiplier - Seasonal multiplier (e.g., 1.2 for 20% increase)
     * @returns {number} Adjusted price
     */
    applySeasonalMultiplier(basePrice, multiplier) {
        if (typeof basePrice !== 'number' || basePrice < 0) {
            throw new PricingError('Base price must be a positive number');
        }
        
        if (typeof multiplier !== 'number' || multiplier <= 0) {
            throw new PricingError('Multiplier must be a positive number');
        }
        
        return basePrice * multiplier;
    }
    
    /**
     * Calculate projected revenue for a harvest
     * Applies variety, grade, and seasonal adjustments
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade (1-10)
     * @param {number} yieldKg - Harvest yield in kilograms
     * @param {number} harvestMonth - Month of harvest (1-12)
     * @returns {Promise<Object>} Projected revenue data with breakdown
     * @throws {PricingError} If inputs are invalid
     */
    async calculateProjectedRevenue(groveTokenAddress, variety, grade, yieldKg, harvestMonth) {
        // Normalize variety
        const normalizedVariety = normalizeVariety(variety);
        
        // Validate inputs
        if (!this.isValidVariety(normalizedVariety)) {
            throw new PricingError(`Invalid coffee variety: ${variety}`, variety, grade);
        }
        
        if (!this.isValidGrade(grade)) {
            throw new PricingError(`Invalid coffee grade: ${grade}. Must be between 1-10`, variety, grade);
        }
        
        if (typeof yieldKg !== 'number' || yieldKg <= 0) {
            throw new PricingError('Yield must be a positive number', variety, grade);
        }
        
        if (!Number.isInteger(harvestMonth) || harvestMonth < 1 || harvestMonth > 12) {
            throw new PricingError(`Invalid harvest month: ${harvestMonth}. Must be between 1-12`, variety, grade);
        }
        
        try {
            // Clear cache for this variety/grade combination before fetching fresh data
            // This ensures we get the most up-to-date price information
            const cacheKey = this.getCacheKey(normalizedVariety, grade);
            this.priceCache.delete(cacheKey);
            
            // Call API to calculate projected revenue
            // The backend will handle fetching prices and applying all adjustments
            const revenueData = await this.apiClient.calculateProjectedRevenue(
                groveTokenAddress,
                normalizedVariety,
                grade,
                yieldKg,
                harvestMonth
            );
            
            // Check if price data used is stale
            const isStale = this.isPriceStale(revenueData.lastUpdated);
            
            if (isStale) {
                console.warn(`Projected revenue calculation uses stale price data for ${normalizedVariety} grade ${grade}`);
                // Clear cache for stale data to force refresh on next request
                this.priceCache.delete(cacheKey);
            }
            
            // Cache the fresh data for future use (only if not stale)
            if (!isStale) {
                this.setCachedPrice(normalizedVariety, grade, {
                    ...revenueData,
                    isStale: false
                });
            }
            
            return {
                ...revenueData,
                isStale: isStale
            };
        } catch (error) {
            console.error(`Error calculating projected revenue for ${normalizedVariety} grade ${grade}:`, error);
            throw new PricingError(
                `Failed to calculate projected revenue: ${error.message}`,
                variety,
                grade
            );
        }
    }
    
    /**
     * Validate a proposed sale price against market rates
     * Checks if price is within 50%-200% of market price
     * @param {string} variety - Coffee variety
     * @param {number} grade - Coffee grade (1-10)
     * @param {number} proposedPrice - Proposed price per kg in USDC
     * @returns {Promise<Object>} Validation result with isValid, marketPrice, minPrice, maxPrice, reason
     * @throws {PricingError} If inputs are invalid
     */
    async validateSalePrice(variety, grade, proposedPrice) {
        // Normalize variety
        const normalizedVariety = normalizeVariety(variety);
        
        // Validate inputs
        if (!this.isValidVariety(normalizedVariety)) {
            throw new PricingError(`Invalid coffee variety: ${variety}`, variety, grade);
        }
        
        if (!this.isValidGrade(grade)) {
            throw new PricingError(`Invalid coffee grade: ${grade}. Must be between 1-10`, variety, grade);
        }
        
        if (typeof proposedPrice !== 'number' || proposedPrice <= 0) {
            throw new PricingError('Proposed price must be a positive number', variety, grade);
        }
        
        try {
            // Call API to validate price
            const validationResult = await this.apiClient.validateSalePrice(
                normalizedVariety,
                grade,
                proposedPrice
            );
            
            // Check if market price data is stale
            const isStale = this.isPriceStale(validationResult.lastUpdated);
            
            if (isStale) {
                console.warn(`Price validation uses stale market data for ${normalizedVariety} grade ${grade}`);
            }
            
            // Add additional context
            return {
                ...validationResult,
                isStale: isStale,
                proposedPrice: proposedPrice,
                variety: variety,
                grade: grade
            };
        } catch (error) {
            console.error(`Error validating sale price for ${normalizedVariety} grade ${grade}:`, error);
            throw new PricingError(
                `Failed to validate sale price: ${error.message}`,
                variety,
                grade
            );
        }
    }
    
    /**
     * Get price range for validation (50%-200% of market price)
     * Utility method for client-side validation
     * @param {number} marketPrice - Current market price per kg
     * @returns {Object} Object with minPrice and maxPrice
     */
    getPriceRange(marketPrice) {
        if (typeof marketPrice !== 'number' || marketPrice <= 0) {
            throw new PricingError('Market price must be a positive number');
        }
        
        return {
            minPrice: marketPrice * this.minPriceMultiplier,
            maxPrice: marketPrice * this.maxPriceMultiplier
        };
    }
    
    /**
     * Check if a price is within valid range (client-side check)
     * @param {number} proposedPrice - Proposed price to check
     * @param {number} marketPrice - Current market price
     * @returns {boolean} True if price is within 50%-200% range
     */
    isPriceInRange(proposedPrice, marketPrice) {
        const range = this.getPriceRange(marketPrice);
        return proposedPrice >= range.minPrice && proposedPrice <= range.maxPrice;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PriceOracleManager,
        CoffeeVariety,
        CoffeeGrade,
        PricingError,
        StalePriceError
    };
}

// Export class to window for global access
if (typeof window !== 'undefined') {
    window.PriceOracleManager = PriceOracleManager;
    // Create global instance for use in browser
    if (window.coffeeAPI) {
        window.priceOracle = new PriceOracleManager(window.coffeeAPI);
    }
}
