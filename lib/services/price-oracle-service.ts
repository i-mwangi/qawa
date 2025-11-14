/**
 * Price Oracle Service
 * Provides token pricing based on marketplace activity
 */

import { db } from '../../db/index.js';
import { tokenHoldings, coffeeGroves } from '../../db/schema/index.js';
import { eq, desc, and, gte } from 'drizzle-orm';

interface PricePoint {
    price: number;
    timestamp: number;
}

interface TokenPrice {
    tokenId: string;
    currentPrice: number;
    lastUpdated: number;
    source: string;
    confidence: 'high' | 'medium' | 'low';
}

export class PriceOracleService {
    private priceCache: Map<string, TokenPrice>;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly USDC_PRICE = 1.0; // USDC is always $1.00

    constructor() {
        this.priceCache = new Map();
        console.log('[PriceOracleService] Initialized');
    }

    /**
     * Get current token price
     */
    async getTokenPrice(tokenId: string): Promise<number> {
        console.log(`[PriceOracleService] Getting price for token: ${tokenId}`);

        // Check if USDC
        if (this.isUSDCToken(tokenId)) {
            return this.USDC_PRICE;
        }

        // Check cache
        const cached = this.priceCache.get(tokenId);
        if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_TTL) {
            console.log(`  ✅ Using cached price: $${cached.currentPrice}`);
            return cached.currentPrice;
        }

        // Calculate price from marketplace
        const price = await this.calculateMarketPrice(tokenId);

        // Cache the price
        this.priceCache.set(tokenId, {
            tokenId,
            currentPrice: price,
            lastUpdated: Date.now(),
            source: 'marketplace',
            confidence: 'high'
        });

        console.log(`  ✅ Calculated price: $${price}`);
        return price;
    }

    /**
     * Get price history for a token
     */
    async getPriceHistory(tokenId: string, days: number = 30): Promise<PricePoint[]> {
        console.log(`[PriceOracleService] Getting ${days}-day price history for: ${tokenId}`);

        try {
            // Calculate timestamp for X days ago
            const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

            // Get all purchases for this token in the time period
            const purchases = await db.select()
                .from(tokenHoldings)
                .where(
                    and(
                        eq(tokenHoldings.groveId, this.extractGroveIdFromToken(tokenId)),
                        gte(tokenHoldings.purchaseDate, startTime)
                    )
                )
                .orderBy(tokenHoldings.purchaseDate);

            // Convert to price points
            const pricePoints: PricePoint[] = purchases.map(purchase => ({
                price: purchase.purchasePrice / purchase.tokenAmount, // Price per token
                timestamp: purchase.purchaseDate
            }));

            // If no history, return current price
            if (pricePoints.length === 0) {
                const currentPrice = await this.getTokenPrice(tokenId);
                return [{
                    price: currentPrice,
                    timestamp: Date.now()
                }];
            }

            return pricePoints;

        } catch (error) {
            console.error('[PriceOracleService] Error getting price history:', error);
            return [];
        }
    }

    /**
     * Calculate market price from recent sales
     */
    async calculateMarketPrice(tokenId: string): Promise<number> {
        try {
            // Extract grove ID from token ID
            const groveId = this.extractGroveIdFromToken(tokenId);

            // Get recent purchases (last 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            const recentPurchases = await db.select()
                .from(tokenHoldings)
                .where(
                    and(
                        eq(tokenHoldings.groveId, groveId),
                        gte(tokenHoldings.purchaseDate, thirtyDaysAgo),
                        eq(tokenHoldings.isActive, true)
                    )
                )
                .orderBy(desc(tokenHoldings.purchaseDate))
                .limit(10); // Last 10 purchases

            if (recentPurchases.length === 0) {
                // No recent purchases, use default price
                console.log('  ℹ️  No recent purchases, using default price');
                return this.getDefaultTokenPrice(groveId);
            }

            // Calculate weighted average (more recent = higher weight)
            let totalWeightedPrice = 0;
            let totalWeight = 0;

            recentPurchases.forEach((purchase, index) => {
                const pricePerToken = purchase.purchasePrice / purchase.tokenAmount;
                const weight = recentPurchases.length - index; // More recent = higher weight
                totalWeightedPrice += pricePerToken * weight;
                totalWeight += weight;
            });

            const averagePrice = totalWeightedPrice / totalWeight;

            // Round to 2 decimals
            return Math.round(averagePrice * 100) / 100;

        } catch (error) {
            console.error('[PriceOracleService] Error calculating market price:', error);
            return 10.0; // Fallback price
        }
    }

    /**
     * Get default token price based on grove characteristics
     */
    private async getDefaultTokenPrice(groveId: number): Promise<number> {
        try {
            // Get grove details
            const groves = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.id, groveId))
                .limit(1);

            if (groves.length === 0) {
                return 10.0; // Default fallback
            }

            const grove = groves[0];

            // Calculate base price from grove characteristics
            let basePrice = 10.0;

            // Adjust for health score
            if (grove.currentHealthScore) {
                if (grove.currentHealthScore >= 80) {
                    basePrice *= 1.2; // 20% premium for excellent health
                } else if (grove.currentHealthScore >= 60) {
                    basePrice *= 1.0; // Normal price
                } else {
                    basePrice *= 0.8; // 20% discount for poor health
                }
            }

            // Adjust for expected yield
            if (grove.expectedYieldPerTree) {
                const yieldFactor = grove.expectedYieldPerTree / 5; // Assuming 5kg is average
                basePrice *= Math.max(0.5, Math.min(1.5, yieldFactor)); // Cap between 50% and 150%
            }

            return Math.round(basePrice * 100) / 100;

        } catch (error) {
            console.error('[PriceOracleService] Error getting default price:', error);
            return 10.0;
        }
    }

    /**
     * Update all token prices (for periodic updates)
     */
    async updateAllPrices(): Promise<void> {
        console.log('[PriceOracleService] Updating all token prices...');

        try {
            // Get all tokenized groves
            const groves = await db.select()
                .from(coffeeGroves)
                .where(eq(coffeeGroves.isTokenized, true));

            console.log(`  Found ${groves.length} tokenized groves`);

            for (const grove of groves) {
                if (grove.tokenAddress) {
                    await this.getTokenPrice(grove.tokenAddress);
                }
            }

            console.log('  ✅ All prices updated');

        } catch (error) {
            console.error('[PriceOracleService] Error updating all prices:', error);
        }
    }

    /**
     * Get multiple token prices at once
     */
    async getMultiplePrices(tokenIds: string[]): Promise<Map<string, number>> {
        const prices = new Map<string, number>();

        for (const tokenId of tokenIds) {
            const price = await this.getTokenPrice(tokenId);
            prices.set(tokenId, price);
        }

        return prices;
    }

    /**
     * Clear price cache
     */
    clearCache(tokenId?: string): void {
        if (tokenId) {
            this.priceCache.delete(tokenId);
            console.log(`[PriceOracleService] Cleared cache for: ${tokenId}`);
        } else {
            this.priceCache.clear();
            console.log('[PriceOracleService] Cleared all price cache');
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; tokens: string[] } {
        return {
            size: this.priceCache.size,
            tokens: Array.from(this.priceCache.keys())
        };
    }

    /**
     * Check if token is USDC
     */
    private isUSDCToken(tokenId: string): boolean {
        return tokenId.includes('USDC') || 
               tokenId === process.env.USDC_TOKEN_ID ||
               tokenId.toLowerCase() === 'usdc';
    }

    /**
     * Extract grove ID from token ID
     * Assumes token ID format includes grove ID
     */
    private extractGroveIdFromToken(tokenId: string): number {
        // Try to extract grove ID from token address
        // Format might be: 0.0.12345 or grove_123 or similar
        
        // If it's a Hedera token ID, we need to look it up in the database
        // For now, we'll search by token address
        
        // This is a placeholder - in production, you'd have a proper mapping
        const match = tokenId.match(/grove[_-]?(\d+)/i);
        if (match) {
            return parseInt(match[1]);
        }

        // Fallback: return 1 (will need proper implementation)
        return 1;
    }
}

// Export singleton instance
export const priceOracleService = new PriceOracleService();

// Start periodic price updates (every 5 minutes)
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        priceOracleService.updateAllPrices().catch(console.error);
    }, 5 * 60 * 1000);
}
