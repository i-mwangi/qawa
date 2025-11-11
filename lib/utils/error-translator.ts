/**
 * Error Message Translator
 * Converts technical blockchain/API errors into user-friendly messages
 */

export function translateError(error: string | Error): string {
    const errorMessage = typeof error === 'string' ? error : error.message;

    // Hedera Token Service Errors
    if (errorMessage.includes('INSUFFICIENT_TOKEN_BALANCE')) {
        return 'All tokens have already been claimed or sold. No tokens available.';
    }

    if (errorMessage.includes('TOKEN_NOT_ASSOCIATED')) {
        return 'Please associate the token in your HashPack wallet first, then try again.';
    }

    if (errorMessage.includes('INSUFFICIENT_ACCOUNT_BALANCE')) {
        return 'Not enough HBAR in your wallet to pay for the transaction fee (~$0.05 needed).';
    }

    if (errorMessage.includes('INSUFFICIENT_PAYER_BALANCE')) {
        return 'Platform treasury has insufficient HBAR for gas fees. Please contact support.';
    }

    if (errorMessage.includes('INVALID_SIGNATURE')) {
        return 'Transaction signature failed. Please make sure you\'re using the correct wallet.';
    }

    if (errorMessage.includes('ACCOUNT_FROZEN_FOR_TOKEN')) {
        return 'Your account is frozen for this token. Please contact support.';
    }

    if (errorMessage.includes('ACCOUNT_FROZEN')) {
        return 'Your account is frozen. Please contact support.';
    }

    if (errorMessage.includes('TOKEN_FROZEN')) {
        return 'This token is frozen and cannot be transferred. Please contact support.';
    }

    if (errorMessage.includes('TOKEN_WAS_DELETED')) {
        return 'This token has been deleted and is no longer valid.';
    }

    if (errorMessage.includes('INVALID_TOKEN_ID')) {
        return 'Invalid token ID. Please check the token address and try again.';
    }

    if (errorMessage.includes('INVALID_ACCOUNT_ID')) {
        return 'Invalid account ID. Please check your wallet address.';
    }

    if (errorMessage.includes('ACCOUNT_DELETED')) {
        return 'This account has been deleted.';
    }

    if (errorMessage.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
        return 'Token is not associated with your account. Please associate it in HashPack first.';
    }

    if (errorMessage.includes('INSUFFICIENT_TX_FEE')) {
        return 'Transaction fee is too low. Please try again.';
    }

    if (errorMessage.includes('INVALID_TRANSACTION')) {
        return 'Transaction is invalid. Please check your inputs and try again.';
    }

    if (errorMessage.includes('TRANSACTION_EXPIRED')) {
        return 'Transaction expired. Please try again.';
    }

    if (errorMessage.includes('BUSY')) {
        return 'Network is busy. Please wait a moment and try again.';
    }

    if (errorMessage.includes('PLATFORM_NOT_ACTIVE')) {
        return 'Network is currently unavailable. Please try again later.';
    }

    // USDC/Payment Errors
    if (errorMessage.includes('Insufficient balance')) {
        return 'You don\'t have enough funds for this transaction.';
    }

    if (errorMessage.includes('Insufficient USDC')) {
        return 'Not enough USDC in your wallet for this purchase.';
    }

    if (errorMessage.includes('Treasury has insufficient')) {
        return 'Platform treasury has insufficient funds. Please contact support.';
    }

    // Network/Connection Errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to fetch')) {
        return 'Unable to connect to the server. Please check your internet connection.';
    }

    if (errorMessage.includes('Network request failed')) {
        return 'Network error. Please check your internet connection and try again.';
    }

    if (errorMessage.includes('timeout')) {
        return 'Request timed out. The network might be slow. Please try again.';
    }

    // Database Errors
    if (errorMessage.includes('UNIQUE constraint failed')) {
        return 'This record already exists. Please check your input.';
    }

    if (errorMessage.includes('NOT NULL constraint failed')) {
        return 'Required information is missing. Please fill in all fields.';
    }

    if (errorMessage.includes('FOREIGN KEY constraint failed')) {
        return 'Related record not found. Please refresh and try again.';
    }

    // Validation Errors
    if (errorMessage.includes('Invalid amount') || errorMessage.includes('amount must be')) {
        return 'Please enter a valid amount.';
    }

    if (errorMessage.includes('Invalid address')) {
        return 'Please enter a valid wallet address.';
    }

    if (errorMessage.includes('Missing required')) {
        return 'Please fill in all required fields.';
    }

    // Authorization Errors
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Not authorized')) {
        return 'You don\'t have permission to perform this action.';
    }

    if (errorMessage.includes('Authentication failed')) {
        return 'Please connect your wallet and try again.';
    }

    // Grove/Token Specific
    if (errorMessage.includes('Grove not found')) {
        return 'Grove not found. It may have been deleted.';
    }

    if (errorMessage.includes('Grove not tokenized')) {
        return 'This grove hasn\'t been tokenized yet.';
    }

    if (errorMessage.includes('No tokens available')) {
        return 'All tokens have been sold. No tokens available for purchase.';
    }

    if (errorMessage.includes('Insufficient tokens')) {
        return 'Not enough tokens available for this purchase.';
    }

    // Withdrawal Errors
    if (errorMessage.includes('Insufficient balance for withdrawal')) {
        return 'You don\'t have enough balance to withdraw this amount.';
    }

    if (errorMessage.includes('Minimum withdrawal')) {
        return 'Withdrawal amount is below the minimum required.';
    }

    if (errorMessage.includes('Maximum withdrawal')) {
        return 'Withdrawal amount exceeds the maximum allowed.';
    }

    // Generic Errors (fallback)
    if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        return 'Something went wrong on our end. Please try again or contact support.';
    }

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        return 'The requested resource was not found.';
    }

    if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        return 'Invalid request. Please check your input and try again.';
    }

    // Wallet Connection Errors
    if (errorMessage.includes('Wallet not connected') || errorMessage.includes('wallet manager not available')) {
        return 'Please connect your wallet to continue.';
    }

    if (errorMessage.includes('No account connected')) {
        return 'Please connect your wallet to continue.';
    }

    // Pool/Liquidity Errors
    if (errorMessage.includes('Pool has no LP tokens')) {
        return 'The liquidity pool is empty. No LP tokens are in circulation yet.';
    }

    if (errorMessage.includes('Insufficient LP tokens')) {
        return 'You don\'t have enough LP tokens for this withdrawal.';
    }

    if (errorMessage.includes('Insufficient pool liquidity')) {
        return 'The pool doesn\'t have enough liquidity available for this withdrawal.';
    }

    if (errorMessage.includes('Unable to fetch pool statistics')) {
        return 'Unable to load pool information. Please try again.';
    }

    // Credit Score Errors
    if (errorMessage.includes('Failed to fetch credit score')) {
        return 'Unable to load your credit score. Please try again.';
    }

    // Loan Errors
    if (errorMessage.includes('Loan details are required') || errorMessage.includes('Loan details must include')) {
        return 'Unable to check loan health. Loan information is incomplete.';
    }

    if (errorMessage.includes('Insufficient collateral')) {
        return 'Your collateral is too low for this loan amount. Please add more collateral or reduce the loan amount.';
    }

    // API Response Errors
    if (errorMessage.includes('Invalid API response') || errorMessage.includes('missing data property')) {
        return 'Unable to load data. The server returned incomplete information. Please try again.';
    }

    if (errorMessage.includes('Server returned invalid response format')) {
        return 'Unable to load data. The server returned an unexpected response. Please try again.';
    }

    // Configuration Errors
    if (errorMessage.includes('LP token or treasury not configured')) {
        return 'Liquidity pool is not configured yet. Please contact support.';
    }

    if (errorMessage.includes('not properly initialized')) {
        return 'System is not ready yet. Please refresh the page and try again.';
    }

    // Feature Not Implemented
    if (errorMessage.includes('API migration in progress') || errorMessage.includes('Not Implemented')) {
        return 'This feature is coming soon! The secondary marketplace for trading tokens will be available in a future update.';
    }

    // If no match found, return a generic friendly message
    // but keep some context from the original error
    if (errorMessage.length > 100) {
        // Long technical error - simplify it
        return 'An error occurred. Please try again or contact support if the problem persists.';
    }

    // Short error - might be already friendly, return as is
    return errorMessage;
}

/**
 * Translate error and add helpful context
 */
export function translateErrorWithContext(error: string | Error, context?: string): string {
    const friendlyMessage = translateError(error);

    if (context) {
        return `${friendlyMessage} (${context})`;
    }

    return friendlyMessage;
}

/**
 * Check if error is user-actionable (vs system error)
 */
export function isUserActionable(error: string | Error): boolean {
    const errorMessage = typeof error === 'string' ? error : error.message;

    const userActionableErrors = [
        'TOKEN_NOT_ASSOCIATED',
        'INSUFFICIENT_ACCOUNT_BALANCE',
        'INSUFFICIENT_TOKEN_BALANCE',
        'Insufficient balance',
        'Invalid amount',
        'Missing required',
        'associate',
        'HBAR'
    ];

    return userActionableErrors.some(keyword => errorMessage.includes(keyword));
}

/**
 * Get suggested action for error
 */
export function getSuggestedAction(error: string | Error): string | null {
    const errorMessage = typeof error === 'string' ? error : error.message;

    if (errorMessage.includes('TOKEN_NOT_ASSOCIATED')) {
        return 'Open HashPack, go to Tokens tab, click +, and associate the token.';
    }

    if (errorMessage.includes('INSUFFICIENT_ACCOUNT_BALANCE') || errorMessage.includes('HBAR')) {
        return 'Add more HBAR to your wallet. You need at least $0.10 for transaction fees.';
    }

    if (errorMessage.includes('INSUFFICIENT_TOKEN_BALANCE')) {
        return 'Contact support - the platform may need to add more tokens.';
    }

    if (errorMessage.includes('Insufficient balance for withdrawal')) {
        return 'Wait for more harvest distributions or reduce your withdrawal amount.';
    }

    if (errorMessage.includes('Network') || errorMessage.includes('connection')) {
        return 'Check your internet connection and try again in a moment.';
    }

    if (errorMessage.includes('timeout')) {
        return 'The network is slow. Please wait a minute and try again.';
    }

    return null;
}
