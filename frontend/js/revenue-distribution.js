/**
 * Revenue Distribution Module
 * Handles investor earnings distribution and farmer revenue withdrawals
 */

/**
 * Custom error class for distribution-related errors
 */
class DistributionError extends Error {
    constructor(message, distributionId = null, failedHolders = []) {
        super(message);
        this.name = 'DistributionError';
        this.distributionId = distributionId;
        this.failedHolders = failedHolders;
    }
}

/**
 * Custom error class for insufficient balance errors
 */
class InsufficientBalanceError extends Error {
    constructor(required, available) {
        super(`Insufficient balance: required ${required}, available ${available}`);
        this.name = 'InsufficientBalanceError';
        this.required = required;
        this.available = available;
    }
}

/**
 * RevenueDistributionManager
 * Manages revenue distribution operations for the Coffee Tree Platform
 */
class RevenueDistributionManager {
    /**
     * Initialize the Revenue Distribution Manager
     * @param {CoffeeTreeAPI} apiClient - API client instance for backend communication
     * @param {Object} walletManager - Wallet manager instance for transaction signing
     */
    constructor(apiClient, walletManager = null) {
        if (!apiClient) {
            throw new Error('API client is required for RevenueDistributionManager');
        }
        
        this.apiClient = apiClient;
        this.walletManager = walletManager;
        
        // Cache for distribution data (1 hour TTL as per design)
        this.distributionCache = new Map();
        this.cacheTimeout = 60 * 60 * 1000; // 1 hour cache (3600000 ms)
        
        // Initialize state
        this.initialized = true;
        
        console.log('RevenueDistributionManager initialized');
    }

    /**
     * Validate that the manager is properly initialized
     * @private
     */
    _validateInitialization() {
        if (!this.initialized) {
            throw new Error('RevenueDistributionManager not properly initialized');
        }
    }

    /**
     * Get cached data or fetch new data
     * @private
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @returns {Promise<any>} Cached or fresh data
     */
    async _getCachedOrFetch(key, fetchFn) {
        const cached = this.distributionCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        
        const data = await fetchFn();
        this.distributionCache.set(key, {
            data,
            timestamp: now
        });
        
        return data;
    }

    /**
     * Clear cache for a specific key or all cache
     * @param {string} key - Optional cache key to clear
     */
    clearCache(key = null) {
        if (key) {
            this.distributionCache.delete(key);
        } else {
            this.distributionCache.clear();
        }
    }

    /**
     * Validate wallet connection
     * @private
     * @throws {Error} If wallet is not connected
     */
    _validateWalletConnection() {
        if (!this.walletManager) {
            throw new Error('Wallet manager not available');
        }
    }

    // ========================================================================
    // Distribution Calculation Methods (Task 3.1)
    // ========================================================================

    /**
     * Calculate the farmer's share of total revenue (30%)
     * @param {number} totalRevenue - Total revenue from harvest in USDC
     * @returns {number} Farmer's share amount
     * @throws {Error} If revenue amount is invalid
     */
    calculateFarmerShare(totalRevenue) {
        // Validate revenue amount
        if (typeof totalRevenue !== 'number' || isNaN(totalRevenue)) {
            throw new Error('Total revenue must be a valid number');
        }
        
        if (totalRevenue < 0) {
            throw new Error('Total revenue cannot be negative');
        }
        
        if (totalRevenue === 0) {
            return 0;
        }
        
        // Calculate 30% for farmer
        const farmerShare = totalRevenue * 0.30;
        
        return farmerShare;
    }

    /**
     * Calculate the investor's share of total revenue (70%)
     * @param {number} totalRevenue - Total revenue from harvest in USDC
     * @returns {number} Investor's share amount
     * @throws {Error} If revenue amount is invalid
     */
    calculateInvestorShare(totalRevenue) {
        // Validate revenue amount
        if (typeof totalRevenue !== 'number' || isNaN(totalRevenue)) {
            throw new Error('Total revenue must be a valid number');
        }
        
        if (totalRevenue < 0) {
            throw new Error('Total revenue cannot be negative');
        }
        
        if (totalRevenue === 0) {
            return 0;
        }
        
        // Calculate 70% for investors
        const investorShare = totalRevenue * 0.70;
        
        return investorShare;
    }

    /**
     * Calculate an individual token holder's share of the investor portion
     * @param {number} totalRevenue - Total revenue from harvest in USDC
     * @param {number} tokenBalance - Token holder's token balance
     * @param {number} totalSupply - Total token supply for the grove
     * @returns {number} Holder's share amount in USDC
     * @throws {Error} If parameters are invalid
     */
    calculateHolderShare(totalRevenue, tokenBalance, totalSupply) {
        // Validate inputs
        if (typeof totalRevenue !== 'number' || isNaN(totalRevenue)) {
            throw new Error('Total revenue must be a valid number');
        }
        
        if (typeof tokenBalance !== 'number' || isNaN(tokenBalance)) {
            throw new Error('Token balance must be a valid number');
        }
        
        if (typeof totalSupply !== 'number' || isNaN(totalSupply)) {
            throw new Error('Total supply must be a valid number');
        }
        
        if (totalRevenue < 0) {
            throw new Error('Total revenue cannot be negative');
        }
        
        if (tokenBalance < 0) {
            throw new Error('Token balance cannot be negative');
        }
        
        if (totalSupply <= 0) {
            throw new Error('Total supply must be greater than zero');
        }
        
        if (tokenBalance > totalSupply) {
            throw new Error('Token balance cannot exceed total supply');
        }
        
        // If no tokens or no revenue, return 0
        if (tokenBalance === 0 || totalRevenue === 0) {
            return 0;
        }
        
        // Calculate investor share (70% of total revenue)
        const investorShare = this.calculateInvestorShare(totalRevenue);
        
        // Calculate holder's proportional share based on token balance
        const holderShare = (tokenBalance / totalSupply) * investorShare;
        
        return holderShare;
    }

    // ========================================================================
    // Batch Processing Logic (Task 3.2)
    // ========================================================================

    /**
     * Process a distribution batch for multiple token holders
     * @param {string} distributionId - Unique identifier for the distribution
     * @param {Array} holders - Array of holder objects with address, tokenBalance, and shareAmount
     * @param {number} batchSize - Maximum number of holders to process per batch (default: 50)
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Result object with success/failure counts and details
     * @throws {DistributionError} If batch processing encounters critical errors
     */
    async processDistributionBatch(distributionId, holders, batchSize = 50, loadingManager = null) {
        // Validate inputs
        if (!distributionId) {
            throw new DistributionError('Distribution ID is required');
        }
        
        if (!Array.isArray(holders)) {
            throw new DistributionError('Holders must be an array', distributionId);
        }
        
        if (holders.length === 0) {
            return {
                distributionId,
                totalHolders: 0,
                successfulTransfers: 0,
                failedTransfers: 0,
                successfulHolders: [],
                failedHolders: [],
                completed: true
            };
        }
        
        // Validate and enforce batch size limit
        if (typeof batchSize !== 'number' || batchSize <= 0) {
            throw new DistributionError('Batch size must be a positive number', distributionId);
        }
        
        // Enforce maximum batch size of 50
        const maxBatchSize = 50;
        const effectiveBatchSize = Math.min(batchSize, maxBatchSize);
        
        // Split holders into batches
        const batches = [];
        for (let i = 0; i < holders.length; i += effectiveBatchSize) {
            batches.push(holders.slice(i, i + effectiveBatchSize));
        }
        
        // Track results
        const result = {
            distributionId,
            totalHolders: holders.length,
            successfulTransfers: 0,
            failedTransfers: 0,
            successfulHolders: [],
            failedHolders: [],
            completed: false
        };
        
        console.log(`Processing distribution ${distributionId}: ${holders.length} holders in ${batches.length} batches`);
        
        // Show progress bar if loading manager is available
        const progressId = loadingManager ? 
            loadingManager.showProgress(`distribution-${distributionId}`, {
                message: 'Processing distribution...',
                total: holders.length,
                current: 0
            }) : null;
        
        // Process each batch
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} holders)`);
            
            // Update progress message
            if (progressId && loadingManager) {
                loadingManager.updateProgress(
                    progressId,
                    result.successfulTransfers + result.failedTransfers,
                    `Processing batch ${batchIndex + 1} of ${batches.length}...`
                );
            }
            
            // Process holders in the current batch
            for (const holder of batch) {
                try {
                    // Validate holder data
                    if (!holder.address) {
                        throw new Error('Holder address is required');
                    }
                    
                    if (typeof holder.shareAmount !== 'number' || holder.shareAmount < 0) {
                        throw new Error('Invalid share amount');
                    }
                    
                    // Skip if share amount is zero
                    if (holder.shareAmount === 0) {
                        console.log(`Skipping holder ${holder.address} with zero share`);
                        result.successfulTransfers++;
                        result.successfulHolders.push({
                            address: holder.address,
                            shareAmount: 0,
                            transactionHash: null,
                            skipped: true
                        });
                        continue;
                    }
                    
                    // Attempt transfer with retry logic
                    const transferResult = await this._transferWithRetry(
                        distributionId,
                        holder.address,
                        holder.shareAmount,
                        3 // max retries
                    );
                    
                    if (transferResult.success) {
                        result.successfulTransfers++;
                        result.successfulHolders.push({
                            address: holder.address,
                            shareAmount: holder.shareAmount,
                            transactionHash: transferResult.transactionHash,
                            timestamp: new Date().toISOString()
                        });
                        console.log(`✓ Transfer successful for ${holder.address}: ${holder.shareAmount} USDC`);
                        
                        // Update progress
                        if (progressId && loadingManager) {
                            loadingManager.updateProgress(
                                progressId,
                                result.successfulTransfers + result.failedTransfers
                            );
                        }
                    } else {
                        throw new Error(transferResult.error || 'Transfer failed');
                    }
                    
                } catch (error) {
                    // Log failure but continue with remaining holders
                    result.failedTransfers++;
                    result.failedHolders.push({
                        address: holder.address,
                        shareAmount: holder.shareAmount,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    console.error(`✗ Transfer failed for ${holder.address}:`, error.message);
                    
                    // Update progress
                    if (progressId && loadingManager) {
                        loadingManager.updateProgress(
                            progressId,
                            result.successfulTransfers + result.failedTransfers
                        );
                    }
                }
            }
            
            // Small delay between batches to avoid overwhelming the network
            if (batchIndex < batches.length - 1) {
                await this._delay(1000); // 1 second delay
            }
        }
        
        // Mark as completed
        result.completed = true;
        
        // Hide progress bar
        if (progressId && loadingManager) {
            loadingManager.hideProgress(progressId);
        }
        
        console.log(`Distribution ${distributionId} completed: ${result.successfulTransfers} successful, ${result.failedTransfers} failed`);
        
        // If there were failures, throw an error with details
        if (result.failedTransfers > 0) {
            console.warn(`Distribution ${distributionId} completed with ${result.failedTransfers} failures`);
        }
        
        return result;
    }

    /**
     * Transfer funds to a holder with retry logic
     * @private
     * @param {string} distributionId - Distribution identifier
     * @param {string} holderAddress - Holder's wallet address
     * @param {number} amount - Amount to transfer in USDC
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<Object>} Transfer result with success status and transaction hash
     */
    async _transferWithRetry(distributionId, holderAddress, amount, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Call API to process the transfer
                const response = await this.apiClient.claimEarnings(distributionId, holderAddress);
                
                if (response && response.success) {
                    return {
                        success: true,
                        transactionHash: response.transactionHash || null
                    };
                } else {
                    throw new Error(response?.error || 'Transfer failed without error message');
                }
                
            } catch (error) {
                lastError = error;
                console.warn(`Transfer attempt ${attempt}/${maxRetries} failed for ${holderAddress}:`, error.message);
                
                // If not the last attempt, wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    await this._delay(delayMs);
                }
            }
        }
        
        // All retries failed
        return {
            success: false,
            error: lastError?.message || 'Transfer failed after all retries'
        };
    }

    /**
     * Utility function to delay execution
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RevenueDistributionManager,
        DistributionError,
        InsufficientBalanceError
    };
}
