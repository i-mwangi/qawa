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
            throw new Error('Unable to initialize lending pool. API client is missing.');
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
            throw new Error('Lending pool is not ready yet. Please refresh the page and try again.');
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
            throw new Error('Please connect your wallet to continue');
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
            throw new Error('The liquidity pool is empty. No LP tokens are in circulation yet.');
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
                throw new Error('Unable to load pool information. Please try again.');
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
                const friendlyError = window.translateError ? window.translateError(result?.error || 'Failed to provide liquidity') : (result?.error || 'Failed to provide liquidity');
                throw new Error(friendlyError);
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
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
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
                throw new Error('Unable to load pool information. Please try again.');
            }

            // Validate user has sufficient LP tokens
            if (poolStats.userLPBalance && lpTokenAmount > poolStats.userLPBalance) {
                throw new Error(
                    `You don't have enough LP tokens. You have ${poolStats.userLPBalance} LP tokens but tried to withdraw ${lpTokenAmount}.`
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
                    `The pool doesn't have enough liquidity available. Pool has $${poolStats.availableLiquidity} but you're trying to withdraw $${usdcAmount}.`
                );
            }

            // Call API to withdraw liquidity
            const result = await this.apiClient.withdrawLiquidity(assetAddress, lpTokenAmount);

            if (!result || !result.success) {
                const friendlyError = window.translateError ? window.translateError(result?.error || 'Failed to withdraw liquidity') : (result?.error || 'Failed to withdraw liquidity');
                throw new Error(friendlyError);
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
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
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
            throw new Error('Unable to check loan health. Loan information is missing.');
        }
        this._validateAmount(currentPrice, 'Current price');

        // Validate loan details structure
        if (!loanDetails.collateralAmount || !loanDetails.loanAmountUSDC) {
            throw new Error('Unable to check loan health. Loan information is incomplete.');
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
     * @param {string} collateralTokenId - Optional collateral token ID
     * @param {number} collateralAmount - Optional collateral amount
     * @returns {Promise<Object>} Loan terms including collateral, liquidation price, repayment
     */
    async calculateLoanTerms(assetAddress, loanAmount, collateralTokenId = null, collateralAmount = null) {
        this._validateInitialization();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(loanAmount, 'Loan amount');

        try {
            const result = await this.apiClient.calculateLoanTerms(
                assetAddress,
                loanAmount,
                collateralTokenId,
                collateralAmount
            );

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to calculate loan terms') : 
                    (result?.error || 'Failed to calculate loan terms');
                throw new Error(friendlyError);
            }

            return {
                success: true,
                ...result.data
            };

        } catch (error) {
            console.error('Error calculating loan terms:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        }
    }

    /**
     * Take out a loan against collateral
     * @param {string} assetAddress - Asset contract address
     * @param {number} loanAmount - Desired loan amount in USDC
     * @param {string} collateralTokenId - Collateral token ID
     * @param {number} collateralAmount - Amount of collateral to lock
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Loan details and transaction hash
     */
    async takeOutLoan(assetAddress, loanAmount, collateralTokenId, collateralAmount, loadingManager = null) {
        this._validateInitialization();
        this._validateWalletConnection();
        this._validateAccountId(assetAddress, 'Asset address');
        this._validateAmount(loanAmount, 'Loan amount');
        this._validateAmount(collateralAmount, 'Collateral amount');

        // Show loading spinner
        const loadingId = loadingManager ?
            loadingManager.showLoading('take-loan', 'Processing loan...') : null;

        try {
            const borrowerAddress = this.walletManager.getConnectedAccount();
            
            const result = await this.apiClient.takeOutLoan(
                assetAddress,
                loanAmount,
                borrowerAddress,
                collateralTokenId,
                collateralAmount
            );

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to originate loan') : 
                    (result?.error || 'Failed to originate loan');
                throw new Error(friendlyError);
            }

            // Clear cache to force refresh
            this.clearCache(null, 'all');

            return {
                success: true,
                loanId: result.data.loanId,
                transactionHash: result.data.transactionHash,
                blockExplorerUrl: result.data.blockExplorerUrl,
                repaymentAmount: result.data.repaymentAmount,
                dueDate: result.data.dueDate,
                healthFactor: result.data.healthFactor,
                message: `Successfully borrowed ${loanAmount} USDC`
            };

        } catch (error) {
            console.error('Error taking out loan:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Repay an outstanding loan
     * @param {string} loanId - Loan ID to repay
     * @param {number} paymentAmount - Optional payment amount (defaults to full repayment)
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Repayment result and transaction hash
     */
    async repayLoan(loanId, paymentAmount = null, loadingManager = null) {
        this._validateInitialization();
        this._validateWalletConnection();

        // Show loading spinner
        const loadingId = loadingManager ?
            loadingManager.showLoading('repay-loan', 'Repaying loan...') : null;

        try {
            const borrowerAddress = this.walletManager.getConnectedAccount();
            
            const result = await this.apiClient.repayLoan(
                loanId,
                borrowerAddress,
                paymentAmount
            );

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to repay loan') : 
                    (result?.error || 'Failed to repay loan');
                throw new Error(friendlyError);
            }

            // Clear cache to force refresh
            this.clearCache(null, 'all');

            return {
                success: true,
                loanId: result.data.loanId,
                paymentAmount: result.data.paymentAmount,
                collateralReturned: result.data.collateralReturned,
                transactionHash: result.data.transactionHash,
                blockExplorerUrl: result.data.blockExplorerUrl,
                status: result.data.status,
                message: `Successfully repaid loan`
            };

        } catch (error) {
            console.error('Error repaying loan:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Get loan details by loan ID
     * @param {string} loanId - Loan ID
     * @returns {Promise<Object>} Loan details object
     */
    async getLoanDetails(loanId) {
        this._validateInitialization();

        try {
            const result = await this.apiClient.getLoanDetails(loanId);

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to get loan details') : 
                    (result?.error || 'Failed to get loan details');
                throw new Error(friendlyError);
            }

            return {
                success: true,
                loan: result.loan
            };

        } catch (error) {
            console.error('Error getting loan details:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        }
    }

    /**
     * Get all loans for a borrower
     * @param {string} borrowerAddress - Borrower's wallet address
     * @returns {Promise<Array>} Array of loan objects
     */
    async getBorrowerLoans(borrowerAddress) {
        this._validateInitialization();
        this._validateAccountId(borrowerAddress, 'Borrower address');

        try {
            const result = await this.apiClient.getBorrowerLoans(borrowerAddress);

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to get borrower loans') : 
                    (result?.error || 'Failed to get borrower loans');
                throw new Error(friendlyError);
            }

            return {
                success: true,
                loans: result.loans || [],
                count: result.count || 0
            };

        } catch (error) {
            console.error('Error getting borrower loans:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        }
    }

    /**
     * Get loans at risk of liquidation
     * @returns {Promise<Array>} Array of at-risk loan objects
     */
    async getLoansAtRisk() {
        this._validateInitialization();

        try {
            const result = await this.apiClient.getLoansAtRisk();

            if (!result || !result.success) {
                const friendlyError = window.translateError ? 
                    window.translateError(result?.error || 'Failed to get at-risk loans') : 
                    (result?.error || 'Failed to get at-risk loans');
                throw new Error(friendlyError);
            }

            return {
                success: true,
                loans: result.loans || [],
                count: result.count || 0
            };

        } catch (error) {
            console.error('Error getting at-risk loans:', error);
            const friendlyError = window.translateError ? window.translateError(error) : error.message;
            throw new Error(friendlyError);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LendingPoolManager,
        LoanError
    };
}

// ========================================================================
// Credit Score Integration for Lending Section
// ========================================================================

/**
 * Fetch credit score from API
 */
async function fetchCreditScore(accountId) {
    try {
        const response = await fetch(`/api/credit-score/${accountId}`);
        if (!response.ok) {
            if (response.status === 404) {
                return null; // No credit history
            }
            throw new Error('Unable to load your credit score. Please try again.');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching credit score:', error);
        throw error;
    }
}

/**
 * Render credit score card
 */
function renderCreditScoreCard(scoreData) {
    const { currentScore, tier, maxLoanAmount, totalLoans, earlyPayments, onTimePayments, latePayments } = scoreData;

    // Determine color based on tier
    const tierColors = {
        excellent: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e', icon: '🟢' },
        good: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6', icon: '🔵' },
        fair: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308', icon: '🟡' },
        poor: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', icon: '🔴' }
    };

    const colors = tierColors[tier] || tierColors.fair;
    const progress = Math.min((currentScore / 850) * 100, 100);

    return `
        <div style="background: var(--bg-glass, rgba(60, 45, 38, 0.5)); backdrop-filter: blur(5px); border: 1px solid var(--border-glass, rgba(199, 172, 149, 0.2)); border-radius: 12px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div>
                    <div style="font-size: 0.875rem; color: var(--text-dark, #B0A090); margin-bottom: 4px;">Your Credit Score</div>
                    <div style="font-size: 2.5rem; font-weight: 700; color: ${colors.text};">${currentScore}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; margin-bottom: 4px;">${colors.icon}</div>
                    <div style="font-size: 0.875rem; font-weight: 600; color: ${colors.text}; text-transform: capitalize;">${tier}</div>
                </div>
            </div>
            
            <div style="width: 100%; background: rgba(0, 0, 0, 0.3); border-radius: 9999px; height: 8px; margin-bottom: 16px; overflow: hidden;">
                <div style="height: 100%; background: ${colors.text}; width: ${progress}%; transition: width 0.3s ease;"></div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
                <div style="text-align: center;">
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-light, #F5EFE6);">${totalLoans}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dark, #B0A090);">Total</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.25rem; font-weight: 700; color: #22c55e;">${earlyPayments}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dark, #B0A090);">Early</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.25rem; font-weight: 700; color: #3b82f6;">${onTimePayments}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dark, #B0A090);">On-time</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444;">${latePayments}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dark, #B0A090);">Late</div>
                </div>
            </div>
            
            <div style="background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 8px; padding: 12px;">
                <div style="font-size: 0.875rem; color: var(--text-light, #F5EFE6); font-weight: 600; margin-bottom: 4px;">
                    Max Loan Amount: <span style="color: ${colors.text};">$${maxLoanAmount.toLocaleString()}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-dark, #B0A090);">
                    Based on your ${tier} credit tier
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize credit score display in the lending section
 */
async function initializeCreditScoreInLending() {
    const creditScoreContainer = document.getElementById('creditScoreContainer');
    const refreshButton = document.getElementById('refreshCreditScore');

    if (!creditScoreContainer) {
        console.warn('Credit score container not found in lending section');
        return;
    }

    // Get connected wallet address
    const walletAddress = window.walletManager?.getConnectedAccount?.() ||
        window.accountId ||
        localStorage.getItem('connectedAccount');

    if (!walletAddress) {
        creditScoreContainer.innerHTML = `
            <div style="background: var(--bg-glass, rgba(60, 45, 38, 0.5)); backdrop-filter: blur(5px); border: 1px solid var(--border-glass, rgba(199, 172, 149, 0.2)); border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: var(--text-light, #F5EFE6); margin: 0;">
                    <i class="fas fa-wallet" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                    Connect your wallet to view your credit score
                </p>
            </div>
        `;
        return;
    }

    // Show loading state
    creditScoreContainer.innerHTML = `
        <div style="background: var(--bg-glass, rgba(60, 45, 38, 0.5)); backdrop-filter: blur(5px); border: 1px solid var(--border-glass, rgba(199, 172, 149, 0.2)); border-radius: 12px; padding: 24px; text-align: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-dark, #B0A090);"></i>
            <p style="color: var(--text-light, #F5EFE6); margin-top: 12px;">Loading credit score...</p>
        </div>
    `;

    // Load and display credit score
    try {
        const scoreData = await fetchCreditScore(walletAddress);

        if (!scoreData) {
            // No credit history
            creditScoreContainer.innerHTML = `
                <div style="background: var(--bg-glass, rgba(60, 45, 38, 0.5)); backdrop-filter: blur(5px); border: 1px solid var(--border-glass, rgba(199, 172, 149, 0.2)); border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="color: var(--text-light, #F5EFE6); margin: 0;">
                        <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                        No credit history yet. Take out your first loan to start building your credit score!
                    </p>
                </div>
            `;
        } else {
            // Render credit score card
            creditScoreContainer.innerHTML = renderCreditScoreCard(scoreData);
        }
    } catch (error) {
        console.error('Error loading credit score:', error);
        creditScoreContainer.innerHTML = `
            <div style="background: var(--bg-glass, rgba(60, 45, 38, 0.5)); backdrop-filter: blur(5px); border: 1px solid var(--border-glass, rgba(199, 172, 149, 0.2)); border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: var(--text-light, #F5EFE6); margin: 0;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                    Unable to load credit score. Please try again later.
                </p>
            </div>
        `;
    }

    // Setup refresh button
    if (refreshButton && !refreshButton.dataset.listenerAttached) {
        refreshButton.dataset.listenerAttached = 'true';
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true;
            const originalHTML = refreshButton.innerHTML;
            refreshButton.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';

            try {
                await initializeCreditScoreInLending();
            } catch (error) {
                console.error('Error refreshing credit score:', error);
            } finally {
                refreshButton.disabled = false;
                refreshButton.innerHTML = originalHTML;
            }
        });
    }
}

// Auto-initialize when lending section becomes visible
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Credit score module loaded');

        // Watch for lending section visibility
        const observer = new MutationObserver((mutations) => {
            const lendingSection = document.getElementById('lendingSection');
            if (lendingSection && lendingSection.classList.contains('active')) {
                console.log('Lending section became active, initializing credit score');
                initializeCreditScoreInLending();
            }
        });

        // Start observing
        const investorView = document.getElementById('investorView');
        if (investorView) {
            observer.observe(investorView, {
                attributes: true,
                subtree: true,
                attributeFilter: ['class']
            });
        }

        // Also check if lending section is already active
        setTimeout(() => {
            const lendingSection = document.getElementById('lendingSection');
            if (lendingSection && lendingSection.classList.contains('active')) {
                console.log('Lending section already active, initializing credit score');
                initializeCreditScoreInLending();
            }
        }, 1000);
    });
}

// Export for manual initialization if needed
if (typeof window !== 'undefined') {
    window.initializeCreditScoreInLending = initializeCreditScoreInLending;
}
