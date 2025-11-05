/**
 * Token Management Module
 * Handles token operations and KYC management for platform administrators
 * 
 * Note: This module uses error classes from errors.js:
 * - TokenOperationError
 * - UnauthorizedAccessError
 */

/**
 * TokenAdminManager
 * Manages token operations and KYC management for the Coffee Tree Platform
 * Restricted to admin users only
 */
class TokenAdminManager {
    /**
     * Initialize the Token Admin Manager
     * @param {CoffeeTreeAPI} apiClient - API client instance for backend communication
     * @param {Object} walletManager - Wallet manager instance for transaction signing
     */
    constructor(apiClient, walletManager = null) {
        if (!apiClient) {
            throw new Error('API client is required for TokenAdminManager');
        }
        
        this.apiClient = apiClient;
        this.walletManager = walletManager;
        
        // Admin role state
        this.isAdmin = false;
        this.adminAddress = null;
        this.adminValidated = false;
        
        // Cache for token data
        this.tokenCache = new Map();
        this.cacheTimeout = 120000; // 2 minutes cache for token data
        
        // Initialize state
        this.initialized = true;
        
        console.log('TokenAdminManager initialized');
    }

    /**
     * Validate that the manager is properly initialized
     * @private
     */
    _validateInitialization() {
        if (!this.initialized) {
            throw new Error('TokenAdminManager not properly initialized');
        }
    }

    /**
     * Validate that the current user has admin privileges
     * @private
     * @throws {UnauthorizedAccessError} If user is not an admin
     */
    _validateAdminRole() {
        if (!this.adminValidated || !this.isAdmin) {
            throw new UnauthorizedAccessError(
                'Admin privileges required for this operation',
                'admin'
            );
        }
    }

    /**
     * Validate admin role for the current user
     * This should be called before any admin operations
     * @param {string} userAddress - User's wallet address
     * @returns {Promise<boolean>} True if user is admin, false otherwise
     */
    async validateAdminRole(userAddress) {
        this._validateInitialization();
        
        if (!userAddress) {
            console.warn('No user address provided for admin validation');
            this.isAdmin = false;
            this.adminValidated = true;
            return false;
        }
        
        try {
            // Check if user has admin role
            // This would typically call a backend endpoint to verify admin status
            // For now, we'll implement a basic check
            
            // TODO: Implement actual admin role check via API
            // const response = await this.apiClient.checkAdminRole(userAddress);
            // this.isAdmin = response.isAdmin;
            
            // Temporary: Check against known admin addresses
            // In production, this should be validated server-side
            const adminAddresses = this._getAdminAddresses();
            this.isAdmin = adminAddresses.includes(userAddress);
            this.adminAddress = userAddress;
            this.adminValidated = true;
            
            console.log(`Admin validation for ${userAddress}: ${this.isAdmin}`);
            return this.isAdmin;
            
        } catch (error) {
            console.error('Error validating admin role:', error);
            this.isAdmin = false;
            this.adminValidated = true;
            return false;
        }
    }

    /**
     * Get list of admin addresses
     * @private
     * @returns {string[]} Array of admin addresses
     */
    _getAdminAddresses() {
        // In production, this should be fetched from the backend
        // For now, return empty array - will be configured via environment
        const adminAddressesStr = localStorage.getItem('adminAddresses');
        if (adminAddressesStr) {
            try {
                return JSON.parse(adminAddressesStr);
            } catch (e) {
                console.error('Error parsing admin addresses:', e);
            }
        }
        return [];
    }

    /**
     * Check if current user is an admin
     * @returns {boolean} True if user is admin
     */
    isAdminUser() {
        return this.adminValidated && this.isAdmin;
    }

    /**
     * Get cached data or fetch new data
     * @private
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @returns {Promise<any>} Cached or fresh data
     */
    async _getCachedOrFetch(key, fetchFn) {
        const cached = this.tokenCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        
        const data = await fetchFn();
        this.tokenCache.set(key, {
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
            this.tokenCache.delete(key);
        } else {
            this.tokenCache.clear();
        }
    }

    /**
     * Mint new tokens for a grove
     * @param {string} groveId - Grove identifier
     * @param {number} amount - Amount of tokens to mint
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Transaction result
     */
    async mintTokens(groveId, amount, loadingManager = null) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'mint');
        }
        
        if (!amount || amount <= 0) {
            throw new TokenOperationError('Amount must be greater than 0', 'mint', groveId);
        }
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('mint-tokens', `Minting ${amount} tokens...`) : null;
        
        try {
            console.log(`Minting ${amount} tokens for grove ${groveId}`);
            
            // Call API to mint tokens
            const result = await this.apiClient.mintTokens(groveId, amount);
            
            // Clear cache for this grove
            this.clearCache(`supply_${groveId}`);
            this.clearCache(`holders_${groveId}`);
            
            return result;
            
        } catch (error) {
            console.error('Error minting tokens:', error);
            throw new TokenOperationError(
                `Failed to mint tokens: ${error.message}`,
                'mint',
                groveId
            );
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Burn tokens from a grove
     * @param {string} groveId - Grove identifier
     * @param {number} amount - Amount of tokens to burn
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Transaction result
     */
    async burnTokens(groveId, amount, loadingManager = null) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'burn');
        }
        
        if (!amount || amount <= 0) {
            throw new TokenOperationError('Amount must be greater than 0', 'burn', groveId);
        }
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('burn-tokens', `Burning ${amount} tokens...`) : null;
        
        try {
            console.log(`Burning ${amount} tokens for grove ${groveId}`);
            
            // Call API to burn tokens
            const result = await this.apiClient.burnTokens(groveId, amount);
            
            // Clear cache for this grove
            this.clearCache(`supply_${groveId}`);
            this.clearCache(`holders_${groveId}`);
            
            return result;
            
        } catch (error) {
            console.error('Error burning tokens:', error);
            throw new TokenOperationError(
                `Failed to burn tokens: ${error.message}`,
                'burn',
                groveId
            );
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Get token supply for a grove
     * @param {string} groveId - Grove identifier
     * @returns {Promise<Object>} Token supply information
     */
    async getTokenSupply(groveId) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'getSupply');
        }
        
        try {
            return await this._getCachedOrFetch(
                `supply_${groveId}`,
                () => this.apiClient.getTokenSupply(groveId)
            );
        } catch (error) {
            console.error('Error fetching token supply:', error);
            throw new TokenOperationError(
                `Failed to fetch token supply: ${error.message}`,
                'getSupply',
                groveId
            );
        }
    }

    /**
     * Grant KYC approval to an account
     * @param {string} groveId - Grove identifier
     * @param {string} accountAddress - Account address to grant KYC
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Transaction result
     */
    async grantKYC(groveId, accountAddress, loadingManager = null) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'grantKYC');
        }
        
        if (!accountAddress) {
            throw new TokenOperationError('Account address is required', 'grantKYC', groveId);
        }
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('grant-kyc', 'Granting KYC approval...') : null;
        
        try {
            console.log(`Granting KYC for account ${accountAddress} on grove ${groveId}`);
            
            // Call API to grant KYC
            const result = await this.apiClient.grantKYC(groveId, accountAddress);
            
            // Clear cache for holders
            this.clearCache(`holders_${groveId}`);
            this.clearCache(`kyc_${groveId}_${accountAddress}`);
            
            return result;
            
        } catch (error) {
            console.error('Error granting KYC:', error);
            throw new TokenOperationError(
                `Failed to grant KYC: ${error.message}`,
                'grantKYC',
                groveId
            );
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Revoke KYC approval from an account
     * @param {string} groveId - Grove identifier
     * @param {string} accountAddress - Account address to revoke KYC
     * @param {Object} loadingManager - Optional loading state manager instance
     * @returns {Promise<Object>} Transaction result
     */
    async revokeKYC(groveId, accountAddress, loadingManager = null) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'revokeKYC');
        }
        
        if (!accountAddress) {
            throw new TokenOperationError('Account address is required', 'revokeKYC', groveId);
        }
        
        // Show loading spinner
        const loadingId = loadingManager ? 
            loadingManager.showLoading('revoke-kyc', 'Revoking KYC approval...') : null;
        
        try {
            console.log(`Revoking KYC for account ${accountAddress} on grove ${groveId}`);
            
            // Call API to revoke KYC
            const result = await this.apiClient.revokeKYC(groveId, accountAddress);
            
            // Clear cache for holders
            this.clearCache(`holders_${groveId}`);
            this.clearCache(`kyc_${groveId}_${accountAddress}`);
            
            return result;
            
        } catch (error) {
            console.error('Error revoking KYC:', error);
            throw new TokenOperationError(
                `Failed to revoke KYC: ${error.message}`,
                'revokeKYC',
                groveId
            );
        } finally {
            // Hide loading spinner
            if (loadingId && loadingManager) {
                loadingManager.hideLoading(loadingId);
            }
        }
    }

    /**
     * Check KYC status for an account
     * @param {string} groveId - Grove identifier
     * @param {string} accountAddress - Account address to check
     * @returns {Promise<Object>} KYC status information
     */
    async checkKYCStatus(groveId, accountAddress) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'checkKYC');
        }
        
        if (!accountAddress) {
            throw new TokenOperationError('Account address is required', 'checkKYC', groveId);
        }
        
        try {
            return await this._getCachedOrFetch(
                `kyc_${groveId}_${accountAddress}`,
                () => this.apiClient.checkKYCStatus(groveId, accountAddress)
            );
        } catch (error) {
            console.error('Error checking KYC status:', error);
            throw new TokenOperationError(
                `Failed to check KYC status: ${error.message}`,
                'checkKYC',
                groveId
            );
        }
    }

    /**
     * Get all token holders for a grove
     * @param {string} groveId - Grove identifier
     * @returns {Promise<Array>} List of token holders
     */
    async getTokenHolders(groveId) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'getHolders');
        }
        
        try {
            return await this._getCachedOrFetch(
                `holders_${groveId}`,
                () => this.apiClient.getTokenHolders(groveId)
            );
        } catch (error) {
            console.error('Error fetching token holders:', error);
            throw new TokenOperationError(
                `Failed to fetch token holders: ${error.message}`,
                'getHolders',
                groveId
            );
        }
    }

    /**
     * Get token balance for a specific holder
     * @param {string} groveId - Grove identifier
     * @param {string} holderAddress - Holder's address
     * @returns {Promise<Object>} Holder balance information
     */
    async getHolderBalance(groveId, holderAddress) {
        this._validateInitialization();
        this._validateAdminRole();
        
        if (!groveId) {
            throw new TokenOperationError('Grove ID is required', 'getBalance');
        }
        
        if (!holderAddress) {
            throw new TokenOperationError('Holder address is required', 'getBalance', groveId);
        }
        
        try {
            return await this._getCachedOrFetch(
                `balance_${groveId}_${holderAddress}`,
                () => this.apiClient.getHolderBalance(groveId, holderAddress)
            );
        } catch (error) {
            console.error('Error fetching holder balance:', error);
            throw new TokenOperationError(
                `Failed to fetch holder balance: ${error.message}`,
                'getBalance',
                groveId
            );
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TokenAdminManager,
        TokenOperationError,
        UnauthorizedAccessError
    };
}
