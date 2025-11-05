/**
 * Fixed Investor Portal Management
 * Handles investor-specific functionality
 */

class InvestorPortal {
    constructor() {
        this.currentSection = 'browse';
        this.availableGroves = [];
        this.portfolio = null;
        this.marketListings = [];
    }

    viewGroveDetails(groveId) {
        const grove = this.availableGroves.find(g => g.id === groveId);
        if (!grove) {
            window.walletManager.showToast('Grove not found', 'error');
            return;
        }

        // Create detailed grove modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h4>Grove Details: ${grove.groveName}</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="grove-details-grid">
                        <div class="detail-section">
                            <h5>Basic Information</h5>
                            <div class="detail-list">
                                <div class="detail-row">
                                    <span class="label">Grove Name:</span>
                                    <span class="value">${grove.groveName}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Location:</span>
                                    <span class="value">${grove.location}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Coffee Variety:</span>
                                    <span class="value">${grove.coffeeVariety}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Number of Trees:</span>
                                    <span class="value">${grove.treeCount}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Expected Yield per Tree:</span>
                                    <span class="value">${grove.expectedYieldPerTree} kg/year</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h5>Investment Information</h5>
                            <div class="detail-list">
                                <div class="detail-row">
                                    <span class="label">Health Score:</span>
                                    <span class="value">
                                        <span class="health-score ${this.getHealthClass(grove.healthScore)}">
                                            ${grove.healthScore}
                                        </span>
                                    </span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Tokens Available:</span>
                                    <span class="value">${grove.tokensAvailable}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Price per Token:</span>
                                    <span class="value">$${grove.pricePerToken.toFixed(2)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Projected Annual Return:</span>
                                    <span class="value">${grove.projectedAnnualReturn}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary modal-close">Close</button>
                        <button class="btn btn-primary" onclick="investorPortal.showPurchaseModal('${grove.id}'); document.body.removeChild(this.closest('.modal'));">
                            Invest Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

// Create global investor portal instance
window.investorPortal = new InvestorPortal();