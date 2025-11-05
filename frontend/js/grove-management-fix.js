/**
 * Grove Management Fix
 * Implements missing functionality for View Details and Manage buttons
 * in the farmer dashboard grove cards
 */

// Ensure FarmerDashboard class exists
if (typeof FarmerDashboard !== 'undefined') {
    // Add missing methods to FarmerDashboard prototype
    FarmerDashboard.prototype.viewGroveDetails = function(groveId) {
        console.log(`[GroveManagementFix] View Details clicked for grove: ${groveId}`);
        
        // Find the grove in the groves array
        const grove = this.groves.find(g => g.id == groveId);
        if (!grove) {
            console.error(`[GroveManagementFix] Grove not found: ${groveId}`);
            this.showToast('Grove not found', 'error');
            return;
        }

        // Create modal for grove details
        this.showGroveDetailsModal(grove);
    };

    FarmerDashboard.prototype.manageGrove = function(groveId) {
        console.log(`[GroveManagementFix] Manage Grove clicked for grove: ${groveId}`);
        
        // Find the grove in the groves array
        const grove = this.groves.find(g => g.id == groveId);
        if (!grove) {
            console.error(`[GroveManagementFix] Grove not found: ${groveId}`);
            this.showToast('Grove not found', 'error');
            return;
        }

        // Create modal for grove management
        this.showGroveManagementModal(grove);
    };

    FarmerDashboard.prototype.showGroveDetailsModal = function(grove) {
        // Remove existing modal if present
        const existingModal = document.getElementById('grove-details-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHTML = `
            <div id="grove-details-modal" class="modal active">
                <div class="modal-overlay"></div>
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3><i class="fas fa-tree"></i> Grove Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="grove-detail-card">
                            <div class="detail-section">
                                <h4>Grove Information</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Name:</span>
                                    <span class="detail-value">${grove.groveName || grove.name || 'Unnamed Grove'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Location:</span>
                                    <span class="detail-value">${grove.location || 'Unknown location'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Country:</span>
                                    <span class="detail-value">${grove.country || 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Coffee Variety:</span>
                                    <span class="detail-value">${grove.coffeeVariety || 'Unknown'}</span>
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>Tree Information</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Tree Count:</span>
                                    <span class="detail-value">${grove.treeCount || 0} trees</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Expected Yield:</span>
                                    <span class="detail-value">${grove.expectedYieldPerTree || 0} kg/tree/year</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Total Expected Yield:</span>
                                    <span class="detail-value">${(grove.treeCount * (grove.expectedYieldPerTree || 0)).toFixed(2)} kg/year</span>
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>Status</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Registration Date:</span>
                                    <span class="detail-value">${grove.registrationDate ? new Date(grove.registrationDate).toLocaleDateString() : 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Tokenized:</span>
                                    <span class="detail-value">${grove.isTokenized ? 'Yes' : 'No'}</span>
                                </div>
                                ${grove.isTokenized ? `
                                <div class="detail-row">
                                    <span class="detail-label">Token Address:</span>
                                    <span class="detail-value">${grove.tokenAddress || 'Unknown'}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary modal-close-btn">Close</button>
                        ${!grove.isTokenized ? `
                        <button class="btn btn-primary" onclick="window.farmerDashboard.tokenizeGrove(${grove.id})">
                            <i class="fas fa-coins"></i> Tokenize Grove
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        const modal = document.getElementById('grove-details-modal');
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
        const overlay = modal.querySelector('.modal-overlay');

        const closeModal = () => {
            modal.remove();
        };

        closeButtons.forEach(button => {
            button.addEventListener('click', closeModal);
        });

        overlay.addEventListener('click', closeModal);

        // Prevent closing when clicking inside the modal content
        const modalContent = modal.querySelector('.modal-content');
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    };

    FarmerDashboard.prototype.showGroveManagementModal = function(grove) {
        // Remove existing modal if present
        const existingModal = document.getElementById('grove-management-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHTML = `
            <div id="grove-management-modal" class="modal active">
                <div class="modal-overlay"></div>
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3><i class="fas fa-cog"></i> Manage Grove: ${grove.groveName || grove.name || 'Unnamed Grove'}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="management-tabs">
                            <button class="tab-btn active" data-tab="update">
                                <i class="fas fa-edit"></i> Update Info
                            </button>
                            <button class="tab-btn" data-tab="harvest">
                                <i class="fas fa-leaf"></i> Report Harvest
                            </button>
                            <button class="tab-btn" data-tab="health">
                                <i class="fas fa-heartbeat"></i> Tree Health
                            </button>
                        </div>
                        
                        <div class="tab-content active" id="update-tab">
                            <form id="updateGroveForm">
                                <div class="form-group">
                                    <label for="groveName">Grove Name</label>
                                    <input type="text" id="groveName" name="groveName" 
                                           value="${grove.groveName || grove.name || ''}" required>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="treeCount">Tree Count</label>
                                        <input type="number" id="treeCount" name="treeCount" 
                                               value="${grove.treeCount || 0}" min="1" required>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="expectedYield">Expected Yield (kg/tree/year)</label>
                                        <input type="number" id="expectedYield" name="expectedYield" 
                                               value="${grove.expectedYieldPerTree || 0}" min="0" step="0.1" required>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="location">Location</label>
                                    <input type="text" id="location" name="location" 
                                           value="${grove.location || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="coffeeVariety">Coffee Variety</label>
                                    <select id="coffeeVariety" name="coffeeVariety" required>
                                        <option value="Arabica" ${grove.coffeeVariety === 'Arabica' ? 'selected' : ''}>Arabica</option>
                                        <option value="Robusta" ${grove.coffeeVariety === 'Robusta' ? 'selected' : ''}>Robusta</option>
                                        <option value="Liberica" ${grove.coffeeVariety === 'Liberica' ? 'selected' : ''}>Liberica</option>
                                        <option value="Excelsa" ${grove.coffeeVariety === 'Excelsa' ? 'selected' : ''}>Excelsa</option>
                                    </select>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="window.farmerDashboard.closeModal('grove-management-modal')">
                                        Cancel
                                    </button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-save"></i> Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                        
                        <div class="tab-content" id="harvest-tab">
                            <form id="harvestReportForm">
                                <div class="form-group">
                                    <label for="harvestAmount">Harvest Amount (kg)</label>
                                    <input type="number" id="harvestAmount" name="harvestAmount" 
                                           min="0" step="0.1" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="harvestQuality">Quality Grade</label>
                                    <select id="harvestQuality" name="harvestQuality" required>
                                        <option value="1">Grade 1 (Premium)</option>
                                        <option value="2">Grade 2 (High)</option>
                                        <option value="3">Grade 3 (Standard)</option>
                                        <option value="4">Grade 4 (Commercial)</option>
                                        <option value="5">Grade 5 (Low)</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="harvestDate">Harvest Date</label>
                                    <input type="date" id="harvestDate" name="harvestDate" 
                                           value="${new Date().toISOString().split('T')[0]}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="harvestNotes">Notes (Optional)</label>
                                    <textarea id="harvestNotes" name="harvestNotes" rows="3"></textarea>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="window.farmerDashboard.closeModal('grove-management-modal')">
                                        Cancel
                                    </button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-paper-plane"></i> Submit Harvest
                                    </button>
                                </div>
                            </form>
                        </div>
                        
                        <div class="tab-content" id="health-tab">
                            <form id="healthStatusForm">
                                <div class="form-group">
                                    <label for="healthScore">Health Score (0-100)</label>
                                    <input type="range" id="healthScore" name="healthScore" 
                                           min="0" max="100" value="80" class="slider">
                                    <div class="slider-value">
                                        <span id="healthScoreValue">80</span>/100
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="soilMoisture">Soil Moisture (%)</label>
                                    <input type="number" id="soilMoisture" name="soilMoisture" 
                                           min="0" max="100" step="0.1">
                                </div>
                                
                                <div class="form-group">
                                    <label for="temperature">Temperature (°C)</label>
                                    <input type="number" id="temperature" name="temperature" 
                                           min="-50" max="60" step="0.1">
                                </div>
                                
                                <div class="form-group">
                                    <label for="diseaseStatus">Disease Status</label>
                                    <select id="diseaseStatus" name="diseaseStatus">
                                        <option value="healthy">Healthy</option>
                                        <option value="monitoring">Monitoring</option>
                                        <option value="affected">Affected</option>
                                        <option value="treatment">Under Treatment</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="healthNotes">Notes (Optional)</label>
                                    <textarea id="healthNotes" name="healthNotes" rows="3"></textarea>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="window.farmerDashboard.closeModal('grove-management-modal')">
                                        Cancel
                                    </button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-heartbeat"></i> Update Health Status
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        const modal = document.getElementById('grove-management-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        const tabButtons = modal.querySelectorAll('.tab-btn');

        const closeModal = () => {
            modal.remove();
        };

        closeButtons.forEach(button => {
            button.addEventListener('click', closeModal);
        });

        overlay.addEventListener('click', closeModal);

        // Tab switching
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all tabs and buttons
                modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and button
                button.classList.add('active');
                const tabId = button.dataset.tab + '-tab';
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
            });
        });

        // Slider value update
        const healthScoreSlider = document.getElementById('healthScore');
        const healthScoreValue = document.getElementById('healthScoreValue');
        if (healthScoreSlider && healthScoreValue) {
            healthScoreSlider.addEventListener('input', () => {
                healthScoreValue.textContent = healthScoreSlider.value;
            });
        }

        // Form submissions
        const updateForm = document.getElementById('updateGroveForm');
        const harvestForm = document.getElementById('harvestReportForm');
        const healthForm = document.getElementById('healthStatusForm');

        if (updateForm) {
            updateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpdateGrove(grove.id, new FormData(updateForm));
            });
        }

        if (harvestForm) {
            harvestForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleHarvestReport(grove.id, new FormData(harvestForm));
            });
        }

        if (healthForm) {
            healthForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleHealthUpdate(grove.id, new FormData(healthForm));
            });
        }

        // Prevent closing when clicking inside the modal content
        const modalContent = modal.querySelector('.modal-content');
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    };

    FarmerDashboard.prototype.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    };

    FarmerDashboard.prototype.handleUpdateGrove = function(groveId, formData) {
        // Show loading state
        this.showLoading('Updating grove information...');
        
        // Simulate API call
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Grove information updated successfully!', 'success');
            this.closeModal('grove-management-modal');
            
            // Refresh grove data
            if (typeof this.loadGroves === 'function') {
                this.loadGroves();
            }
        }, 1500);
    };

    FarmerDashboard.prototype.handleHarvestReport = function(groveId, formData) {
        // Show loading state
        this.showLoading('Submitting harvest report...');
        
        // Simulate API call
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Harvest report submitted successfully!', 'success');
            this.closeModal('grove-management-modal');
        }, 1500);
    };

    FarmerDashboard.prototype.handleHealthUpdate = function(groveId, formData) {
        // Show loading state
        this.showLoading('Updating tree health status...');
        
        // Simulate API call
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Tree health status updated successfully!', 'success');
            this.closeModal('grove-management-modal');
        }, 1500);
    };

    FarmerDashboard.prototype.tokenizeGrove = function(groveId) {
        // Show loading state
        this.showLoading('Preparing grove tokenization...');
        
        // Simulate API call
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Grove tokenization initiated! This may take a few moments.', 'success');
            this.closeModal('grove-details-modal');
        }, 2000);
    };

    console.log('[GroveManagementFix] Successfully added missing methods to FarmerDashboard');
}

// Also add global functions as fallback
window.viewGroveDetails = function(groveId) {
    console.log(`[GroveManagementFix] Global viewGroveDetails called with groveId: ${groveId}`);
    if (window.farmerDashboard && typeof window.farmerDashboard.viewGroveDetails === 'function') {
        window.farmerDashboard.viewGroveDetails(groveId);
    } else {
        console.error('[GroveManagementFix] FarmerDashboard instance or viewGroveDetails method not found');
    }
};

window.manageGrove = function(groveId) {
    console.log(`[GroveManagementFix] Global manageGrove called with groveId: ${groveId}`);
    if (window.farmerDashboard && typeof window.farmerDashboard.manageGrove === 'function') {
        window.farmerDashboard.manageGrove(groveId);
    } else {
        console.error('[GroveManagementFix] FarmerDashboard instance or manageGrove method not found');
    }
};

console.log('[GroveManagementFix] Global functions viewGroveDetails and manageGrove initialized');