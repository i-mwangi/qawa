/**
 * Application Configuration Module
 * 
 * Loads and validates environment variables for HashConnect integration.
 * Provides configuration objects and validation utilities.
 * 
 * @module config
 */

/**
 * Get environment variable with fallback
 * Checks Vite's import.meta.env first, then falls back to provided default
 * 
 * @param {string} key - Environment variable key (e.g., 'VITE_WALLETCONNECT_PROJECT_ID')
 * @param {string} fallback - Fallback value if environment variable is not set
 * @returns {string} Environment variable value or fallback
 */
function getEnvVar(key, fallback) {
    // Check if import.meta.env is available (Vite build)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        const value = import.meta.env[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    
    // Fallback for non-Vite environments or missing values
    return fallback;
}

/**
 * Get application metadata
 * Handles both browser and Node.js environments
 * 
 * @returns {Object} Application metadata object
 * @returns {string} return.name - Application name
 * @returns {string} return.description - Application description
 * @returns {string[]} return.icons - Array of icon URLs
 * @returns {string} return.url - Application URL
 */
function getAppMetadata() {
    const baseMetadata = {
        name: 'Chai Platform',
        description: 'Invest in Sustainable Coffee Production'
    };
    
    // Check if running in browser
    if (typeof window !== 'undefined' && window.location) {
        return {
            ...baseMetadata,
            icons: [window.location.origin + '/public/chai.png'],
            url: window.location.origin
        };
    }
    
    // Fallback for Node.js environment
    return {
        ...baseMetadata,
        icons: ['http://localhost:3000/public/chai.png'],
        url: 'http://localhost:3000'
    };
}

/**
 * Development fallback values
 * Used when environment variables are not set
 * 
 * @constant {Object}
 * @property {string} projectId - Default WalletConnect project ID
 * @property {string} network - Default Hedera network
 * @property {boolean} debug - Default debug mode setting
 */
const DEVELOPMENT_DEFAULTS = {
    projectId: '39948bbdaaebec2790629f3e9589793a',
    network: 'testnet',
    debug: true
};

/**
 * HashConnect Configuration
 * Loads WalletConnect project ID and Hedera network from environment variables.
 * Falls back to development defaults if not set.
 * 
 * @constant {Object}
 * @property {string} projectId - WalletConnect project ID
 * @property {string} network - Hedera network ('testnet' or 'mainnet')
 * @property {Object} appMetadata - Application metadata
 * @property {string} appMetadata.name - Application name
 * @property {string} appMetadata.description - Application description
 * @property {string[]} appMetadata.icons - Array of icon URLs
 * @property {string} appMetadata.url - Application URL
 * @property {boolean} debug - Enable debug logging
 */
export const hashConnectConfig = {
    // WalletConnect Project ID
    // Get your own from: https://cloud.walletconnect.com/
    projectId: getEnvVar('VITE_WALLETCONNECT_PROJECT_ID', DEVELOPMENT_DEFAULTS.projectId),
    
    // Hedera Network (testnet or mainnet)
    network: getEnvVar('VITE_HEDERA_NETWORK', DEVELOPMENT_DEFAULTS.network),
    
    // Application Metadata
    appMetadata: getAppMetadata(),
    
    // Enable debug logging in development
    debug: getEnvVar('VITE_DEBUG', String(DEVELOPMENT_DEFAULTS.debug)) === 'true'
};

/**
 * Validate required configuration
 * Throws an error if required configuration is missing or invalid
 * @returns {boolean} True if validation passes
 * @throws {Error} If validation fails
 */
export function validateConfig() {
    const errors = [];
    const warnings = [];
    
    // Validate project ID
    if (!hashConnectConfig.projectId) {
        errors.push('VITE_WALLETCONNECT_PROJECT_ID is required');
    } else if (hashConnectConfig.projectId.length < 32) {
        warnings.push('VITE_WALLETCONNECT_PROJECT_ID appears to be invalid (too short)');
    }
    
    // Check if using default project ID in production
    if (hashConnectConfig.projectId === DEVELOPMENT_DEFAULTS.projectId) {
        warnings.push('Using default WalletConnect project ID. Get your own from https://cloud.walletconnect.com/');
    }
    
    // Validate network
    if (!hashConnectConfig.network) {
        errors.push('VITE_HEDERA_NETWORK is required');
    } else if (hashConnectConfig.network !== 'testnet' && hashConnectConfig.network !== 'mainnet') {
        errors.push(`VITE_HEDERA_NETWORK must be either "testnet" or "mainnet", got "${hashConnectConfig.network}"`);
    }
    
    // Validate app metadata
    if (!hashConnectConfig.appMetadata) {
        errors.push('Application metadata is required');
    } else {
        if (!hashConnectConfig.appMetadata.name) {
            errors.push('Application name is required in metadata');
        }
        if (!hashConnectConfig.appMetadata.description) {
            warnings.push('Application description is missing in metadata');
        }
        if (!hashConnectConfig.appMetadata.url) {
            warnings.push('Application URL is missing in metadata');
        }
        if (!hashConnectConfig.appMetadata.icons || hashConnectConfig.appMetadata.icons.length === 0) {
            warnings.push('Application icons are missing in metadata');
        }
    }
    
    // Log warnings if any
    if (warnings.length > 0 && hashConnectConfig.debug) {
        console.warn('⚠️ Configuration Warnings:');
        warnings.forEach(warning => console.warn('  -', warning));
    }
    
    // Throw error if validation fails
    if (errors.length > 0) {
        const errorMessage = 'Configuration validation failed:\n' + errors.map(e => '  - ' + e).join('\n');
        throw new Error(errorMessage);
    }
    
    return true;
}

/**
 * Log configuration (for debugging)
 * Masks sensitive information
 * @param {boolean} verbose - Show detailed configuration
 */
export function logConfig(verbose = false) {
    console.log('🔧 HashConnect Configuration:');
    console.log('  Project ID:', hashConnectConfig.projectId ? '✅ Set' : '❌ Missing');
    
    if (verbose && hashConnectConfig.projectId) {
        // Show first 8 and last 4 characters for debugging
        const masked = hashConnectConfig.projectId.substring(0, 8) + '...' + 
                      hashConnectConfig.projectId.substring(hashConnectConfig.projectId.length - 4);
        console.log('    Value:', masked);
    }
    
    console.log('  Network:', hashConnectConfig.network);
    console.log('  App Name:', hashConnectConfig.appMetadata.name);
    console.log('  App URL:', hashConnectConfig.appMetadata.url);
    console.log('  Debug Mode:', hashConnectConfig.debug ? 'Enabled' : 'Disabled');
    
    if (verbose) {
        console.log('  Environment:', typeof import.meta !== 'undefined' && import.meta.env ? 'Vite' : 'Fallback');
        console.log('  Using Defaults:', hashConnectConfig.projectId === DEVELOPMENT_DEFAULTS.projectId ? 'Yes' : 'No');
    }
}

/**
 * Initialize and validate configuration on module load
 * Runs automatically when the module is imported.
 * Validates configuration and logs results in debug mode.
 * 
 * @returns {boolean} True if initialization succeeded, false otherwise
 * @private
 */
function initializeConfig() {
    try {
        validateConfig();
        
        if (hashConnectConfig.debug) {
            console.log('✅ Configuration validated successfully');
            logConfig(true); // Verbose logging in debug mode
        }
        
        return true;
    } catch (error) {
        console.error('❌ Configuration Error:', error.message);
        console.error('');
        console.error('Please check your .env file and ensure all required variables are set:');
        console.error('  - VITE_WALLETCONNECT_PROJECT_ID (get from https://cloud.walletconnect.com/)');
        console.error('  - VITE_HEDERA_NETWORK (testnet or mainnet)');
        console.error('');
        console.error('Example .env file:');
        console.error('  VITE_WALLETCONNECT_PROJECT_ID=your-project-id-here');
        console.error('  VITE_HEDERA_NETWORK=testnet');
        console.error('');
        
        // Don't throw in production, allow app to continue with defaults
        if (hashConnectConfig.debug) {
            console.warn('⚠️ Continuing with default configuration values');
        }
        
        return false;
    }
}

// Run initialization
initializeConfig();

export default hashConnectConfig;
