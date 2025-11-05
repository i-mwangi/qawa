/**
 * Farmer Revenue Tracking Component
 * Displays the 4 key metrics and grove-specific withdrawal interface
 */

class FarmerRevenueTracking {
    constructor() {
        this.selectedGroveId = null;
        this.groveBalances = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Grove selector change
        const groveSelector = document.getElementById('revenueGroveSelector');
        if (groveSelector) {
            groveSelector.addEventListener('change', (e) => {
                this.handleGroveSelection(e.target.value);
            });
        }

        // Withdrawal form
        const withdrawalForm = document.getElementById('groveWithdrawalForm');
        if (withdrawalForm) {
            withdrawalForm.addEventListener('submit', (e) => {
                this.handleWithdrawalSubmit(e);
            });
        }
    }

    /**
     * Load and display revenue data for a farmer
     */
    async loadRevenueData(farmerAddress) {
        console.log('[Revenue Tracking] Loading data for farmer:', farmerAddress);
        
        try {
            // Show loading state
            this.showLoadingState();

            // Fetch all grove balances
            console.log('[Revenue Tracking] Fetching grove balances...');
            const response = await window.coffeeAPI.getAllFarmerGroveBalances(farmerAddress);
            console.log('[Revenue Tracking] Response:', response);

            // Load withdrawal and transaction history in parallel
            this.loadWithdrawalHistory(farmerAddress);
            this.loadTransactionHistory(farmerAddress);

            if (response.success && response.data) {
                this.groveBalances = response.data.groves || [];
                console.log('[Revenue Tracking] Grove balances:', this.groveBalances);
                
                this.renderRevenueMetrics();
                this.populateGroveSelector();
                
                console.log('[Revenue Tracking] Data loaded successfully');
            } else {
                console.error('[Revenue Tracking] Failed response:', response);
                this.showError('Failed to load revenue data');
            }
        } catch (error) {
            console.error('[Revenue Tracking] Error loading revenue data:', error);
            this.showError(`Error loading revenue data: ${error.message}`);
        }
    }

    /**
     * Render the 4 key revenue metrics
     */
    renderRevenueMetrics() {
        // Calculate totals across all groves
        const totals = this.groveBalances.reduce((acc, grove) => {
            return {
                thisMonthDistributed: acc.thisMonthDistributed + (grove.thisMonthDistributed || 0),
                availableBalance: acc.availableBalance + (grove.availableBalance || 0),
                pendingDistribution: acc.pendingDistribution + (grove.pendingDistribution || 0),
                totalWithdrawn: acc.totalWithdrawn + (grove.totalWithdrawn || 0)
            };
        }, {
            thisMonthDistributed: 0,
            availableBalance: 0,
            pendingDistribution: 0,
            totalWithdrawn: 0
        });

        // Update metric cards
        this.updateMetricCard('thisMonthDistributed', totals.thisMonthDistributed);
        this.updateMetricCard('availableBalance', totals.availableBalance);
        this.updateMetricCard('pendingDistribution', totals.pendingDistribution);
        this.updateMetricCard('totalWithdrawn', totals.totalWithdrawn);
    }

    /**
     * Update a single metric card
     */
    updateMetricCard(metricId, value) {
        const element = document.getElementById(metricId);
        if (element) {
            // Convert from cents to dollars
            const displayValue = (value / 100).toFixed(2);
            element.textContent = `$${displayValue}`;
        }
    }

    /**
     * Populate grove selector dropdown
     */
    populateGroveSelector() {
        const selector = document.getElementById('revenueGroveSelector');
        if (!selector) return;

        selector.innerHTML = '<option value="">Select a grove</option>' +
            this.groveBalances.map(grove => `
                <option value="${grove.groveId}">
                    ${grove.groveName || `Grove #${grove.groveId}`} - 
                    Available: $${(grove.availableBalance / 100).toFixed(2)}
                </option>
            `).join('');
    }

    /**
     * Handle grove selection
     */
    async handleGroveSelection(groveId) {
        if (!groveId) {
            this.selectedGroveId = null;
            this.clearWithdrawalForm();
            return;
        }

        this.selectedGroveId = parseInt(groveId);
        const grove = this.groveBalances.find(g => g.groveId === this.selectedGroveId);

        if (grove) {
            this.displayGroveWithdrawalInfo(grove);
        }
    }

    /**
     * Display withdrawal information for selected grove
     */
    displayGroveWithdrawalInfo(grove) {
        const maxWithdrawable = grove.availableBalance;
        const maxWithdrawableDisplay = (maxWithdrawable / 100).toFixed(2);

        // Update max withdrawable display
        const maxWithdrawableEl = document.getElementById('maxWithdrawableAmount');
        if (maxWithdrawableEl) {
            maxWithdrawableEl.textContent = `$${maxWithdrawableDisplay}`;
        }

        // Update withdrawal amount input max
        const withdrawalAmountInput = document.getElementById('groveWithdrawalAmount');
        if (withdrawalAmountInput) {
            withdrawalAmountInput.max = maxWithdrawableDisplay;
            withdrawalAmountInput.value = maxWithdrawableDisplay; // Default to full amount
        }

        // Show withdrawal form
        const withdrawalSection = document.getElementById('groveWithdrawalSection');
        if (withdrawalSection) {
            withdrawalSection.style.display = 'block';
        }
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
                            <li>Come back and try withdrawal again!</li>
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

    /**
     * Clear withdrawal form
     */
    clearWithdrawalForm() {
        const withdrawalSection = document.getElementById('groveWithdrawalSection');
        if (withdrawalSection) {
            withdrawalSection.style.display = 'none';
        }

        const withdrawalAmountInput = document.getElementById('groveWithdrawalAmount');
        if (withdrawalAmountInput) {
            withdrawalAmountInput.value = '';
        }
    }

    /**
     * Handle withdrawal form submission
     */
    async handleWithdrawalSubmit(e) {
        e.preventDefault();

        if (!this.selectedGroveId) {
            this.showNotification('Please select a grove', 'error');
            return;
        }

        const farmerAddress = window.walletManager?.getAccountId();
        if (!farmerAddress) {
            this.showNotification('Please connect your wallet', 'error');
            return;
        }

        const grove = this.groveBalances.find(g => g.groveId === this.selectedGroveId);
        if (!grove) {
            this.showNotification('Grove not found', 'error');
            return;
        }

        // Get full available balance (full amount withdrawal)
        const amount = grove.availableBalance / 100; // Convert to dollars

        if (amount <= 0) {
            this.showNotification('No balance available for withdrawal', 'error');
            return;
        }

        try {
            // Show loading
            this.showNotification('Processing withdrawal...', 'info');

            // Process withdrawal
            const response = await window.coffeeAPI.processFarmerWithdrawal(
                farmerAddress,
                this.selectedGroveId,
                amount
            );

            if (response.success) {
                // Show success with transaction details
                const message = response.data?.blockExplorerUrl 
                    ? `Withdrawal successful! <a href="${response.data.blockExplorerUrl}" target="_blank">View on HashScan</a>`
                    : 'Withdrawal successful!';
                this.showNotification(message, 'success');
                
                // Reload revenue data
                await this.loadRevenueData(farmerAddress);
                
                // Clear form
                this.clearWithdrawalForm();
                
                // Reset selector
                const selector = document.getElementById('revenueGroveSelector');
                if (selector) {
                    selector.value = '';
                }
            } else {
                // Check if error is about token association
                const errorMsg = response.error || 'Withdrawal failed';
                if (errorMsg.includes('associate') || errorMsg.includes('USDC token')) {
                    this.showTokenAssociationModal(errorMsg);
                } else {
                    this.showNotification(errorMsg, 'error');
                }
            }
        } catch (error) {
            console.error('Error processing withdrawal:', error);
            
            // Check if error is about token association
            const errorMsg = error.message || 'Error processing withdrawal';
            if (errorMsg.includes('associate') || errorMsg.includes('USDC token')) {
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
        // Just update the metric values to show loading
        this.updateMetricCard('thisMonthDistributed', 0);
        this.updateMetricCard('availableBalance', 0);
        this.updateMetricCard('pendingDistribution', 0);
        this.updateMetricCard('totalWithdrawn', 0);
        
        // Clear grove selector
        const selector = document.getElementById('revenueGroveSelector');
        if (selector) {
            selector.innerHTML = '<option value="">Loading...</option>';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Show error in a notification instead of replacing the container
        this.showNotification(message, 'error');
        
        // Reset to zero values
        this.updateMetricCard('thisMonthDistributed', 0);
        this.updateMetricCard('availableBalance', 0);
        this.updateMetricCard('pendingDistribution', 0);
        this.updateMetricCard('totalWithdrawn', 0);
        
        // Clear grove selector
        const selector = document.getElementById('revenueGroveSelector');
        if (selector) {
            selector.innerHTML = '<option value="">No groves available</option>';
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
     * Load and display withdrawal history
     */
    async loadWithdrawalHistory(farmerAddress) {
        try {
            const response = await fetch(`/api/farmer/withdrawals/${farmerAddress}`);
            const result = await response.json();
            
            if (!result.success) {
                console.error('Failed to load withdrawal history:', result.error);
                return;
            }
            
            this.displayWithdrawalHistory(result.data);
        } catch (error) {
            console.error('Error loading withdrawal history:', error);
        }
    }

    /**
     * Display withdrawal history
     */
    displayWithdrawalHistory(withdrawals) {
        const container = document.getElementById('withdrawalHistoryList');
        if (!container) return;
        
        if (!withdrawals || withdrawals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No withdrawals yet</p>
                    <small>Your withdrawal history will appear here</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = withdrawals.map(w => `
            <div class="withdrawal-item">
                <div class="withdrawal-header">
                    <span class="withdrawal-date">${new Date(w.requestedAt).toLocaleString()}</span>
                    <span class="withdrawal-status status-${w.status}">${w.status}</span>
                </div>
                <div class="withdrawal-details">
                    <div class="withdrawal-amount">$${w.amount.toFixed(2)}</div>
                    ${w.blockExplorerUrl ? `
                        <a href="${w.blockExplorerUrl}" target="_blank" class="blockchain-link">
                            View on HashScan 🔗
                        </a>
                    ` : ''}
                </div>
                ${w.errorMessage ? `<div class="withdrawal-error">${w.errorMessage}</div>` : ''}
            </div>
        `).join('');
    }

    /**
     * Load and display complete transaction history
     */
    async loadTransactionHistory(farmerAddress) {
        try {
            const response = await fetch(`/api/farmer/transactions/${farmerAddress}`);
            const result = await response.json();
            
            if (!result.success) {
                console.error('Failed to load transaction history:', result.error);
                return;
            }
            
            this.displayTransactionHistory(result.data);
        } catch (error) {
            console.error('Error loading transaction history:', error);
        }
    }

    /**
     * Display transaction history
     */
    displayTransactionHistory(transactions) {
        console.log('[Transaction History] Displaying transactions:', transactions);
        const container = document.getElementById('farmerTransactionsList');
        console.log('[Transaction History] Container found:', !!container);
        if (!container) {
            console.error('[Transaction History] Container #farmerTransactionsList not found');
            return;
        }
        
        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No transactions found</p>
                    <small>Your transaction history will appear here</small>
                </div>
            `;
            return;
        }
        
        // Update stats
        const totalTransactions = transactions.length;
        const completedTransactions = transactions.filter(t => 
            t.status === 'completed' || t.status === 'distributed'
        ).length;
        const pendingTransactions = transactions.filter(t => 
            t.status === 'pending' || t.status === 'unclaimed'
        ).length;
        
        document.getElementById('farmerTotalTransactions').textContent = totalTransactions;
        document.getElementById('farmerCompletedTransactions').textContent = completedTransactions;
        document.getElementById('farmerPendingTransactions').textContent = pendingTransactions;
        
        // Display transactions
        console.log('[Transaction History] Generating HTML for', transactions.length, 'transactions');
        const html = transactions.map(t => {
            const isPositive = t.amount > 0;
            const typeIcon = t.type === 'earning' ? '💰' : '💸';
            const typeLabel = t.type === 'earning' ? 'Harvest Earnings' : 'Withdrawal';
            const amountClass = isPositive ? 'amount-positive' : 'amount-negative';
            
            return `
                <div class="transaction-item">
                    <div class="transaction-icon">${typeIcon}</div>
                    <div class="transaction-details">
                        <div class="transaction-header">
                            <span class="transaction-type">${typeLabel}</span>
                            <span class="transaction-amount ${amountClass}">
                                ${isPositive ? '+' : ''}$${Math.abs(t.amount).toFixed(2)}
                            </span>
                        </div>
                        <div class="transaction-meta">
                            <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                            <span class="transaction-grove">${t.groveName}</span>
                            <span class="transaction-status status-${t.status}">${t.status}</span>
                        </div>
                        ${t.blockExplorerUrl ? `
                            <a href="${t.blockExplorerUrl}" target="_blank" class="blockchain-link">
                                View on HashScan 🔗
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('[Transaction History] Setting innerHTML, length:', html.length);
        container.innerHTML = html;
        console.log('[Transaction History] HTML set, container children:', container.children.length);
    }

}

// Create global instance
window.farmerRevenueTracking = new FarmerRevenueTracking();
