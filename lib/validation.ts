/**
 * Validation utilities for user settings and account data
 * 
 * This module provides validation functions for:
 * - Hedera account ID format validation
 * - Boolean flag validation
 * - Validation error messages
 */

/**
 * Validation error class for structured error handling
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates Hedera account ID format
 * 
 * Valid format: X.Y.Z where X, Y, Z are non-negative integers
 * Examples: "0.0.123456", "0.0.1234", "1.2.3"
 * 
 * @param accountId - The account ID to validate
 * @returns true if valid, false otherwise
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export function validateAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') {
    return false;
  }

  // Hedera account format: shard.realm.account (e.g., "0.0.123456")
  const hederaAccountPattern = /^\d+\.\d+\.\d+$/;
  
  return hederaAccountPattern.test(accountId);
}

/**
 * Validates Hedera account ID and throws error if invalid
 * 
 * @param accountId - The account ID to validate
 * @throws ValidationError if account ID is invalid
 * 
 * Requirements: 7.3, 7.4
 */
export function assertValidAccountId(accountId: string): void {
  if (!validateAccountId(accountId)) {
    throw new ValidationError(
      `Invalid Hedera account ID format. Expected format: "X.Y.Z" (e.g., "0.0.123456"), received: "${accountId}"`,
      'accountId',
      accountId
    );
  }
}

/**
 * Validates boolean flag values
 * 
 * Accepts: true, false, 1, 0, "true", "false", "1", "0"
 * 
 * @param value - The value to validate as boolean
 * @returns true if valid boolean representation, false otherwise
 * 
 * Requirements: 7.2, 7.3, 7.4
 */
export function validateBooleanFlag(value: any): boolean {
  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return value === 0 || value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === 'false' || normalized === '1' || normalized === '0';
  }

  return false;
}

/**
 * Validates boolean flag and throws error if invalid
 * 
 * @param value - The value to validate as boolean
 * @param fieldName - The name of the field being validated
 * @throws ValidationError if value is not a valid boolean representation
 * 
 * Requirements: 7.3, 7.4
 */
export function assertValidBooleanFlag(value: any, fieldName: string): void {
  if (!validateBooleanFlag(value)) {
    throw new ValidationError(
      `Invalid boolean flag value for "${fieldName}". Expected: true, false, 1, 0, received: ${JSON.stringify(value)}`,
      fieldName,
      value
    );
  }
}

/**
 * Normalizes boolean flag to actual boolean value
 * 
 * Converts: 1, "1", "true" -> true
 * Converts: 0, "0", "false" -> false
 * 
 * @param value - The value to normalize
 * @returns boolean value
 * @throws ValidationError if value is not a valid boolean representation
 * 
 * Requirements: 7.2, 7.3
 */
export function normalizeBooleanFlag(value: any): boolean {
  assertValidBooleanFlag(value, 'value');

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  // Should never reach here due to validation
  return false;
}

/**
 * Validates user settings object
 * 
 * @param settings - Partial user settings object to validate
 * @returns Validation result with errors if any
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function validateUserSettings(settings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('Settings must be an object');
    return { valid: false, errors };
  }

  // Validate account if provided
  if ('account' in settings) {
    if (!validateAccountId(settings.account)) {
      errors.push(`Invalid account ID format: "${settings.account}". Expected format: "X.Y.Z" (e.g., "0.0.123456")`);
    }
  }

  // Validate boolean flags if provided
  const booleanFields = ['skipFarmerVerification', 'skipInvestorVerification', 'demoBypass'];
  
  for (const field of booleanFields) {
    if (field in settings) {
      if (!validateBooleanFlag(settings[field])) {
        errors.push(`Invalid value for "${field}": ${JSON.stringify(settings[field])}. Expected: true, false, 1, or 0`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validation error messages for common scenarios
 * 
 * Requirements: 7.3, 7.4
 */
export const ValidationMessages = {
  INVALID_ACCOUNT_ID: 'Invalid Hedera account ID format. Expected format: "X.Y.Z" (e.g., "0.0.123456")',
  MISSING_ACCOUNT_ID: 'Account ID is required',
  INVALID_BOOLEAN: 'Invalid boolean value. Expected: true, false, 1, or 0',
  INVALID_SETTINGS_OBJECT: 'Settings must be a valid object',
  VALIDATION_FAILED: 'Validation failed. Please check your input and try again.'
} as const;

/**
 * Creates a standardized validation error response
 * 
 * @param errors - Array of error messages
 * @returns Standardized error response object
 * 
 * Requirements: 7.3, 7.4
 */
export function createValidationErrorResponse(errors: string[]) {
  return {
    success: false,
    error: ValidationMessages.VALIDATION_FAILED,
    details: errors,
    timestamp: Date.now()
  };
}
