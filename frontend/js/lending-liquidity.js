/**
 * Lending & Liquidity Module
 * Handles lending pool operations and loan management for the Coffee Tree Platform
 */

/**
 * Custom error class for loan-related errors
 */
class LoanError extends Error {
    constructor(message, loanId = null, errorCode = null) {
        super(message);
        this.name = 'LoanError';
        this.loanId = loanId;
        this.errorCode = errorCode;
    }
}

/**
 * LendingPoolManager
 * Manages lending pool and loan operations for the Coffee Tree Platform
 */
class LendingPoolManager {
    /**
     * Initialize the Lending Pool Manager
     * @param {CoffeeTreeAPI} apiClient - API client instance for backend communication
     * @param {Object} walletManager - Wallet manager instance for transaction signing
     */
    constructor(apiClient, walletManager = null) {
        if (!apiClient) {
            throw new Error('API client is required for LendingPoolManager');
        }
        
        this.apiClient = apiClient;
        this.walletManager = walletManager;
        
        // Cache for lending pool data
        this.poolCache = new Map();
        this.loanCache = new Map();
        this.poolCacheTimeout = 120000; // 2 minutes cache for pool stats
        this.loanCacheTimeout = 30000; // 30 seconds cache for loan data
        
        // Constants for loan calculations
        this.COLLATERALIZATION_RATIO = 1.25; // 125% collateral required
        this.LIQUIDATION_THRESHOLD = 0.90; // 90% of collateral value
        this.REPAYMENT_MULTIPLIER = 1.10; // 110% repayment amount
        
        // Initialize state
        this.initialized = true;
        
        console.log('LendingPoolManager initialized');
    }

    /**
     * Validate that the manager is properly initialized
     * @private
     */
    _validateInitialization() {
        if (!this.initialized) {
            throw new Error('LendingPoolManager not properly initialized');
        }
    }

    /**
     * Get cached data or fetch new data
     * @private
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @param {number} timeout - Cache timeout in milliseconds
     * @returns {Promise<any>} Cached or fresh data
     */
    async _getCachedOrFetch(key, fetchFn, timeout) {
        const cached = this.poolCache.get(key) || this.loanCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < timeout) {
            return cached.data;
        }
        
        const data = await fetchFn();
        
        // Store in appropriate cache based on timeout
        if (timeout === this.poolCacheTimeout) {
            this.poolCache.set(key, {
                data,
                timestamp: now
            });
        } else {
            this.loanCache.set(key, {
                data,
                timestamp: now
            });
        }
        
        return data;
    }

    /**
     * Clear cache for a specific key or all cache
     * @param {string} key - Optional cache key to clear
     * @param {string} cacheType - Type of cache to clear ('pool', 'loan', or 'all')
     */
    clearCache(key = null, cacheType = 'all') {
        if (key) {
            if (cacheType === 'pool' || cacheType === 'all') {
                this.poolCache.delete(key);
            }
            if (cacheType === 'loan' || cacheType === 'all') {
                this.loanCache.delete(key);
            }
        } else {
            if (cacheType === 'pool' || cacheType === 'all') {
                this.poolCache.clear();
            }
            if (cacheType === 'loan' || cacheType === 'all') {
                this.loanCache.clear();
            }
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

    /**
     * Validate amount is positive and valid
     * @private
     * @param {number} amount - Amount to validate
     * @param {string} fieldName - Name of the field for error messages
     * @throws {Error} If amount is invalid
     */
    _validateAmount(amount, fieldName = 'Amount') {
        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error(`${fieldName} must be a valid number`);
        }
        
        if (amount < 0) {
            throw new Error(`${fieldName} cannot be negative`);
        }
        
        if (amount === 0) {
            throw new Error(`${fieldName} must be greater than zero`);
        }
    }

    /**
     * Validate Hedera account ID format
     * @private
     * @param {string} accountId - Account ID to validate
     * @param {string} fieldName - Name of the field for error messages
     * @throws {Error} If account ID is invalid
     */
    _validateAccountId(accountId, fieldName = 'Account ID') {
        if (!accountId || typeof accountId !== 'string') {
            throw new Error(`${fieldName} is required and must be a string`);
        }
        
        // Basic validation for Hedera account ID format (0.0.xxxxx)
        const accountIdPattern = /^0\.0\.\d+$/;
        if (!accountIdPattern.test(accountId)) {
            throw new Error(`${fieldName} must be a valid Hedera account ID (e.g., 0.0.12345)`);
        }
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

    /**
     * Calculate LP tokens to mint when providing liquidity
     * @private
     * @param {number} usdcAmount - Amount of USDC being provided
     * @param {number} totalLiquidity - Current total liquidity in pool
     * @param {number} totalLPTokens - Current total LP tokens in circulation
     * @returns {number} Amount of LP tokens to mint
     */
    _calculateLPTokensToMint(usdcAmount, totalLiquidity, totalLPTokens) {
        // If pool is empty, mint LP tokens 1:1 with USDC
        if (totalLiquidity === 0 || totalLPTokens === 0) {
            return usdcAmount;
        }
        
        // Calculate LP tokens based on proportional share of pool
        // lpTokens = (usdcAmount / totalLiquidity) * totalLPTokens
        const lpTokens = (usdcAmount / totalLiquidity) * totalLPTokens;
        
        return lpTokens;
    }

    /**
     * Calculate USDC amount to receive when burning LP tokens
     * @private
     * @param {number} lpTokenAmount - Amount of LP tokens being burned
     * @param {number} totalLiquidity - Current total liquidity in pool
     * @param {number} totalLPTokens - Current total LP tokens in circulation
     * @returns {number} Amount of USDC to receive
     */
    _calculateUSDCFromLPTokens(lpTokenAmount, totalLiquidity, totalLPTokens) {
        // Validate pool has tokens
        if (totalLPTokens === 0) {
            throw new Error('Pool has no LP tokens in circulation');
        }
        
        // Calculate USDC based on proportional share of pool
        // usdcAmount = (lpTokenAmount / totalLPTokens) * totalLiquidity
        const usdcAmount = (lpTokenAmount / totalLPTokens) * totalLiquidity;
        
        return usdcAmount;
    }

    /**
     * Calculate pool share percentage
     * @private
     * @param {number} userLPTokens - User's LP token balance
     * @param {number} totalLPTokens - Total LP tokens in circulation
     * @returns {number} Pool share as percentage (0-100)
     */
    _calculatePoolShare(userLPTokens, totalLPTokens) {
        if (totalLPTokens === 0) {
            return 0;
        }
        
        return (userLPTokens / totalLPTokens) * 100;
    }

    // ========================================================================
    // Pool Operations
    // ========================================================================

    /**
     * Provide liquidity to a lending pool
     * @param {string} assetAddress - Asset contract address
     * @param {number} amount - Amount of USDC to provide
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Result with LP token amount and transaction hash
     */
    async provideLiquidity(assetAddress, amount, loadingManager = null) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(amount, 'Liquidity amount');
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('provide-liquidity', 'Providing liquidity...') : null;
        
        try {
            // Get current pool statistics to calculate LP token amount
            const poolStats = await this.apiClient.getPoolStatistics(assetAddress);
            
            if (!poolStats) {
                throw new Error('Unable to fetch pool statistics');
            }
            
            // Calculate LP token amount based on pool share
            const lpTokenAmount = this._calculateLPTokensToMint(
                amount,
                poolStats.totalLiquidity || 0,
                poolStats.totalLPTokens || 0
            );
            
            // Call API to provide liquidity
            const result = await this.apiClient.provideLiquidity(assetAddress, amount);
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Failed to provide liquidity');
            }
            
            // Clear cache to force refresh on next fetch
            this.clearCache(`pool_${assetAddress}`, 'pool');
            this.clearCache('all_pools', 'pool');
            
            return {
                success: true,
                lpTokenAmount: lpTokenAmount,
                transactionHash: result.transactionHash,
                poolShare: this._calculatePoolShare(
                    lpTokenAmount,
                    (poolStats.totalLPTokens || 0) + lpTokenAmount
                ),
                message: `Successfully provided ${amount} USDC liquidity`
            };
            
        } catch (error) {
            console.error('Error providing liquidity:', error);
            throw new Error(`Failed to provide liquidity: ${error.message}`);
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Withdraw liquidity from a lending pool
     * @param {string} assetAddress - Asset contract address
     * @param {number} lpTokenAmount - Amount of LP tokens to burn
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Result with USDC amount and transaction hash
     */
    async withdrawLiquidity(assetAddress, lpTokenAmount, loadingManager = null) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(lpTokenAmount, 'LP token amount');
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('withdraw-liquidity', 'Withdrawing liquidity...') : null;
        
        try {
            // Get current pool statistics to calculate USDC amount
            const poolStats = await this.apiClient.getPoolStatistics(assetAddress);
            
            if (!poolStats) {
                throw new Error('Unable to fetch pool statistics');
            }
            
            // Validate user has sufficient LP tokens
            if (poolStats.userLPBalance && lpTokenAmount > poolStats.userLPBalance) {
                throw new Error(
                    `Insufficient LP tokens. Available: ${poolStats.userLPBalance}, Requested: ${lpTokenAmount}`
                );
            }
            
            // Calculate USDC amount to receive based on pool share
            const usdcAmount = this._calculateUSDCFromLPTokens(
                lpTokenAmount,
                poolStats.totalLiquidity || 0,
                poolStats.totalLPTokens || 0
            );
            
            // Validate pool has sufficient available liquidity
            if (poolStats.availableLiquidity && usdcAmount > poolStats.availableLiquidity) {
                throw new Error(
                    `Insufficient pool liquidity. Available: ${poolStats.availableLiquidity}, Requested: ${usdcAmount}`
                );
            }
            
            // Call API to withdraw liquidity
            const result = await this.apiClient.withdrawLiquidity(assetAddress, lpTokenAmount);
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Failed to withdraw liquidity');
            }
            
            // Clear cache to force refresh on next fetch
            this.clearCache(`pool_${assetAddress}`, 'pool');
            this.clearCache('all_pools', 'pool');
            
            return {
                success: true,
                usdcAmount: usdcAmount,
                lpTokensBurned: lpTokenAmount,
                transactionHash: result.transactionHash,
                rewards: result.rewards || 0,
                message: `Successfully withdrew ${usdcAmount} USDC from pool`
            };
            
        } catch (error) {
            console.error('Error withdrawing liquidity:', error);
            throw new Error(`Failed to withdraw liquidity: ${error.message}`);
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Get all available lending pools
     * @returns {Promise<Array>} Array of lending pool objects
     */
    async getLendingPools() {
        this._validateInitialization();
        
        // Implementation will be added in Task 8.1
        throw new Error('getLendingPools not yet implemented');
    }

    /**
     * Get statistics for a specific lending pool
     * @param {string} assetAddress - Asset contract address
     * @returns {Promise<Object>} Pool statistics object
     */
    async getPoolStatistics(assetAddress) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        
        // Implementation will be added in Task 8.1
        throw new Error('getPoolStatistics not yet implemented');
    }

    // ========================================================================
    // Loan Operations (To be implemented in Task 9.2)
    // ========================================================================

    /**
     * Calculate collateral required for a loan amount
     * @param {number} loanAmount - Desired loan amount in USDC
     * @param {number} assetPrice - Current price of collateral asset
     * @returns {number} Required collateral amount
     */
    calculateCollateralRequired(loanAmount, assetPrice) {
        this._validateAmount(loanAmount, 'Loan amount');
        this._validateAmount(assetPrice, 'Asset price');
        
        // Calculate collateral required at 125% collateralization ratio
        // collateral = (loanAmount * COLLATERALIZATION_RATIO) / assetPrice
        const collateralValue = loanAmount * this.COLLATERALIZATION_RATIO;
        const collateralAmount = collateralValue / assetPrice;
        
        return collateralAmount;
    }

    /**
     * Calculate liquidation price for a loan
     * @param {number} collateralAmount - Amount of collateral locked
     * @param {number} loanAmount - Loan amount in USDC
     * @returns {number} Liquidation price threshold
     */
    calculateLiquidationPrice(collateralAmount, loanAmount) {
        this._validateAmount(collateralAmount, 'Collateral amount');
        this._validateAmount(loanAmount, 'Loan amount');
        
        // Calculate liquidation price at 90% threshold
        // liquidationPrice = loanAmount / (collateralAmount * LIQUIDATION_THRESHOLD)
        const liquidationPrice = loanAmount / (collateralAmount * this.LIQUIDATION_THRESHOLD);
        
        return liquidationPrice;
    }

    /**
     * Calculate repayment amount for a loan
     * @param {number} loanAmount - Original loan amount in USDC
     * @returns {number} Total repayment amount (110% of loan)
     */
    calculateRepaymentAmount(loanAmount) {
        this._validateAmount(loanAmount, 'Loan amount');
        
        // Calculate repayment amount at 110% of original loan
        const repaymentAmount = loanAmount * this.REPAYMENT_MULTIPLIER;
        
        return repaymentAmount;
    }

    /**
     * Check loan health factor
     * @param {Object} loanDetails - Loan details object
     * @param {number} currentPrice - Current price of collateral asset
     * @returns {number} Health factor (>1 is healthy, <1 is at risk)
     */
    checkLoanHealth(loanDetails, currentPrice) {
        if (!loanDetails) {
            throw new Error('Loan details are required');
        }
        this._validateAmount(currentPrice, 'Current price');
        
        // Validate loan details structure
        if (!loanDetails.collateralAmount || !loanDetails.loanAmountUSDC) {
            throw new Error('Loan details must include collateralAmount and loanAmountUSDC');
        }
        
        const collateralAmount = loanDetails.collateralAmount;
        const loanAmount = loanDetails.loanAmountUSDC;
        
        // Calculate current collateral value
        const collateralValue = collateralAmount * currentPrice;
        
        // Calculate health factor
        // healthFactor = (collateralValue * LIQUIDATION_THRESHOLD) / loanAmount
        // If healthFactor > 1, loan is healthy
        // If healthFactor < 1, loan is at risk of liquidation
        const healthFactor = (collateralValue * this.LIQUIDATION_THRESHOLD) / loanAmount;
        
        return healthFactor;
    }

    /**
     * Calculate loan terms for a given amount
     * @param {string} assetAddress - Asset contract address
     * @param {number} loanAmount - Desired loan amount in USDC
     * @returns {Promise<Object>} Loan terms including collateral, liquidation price, repayment
     */
    async calculateLoanTerms(assetAddress, loanAmount) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(loanAmount, 'Loan amount');
        
        // Implementation will be added in Task 8.2
        throw new Error('calculateLoanTerms not yet implemented');
    }

    /**
     * Take out a loan against collateral
     * @param {string} assetAddress - Asset contract address
     * @param {number} loanAmount - Desired loan amount in USDC
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Loan details and transaction hash
     */
    async takeOutLoan(assetAddress, loanAmount, loadingManager = null) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(loanAmount, 'Loan amount');
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('take-loan', 'Processing loan...') : null;
        
        try {
            // Implementation will be added in Task 8.2
            throw new Error('takeOutLoan not yet implemented');
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Repay an outstanding loan
     * @param {string} assetAddress - Asset contract address
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Repayment result and transaction hash
     */
    async repayLoan(assetAddress, loadingManager = null) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('repay-loan', 'Repaying loan...') : null;
        
        try {
            // Implementation will be added in Task 8.2
            throw new Error('repayLoan not yet implemented');
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Get loan details for a borrower
     * @param {string} borrowerAddress - Borrower's wallet address
     * @param {string} assetAddress - Asset contract address
     * @returns {Promise<Object>} Loan details object
     */
    async getLoanDetails(borrowerAddress, assetAddress) {
        this._validateInitialization();
        this._validateAccountId(borrowerAddress, 'Borrower address');
        this._validateAccountId(assetAddress, 'Asset address');
        
        // Implementation will be added in Task 8.2
        throw new Error('getLoanDetails not yet implemented');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LendingPoolManager,
        LoanError
    };
}
