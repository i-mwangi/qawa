/**
 * Error Display Component
 * 
 * Provides user-friendly error message display with actionable guidance
 * Integrates with the wallet error handler for categorized errors
 */

import { getUserFriendlyError, logCategorizedError } from './wallet-error-handler.js';

/**
 * Display an error message to the user
 * @param {Error|string} error - Error to display
 * @param {Object} options - Display options
 * @param {HTMLElement} options.container - Container element for error display
 * @param {Function} options.onAction - Callback for action button click
 * @param {boolean} options.showTechnicalDetails - Whether to show technical details
 * @param {number} options.autoDismiss - Auto-dismiss after milliseconds (0 = no auto-dismiss)
 */
export function displayError(error, options = {}) {
    const {
        container = document.body,
        onAction = null,
        showTechnicalDetails = false,
        autoDismiss = 0
    } = options;
    
    // Get user-friendly error information
    const errorInfo = getUserFriendlyError(error);
    
    // Log the error with categorization
    logCategorizedError(error, { displayedToUser: true });
    
    // Create error display element
    const errorElement = createErrorElement(errorInfo, {
        onAction,
        showTechnicalDetails
    });
    
    // Add to container
    container.appendChild(errorElement);
    
    // Auto-dismiss if specified
    if (autoDismiss > 0) {
        setTimeout(() => {
            dismissError(errorElement);
        }, autoDismiss);
    }
    
    return errorElement;
}

/**
 * Create an error display element
 * @param {Object} errorInfo - Error information from getUserFriendlyError
 * @param {Object} options - Display options
 * @returns {HTMLElement} Error display element
 * @private
 */
function createErrorElement(errorInfo, options = {}) {
    const { onAction, showTechnicalDetails } = options;
    
    // Create container
    const errorDiv = document.createElement('div');
    errorDiv.className = `wallet-error wallet-error-${errorInfo.severity}`;
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    
    // Create icon based on severity
    const icon = getSeverityIcon(errorInfo.severity);
    
    // Build HTML content
    errorDiv.innerHTML = `
        <div class="wallet-error-content">
            <div class="wallet-error-icon">${icon}</div>
            <div class="wallet-error-text">
                <h3 class="wallet-error-title">${escapeHtml(errorInfo.title)}</h3>
                <p class="wallet-error-message">${escapeHtml(errorInfo.message)}</p>
                ${showTechnicalDetails ? `
                    <details class="wallet-error-details">
                        <summary>Technical Details</summary>
                        <pre>${escapeHtml(errorInfo.technicalDetails)}</pre>
                    </details>
                ` : ''}
            </div>
            <div class="wallet-error-actions">
                ${onAction ? `
                    <button class="wallet-error-action-btn" data-action="primary">
                        ${escapeHtml(errorInfo.action)}
                    </button>
                ` : ''}
                <button class="wallet-error-dismiss-btn" data-action="dismiss" aria-label="Dismiss error">
                    ×
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const actionBtn = errorDiv.querySelector('[data-action="primary"]');
    if (actionBtn && onAction) {
        actionBtn.addEventListener('click', () => {
            onAction(errorInfo);
            dismissError(errorDiv);
        });
    }
    
    const dismissBtn = errorDiv.querySelector('[data-action="dismiss"]');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            dismissError(errorDiv);
        });
    }
    
    return errorDiv;
}

/**
 * Get icon HTML for severity level
 * @param {string} severity - Severity level (info, warning, error)
 * @returns {string} Icon HTML
 * @private
 */
function getSeverityIcon(severity) {
    const icons = {
        info: '<i class="fas fa-info-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        error: '<i class="fas fa-times-circle"></i>'
    };
    
    return icons[severity] || icons.error;
}

/**
 * Dismiss an error display element
 * @param {HTMLElement} errorElement - Error element to dismiss
 */
export function dismissError(errorElement) {
    if (!errorElement) return;
    
    // Add fade-out animation
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-20px)';
    
    // Remove after animation
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 300);
}

/**
 * Display error as a toast notification
 * @param {Error|string} error - Error to display
 * @param {Object} options - Toast options
 * @param {Function} options.onAction - Callback for action button
 * @param {number} options.duration - Toast duration in milliseconds (default: 5000)
 */
export function showErrorToast(error, options = {}) {
    const {
        onAction = null,
        duration = 5000
    } = options;
    
    // Get or create toast container
    let toastContainer = document.getElementById('wallet-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'wallet-toast-container';
        toastContainer.className = 'wallet-toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Display error in toast container
    const errorElement = displayError(error, {
        container: toastContainer,
        onAction,
        showTechnicalDetails: false,
        autoDismiss: duration
    });
    
    // Add toast-specific class
    errorElement.classList.add('wallet-toast');
    
    return errorElement;
}

/**
 * Display error inline in a specific container
 * @param {Error|string} error - Error to display
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Display options
 */
export function showInlineError(error, container, options = {}) {
    // Clear existing errors in container
    clearInlineErrors(container);
    
    // Display new error
    return displayError(error, {
        container,
        showTechnicalDetails: true,
        ...options
    });
}

/**
 * Clear all inline errors from a container
 * @param {HTMLElement} container - Container element
 */
export function clearInlineErrors(container) {
    if (!container) return;
    
    const errors = container.querySelectorAll('.wallet-error');
    errors.forEach(error => dismissError(error));
}

/**
 * Map technical error to actionable guidance
 * @param {Object} errorInfo - Error information from getUserFriendlyError
 * @returns {Object} Guidance information
 */
export function getActionableGuidance(errorInfo) {
    const guidance = {
        'CONNECTION_TIMEOUT': {
            steps: [
                'Check your internet connection',
                'Make sure your wallet app is open and unlocked',
                'Try connecting again',
                'If the problem persists, try restarting your wallet app'
            ],
            helpLink: '/help/connection-timeout'
        },
        'USER_REJECTION': {
            steps: [
                'Click "Connect Wallet" to try again',
                'Approve the connection in your wallet when prompted'
            ],
            helpLink: '/help/wallet-connection'
        },
        'WALLET_NOT_INSTALLED': {
            steps: [
                'Install HashPack browser extension',
                'Or use a mobile wallet with WalletConnect',
                'Refresh this page after installation'
            ],
            helpLink: '/help/install-wallet'
        },
        'NETWORK_ERROR': {
            steps: [
                'Check your internet connection',
                'Verify the Hedera network is operational',
                'Try again in a few moments'
            ],
            helpLink: '/help/network-issues'
        },
        'TRANSACTION_ERROR': {
            steps: [
                'Verify your wallet has sufficient HBAR for gas fees',
                'Check that you approved the transaction in your wallet',
                'Try the transaction again'
            ],
            helpLink: '/help/transaction-issues'
        },
        'INSUFFICIENT_BALANCE': {
            steps: [
                'Add HBAR to your wallet',
                'You can purchase HBAR on supported exchanges',
                'Transfer HBAR from another wallet'
            ],
            helpLink: '/help/add-funds'
        },
        'INITIALIZATION_ERROR': {
            steps: [
                'Refresh the page',
                'Clear your browser cache',
                'Try a different browser',
                'Contact support if the issue persists'
            ],
            helpLink: '/help/initialization-error'
        },
        'UNKNOWN_ERROR': {
            steps: [
                'Try the operation again',
                'Refresh the page',
                'Contact support with the error details below'
            ],
            helpLink: '/help/support'
        }
    };
    
    return guidance[errorInfo.category] || guidance['UNKNOWN_ERROR'];
}

/**
 * Display detailed error guidance modal
 * @param {Error|string} error - Error to display guidance for
 */
export function showErrorGuidance(error) {
    const errorInfo = getUserFriendlyError(error);
    const guidance = getActionableGuidance(errorInfo);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'wallet-error-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'error-modal-title');
    modal.setAttribute('aria-modal', 'true');
    
    modal.innerHTML = `
        <div class="wallet-error-modal-overlay"></div>
        <div class="wallet-error-modal-content">
            <div class="wallet-error-modal-header">
                <h2 id="error-modal-title">${escapeHtml(errorInfo.title)}</h2>
                <button class="wallet-error-modal-close" aria-label="Close">×</button>
            </div>
            <div class="wallet-error-modal-body">
                <p class="wallet-error-modal-message">${escapeHtml(errorInfo.message)}</p>
                
                <h3>What to do:</h3>
                <ol class="wallet-error-guidance-steps">
                    ${guidance.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                </ol>
                
                <details class="wallet-error-modal-details">
                    <summary>Technical Details</summary>
                    <pre>${escapeHtml(errorInfo.technicalDetails)}</pre>
                </details>
                
                <div class="wallet-error-modal-help">
                    <a href="${guidance.helpLink}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-question-circle"></i> Learn more
                    </a>
                </div>
            </div>
            <div class="wallet-error-modal-footer">
                <button class="wallet-error-modal-action">${escapeHtml(errorInfo.action)}</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('.wallet-error-modal-close');
    const overlay = modal.querySelector('.wallet-error-modal-overlay');
    const actionBtn = modal.querySelector('.wallet-error-modal-action');
    
    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    actionBtn.addEventListener('click', closeModal);
    
    // Add to document
    document.body.appendChild(modal);
    
    // Focus trap
    const focusableElements = modal.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length > 0) {
        focusableElements[0].focus();
    }
    
    return modal;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 * @private
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default {
    displayError,
    dismissError,
    showErrorToast,
    showInlineError,
    clearInlineErrors,
    getActionableGuidance,
    showErrorGuidance
};
