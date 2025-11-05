/**
 * Improved Purchase Modal
 * Enhanced UI for token purchase experience
 */

export function createPurchaseModal(grove) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content purchase-modal">
            <div class="modal-header">
                <h4>Purchase Tree Tokens</h4>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="purchase-grove-header">
                    <h3>${grove.groveName}</h3>
                    <p class="grove-meta">${grove.location} • ${grove.coffeeVariety}</p>
                </div>
                
                <div class="investment-summary-card">
                    <div class="summary-item">
                        <span class="summary-label">Price per token</span>
                        <span class="summary-value">$${grove.pricePerToken}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Available tokens</span>
                        <span class="summary-value">${grove.tokensAvailable}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Projected annual return</span>
                        <span class="summary-value return-value">${grove.projectedAnnualReturn}%</span>
                    </div>
                </div>
                
                <form id="purchaseForm">
                    <div class="form-group purchase-input-group">
                        <label for="tokenAmount">Number of tokens to purchase</label>
                        <input type="number" id="tokenAmount" name="tokenAmount" 
                               min="1" max="${grove.tokensAvailable}" 
                               placeholder="Enter amount" required>
                        <span class="input-hint">Maximum: ${grove.tokensAvailable} tokens available</span>
                    </div>
                    
                    <div class="purchase-calculation-card">
                        <div class="calc-row">
                            <span class="calc-label">Total investment</span>
                            <span class="calc-value" id="totalInvestment">$0.00</span>
                        </div>
                        <div class="calc-row earnings-row">
                            <span class="calc-label">Projected annual earnings</span>
                            <span class="calc-value earnings-value" id="projectedEarnings">$0.00</span>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-large">Invest Now</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Set up event listeners
    const tokenAmountInput = modal.querySelector('#tokenAmount');
    const totalInvestmentSpan = modal.querySelector('#totalInvestment');
    const projectedEarningsSpan = modal.querySelector('#projectedEarnings');

    tokenAmountInput.addEventListener('input', () => {
        const amount = parseInt(tokenAmountInput.value) || 0;
        const totalInvestment = amount * grove.pricePerToken;
        const projectedEarnings = totalInvestment * (grove.projectedAnnualReturn / 100);

        // Add animation class
        totalInvestmentSpan.classList.add('updating');
        projectedEarningsSpan.classList.add('updating');

        totalInvestmentSpan.textContent = `$${totalInvestment.toFixed(2)}`;
        projectedEarningsSpan.textContent = `$${projectedEarnings.toFixed(2)}`;

        // Remove animation class after animation completes
        setTimeout(() => {
            totalInvestmentSpan.classList.remove('updating');
            projectedEarningsSpan.classList.remove('updating');
        }, 300);
    });

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

    return {
        modal,
        form: modal.querySelector('#purchaseForm'),
        close: () => document.body.removeChild(modal)
    };
}
