/**
 * Balance Poller
 * Handles real-time balance updates with caching and retry logic
 */

class BalancePoller {
    constructor(apiClient, walletManager, options = {}) {
        this.apiClient = apiClient;
        this.walletManager = walletManager;
        
        // Configuration
        this.pollingInterval = options.pollingInterval || 30000; // 30 seconds default
        this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds cache
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        
        // State
        this.isPolling = false;
        this.pollingTimer = null;
        this.balanceCache = new Map();
        this.listeners = new Map();
        this.lastFetchTime = new Map();
        
        // Bind methods
        this.pollBalances = this.pollBalances.bind(this);
    }

    /**
     * Start polling for balance updates
     */
    startPolling() {
        if (this.isPolling) {
            console.log('Balance polling already active');
            return;
        }
        
        console.log('Starting balance polling...');
        this.isPolling = true;
        
        // Initial fetch
        this.pollBalances();
        
        // Set up interval
        this.pollingTimer = setInterval(this.pollBalances, this.pollingInterval);
    }

    /**
     * Stop polling for balance updates
     */
    stopPolling() {
        if (!this.isPolling) {
            return;
        }
        
        console.log('Stopping balance polling...');
        this.isPolling = false;
        
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    /**
     * Poll all registered balances
     */
    async pollBalances() {
        if (!this.walletManager.isWalletConnected()) {
            return;
        }
        
        const accountId = this.walletManager.getAccountId();
        if (!accountId) {
            return;
        }
        
        try {
            // Fetch all balance types
            await Promise.allSettled([
                this.fetchTokenBalances(accountId),
                this.fetchUSDCBalance(accountId),
                this.fetchLPTokenBalances(accountId),
                this.fetchFarmerBalance(accountId),
                this.fetchPendingDistributions(accountId)
            ]);
        } catch (error) {
            console.error('Error polling balances:', error);
        }
    }

    /**
     * Fetch token balances for all groves
     */
    async fetchTokenBalances(accountId) {
        const cacheKey = `token_${accountId}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        try {
            const balances = await this.retryFetch(async () => {
                // Fetch groves first
                const response = await this.apiClient.getGroves();
                const groves = response.groves || response || [];
                const tokenBalances = {};
                
                // Fetch balance for each grove
                for (const grove of groves) {
                    try {
                        const balance = await this.apiClient.getTokenBalance(grove.id, accountId);
                        tokenBalances[grove.id] = balance;
                    } catch (error) {
                        console.error(`Error fetching balance for grove ${grove.id}:`, error);
                        tokenBalances[grove.id] = 0;
                    }
                }
                
                return tokenBalances;
            });
            
            // Update cache
            this.updateCache(cacheKey, balances);
            
            // Notify listeners
            this.notifyListeners('tokenBalances', balances);
            
            return balances;
        } catch (error) {
            console.error('Failed to fetch token balances:', error);
            throw error;
        }
    }

    /**
     * Fetch USDC balance
     */
    async fetchUSDCBalance(accountId) {
        const cacheKey = `usdc_${accountId}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        try {
            const balance = await this.retryFetch(async () => {
                return await this.apiClient.getUSDCBalance(accountId);
            });
            
            // Update cache
            this.updateCache(cacheKey, balance);
            
            // Notify listeners
            this.notifyListeners('usdcBalance', balance);
            
            return balance;
        } catch (error) {
            console.error('Failed to fetch USDC balance:', error);
            throw error;
        }
    }

    /**
     * Fetch LP token balances
     */
    async fetchLPTokenBalances(accountId) {
        const cacheKey = `lp_${accountId}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        try {
            const balances = await this.retryFetch(async () => {
                return await this.apiClient.getLPTokenBalances(accountId);
            });
            
            // Update cache
            this.updateCache(cacheKey, balances);
            
            // Notify listeners
            this.notifyListeners('lpBalances', balances);
            
            return balances;
        } catch (error) {
            console.error('Failed to fetch LP token balances:', error);
            throw error;
        }
    }

    /**
     * Fetch farmer revenue balance
     */
    async fetchFarmerBalance(accountId) {
        const cacheKey = `farmer_${accountId}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        try {
            const balance = await this.retryFetch(async () => {
                return await this.apiClient.getFarmerBalance(accountId);
            });
            
            // Update cache
            this.updateCache(cacheKey, balance);
            
            // Notify listeners
            this.notifyListeners('farmerBalance', balance);
            
            return balance;
        } catch (error) {
            console.error('Failed to fetch farmer balance:', error);
            throw error;
        }
    }

    /**
     * Fetch pending distributions
     */
    async fetchPendingDistributions(accountId) {
        const cacheKey = `pending_${accountId}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        try {
            const distributions = await this.retryFetch(async () => {
                return await this.apiClient.getPendingDistributions(accountId);
            });
            
            // Update cache
            this.updateCache(cacheKey, distributions);
            
            // Notify listeners
            this.notifyListeners('pendingDistributions', distributions);
            
            return distributions;
        } catch (error) {
            console.error('Failed to fetch pending distributions:', error);
            throw error;
        }
    }

    /**
     * Retry fetch with exponential backoff
     */
    async retryFetch(fetchFn, attempt = 1) {
        try {
            return await fetchFn();
        } catch (error) {
            if (attempt >= this.maxRetries) {
                throw error;
            }
            
            // Exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            console.log(`Retry attempt ${attempt}/${this.maxRetries} after ${delay}ms`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryFetch(fetchFn, attempt + 1);
        }
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(cacheKey) {
        if (!this.balanceCache.has(cacheKey)) {
            return false;
        }
        
        const lastFetch = this.lastFetchTime.get(cacheKey);
        if (!lastFetch) {
            return false;
        }
        
        const now = Date.now();
        return (now - lastFetch) < this.cacheTimeout;
    }

    /**
     * Update cache with new data
     */
    updateCache(cacheKey, data) {
        this.balanceCache.set(cacheKey, data);
        this.lastFetchTime.set(cacheKey, Date.now());
    }

    /**
     * Clear cache for specific key or all
     */
    clearCache(cacheKey = null) {
        if (cacheKey) {
            this.balanceCache.delete(cacheKey);
            this.lastFetchTime.delete(cacheKey);
        } else {
            this.balanceCache.clear();
            this.lastFetchTime.clear();
        }
    }

    /**
     * Force refresh of specific balance type
     */
    async forceRefresh(balanceType, accountId) {
        accountId = accountId || this.walletManager.getAccountId();
        
        if (!accountId) {
            throw new Error('No account ID available');
        }
        
        // Clear cache for this balance type
        const cacheKey = `${balanceType}_${accountId}`;
        this.clearCache(cacheKey);
        
        // Fetch fresh data
        switch (balanceType) {
            case 'token':
                return await this.fetchTokenBalances(accountId);
            case 'usdc':
                return await this.fetchUSDCBalance(accountId);
            case 'lp':
                return await this.fetchLPTokenBalances(accountId);
            case 'farmer':
                return await this.fetchFarmerBalance(accountId);
            case 'pending':
                return await this.fetchPendingDistributions(accountId);
            default:
                throw new Error(`Unknown balance type: ${balanceType}`);
        }
    }

    /**
     * Register a listener for balance updates
     */
    addListener(balanceType, callback) {
        if (!this.listeners.has(balanceType)) {
            this.listeners.set(balanceType, []);
        }
        
        this.listeners.get(balanceType).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(balanceType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Notify all listeners of balance update
     */
    notifyListeners(balanceType, data) {
        const callbacks = this.listeners.get(balanceType);
        if (!callbacks || callbacks.length === 0) {
            return;
        }
        
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in balance listener:', error);
            }
        });
    }

    /**
     * Get cached balance without fetching
     */
    getCachedBalance(balanceType, accountId) {
        accountId = accountId || this.walletManager.getAccountId();
        const cacheKey = `${balanceType}_${accountId}`;
        
        if (this.isCacheValid(cacheKey)) {
            return this.balanceCache.get(cacheKey);
        }
        
        return null;
    }

    /**
     * Refresh balances after transaction
     * Waits for transaction confirmation then refreshes within 5 seconds
     */
    async refreshAfterTransaction(transactionHash, balanceTypes = ['token', 'usdc']) {
        try {
            // Wait for transaction confirmation (simulate with delay)
            await this.waitForTransactionConfirmation(transactionHash);
            
            // Refresh specified balance types
            const accountId = this.walletManager.getAccountId();
            if (!accountId) {
                return;
            }
            
            const refreshPromises = balanceTypes.map(type => 
                this.forceRefresh(type, accountId).catch(error => {
                    console.error(`Failed to refresh ${type} balance:`, error);
                })
            );
            
            await Promise.allSettled(refreshPromises);
            
            console.log('Balances refreshed after transaction');
        } catch (error) {
            console.error('Error refreshing balances after transaction:', error);
        }
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForTransactionConfirmation(transactionHash, timeout = 5000) {
        // In a real implementation, this would poll the blockchain
        // For now, we'll simulate with a delay
        return new Promise(resolve => setTimeout(resolve, timeout));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BalancePoller;
}
