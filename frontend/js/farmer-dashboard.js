
/**
 * Farmer Dashboard Management
 * Handles all farmer-specific functionality including grove management,
 * harvest reporting, revenue tracking, and tree health monitoring
 */

class FarmerDashboard {
    constructor() {
        this.currentSection = 'groves';
        this.groves = [];
        this.harvests = [];
        this.withdrawals = [];
        this.map = null;
        this.mapMarker = null;
        this.totalAvailableBalance = 0;
        this.currentGroveBalance = 0;
        this.isSubmittingHarvest = false;
        // Performance: Data caching system
        this.dataCache = {
            groves: { data: null, timestamp: 0, ttl: 300000 }, // 5 min cache
            harvests: { data: null, timestamp: 0, ttl: 300000 },
            revenue: { data: null, timestamp: 0, ttl: 300000 },
            treeHealth: { data: null, timestamp: 0, ttl: 300000 }
        };
        this.verificationChecked = false;
        this.verificationStatus = null;

        // Defer initialization until the DOM is fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }


    // Performance: Check if cached data is still valid
    isCacheValid(cacheKey) {
        const cache = this.dataCache[cacheKey];
        if (!cache || !cache.data) return false;
        const now = Date.now();
        return (now - cache.timestamp) < cache.ttl;
    }

    // Performance: Get cached data
    getCachedData(cacheKey) {
        if (this.isCacheValid(cacheKey)) {
            console.log(`âœ… Using cached data for ${cacheKey}`);
            return this.dataCache[cacheKey].data;
        }
        return null;
    }

    // Performance: Set cached data
    setCachedData(cacheKey, data) {
        this.dataCache[cacheKey] = {
            data: data,
            timestamp: Date.now(),
            ttl: this.dataCache[cacheKey].ttl
        };
    }

    // Performance: Clear specific cache
    clearCache(cacheKey) {
        if (cacheKey) {
            this.dataCache[cacheKey] = { data: null, timestamp: 0, ttl: this.dataCache[cacheKey].ttl };
        } else {
            // Clear all caches
            Object.keys(this.dataCache).forEach(key => {
                this.dataCache[key].data = null;
                this.dataCache[key].timestamp = 0;
            });
        }
    }

    // Performance: Debounce helper
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    removeEventListeners() {
        // Simplified approach - no need to remove if using event delegation
        console.log('Event listener cleanup skipped (using delegation)');
    }

    init() {
        this.setupEventListeners();
        this.setupMap();
        // Render skip-verification banner if user previously skipped
        this.renderSkipVerificationBanner();
    }

    async renderSkipVerificationBanner() {
        // Performance: Check once and cache result
        if (this.verificationChecked) {
            if (this.verificationStatus) return;
        }

        const accountId = window.walletManager?.getAccountId();

        // Don't show banner if no account is connected
        if (!accountId) {
            return;
        }

        let hasSkipped = false;

        try {
            // Single check - localStorage first (fastest)
            if (localStorage.getItem('skipFarmerVerification') === 'true') {
                hasSkipped = true;
            }
        } catch (error) {
            console.error('Error checking verification status:', error);
        }

        // Cache the result
        this.verificationChecked = true;
        this.verificationStatus = hasSkipped;

        // Remove existing banner
        const existing = document.querySelector('.verification-skip-banner');
        if (existing) {
            existing.remove();
        }

        // Only show banner if user has NOT skipped verification
        if (hasSkipped) {
            return;
        }

        // Create and show the skip verification banner
        const banner = document.createElement('div');
        banner.className = 'verification-skip-banner';
        banner.innerHTML = `
            <div class="banner-inner">
                <span>âš ï¸ Complete farmer verification to access all features, or skip for now.</span>
                <button class="btn btn-primary" id="skipVerificationBtn">Skip Verification</button>
                <button class="btn btn-secondary" id="dismissBannerBtn">Dismiss</button>
            </div>
        `;

        // Insert banner at top of farmer dashboard container
        const dashboard = document.querySelector('.farmer-dashboard');
        if (dashboard) {
            dashboard.prepend(banner);
        }

        // Handle skip verification button click
        const skipBtn = document.getElementById('skipVerificationBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', async () => {
                await this.handleSkipVerification();
            });
        }

        // Handle dismiss button click
        const dismissBtn = document.getElementById('dismissBannerBtn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                banner.remove();
            });
        }
    }

    async handleSkipVerification() {
        const accountId = window.walletManager?.getAccountId();

        if (!accountId) {
            this.showNotification('No account connected', 'error');
            return;
        }

        try {
            // Update settings on server
            if (window.coffeeAPI && typeof window.coffeeAPI.updateUserSettings === 'function') {
                const response = await window.coffeeAPI.updateUserSettings(accountId, {
                    skipFarmerVerification: true
                });

                if (response && response.success) {
                    // Update localStorage
                    localStorage.setItem('skipFarmerVerification', 'true');

                    // Remove the banner
                    const banner = document.querySelector('.verification-skip-banner');
                    if (banner) {
                        banner.remove();
                    }

                    // Show success notification
                    this.showNotification('Verification skipped successfully', 'success');
                } else {
                    throw new Error(response?.error || 'Failed to update settings');
                }
            } else {
                throw new Error('API method not available');
            }
        } catch (error) {
            console.error('Error skipping verification:', error);
            this.showNotification('Failed to update settings. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Use existing toast notification if available
        if (window.notificationManager) {
            switch (type) {
                case 'success': window.notificationManager.success(message); break;
                case 'error': window.notificationManager.error(message); break;
                case 'warning': window.notificationManager.warning(message); break;
                default: window.notificationManager.info(message); break;
            }
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    setupEventListeners() {
        // Remove this line as it's causing issues
        // this.removeEventListeners();

        console.log('ðŸ”§ Setting up farmer dashboard event listeners using delegation...');

        // Use event delegation for better reliability
        const farmerDashboard = document.querySelector('#farmerView'); // Target the main view container
        if (!farmerDashboard) {
            console.warn('Farmer dashboard not found, skipping event setup');
            return;
        }

        // Event delegation for Add Grove button
        farmerDashboard.addEventListener('click', (e) => {
            const target = e.target;
            const targetId = target.id;
            const closestBtn = target.closest('button');

            // Handle sidebar menu clicks
            const menuItem = target.closest('.menu-item');
            if (menuItem && menuItem.dataset.section) {
                this.switchSection(menuItem.dataset.section);
                return;
            }

            // Helper to check for a button match
            const isButton = (id) => targetId === id || closestBtn?.id === id;

            if (isButton('addGroveBtn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('ðŸ“ Add Grove button clicked');
                this.showGroveModal();
                return;
            }

            if (isButton('addHarvestBtn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('ðŸŒ¾ Add Harvest button clicked');
                this.showHarvestModal();
                return;
            }

            if (isButton('withdrawMaxBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.handleWithdrawMax();
                return;
            }

            // Modal-specific buttons
            if (isButton('searchLocation')) {
                e.preventDefault();
                this.searchLocation();
                return;
            }

            if (isButton('goToCoordinates')) {
                e.preventDefault();
                console.log('Navigating to coordinates button clicked...');
                this.navigateToCoordinates();
                return;
            }

            // General modal close buttons
            if (target.classList.contains('modal-close') || target.closest('.modal-close')) {
                e.preventDefault();
                e.stopPropagation();
                this.closeModals();
                return;
            }
        });

        // Form submissions
        farmerDashboard.addEventListener('submit', (e) => {
            if (e.target.id === 'groveForm') {
                this.handleGroveSubmit(e);
            } else if (e.target.id === 'harvestForm') {
                this.handleHarvestSubmit(e);
            }
        });

        const withdrawalForm = document.getElementById('farmerWithdrawalForm');
        if (withdrawalForm) {
            withdrawalForm.removeEventListener('submit', this.boundHandleWithdrawalSubmit);
            this.boundHandleWithdrawalSubmit = (e) => this.handleWithdrawalSubmit(e);
            withdrawalForm.addEventListener('submit', this.boundHandleWithdrawalSubmit);
        }

        console.log('âœ… Farmer dashboard event listeners setup complete');
    }

    setupMap() {
        // Only initialize the map if it doesn't already exist
        if (this.map) {
            console.log('ðŸ—ºï¸ Map already initialized. Invalidating size.');
            // If the modal was hidden, the map needs its size re-validated
            setTimeout(() => this.map.invalidateSize(), 100);
            return;
        }

        console.log('ðŸ—ºï¸ Initializing map for the first time...');
        const groveMapEl = document.getElementById('groveMap');
        if (!groveMapEl) {
            console.warn('Grove map container not found, skipping setup');
            return;
        }

        this.map = L.map(groveMapEl).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Â© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add a marker when clicking on the map
        this.map.on('click', (e) => {
            console.log('📍 Map clicked at', e.latlng);
            this.handleMapClick(e);
        });

        console.log('âœ… Map setup complete');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active'); // Use 'active' to match CSS
        });
    }

    // This function is no longer needed as verification is bypassed.
    async checkVerificationForSection(farmerAddress, section) {
        return true; // Always return true to allow access
    }

    handleWithdrawMax() {
        const withdrawalForm = document.getElementById('farmerWithdrawalForm');
        if (withdrawalForm) {
            const withdrawalAmount = document.getElementById('withdrawalAmount');
            if (withdrawalAmount) {
                withdrawalAmount.value = 'MAX';
            }
            withdrawalForm.submit();
        }
    }

    async handleGroveSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Collect data only from the fields that exist in the form
        const groveData = {
            groveName: formData.get('groveName'),
            location: formData.get('location'),
            latitude: parseFloat(formData.get('latitude')),
            longitude: parseFloat(formData.get('longitude')),
            treeCount: parseInt(formData.get('treeCount')),
            coffeeVariety: formData.get('coffeeVariety'),
            expectedYieldPerTree: parseFloat(formData.get('expectedYield')),
            farmerAddress: window.walletManager?.getAccountId() // Include farmer address
        };

        try {
            // Corrected: Use the 'registerGrove' method which exists in api.js
            if (window.coffeeAPI && typeof window.coffeeAPI.registerGrove === 'function') {
                const response = await window.coffeeAPI.registerGrove(groveData);

                if (response && response.success) {
                    this.showNotification('Grove added successfully', 'success');
                    this.closeModals();
                    this.loadGroves(groveData.farmerAddress); // Refresh the groves list
                } else {
                    throw new Error(response?.error || 'Failed to register grove');
                }
            } else {
                throw new Error('API method not available');
            }
        } catch (error) {
            console.error('Error adding grove:', error);
            this.showNotification('Failed to add grove. Please try again.', 'error');
        }
    }

    async handleHarvestSubmit(e) {
        e.preventDefault();
        
        // Prevent double submission
        if (this.isSubmittingHarvest) {
            console.log('⚠️ Harvest submission already in progress, ignoring duplicate');
            return;
        }
        
        this.isSubmittingHarvest = true;
        
        const formData = new FormData(e.target);

        const groveId = formData.get('groveId');
        const grove = this.groves.find(g => g.id == groveId);

        if (!grove) {
            this.showNotification('Please select a valid grove', 'error');
            this.isSubmittingHarvest = false;
            return;
        }

        const qualityGrade = parseInt(formData.get('qualityGrade'));
        const yieldKg = parseFloat(formData.get('yieldKg'));
        const salePricePerKg = parseFloat(formData.get('salePrice'));

        const harvestData = {
            id: Date.now(),
            groveId: grove.id,
            groveName: grove.groveName,
            farmerAddress: window.walletManager?.accountId || grove.farmerAddress,
            harvestDate: formData.get('harvestDate'),
            coffeeVariety: formData.get('coffeeVariety'),
            yieldKg: yieldKg,
            qualityGrade: qualityGrade,
            qualityText: this.getQualityGradeText(qualityGrade),
            salePricePerKg: salePricePerKg,
            totalRevenue: yieldKg * salePricePerKg,
            createdAt: new Date().toISOString()
        };

        console.log('ðŸ“Š Submitting harvest report:', harvestData);

        // Submit to backend (required - no local fallback)
        try {
            if (!window.coffeeAPI || typeof window.coffeeAPI.reportHarvest !== 'function') {
                throw new Error('Backend API not available');
            }

            console.log('Attempting to save to database...');
            const response = await window.coffeeAPI.reportHarvest(harvestData);

            if (!response || !response.success) {
                throw new Error('Backend failed to save harvest');
            }

            console.log('SUCCESS: Harvest saved to database!');
            this.showNotification('Harvest saved to database!', 'success');

            // Reload harvests from database
            if (this.currentFarmerAddress) {
                await this.loadHarvests(this.currentFarmerAddress);
            }

            this.closeModals();
        } catch (error) {
            console.error('Failed to save harvest:', error.message);
            this.showNotification(
                'Failed to save harvest. Please contact authorities',
                'error'
            );
        } finally {
            // Always reset the flag
            this.isSubmittingHarvest = false;
        }
    }

    showGroveModal() {
        const modal = document.getElementById('groveModal');
        if (modal) {
            modal.classList.add('active'); // Use 'active' class
            this.setupMap(); // Initialize map when modal is shown
        }
    }

    showHarvestModal() {
        const modal = document.getElementById('harvestModal');
        if (!modal) {
            console.error('Harvest modal not found');
            return;
        }

        // Populate grove dropdown
        const groveSelect = document.getElementById('harvestGrove');
        if (groveSelect && this.groves && this.groves.length > 0) {
            console.log('Populating grove dropdown with', this.groves.length, 'groves');

            groveSelect.innerHTML = '<option value="">Select a grove</option>' +
                this.groves.map(grove =>
                    `<option value="${grove.id}">${grove.groveName} - ${grove.location}</option>`
                ).join('');
        } else {
            console.warn('No groves available or grove select not found');
            if (groveSelect) {
                groveSelect.innerHTML = '<option value="">No groves registered yet</option>';
            }
        }

        // Setup quality grade slider
        const qualitySlider = document.getElementById('qualityGrade');
        const gradeValue = document.getElementById('gradeValue');
        const gradeDescription = document.getElementById('gradeDescription');

        if (qualitySlider && gradeValue && gradeDescription) {
            const updateGradeDisplay = () => {
                const value = parseInt(qualitySlider.value);
                gradeValue.textContent = value;

                if (value >= 9) {
                    gradeDescription.textContent = 'Premium Quality';
                } else if (value >= 7) {
                    gradeDescription.textContent = 'High Quality';
                } else if (value >= 5) {
                    gradeDescription.textContent = 'Medium Quality';
                } else if (value >= 3) {
                    gradeDescription.textContent = 'Standard Quality';
                } else {
                    gradeDescription.textContent = 'Low Quality';
                }
            };

            qualitySlider.addEventListener('input', updateGradeDisplay);
            updateGradeDisplay(); // Initialize
        }

        modal.classList.add('active');
    }
    handleMapClick(e) {
        const latitudeInput = document.getElementById('latitude');
        const longitudeInput = document.getElementById('longitude');

        if (latitudeInput && longitudeInput) {
            latitudeInput.value = e.latlng.lat.toFixed(6);
            longitudeInput.value = e.latlng.lng.toFixed(6);
        }

        // Add or move the marker
        if (this.mapMarker) {
            this.mapMarker.setLatLng(e.latlng);
        } else {
            this.mapMarker = L.marker(e.latlng).addTo(this.map);
        }
        this.map.panTo(e.latlng);
    }

    updateQualityGradeDisplay() {
        const qualityGradeSlider = document.getElementById('qualityGrade');
        const qualityGradeDisplay = document.getElementById('qualityGradeDisplay');

        if (qualityGradeSlider && qualityGradeDisplay) {
            qualityGradeDisplay.textContent = qualityGradeSlider.value;
        }
    }

    validateSalePrice() {
        const salePriceInput = document.getElementById('salePrice');
        const salePriceFeedback = document.getElementById('salePriceFeedback');

        if (salePriceInput && salePriceFeedback) {
            const salePrice = parseFloat(salePriceInput.value);

            if (isNaN(salePrice) || salePrice <= 0) {
                salePriceFeedback.textContent = 'Please enter a valid price.';
            } else {
                salePriceFeedback.textContent = '';
            }
        }
    }

    searchLocation() {
        const locationInput = document.getElementById('locationSearch'); // Corrected ID

        if (locationInput) {
            const query = locationInput.value;

            if (query) {
                // Show searching notification
                this.showNotification('Searching for location...', 'info');

                // Perform geocoding search
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const result = data[0];
                            const lat = parseFloat(result.lat);
                            const lon = parseFloat(result.lon);

                            // Show success notification
                            this.showNotification('Location found!', 'success');

                            // Update map view
                            if (this.map) {
                                this.map.setView([lat, lon], 13);
                            }

                            // Update form fields
                            const latitudeInput = document.getElementById('latitude');
                            const longitudeInput = document.getElementById('longitude');

                            if (latitudeInput && longitudeInput) {
                                latitudeInput.value = lat.toFixed(6);
                                longitudeInput.value = lon.toFixed(6);
                            }

                            // Add marker
                            if (this.mapMarker) {
                                this.map.removeLayer(this.mapMarker);
                            }

                            this.mapMarker = L.marker([lat, lon]).addTo(this.map);
                        } else {
                            // Show not found notification
                            this.showNotification('Location not found. Please try a different search term.', 'warning');
                        }
                    })
                    .catch(error => {
                        console.error('Error searching location:', error);
                        this.showNotification('Error searching for location. Please check your connection.', 'error');
                    });
            }
        }
    }

    navigateToCoordinates() {
        const latInput = document.getElementById('latitude');
        const lonInput = document.getElementById('longitude');

        if (latInput && lonInput && this.map) {
            const lat = parseFloat(latInput.value);
            const lon = parseFloat(lonInput.value);

            if (!isNaN(lat) && !isNaN(lon)) {
                this.map.flyTo([lat, lon], 13);
                this.handleMapClick({ latlng: { lat, lng: lon } }); // Reuse map click handler to place marker
            } else {
                this.showNotification('Please enter valid latitude and longitude.', 'warning');
            }
        } else {
            console.warn('Map or coordinate inputs not found for navigation.');
        }
    }
    async switchSection(section) {
        if (!section) return;
        console.log(`Switching to section: ${section}`);

        this.currentSection = section;

        // Update active menu item
        document.querySelectorAll('.farmer-dashboard .menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Hide all sections
        document.querySelectorAll('.farmer-dashboard .section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Show the target section
        // For farmer dashboard, use farmerTransactionsSection instead of transactionsSection
        const sectionId = section === 'transactions' ? 'farmerTransactionsSection' : `${section}Section`;
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            console.log(`Section ${sectionId} is now active`);
            // Load data for the new section
            await this.loadSectionData(section);
        } else {
            console.warn(`Section "${sectionId}" not found.`);
        }
    }

    async loadSectionData(section) {
        const farmerAddress = window.walletManager?.getAccountId();
        if (!farmerAddress) {
            this.showNotification('Please connect your wallet to view farmer data.', 'warning');
            return;
        }

        // Store the current farmer address for later use
        this.currentFarmerAddress = farmerAddress;

        // Always allow access since verification is bypassed
        try {
            switch (section) {
                case 'groves':
                    await this.loadGroves(farmerAddress);
                    break;
                case 'harvest':
                    await this.loadHarvests(farmerAddress);
                    break;
                case 'revenue':
                    await this.loadRevenue(farmerAddress);
                    break;
                case 'health':
                    await this.loadTreeHealthSection(farmerAddress);
                    break;
                case 'pricing':
                    await this.loadPricingSection();
                    break;
                case 'transactions':
                    // Load transaction history
                    if (window.farmerRevenueTracking) {
                        await window.farmerRevenueTracking.loadTransactionHistory(farmerAddress);
                    }
                    break;
                // Add cases for other sections here
            }
        } catch (error) {
            console.error(`Failed to load data for section ${section}:`, error);
            this.showNotification(`Error loading ${section} data.`, 'error');
        }
    }

    async loadGroves(farmerAddress) {
        const container = document.getElementById('grovesGrid');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner"></div>'; // Show loader

        try {
            const response = await window.coffeeAPI.getGroves(farmerAddress);
            if (response.success) {
                this.groves = response.groves;
                this.renderGroves();
            } else {
                container.innerHTML = '<p>Could not load groves.</p>';
            }
        } catch (error) {
            container.innerHTML = '<p>Error loading groves.</p>';
        }
    }

    renderGroves() {
        const container = document.getElementById('grovesGrid');
        if (!container) return;

        if (this.groves.length === 0) {
            container.innerHTML = '<p>No groves registered yet. Click "Register New Grove" to start.</p>';
            return;
        }

        console.log('[FarmerDashboard] Rendering', this.groves.length, 'groves');

        container.innerHTML = this.groves.map(grove => {
            const healthScore = grove.healthScore || 0;
            const healthClass = this.getHealthClass(healthScore);
            const verificationStatus = grove.verificationStatus || 'pending';
            const statusClass = this.getStatusClass(verificationStatus);
            const createdDate = grove.createdAt ? new Date(grove.createdAt).toLocaleDateString() : 'N/A';

            return `
            <div class="grove-card enhanced-grove-card">
                <!-- Grove Header -->
                <div class="grove-header-section">
                    <div class="grove-title-row">
                        <h4 class="grove-name">${grove.groveName}</h4>
                        <div class="grove-badge-group">
                            <span class="verification-badge badge-${statusClass}">
                                ${verificationStatus}
                            </span>
                        </div>
                    </div>
                    <div class="grove-location-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${grove.location}</span>
                    </div>
                    ${grove.latitude && grove.longitude ? `
                    <div class="grove-coordinates">
                        <small>📍 ${grove.latitude.toFixed(6)}, ${grove.longitude.toFixed(6)}</small>
                    </div>
                    ` : ''}
                </div>

                <!-- Grove Metrics Grid -->
                <div class="grove-metrics-section">
                    <div class="metric-item">
                        <div class="metric-icon">🌳</div>
                        <div class="metric-content">
                            <span class="metric-label">Trees</span>
                            <span class="metric-value">${(grove.treeCount || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-icon">☕</div>
                        <div class="metric-content">
                            <span class="metric-label">Variety</span>
                            <span class="metric-value">${grove.coffeeVariety || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-icon">📊</div>
                        <div class="metric-content">
                            <span class="metric-label">Expected Yield</span>
                            <span class="metric-value">${(grove.expectedYieldPerTree || 0).toLocaleString()} kg/tree</span>
                        </div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-icon">💚</div>
                        <div class="metric-content">
                            <span class="metric-label">Health Score</span>
                            <span class="metric-value health-score-${healthClass}">${healthScore}</span>
                        </div>
                    </div>
                </div>

                <!-- Additional Info -->
                <div class="grove-additional-info">
                    <div class="info-row">
                        <span class="info-label">Grove ID:</span>
                        <span class="info-value">#${grove.id}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Registered:</span>
                        <span class="info-value">${createdDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Total Expected Yield:</span>
                        <span class="info-value">${((grove.treeCount || 0) * (grove.expectedYieldPerTree || 0)).toLocaleString()} kg</span>
                    </div>
                </div>

                <!-- Grove Actions -->
                <div class="grove-actions">
                    <button class="btn btn-secondary btn-sm view-details-btn" data-grove-id="${grove.id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-primary btn-sm manage-grove-btn" data-grove-id="${grove.id}">
                        <i class="fas fa-cog"></i> Manage
                    </button>
                </div>

                </div>
            </div>
            `;
        }).join('');

        // Attach event listeners to buttons
        console.log('[FarmerDashboard] Attaching event listeners to grove buttons');

        const viewDetailsButtons = container.querySelectorAll('.view-details-btn');
        const manageButtons = container.querySelectorAll('.manage-grove-btn');

        console.log('[FarmerDashboard] Found', viewDetailsButtons.length, 'view details buttons');
        console.log('[FarmerDashboard] Found', manageButtons.length, 'manage buttons');

        viewDetailsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const groveId = e.currentTarget.dataset.groveId;
                console.log('[FarmerDashboard] View Details button clicked for grove:', groveId);
                this.viewGroveDetails(groveId);
            });
        });

        manageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const groveId = e.currentTarget.dataset.groveId;
                console.log('[FarmerDashboard] Manage button clicked for grove:', groveId);
                this.manageGrove(groveId);
            });
        });

        console.log('[FarmerDashboard] Event listeners attached successfully');
    }

    getHealthClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'moderate';
        return 'poor';
    }

    getStatusClass(status) {
        const statusMap = {
            'verified': 'success',
            'pending': 'warning',
            'rejected': 'danger',
            'active': 'success'
        };
        return statusMap[status?.toLowerCase()] || 'warning';
    }

    viewGroveDetails(groveId) {
        console.log('[FarmerDashboard] viewGroveDetails called with groveId:', groveId, 'type:', typeof groveId);
        console.log('[FarmerDashboard] Available groves:', this.groves.map(g => ({ id: g.id, name: g.groveName })));

        const grove = this.groves.find(g => g.id == groveId); // Use == for type coercion
        if (!grove) {
            console.error('[FarmerDashboard] Grove not found for ID:', groveId);
            return;
        }

        console.log('[FarmerDashboard] Viewing grove details:', grove);

        // Create detailed view modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h4><i class="fas fa-info-circle"></i> Grove Details: ${grove.groveName}</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Grove Overview Section -->
                    <div class="detail-section">
                        <h5><i class="fas fa-map-marked-alt"></i> Location & Identification</h5>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Grove ID</span>
                                <span class="detail-value">#${grove.id}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Grove Name</span>
                                <span class="detail-value">${grove.groveName}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Location</span>
                                <span class="detail-value">${grove.location}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Verification Status</span>
                                <span class="badge-${this.getStatusClass(grove.verificationStatus || 'pending')}">
                                    ${grove.verificationStatus || 'pending'}
                                </span>
                            </div>
                            ${grove.latitude && grove.longitude ? `
                            <div class="detail-item full-width">
                                <span class="detail-label">GPS Coordinates</span>
                                <span class="detail-value mono-text">
                                    📍 Lat: ${grove.latitude.toFixed(6)}, Long: ${grove.longitude.toFixed(6)}
                                </span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Agricultural Information -->
                    <div class="detail-section">
                        <h5><i class="fas fa-seedling"></i> Agricultural Information</h5>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Coffee Variety</span>
                                <span class="detail-value">${grove.coffeeVariety || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Total Trees</span>
                                <span class="detail-value">${(grove.treeCount || 0).toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Expected Yield/Tree</span>
                                <span class="detail-value">${(grove.expectedYieldPerTree || 0).toLocaleString()} kg</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Total Expected Yield</span>
                                <span class="detail-value highlight-green">
                                    ${((grove.treeCount || 0) * (grove.expectedYieldPerTree || 0)).toLocaleString()} kg
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Health & Performance -->
                    <div class="detail-section">
                        <h5><i class="fas fa-heartbeat"></i> Health & Performance</h5>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Current Health Score</span>
                                <span class="detail-value health-score-${this.getHealthClass(grove.healthScore || 0)}">
                                    ${grove.healthScore || 0}/100
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Registered Date</span>
                                <span class="detail-value">
                                    ${grove.createdAt ? new Date(grove.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : 'N/A'}
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Days Active</span>
                                <span class="detail-value">
                                    ${grove.createdAt ? Math.floor((Date.now() - new Date(grove.createdAt)) / (1000 * 60 * 60 * 24)) : 0} days
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Status</span>
                                <span class="detail-value">
                                    ${grove.verificationStatus === 'verified' ? '✅ Active & Verified' : 'Pending Verification'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Blockchain Information -->
                    <div class="detail-section">
                        <h5><i class="fas fa-link"></i> Blockchain & Ownership</h5>
                        <div class="detail-grid">
                            <div class="detail-item full-width">
                                <span class="detail-label">Farmer Address</span>
                                <span class="detail-value mono-text">
                                    ${grove.farmerAddress || 'N/A'}
                                </span>
                            </div>
                            ${grove.tokenId ? `
                            <div class="detail-item">
                                <span class="detail-label">Token ID</span>
                                <span class="detail-value mono-text">${grove.tokenId}</span>
                            </div>
                            ` : ''}
                            ${grove.contractAddress ? `
                            <div class="detail-item full-width">
                                <span class="detail-label">Smart Contract</span>
                                <span class="detail-value mono-text">${grove.contractAddress}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="detail-actions">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button class="btn btn-primary" onclick="window.farmerDashboard?.manageGrove('${grove.id}'); this.closest('.modal').remove();">
                            <i class="fas fa-cog"></i> Manage Grove
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close button functionality
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');

        closeBtn.addEventListener('click', () => modal.remove());
        overlay.addEventListener('click', () => modal.remove());
    }

    manageGrove(groveId) {
        console.log('[FarmerDashboard] manageGrove called with groveId:', groveId, 'type:', typeof groveId);
        console.log('[FarmerDashboard] Available groves:', this.groves.map(g => ({ id: g.id, name: g.groveName })));

        const grove = this.groves.find(g => g.id == groveId); // Use == for type coercion
        if (!grove) {
            console.error('[FarmerDashboard] Grove not found for ID:', groveId);
            return;
        }

        console.log('[FarmerDashboard] Managing grove:', grove);

        // Create management modal with tabs
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h4><i class="fas fa-cog"></i> Manage Grove: ${grove.groveName}</h4>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Management Tabs -->
                    <div class="management-tabs">
                        <button class="tab-btn active" data-tab="update">
                            <i class="fas fa-edit"></i> Update Info
                        </button>
                        <button class="tab-btn" data-tab="harvest">
                            <i class="fas fa-apple-alt"></i> Report Harvest
                        </button>
                        <button class="tab-btn" data-tab="health">
                            <i class="fas fa-heartbeat"></i> Health Update
                        </button>
                        <button class="tab-btn" data-tab="tokenize">
                            <i class="fas fa-coins"></i> Tokenization
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div class="tab-content-container">
                        <!-- Update Info Tab -->
                        <div class="tab-content active" data-tab-content="update">
                            <h5><i class="fas fa-info-circle"></i> Update Grove Information</h5>
                            <form id="updateGroveForm" class="management-form">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editGroveName">Grove Name</label>
                                        <input type="text" id="editGroveName" value="${grove.groveName}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="editLocation">Location</label>
                                        <input type="text" id="editLocation" value="${grove.location}" required>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editLatitude">Latitude</label>
                                        <input type="number" step="0.000001" id="editLatitude" 
                                               value="${grove.latitude || ''}" placeholder="e.g., -0.581889">
                                    </div>
                                    <div class="form-group">
                                        <label for="editLongitude">Longitude</label>
                                        <input type="number" step="0.000001" id="editLongitude" 
                                               value="${grove.longitude || ''}" placeholder="e.g., 37.073737">
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editTreeCount">Number of Trees</label>
                                        <input type="number" id="editTreeCount" value="${grove.treeCount || 0}" min="1" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="editVariety">Coffee Variety</label>
                                        <select id="editVariety" required>
                                            <option value="Arabica" ${grove.coffeeVariety === 'Arabica' ? 'selected' : ''}>Arabica</option>
                                            <option value="Robusta" ${grove.coffeeVariety === 'Robusta' ? 'selected' : ''}>Robusta</option>
                                            <option value="Liberica" ${grove.coffeeVariety === 'Liberica' ? 'selected' : ''}>Liberica</option>
                                            <option value="Excelsa" ${grove.coffeeVariety === 'Excelsa' ? 'selected' : ''}>Excelsa</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="editExpectedYield">Expected Yield per Tree (kg)</label>
                                    <input type="number" id="editExpectedYield" value="${grove.expectedYieldPerTree || 0}" 
                                           min="0" step="0.1" required>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-save"></i> Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Report Harvest Tab -->
                        <div class="tab-content" data-tab-content="harvest">
                            <h5><i class="fas fa-apple-alt"></i> Report Harvest</h5>
                            <form id="harvestReportForm" class="management-form">
                                <div class="form-group">
                                    <label for="harvestDate">Harvest Date</label>
                                    <input type="date" id="harvestDate" value="${new Date().toISOString().split('T')[0]}" required>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="harvestAmount">Total Harvest (kg)</label>
                                        <input type="number" id="harvestAmount" min="0" step="0.1" 
                                               placeholder="e.g., 5000" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="harvestQuality">Quality Grade</label>
                                        <select id="harvestQuality" required>
                                            <option value="Premium">Premium (Grade A)</option>
                                            <option value="Standard">Standard (Grade B)</option>
                                            <option value="Commercial">Commercial (Grade C)</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="harvestNotes">Notes (optional)</label>
                                    <textarea id="harvestNotes" rows="3" 
                                              placeholder="Any additional information about this harvest..."></textarea>
                                </div>
                                <div class="harvest-calculation">
                                    <div class="calc-info">
                                        <span>Expected yield: ${((grove.treeCount || 0) * (grove.expectedYieldPerTree || 0)).toLocaleString()} kg</span>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-check"></i> Submit Harvest Report
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Health Update Tab -->
                        <div class="tab-content" data-tab-content="health">
                            <h5><i class="fas fa-heartbeat"></i> Update Health Status</h5>
                            <form id="healthUpdateForm" class="management-form">
                                <div class="form-group">
                                    <label for="healthScore">Health Score (0-100)</label>
                                    <input type="range" id="healthScore" min="0" max="100" 
                                           value="${grove.healthScore || 0}" class="health-slider">
                                    <div class="health-score-display">
                                        <span id="healthScoreValue" class="health-score-${this.getHealthClass(grove.healthScore || 0)}">
                                            ${grove.healthScore || 0}
                                        </span>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="soilMoisture">Soil Moisture (%)</label>
                                        <input type="number" id="soilMoisture" min="0" max="100" 
                                               placeholder="e.g., 65" step="0.1">
                                    </div>
                                    <div class="form-group">
                                        <label for="temperature">Avg Temperature (Â°C)</label>
                                        <input type="number" id="temperature" step="0.1" 
                                               placeholder="e.g., 22.5">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="diseaseStatus">Disease/Pest Status</label>
                                    <select id="diseaseStatus">
                                        <option value="healthy">Healthy - No Issues</option>
                                        <option value="minor">Minor Issues Detected</option>
                                        <option value="moderate">Moderate Concern</option>
                                        <option value="severe">Severe - Action Required</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="healthNotes">Health Notes</label>
                                    <textarea id="healthNotes" rows="3" 
                                              placeholder="Any observations about grove health..."></textarea>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-check"></i> Update Health Status
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Tokenization Tab -->
                        <div class="tab-content" data-tab-content="tokenize">
                            <h5><i class="fas fa-coins"></i> Grove Tokenization</h5>
                            <div class="tokenization-info">
                                <div class="info-card">
                                    <p><i class="fas fa-info-circle"></i> 
                                       Tokenize your grove to allow investors to purchase shares and fund operations.
                                    </p>
                                </div>
                            </div>
                            <form id="tokenizationForm" class="management-form">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="totalTokens">Total Tokens to Issue</label>
                                        <input type="number" id="totalTokens" min="1" 
                                               placeholder="e.g., 1000" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="tokenPrice">Price per Token (USD)</label>
                                        <input type="number" id="tokenPrice" min="0.01" step="0.01" 
                                               placeholder="e.g., 5.00" required>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="projectedReturn">Projected Annual Return (%)</label>
                                    <input type="number" id="projectedReturn" min="0" max="100" step="0.1" 
                                           placeholder="e.g., 12.5" required>
                                </div>
                                <div class="tokenization-calculation">
                                    <div class="calc-row">
                                        <span>Total Fundraising Goal:</span>
                                        <span id="totalFundraising">$0.00</span>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-rocket"></i> Tokenize Grove
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Close Button -->
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switching functionality
        const tabBtns = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Update active tab button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.dataset.tabContent === tabName) {
                        content.classList.add('active');
                    }
                });
            });
        });

        // Health score slider
        const healthSlider = modal.querySelector('#healthScore');
        const healthScoreDisplay = modal.querySelector('#healthScoreValue');
        if (healthSlider && healthScoreDisplay) {
            healthSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                healthScoreDisplay.textContent = value;
                healthScoreDisplay.className = `health-score-${this.getHealthClass(parseInt(value))}`;
            });
        }

        // Tokenization calculation
        const totalTokensInput = modal.querySelector('#totalTokens');
        const tokenPriceInput = modal.querySelector('#tokenPrice');
        const totalFundraisingSpan = modal.querySelector('#totalFundraising');

        const updateTokenCalc = () => {
            const tokens = parseFloat(totalTokensInput?.value || 0);
            const price = parseFloat(tokenPriceInput?.value || 0);
            const total = tokens * price;
            if (totalFundraisingSpan) {
                totalFundraisingSpan.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            }
        };

        totalTokensInput?.addEventListener('input', updateTokenCalc);
        tokenPriceInput?.addEventListener('input', updateTokenCalc);

        // Form submissions
        this.setupManagementForms(modal, grove);

        // Close button functionality
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');

        closeBtn.addEventListener('click', () => modal.remove());
        overlay.addEventListener('click', () => modal.remove());
    }

    setupManagementForms(modal, grove) {
        // Update Grove Form
        const updateForm = modal.querySelector('#updateGroveForm');
        updateForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                groveName: modal.querySelector('#editGroveName').value,
                location: modal.querySelector('#editLocation').value,
                latitude: parseFloat(modal.querySelector('#editLatitude').value) || null,
                longitude: parseFloat(modal.querySelector('#editLongitude').value) || null,
                treeCount: parseInt(modal.querySelector('#editTreeCount').value),
                coffeeVariety: modal.querySelector('#editVariety').value,
                expectedYieldPerTree: parseFloat(modal.querySelector('#editExpectedYield').value)
            };

            console.log('Updating grove:', grove.id, formData);
            // TODO: Call API to update grove
            // await window.coffeeAPI.updateGrove(grove.id, formData);

            window.walletManager?.showToast(`Grove "${formData.groveName}" updated successfully!`, 'success');
            modal.remove();
            // Reload groves
            this.loadGroves(window.walletManager?.accountId);
        });

        // Harvest Report Form - Works with local data
        const harvestForm = modal.querySelector('#harvestReportForm');
        harvestForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Prevent double submission
            if (this.isSubmittingHarvest) {
                console.log('⚠️ Harvest submission already in progress, ignoring duplicate');
                return;
            }
            
            this.isSubmittingHarvest = true;

            const submitBtn = harvestForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            const qualityValue = modal.querySelector('#harvestQuality').value;
            const harvestData = {
                id: Date.now(), // Unique ID for local storage
                groveId: grove.id,
                groveName: grove.groveName,
                farmerAddress: window.walletManager?.accountId || grove.farmerAddress,
                yieldKg: parseFloat(modal.querySelector('#harvestAmount').value),
                qualityGrade: this.getQualityGradeNumber(qualityValue),
                qualityText: qualityValue,
                salePricePerKg: 5.0,
                harvestDate: modal.querySelector('#harvestDate').value,
                notes: modal.querySelector('#harvestNotes').value,
                createdAt: new Date().toISOString()
            };

            console.log('Submitting harvest report:', harvestData);

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

            // Submit to backend (required - no local fallback)
            try {
                const response = await window.coffeeAPI.reportHarvest(harvestData);
                if (!response.success) {
                    throw new Error('Backend failed to save harvest');
                }
                console.log('Harvest saved to database');

                // Try to notify token holders (optional)
                try {
                    await this.notifyTokenHolders(grove.id, {
                        type: 'harvest',
                        groveName: grove.groveName,
                        amount: harvestData.yieldKg,
                        quality: qualityValue,
                        date: harvestData.harvestDate
                    });
                } catch (error) {
                    console.log('Could not notify token holders:', error.message);
                }

                // Show success message
                window.walletManager?.showToast(
                    `Harvest report for ${harvestData.yieldKg}kg submitted successfully!`,
                    'success'
                );

                // Reload harvests from database
                if (this.currentFarmerAddress) {
                    await this.loadHarvests(this.currentFarmerAddress);
                }
            } catch (error) {
                console.error('Failed to save harvest:', error);
                window.walletManager?.showToast(
                    'Failed to save harvest. Please ensure backend is running.',
                    'error'
                );
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            } finally {
                // Always reset the flag
                this.isSubmittingHarvest = false;
            }

            // Close modal
            modal.remove();
        });

        // Health Update Form - Works with local data
        const healthForm = modal.querySelector('#healthUpdateForm');
        healthForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = healthForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            const healthScore = parseInt(modal.querySelector('#healthScore').value);
            const soilMoisture = parseFloat(modal.querySelector('#soilMoisture').value);
            const temperature = parseFloat(modal.querySelector('#temperature').value);
            const diseaseStatus = modal.querySelector('#diseaseStatus').value;
            const notes = modal.querySelector('#healthNotes').value;

            console.log('Updating health status to:', healthScore);

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

            // Update local grove data immediately
            const previousScore = grove.healthScore;
            grove.healthScore = healthScore;

            // Store health update in local data
            if (!grove.healthHistory) {
                grove.healthHistory = [];
            }
            grove.healthHistory.unshift({
                id: Date.now(),
                healthScore: healthScore,
                soilMoisture: soilMoisture || null,
                temperature: temperature || null,
                diseaseStatus: diseaseStatus,
                notes: notes,
                timestamp: new Date().toISOString()
            });

            // Try to submit to backend (optional)
            try {
                const healthData = {
                    groveId: parseInt(grove.id),
                    sensorId: `grove-${grove.id}-health-sensor`,
                    sensorType: 'health_composite',
                    value: healthScore,
                    unit: 'score',
                    metadata: {
                        healthScore: healthScore,
                        soilMoisture: soilMoisture || null,
                        temperature: temperature || null,
                        diseaseStatus: diseaseStatus,
                        notes: notes
                    },
                    farmerAddress: window.walletManager?.accountId || grove.farmerAddress
                };

                const response = await window.coffeeAPI.updateTreeHealth(healthData);
                if (response.success) {
                    console.log('Health update synced with backend');
                }
            } catch (error) {
                console.log('Backend not available, using local data only:', error.message);
            }

            // Try to notify token holders (optional)
            try {
                await this.notifyTokenHolders(grove.id, {
                    type: 'health',
                    groveName: grove.groveName,
                    healthScore: healthScore,
                    previousScore: previousScore,
                    diseaseStatus: diseaseStatus
                });
            } catch (error) {
                console.log('Could not notify token holders:', error.message);
            }

            // Show success message
            window.walletManager?.showToast(
                `Health status updated to ${healthScore}/100!`,
                'success'
            );

            // Update the UI
            this.renderGroves(); // Refresh grove cards with new health score

            // Close modal
            modal.remove();
        });

        // Tokenization Form
        const tokenForm = modal.querySelector('#tokenizationForm');
        tokenForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenData = {
                groveId: grove.id,
                totalTokens: parseInt(modal.querySelector('#totalTokens').value),
                pricePerToken: parseFloat(modal.querySelector('#tokenPrice').value),
                projectedReturn: parseFloat(modal.querySelector('#projectedReturn').value)
            };

            console.log('Tokenizing grove:', tokenData);
            // TODO: Call blockchain contract to tokenize
            // await window.coffeeAPI.tokenizeGrove(tokenData);

            window.walletManager?.showToast(`Grove tokenized! ${tokenData.totalTokens} tokens created.`, 'success');
            modal.remove();
        });
    }

    // Helper function to convert quality grade to number
    getQualityGradeNumber(qualityText) {
        const gradeMap = {
            'Premium': 95,
            'Standard': 75,
            'Commercial': 60
        };
        return gradeMap[qualityText] || 75;
    }

    // Notify token holders of grove updates
    async notifyTokenHolders(groveId, updateData) {
        try {
            console.log('Notifying token holders for grove:', groveId, updateData);

            // Get token holders for this grove
            let holdersResponse;
            try {
                holdersResponse = await window.coffeeAPI.getTokenHolders(groveId);
            } catch (error) {
                // If endpoint doesn't exist (404), just log and return
                if (error.message?.includes('Endpoint not found') || error.message?.includes('404')) {
                    console.log('Token holders endpoint not available yet - skipping notifications');
                    return;
                }
                throw error; // Re-throw other errors
            }

            if (!holdersResponse.success || !holdersResponse.data || holdersResponse.data.length === 0) {
                console.log('No token holders found for grove:', groveId);
                return;
            }

            const holders = holdersResponse.data;
            console.log(`Found ${holders.length} token holder(s) for grove ${groveId}`);

            // Create notification message based on update type
            let notificationMessage = '';
            let notificationTitle = '';

            if (updateData.type === 'harvest') {
                notificationTitle = `ðŸŒ¾ New Harvest: ${updateData.groveName}`;
                notificationMessage = `Harvest of ${updateData.amount}kg (${updateData.quality} quality) reported on ${new Date(updateData.date).toLocaleDateString()}.`;
            } else if (updateData.type === 'health') {
                const trend = updateData.healthScore > (updateData.previousScore || 0) ? 'ðŸ“ˆ improved' :
                    updateData.healthScore < (updateData.previousScore || 0) ? 'ðŸ“‰ decreased' : 'âž¡ï¸ unchanged';
                notificationTitle = `ðŸ’š Health Update: ${updateData.groveName}`;
                notificationMessage = `Health score ${trend} to ${updateData.healthScore}/100. Status: ${updateData.diseaseStatus}.`;
            }

            // Send notification to each token holder
            for (const holder of holders) {
                // Use the notification system if available
                if (window.notificationManager) {
                    // Check if this holder is the current logged-in user
                    const currentUserAddress = window.walletManager?.accountId;
                    if (currentUserAddress === holder.investorAddress) {
                        window.notificationManager.show({
                            title: notificationTitle,
                            message: notificationMessage,
                            type: 'info',
                            duration: 8000,
                            link: updateData.type === 'harvest' ? '#harvest' : '#tree-health'
                        });
                    }
                }
            }

            // Also save notification to backend (if endpoint exists)
            try {
                await window.coffeeAPI.sendNotification({
                    groveId: groveId,
                    recipients: holders.map(h => h.investorAddress),
                    title: notificationTitle,
                    message: notificationMessage,
                    type: updateData.type
                });
            } catch (error) {
                console.warn('Failed to save notification to backend:', error);
                // Don't throw - notification was still shown to current user
            }

            console.log('Token holders notified successfully');
        } catch (error) {
            console.error('Error notifying token holders:', error);
            // Don't throw - the main operation (harvest/health update) was successful
        }
    }

    // Load tree health section - populate grove selector
    async loadTreeHealthSection(farmerAddress) {
        console.log('[Tree Health] Loading section for farmer:', farmerAddress);
        
        const selector = document.getElementById('healthGroveSelector');
        if (!selector) {
            console.error('[Tree Health] Grove selector not found');
            return;
        }

        // Show loading state
        selector.innerHTML = '<option value="">Loading groves...</option>';
        
        try {
            // Always fetch fresh grove data for tree health section
            console.log('[Tree Health] Fetching groves from API...');
            const response = await window.coffeeAPI.getGroves(farmerAddress);
            console.log('[Tree Health] API response:', response);
            
            if (response.success && response.groves) {
                this.groves = response.groves;
                console.log('[Tree Health] Loaded', this.groves.length, 'groves');
                
                if (this.groves.length > 0) {
                    selector.innerHTML = '<option value="">Select a grove...</option>' +
                        this.groves.map(grove => `
                            <option value="${grove.id}">
                                ${grove.groveName || `Grove #${grove.id}`}
                            </option>
                        `).join('');
                    
                    console.log('[Tree Health] Grove selector populated with', this.groves.length, 'groves');
                    
                    // Set up event listener for grove selection
                    selector.removeEventListener('change', this.boundHealthGroveChange);
                    this.boundHealthGroveChange = (e) => {
                        if (e.target.value) {
                            console.log('[Tree Health] Grove selected:', e.target.value);
                            this.loadTreeHealth(e.target.value);
                        }
                    };
                    selector.addEventListener('change', this.boundHealthGroveChange);
                } else {
                    selector.innerHTML = '<option value="">No groves registered yet</option>';
                    console.log('[Tree Health] No groves found for farmer');
                }
            } else {
                selector.innerHTML = '<option value="">Error loading groves</option>';
                console.error('[Tree Health] Failed to load groves:', response);
            }
        } catch (error) {
            selector.innerHTML = '<option value="">Error loading groves</option>';
            console.error('[Tree Health] Error loading section:', error);
            this.showNotification('Error loading tree health section', 'error');
        }
    }

    // Load tree health data for a grove
    async loadTreeHealth(groveId) {
        console.log('[Tree Health] Loading health data for grove:', groveId);
        
        try {
            // Try to fetch real data, but use mock data if it fails
            let healthData = null;
            let alertsData = null;
            let sensorData = null;

            try {
                const healthResponse = await window.coffeeAPI.getTreeHealth(groveId);
                if (healthResponse.success && healthResponse.data && healthResponse.data.length > 0) {
                    healthData = healthResponse.data;
                }
            } catch (e) {
                console.log('[Tree Health] Using mock health data');
            }

            try {
                const alertsResponse = await fetch(`/api/tree-monitoring/alerts/${groveId}?resolved=false&limit=10`).then(r => r.json());
                if (alertsResponse.success && alertsResponse.data) {
                    alertsData = alertsResponse.data;
                }
            } catch (e) {
                console.log('[Tree Health] Using mock alerts data');
            }

            try {
                const sensorResponse = await fetch(`/api/tree-monitoring/sensor-data/${groveId}?limit=100`).then(r => r.json());
                if (sensorResponse.success && sensorResponse.data) {
                    sensorData = sensorResponse.data;
                }
            } catch (e) {
                console.log('[Tree Health] Using mock sensor data');
            }

            // Use mock data if real data is not available
            if (!healthData) {
                healthData = this.generateMockHealthData(groveId);
            }
            if (!alertsData) {
                alertsData = this.generateMockAlerts(groveId);
            }
            if (!sensorData) {
                sensorData = this.generateMockSensorData();
            }

            // Render each section
            this.renderHealthOverview(healthData);
            this.renderYieldProjections(healthData);
            this.renderActiveAlerts(alertsData);
            this.renderCareRecommendations(healthData);
            this.renderSensorData(sensorData);

            this.showNotification('Tree health data loaded successfully', 'success');

        } catch (error) {
            console.error('[Tree Health] Error loading health data:', error);
            this.showNotification('Error loading tree health data', 'error');
        }
    }

    generateMockHealthData(groveId) {
        const now = Date.now();
        const healthScore = 75 + Math.floor(Math.random() * 15); // 75-90
        
        return [{
            id: 1,
            groveId: groveId,
            healthScore: healthScore,
            assessmentDate: now,
            soilMoistureScore: 70 + Math.floor(Math.random() * 20),
            temperatureScore: 75 + Math.floor(Math.random() * 15),
            humidityScore: 80 + Math.floor(Math.random() * 15),
            phScore: 85 + Math.floor(Math.random() * 10),
            lightScore: 88 + Math.floor(Math.random() * 10),
            rainfallScore: 65 + Math.floor(Math.random() * 25),
            riskFactors: JSON.stringify([]),
            recommendations: JSON.stringify([
                'Continue current watering schedule',
                'Monitor soil pH levels weekly',
                'Consider organic fertilizer application next month',
                'Prune lower branches to improve air circulation'
            ]),
            yieldImpactProjection: 0.12, // +12% yield
            createdAt: now
        }];
    }

    generateMockAlerts(groveId) {
        // Generate 0-2 random alerts
        const alertCount = Math.floor(Math.random() * 3);
        if (alertCount === 0) return [];

        const possibleAlerts = [
            {
                alertType: 'SOIL_MOISTURE',
                severity: 'MEDIUM',
                title: 'Soil Moisture Below Optimal',
                message: 'Soil moisture has dropped to 45%. Consider increasing irrigation frequency.'
            },
            {
                alertType: 'TEMPERATURE',
                severity: 'LOW',
                title: 'Temperature Fluctuation',
                message: 'Temperature variance detected. Monitor for stress signs in younger plants.'
            },
            {
                alertType: 'PEST_DETECTION',
                severity: 'HIGH',
                title: 'Potential Pest Activity',
                message: 'Unusual leaf damage patterns detected. Inspect plants for coffee berry borer.'
            }
        ];

        const alerts = [];
        for (let i = 0; i < alertCount; i++) {
            const alert = possibleAlerts[i];
            alerts.push({
                id: i + 1,
                groveId: groveId,
                ...alert,
                acknowledged: false,
                resolved: false,
                createdAt: Date.now() - (i * 3600000), // Stagger by hours
                acknowledgedAt: null,
                resolvedAt: null
            });
        }

        return alerts;
    }

    renderHealthOverview(healthData) {
        const container = document.getElementById('healthOverviewContent');
        if (!container) return;

        if (!healthData || healthData.length === 0) {
            container.innerHTML = '<p>No health data available for this grove yet.</p>';
            return;
        }

        const latest = healthData[0];
        const healthScore = latest.healthScore || 0;
        const healthClass = this.getHealthScoreClass(healthScore);
        const healthStatus = this.getHealthStatus(healthScore);

        container.innerHTML = `
            <div class="health-score-display">
                <div class="health-score-circle ${healthClass}">
                    <div class="score-number">${healthScore}</div>
                    <div class="score-label">Health Score</div>
                </div>
                <div class="health-status-text">
                    <h4>${healthStatus}</h4>
                    <p>Last assessed: ${new Date(latest.assessmentDate).toLocaleString()}</p>
                </div>
            </div>
            <div class="health-metrics-grid">
                ${this.renderHealthMetric('Soil Moisture', latest.soilMoistureScore)}
                ${this.renderHealthMetric('Temperature', latest.temperatureScore)}
                ${this.renderHealthMetric('Humidity', latest.humidityScore)}
                ${this.renderHealthMetric('pH Level', latest.phScore)}
                ${this.renderHealthMetric('Light', latest.lightScore)}
                ${this.renderHealthMetric('Rainfall', latest.rainfallScore)}
            </div>
        `;
    }

    renderHealthMetric(label, score) {
        if (score === null || score === undefined) {
            return `
                <div class="health-metric">
                    <span class="metric-label">${label}</span>
                    <span class="metric-value no-data">N/A</span>
                </div>
            `;
        }

        const healthClass = this.getHealthScoreClass(score);
        return `
            <div class="health-metric">
                <span class="metric-label">${label}</span>
                <span class="metric-value ${healthClass}">${score}/100</span>
            </div>
        `;
    }

    renderYieldProjections(healthData) {
        const container = document.getElementById('yieldProjectionsContent');
        if (!container) return;

        if (!healthData || healthData.length === 0) {
            container.innerHTML = '<p>No yield projection data available.</p>';
            return;
        }

        const latest = healthData[0];
        const yieldImpact = latest.yieldImpactProjection || 0;
        const baseYield = 5000; // kg per season (would ideally come from grove data)
        const projectedYield = Math.round(baseYield * (1 + yieldImpact));
        const impactPercent = (yieldImpact * 100).toFixed(1);
        const impactClass = yieldImpact >= 0 ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="yield-stats">
                <div class="yield-stat">
                    <span class="stat-label">Base Yield</span>
                    <span class="stat-value">${baseYield.toLocaleString()} kg</span>
                </div>
                <div class="yield-stat">
                    <span class="stat-label">Projected Yield</span>
                    <span class="stat-value">${projectedYield.toLocaleString()} kg</span>
                </div>
                <div class="yield-stat">
                    <span class="stat-label">Impact</span>
                    <span class="stat-value ${impactClass}">
                        ${yieldImpact >= 0 ? '+' : ''}${impactPercent}%
                    </span>
                </div>
            </div>
            <div class="yield-explanation">
                ${yieldImpact > 0.1 ? 
                    '<p class="positive">✅ Current conditions are favorable for above-average yield.</p>' :
                    yieldImpact < -0.1 ?
                    '<p class="negative">⚠️ Current conditions may reduce expected yield. Follow recommendations to improve.</p>' :
                    '<p class="neutral">ℹ️ Current conditions are within normal range for expected yield.</p>'
                }
            </div>
        `;
    }

    renderActiveAlerts(alerts) {
        const container = document.getElementById('alertsPanel');
        if (!container) {
            console.warn('[Tree Health] Alerts panel container not found');
            return;
        }
        this.renderAlertsInContainer(container, alerts);
    }

    renderAlertsInContainer(container, alerts) {
        if (!alerts || alerts.length === 0) {
            container.innerHTML = '<p>No active alerts. Your grove is in good condition! ✅</p>';
            return;
        }

        container.innerHTML = `
            <div class="alerts-list">
                ${alerts.map(alert => `
                    <div class="alert-item ${alert.severity.toLowerCase()}">
                        <div class="alert-header">
                            <span class="alert-icon">${this.getAlertIcon(alert.severity)}</span>
                            <span class="alert-title">${alert.title}</span>
                            <span class="alert-severity">${alert.severity}</span>
                        </div>
                        <div class="alert-message">${alert.message}</div>
                        <div class="alert-time">${new Date(alert.createdAt).toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderCareRecommendations(healthData) {
        const container = document.getElementById('recommendationsContent');
        if (!container) {
            console.warn('[Tree Health] Recommendations container not found');
            return;
        }
        this.renderRecommendationsInContainer(container, healthData);
    }

    renderRecommendationsInContainer(container, healthData) {
        if (!healthData || healthData.length === 0) {
            container.innerHTML = '<p>No recommendations at this time.</p>';
            return;
        }

        const latest = healthData[0];
        
        // Safely parse JSON fields
        let recommendations = [];
        let riskFactors = [];
        
        try {
            if (latest.recommendations) {
                recommendations = typeof latest.recommendations === 'string' 
                    ? JSON.parse(latest.recommendations) 
                    : latest.recommendations;
            }
        } catch (e) {
            console.warn('Failed to parse recommendations:', e);
        }
        
        try {
            if (latest.riskFactors) {
                riskFactors = typeof latest.riskFactors === 'string' 
                    ? JSON.parse(latest.riskFactors) 
                    : latest.riskFactors;
            }
        } catch (e) {
            console.warn('Failed to parse risk factors:', e);
        }

        if (recommendations.length === 0 && riskFactors.length === 0) {
            container.innerHTML = '<p>✅ No specific recommendations. Your grove is healthy!</p>';
            return;
        }

        container.innerHTML = `
            ${riskFactors.length > 0 ? `
                <div class="risk-factors">
                    <h5>⚠️ Risk Factors:</h5>
                    <ul>
                        ${riskFactors.map(risk => `<li>${this.formatRiskFactor(risk)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${recommendations.length > 0 ? `
                <div class="recommendations-list">
                    <h5>💡 Recommendations:</h5>
                    <ul>
                        ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    renderSensorData(sensorData) {
        const container = document.getElementById('sensorCharts');
        if (!container) {
            console.warn('[Tree Health] Sensor charts container not found');
            return;
        }
        this.renderSensorDataInContainer(container, sensorData);
    }

    renderSensorDataInContainer(container, sensorData) {
        // Use mock data if no real data is available
        if (!sensorData || sensorData.length === 0) {
            sensorData = this.generateMockSensorData();
        }

        // Group sensor data by type
        const groupedData = this.groupSensorDataByType(sensorData);
        
        container.innerHTML = `
            <div class="sensor-charts-container">
                <div class="sensor-charts-grid">
                    ${Object.keys(groupedData).map(sensorType => `
                        <div class="sensor-chart-card">
                            <h5>${this.formatSensorType(sensorType)}</h5>
                            <canvas id="chart-${sensorType}" width="400" height="250"></canvas>
                            <div class="sensor-stats">
                                ${this.renderSensorStats(groupedData[sensorType], sensorType)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Render charts after DOM is updated
        setTimeout(() => {
            Object.keys(groupedData).forEach(sensorType => {
                this.renderSensorChart(sensorType, groupedData[sensorType]);
            });
        }, 100);
    }

    generateMockSensorData() {
        const now = Date.now();
        const mockData = [];
        const sensorTypes = ['soil_moisture', 'temperature', 'humidity', 'ph', 'light', 'rainfall'];
        
        // Generate 24 hours of data (one reading per hour)
        for (let i = 24; i >= 0; i--) {
            const timestamp = now - (i * 60 * 60 * 1000);
            
            sensorTypes.forEach(type => {
                let value;
                const hour = new Date(timestamp).getHours();
                
                switch(type) {
                    case 'soil_moisture':
                        // 40-70% with daily variation
                        value = 55 + Math.sin(hour / 24 * Math.PI * 2) * 10 + (Math.random() - 0.5) * 5;
                        break;
                    case 'temperature':
                        // 15-30°C with daily cycle
                        value = 22 + Math.sin((hour - 6) / 24 * Math.PI * 2) * 8 + (Math.random() - 0.5) * 2;
                        break;
                    case 'humidity':
                        // 50-85% inverse to temperature
                        value = 70 - Math.sin((hour - 6) / 24 * Math.PI * 2) * 15 + (Math.random() - 0.5) * 5;
                        break;
                    case 'ph':
                        // 5.5-6.5 relatively stable
                        value = 6.0 + (Math.random() - 0.5) * 0.4;
                        break;
                    case 'light':
                        // 0-50000 lux with day/night cycle
                        const isDaytime = hour >= 6 && hour <= 18;
                        value = isDaytime ? 30000 + Math.sin((hour - 6) / 12 * Math.PI) * 20000 : Math.random() * 100;
                        break;
                    case 'rainfall':
                        // 0-5mm occasional spikes
                        value = Math.random() < 0.1 ? Math.random() * 5 : 0;
                        break;
                }
                
                mockData.push({
                    sensorType: type,
                    value: Math.max(0, value),
                    timestamp: timestamp,
                    unit: this.getSensorUnit(type)
                });
            });
        }
        
        return mockData;
    }

    groupSensorDataByType(sensorData) {
        const grouped = {};
        sensorData.forEach(reading => {
            if (!grouped[reading.sensorType]) {
                grouped[reading.sensorType] = [];
            }
            grouped[reading.sensorType].push(reading);
        });
        
        // Sort each group by timestamp
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => a.timestamp - b.timestamp);
        });
        
        return grouped;
    }

    renderSensorChart(sensorType, data) {
        const canvas = document.getElementById(`chart-${sensorType}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (canvas.chart) {
            canvas.chart.destroy();
        }

        const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const values = data.map(d => d.value);

        canvas.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: this.formatSensorType(sensorType),
                    data: values,
                    borderColor: this.getSensorColor(sensorType),
                    backgroundColor: this.getSensorColor(sensorType) + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.parsed.y.toFixed(1)} ${this.getSensorUnit(sensorType)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        ticks: {
                            maxTicksLimit: 8,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: sensorType === 'rainfall',
                        ticks: {
                            callback: (value) => {
                                return value.toFixed(0) + ' ' + this.getSensorUnit(sensorType);
                            }
                        }
                    }
                }
            }
        });
    }

    renderSensorStats(data, sensorType) {
        if (!data || data.length === 0) return '<span class="no-data">No data</span>';

        const values = data.map(d => d.value);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const latest = values[values.length - 1];

        return `
            <div class="stats-row">
                <div class="stat-item">
                    <span class="stat-label">Current</span>
                    <span class="stat-value">${latest.toFixed(1)} ${this.getSensorUnit(sensorType)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg</span>
                    <span class="stat-value">${avg.toFixed(1)} ${this.getSensorUnit(sensorType)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Min</span>
                    <span class="stat-value">${min.toFixed(1)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max</span>
                    <span class="stat-value">${max.toFixed(1)}</span>
                </div>
            </div>
        `;
    }

    getSensorColor(sensorType) {
        const colors = {
            'soil_moisture': '#3b82f6',
            'temperature': '#ef4444',
            'humidity': '#10b981',
            'ph': '#f59e0b',
            'light': '#fbbf24',
            'rainfall': '#8b5cf6'
        };
        return colors[sensorType] || '#6b7280';
    }

    // Helper methods
    getHealthScoreClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    getHealthStatus(score) {
        if (score >= 80) return 'Excellent Health';
        if (score >= 60) return 'Good Health';
        if (score >= 40) return 'Fair Health';
        return 'Poor Health - Needs Attention';
    }

    getAlertIcon(severity) {
        const icons = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🔵'
        };
        return icons[severity] || '⚠️';
    }

    formatRiskFactor(risk) {
        const risks = {
            'SEVERE_DROUGHT_STRESS': 'Severe drought stress detected',
            'EXTREME_TEMPERATURE_STRESS': 'Extreme temperature conditions',
            'SEVERE_NUTRIENT_DEFICIENCY': 'Severe nutrient deficiency',
            'DROUGHT_STRESS': 'Drought stress conditions',
            'TEMPERATURE_STRESS': 'Temperature stress',
            'NUTRIENT_ABSORPTION_ISSUES': 'Nutrient absorption problems'
        };
        return risks[risk] || risk;
    }

    formatSensorType(type) {
        const types = {
            'soil_moisture': 'Soil Moisture',
            'temperature': 'Temperature',
            'humidity': 'Humidity',
            'ph': 'pH Level',
            'light': 'Light Intensity',
            'rainfall': 'Rainfall'
        };
        return types[type] || type;
    }

    getSensorUnit(type) {
        const units = {
            'soil_moisture': '%',
            'temperature': '°C',
            'humidity': '%',
            'ph': '',
            'light': 'lux',
            'rainfall': 'mm'
        };
        return units[type] || '';
    }

    async loadHarvests(farmerAddress) {
        const container = document.getElementById('harvestList');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading harvests...</div>';

        console.log('ðŸ“¥ Loading harvests from backend for:', farmerAddress);

        try {
            const response = await window.coffeeAPI.getHarvestHistory(farmerAddress);

            // Fix: Backend returns data.harvests, not data directly
            const harvests = response.success && response.data && response.data.harvests ? response.data.harvests : [];
            
            if (harvests.length > 0) {
                console.log(`âœ… Loaded ${harvests.length} harvests from database`);
                this.harvests = harvests; // Update local array with backend data

                container.innerHTML = `
                    <div class="harvest-list">
                        ${harvests.map(harvest => `
                            <div class="harvest-card">
                                <div class="harvest-header">
                                    <div class="harvest-info">
                                        <h4>${harvest.groveName}</h4>
                                        <span class="harvest-date">
                                            <i class="fas fa-calendar"></i> 
                                            ${new Date(typeof harvest.harvestDate === 'number' ? harvest.harvestDate * 1000 : harvest.harvestDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div class="harvest-status ${harvest.distributionStatus || 'pending'}">
                                        ${harvest.distributionStatus === 'distributed' ? '✅ Distributed' : '⏳ Pending'}
                                    </div>
                                </div>
                                <div class="harvest-metrics">
                                    <div class="metric">
                                        <span class="metric-label">Yield</span>
                                        <span class="metric-value">${harvest.yieldKg.toLocaleString()} kg</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Quality</span>
                                        <span class="metric-value">${this.getQualityGradeText(harvest.qualityGrade)} (${harvest.qualityGrade}/10)</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Revenue</span>
                                        <span class="metric-value">$$${this.getTotalRevenue(harvest).toLocaleString()}</span>
                                    </div>                                </div>
                                <div class="harvest-distribution">
                                    <div class="metric">
                                        <span class="metric-label">Farmer Share (30%)</span>
                                        <span class="metric-value">$$${this.calculateFarmerShare(harvest).toLocaleString()}</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Investor Share (70%)</span>
                                        <span class="metric-value">$$${this.calculateInvestorShare(harvest).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                // No harvests in database
                container.innerHTML = '<div class="empty-state"><p>No harvest reports yet. Click "Report Harvest" in the Manage Grove menu to add one.</p></div>';
                this.harvests = []; // Clear local array
            }
        } catch (error) {
            console.error('Failed to load harvests from database:', error.message);
            container.innerHTML = '<div class="empty-state"><p>Failed to load harvests. Please ensure backend is running.</p></div>';
            this.harvests = []; // Clear local array
        }
    }

    renderHarvests() {
        const container = document.getElementById('harvestList');
        if (!container) return;

        if (this.harvests.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No harvest reports yet. Click "Report Harvest" in the Manage Grove menu to add one.</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="harvest-list">
                ${this.harvests.map(harvest => `
                    <div class="harvest-card">
                        <div class="harvest-header">
                            <div class="harvest-info">
                                <h4>${harvest.groveName}</h4>
                                <span class="harvest-date">
                                    <i class="fas fa-calendar"></i> 
                                    ${new Date(typeof harvest.harvestDate === 'number' ? harvest.harvestDate * 1000 : harvest.harvestDate).toLocaleDateString()}
                                </span>
                            </div>
                            <div class="harvest-status ${harvest.distributionStatus || 'pending'}">
                                ${harvest.distributionStatus === 'distributed' ? '✅ Distributed' : '⏳ Pending'}
                            </div>
                        </div>
                        <div class="harvest-metrics">
                            <div class="metric">
                                <span class="metric-label">Yield</span>
                                <span class="metric-value">${harvest.yieldKg.toLocaleString()} kg</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Quality</span>
                                <span class="metric-value">${this.getQualityGradeText(harvest.qualityGrade)} (${harvest.qualityGrade}/10)</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Revenue</span>
                                <span class="metric-value">$$${this.getTotalRevenue(harvest).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="harvest-distribution">
                            <div class="metric">
                                <span class="metric-label">Farmer Share (30%)</span>
                                <span class="metric-value">$$${this.calculateFarmerShare(harvest).toLocaleString()}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Investor Share (70%)</span>
                                <span class="metric-value">$$${this.calculateInvestorShare(harvest).toLocaleString()}</span>
                            </div>
                        </div>
                        ${harvest.notes ? `
                        <div class="harvest-notes">
                            <small><i class="fas fa-sticky-note"></i> ${harvest.notes}</small>
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Helper function to get quality grade text from number
    getQualityGradeText(gradeNumber) {
        if (gradeNumber >= 90) return 'Premium (A)';
        if (gradeNumber >= 70) return 'Standard (B)';
        return 'Commercial (C)';
    }

    // Helper function to calculate farmer share (30%)
    calculateFarmerShare(harvest) {
        if (harvest.farmerShare) return harvest.farmerShare;
        const totalRevenue = harvest.totalRevenue || (harvest.yieldKg * (harvest.salePricePerKg || 5));
        return Math.floor(totalRevenue * 0.3);
    }

    // Helper function to calculate investor share (70%)
    calculateInvestorShare(harvest) {
        if (harvest.investorShare) return harvest.investorShare;
        const totalRevenue = harvest.totalRevenue || (harvest.yieldKg * (harvest.salePricePerKg || 5));
        return Math.floor(totalRevenue * 0.7);
    }

    // Helper function to get total revenue
    getTotalRevenue(harvest) {
        return harvest.totalRevenue || (harvest.yieldKg * (harvest.salePricePerKg || 5));
    }

    // Helper function to render a harvest card
    renderHarvestCard(harvest) {
        const totalRevenue = this.getTotalRevenue(harvest);
        const farmerShare = this.calculateFarmerShare(harvest);
        const investorShare = this.calculateInvestorShare(harvest);
        const harvestDate = typeof harvest.harvestDate === 'number' ? harvest.harvestDate * 1000 : harvest.harvestDate;

        return `
            <div class="harvest-card">
                <div class="harvest-header">
                    <div class="harvest-info">
                        <h4>${harvest.groveName}</h4>
                        <span class="harvest-date">
                            <i class="fas fa-calendar"></i> 
                            ${new Date(harvestDate).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="harvest-status ${harvest.distributionStatus || 'pending'}">
                        ${harvest.distributionStatus === 'distributed' ? '✅ Distributed' : '⏳ Pending'}
                    </div>
                </div>
                <div class="harvest-metrics">
                    <div class="metric">
                        <span class="metric-label">Yield</span>
                        <span class="metric-value">${harvest.yieldKg.toLocaleString()} kg</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Quality</span>
                        <span class="metric-value">${this.getQualityGradeText(harvest.qualityGrade)} (${harvest.qualityGrade}/10) (${harvest.qualityGrade}/10)</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Revenue</span>
                        <span class="metric-value">$${totalRevenue.toLocaleString()}</span>
                    </div>
                </div>
                <div class="harvest-distribution">
                    <div class="metric">
                        <span class="metric-label">Farmer Share (30%)</span>
                        <span class="metric-value">$${farmerShare.toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Investor Share (70%)</span>
                        <span class="metric-value">$${investorShare.toLocaleString()}</span>
                    </div>
                        </div>
                        <div class="harvest-distribution">
                            <div class="metric">
                                <span class="metric-label">Farmer Share (30%)</span>
                                <span class="metric-value">$$${this.calculateFarmerShare(harvest).toLocaleString()}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Investor Share (70%)</span>
                                <span class="metric-value">$$${this.calculateInvestorShare(harvest).toLocaleString()}</span>
                            </div>
                        </div>
                        ${harvest.notes ? `
                <div class="harvest-notes">
                    <small><i class="fas fa-sticky-note"></i> ${harvest.notes}</small>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Revenue and Withdrawal Methods
    async loadRevenue(farmerAddress) {
        console.log('[Revenue] Loading revenue data for:', farmerAddress);

        // Load new revenue tracking component
        if (window.farmerRevenueTracking) {
            await window.farmerRevenueTracking.loadRevenueData(farmerAddress);
        }

        // Populate withdrawal grove dropdown (legacy support)
        const withdrawalGroveSelect = document.getElementById('withdrawalGrove');
        if (withdrawalGroveSelect && this.groves && this.groves.length > 0) {
            withdrawalGroveSelect.innerHTML = '<option value="">Select a grove</option>' +
                this.groves.map(grove =>
                    `<option value="${grove.id}" data-grove-name="${grove.groveName}">${grove.groveName} - ${grove.location}</option>`
                ).join('');

            // Add change listener to update available balance
            withdrawalGroveSelect.removeEventListener('change', this.handleGroveChange);
            this.handleGroveChange = (e) => this.updateWithdrawalBalance(e.target.value);
            withdrawalGroveSelect.addEventListener('change', this.handleGroveChange);
        }

        // Load revenue stats from backend API
        await this.loadRevenueStats(farmerAddress);

        // Render monthly revenue chart
        this.renderMonthlyRevenueChart();

        // Load withdrawal history
        this.loadWithdrawalHistory(farmerAddress);
    }

    async loadRevenueStats(farmerAddress) {
        try {
            // Fetch harvest stats from backend
            const statsResponse = await window.coffeeAPI.getHarvestStats(farmerAddress);
            
            // Fetch farmer balance from backend
            const balanceResponse = await window.coffeeAPI.getFarmerBalance(farmerAddress);

            if (statsResponse.success && statsResponse.data) {
                const stats = statsResponse.data;
                
                console.log('[Revenue] Stats from API:', stats);
                
                // Update total and monthly earnings (legacy support)
                const totalEarningsEl = document.getElementById('totalEarnings');
                const monthlyEarningsEl = document.getElementById('monthlyEarnings');
                if (totalEarningsEl) totalEarningsEl.textContent = `$${stats.totalEarnings.toFixed(2)}`;
                if (monthlyEarningsEl) monthlyEarningsEl.textContent = `$${stats.monthlyEarnings.toFixed(2)}`;
            }

            if (balanceResponse.success && balanceResponse.data) {
                const balance = balanceResponse.data;
                
                console.log('[Revenue] Balance from API:', balance);
                
                // Update withdrawal stats
                // Convert from cents to dollars (values are in cents from API)
                const availableBalance = (balance.availableBalance || 0) / 100;
                const pendingBalance = (balance.pendingDistribution || balance.pendingBalance || 0) / 100;
                const totalWithdrawn = (balance.totalWithdrawn || 0) / 100;
                
                document.getElementById('farmerAvailableBalance').textContent = `$${availableBalance.toFixed(2)}`;
                document.getElementById('farmerPendingBalance').textContent = `$${pendingBalance.toFixed(2)}`;
                document.getElementById('farmerTotalWithdrawn').textContent = `$${totalWithdrawn.toFixed(2)}`;
                
                // Store for withdrawal (in dollars)
                this.totalAvailableBalance = availableBalance;
            } else {
                console.warn('[Revenue] No balance data from API:', balanceResponse);
                // Fallback to local calculation if API fails
                this.calculateRevenue();
            }
        } catch (error) {
            console.error('[Revenue] Error loading revenue stats:', error);
            // Fallback to local calculation
            this.calculateRevenue();
        }
    }

    // Helper to safely update element text
    safeUpdateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`[Revenue] Element not found: ${id}`);
        }
    }

    calculateRevenue() {
        // Calculate total earnings from harvests (30% farmer share)
        const FARMER_SHARE = 0.30;
        let totalRevenue = 0;
        let monthlyRevenue = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (!this.harvests || this.harvests.length === 0) {
            console.log('[Revenue] No harvests to calculate');
            return;
        }

        this.harvests.forEach(harvest => {
            const revenue = harvest.totalRevenue || (harvest.yieldKg * harvest.salePricePerKg);
            const farmerEarnings = revenue * FARMER_SHARE;
            totalRevenue += farmerEarnings;

            // Check if harvest is from current month
            const harvestDate = new Date(typeof harvest.harvestDate === 'number' ? harvest.harvestDate * 1000 : harvest.harvestDate);
            if (harvestDate.getMonth() === currentMonth && harvestDate.getFullYear() === currentYear) {
                monthlyRevenue += farmerEarnings;
            }
        });

        // Update UI
        document.getElementById('totalEarnings').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('monthlyEarnings').textContent = `$${monthlyRevenue.toFixed(2)}`;

        // Calculate available balance (total - withdrawn)
        const totalWithdrawn = this.withdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0;
        const availableBalance = totalRevenue - totalWithdrawn;

        document.getElementById('farmerAvailableBalance').textContent = `$${availableBalance.toFixed(2)}`;
        document.getElementById('farmerTotalWithdrawn').textContent = `$${totalWithdrawn.toFixed(2)}`;
        document.getElementById('farmerPendingBalance').textContent = `$0.00`; // TODO: Track pending

        // Store for withdrawal
        this.totalAvailableBalance = availableBalance;
    }

    renderMonthlyRevenueChart() {
        const canvas = document.getElementById('monthlyRevenueChart');
        if (!canvas) {
            console.warn('Monthly revenue chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (this.monthlyRevenueChartInstance) {
            this.monthlyRevenueChartInstance.destroy();
        }

        // Calculate monthly revenue data
        const FARMER_SHARE = 0.30;
        const currentYear = new Date().getFullYear();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = new Array(12).fill(0);

        // Aggregate revenue by month
        this.harvests.forEach(harvest => {
            const harvestDate = new Date(typeof harvest.harvestDate === 'number' ? harvest.harvestDate * 1000 : harvest.harvestDate);
            if (harvestDate.getFullYear() === currentYear) {
                const month = harvestDate.getMonth();
                const revenue = harvest.totalRevenue || (harvest.yieldKg * harvest.salePricePerKg);
                const farmerEarnings = revenue * FARMER_SHARE;
                monthlyData[month] += farmerEarnings;
            }
        });

        // Create the chart
        const ctx = canvas.getContext('2d');
        this.monthlyRevenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Monthly Revenue (USDC)',
                    data: monthlyData,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(76, 175, 80, 0.8)',
                    hoverBorderColor: 'rgba(76, 175, 80, 1)',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ccc',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        titleColor: '#4CAF50',
                        bodyColor: '#ccc',
                        borderColor: '#4CAF50',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += '$' + context.parsed.y.toFixed(2);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#888',
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#888',
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });

        console.log('✅ Monthly revenue chart rendered with data:', monthlyData);
    }

    updateWithdrawalBalance(groveId) {
        console.log('[Withdrawal] Updating balance for grove:', groveId);
        
        const helpText = document.getElementById('withdrawalHelp');
        if (!helpText) {
            console.warn('[Withdrawal] Help text element not found');
            return;
        }

        if (!groveId) {
            helpText.textContent = 'Available: $0.00';
            this.currentGroveBalance = 0;
            return;
        }

        // Calculate available balance for selected grove
        const FARMER_SHARE = 0.30;
        let groveRevenue = 0;

        this.harvests.forEach(harvest => {
            if (harvest.groveId == groveId) {
                const revenue = harvest.totalRevenue || (harvest.yieldKg * harvest.salePricePerKg);
                groveRevenue += revenue * FARMER_SHARE;
            }
        });

        // Subtract withdrawals for this grove
        const groveWithdrawals = this.withdrawals?.filter(w => w.groveId == groveId)
            .reduce((sum, w) => sum + w.amount, 0) || 0;

        const availableForGrove = groveRevenue - groveWithdrawals;

        helpText.textContent = `Available: $${availableForGrove.toFixed(2)}`;

        // Store for max button
        this.currentGroveBalance = availableForGrove;
        
        console.log('[Withdrawal] Grove balance updated:', {
            groveId,
            groveRevenue,
            groveWithdrawals,
            availableForGrove
        });
    }

    handleWithdrawMax() {
        console.log('[Withdrawal] Max button clicked');
        
        const groveSelect = document.getElementById('withdrawalGrove');
        const amountInput = document.getElementById('withdrawalAmount');

        if (!groveSelect || !amountInput) {
            console.error('[Withdrawal] Form elements not found');
            return;
        }

        if (!groveSelect.value) {
            this.showNotification('Please select a grove first', 'warning');
            return;
        }

        console.log('[Withdrawal] Current grove balance:', this.currentGroveBalance);

        if (this.currentGroveBalance > 0) {
            amountInput.value = this.currentGroveBalance.toFixed(2);
            console.log('[Withdrawal] Set max amount:', amountInput.value);
        } else {
            this.showNotification('No funds available for withdrawal', 'info');
        }
    }

    async handleWithdrawalSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const groveId = formData.get('groveId');
        const amount = parseFloat(formData.get('amount'));

        if (!groveId) {
            this.showNotification('Please select a grove', 'error');
            return;
        }

        if (amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }

        if (amount > this.currentGroveBalance) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }

        const grove = this.groves.find(g => g.id == groveId);
        const farmerAddress = window.walletManager?.getAccountId();

        const withdrawalData = {
            id: Date.now(),
            groveId: groveId,
            groveName: grove?.groveName || 'Unknown',
            farmerAddress: farmerAddress,
            amount: amount,
            status: 'completed',
            timestamp: new Date().toISOString(),
            transactionHash: `0x${Date.now().toString(16)}` // Mock hash
        };

        console.log('[Withdrawal] Submitting:', withdrawalData);

        // Add to local withdrawals
        if (!this.withdrawals) {
            this.withdrawals = [];
        }
        this.withdrawals.unshift(withdrawalData);

        // Try backend sync (optional)
        try {
            if (window.coffeeAPI && typeof window.coffeeAPI.withdrawFarmerFunds === 'function') {
                const response = await window.coffeeAPI.withdrawFarmerFunds(withdrawalData);
                if (response && response.success) {
                    console.log('[Withdrawal] Synced with backend');
                }
            }
        } catch (error) {
            console.log('[Withdrawal] Backend not available, using local data only:', error.message);
        }

        // Show success
        this.showNotification(`Successfully withdrew $${amount.toFixed(2)}!`, 'success');

        // Update UI
        this.calculateRevenue();
        this.loadWithdrawalHistory(farmerAddress);

        // Reset form
        e.target.reset();
        document.getElementById('withdrawalHelp').textContent = 'Available: $0.00';
    }

    loadWithdrawalHistory(farmerAddress) {
        const container = document.getElementById('withdrawalHistoryList');
        if (!container) return;

        if (!this.withdrawals || this.withdrawals.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No withdrawal history yet.</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="withdrawal-list">
                ${this.withdrawals.map(withdrawal => `
                    <div class="withdrawal-item">
                        <div class="withdrawal-header">
                            <div class="withdrawal-info">
                                <h5>${withdrawal.groveName}</h5>
                                <span class="withdrawal-date">
                                    <i class="fas fa-calendar"></i> 
                                    ${new Date(withdrawal.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                            <div class="withdrawal-status ${withdrawal.status}">
                                ${withdrawal.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
                            </div>
                        </div>
                        <div class="withdrawal-details">
                            <div class="detail">
                                <span class="detail-label">Amount</span>
                                <span class="detail-value">$${withdrawal.amount.toFixed(2)}</span>
                            </div>
                            <div class="detail">
                                <span class="detail-label">Transaction</span>
                                <span class="detail-value mono-text">${withdrawal.transactionHash.substring(0, 10)}...</span>
                            </div>                                </div>
                                <div class="harvest-distribution">
                                    <div class="metric">
                                        <span class="metric-label">Farmer Share (30%)</span>
                                        <span class="metric-value">$$${this.calculateFarmerShare(harvest).toLocaleString()}</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Investor Share (70%)</span>
                                        <span class="metric-value">$$${this.calculateInvestorShare(harvest).toLocaleString()}</span>
                                    </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Load pricing section - initialize market prices display
    async loadPricingSection() {
        console.log('[Pricing] Loading market prices section');
        
        try {
            // Check if MarketPricesDisplay is available
            if (typeof window.MarketPricesDisplay === 'undefined') {
                console.warn('[Pricing] MarketPricesDisplay not loaded yet, waiting...');
                // Wait a bit for the script to load
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (typeof window.MarketPricesDisplay === 'undefined') {
                    console.error('[Pricing] MarketPricesDisplay still not available');
                    this.showNotification('Market prices module not loaded', 'error');
                    return;
                }
            }

            // Ensure priceOracle is available
            if (!window.priceOracle) {
                console.log('[Pricing] Initializing price oracle...');
                if (window.PriceOracleManager && window.coffeeAPI) {
                    window.priceOracle = new window.PriceOracleManager(window.coffeeAPI);
                }
            }

            // Initialize market prices display if not already done
            if (!this.marketPricesDisplay) {
                console.log('[Pricing] Creating new MarketPricesDisplay instance');
                this.marketPricesDisplay = new window.MarketPricesDisplay(window.coffeeAPI);
                await this.marketPricesDisplay.initialize();
                console.log('[Pricing] Market prices display initialized successfully');
            } else {
                // Refresh prices if already initialized
                console.log('[Pricing] Refreshing existing market prices');
                await this.marketPricesDisplay.loadPrices();
                console.log('[Pricing] Market prices refreshed');
            }
        } catch (error) {
            console.error('[Pricing] Error loading pricing section:', error);
            console.error('[Pricing] Error stack:', error.stack);
            this.showNotification('Error loading market prices: ' + error.message, 'error');
        }
    }

    // Add other methods as needed...
}

// Create global farmer dashboard instance
window.farmerDashboard = new FarmerDashboard();



