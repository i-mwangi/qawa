/**
 * Investor Earnings Component
 * Displays earnings breakdown and claim interface
 */

class InvestorEarnings {
    constructor() {
        this.unclaimedEarnings = null;
        this.balance = null;
        this.selectedEarnings = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Claim form
        const claimForm = document.getElementById('investorClaimForm');
        if (claimForm) {
            claimForm.addEventListener('submit', (e) => {
                this.handleClaimSubmit(e);
            });
        }

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllEarnings');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // Withdrawal form
        const withdrawalForm = document.getElementById('investorWithdrawalForm');
        if (withdrawalForm) {
            withdrawalForm.addEventListener('submit', (e) => {
                this.handleWithdrawalSubmit(e);
            });
        }

        // Max withdrawal button
        const maxWithdrawalBtn = document.getElementById('maxWithdrawalBtn');
        if (maxWithdrawalBtn) {
            maxWithdrawalBtn.addEventListener('click', () => {
                this.setMaxWithdrawalAmount();
            });
        }
    }

    /**
     * Render cached data without fetching
     */
    renderCachedData(cachedData) {
        if (cachedData.balance) {
            this.balance = cachedData.balance;
        }
        if (cachedData.earnings) {
            this.unclaimedEarnings = cachedData.earnings;
        }
        this.renderEarningsBreakdown();
        this.renderBalanceSummary();
    }

    /**
     * Load and display earnings data for an investor
     */
    async loadEarningsData(investorAddress) {
        console.log('[Investor Earnings] Loading data for:', investorAddress);
        
        try {
            // Show loading state
            this.showLoadingState();

            // Fetch balance, earnings, and withdrawal history in parallel with timeout
            console.log('[Investor Earnings] Fetching balance, earnings, and withdrawal history...');
            const [balanceResponse, earningsResponse, withdrawalHistoryResponse] = await Promise.race([
                Promise.all([
                    window.coffeeAPI.getInvestorBalance(investorAddress),
                    window.coffeeAPI.getInvestorUnclaimedEarnings(investorAddress),
                    window.coffeeAPI.getInvestorWithdrawalHistory(investorAddress)
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
            ]);
            
            console.log('[Investor Earnings] Balance response:', balanceResponse);
            console.log('[Investor Earnings] Earnings response:', earningsResponse);
            console.log('[Investor Earnings] Withdrawal history response:', withdrawalHistoryResponse);

            if (balanceResponse && balanceResponse.success) {
                this.balance = balanceResponse.balance || balanceResponse.data;
                console.log('[Investor Earnings] Balance data:', this.balance);
            } else {
                console.warn('[Investor Earnings] Balance request failed:', balanceResponse);
                // Set default balance with $0
                this.balance = {
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    availableBalance: 0,
                    totalEarningsThisMonth: 0,
                    totalClaimed: 0,
                    unclaimedPrimaryMarket: 0,
                    unclaimedSecondaryMarket: 0,
                    unclaimedLpInterest: 0,
                    totalUnclaimed: 0
                };
            }

            if (earningsResponse && earningsResponse.success) {
                this.unclaimedEarnings = earningsResponse.data || [];
                console.log('[Investor Earnings] Unclaimed earnings:', this.unclaimedEarnings);
            } else {
                console.warn('[Investor Earnings] Earnings request failed:', earningsResponse);
                this.unclaimedEarnings = [];
            }

            if (withdrawalHistoryResponse && withdrawalHistoryResponse.success) {
                this.withdrawalHistory = withdrawalHistoryResponse.withdrawals || [];
                console.log('[Investor Earnings] Withdrawal history:', this.withdrawalHistory);
            } else {
                console.warn('[Investor Earnings] Withdrawal history request failed:', withdrawalHistoryResponse);
                this.withdrawalHistory = [];
            }
            
            this.renderBalanceSummary();
            this.renderEarningsSummary();
            this.renderUnclaimedEarnings();
            this.renderWithdrawalHistory();
            this.hideLoadingState();
            
            console.log('[Investor Earnings] Data loaded successfully');

        } catch (error) {
            console.error('[Investor Earnings] Error loading earnings data:', error);
            // Show $0 balances instead of error
            this.balance = {
                totalEarned: 0,
                totalWithdrawn: 0,
                availableBalance: 0,
                totalEarningsThisMonth: 0,
                totalClaimed: 0,
                unclaimedPrimaryMarket: 0,
                unclaimedSecondaryMarket: 0,
                unclaimedLpInterest: 0,
                totalUnclaimed: 0
            };
            this.unclaimedEarnings = [];
            this.withdrawalHistory = [];
            this.renderBalanceSummary();
            this.renderEarningsSummary();
            this.renderUnclaimedEarnings();
            this.renderWithdrawalHistory();
            this.hideLoadingState();
        }
    }

    /**
     * Render balance summary (Total Earned, Withdrawn, Available)
     */
    renderBalanceSummary() {
        if (!this.balance) return;

        // Update balance cards
        this.updateSummaryCard('totalEarned', this.balance.totalEarned || 0);
        this.updateSummaryCard('totalWithdrawn', this.balance.totalWithdrawn || 0);
        this.updateSummaryCard('availableBalance', this.balance.availableBalance || 0);
        
        // Update available balance help text
        const availableBalanceHelp = document.getElementById('availableBalanceHelp');
        if (availableBalanceHelp) {
            const displayValue = ((this.balance.availableBalance || 0) / 100).toFixed(2);
            availableBalanceHelp.textContent = `$${displayValue}`;
        }
    }

    /**
     * Render earnings summary (My Earnings section)
     */
    renderEarningsSummary() {
        if (!this.balance) return;

        // Update total earnings this month
        this.updateSummaryCard('totalEarningsThisMonth', this.balance.totalEarningsThisMonth || 0);
        
        // Update claimed earnings
        this.updateSummaryCard('totalClaimed', this.balance.totalClaimed || 0);
        
        // Update unclaimed breakdown
        this.updateSummaryCard('unclaimedPrimaryMarket', this.balance.unclaimedPrimaryMarket || 0);
        this.updateSummaryCard('unclaimedSecondaryMarket', this.balance.unclaimedSecondaryMarket || 0);
        this.updateSummaryCard('unclaimedLpInterest', this.balance.unclaimedLpInterest || 0);
        this.updateSummaryCard('totalUnclaimed', this.balance.totalUnclaimed || 0);
    }

    /**
     * Update a summary card
     */
    updateSummaryCard(cardId, value) {
        const element = document.getElementById(cardId);
        if (element) {
            // Convert from cents to dollars
            const displayValue = (value / 100).toFixed(2);
            element.textContent = `$${displayValue}`;
        }
    }

    /**
     * Render unclaimed earnings list
     */
    renderUnclaimedEarnings() {
        if (!this.unclaimedEarnings) return;

        const container = document.getElementById('unclaimedEarningsList');
        if (!container) return;

        const earnings = this.unclaimedEarnings.all || [];

        if (earnings.length === 0) {
            container.innerHTML = '<p class="empty-state">No unclaimed earnings available</p>';
            return;
        }

        container.innerHTML = earnings.map(earning => {
            const amount = (earning.earningAmount / 100).toFixed(2);
            const date = earning.distributedAt ? new Date(earning.distributedAt).toLocaleDateString() : 'N/A';
            const typeLabel = this.getEarningTypeLabel(earning.earningType);
            const typeClass = this.getEarningTypeClass(earning.earningType);

            return `
                <div class="earning-item">
                    <div class="earning-checkbox">
                        <input type="checkbox" 
                               class="earning-select" 
                               data-earning-id="${earning.id}"
                               data-amount="${earning.earningAmount}">
                    </div>
                    <div class="earning-details">
                        <div class="earning-header">
                            <span class="earning-type ${typeClass}">${typeLabel}</span>
                            <span class="earning-amount">$${amount}</span>
                        </div>
                        <div class="earning-info">
                            ${earning.groveId ? `<span>Grove #${earning.groveId}</span>` : ''}
                            <span>Distributed: ${date}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to checkboxes
        container.querySelectorAll('.earning-select').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleEarningSelection(e.target);
            });
        });

        // Update claim button state
        this.updateClaimButton();
    }

    /**
     * Get earning type label
     */
    getEarningTypeLabel(type) {
        const labels = {
            'primary_market': 'Primary Market',
            'secondary_market': 'Secondary Market',
            'lp_interest': 'LP Interest'
        };
        return labels[type] || type;
    }

    /**
     * Get earning type CSS class
     */
    getEarningTypeClass(type) {
        const classes = {
            'primary_market': 'type-primary',
            'secondary_market': 'type-secondary',
            'lp_interest': 'type-lp'
        };
        return classes[type] || '';
    }

    /**
     * Handle earning selection
     */
    handleEarningSelection(checkbox) {
        const earningId = parseInt(checkbox.dataset.earningId);
        const amount = parseInt(checkbox.dataset.amount);

        if (checkbox.checked) {
            this.selectedEarnings.push({ id: earningId, amount });
        } else {
            this.selectedEarnings = this.selectedEarnings.filter(e => e.id !== earningId);
        }

        this.updateClaimButton();
    }

    /**
     * Handle select all
     */
    handleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.earning-select');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.handleEarningSelection(checkbox);
        });
    }

    /**
     * Update claim button state
     */
    updateClaimButton() {
        const claimButton = document.getElementById('claimEarningsBtn');
        const selectedAmountEl = document.getElementById('selectedClaimAmount');

        if (!claimButton) return;

        const totalSelected = this.selectedEarnings.reduce((sum, e) => sum + e.amount, 0);
        const displayAmount = (totalSelected / 100).toFixed(2);

        if (selectedAmountEl) {
            selectedAmountEl.textContent = `$${displayAmount}`;
        }

        claimButton.disabled = this.selectedEarnings.length === 0;
        claimButton.textContent = this.selectedEarnings.length > 0 
            ? `Claim $${displayAmount}` 
            : 'Select earnings to claim';
    }

    /**
     * Handle claim form submission
     */
    async handleClaimSubmit(e) {
        e.preventDefault();

        if (this.selectedEarnings.length === 0) {
            this.showNotification('Please select earnings to claim', 'error');
            return;
        }

        const investorAddress = window.walletManager?.getAccountId();
        if (!investorAddress) {
            this.showNotification('Please connect your wallet', 'error');
            return;
        }

        const earningIds = this.selectedEarnings.map(e => e.id);
        const totalAmount = this.selectedEarnings.reduce((sum, e) => sum + e.amount, 0) / 100; // Convert to dollars

        try {
            // Show loading
            this.showNotification('Processing claim...', 'info');

            // Process claim
            const response = await window.coffeeAPI.processInvestorClaim(
                investorAddress,
                earningIds,
                totalAmount
            );

            if (response.success) {
                this.showNotification('Claim successful!', 'success');
                
                // Clear selections
                this.selectedEarnings = [];
                
                // Reload earnings data
                await this.loadEarningsData(investorAddress);
            } else {
                const errorMsg = response.error || 'Claim failed';
                // Check if error is about token association or Hedera transaction
                if (errorMsg.includes('associate') || errorMsg.includes('USDC token') || errorMsg.includes('Hedera transaction')) {
                    this.showTokenAssociationModal(errorMsg);
                } else {
                    this.showNotification(errorMsg, 'error');
                }
            }
        } catch (error) {
            console.error('Error processing claim:', error);
            const errorMsg = error.message || 'Error processing claim';
            // Check if error is about token association or Hedera transaction
            if (errorMsg.includes('associate') || errorMsg.includes('USDC token') || errorMsg.includes('Hedera transaction')) {
                this.showTokenAssociationModal(errorMsg);
            } else {
                this.showNotification(errorMsg, 'error');
            }
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        // Add loading overlay instead of replacing content
        const summaryContainer = document.getElementById('earningsSummaryContainer');
        if (summaryContainer && !summaryContainer.querySelector('.loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
            overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;z-index:10;';
            summaryContainer.style.position = 'relative';
            summaryContainer.appendChild(overlay);
        }

        const listContainer = document.getElementById('unclaimedEarningsList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="loading-spinner"></div>';
        }
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        // Remove loading overlay
        const summaryContainer = document.getElementById('earningsSummaryContainer');
        if (summaryContainer) {
            const overlay = summaryContainer.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const summaryContainer = document.getElementById('earningsSummaryContainer');
        if (summaryContainer) {
            summaryContainer.innerHTML = `<p class="error-message">${message}</p>`;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.notificationManager) {
            switch (type) {
                case 'success': window.notificationManager.success(message); break;
                case 'error': window.notificationManager.error(message); break;
                case 'warning': window.notificationManager.warning(message); break;
                default: window.notificationManager.info(message); break;
            }
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Set max withdrawal amount
     */
    setMaxWithdrawalAmount() {
        const withdrawalInput = document.getElementById('withdrawalAmount');
        if (withdrawalInput && this.balance) {
            const maxAmount = ((this.balance.availableBalance || 0) / 100).toFixed(2);
            withdrawalInput.value = maxAmount;
        }
    }

    /**
     * Handle withdrawal form submission
     */
    async handleWithdrawalSubmit(e) {
        e.preventDefault();

        const investorAddress = window.walletManager?.getAccountId();
        if (!investorAddress) {
            this.showNotification('Please connect your wallet', 'error');
            return;
        }

        const withdrawalInput = document.getElementById('withdrawalAmount');
        const amount = parseFloat(withdrawalInput.value);

        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }

        const availableBalance = (this.balance?.availableBalance || 0) / 100;
        if (amount > availableBalance) {
            this.showNotification(`Amount exceeds available balance ($${availableBalance.toFixed(2)})`, 'error');
            return;
        }

        try {
            // Show loading
            const form = document.getElementById('investorWithdrawalForm');
            if (form) {
                form.classList.add('loading');
            }
            this.showNotification('Processing withdrawal...', 'info');

            // Convert to cents for API
            const amountInCents = Math.round(amount * 100);

            // Process withdrawal
            const response = await window.coffeeAPI.processInvestorWithdrawal(
                investorAddress,
                amountInCents
            );

            if (form) {
                form.classList.remove('loading');
            }

            if (response.success) {
                this.showNotification(`Successfully withdrew $${amount.toFixed(2)}!`, 'success');
                
                // Clear form
                withdrawalInput.value = '';
                
                // Reload data
                await this.loadEarningsData(investorAddress);
            } else {
                const errorMsg = response.error || 'Withdrawal failed';
                // Check if error is about token association
                if (errorMsg.includes('associate') || errorMsg.includes('USDC token') || errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                    this.showTokenAssociationModal(errorMsg);
                } else {
                    this.showNotification(errorMsg, 'error');
                }
            }
        } catch (error) {
            const form = document.getElementById('investorWithdrawalForm');
            if (form) {
                form.classList.remove('loading');
            }
            
            console.error('Error processing withdrawal:', error);
            const errorMsg = error.message || 'Error processing withdrawal';
            
            // Check if error is about token association
            if (errorMsg.includes('associate') || errorMsg.includes('USDC token') || errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                this.showTokenAssociationModal(errorMsg);
            } else {
                this.showNotification(errorMsg, 'error');
            }
        }
    }

    /**
     * Render withdrawal history
     */
    renderWithdrawalHistory() {
        const container = document.getElementById('withdrawalHistoryList');
        if (!container) return;

        if (!this.withdrawalHistory || this.withdrawalHistory.length === 0) {
            container.innerHTML = '<p class="empty-state">No withdrawals yet</p>';
            return;
        }

        container.innerHTML = this.withdrawalHistory.map(withdrawal => {
            const amount = (withdrawal.amount / 100).toFixed(2);
            const date = new Date(withdrawal.requestedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const status = withdrawal.status || 'pending';
            const txHash = withdrawal.transactionHash || withdrawal.transactionId;
            const hashscanUrl = txHash ? `https://hashscan.io/testnet/transaction/${txHash}` : null;

            return `
                <div class="withdrawal-item">
                    <div class="withdrawal-header">
                        <span class="withdrawal-amount">$${amount}</span>
                        <span class="withdrawal-status ${status}">${status}</span>
                    </div>
                    <div class="withdrawal-details">
                        <span class="withdrawal-date">${date}</span>
                        ${hashscanUrl ? `
                            <a href="${hashscanUrl}" target="_blank" rel="noopener noreferrer" class="withdrawal-tx-link">
                                View on HashScan
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </a>
                        ` : ''}
                        ${withdrawal.errorMessage ? `
                            <span style="color: #f44336; font-size: 0.8rem;">Error: ${withdrawal.errorMessage}</span>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Show token association instructions modal
     */
    showTokenAssociationModal(errorMessage) {
        // Extract token ID from error message
        const tokenIdMatch = errorMessage.match(/0\.0\.\d+/);
        const tokenId = tokenIdMatch ? tokenIdMatch[0] : '0.0.7144320';
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay" id="tokenAssociationModal" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: #1f2937;
                    padding: 30px;
                    border-radius: 12px;
                    max-width: 500px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    color: #f3f4f6;
                ">
                    <h2 style="margin-top: 0; color: #fbbf24;">⚠️ Token Association Required</h2>
                    
                    <p style="margin: 20px 0; color: #d1d5db;">
                        Before you can receive USDC payments, you need to associate the USDC token with your HashPack wallet.
                        This is a one-time setup that costs about $0.05 in HBAR.
                    </p>
                    
                    <div style="background: #374151; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <strong style="color: #f9fafb;">Token ID:</strong>
                        <div style="
                            font-family: monospace;
                            font-size: 18px;
                            color: #10b981;
                            margin: 10px 0;
                            padding: 10px;
                            background: #111827;
                            border-radius: 4px;
                            border: 2px solid #10b981;
                            text-align: center;
                            cursor: pointer;
                        " onclick="navigator.clipboard.writeText('${tokenId}'); this.innerHTML='✅ Copied!';" title="Click to copy">
                            ${tokenId}
                        </div>
                        <small style="color: #9ca3af;">Click to copy</small>
                    </div>
                    
                    <div style="background: #1e3a5f; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <h3 style="margin-top: 0; font-size: 16px; color: #93c5fd;">📱 Steps to Associate:</h3>
                        <ol style="margin: 10px 0; padding-left: 20px; color: #d1d5db;">
                            <li>Open your <strong style="color: #f3f4f6;">HashPack wallet</strong></li>
                            <li>Go to <strong style="color: #f3f4f6;">Tokens</strong> tab</li>
                            <li>Click <strong style="color: #f3f4f6;">"Manage Tokens"</strong> or <strong style="color: #f3f4f6;">"+ Add Token"</strong></li>
                            <li>Enter token ID: <strong style="color: #10b981;">${tokenId}</strong></li>
                            <li>Click <strong style="color: #f3f4f6;">"Associate"</strong></li>
                            <li>Approve the transaction (~$0.05 HBAR)</li>
                            <li>Come back and try withdrawing again!</li>
                        </ol>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: right;">
                        <button onclick="document.getElementById('tokenAssociationModal').remove()" style="
                            background: #10b981;
                            color: #111827;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 6px;
                            font-size: 16px;
                            cursor: pointer;
                            font-weight: 600;
                        " onmouseover="this.style.background='#34d399'" onmouseout="this.style.background='#10b981'">
                            Got it!
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('tokenAssociationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Close on overlay click
        document.getElementById('tokenAssociationModal').addEventListener('click', (e) => {
            if (e.target.id === 'tokenAssociationModal') {
                e.target.remove();
            }
        });
    }

}

// Create global instance
window.investorEarnings = new InvestorEarnings();

// Add debug logging when the class is instantiated
console.log('[Investor Earnings] Class loaded and ready');
