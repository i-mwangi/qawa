/**
 * Error Handler Module
 * Provides user-friendly error messages and toast notifications
 */

// Error code to user-friendly message mapping
const ERROR_MESSAGES = {
    // Distribution errors
    'DISTRIBUTION_ERROR': 'Failed to process revenue distribution. Please try again.',
    'DISTRIBUTION_BATCH_FAILED': 'Some distributions failed to process. We\'ll retry automatically.',
    'DISTRIBUTION_NOT_FOUND': 'Distribution not found. Please refresh and try again.',
    'DISTRIBUTION_ALREADY_CLAIMED': 'You have already claimed this distribution.',
    
    // Loan errors
    'LOAN_ERROR': 'Failed to process loan operation. Please try again.',
    'LOAN_INSUFFICIENT_COLLATERAL': 'Insufficient collateral for this loan amount.',
    'LOAN_EXCEEDS_LIMIT': 'Loan amount exceeds your borrowing limit.',
    'LOAN_NOT_FOUND': 'Loan not found. Please refresh and try again.',
    'LOAN_ALREADY_REPAID': 'This loan has already been repaid.',
    'LOAN_LIQUIDATION_RISK': 'Your loan is at risk of liquidation. Please add collateral or repay.',
    
    // Balance errors
    'INSUFFICIENT_BALANCE': 'Insufficient balance for this operation.',
    'INSUFFICIENT_USDC': 'Insufficient USDC balance. Please add funds to your wallet.',
    'INSUFFICIENT_TOKENS': 'Insufficient token balance for this operation.',
    'INSUFFICIENT_LP_TOKENS': 'Insufficient LP token balance for withdrawal.',
    
    // Liquidity errors
    'LIQUIDITY_ERROR': 'Failed to process liquidity operation. Please try again.',
    'POOL_NOT_FOUND': 'Lending pool not found.',
    'POOL_INSUFFICIENT_LIQUIDITY': 'Pool has insufficient liquidity for this operation.',
    'POOL_CAPACITY_EXCEEDED': 'Pool capacity exceeded. Please try a smaller amount.',
    
    // Token operation errors
    'TOKEN_OPERATION_ERROR': 'Failed to process token operation. Please try again.',
    'TOKEN_MINT_FAILED': 'Failed to mint tokens. Please check permissions and try again.',
    'TOKEN_BURN_FAILED': 'Failed to burn tokens. Please check balance and try again.',
    'TOKEN_TRANSFER_FAILED': 'Token transfer failed. Please try again.',
    'KYC_REQUIRED': 'KYC verification required for this operation.',
    'KYC_GRANT_FAILED': 'Failed to grant KYC status. Please try again.',
    'KYC_REVOKE_FAILED': 'Failed to revoke KYC status. Please try again.',
    
    // Price oracle errors
    'PRICE_ORACLE_ERROR': 'Failed to fetch price data. Please try again.',
    'PRICE_STALE': 'Price data is outdated. Refreshing...',
    'PRICE_INVALID': 'Invalid price data. Please contact support.',
    'PRICE_OUT_OF_RANGE': 'Price is outside acceptable range (50%-200% of market rate).',
    
    // Transaction errors
    'TRANSACTION_ERROR': 'Transaction failed. Please try again.',
    'TRANSACTION_REJECTED': 'Transaction was rejected. Please try again.',
    'TRANSACTION_TIMEOUT': 'Transaction timed out. Please check your wallet and try again.',
    'TRANSACTION_FAILED': 'Transaction failed on the blockchain. Please try again.',
    
    // Validation errors
    'VALIDATION_ERROR': 'Invalid input. Please check your data and try again.',
    'INVALID_AMOUNT': 'Invalid amount. Please enter a valid number.',
    'INVALID_ADDRESS': 'Invalid wallet address. Please check and try again.',
    'INVALID_GROVE_ID': 'Invalid grove ID. Please select a valid grove.',
    'AMOUNT_TOO_LOW': 'Amount is too low. Please enter a higher amount.',
    'AMOUNT_TOO_HIGH': 'Amount is too high. Please enter a lower amount.',
    
    // Network errors
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
    'API_ERROR': 'Server error. Please try again later.',
    'TIMEOUT_ERROR': 'Request timed out. Please try again.',
    'CONNECTION_ERROR': 'Connection failed. Please check your internet connection.',
    
    // Wallet errors
    'WALLET_NOT_CONNECTED': 'Please connect your wallet to continue.',
    'WALLET_ERROR': 'Wallet error. Please reconnect your wallet.',
    'WALLET_SIGNATURE_REJECTED': 'Signature rejected. Please approve the transaction in your wallet.',
    
    // Authorization errors
    'UNAUTHORIZED': 'You are not authorized to perform this action.',
    'ADMIN_ONLY': 'This action requires admin privileges.',
    'FORBIDDEN': 'Access denied. Please contact support.',
    
    // Generic errors
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
    'NOT_IMPLEMENTED': 'This feature is not yet available.',
    'MAINTENANCE': 'System is under maintenance. Please try again later.'
};

/**
 * Error Handler Class
 */
class ErrorHandler {
    constructor() {
        this.toastContainer = null;
        this.initToastContainer();
    }

    /**
     * Initialize toast notification container
     */
    initToastContainer() {
        // Check if container already exists
        this.toastContainer = document.getElementById('toast-container');
        
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toast-container';
            this.toastContainer.className = 'toast-container';
            document.body.appendChild(this.toastContainer);
        }
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error) {
        // If error has a custom message, use it
        if (error.userMessage) {
            return error.userMessage;
        }

        // Get message from error code
        const errorCode = error.errorCode || error.code || 'UNKNOWN_ERROR';
        let message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN_ERROR'];

        // Add specific details for certain error types
        if (error.name === 'InsufficientBalanceError') {
            message = `Insufficient ${error.assetType || 'balance'}: You need ${error.required} but only have ${error.available}`;
        } else if (error.name === 'DistributionError' && error.failedHolders?.length > 0) {
            message = `Distribution partially failed: ${error.failedHolders.length} holder(s) could not receive payment`;
        } else if (error.name === 'LoanError' && error.loanId) {
            message = `Loan operation failed for loan ${error.loanId}`;
        }

        return message;
    }

    /**
     * Determine if error is recoverable (can retry)
     */
    isRecoverable(error) {
        const recoverableErrors = [
            'NETWORK_ERROR',
            'TIMEOUT_ERROR',
            'CONNECTION_ERROR',
            'API_ERROR',
            'TRANSACTION_TIMEOUT',
            'PRICE_STALE',
            'DISTRIBUTION_BATCH_FAILED'
        ];

        const errorCode = error.errorCode || error.code;
        return recoverableErrors.includes(errorCode);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'error', options = {}) {
        const {
            duration = 5000,
            showRetry = false,
            onRetry = null,
            dismissible = true
        } = options;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconMap = {
            error: '❌',
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
                <span class="toast-message">${message}</span>
            </div>
            <div class="toast-actions">
                ${showRetry ? '<button class="toast-retry-btn">Retry</button>' : ''}
                ${dismissible ? '<button class="toast-close-btn">×</button>' : ''}
            </div>
        `;

        // Add to container
        this.toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Setup retry button
        if (showRetry && onRetry) {
            const retryBtn = toast.querySelector('.toast-retry-btn');
            retryBtn.addEventListener('click', () => {
                this.dismissToast(toast);
                onRetry();
            });
        }

        // Setup close button
        if (dismissible) {
            const closeBtn = toast.querySelector('.toast-close-btn');
            closeBtn.addEventListener('click', () => this.dismissToast(toast));
        }

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismissToast(toast), duration);
        }

        return toast;
    }

    /**
     * Dismiss toast notification
     */
    dismissToast(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Handle error with user-friendly notification
     */
    handleError(error, options = {}) {
        const {
            context = '',
            onRetry = null,
            logToConsole = true
        } = options;

        // Log detailed error to console for debugging
        if (logToConsole) {
            console.error(`[Error Handler] ${context}`, {
                error: error,
                errorJSON: error.toJSON ? error.toJSON() : null,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }

        // Get user-friendly message
        const message = this.getUserFriendlyMessage(error);
        const fullMessage = context ? `${context}: ${message}` : message;

        // Determine if recoverable
        const isRecoverable = this.isRecoverable(error);

        // Show toast notification
        this.showToast(fullMessage, 'error', {
            showRetry: isRecoverable && onRetry !== null,
            onRetry: onRetry
        });

        return {
            message: fullMessage,
            isRecoverable,
            error
        };
    }

    /**
     * Handle success notification
     */
    handleSuccess(message, options = {}) {
        const { duration = 3000 } = options;
        this.showToast(message, 'success', { duration });
    }

    /**
     * Handle warning notification
     */
    handleWarning(message, options = {}) {
        const { duration = 5000 } = options;
        this.showToast(message, 'warning', { duration });
    }

    /**
     * Handle info notification
     */
    handleInfo(message, options = {}) {
        const { duration = 4000 } = options;
        this.showToast(message, 'info', { duration });
    }

    /**
     * Clear all toasts
     */
    clearAll() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.dismissToast(toast));
    }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ErrorHandler,
        errorHandler,
        ERROR_MESSAGES
    };
}