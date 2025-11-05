/**
 * API Client for Coffee Tree Platform
 * Handles all communication with the backend API
 */

export class CoffeeTreeAPI {
    constructor(baseURL) {
        if (!baseURL) {
            // Check for production API URL from environment variable
            if (import.meta.env?.VITE_API_URL) {
                // Use environment variable (for Render, Vercel, etc.)
                this.baseURL = import.meta.env.VITE_API_URL;
            } else if (window.location.hostname.includes('vercel.app') || 
                       window.location.hostname.includes('chai-project')) {
                // Vercel - use relative URLs (API on same domain)
                this.baseURL = '';
            } else if (window.location.hostname.includes('onrender.com')) {
                // Render - construct API URL from frontend URL
                // Replace 'frontend' with 'api' in the hostname
                const apiHostname = window.location.hostname.replace('frontend', 'api');
                this.baseURL = `https://${apiHostname}`;
            } else {
                // Local development
                const isDocker = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
                const apiHost = isDocker ? 'api_mock' : 'localhost';
                const apiPort = import.meta.env?.VITE_API_PORT || '3005';
                this.baseURL = `http://${apiHost}:${apiPort}`;
            }
        } else {
            this.baseURL = baseURL;
        }
        this.activeRequests = new Map(); // Track active requests to prevent duplicates
    }

    // Utility method for making HTTP requests with deduplication and better error handling
    async request(endpoint, options = {}) {
        const requestId = `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || '')}`;
        
        // If there's already an active request with the same ID, return that promise
        if (this.activeRequests.has(requestId)) {
            return this.activeRequests.get(requestId);
        }

        // Helper to add a timeout to fetch requests
        const fetchWithTimeout = (url, cfg, timeout = 60000) => { // Increased from 30000 to 60000 ms (1 minute)
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('Request timed out after ' + (timeout/1000) + ' seconds'))
                }, timeout)

                fetch(url, cfg).then(res => {
                    clearTimeout(timer)
                    resolve(res)
                }).catch(err => {
                    clearTimeout(timer)
                    reject(err)
                })
            })
        }

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // If user has chosen demo bypass on the frontend, forward a demo header
        try {
            if (localStorage.getItem('skipFarmerVerification') === 'true') {
                config.headers['x-demo-bypass'] = 'true'
                // Also include in body for servers that don't inspect headers
                if (config.body && typeof config.body === 'string') {
                    try {
                        const parsed = JSON.parse(config.body)
                        parsed.demoBypass = true
                        config.body = JSON.stringify(parsed)
                    } catch (e) {
                        // ignore
                    }
                } else if (config.body && typeof config.body === 'object') {
                    config.body.demoBypass = true
                }
            }
        } catch (e) {
            // ignore localStorage errors
        }

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        // Create the promise for this request
        const requestPromise = (async () => {
            try {
                const response = await fetchWithTimeout(url, config, 60000); // Increased from 30000 to 60000 ms (1 minute)
                
                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();

                    if (!response.ok) {
                        const message = data?.error || data?.message || `HTTP error! status: ${response.status}`;
                        const err = new Error(message);
                        err.status = response.status
                        throw err;
                    }

                    return data;
                } else {
                    // For non-JSON responses, return the text
                    const text = await response.text();
                    const message = `HTTP error! status: ${response.status}, message: ${text}`;
                    if (!response.ok) {
                        const err = new Error(message);
                        err.status = response.status;
                        throw err;
                    }
                    return { success: true, data: text };
                }
            } catch (error) {
                console.error(`API request failed: ${endpoint}`, error);
                // Re-throw with a clearer message for UI to display
                throw new Error(`API Error: ${error?.message || String(error)}`);
            } finally {
                // Clean up the active request tracking
                this.activeRequests.delete(requestId);
            }
        })();

        // Store the promise in our active requests map
        this.activeRequests.set(requestId, requestPromise);
        
        return requestPromise;
    }

    // Farmer Verification API
    async submitVerificationDocuments(farmerAddress, documents) {
        return this.request('/api/farmer-verification/submit-documents', {
            method: 'POST',
            body: {
                farmerAddress,
                documents
            }
        });
    }

    async getVerificationStatus(farmerAddress) {
        const resp = await this.request(`/api/farmer-verification/status/${farmerAddress}`);
        return { ...resp, verification: resp.data || resp.verification || null };
    }

    async getInvestorVerificationStatus(investorAddress) {
        const resp = await this.request(`/api/investor-verification/status/${investorAddress}`);
        return { ...resp, verification: resp.data || resp.verification || null };
    }

    async submitInvestorVerificationDocuments(investorAddress, documents) {
        return this.request('/api/investor-verification/submit-documents', {
            method: 'POST',
            body: {
                investorAddress,
                documents
            }
        });
    }

    async registerGroveOwnership(farmerAddress, groveName, ownershipProof) {
        // Use the correct endpoint instead of the deprecated one
        return this.request('/api/groves/register', {
            method: 'POST',
            body: {
                farmerAddress,
                groveName,
                ownershipProof
            }
        });
    }

    async getPendingVerifications() {
        return this.request('/api/farmer-verification/pending');
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return fetch(`${this.baseURL}/api/farmer-verification/upload`, {
            method: 'POST',
            body: formData
        }).then(response => response.json());
    }

    // Harvest Reporting API
    async reportHarvest(harvestData) {
        return this.request('/api/harvest/report', {
            method: 'POST',
            body: harvestData
        });
    }

    async getHarvestHistory(farmerAddress) {
        return this.request(`/api/harvest/history?farmerAddress=${farmerAddress}`);
    }

    async getPendingHarvests() {
        return this.request('/api/harvest/pending');
    }

    async getHarvestStats(farmerAddress) {
        return this.request(`/api/harvest/stats?farmerAddress=${farmerAddress}`);
    }

    // Tree Health API
    async updateTreeHealth(healthData) {
        return this.request('/api/tree-monitoring/sensor-data', {
            method: 'POST',
            body: healthData
        });
    }

    async getTreeHealth(groveId) {
        return this.request(`/api/tree-monitoring/health/${groveId}`);
    }

    // Notification API
    async sendNotification(notificationData) {
        return this.request('/api/notifications/send', {
            method: 'POST',
            body: notificationData
        });
    }

    async calculateDistribution(harvestId) {
        return this.request('/api/harvest/calculate-distribution', {
            method: 'POST',
            body: { harvestId }
        });
    }

    async recordDistribution(distributionData) {
        return this.request('/api/harvest/record-distribution', {
            method: 'POST',
            body: distributionData
        });
    }

    async getPendingDistributions() {
        return this.request('/api/harvest/pending-distributions');
    }

    async getHolderEarnings(holderAddress) {
        return this.request(`/api/harvest/holder/${holderAddress}/earnings`);
    }

    async getDistributionSummary(harvestId) {
        return this.request(`/api/harvest/${harvestId}/distribution-summary`);
    }

    async getHarvestEarnings(harvestId) {
        return this.request(`/api/harvest/${harvestId}/earnings`);
    }

    // Market Data API
    async getCurrentPrices() {
        return this.request('/api/market/prices');
    }

    async getPriceHistory(days = 30) {
        // Use the existing /api/market/prices endpoint and transform the data
        try {
            const response = await this.request('/api/market/prices');
            if (response.success && response.data && response.data.prices) {
                // Transform current prices into historical data format
                const history = response.data.prices.map(price => ({
                    timestamp: new Date(price.timestamp).getTime(),
                    price: price.pricePerKg
                }));
                return { success: true, history: history };
            }
        } catch (error) {
            console.error('Error fetching price history:', error);
        }
        
        // Fallback to mock data if the API call fails
        return { success: false, history: [] };
    }

    async getMarketConditions() {
        return this.request('/api/market/conditions');
    }

    async validatePrice(coffeeGrade, price) {
        return this.request('/api/market/validate-price', {
            method: 'POST',
            body: { coffeeGrade, price }
        });
    }

    async getMarketAlerts(farmerAddress) {
        return this.request(`/api/market/alerts/${farmerAddress}`);
    }

    async acknowledgeAlert(alertId) {
        return this.request(`/api/market/alerts/${alertId}/acknowledge`, {
            method: 'POST'
        });
    }

    async updateNotificationPreferences(farmerAddress, preferences) {
        return this.request(`/api/market/preferences/${farmerAddress}`, {
            method: 'PUT',
            body: preferences
        });
    }

    async triggerPriceUpdate() {
        return this.request('/api/market/update-prices', {
            method: 'POST'
        });
    }

    async getMarketOverview() {
        return this.request('/api/market/overview');
    }

    // Health check
    async healthCheck() {
        return this.request('/api/health');
    }

    // Grove management methods
    async getGroves(farmerAddress) {
        if (farmerAddress) {
            return this.request(`/api/groves?farmerAddress=${farmerAddress}`);
        }
        return this.request('/api/groves');
    }

    async getAllVerifiedGroves() {
        return this.request('/api/groves?includeAll=true');
    }

    async registerGrove(groveData) {
        // Use the correct endpoint instead of the deprecated one
        return this.request('/api/groves/register', {
            method: 'POST',
            body: groveData
        });
    }

    async updateTreeHealth(groveId, healthData) {
        try {
            const body = {
                groveId,
                healthData
            };

            const resp = await this.request('/api/tree-monitoring/sensor-data', {
                method: 'POST',
                body
            });

            return resp;
        } catch (err) {
            console.error('Failed to update tree health:', err);
            return { success: false, error: err?.message || String(err) };
        }
    }

    async getAvailableGroves() {
        return this.request('/api/investment/available-groves');
    }

    async purchaseTokens(groveId, tokenAmount, investorAddress) {
        return this.request('/api/investment/purchase-tokens', {
            method: 'POST',
            body: { groveId, tokenAmount, investorAddress }
        });
    }

    async getPortfolio(investorAddress) {
        return this.request(`/api/investment/portfolio?investorAddress=${investorAddress}`);
    }

    // Marketplace API methods
    async getMarketplaceListings() {
        return this.request('/api/marketplace/listings');
    }

    async listTokensForSale(groveId, tokenAmount, pricePerToken, durationDays, sellerAddress) {
        return this.request('/api/marketplace/list-tokens', {
            method: 'POST',
            body: {
                groveId,
                tokenAmount,
                pricePerToken,
                durationDays,
                sellerAddress
            }
        });
    }

    async purchaseFromMarketplace(listingId, tokenAmount, buyerAddress) {
        return this.request('/api/marketplace/purchase', {
            method: 'POST',
            body: {
                listingId,
                tokenAmount,
                buyerAddress
            }
        });
    }

    async cancelListing(listingId, sellerAddress) {
        return this.request('/api/marketplace/cancel-listing', {
            method: 'POST',
            body: {
                listingId,
                sellerAddress
            }
        });
    }

    async updateListing(listingId, newPrice, newDuration, sellerAddress) {
        return this.request('/api/marketplace/update-listing', {
            method: 'POST',
            body: {
                listingId,
                newPrice,
                newDuration,
                sellerAddress
            }
        });
    }

    async getTradeHistory(userAddress = null) {
        const endpoint = userAddress 
            ? `/api/marketplace/trades?userAddress=${userAddress}`
            : '/api/marketplace/trades';
        return this.request(endpoint);
    }

    async getMarketplaceStats() {
        return this.request('/api/marketplace/stats');
    }

    async getUserListings(sellerAddress) {
        return this.request(`/api/marketplace/user-listings?sellerAddress=${sellerAddress}`);
    }

    // Revenue Distribution API
    async createDistribution(harvestId, totalRevenue) {
        return this.request('/api/revenue/create-distribution', {
            method: 'POST',
            body: { harvestId, totalRevenue }
        });
    }

    async getDistributionHistory(holderAddress) {
        return this.request(`/api/revenue/distribution-history?holderAddress=${holderAddress}`);
    }

    async getPendingDistributions(holderAddress) {
        return this.request(`/api/revenue/pending-distributions?holderAddress=${holderAddress}`);
    }

    async claimEarnings(distributionId, holderAddress) {
        return this.request('/api/revenue/claim-earnings', {
            method: 'POST',
            body: { distributionId, holderAddress }
        });
    }

    async getFarmerBalance(farmerAddress) {
        return this.request(`/api/revenue/farmer-balance?farmerAddress=${farmerAddress}`);
    }

    async withdrawFarmerShare(groveId, amount, farmerAddress) {
        return this.request('/api/revenue/withdraw-farmer-share', {
            method: 'POST',
            body: { groveId, amount, farmerAddress }
        });
    }

    async getFarmerWithdrawalHistory(farmerAddress) {
        return this.request(`/api/revenue/withdrawal-history?farmerAddress=${farmerAddress}`);
    }

    // USDC API methods
    async requestUSDCAirdrop(amount, accountId) {
        return this.request('/api/usdc/airdrop', {
            method: 'POST',
            body: { amount, accountId }
        });
    }

    async getUSDCTokenAddress() {
        return this.request('/api/usdc/token-address');
    }

    // Platform Control API methods
    async getPlatformStatus() {
        return this.request('/api/platform/status');
    }

    async pauseTrading() {
        return this.request('/api/platform/pause-trading', {
            method: 'POST'
        });
    }

    async resumeTrading() {
        return this.request('/api/platform/resume-trading', {
            method: 'POST'
        });
    }

    async pauseGroveRegistration() {
        return this.request('/api/platform/pause-registration', {
            method: 'POST'
        });
    }

    async resumeGroveRegistration() {
        return this.request('/api/platform/resume-registration', {
            method: 'POST'
        });
    }

    async emergencyShutdown() {
        return this.request('/api/platform/emergency-shutdown', {
            method: 'POST'
        });
    }

    async emergencyResume() {
        return this.request('/api/platform/emergency-resume', {
            method: 'POST'
        });
    }

    // User settings (per-account key/value store)
    
    /**
     * Get user settings for a specific account
     * @param {string} accountId - Hedera account ID (e.g., "0.0.123456")
     * @returns {Promise<Object>} User settings object
     */
    async getUserSettings(accountId) {
        return this.requestWithRetry(`/api/user/settings/${accountId}`, {
            method: 'GET'
        }, 3);
    }

    /**
     * Update user settings for a specific account
     * @param {string} accountId - Hedera account ID (e.g., "0.0.123456")
     * @param {Object} settings - Settings object to update
     * @returns {Promise<Object>} Updated settings object
     */
    async updateUserSettings(accountId, settings) {
        return this.requestWithRetry(`/api/user/settings/${accountId}`, {
            method: 'PUT',
            body: settings
        }, 3);
    }

    /**
     * Legacy method - kept for backward compatibility
     * @deprecated Use updateUserSettings instead
     */
    async saveUserSettings(accountId, settings) {
        return this.updateUserSettings(accountId, settings);
    }

    /**
     * Make an API request with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
     * @returns {Promise<Object>} Response data
     */
    async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx) except for 429 (rate limit)
                if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                    throw this.createUserFriendlyError(error, endpoint);
                }
                
                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw this.createUserFriendlyError(error, endpoint);
                }
                
                // Calculate exponential backoff delay: 100ms, 200ms, 400ms, etc.
                const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000);
                console.warn(`Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error.message);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // This should never be reached, but just in case
        throw this.createUserFriendlyError(lastError, endpoint);
    }

    /**
     * Create a user-friendly error message
     * @param {Error} error - Original error
     * @param {string} endpoint - API endpoint that failed
     * @returns {Error} Error with user-friendly message
     */
    createUserFriendlyError(error, endpoint) {
        let message = 'An unexpected error occurred. Please try again.';
        
        // Network errors
        if (error.message.includes('timed out')) {
            message = 'The request took too long. Please check your connection and try again.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            message = 'Unable to connect to the server. Please check your internet connection.';
        }
        // HTTP status errors
        else if (error.status === 400) {
            message = 'Invalid request. Please check your input and try again.';
        } else if (error.status === 401) {
            message = 'Authentication required. Please log in and try again.';
        } else if (error.status === 403) {
            message = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
            message = 'The requested resource was not found.';
        } else if (error.status === 429) {
            message = 'Too many requests. Please wait a moment and try again.';
        } else if (error.status >= 500) {
            message = 'Server error. Please try again later.';
        }
        // Use original error message if it's more specific
        else if (error.message && !error.message.includes('API Error:')) {
            message = error.message;
        }
        
        const userError = new Error(message);
        userError.originalError = error;
        userError.endpoint = endpoint;
        userError.status = error.status;
        
        return userError;
    }

    // Lending Pool API - Liquidity Provision
    async getLendingPools() {
        return this.request('/api/lending/pools');
    }

    async getLiquidityPositions(userAddress) {
        return this.request(`/api/lending/liquidity-positions/${userAddress}`);
    }

    async provideLiquidity(assetAddress, amount) {
        const providerAddress = window.walletManager?.getAccountId();
        if (!providerAddress) {
            throw new Error('Wallet not connected');
        }
        return this.request('/api/lending/provide-liquidity', {
            method: 'POST',
            body: { assetAddress, amount, providerAddress }
        });
    }

    async withdrawLiquidity(assetAddress, lpTokenAmount) {
        const providerAddress = window.walletManager?.getAccountId();
        if (!providerAddress) {
            throw new Error('Wallet not connected');
        }
        return this.request('/api/lending/withdraw-liquidity', {
            method: 'POST',
            body: { assetAddress, lpTokenAmount, providerAddress }
        });
    }

    async getPoolStatistics(assetAddress) {
        return this.request(`/api/lending/pool-stats?assetAddress=${assetAddress}`);
    }

    // Lending Pool API - Loan Management
    async calculateLoanTerms(assetAddress, loanAmount) {
        return this.request('/api/lending/calculate-loan-terms', {
            method: 'POST',
            body: { assetAddress, loanAmount }
        });
    }

    async takeOutLoan(assetAddress, loanAmount) {
        const borrowerAddress = window.walletManager?.getAccountId();
        if (!borrowerAddress) {
            throw new Error('Wallet not connected');
        }
        return this.request('/api/lending/take-loan', {
            method: 'POST',
            body: { assetAddress, loanAmount, borrowerAddress }
        });
    }

    async repayLoan(assetAddress) {
        const borrowerAddress = window.walletManager?.getAccountId();
        if (!borrowerAddress) {
            throw new Error('Wallet not connected');
        }
        return this.request('/api/lending/repay-loan', {
            method: 'POST',
            body: { assetAddress, borrowerAddress }
        });
    }

    async getLoanDetails(borrowerAddress, assetAddress) {
        return this.request(`/api/lending/loan-details?borrowerAddress=${borrowerAddress}&assetAddress=${assetAddress}`);
    }

    // Price Oracle API - Price Fetching
    async getCoffeePrices(variety, grade) {
        const params = new URLSearchParams();
        if (variety) params.append('variety', variety);
        if (grade !== undefined) params.append('grade', grade);
        return this.request(`/api/pricing/coffee-prices?${params.toString()}`);
    }

    async getPriceHistory(variety, days) {
        // Use the existing /api/market/prices endpoint and transform the data
        try {
            const response = await this.request('/api/market/prices');
            if (response.success && response.data && response.data.prices) {
                // Transform current prices into historical data format
                const history = response.data.prices.map(price => ({
                    timestamp: new Date(price.timestamp).getTime(),
                    price: price.pricePerKg
                }));
                return { success: true, history: history };
            }
        } catch (error) {
            console.error('Error fetching price history:', error);
        }
        
        // Fallback to mock data if the API call fails
        return { success: false, history: [] };
    }

    async getSeasonalPrice(variety, grade, month) {
        return this.request('/api/pricing/seasonal-price', {
            method: 'POST',
            body: { variety, grade, month }
        });
    }

    async getAllVarietyPrices() {
        return this.request('/api/pricing/all-varieties');
    }

    async getSeasonalMultipliers() {
        return this.request('/api/pricing/seasonal-multipliers');
    }

    // Price Oracle API - Price Calculations
    async calculateProjectedRevenue(groveTokenAddress, variety, grade, yieldKg, harvestMonth) {
        return this.request('/api/pricing/projected-revenue', {
            method: 'POST',
            body: { groveTokenAddress, variety, grade, expectedYieldKg: yieldKg, harvestMonth }
        });
    }

    async validateSalePrice(variety, grade, proposedPrice) {
        return this.request('/api/pricing/validate-price', {
            method: 'POST',
            body: { variety, grade, proposedPrice }
        });
    }

    // Token Management API - Token Operations
    async mintTokens(groveId, amount) {
        return this.request('/api/admin/mint-tokens', {
            method: 'POST',
            body: { groveId, amount }
        });
    }

    async burnTokens(groveId, amount) {
        return this.request('/api/admin/burn-tokens', {
            method: 'POST',
            body: { groveId, amount }
        });
    }

    async getTokenSupply(groveId) {
        return this.request(`/api/admin/token-supply?groveId=${groveId}`);
    }

    // Token Management API - KYC Management
    async grantKYC(groveId, accountAddress) {
        return this.request('/api/admin/grant-kyc', {
            method: 'POST',
            body: { groveId, accountAddress }
        });
    }

    async revokeKYC(groveId, accountAddress) {
        return this.request('/api/admin/revoke-kyc', {
            method: 'POST',
            body: { groveId, accountAddress }
        });
    }

    async checkKYCStatus(groveId, accountAddress) {
        return this.request(`/api/admin/kyc-status?groveId=${groveId}&accountAddress=${accountAddress}`);
    }

    // Token Management API - Token Holder Management
    async getTokenHolders(groveId) {
        return this.request(`/api/admin/token-holders?groveId=${groveId}`);
    }

    async getHolderBalance(groveId, holderAddress) {
        return this.request(`/api/admin/holder-balance?groveId=${groveId}&holderAddress=${holderAddress}`);
    }

    // Balance Polling API - Additional methods for real-time updates
    async getTokenBalance(groveId, accountId) {
        return this.request(`/api/balance/token?groveId=${groveId}&accountId=${accountId}`);
    }

    async getUSDCBalance(accountId) {
        return this.request(`/api/balance/usdc?accountId=${accountId}`);
    }

    async getLPTokenBalances(accountId) {
        return this.request(`/api/balance/lp-tokens?accountId=${accountId}`);
    }

    // Transaction History API
    // Transaction History API
    async getTransactionHistory(userAddress, options = {}) {
        const params = new URLSearchParams({
            userAddress,
            ...options
        });
        return this.request(`/api/transactions/history?${params.toString()}`);
    }

    async saveTransaction(transactionData) {
        return this.request('/api/transactions/save', {
            method: 'POST',
            body: transactionData
        });
    }

    async updateTransaction(transactionId, updates) {
        return this.request('/api/transactions/update', {
            method: 'PUT',
            body: {
                transactionId,
                updates
            }
        });
    }

    async getTransactionById(transactionId) {
        return this.request(`/api/transactions/${transactionId}`);
    }

    // Earnings & Distribution API - New endpoints for automated distribution system
    
    /**
     * Get farmer balance for a specific grove
     * @param {string} farmerAddress - Farmer's wallet address
     * @param {number} groveId - Grove ID
     * @returns {Promise<Object>} Grove balance with 4 metrics
     */
    async getFarmerGroveBalance(farmerAddress, groveId) {
        return this.request(`/api/farmer/balance/${farmerAddress}/grove/${groveId}`);
    }

    /**
     * Get all grove balances for a farmer
     * @param {string} farmerAddress - Farmer's wallet address
     * @returns {Promise<Object>} All grove balances
     */
    async getAllFarmerGroveBalances(farmerAddress) {
        return this.request(`/api/farmer/balance/${farmerAddress}`);
    }

    /**
     * Process farmer withdrawal for a specific grove
     * @param {string} farmerAddress - Farmer's wallet address
     * @param {number} groveId - Grove ID
     * @param {number} amount - Amount to withdraw
     * @returns {Promise<Object>} Withdrawal result
     */
    async processFarmerWithdrawal(farmerAddress, groveId, amount) {
        return this.request('/api/farmer/withdraw', {
            method: 'POST',
            body: { farmerAddress, groveId, amount }
        });
    }

    /**
     * Get investor balance summary
     * @param {string} investorAddress - Investor's wallet address
     * @returns {Promise<Object>} Balance summary with unclaimed breakdown
     */
    async getInvestorBalance(investorAddress) {
        return this.request(`/api/investor/balance/${investorAddress}`);
    }

    /**
     * Get investor's unclaimed earnings breakdown
     * @param {string} investorAddress - Investor's wallet address
     * @returns {Promise<Object>} Unclaimed earnings by type
     */
    async getInvestorUnclaimedEarnings(investorAddress) {
        return this.request(`/api/investor/earnings/unclaimed/${investorAddress}`);
    }

    /**
     * Process investor claim
     * @param {string} investorAddress - Investor's wallet address
     * @param {number[]} earningIds - Array of earning IDs to claim
     * @param {number} amount - Amount to claim
     * @returns {Promise<Object>} Claim result
     */
    async processInvestorClaim(investorAddress, earningIds, amount) {
        return this.request('/api/investor/claim', {
            method: 'POST',
            body: { investorAddress, earningIds, amount }
        });
    }

    /**
     * Get investor's claim history
     * @param {string} investorAddress - Investor's wallet address
     * @param {number} limit - Number of records to return
     * @returns {Promise<Object>} Claim history
     */
    async getInvestorClaimHistory(investorAddress, limit = 50) {
        return this.request(`/api/investor/claims/${investorAddress}?limit=${limit}`);
    }
}

// Create global API instance
window.coffeeAPI = new CoffeeTreeAPI();