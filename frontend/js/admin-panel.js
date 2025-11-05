/**
 * Admin Panel UI Manager
 * Handles the admin panel interface for token operations and KYC management
 */

class AdminPanelUI {
    constructor() {
        this.tokenAdminManager = null;
        this.currentGroveId = null;
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.holders = [];
        
        console.log('AdminPanelUI initialized');
    }

    /**
     * Initialize the admin panel with required dependencies
     * @param {TokenAdminManager} tokenAdminManager - Token admin manager instance
     */
    async initialize(tokenAdminManager) {
        if (!tokenAdminManager) {
            console.error('TokenAdminManager is required for AdminPanelUI');
            return;
        }
        
        this.tokenAdminManager = tokenAdminManager;
        
        // Check if user is admin
        const isAdmin = this.tokenAdminManager.isAdminUser();
        
        if (!isAdmin) {
            console.log('User is not an admin, hiding admin panel');
            this.hideAdminPanel();
            return;
        }
        
        console.log('User is admin, showing admin panel');
        this.showAdminPanel();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Listen for wallet connection to re-validate admin status
        window.addEventListener('wallet-connected', async (event) => {
            console.log('🔑 AdminPanelUI detected wallet connection, re-validating admin status...');
            const accountId = event.detail.accountId;
            if (this.tokenAdminManager && accountId) {
                await this.tokenAdminManager.validateAdminRole(accountId);
                this.initialize(this.tokenAdminManager); // Re-initialize to show/hide panel
            }
        });

        // Load groves for selection
        await this.loadGroves();
    }

    /**
     * Show the admin panel navigation button
     */
    showAdminPanel() {
        const adminNavBtn = document.getElementById('adminNavBtn');
        if (adminNavBtn) {
            adminNavBtn.classList.remove('hidden');
        }
    }

    /**
     * Hide the admin panel navigation button
     */
    hideAdminPanel() {
        const adminNavBtn = document.getElementById('adminNavBtn');
        if (adminNavBtn) {
            adminNavBtn.classList.add('hidden');
        }
    }

    /**
     * Set up event listeners for admin panel interactions
     */
    setupEventListeners() {
        // Token Operations Section
        const adminGroveSelect = document.getElementById('adminGroveSelect');
        if (adminGroveSelect) {
            adminGroveSelect.addEventListener('change', (e) => this.handleGroveSelection(e.target.value, 'operations'));
        }
        
        const mintForm = document.getElementById('mintTokensForm');
        if (mintForm) {
            mintForm.addEventListener('submit', (e) => this.handleMintTokens(e));
        }
        
        const burnForm = document.getElementById('burnTokensForm');
        if (burnForm) {
            burnForm.addEventListener('submit', (e) => this.handleBurnTokens(e));
        }
        
        // KYC Management Section
        const kycGroveSelect = document.getElementById('kycGroveSelect');
        if (kycGroveSelect) {
            kycGroveSelect.addEventListener('change', (e) => this.handleGroveSelection(e.target.value, 'kyc'));
        }
        
        const grantKYCForm = document.getElementById('grantKYCForm');
        if (grantKYCForm) {
            grantKYCForm.addEventListener('submit', (e) => this.handleGrantKYC(e));
        }
        
        // Token Holders Section
        const holdersGroveSelect = document.getElementById('holdersGroveSelect');
        if (holdersGroveSelect) {
            holdersGroveSelect.addEventListener('change', (e) => this.handleGroveSelection(e.target.value, 'holders'));
        }
        
        const exportBtn = document.getElementById('exportHoldersBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportHoldersToCSV());
        }
    }

    /**
     * Load available groves for selection
     */
    async loadGroves() {
        try {
            // Get all groves from the API
            const response = await window.coffeeAPI.getAvailableGroves();
            const groves = response.groves || [];
            
            // Populate all grove select dropdowns
            this.populateGroveSelects(groves);
            
        } catch (error) {
            console.error('Error loading groves:', error);
            this.showError('Failed to load groves');
        }
    }

    /**
     * Populate grove select dropdowns
     * @param {Array} groves - Array of grove objects
     */
    populateGroveSelects(groves) {
        const selects = [
            'adminGroveSelect',
            'kycGroveSelect',
            'holdersGroveSelect'
        ];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // Clear existing options except the first one
                select.innerHTML = '<option value="">Select a grove...</option>';
                
                // Add grove options
                groves.forEach(grove => {
                    const option = document.createElement('option');
                    option.value = grove.groveId;
                    option.textContent = `${grove.name} (${grove.groveId})`;
                    select.appendChild(option);
                });
            }
        });
    }

    /**
     * Handle grove selection
     * @param {string} groveId - Selected grove ID
     * @param {string} section - Section that triggered the selection ('operations', 'kyc', 'holders')
     */
    async handleGroveSelection(groveId, section) {
        if (!groveId) {
            this.hideSection(section);
            return;
        }
        
        this.currentGroveId = groveId;
        
        try {
            if (section === 'operations') {
                await this.loadTokenSupply(groveId);
                await this.loadOperationHistory(groveId);
            } else if (section === 'kyc') {
                await this.loadKYCAccounts(groveId);
            } else if (section === 'holders') {
                await this.loadTokenHolders(groveId);
            }
            
            this.showSection(section);
            
        } catch (error) {
            console.error(`Error loading ${section} data:`, error);
            this.showError(`Failed to load ${section} data`);
        }
    }

    /**
     * Show section content
     * @param {string} section - Section to show
     */
    showSection(section) {
        if (section === 'operations') {
            document.getElementById('tokenSupplyDisplay')?.classList.remove('hidden');
            document.getElementById('tokenSupplyDisplay').style.display = 'block';
            document.getElementById('tokenOperationsForms')?.classList.remove('hidden');
            document.getElementById('tokenOperationsForms').style.display = 'block';
            document.getElementById('tokenOperationHistory')?.classList.remove('hidden');
            document.getElementById('tokenOperationHistory').style.display = 'block';
        } else if (section === 'kyc') {
            document.getElementById('kycManagementInterface')?.classList.remove('hidden');
            document.getElementById('kycManagementInterface').style.display = 'block';
        } else if (section === 'holders') {
            document.getElementById('tokenHoldersDisplay')?.classList.remove('hidden');
            document.getElementById('tokenHoldersDisplay').style.display = 'block';
        }
    }

    /**
     * Hide section content
     * @param {string} section - Section to hide
     */
    hideSection(section) {
        if (section === 'operations') {
            document.getElementById('tokenSupplyDisplay').style.display = 'none';
            document.getElementById('tokenOperationsForms').style.display = 'none';
            document.getElementById('tokenOperationHistory').style.display = 'none';
        } else if (section === 'kyc') {
            document.getElementById('kycManagementInterface').style.display = 'none';
        } else if (section === 'holders') {
            document.getElementById('tokenHoldersDisplay').style.display = 'none';
        }
    }

    /**
     * Load token supply information
     * @param {string} groveId - Grove ID
     */
    async loadTokenSupply(groveId) {
        try {
            const supply = await this.tokenAdminManager.getTokenSupply(groveId);
            
            // Update UI
            document.getElementById('totalSupply').textContent = supply.totalSupply || '0';
            document.getElementById('circulatingSupply').textContent = supply.circulatingSupply || '0';
            document.getElementById('holderCount').textContent = supply.holderCount || '0';
            
        } catch (error) {
            console.error('Error loading token supply:', error);
            throw error;
        }
    }

    /**
     * Load operation history (placeholder for now)
     * @param {string} groveId - Grove ID
     */
    async loadOperationHistory(groveId) {
        // TODO: Implement operation history loading
        const historyList = document.getElementById('operationHistoryList');
        if (historyList) {
            historyList.innerHTML = '<p class="empty-state">No operation history available</p>';
        }
    }

    /**
     * Handle mint tokens form submission
     * @param {Event} e - Form submit event
     */
    async handleMintTokens(e) {
        e.preventDefault();
        
        const amount = parseInt(document.getElementById('mintAmount').value);
        
        if (!this.currentGroveId) {
            this.showError('Please select a grove first');
            return;
        }
        
        if (!amount || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }
        
        try {
            this.showLoading('Minting tokens...');
            
            const result = await this.tokenAdminManager.mintTokens(this.currentGroveId, amount);
            
            this.hideLoading();
            this.showSuccess(`Successfully minted ${amount} tokens`);
            
            // Refresh token supply
            await this.loadTokenSupply(this.currentGroveId);
            
            // Reset form
            e.target.reset();
            
        } catch (error) {
            this.hideLoading();
            console.error('Error minting tokens:', error);
            this.showError(`Failed to mint tokens: ${error.message}`);
        }
    }

    /**
     * Handle burn tokens form submission
     * @param {Event} e - Form submit event
     */
    async handleBurnTokens(e) {
        e.preventDefault();
        
        const amount = parseInt(document.getElementById('burnAmount').value);
        
        if (!this.currentGroveId) {
            this.showError('Please select a grove first');
            return;
        }
        
        if (!amount || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }
        
        // Confirm burn operation
        if (!confirm(`Are you sure you want to burn ${amount} tokens? This action cannot be undone.`)) {
            return;
        }
        
        try {
            this.showLoading('Burning tokens...');
            
            const result = await this.tokenAdminManager.burnTokens(this.currentGroveId, amount);
            
            this.hideLoading();
            this.showSuccess(`Successfully burned ${amount} tokens`);
            
            // Refresh token supply
            await this.loadTokenSupply(this.currentGroveId);
            
            // Reset form
            e.target.reset();
            
        } catch (error) {
            this.hideLoading();
            console.error('Error burning tokens:', error);
            this.showError(`Failed to burn tokens: ${error.message}`);
        }
    }

    /**
     * Load KYC accounts for a grove
     * @param {string} groveId - Grove ID
     */
    async loadKYCAccounts(groveId) {
        try {
            // Get token holders to show their KYC status
            const holders = await this.tokenAdminManager.getTokenHolders(groveId);
            
            const accountsList = document.getElementById('kycAccountsList');
            if (!accountsList) return;
            
            if (!holders || holders.length === 0) {
                accountsList.innerHTML = '<p class="empty-state">No token holders found</p>';
                return;
            }
            
            // Render accounts with KYC status
            accountsList.innerHTML = holders.map(holder => `
                <div class="kyc-account-item">
                    <div class="account-info">
                        <span class="account-address">${holder.address}</span>
                        <span class="account-balance">${holder.balance} tokens</span>
                    </div>
                    <div class="kyc-status">
                        <span class="status-badge ${holder.kycApproved ? 'approved' : 'pending'}">
                            ${holder.kycApproved ? '✓ KYC Approved' : '⏳ Pending KYC'}
                        </span>
                        ${holder.kycApproved ? 
                            `<button class="btn btn-danger btn-small" onclick="adminPanel.revokeKYC('${holder.address}')">Revoke KYC</button>` :
                            `<button class="btn btn-primary btn-small" onclick="adminPanel.grantKYCToHolder('${holder.address}')">Grant KYC</button>`
                        }
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading KYC accounts:', error);
            throw error;
        }
    }

    /**
     * Handle grant KYC form submission
     * @param {Event} e - Form submit event
     */
    async handleGrantKYC(e) {
        e.preventDefault();
        
        const accountAddress = document.getElementById('kycAccountAddress').value.trim();
        
        if (!this.currentGroveId) {
            this.showError('Please select a grove first');
            return;
        }
        
        if (!accountAddress) {
            this.showError('Please enter an account address');
            return;
        }
        
        try {
            this.showLoading('Granting KYC approval...');
            
            const result = await this.tokenAdminManager.grantKYC(this.currentGroveId, accountAddress);
            
            this.hideLoading();
            this.showSuccess(`Successfully granted KYC to ${accountAddress}`);
            
            // Refresh KYC accounts list
            await this.loadKYCAccounts(this.currentGroveId);
            
            // Reset form
            e.target.reset();
            
        } catch (error) {
            this.hideLoading();
            console.error('Error granting KYC:', error);
            this.showError(`Failed to grant KYC: ${error.message}`);
        }
    }

    /**
     * Grant KYC to a holder from the list
     * @param {string} accountAddress - Account address
     */
    async grantKYCToHolder(accountAddress) {
        if (!this.currentGroveId) {
            this.showError('Please select a grove first');
            return;
        }
        
        try {
            this.showLoading('Granting KYC approval...');
            
            await this.tokenAdminManager.grantKYC(this.currentGroveId, accountAddress);
            
            this.hideLoading();
            this.showSuccess(`Successfully granted KYC to ${accountAddress}`);
            
            // Refresh KYC accounts list
            await this.loadKYCAccounts(this.currentGroveId);
            
        } catch (error) {
            this.hideLoading();
            console.error('Error granting KYC:', error);
            this.showError(`Failed to grant KYC: ${error.message}`);
        }
    }

    /**
     * Revoke KYC from an account
     * @param {string} accountAddress - Account address
     */
    async revokeKYC(accountAddress) {
        if (!this.currentGroveId) {
            this.showError('Please select a grove first');
            return;
        }
        
        // Confirm revoke operation
        if (!confirm(`Are you sure you want to revoke KYC approval for ${accountAddress}?`)) {
            return;
        }
        
        try {
            this.showLoading('Revoking KYC approval...');
            
            await this.tokenAdminManager.revokeKYC(this.currentGroveId, accountAddress);
            
            this.hideLoading();
            this.showSuccess(`Successfully revoked KYC from ${accountAddress}`);
            
            // Refresh KYC accounts list
            await this.loadKYCAccounts(this.currentGroveId);
            
        } catch (error) {
            this.hideLoading();
            console.error('Error revoking KYC:', error);
            this.showError(`Failed to revoke KYC: ${error.message}`);
        }
    }

    /**
     * Load token holders for a grove
     * @param {string} groveId - Grove ID
     */
    async loadTokenHolders(groveId) {
        try {
            this.holders = await this.tokenAdminManager.getTokenHolders(groveId);
            this.currentPage = 1;
            this.renderTokenHolders();
            
        } catch (error) {
            console.error('Error loading token holders:', error);
            throw error;
        }
    }

    /**
     * Render token holders table with pagination
     */
    renderTokenHolders() {
        const tbody = document.getElementById('holdersTableBody');
        if (!tbody) return;
        
        if (!this.holders || this.holders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No token holders found</td></tr>';
            return;
        }
        
        // Calculate total supply for percentage
        const totalSupply = this.holders.reduce((sum, h) => sum + (h.balance || 0), 0);
        
        // Paginate holders
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        const pageHolders = this.holders.slice(startIdx, endIdx);
        
        // Render table rows
        tbody.innerHTML = pageHolders.map(holder => {
            const sharePercent = totalSupply > 0 ? ((holder.balance / totalSupply) * 100).toFixed(2) : '0.00';
            return `
                <tr>
                    <td>${holder.address}</td>
                    <td>${holder.balance || 0}</td>
                    <td>${sharePercent}%</td>
                    <td>
                        <span class="status-badge ${holder.kycApproved ? 'approved' : 'pending'}">
                            ${holder.kycApproved ? '✓ Approved' : '⏳ Pending'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Render pagination
        this.renderPagination();
    }

    /**
     * Render pagination controls
     */
    renderPagination() {
        const container = document.getElementById('holdersPagination');
        if (!container) return;
        
        const totalPages = Math.ceil(this.holders.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination">';
        
        // Previous button
        html += `<button class="btn btn-secondary btn-small" ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminPanel.goToPage(${this.currentPage - 1})">Previous</button>`;
        
        // Page numbers
        html += `<span class="page-info">Page ${this.currentPage} of ${totalPages}</span>`;
        
        // Next button
        html += `<button class="btn btn-secondary btn-small" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminPanel.goToPage(${this.currentPage + 1})">Next</button>`;
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Go to a specific page
     * @param {number} page - Page number
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.holders.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderTokenHolders();
    }

    /**
     * Export token holders to CSV
     */
    exportHoldersToCSV() {
        if (!this.holders || this.holders.length === 0) {
            this.showError('No holders to export');
            return;
        }
        
        // Calculate total supply for percentage
        const totalSupply = this.holders.reduce((sum, h) => sum + (h.balance || 0), 0);
        
        // Create CSV content
        let csv = 'Account Address,Token Balance,Share %,KYC Status\n';
        
        this.holders.forEach(holder => {
            const sharePercent = totalSupply > 0 ? ((holder.balance / totalSupply) * 100).toFixed(2) : '0.00';
            const kycStatus = holder.kycApproved ? 'Approved' : 'Pending';
            csv += `${holder.address},${holder.balance},${sharePercent}%,${kycStatus}\n`;
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `token-holders-${this.currentGroveId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showSuccess('Holders exported to CSV');
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.querySelector('.loading-text');
        if (overlay) {
            if (text) text.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type ('success', 'error', 'info')
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 5000);
    }
}

// Create global instance
window.adminPanel = new AdminPanelUI();
