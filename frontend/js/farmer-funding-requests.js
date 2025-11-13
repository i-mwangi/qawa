/**
 * Farmer Funding Requests Module
 * Handles milestone-based funding request UI and interactions
 */

// State management
let fundingState = {
    currentGrove: null,
    fundingPool: null,
    requests: [],
    selectedRequest: null
};

/**
 * Initialize funding requests section
 */
async function initializeFundingRequests() {
    console.log('[Funding] Initializing funding requests section');
    
    // Load farmer's requests
    await loadFarmerRequests();
    
    // Set up event listeners
    setupFundingEventListeners();
}

/**
 * Load farmer's funding requests
 */
async function loadFarmerRequests() {
    try {
        const farmerAddress = window.accountId;
        if (!farmerAddress) {
            console.error('[Funding] No farmer address found');
            return;
        }

        const response = await fetch(`/api/funding/requests/${farmerAddress}`, {
            headers: {
                'x-account-id': farmerAddress
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load requests');
        }

        const data = await response.json();
        fundingState.requests = data.requests || [];
        
        console.log(`[Funding] Loaded ${fundingState.requests.length} requests`);
        
        // Render requests
        renderRequestsTable();
        updateFundingStats();
        
    } catch (error) {
        console.error('[Funding] Error loading requests:', error);
        showNotification('Failed to load funding requests', 'error');
    }
}

/**
 * Load funding pool for a grove
 */
async function loadFundingPool(groveId) {
    try {
        const response = await fetch(`/api/funding/pool/${groveId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load funding pool');
        }

        const data = await response.json();
        fundingState.fundingPool = data.funds;
        
        // Render funding overview
        renderFundingOverview();
        
    } catch (error) {
        console.error('[Funding] Error loading funding pool:', error);
        showNotification('Failed to load funding pool', 'error');
    }
}

/**
 * Render funding overview with milestone progress bars
 */
function renderFundingOverview() {
    const container = document.getElementById('fundingOverview');
    if (!container || !fundingState.fundingPool) return;

    const pool = fundingState.fundingPool;
    
    container.innerHTML = `
        <div class="funding-overview-grid">
            <div class="funding-stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-content">
                    <div class="stat-label">Total Investment Pool</div>
                    <div class="stat-value">$${(pool.totalInvestment / 100).toFixed(2)}</div>
                </div>
            </div>
            
            <div class="funding-stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <div class="stat-label">Platform Fees Collected</div>
                    <div class="stat-value">$${(pool.platformFeesCollected / 100).toFixed(2)}</div>
                </div>
            </div>
        </div>

        <div class="milestone-progress-section">
            <h4>Milestone Funding Availability</h4>
            
            <div class="milestone-card">
                <div class="milestone-header">
                    <span class="milestone-name">🌱 Upfront Operations (40%)</span>
                    <span class="milestone-amount">$${(pool.upfront.available / 100).toFixed(2)} available</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(pool.upfront.disbursed / pool.upfront.allocated * 100) || 0}%"></div>
                </div>
                <div class="milestone-details">
                    <span>Allocated: $${(pool.upfront.allocated / 100).toFixed(2)}</span>
                    <span>Disbursed: $${(pool.upfront.disbursed / 100).toFixed(2)}</span>
                </div>
            </div>

            <div class="milestone-card">
                <div class="milestone-header">
                    <span class="milestone-name">🔧 Maintenance (30%)</span>
                    <span class="milestone-amount">$${(pool.maintenance.available / 100).toFixed(2)} available</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(pool.maintenance.disbursed / pool.maintenance.allocated * 100) || 0}%"></div>
                </div>
                <div class="milestone-details">
                    <span>Allocated: $${(pool.maintenance.allocated / 100).toFixed(2)}</span>
                    <span>Disbursed: $${(pool.maintenance.disbursed / 100).toFixed(2)}</span>
                </div>
            </div>

            <div class="milestone-card">
                <div class="milestone-header">
                    <span class="milestone-name">🌾 Harvest Preparation (30%)</span>
                    <span class="milestone-amount">$${(pool.harvest.available / 100).toFixed(2)} available</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(pool.harvest.disbursed / pool.harvest.allocated * 100) || 0}%"></div>
                </div>
                <div class="milestone-details">
                    <span>Allocated: $${(pool.harvest.allocated / 100).toFixed(2)}</span>
                    <span>Disbursed: $${(pool.harvest.disbursed / 100).toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render requests table
 */
function renderRequestsTable() {
    const container = document.getElementById('requestsTableBody');
    if (!container) return;

    if (fundingState.requests.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    <p>No funding requests yet</p>
                    <button class="btn btn-primary" onclick="openNewRequestModal()">
                        Create Your First Request
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = fundingState.requests.map(request => `
        <tr>
            <td>${new Date(request.createdAt).toLocaleDateString()}</td>
            <td>${request.groveName || 'Unknown'}</td>
            <td><span class="milestone-badge milestone-${request.milestoneType}">${formatMilestone(request.milestoneType)}</span></td>
            <td>$${(request.amountRequested / 100).toFixed(2)}</td>
            <td><span class="status-badge status-${request.status}">${formatStatus(request.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="viewRequestDetails(${request.id})">
                    View Details
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Update funding stats
 */
function updateFundingStats() {
    const pending = fundingState.requests.filter(r => r.status === 'pending').length;
    const approved = fundingState.requests.filter(r => r.status === 'approved' || r.status === 'disbursed').length;
    const totalDisbursed = fundingState.requests
        .filter(r => r.status === 'disbursed')
        .reduce((sum, r) => sum + (r.amountApproved || r.amountRequested), 0);

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('approvedCount').textContent = approved;
    document.getElementById('totalDisbursed').textContent = `$${(totalDisbursed / 100).toFixed(2)}`;
}

/**
 * Format milestone type for display
 */
function formatMilestone(type) {
    const map = {
        'upfront': 'Upfront Operations',
        'maintenance': 'Maintenance',
        'harvest': 'Harvest Prep'
    };
    return map[type] || type;
}

/**
 * Format status for display
 */
function formatStatus(status) {
    const map = {
        'pending': 'Pending Review',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'disbursed': 'Disbursed',
        'cancelled': 'Cancelled'
    };
    return map[status] || status;
}

/**
 * Open new request modal
 */
async function openNewRequestModal() {
    // Load groves first
    await loadFarmerGroves();
    
    const modal = document.getElementById('newRequestModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close new request modal
 */
function closeNewRequestModal() {
    const modal = document.getElementById('newRequestModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('newRequestForm').reset();
    }
}

/**
 * Load farmer's groves for dropdown
 */
async function loadFarmerGroves() {
    try {
        const response = await fetch(`/api/groves/farmer/${window.accountId}`);
        const data = await response.json();
        
        const select = document.getElementById('requestGroveSelect');
        if (select && data.groves) {
            select.innerHTML = '<option value="">Select a grove...</option>' +
                data.groves.map(grove => `
                    <option value="${grove.id}">${grove.groveName}</option>
                `).join('');
        }
    } catch (error) {
        console.error('[Funding] Error loading groves:', error);
    }
}

/**
 * Handle grove selection - load funding pool
 */
async function onGroveSelected(groveId) {
    if (!groveId) return;
    
    fundingState.currentGrove = parseInt(groveId);
    await loadFundingPool(groveId);
    
    // Update available amount display
    updateAvailableAmount();
}

/**
 * Update available amount based on selected milestone
 */
function updateAvailableAmount() {
    const milestoneSelect = document.getElementById('requestMilestone');
    const availableSpan = document.getElementById('availableAmount');
    
    if (!milestoneSelect || !availableSpan || !fundingState.fundingPool) return;
    
    const milestone = milestoneSelect.value;
    if (!milestone) {
        availableSpan.textContent = '$0.00';
        return;
    }
    
    const pool = fundingState.fundingPool;
    const available = pool[milestone]?.available || 0;
    availableSpan.textContent = `$${(available / 100).toFixed(2)}`;
}

/**
 * Submit new funding request
 */
async function submitFundingRequest(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const requestData = {
        groveId: parseInt(formData.get('groveId')),
        farmerAddress: window.accountId,
        milestoneType: formData.get('milestone'),
        amount: Math.floor(parseFloat(formData.get('amount')) * 100), // Convert to cents
        purpose: formData.get('purpose')
    };
    
    try {
        const response = await fetch('/api/funding/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-account-id': window.accountId
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create request');
        }
        
        showNotification('Funding request submitted successfully!', 'success');
        closeNewRequestModal();
        await loadFarmerRequests();
        
    } catch (error) {
        console.error('[Funding] Error submitting request:', error);
        showNotification(error.message, 'error');
    }
}

/**
 * View request details
 */
async function viewRequestDetails(requestId) {
    try {
        const response = await fetch(`/api/funding/request/${requestId}`, {
            headers: {
                'x-account-id': window.accountId
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load request');
        }
        
        fundingState.selectedRequest = data.request;
        renderRequestDetailsModal();
        
    } catch (error) {
        console.error('[Funding] Error loading request details:', error);
        showNotification(error.message, 'error');
    }
}

/**
 * Render request details modal
 */
function renderRequestDetailsModal() {
    const request = fundingState.selectedRequest;
    if (!request) return;
    
    const modal = document.getElementById('requestDetailsModal');
    const content = document.getElementById('requestDetailsContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div class="request-details">
            <div class="detail-row">
                <span class="detail-label">Grove:</span>
                <span class="detail-value">${request.groveName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Milestone:</span>
                <span class="detail-value">${formatMilestone(request.milestoneType)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Amount Requested:</span>
                <span class="detail-value">$${(request.amountRequested / 100).toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="status-badge status-${request.status}">${formatStatus(request.status)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value">${new Date(request.createdAt).toLocaleString()}</span>
            </div>
            ${request.reviewedAt ? `
                <div class="detail-row">
                    <span class="detail-label">Reviewed:</span>
                    <span class="detail-value">${new Date(request.reviewedAt).toLocaleString()}</span>
                </div>
            ` : ''}
            ${request.disbursedAt ? `
                <div class="detail-row">
                    <span class="detail-label">Disbursed:</span>
                    <span class="detail-value">${new Date(request.disbursedAt).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction ID:</span>
                    <span class="detail-value"><code>${request.transactionId}</code></span>
                </div>
            ` : ''}
            <div class="detail-section">
                <h4>Purpose</h4>
                <p>${request.purpose}</p>
            </div>
            ${request.rejectionReason ? `
                <div class="detail-section alert-warning">
                    <h4>Rejection Reason</h4>
                    <p>${request.rejectionReason}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
}

/**
 * Close request details modal
 */
function closeRequestDetailsModal() {
    const modal = document.getElementById('requestDetailsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Setup event listeners
 */
function setupFundingEventListeners() {
    // New request form
    const form = document.getElementById('newRequestForm');
    if (form) {
        form.addEventListener('submit', submitFundingRequest);
    }
    
    // Grove selection
    const groveSelect = document.getElementById('requestGroveSelect');
    if (groveSelect) {
        groveSelect.addEventListener('change', (e) => onGroveSelected(e.target.value));
    }
    
    // Milestone selection
    const milestoneSelect = document.getElementById('requestMilestone');
    if (milestoneSelect) {
        milestoneSelect.addEventListener('change', updateAvailableAmount);
    }
}

// Export functions to global scope
window.initializeFundingRequests = initializeFundingRequests;
window.openNewRequestModal = openNewRequestModal;
window.closeNewRequestModal = closeNewRequestModal;
window.viewRequestDetails = viewRequestDetails;
window.closeRequestDetailsModal = closeRequestDetailsModal;
