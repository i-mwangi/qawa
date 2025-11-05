/**
 * Main Application Controller
 * Handles view management, navigation, and overall application state
 */

class ViewManager {
    constructor() {
        console.log('Creating ViewManager instance');

        this.currentView = 'dashboard';
        this.isInitialized = false;

        // Initialize immediately - don't wait for walletManager
        // This makes viewManager available for button clicks right away
        this.init();

        // Wait for wallet manager in background for wallet-specific features
        this.waitForWalletManager().then(() => {
            console.log('WalletManager ready, enabling wallet features...');
            // Initialize based on wallet connection
            if (window.walletManager && typeof window.walletManager.isWalletConnected === 'function' && window.walletManager.isWalletConnected()) {
                this.handleWalletConnected(window.walletManager.getUserType());
            }
        });
    }

    // Wait for wallet manager to be available (non-blocking)
    async waitForWalletManager() {
        console.log('Waiting for wallet manager to be available...');

        return new Promise((resolve) => {
            if (window.walletManager) {
                console.log('Wallet manager is already available');
                resolve();
            } else {
                // Check every 100ms until walletManager is available
                const checkInterval = setInterval(() => {
                    if (window.walletManager) {
                        console.log('Wallet manager is now available');
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    init() {
        console.log('Initializing ViewManager...');

        this.setupNavigation();
        this.loadDashboardData();
        this.isInitialized = true;

        console.log('✅ ViewManager initialized and ready');
    }

    setupNavigation() {
        console.log('Setting up navigation...');

        // Navigation buttons - attach listeners fresh on every page load
        const navButtons = document.querySelectorAll('.nav-btn');
        console.log('Found', navButtons.length, 'navigation buttons');
        navButtons.forEach((btn, index) => {
            console.log('Processing nav button', index, ':', btn.textContent.trim(), 'with view:', btn.dataset.view);

            // Always attach listener - no persistent flag check
            console.log('Attaching event listener to nav button', index);
            btn.addEventListener('click', (e) => {
                console.log('Nav button clicked:', e.currentTarget.textContent.trim());
                // Get the button element (in case user clicks on text inside button)
                const button = e.currentTarget;
                const view = button.dataset.view;
                console.log('View:', view);

                if (!view) {
                    console.warn('No view specified for button:', button);
                    return;
                }

                // Set intended user type based on the view being navigated to
                if (view === 'farmer') {
                    console.log('Setting user type to farmer');
                    window.walletManager?.setIntendedUserType('farmer');
                } else if (view === 'investor') {
                    console.log('Setting user type to investor');
                    window.walletManager?.setIntendedUserType('investor');
                }

                this.switchView(view);
            });
        });
    }
    switchView(view) {
        console.log('Switching to view:', view);
        
        // Update active navigation button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        // Update active view
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });

        const targetView = document.getElementById(`${view}View`);
        if (targetView) {
            targetView.classList.add('active');
        }

        this.currentView = view;

        // Set user type when switching views
        if (view === 'farmer' && window.walletManager) {
            window.walletManager.setIntendedUserType('farmer');
        } else if (view === 'investor' && window.walletManager) {
            window.walletManager.setIntendedUserType('investor');
        }

        // Load view-specific data
        this.loadViewData(view);
    }

    async loadViewData(view) {
        console.log('Loading view data for:', view);

        try {
            switch (view) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'farmer':
                    // Set user type to farmer when switching to farmer view
                    window.walletManager?.setIntendedUserType('farmer');
                    // Switch to the default section if the user is connected.
                    if (window.walletManager?.isWalletConnected()) {
                        // The FarmerDashboard is now created on DOMContentLoaded.
                        // We just need to call its method to switch to the correct section.
                        // The optional chaining (?.) ensures this runs safely.
                        window.farmerDashboard?.switchSection('groves');
                    }
                    break;
                case 'investor':
                    // Set user type to investor when switching to investor view
                    window.walletManager?.setIntendedUserType('investor');
                    // Switch to the default section if the user is connected.
                    if (window.walletManager?.isWalletConnected()) {
                        // The InvestorPortal is now created on DOMContentLoaded.
                        window.investorPortal?.switchSection('browse');
                    }
                    break;
                case 'admin':
                    // Admin panel is handled by admin-panel.js
                    // Just ensure user is admin
                    if (window.tokenAdminManager && typeof window.tokenAdminManager.isAdminUser === 'function' && !window.tokenAdminManager.isAdminUser()) {
                        this.showError('Admin access required');
                        this.switchView('dashboard');
                    }
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${view} data:`, error);
        }
    }

    // Wait for API to be available
    async waitForAPI() {
        let attempts = 0;
        while (!window.coffeeAPI && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        return window.coffeeAPI;
    }

    async loadDashboardData() {
        console.log('Loading dashboard data...');

        try {
            // Wait for API to be available
            const api = await this.waitForAPI();
            if (!api) {
                console.warn('API not available, skipping dashboard data load');
                return;
            }

            // Load platform overview data
            const [marketOverview, pricesResponse] = await Promise.all([
                api.getMarketOverview().catch(() => ({ success: false })),
                api.getCurrentPrices().catch(() => ({ success: false }))
            ]);

            // Update dashboard stats
            this.updateDashboardStats(marketOverview, pricesResponse);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    updateDashboardStats(marketOverview, pricesResponse) {
        console.log('Updating dashboard stats...');

        // Mock data for dashboard stats
        const totalGrovesVal = marketOverview && marketOverview.success
            ? Number(marketOverview.totalGroves ?? marketOverview.data?.totalGroves ?? 0)
            : 47;

        const activeFarmersVal = marketOverview && marketOverview.success
            ? Number(marketOverview.activeFarmers ?? marketOverview.data?.activeFarmers ?? 0)
            : 23;

        const totalRevenueVal = marketOverview && marketOverview.success
            ? Number(marketOverview.totalRevenue ?? marketOverview.data?.totalRevenue ?? 0)
            : 125000;

        let coffeePriceVal = 4.25;
        try {
            if (pricesResponse && pricesResponse.success) {
                const prices = pricesResponse.data?.prices || pricesResponse.prices;
                if (Array.isArray(prices)) {
                    coffeePriceVal = prices.find(p => p.variety && typeof p.variety === 'string' && p.variety.toLowerCase().includes('arabica'))?.price
                        || prices[0]?.price || coffeePriceVal;
                } else if (prices && typeof prices === 'object') {
                    // object map from mock server
                    coffeePriceVal = prices.arabica ?? prices.Arabica ?? prices['arabica'] ?? Object.values(prices)[0] ?? coffeePriceVal;
                }
                coffeePriceVal = Number(coffeePriceVal || coffeePriceVal);
            }
        } catch (e) {
            coffeePriceVal = 4.25;
        }

        const stats = {
            totalGroves: totalGrovesVal,
            activeFarmers: activeFarmersVal,
            totalRevenue: totalRevenueVal,
            coffeePrice: coffeePriceVal
        };

        // Update DOM elements
        const totalGrovesEl = document.getElementById('totalGroves');
        const activeFarmersEl = document.getElementById('activeFarmers');
        const totalRevenueEl = document.getElementById('totalRevenue');
        const coffeePriceEl = document.getElementById('coffeePrice');

        if (totalGrovesEl) totalGrovesEl.textContent = stats.totalGroves;
        if (activeFarmersEl) activeFarmersEl.textContent = stats.activeFarmers;
        if (totalRevenueEl) totalRevenueEl.textContent = `$${stats.totalRevenue.toLocaleString()}`;
        if (coffeePriceEl) coffeePriceEl.textContent = `$${stats.coffeePrice}/kg`;
    }

    handleWalletConnected(userType) {
        console.log('Handling wallet connected event...');

        if (!window.walletManager || typeof window.walletManager.getUserType !== 'function') {
            console.warn('WalletManager not fully initialized yet');
            return;
        }

        // const userType = window.walletManager.getUserType();
        // Auto-switch to appropriate view based on user type
        if (userType === 'farmer') {
            this.switchView('farmer');
            // Initialize farmer dashboard with the connected account
            if (window.farmerDashboard && typeof window.farmerDashboard.initDashboard === 'function') {
                window.farmerDashboard.initDashboard();
            }
        } else if (userType === 'investor') {
            this.switchView('investor');
        }
    }

    showError(message) {
        console.log('Showing error:', message);

        window.walletManager.showToast(message, 'error');
    }

    showSuccess(message) {
        console.log('Showing success:', message);

        window.walletManager.showToast(message, 'success');
    }

    showWarning(message) {
        console.log('Showing warning:', message);

        window.walletManager.showToast(message, 'warning');
    }
}

// Application initialization
class CoffeeTreeApp {
    constructor() {
        console.log('Creating CoffeeTreeApp instance');

        this.init();
    }

    async init() {
        console.log('Initializing CoffeeTreeApp...');

        try {
            // Initialize ViewManager immediately. It does not depend on anything.
            window.viewManager = new ViewManager();

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.start());
            } else {
                this.start();
            }
        } catch (error) {
            console.error('Application initialization failed:', error);
        }
    }

    async start() {
        console.log('Starting CoffeeTreeApp...');

        try {
            // Wait for wallet manager to be ready

            // Initialize balance poller
            if (typeof BalancePoller !== 'undefined') {
                window.balancePoller = new BalancePoller(window.coffeeAPI, window.walletManager);
                console.log('Balance poller initialized');
            }

            // Test API connection
            await this.testAPIConnection();

            console.log('Coffee Tree Platform initialized successfully');
        } catch (error) {
            console.error('Application startup failed:', error);
            this.showConnectionError();
        }
    }

    // Wait for wallet manager to be available
    async waitForWalletManager() {
        console.log('Waiting for wallet manager to be available...');

        return new Promise((resolve) => {
            if (window.walletManager) {
                console.log('Wallet manager is already available');
                resolve();
            } else {
                // Check every 100ms until walletManager is available
                const checkInterval = setInterval(() => {
                    if (window.walletManager) {
                        console.log('Wallet manager is now available');
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    // Wait for API to be available
    async waitForAPI() {
        let attempts = 0;
        while (!window.coffeeAPI && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        return window.coffeeAPI;
    }

    async testAPIConnection() {
        console.log('Testing API connection...');

        try {
            // Wait for API to be available
            const api = await this.waitForAPI();
            if (!api) {
                console.warn('API not available');
                return;
            }

            const response = await api.healthCheck();
            if (response.success) {
                console.log('API connection successful');
            }
        } catch (error) {
            console.warn('API connection failed:', error);
            // Don't throw error - app can work with mock data
        }
    }

    showConnectionError() {
        console.log('Showing connection error...');

        const errorMessage = document.createElement('div');
        errorMessage.className = 'connection-error';
        errorMessage.innerHTML = `
            <div class="error-content">
                <h3>Connection Error</h3>
                <p>Unable to connect to the Coffee Tree Platform API.</p>
                <p>Please ensure the backend server is running on port 3001.</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;

        errorMessage.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
        `;

        document.body.appendChild(errorMessage);
    }
}

// Utility functions
window.utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatAddress: (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Add this at the top of the file to ensure notification manager is available
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, checking for notification manager...');

    // Ensure notification manager exists
    if (!window.notificationManager) {
        console.warn('Notification manager not found, initializing...');
        // Create it if it doesn't exist
        if (typeof NotificationManager !== 'undefined') {
            window.notificationManager = new NotificationManager();
        }
    }
});

// Start the application
window.coffeeTreeApp = new CoffeeTreeApp();

// Ensure all buttons are initialized after views are loaded
window.addEventListener('load', function() {
    console.log('🚀 Initializing all interactive elements...');
    
    // Reinitialize quick actions
    if (typeof initializeQuickActions === 'function') {
        setTimeout(initializeQuickActions, 200);
    }
    
    // Reinitialize farmer dashboard if visible
    if (window.farmerDashboard) {
        const farmerView = document.getElementById('farmerView');
        if (farmerView && farmerView.classList.contains('active')) {
            console.log('🌾 Reinitializing farmer dashboard...');
            window.farmerDashboard.setupEventListeners();
        }
    }
    
    console.log('✅ All interactive elements initialized');
});
