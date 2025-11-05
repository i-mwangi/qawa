/**
 * Custom Error Classes for Coffee Platform
 * Provides specific error types for different platform operations
 */

/**
 * Base error class for platform-specific errors
 */
class PlatformError extends Error {
    constructor(message, errorCode = null) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.timestamp = new Date().toISOString();
        
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Error thrown during revenue distribution operations
 */
class DistributionError extends PlatformError {
    constructor(message, distributionId = null, failedHolders = []) {
        super(message, 'DISTRIBUTION_ERROR');
        this.distributionId = distributionId;
        this.failedHolders = failedHolders;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            distributionId: this.distributionId,
            failedHolders: this.failedHolders,
            failedCount: this.failedHolders.length
        };
    }
}

/**
 * Error thrown during loan operations
 */
class LoanError extends PlatformError {
    constructor(message, loanId = null, errorCode = null) {
        super(message, errorCode || 'LOAN_ERROR');
        this.loanId = loanId;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            loanId: this.loanId
        };
    }
}

/**
 * Error thrown when balance is insufficient for an operation
 */
class InsufficientBalanceError extends PlatformError {
    constructor(required, available, assetType = 'USDC') {
        const message = `Insufficient ${assetType} balance: required ${required}, available ${available}`;
        super(message, 'INSUFFICIENT_BALANCE');
        this.required = required;
        this.available = available;
        this.assetType = assetType;
        this.shortfall = required - available;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            required: this.required,
            available: this.available,
            assetType: this.assetType,
            shortfall: this.shortfall
        };
    }
}

/**
 * Error thrown during liquidity operations
 */
class LiquidityError extends PlatformError {
    constructor(message, poolAddress = null, errorCode = null) {
        super(message, errorCode || 'LIQUIDITY_ERROR');
        this.poolAddress = poolAddress;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            poolAddress: this.poolAddress
        };
    }
}

/**
 * Error thrown during token operations
 */
class TokenOperationError extends PlatformError {
    constructor(message, groveId = null, errorCode = null) {
        super(message, errorCode || 'TOKEN_OPERATION_ERROR');
        this.groveId = groveId;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            groveId: this.groveId
        };
    }
}

/**
 * Error thrown during price oracle operations
 */
class PriceOracleError extends PlatformError {
    constructor(message, variety = null, errorCode = null) {
        super(message, errorCode || 'PRICE_ORACLE_ERROR');
        this.variety = variety;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            variety: this.variety
        };
    }
}

/**
 * Error thrown during transaction operations
 */
class TransactionError extends PlatformError {
    constructor(message, transactionHash = null, errorCode = null) {
        super(message, errorCode || 'TRANSACTION_ERROR');
        this.transactionHash = transactionHash;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            transactionHash: this.transactionHash
        };
    }
}

/**
 * Error thrown during validation
 */
class ValidationError extends PlatformError {
    constructor(message, field = null, value = null) {
        super(message, 'VALIDATION_ERROR');
        this.field = field;
        this.value = value;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field,
            value: this.value
        };
    }
}

/**
 * Error thrown during network operations
 */
class NetworkError extends PlatformError {
    constructor(message, statusCode = null, endpoint = null) {
        super(message, 'NETWORK_ERROR');
        this.statusCode = statusCode;
        this.endpoint = endpoint;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            statusCode: this.statusCode,
            endpoint: this.endpoint
        };
    }
}

// Export all error classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PlatformError,
        DistributionError,
        LoanError,
        InsufficientBalanceError,
        LiquidityError,
        TokenOperationError,
        PriceOracleError,
        TransactionError,
        ValidationError,
        NetworkError
    };
}
