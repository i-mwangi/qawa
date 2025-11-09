/**
 * Configuration Validator
 * Validates required environment variables on service startup
 * Requirements: 1.3, 2.3, 3.2, 3.3
 */

export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface RequiredConfig {
    HEDERA_OPERATOR_ID: string;
    HEDERA_OPERATOR_KEY: string;
    HEDERA_USDC_TOKEN_ID: string;
    HEDERA_NETWORK: string;
}

/**
 * Validate all required environment variables for USDC payment flows
 */
export function validateConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check HEDERA_OPERATOR_ID
    if (!process.env.HEDERA_OPERATOR_ID) {
        errors.push('HEDERA_OPERATOR_ID is required but not set');
    } else if (!isValidHederaAccountId(process.env.HEDERA_OPERATOR_ID)) {
        errors.push(`HEDERA_OPERATOR_ID has invalid format: ${process.env.HEDERA_OPERATOR_ID} (expected format: 0.0.12345)`);
    }

    // Check HEDERA_OPERATOR_KEY
    if (!process.env.HEDERA_OPERATOR_KEY) {
        errors.push('HEDERA_OPERATOR_KEY is required but not set');
    } else if (!isValidPrivateKey(process.env.HEDERA_OPERATOR_KEY)) {
        errors.push('HEDERA_OPERATOR_KEY has invalid format (expected DER-encoded hex string starting with 302e or 3030)');
    }

    // Check HEDERA_USDC_TOKEN_ID
    if (!process.env.HEDERA_USDC_TOKEN_ID) {
        errors.push('HEDERA_USDC_TOKEN_ID is required but not set');
    } else if (!isValidHederaAccountId(process.env.HEDERA_USDC_TOKEN_ID)) {
        errors.push(`HEDERA_USDC_TOKEN_ID has invalid format: ${process.env.HEDERA_USDC_TOKEN_ID} (expected format: 0.0.12345)`);
    }

    // Check HEDERA_NETWORK
    if (!process.env.HEDERA_NETWORK) {
        warnings.push('HEDERA_NETWORK not set, defaulting to testnet');
    } else if (!['testnet', 'mainnet'].includes(process.env.HEDERA_NETWORK)) {
        errors.push(`HEDERA_NETWORK has invalid value: ${process.env.HEDERA_NETWORK} (expected: testnet or mainnet)`);
    }

    // Check USE_HEDERA_BLOCKCHAIN flag
    if (process.env.USE_HEDERA_BLOCKCHAIN === 'false') {
        warnings.push('USE_HEDERA_BLOCKCHAIN is set to false - USDC transfers will be simulated');
    }

    // Check database configuration
    if (!process.env.DATABASE_URL && !process.env.TURSO_DATABASE_URL) {
        warnings.push('No database configured (DATABASE_URL or TURSO_DATABASE_URL)');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate Hedera account ID format (e.g., "0.0.12345")
 */
function isValidHederaAccountId(accountId: string): boolean {
    const pattern = /^0\.0\.\d+$/;
    return pattern.test(accountId);
}

/**
 * Validate private key format (DER-encoded hex string)
 */
function isValidPrivateKey(privateKey: string): boolean {
    // DER-encoded private keys start with 302e (ED25519) or 3030 (ECDSA)
    // and are hex strings of specific lengths
    if (!privateKey.startsWith('302e') && !privateKey.startsWith('3030')) {
        return false;
    }
    
    // Check if it's a valid hex string
    const hexPattern = /^[0-9a-fA-F]+$/;
    if (!hexPattern.test(privateKey)) {
        return false;
    }
    
    // ED25519 keys are typically 96 characters (48 bytes)
    // ECDSA keys are typically 138 characters (69 bytes)
    // But allow some flexibility for different key formats (64-200 chars)
    const minLength = 64;
    const maxLength = 200;
    return privateKey.length >= minLength && privateKey.length <= maxLength;
}

/**
 * Get required configuration or throw error if invalid
 */
export function getRequiredConfig(): RequiredConfig {
    const validation = validateConfig();
    
    if (!validation.valid) {
        const errorMessage = [
            '❌ Configuration validation failed:',
            ...validation.errors.map(err => `   - ${err}`),
            '',
            'Please check your .env file and ensure all required variables are set.',
            'See .env.example for reference.'
        ].join('\n');
        
        throw new Error(errorMessage);
    }
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
        console.warn('⚠️  Configuration warnings:');
        validation.warnings.forEach(warning => {
            console.warn(`   - ${warning}`);
        });
    }
    
    return {
        HEDERA_OPERATOR_ID: process.env.HEDERA_OPERATOR_ID!,
        HEDERA_OPERATOR_KEY: process.env.HEDERA_OPERATOR_KEY!,
        HEDERA_USDC_TOKEN_ID: process.env.HEDERA_USDC_TOKEN_ID!,
        HEDERA_NETWORK: process.env.HEDERA_NETWORK || 'testnet'
    };
}

/**
 * Log configuration status (without sensitive data)
 */
export function logConfigStatus(): void {
    const validation = validateConfig();
    
    if (validation.valid) {
        console.log('✅ Configuration validation passed');
        console.log(`   Network: ${process.env.HEDERA_NETWORK || 'testnet'}`);
        console.log(`   Operator: ${process.env.HEDERA_OPERATOR_ID}`);
        console.log(`   USDC Token: ${process.env.HEDERA_USDC_TOKEN_ID}`);
        console.log(`   Blockchain: ${process.env.USE_HEDERA_BLOCKCHAIN === 'true' ? 'Enabled' : 'Disabled'}`);
        
        if (validation.warnings.length > 0) {
            console.warn('\n⚠️  Warnings:');
            validation.warnings.forEach(warning => {
                console.warn(`   - ${warning}`);
            });
        }
    } else {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => {
            console.error(`   - ${error}`);
        });
        
        if (validation.warnings.length > 0) {
            console.warn('\n⚠️  Warnings:');
            validation.warnings.forEach(warning => {
                console.warn(`   - ${warning}`);
            });
        }
    }
}
