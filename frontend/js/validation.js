/**
 * Validation Utilities
 * Client-side validation functions for the Coffee Tree Platform
 */

class ValidationError extends Error {
    constructor(message, field, code) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
    }
}

class Validator {
    /**
     * Validate amount is positive and within range
     * @param {number} amount - Amount to validate
     * @param {string} fieldName - Name of the field for error messages
     * @param {Object} options - Validation options
     * @param {number} options.min - Minimum allowed value (default: 0)
     * @param {number} options.max - Maximum allowed value (optional)
     * @param {boolean} options.allowZero - Allow zero values (default: false)
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateAmount(amount, fieldName = 'Amount', options = {}) {
        const { min = 0, max = null, allowZero = false } = options;

        // Check if amount is a number
        if (typeof amount !== 'number' || isNaN(amount)) {
            return {
                valid: false,
                error: `${fieldName} must be a valid number`,
                code: 'INVALID_NUMBER'
            };
        }

        // Check if amount is finite
        if (!isFinite(amount)) {
            return {
                valid: false,
                error: `${fieldName} must be a finite number`,
                code: 'INFINITE_NUMBER'
            };
        }

        // Check for zero
        if (!allowZero && amount === 0) {
            return {
                valid: false,
                error: `${fieldName} must be greater than zero`,
                code: 'ZERO_NOT_ALLOWED'
            };
        }

        // Check minimum
        if (amount < min) {
            return {
                valid: false,
                error: `${fieldName} must be at least ${min}`,
                code: 'BELOW_MINIMUM'
            };
        }

        // Check maximum
        if (max !== null && amount > max) {
            return {
                valid: false,
                error: `${fieldName} must not exceed ${max}`,
                code: 'ABOVE_MAXIMUM'
            };
        }

        // Check for negative
        if (amount < 0) {
            return {
                valid: false,
                error: `${fieldName} must be positive`,
                code: 'NEGATIVE_VALUE'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate Hedera account ID format
     * @param {string} accountId - Hedera account ID to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateHederaAccountId(accountId, fieldName = 'Account ID') {
        // Check if accountId is a string
        if (typeof accountId !== 'string') {
            return {
                valid: false,
                error: `${fieldName} must be a string`,
                code: 'INVALID_TYPE'
            };
        }

        // Trim whitespace
        accountId = accountId.trim();

        // Check if empty
        if (accountId.length === 0) {
            return {
                valid: false,
                error: `${fieldName} cannot be empty`,
                code: 'EMPTY_ACCOUNT_ID'
            };
        }

        // Hedera account ID format: shard.realm.num (e.g., 0.0.12345)
        const hederaAccountPattern = /^(\d+)\.(\d+)\.(\d+)$/;
        
        if (!hederaAccountPattern.test(accountId)) {
            return {
                valid: false,
                error: `${fieldName} must be in format: shard.realm.num (e.g., 0.0.12345)`,
                code: 'INVALID_FORMAT'
            };
        }

        // Extract parts
        const parts = accountId.split('.');
        const shard = parseInt(parts[0]);
        const realm = parseInt(parts[1]);
        const num = parseInt(parts[2]);

        // Validate ranges (Hedera specific)
        if (shard < 0 || shard > 32767) {
            return {
                valid: false,
                error: `${fieldName} shard must be between 0 and 32767`,
                code: 'INVALID_SHARD'
            };
        }

        if (realm < 0 || realm > 65535) {
            return {
                valid: false,
                error: `${fieldName} realm must be between 0 and 65535`,
                code: 'INVALID_REALM'
            };
        }

        if (num < 0) {
            return {
                valid: false,
                error: `${fieldName} account number must be positive`,
                code: 'INVALID_ACCOUNT_NUMBER'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate token amount does not exceed balance
     * @param {number} amount - Amount to validate
     * @param {number} balance - Available balance
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateTokenAmount(amount, balance, fieldName = 'Token amount') {
        // First validate the amount is valid
        const amountValidation = this.validateAmount(amount, fieldName, { min: 0, allowZero: false });
        if (!amountValidation.valid) {
            return amountValidation;
        }

        // Validate balance is a number
        if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
            return {
                valid: false,
                error: 'Invalid balance provided for validation',
                code: 'INVALID_BALANCE'
            };
        }

        // Check if amount exceeds balance
        if (amount > balance) {
            return {
                valid: false,
                error: `${fieldName} (${amount}) exceeds available balance (${balance})`,
                code: 'INSUFFICIENT_BALANCE'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate percentage value (0-100)
     * @param {number} percentage - Percentage to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validatePercentage(percentage, fieldName = 'Percentage') {
        return this.validateAmount(percentage, fieldName, { min: 0, max: 100, allowZero: true });
    }

    /**
     * Validate health score (0-100)
     * @param {number} score - Health score to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateHealthScore(score, fieldName = 'Health score') {
        return this.validateAmount(score, fieldName, { min: 0, max: 100, allowZero: true });
    }

    /**
     * Validate coffee quality grade (1-10)
     * @param {number} grade - Quality grade to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateQualityGrade(grade, fieldName = 'Quality grade') {
        return this.validateAmount(grade, fieldName, { min: 1, max: 10, allowZero: false });
    }

    /**
     * Validate price is within acceptable range of market price
     * @param {number} proposedPrice - Proposed price to validate
     * @param {number} marketPrice - Current market price
     * @param {string} fieldName - Name of the field for error messages
     * @param {Object} options - Validation options
     * @param {number} options.minPercent - Minimum percentage of market price (default: 50)
     * @param {number} options.maxPercent - Maximum percentage of market price (default: 200)
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validatePriceRange(proposedPrice, marketPrice, fieldName = 'Price', options = {}) {
        const { minPercent = 50, maxPercent = 200 } = options;

        // Validate proposed price is positive
        const priceValidation = this.validateAmount(proposedPrice, fieldName, { min: 0, allowZero: false });
        if (!priceValidation.valid) {
            return priceValidation;
        }

        // Validate market price
        if (typeof marketPrice !== 'number' || marketPrice <= 0) {
            return {
                valid: false,
                error: 'Invalid market price provided for validation',
                code: 'INVALID_MARKET_PRICE'
            };
        }

        // Calculate acceptable range
        const minPrice = (marketPrice * minPercent) / 100;
        const maxPrice = (marketPrice * maxPercent) / 100;

        if (proposedPrice < minPrice) {
            return {
                valid: false,
                error: `${fieldName} (${proposedPrice}) is too low. Must be at least ${minPercent}% of market price (${minPrice.toFixed(2)})`,
                code: 'PRICE_TOO_LOW'
            };
        }

        if (proposedPrice > maxPrice) {
            return {
                valid: false,
                error: `${fieldName} (${proposedPrice}) is too high. Must not exceed ${maxPercent}% of market price (${maxPrice.toFixed(2)})`,
                code: 'PRICE_TOO_HIGH'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate string is not empty
     * @param {string} value - String to validate
     * @param {string} fieldName - Name of the field for error messages
     * @param {Object} options - Validation options
     * @param {number} options.minLength - Minimum length (default: 1)
     * @param {number} options.maxLength - Maximum length (optional)
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateString(value, fieldName = 'Field', options = {}) {
        const { minLength = 1, maxLength = null } = options;

        if (typeof value !== 'string') {
            return {
                valid: false,
                error: `${fieldName} must be a string`,
                code: 'INVALID_TYPE'
            };
        }

        const trimmedValue = value.trim();

        if (trimmedValue.length < minLength) {
            return {
                valid: false,
                error: `${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''}`,
                code: 'TOO_SHORT'
            };
        }

        if (maxLength !== null && trimmedValue.length > maxLength) {
            return {
                valid: false,
                error: `${fieldName} must not exceed ${maxLength} characters`,
                code: 'TOO_LONG'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate date is not in the future
     * @param {Date|string} date - Date to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validatePastDate(date, fieldName = 'Date') {
        let dateObj;

        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string') {
            dateObj = new Date(date);
        } else {
            return {
                valid: false,
                error: `${fieldName} must be a valid date`,
                code: 'INVALID_DATE'
            };
        }

        if (isNaN(dateObj.getTime())) {
            return {
                valid: false,
                error: `${fieldName} must be a valid date`,
                code: 'INVALID_DATE'
            };
        }

        if (dateObj > new Date()) {
            return {
                valid: false,
                error: `${fieldName} cannot be in the future`,
                code: 'FUTURE_DATE'
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate collateralization ratio
     * @param {number} collateralValue - Value of collateral
     * @param {number} loanAmount - Loan amount
     * @param {number} requiredRatio - Required collateralization ratio (e.g., 1.25 for 125%)
     * @returns {Object} { valid: boolean, error: string|null, ratio: number }
     */
    static validateCollateralization(collateralValue, loanAmount, requiredRatio = 1.25) {
        // Validate inputs
        const collateralValidation = this.validateAmount(collateralValue, 'Collateral value', { min: 0, allowZero: false });
        if (!collateralValidation.valid) {
            return collateralValidation;
        }

        const loanValidation = this.validateAmount(loanAmount, 'Loan amount', { min: 0, allowZero: false });
        if (!loanValidation.valid) {
            return loanValidation;
        }

        // Calculate actual ratio
        const actualRatio = collateralValue / loanAmount;

        if (actualRatio < requiredRatio) {
            return {
                valid: false,
                error: `Insufficient collateral. Required ratio: ${(requiredRatio * 100).toFixed(0)}%, actual: ${(actualRatio * 100).toFixed(0)}%`,
                code: 'INSUFFICIENT_COLLATERAL',
                ratio: actualRatio
            };
        }

        return { valid: true, error: null, ratio: actualRatio };
    }

    /**
     * Validate batch size
     * @param {number} batchSize - Batch size to validate
     * @param {number} maxBatchSize - Maximum allowed batch size
     * @returns {Object} { valid: boolean, error: string|null }
     */
    static validateBatchSize(batchSize, maxBatchSize = 50) {
        return this.validateAmount(batchSize, 'Batch size', { min: 1, max: maxBatchSize, allowZero: false });
    }

    /**
     * Validate multiple fields at once
     * @param {Object} validations - Object with field names as keys and validation results as values
     * @returns {Object} { valid: boolean, errors: Object }
     */
    static validateMultiple(validations) {
        const errors = {};
        let allValid = true;

        for (const [field, validation] of Object.entries(validations)) {
            if (!validation.valid) {
                errors[field] = validation.error;
                allValid = false;
            }
        }

        return {
            valid: allValid,
            errors: allValid ? null : errors
        };
    }

    /**
     * Throw ValidationError if validation fails
     * @param {Object} validation - Validation result
     * @param {string} field - Field name
     * @throws {ValidationError}
     */
    static throwIfInvalid(validation, field) {
        if (!validation.valid) {
            throw new ValidationError(validation.error, field, validation.code);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, ValidationError };
}
