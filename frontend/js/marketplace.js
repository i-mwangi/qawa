/**
 * Enhanced Marketplace Management
 * Handles secondary market trading functionality for coffee tree tokens
 */

class CoffeeTreeMarketplace {
    constructor() {
        this.listings = [];
        this.trades = [];
        this.currentSort = 'price-asc';
        this.currentFilter = '';
        this.searchTerm = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // View Trade History button - use setTimeout to ensure DOM is ready
        setTimeout(() => {
            const tradeHistoryBtn = document.getElementById('viewTradeHistoryBtn');
            console.log('[Marketplace] Looking for trade history button:', tradeHistoryBtn);
            if (tradeHistoryBtn) {
                console.log('[Marketplace] Trade history button found, attaching listener');
                tradeHistoryBtn.addEventListener('click', () => {
                    console.log('[Marketplace] View Trade History clicked');
                    this.loadTradeHistory();
                });
            } else {
                console.error('[Marketplace] Trade history button NOT found!');
            }
        }, 100);

        // Event delegation for dynamically created elements
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="buy-tokens"]')) {
                const listingId = e.target.dataset.listingId;
                this.showPurchaseModal(listingId);
            }
            
            if (e.target.matches('[data-action="view-details"]')) {
                const listingId = e.target.dataset.listingId;
                this.viewListingDetails(listingId);
            }
            
            if (e.target.matches('[data-action="list-tokens"]')) {
                const groveId = e.target.dataset.groveId;
                const tokenAmount = parseInt(e.target.dataset.tokenAmount);
                this.showListingModal(groveId, tokenAmount);
            }
            
            if (e.target.matches('[data-action="cancel-listing"]')) {
                const listingId = e.target.dataset.listingId;
                this.cancelListing(listingId);
            }
        });
    }

    async loadMarketplaceData() {
        try {
            window.walletManager.showLoading('Loading marketplace...');
            
            const response = await window.coffeeAPI.getMarketplaceListings();
            
            if (response.success) {
                this.listings = response.listings;
            } else {
                // Fallback to mock data for development
                this.listings = this.getMockListings();
            }

            this.renderMarketplace();
            this.renderMarketplaceStats();
            
        } catch (error) {
            console.error('Failed to load marketplace data:', error);
            this.listings = this.getMockListings();
            this.renderMarketplace();
        } finally {
            window.walletManager.hideLoading();
        }
    }

    getMockListings() {
        return [
            {
                id: '1',
                listingId: 1,
                groveName: 'Yirgacheffe Estate',
                sellerAddress: '0x789abc123def456789012345678901234567890',
                tokenAddress: '0xtoken1',
                tokenAmount: 10,
                pricePerToken: 28.00,
                originalPrice: 25.00,
                listingDate: new Date('2024-12-01').toISOString(),
                expirationDate: new Date('2024-12-31').toISOString(),
                coffeeVariety: 'Arabica',
                location: 'Ethiopia, Yirgacheffe',
                healthScore: 85,
                isActive: true
            },
            {
                id: '2',
                listingId: 2,
                groveName: 'Mount Elgon Grove',
                sellerAddress: '0xabcdef123456789012345678901234567890123',
                tokenAddress: '0xtoken2',
                tokenAmount: 5,
                pricePerToken: 32.00,
                originalPrice: 30.00,
                listingDate: new Date('2024-12-05').toISOString(),
                expirationDate: new Date('2024-12-31').toISOString(),
                coffeeVariety: 'Bourbon',
                location: 'Uganda, Mbale',
                healthScore: 92,
                isActive: true
            },
            {
                id: '3',
                listingId: 3,
                groveName: 'Highland Estate',
                sellerAddress: '0xdef456789012345678901234567890123456789',
                tokenAddress: '0xtoken3',
                tokenAmount: 25,
                pricePerToken: 22.50,
                originalPrice: 20.00,
                listingDate: new Date('2024-12-10').toISOString(),
                expirationDate: new Date('2024-12-31').toISOString(),
                coffeeVariety: 'Geisha',
                location: 'Panama',
                healthScore: 78,
                isActive: true
            }
        ];
    }

    renderMarketplace() {
        const container = document.getElementById('marketListings');
        if (!container) return;

        if (this.listings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h4>No tokens for sale</h4>
                    <p>Check back later for secondary market opportunities</p>
                </div>
            `;
            return;
        }

        const filteredListings = this.getFilteredListings();

        container.innerHTML = `
            <div class="marketplace-header">
                <div class="marketplace-controls">
                    <div class="marketplace-filters">
                        <select id="marketSortBy" onchange="marketplace.sortMarketplace(this.value)">
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                            <option value="date-desc">Recently Listed</option>
                            <option value="amount-desc">Most Tokens</option>
                        </select>
                        <select id="marketVarietyFilter" onchange="marketplace.filterMarketplace()">
                            <option value="">All Varieties</option>
                            <option value="Arabica">Arabica</option>
                            <option value="Robusta">Robusta</option>
                            <option value="Bourbon">Bourbon</option>
                            <option value="Geisha">Geisha</option>
                        </select>
                    </div>
                    <div class="marketplace-search">
                        <input type="text" id="marketSearch" placeholder="Search by grove name or location..." 
                               onkeyup="marketplace.searchMarketplace(this.value)">
                    </div>
                </div>
            </div>
            <div class="marketplace-listings">
                ${filteredListings.map(listing => this.renderMarketplaceListing(listing)).join('')}
            </div>
        `;
    }

    renderMarketplaceListing(listing) {
        // Add null checks and default values
        const pricePerToken = listing.pricePerToken || 0;
        const originalPrice = listing.originalPrice || pricePerToken;
        const tokenAmount = listing.tokenAmount || 0;
        const healthScore = listing.healthScore || 0;
        
        const priceChange = pricePerToken - originalPrice;
        const priceChangePercent = originalPrice > 0 ? ((priceChange / originalPrice) * 100).toFixed(1) : '0.0';
        const priceChangeClass = priceChange >= 0 ? 'text-success' : 'text-danger';
        const totalValue = pricePerToken * tokenAmount;

        return `
            <div class="marketplace-card" data-variety="${listing.coffeeVariety}" data-location="${listing.location}">
                <div class="listing-header">
                    <div class="grove-info">
                        <h4>${listing.groveName}</h4>
                        <div class="grove-meta">
                            <span class="variety-tag">${listing.coffeeVariety}</span>
                            <span class="location-tag">${listing.location}</span>
                            <div class="health-indicator">
                                <span class="health-score ${this.getHealthClass(healthScore)}">
                                    ${healthScore}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="listing-price">
                        <span class="price">$${pricePerToken.toFixed(2)}</span>
                        <small>per token</small>
                    </div>
                </div>
                
                <div class="listing-details">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label">Tokens Available</span>
                            <span class="value">${tokenAmount}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Total Value</span>
                            <span class="value">$${totalValue.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Original Price</span>
                            <span class="value">$${originalPrice.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Price Change</span>
                            <span class="value ${priceChangeClass}">
                                ${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)} (${priceChangePercent}%)
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Listed Date</span>
                            <span class="value">${new Date(listing.listingDate).toLocaleDateString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Seller</span>
                            <span class="value">${this.formatAddress(listing.sellerAddress)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="listing-actions">
                    <button class="btn btn-secondary" data-action="view-details" data-listing-id="${listing.id}">
                        View Details
                    </button>
                    ${this.renderListingActionButton(listing)}
                </div>
            </div>
        `;
    }

    renderListingActionButton(listing) {
        const currentUserAddress = window.walletManager?.getAccountId();
        
        // If this is the user's own listing, show cancel button
        if (currentUserAddress && listing.sellerAddress === currentUserAddress) {
            return `
                <button class="btn btn-danger" data-action="cancel-listing" data-listing-id="${listing.id}">
                    Cancel Listing
                </button>
            `;
        }
        
        // Otherwise show buy button
        return `
            <button class="btn btn-primary" data-action="buy-tokens" data-listing-id="${listing.id}">
                Buy Tokens
            </button>
        `;
    }

    renderMarketplaceStats() {
        const container = document.getElementById('marketListings');
        if (!container) return;

        const totalListings = this.listings.length;
        const totalTokens = this.listings.reduce((sum, listing) => sum + listing.tokenAmount, 0);
        const totalValue = this.listings.reduce((sum, listing) => sum + (listing.pricePerToken * listing.tokenAmount), 0);
        const avgPrice = totalTokens > 0 ? totalValue / totalTokens : 0;

        const statsHtml = `
            <div class="marketplace-stats">
                <div class="stat-card">
                    <h4>Active Listings</h4>
                    <div class="stat-value">${totalListings}</div>
                </div>
                <div class="stat-card">
                    <h4>Tokens Available</h4>
                    <div class="stat-value">${totalTokens}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Market Value</h4>
                    <div class="stat-value">$${totalValue.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <h4>Average Price</h4>
                    <div class="stat-value">$${avgPrice.toFixed(2)}</div>
                </div>
            </div>
        `;

        // Insert stats before the existing content
        container.insertAdjacentHTML('afterbegin', statsHtml);
    }

    getFilteredListings() {
        let filtered = [...this.listings];

        // Apply variety filter
        if (this.currentFilter) {
            filtered = filtered.filter(listing => listing.coffeeVariety === this.currentFilter);
        }

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(listing => 
                listing.groveName.toLowerCase().includes(searchLower) ||
                listing.location.toLowerCase().includes(searchLower)
            );
        }

        // Apply sorting
        switch (this.currentSort) {
            case 'price-asc':
                filtered.sort((a, b) => a.pricePerToken - b.pricePerToken);
                break;
            case 'price-desc':
                filtered.sort((a, b) => b.pricePerToken - a.pricePerToken);
                break;
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.listingDate) - new Date(a.listingDate));
                break;
            case 'amount-desc':
                filtered.sort((a, b) => b.tokenAmount - a.tokenAmount);
                break;
        }

        return filtered;
    }

    sortMarketplace(sortBy) {
        this.currentSort = sortBy;
        this.renderMarketplace();
    }

    filterMarketplace() {
        const varietyFilter = document.getElementById('marketVarietyFilter');
        this.currentFilter = varietyFilter ? varietyFilter.value : '';
        this.renderMarketplace();
    }

    searchMarketplace(searchTerm) {
        this.searchTerm = searchTerm;
        this.renderMarketplace();
    }

    showPurchaseModal(listingId) {
        const listing = this.listings.find(l => l.id === listingId);
        if (!listing) return;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h4>Purchase Tree Tokens</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="purchase-info">
                        <h5>${listing.groveName}</h5>
                        <p>${listing.location} • ${listing.coffeeVariety}</p>
                        
                        <div class="investment-summary">
                            <div class="summary-row">
                                <span>Price per token:</span>
                                <span>$${listing.pricePerToken.toFixed(2)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Available tokens:</span>
                                <span>${listing.tokenAmount}</span>
                            </div>
                            <div class="summary-row">
                                <span>Seller:</span>
                                <span>${this.formatAddress(listing.sellerAddress)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <form id="marketplacePurchaseForm">
                        <div class="form-group">
                            <label for="purchaseAmount">Number of tokens to purchase</label>
                            <input type="number" id="purchaseAmount" name="purchaseAmount" 
                                   min="1" max="${listing.tokenAmount}" required>
                        </div>
                        
                        <div class="purchase-calculation">
                            <div class="calc-row">
                                <span>Total cost:</span>
                                <span id="totalCost">$0.00</span>
                            </div>
                            <div class="calc-row">
                                <span>Marketplace fee (2.5%):</span>
                                <span id="marketplaceFee">$0.00</span>
                            </div>
                            <div class="calc-row">
                                <span>Total payment:</span>
                                <span id="totalPayment">$0.00</span>
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                            <button type="submit" class="btn btn-primary">Purchase Tokens</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set up event listeners
        const purchaseAmountInput = modal.querySelector('#purchaseAmount');
        const totalCostSpan = modal.querySelector('#totalCost');
        const marketplaceFeeSpan = modal.querySelector('#marketplaceFee');
        const totalPaymentSpan = modal.querySelector('#totalPayment');

        purchaseAmountInput.addEventListener('input', () => {
            const amount = parseInt(purchaseAmountInput.value) || 0;
            const totalCost = amount * listing.pricePerToken;
            const marketplaceFee = totalCost * 0.025; // 2.5% fee
            const totalPayment = totalCost + marketplaceFee;
            
            totalCostSpan.textContent = `$${totalCost.toFixed(2)}`;
            marketplaceFeeSpan.textContent = `$${marketplaceFee.toFixed(2)}`;
            totalPaymentSpan.textContent = `$${totalPayment.toFixed(2)}`;
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

        // Purchase form handler
        const purchaseForm = modal.querySelector('#marketplacePurchaseForm');
        purchaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleMarketplacePurchase(listingId, parseInt(purchaseAmountInput.value));
            document.body.removeChild(modal);
        });
    }

    showListingModal(groveId, availableTokens) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h4>List Tokens for Sale</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="tokenListingForm">
                        <div class="form-group">
                            <label for="listingAmount">Number of tokens to list</label>
                            <input type="number" id="listingAmount" name="listingAmount" 
                                   min="1" max="${availableTokens}" required>
                            <small>You own ${availableTokens} tokens</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="listingPrice">Price per token (USDC)</label>
                            <input type="number" id="listingPrice" name="listingPrice" 
                                   step="0.01" min="0.01" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="listingDuration">Listing duration</label>
                            <select id="listingDuration" name="listingDuration" required>
                                <option value="7">7 days</option>
                                <option value="14">14 days</option>
                                <option value="30" selected>30 days</option>
                                <option value="60">60 days</option>
                                <option value="90">90 days</option>
                            </select>
                        </div>
                        
                        <div class="listing-calculation">
                            <div class="calc-row">
                                <span>Total value:</span>
                                <span id="listingTotalValue">$0.00</span>
                            </div>
                            <div class="calc-row">
                                <span>Marketplace fee (2.5%):</span>
                                <span id="listingFee">$0.00</span>
                            </div>
                            <div class="calc-row">
                                <span>You'll receive:</span>
                                <span id="sellerReceives">$0.00</span>
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                            <button type="submit" class="btn btn-primary">List Tokens</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set up calculation listeners
        const amountInput = modal.querySelector('#listingAmount');
        const priceInput = modal.querySelector('#listingPrice');
        const totalValueSpan = modal.querySelector('#listingTotalValue');
        const feeSpan = modal.querySelector('#listingFee');
        const receivesSpan = modal.querySelector('#sellerReceives');

        const updateCalculation = () => {
            const amount = parseInt(amountInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const totalValue = amount * price;
            const fee = totalValue * 0.025;
            const receives = totalValue - fee;
            
            totalValueSpan.textContent = `$${totalValue.toFixed(2)}`;
            feeSpan.textContent = `$${fee.toFixed(2)}`;
            receivesSpan.textContent = `$${receives.toFixed(2)}`;
        };

        amountInput.addEventListener('input', updateCalculation);
        priceInput.addEventListener('input', updateCalculation);

        // Close modal handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });

        // Form submission
        const listingForm = modal.querySelector('#tokenListingForm');
        listingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(listingForm);
            await this.handleTokenListing(groveId, {
                amount: parseInt(formData.get('listingAmount')),
                price: parseFloat(formData.get('listingPrice')),
                duration: parseInt(formData.get('listingDuration'))
            });
            document.body.removeChild(modal);
        });
    }

    async handleMarketplacePurchase(listingId, tokenAmount) {
        const buyerAddress = window.walletManager.getAccountId();

        try {
            window.walletManager.showLoading('Processing marketplace purchase...');
            
            const response = await window.coffeeAPI.purchaseFromMarketplace(listingId, tokenAmount, buyerAddress);
            
            if (response.success) {
                window.walletManager.showToast('Tokens purchased successfully from marketplace!', 'success');
                
                // Refresh marketplace data
                await this.loadMarketplaceData();
                
                // Refresh portfolio if on portfolio section
                if (window.investorPortal && window.investorPortal.currentSection === 'portfolio') {
                    await window.investorPortal.loadPortfolio(buyerAddress);
                }
            }
        } catch (error) {
            console.error('Marketplace purchase failed:', error);
            
            // Check if error is due to token not associated
            if (error.message && error.message.includes('TOKEN_NOT_ASSOCIATED')) {
                this.showTokenAssociationModal(error.message);
            } else {
                window.walletManager.showToast('Failed to purchase tokens from marketplace', 'error');
            }
        } finally {
            window.walletManager.hideLoading();
        }
    }

    /**
     * Show modal explaining token association requirement
     */
    showTokenAssociationModal(errorMessage) {
        // Extract token ID from error message
        const tokenIdMatch = errorMessage.match(/token (0\.0\.\d+)/);
        const tokenId = tokenIdMatch ? tokenIdMatch[1] : 'the grove token';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content token-association-modal">
                <div class="modal-header">
                    <h3>🔗 Token Association Required</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="info-box">
                        <p><strong>Before you can receive tokens, you need to associate them with your wallet.</strong></p>
                        <p>This is a one-time setup required by Hedera for security.</p>
                    </div>
                    
                    <div class="steps-container">
                        <h4>How to Associate Token:</h4>
                        <ol class="association-steps">
                            <li>
                                <strong>Open HashPack Wallet</strong>
                                <p>Click the HashPack extension in your browser</p>
                            </li>
                            <li>
                                <strong>Go to Tokens Tab</strong>
                                <p>Navigate to the "Tokens" section</p>
                            </li>
                            <li>
                                <strong>Click "Associate Token"</strong>
                                <p>Look for the button to add a new token</p>
                            </li>
                            <li>
                                <strong>Enter Token ID</strong>
                                <p class="token-id-display">
                                    <code>${tokenId}</code>
                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${tokenId}'); this.textContent='Copied!'">Copy</button>
                                </p>
                            </li>
                            <li>
                                <strong>Confirm Association</strong>
                                <p>Approve the transaction (small fee ~$0.05)</p>
                            </li>
                            <li>
                                <strong>Try Purchase Again</strong>
                                <p>Once associated, return here and purchase again</p>
                            </li>
                        </ol>
                    </div>

                    <div class="info-box warning">
                        <p><strong>💡 Tip:</strong> You only need to associate each token once. After that, you can receive unlimited transfers of that token.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Close</button>
                    <button class="btn btn-primary" onclick="window.open('https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service/associate-tokens-to-an-account', '_blank')">
                        Learn More
                    </button>
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

    async handleTokenListing(groveId, listingData) {
        const sellerAddress = window.walletManager.getAccountId();

        try {
            window.walletManager.showLoading('Creating token listing...');
            
            const response = await window.coffeeAPI.listTokensForSale(
                groveId, 
                listingData.amount, 
                listingData.price, 
                listingData.duration, 
                sellerAddress
            );
            
            if (response.success) {
                window.walletManager.showToast('Tokens listed for sale successfully!', 'success');
                
                // Refresh marketplace data
                await this.loadMarketplaceData();
                
                // Refresh portfolio
                if (window.investorPortal && window.investorPortal.currentSection === 'portfolio') {
                    await window.investorPortal.loadPortfolio(sellerAddress);
                }
            }
        } catch (error) {
            console.error('Token listing failed:', error);
            window.walletManager.showToast('Failed to list tokens for sale', 'error');
        } finally {
            window.walletManager.hideLoading();
        }
    }

    async cancelListing(listingId) {
        const listing = this.listings.find(l => l.id === listingId);
        if (!listing) {
            window.walletManager.showToast('Listing not found', 'error');
            return;
        }

        const sellerAddress = window.walletManager.getAccountId();
        
        // Confirm cancellation
        if (!confirm(`Cancel listing of ${listing.tokenAmount} tokens from ${listing.groveName}?\n\nTokens will be returned to your portfolio.`)) {
            return;
        }

        try {
            window.walletManager.showLoading('Canceling listing...');
            
            const response = await window.coffeeAPI.cancelListing(listingId, sellerAddress);
            
            if (response.success) {
                window.walletManager.showToast(
                    `Listing cancelled! ${response.tokensRestored || listing.tokenAmount} tokens returned to your portfolio.`, 
                    'success'
                );
                
                // Refresh marketplace data
                await this.loadMarketplaceData();
                
                // Refresh portfolio
                if (window.investorPortal && window.investorPortal.currentSection === 'portfolio') {
                    await window.investorPortal.loadPortfolio(sellerAddress);
                }
            } else {
                window.walletManager.showToast(response.error || 'Failed to cancel listing', 'error');
            }
        } catch (error) {
            console.error('Cancel listing failed:', error);
            window.walletManager.showToast('Failed to cancel listing', 'error');
        } finally {
            window.walletManager.hideLoading();
        }
    }

    viewListingDetails(listingId) {
        const listing = this.listings.find(l => l.id === listingId);
        if (!listing) return;

        // Create detailed view modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h4>Listing Details - ${listing.groveName}</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="listing-details-grid">
                        <div class="detail-section">
                            <h5>Grove Information</h5>
                            <div class="detail-list">
                                <div class="detail-row">
                                    <span class="label">Grove Name:</span>
                                    <span class="value">${listing.groveName}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Location:</span>
                                    <span class="value">${listing.location}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Coffee Variety:</span>
                                    <span class="value">${listing.coffeeVariety}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Health Score:</span>
                                    <span class="value">
                                        <span class="health-score ${this.getHealthClass(listing.healthScore)}">
                                            ${listing.healthScore}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h5>Listing Information</h5>
                            <div class="detail-list">
                                <div class="detail-row">
                                    <span class="label">Tokens Available:</span>
                                    <span class="value">${listing.tokenAmount}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Price per Token:</span>
                                    <span class="value">$${listing.pricePerToken.toFixed(2)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Total Value:</span>
                                    <span class="value">$${(listing.pricePerToken * listing.tokenAmount).toFixed(2)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Listed Date:</span>
                                    <span class="value">${new Date(listing.listingDate).toLocaleDateString()}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Expires:</span>
                                    <span class="value">${new Date(listing.expirationDate).toLocaleDateString()}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Seller:</span>
                                    <span class="value">${this.formatAddress(listing.sellerAddress)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary modal-close">Close</button>
                        <button class="btn btn-primary" data-action="buy-tokens" data-listing-id="${listing.id}">
                            Purchase Tokens
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
    }

    getHealthClass(score) {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        return 'danger';
    }

    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    async loadTradeHistory() {
        console.log('[Marketplace] Loading trade history...');
        try {
            const response = await window.coffeeAPI.getTradeHistory();
            console.log('[Marketplace] Trade history response:', response);
            
            if (response.success) {
                this.trades = response.trades;
                console.log('[Marketplace] Trades loaded:', this.trades.length);
                this.renderTradeHistory();
            } else {
                console.error('[Marketplace] Failed to load trades:', response.error);
            }
        } catch (error) {
            console.error('[Marketplace] Error loading trade history:', error);
        }
    }

    renderTradeHistory() {
        console.log('[Marketplace] Rendering trade history...');
        const container = document.getElementById('tradeHistory');
        console.log('[Marketplace] Trade history container:', container);
        if (!container) {
            console.error('[Marketplace] Trade history container not found!');
            return;
        }

        // Toggle visibility using computed style
        const computedDisplay = window.getComputedStyle(container).display;
        const isHidden = computedDisplay === 'none';
        console.log('[Marketplace] Computed display:', computedDisplay);
        console.log('[Marketplace] Is hidden:', isHidden);
        
        if (isHidden) {
            // Show and render
            container.style.display = 'block';
            console.log('[Marketplace] ✅ Showing trade history - should be visible now!');
        } else {
            // Hide
            container.style.display = 'none';
            console.log('[Marketplace] ❌ Hiding trade history');
            return;
        }

        if (this.trades.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h4>No trades yet</h4>
                    <p>Trade history will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.trades.map(trade => `
            <div class="trade-item">
                <div class="trade-header">
                    <h5>${trade.groveName}</h5>
                    <span class="trade-date">${new Date(trade.tradeDate).toLocaleDateString()}</span>
                </div>
                <div class="trade-details">
                    <div class="detail-row">
                        <span class="label">Tokens:</span>
                        <span class="value">${trade.tokenAmount}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Price:</span>
                        <span class="value">$${trade.pricePerToken.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Total:</span>
                        <span class="value">$${trade.totalPrice.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Buyer:</span>
                        <span class="value">${this.formatAddress(trade.buyer)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Seller:</span>
                        <span class="value">${this.formatAddress(trade.seller)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Create global marketplace instance
window.marketplace = new CoffeeTreeMarketplace();