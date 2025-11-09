/**
 * Credit Score Module
 * Handles fetching and displaying credit scores for farmers
 */

class CreditScoreManager {
    constructor() {
        this.creditScore = null;
        this.loading = false;
        this.error = null;
        this.account = null;
    }

    /**
     * Fetch credit score for an account
     * @param {string} account - The account address
     * @returns {Promise<Object>} Credit score data
     */
    async fetchCreditScore(account) {
        if (!account) {
            throw new Error('Account address is required');
        }

        this.loading = true;
        this.error = null;
        this.account = account;

        try {
            const response = await fetch(`/api/credit-score/${account}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // No credit history yet
                    return {
                        account,
                        currentScore: 500,
                        tier: 'fair',
                        maxLoanAmount: 2000,
                        totalLoans: 0,
                        onTimePayments: 0,
                        earlyPayments: 0,
                        latePayments: 0,
                        lastUpdated: Date.now()
                    };
                }
                throw new Error(`Failed to fetch credit score: ${response.statusText}`);
            }

            const data = await response.json();
            this.creditScore = data;
            return data;
        } catch (error) {
            this.error = error.message;
            console.error('Error fetching credit score:', error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Get color class for credit score
     * @param {number} score - Credit score (300-850)
     * @returns {string} Color class name
     */
    getScoreColorClass(score) {
        if (score >= 750) return 'excellent';
        if (score >= 650) return 'good';
        if (score >= 550) return 'fair';
        return 'poor';
    }

    /**
     * Get label for credit score tier
     * @param {string} tier - Credit tier
     * @returns {string} Tier label
     */
    getTierLabel(tier) {
        const labels = {
            excellent: 'Excellent',
            good: 'Good',
            fair: 'Fair',
            poor: 'Poor'
        };
        return labels[tier] || 'Unknown';
    }

    /**
     * Get description for credit tier
     * @param {string} tier - Credit tier
     * @param {number} maxLoanAmount - Maximum loan amount
     * @returns {string} Tier description
     */
    getTierDescription(tier, maxLoanAmount) {
        const descriptions = {
            excellent: `You qualify for loans up to $${maxLoanAmount.toLocaleString()} with the best rates. Excellent credit history!`,
            good: `You qualify for loans up to $${maxLoanAmount.toLocaleString()} with competitive rates. Keep up the good work!`,
            fair: `You may qualify for loans up to $${maxLoanAmount.toLocaleString()} with moderate rates. Continue building your credit.`,
            poor: `Current loan limit: $${maxLoanAmount.toLocaleString()}. Work on improving your credit score for better terms.`
        };
        return descriptions[tier] || 'No credit history available.';
    }

    /**
     * Calculate progress percentage for visual display
     * @param {number} score - Credit score (300-850)
     * @returns {number} Progress percentage (0-100)
     */
    getScoreProgress(score) {
        return Math.min((score / 850) * 100, 100);
    }

    /**
     * Render credit score card HTML
     * @param {Object} scoreData - Credit score data
     * @returns {string} HTML string
     */
    renderCreditScoreCard(scoreData) {
        if (!scoreData) {
            return this.renderEmptyState();
        }

        const { currentScore, tier, maxLoanAmount, totalLoans, onTimePayments, earlyPayments, latePayments } = scoreData;
        const colorClass = this.getScoreColorClass(currentScore);
        const tierLabel = this.getTierLabel(tier);
        const tierDescription = this.getTierDescription(tier, maxLoanAmount);
        const progress = this.getScoreProgress(currentScore);

        return `
            <div class="credit-score-card">
                <div class="credit-score-header">
                    <h3 class="credit-score-title">Credit Reputation Score</h3>
                    <span class="credit-score-badge ${colorClass}">${tierLabel}</span>
                </div>

                <div class="credit-score-display">
                    <span class="credit-score-label">Current Score</span>
                    <span class="credit-score-value ${colorClass}">${currentScore}</span>
                </div>

                <div class="credit-score-progress">
                    <div class="credit-score-progress-bar ${colorClass}" style="width: ${progress}%"></div>
                </div>

                <div class="credit-score-info">
                    <p class="credit-score-info-title">${tierLabel} Credit Score</p>
                    <p class="credit-score-info-text">${tierDescription}</p>
                </div>

                <div class="credit-score-limit">
                    <span class="credit-score-limit-label">Maximum Loan Amount</span>
                    <span class="credit-score-limit-value">$${maxLoanAmount.toLocaleString()}</span>
                </div>

                <div class="credit-score-breakdown">
                    <div class="credit-score-stat">
                        <div class="credit-score-stat-value total">${totalLoans}</div>
                        <div class="credit-score-stat-label">Total</div>
                    </div>
                    <div class="credit-score-stat">
                        <div class="credit-score-stat-value early">${earlyPayments}</div>
                        <div class="credit-score-stat-label">Early</div>
                    </div>
                    <div class="credit-score-stat">
                        <div class="credit-score-stat-value ontime">${onTimePayments}</div>
                        <div class="credit-score-stat-label">On-time</div>
                    </div>
                    <div class="credit-score-stat">
                        <div class="credit-score-stat-value late">${latePayments}</div>
                        <div class="credit-score-stat-label">Late</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render loading state
     * @returns {string} HTML string
     */
    renderLoadingState() {
        return `
            <div class="credit-score-card">
                <div class="credit-score-loading">
                    <div class="credit-score-spinner"></div>
                    <p class="credit-score-loading-text">Loading credit score...</p>
                </div>
            </div>
        `;
    }

    /**
     * Render error state
     * @param {string} errorMessage - Error message
     * @returns {string} HTML string
     */
    renderErrorState(errorMessage) {
        return `
            <div class="credit-score-card">
                <div class="credit-score-error">
                    ⚠️ ${errorMessage || 'Failed to load credit score. Please try again later.'}
                </div>
            </div>
        `;
    }

    /**
     * Render empty state (no credit history)
     * @returns {string} HTML string
     */
    renderEmptyState() {
        return `
            <div class="credit-score-card">
                <div class="credit-score-empty">
                    <div class="credit-score-empty-icon">📊</div>
                    <h4 class="credit-score-empty-title">No Credit History Yet</h4>
                    <p class="credit-score-empty-text">
                        Take your first loan to start building your credit reputation. 
                        Your score will be calculated based on your repayment behavior.
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Initialize credit score display in a container
     * @param {string} containerId - ID of the container element
     * @param {string} account - Account address
     */
    async initializeCreditScoreDisplay(containerId, account) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found`);
            return;
        }

        // Show loading state
        container.innerHTML = this.renderLoadingState();

        try {
            const scoreData = await this.fetchCreditScore(account);
            container.innerHTML = this.renderCreditScoreCard(scoreData);
        } catch (error) {
            container.innerHTML = this.renderErrorState(error.message);
        }
    }

    /**
     * Refresh credit score display
     * @param {string} containerId - ID of the container element
     */
    async refreshCreditScore(containerId) {
        if (!this.account) {
            console.error('No account set. Call initializeCreditScoreDisplay first.');
            return;
        }

        await this.initializeCreditScoreDisplay(containerId, this.account);
    }
}

// Export for use in other modules
export default CreditScoreManager;

// Also make it available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.CreditScoreManager = CreditScoreManager;
}
