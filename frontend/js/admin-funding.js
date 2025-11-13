/**
 * Admin Funding Request Management
 * Handles the admin interface for reviewing and processing funding requests
 */

// API base URL - use API server if available, otherwise relative paths
const API_BASE = window.location.port === '3001' ? '' : 'http://localhost:3001';

window.adminFunding = {
    currentRequestId: null,
    walletManager: null,

    init(walletManager) {
        this.walletManager = walletManager;
        this.loadDashboardData();
    },

    async loadDashboardData() {
        if (!this.walletManager) return;

        const accountId = this.walletManager.getAccountId();
        if (!accountId) return;

        try {
            // Load pending requests count
            const pendingResponse = await fetch(`${API_BASE}/admin/funding/pending`, {
                headers: { 'x-account-id': accountId }
            });

            if (pendingResponse.ok) {
                const pendingData = await pendingResponse.json();
                const count = pendingData.requests?.length || 0;
                const countEl = document.getElementById('adminPendingCount');
                if (countEl) countEl.textContent = count;
            }

            // Load platform fees
            const feesResponse = await fetch(`${API_BASE}/admin/funding/fees`, {
                headers: { 'x-account-id': accountId }
            });

            if (feesResponse.ok) {
                const feesData = await feesResponse.json();
                const totalFees = feesData.summary?.totalFees || 0;
                const feesEl = document.getElementById('adminPlatformFees');
                if (feesEl) feesEl.textContent = `$${totalFees.toFixed(2)}`;
            }

            // Load pending requests list
            await this.loadPendingRequests();
        } catch (error) {
            console.error('[AdminFunding] Error loading dashboard data:', error);
        }
    },

    async loadPendingRequests() {
        const container = document.getElementById('adminPendingRequestsContainer');
        if (!container) return;

        const accountId = this.walletManager?.getAccountId();
        if (!accountId) return;

        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';

        try {
            const response = await fetch(`${API_BASE}/admin/funding/pending`, {
                headers: { 'x-account-id': accountId }
            });

            if (!response.ok) {
                throw new Error('Failed to load requests');
            }

            const data = await response.json();
            const requests = data.requests || [];

            if (requests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>All Caught Up!</h3>
                        <p>No pending funding requests at the moment.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = requests.map(req => `
                <div class="funding-request-card">
                    <div class="request-header">
                        <div class="request-info">
                            <h4>${req.groveName || 'Unknown Grove'}</h4>
                            <div class="request-meta">
                                <i class="fas fa-user"></i> ${req.farmerAddress}
                            </div>
                            <div class="request-meta">
                                <i class="fas fa-calendar"></i> ${new Date(req.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <span class="milestone-badge milestone-${req.milestoneType}">
                            ${req.milestoneType}
                        </span>
                    </div>
                    <div class="request-amount">
                        $${req.amountRequested.toFixed(2)}
                    </div>
                    <div class="request-purpose">
                        <strong>Purpose:</strong><br>
                        ${req.purpose}
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-success" onclick="window.adminFunding.openApproveModal(${req.id}, '${req.groveName}', ${req.amountRequested})">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger" onclick="window.adminFunding.openRejectModal(${req.id}, '${req.groveName}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('[AdminFunding] Error loading pending requests:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
                    <h3>Error Loading Requests</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="window.adminFunding.loadPendingRequests()">Try Again</button>
                </div>
            `;
        }
    },

    openApproveModal(requestId, groveName, amount) {
        this.currentRequestId = requestId;

        const modal = document.getElementById('adminApproveModal');
        const body = document.getElementById('adminApproveModalBody');

        if (!modal || !body) return;

        body.innerHTML = `
            <p>Are you sure you want to approve this funding request?</p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <strong>Grove:</strong> ${groveName}<br>
                <strong>Amount:</strong> $${amount.toFixed(2)}<br>
                <strong>Platform Fee (3%):</strong> $${(amount * 0.03).toFixed(2)}<br>
                <strong>Farmer Receives:</strong> $${(amount * 0.97).toFixed(2)}
            </div>
            <div class="form-group">
                <label>Admin Notes (Optional)</label>
                <textarea id="adminApproveNotes" placeholder="Add any notes about this approval..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; min-height: 100px;"></textarea>
            </div>
        `;

        modal.style.display = 'flex';
    },

    closeApproveModal() {
        const modal = document.getElementById('adminApproveModal');
        if (modal) modal.style.display = 'none';
        this.currentRequestId = null;
    },

    async confirmApprove() {
        if (!this.currentRequestId) return;

        const notes = document.getElementById('adminApproveNotes')?.value || '';
        const accountId = this.walletManager?.getAccountId();

        if (!accountId) {
            alert('❌ Wallet not connected');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/admin/funding/approve/${this.currentRequestId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-account-id': accountId
                },
                body: JSON.stringify({ notes })
            });

            const data = await response.json();

            if (data.success) {
                alert(`✅ Request approved and funds disbursed!\n\nTransaction ID: ${data.transactionId}`);
                this.closeApproveModal();
                this.loadDashboardData();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error('[AdminFunding] Error approving request:', error);
            alert(`❌ Error approving request: ${error.message}`);
        }
    },

    openRejectModal(requestId, groveName) {
        this.currentRequestId = requestId;

        const modal = document.getElementById('adminRejectModal');
        const body = document.getElementById('adminRejectModalBody');

        if (!modal || !body) return;

        body.innerHTML = `
            <p>Please provide a reason for rejecting this request:</p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <strong>Grove:</strong> ${groveName}
            </div>
            <div class="form-group">
                <label>Rejection Reason (Required) *</label>
                <textarea id="adminRejectReason" placeholder="Explain why this request is being rejected..." required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; min-height: 100px;"></textarea>
            </div>
        `;

        modal.style.display = 'flex';
    },

    closeRejectModal() {
        const modal = document.getElementById('adminRejectModal');
        if (modal) modal.style.display = 'none';
        this.currentRequestId = null;
    },

    async confirmReject() {
        if (!this.currentRequestId) return;

        const reason = document.getElementById('adminRejectReason')?.value.trim() || '';

        if (reason.length < 10) {
            alert('Please provide a rejection reason of at least 10 characters.');
            return;
        }

        const accountId = this.walletManager?.getAccountId();

        if (!accountId) {
            alert('❌ Wallet not connected');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/admin/funding/reject/${this.currentRequestId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-account-id': accountId
                },
                body: JSON.stringify({ reason })
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Request rejected successfully.');
                this.closeRejectModal();
                this.loadDashboardData();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error('[AdminFunding] Error rejecting request:', error);
            alert(`❌ Error rejecting request: ${error.message}`);
        }
    }
};
