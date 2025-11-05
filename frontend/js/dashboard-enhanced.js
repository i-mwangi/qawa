/**
 * Enhanced Dashboard Management
 * Handles the improved dashboard with activity feeds, charts, and real-time updates
 */

class DashboardEnhanced {
    constructor() {
        this.activityFeed = [];
        this.topGroves = [];
        this.priceHistory = [];
        this.chart = null;
        this.currentPeriod = 7;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        console.log('[Dashboard] Initializing enhanced dashboard...');
        this.setupEventListeners();
        this.loadDashboardData();
        
        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshActivity();
        }, 30000);
    }

    setupEventListeners() {
        // Chart period buttons - wait for DOM to be ready
        const chartButtons = document.querySelectorAll('.chart-period-btn');
        if (chartButtons.length === 0) {
            console.warn('[Dashboard] Chart period buttons not found in DOM yet');
            return;
        }
        
        chartButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = parseInt(e.target.dataset.period);
                this.updatePriceChart();
            });
        });
        console.log('[Dashboard] Chart period button listeners attached');
    }

    async loadDashboardData() {
        try {
            // Load all dashboard data in parallel
            await Promise.all([
                this.loadEnhancedStats(),
                this.loadActivityFeed(),
                this.loadTopGroves(),
                this.loadMarketActivity(),
                this.loadRevenueStats(),
                this.loadPriceHistory()
            ]);
        } catch (error) {
            console.error('[Dashboard] Error loading dashboard data:', error);
        }
    }

    async loadEnhancedStats() {
        try {
            // Get basic stats
            const overview = await window.coffeeAPI.getMarketOverview();
            
            if (overview.success) {
                document.getElementById('totalGroves').textContent = overview.totalGroves || 0;
                document.getElementById('activeFarmers').textContent = overview.activeFarmers || 0;
                document.getElementById('totalRevenue').textContent = `$${(overview.totalRevenue || 0).toLocaleString()}`;
            }

            // Get price data
            const prices = await window.coffeeAPI.getCurrentPrices();
            if (prices.success && prices.prices) {
                const arabicaPrice = prices.prices.find(p => p.variety === 'Arabica');
                if (arabicaPrice) {
                    document.getElementById('coffeePrice').textContent = `$${arabicaPrice.price.toFixed(2)}/kg`;
                    
                    // Calculate price change
                    const change = arabicaPrice.change || 0;
                    const changeEl = document.getElementById('priceChange');
                    if (changeEl) {
                        changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                        changeEl.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
                    }
                }
            }

            // Mock data for new stats (replace with real API calls)
            document.getElementById('totalTokens').textContent = '12,450';
            document.getElementById('investmentVolume').textContent = '$2.4M';
            document.getElementById('activeInvestors').textContent = '342';
            document.getElementById('marketplaceVolume').textContent = '$45.2K';

        } catch (error) {
            console.error('[Dashboard] Error loading enhanced stats:', error);
        }
    }

    async loadActivityFeed() {
        try {
            const feedEl = document.getElementById('activityFeed');
            
            // Mock activity data (replace with real API)
            const activities = [
                {
                    type: 'investment',
                    user: 'Investor #1234',
                    action: 'invested $500 in',
                    target: 'Sunrise Valley Grove',
                    time: '5 minutes ago',
                    icon: 'dollar'
                },
                {
                    type: 'harvest',
                    user: 'Mountain Peak Grove',
                    action: 'reported harvest:',
                    target: '1,200kg',
                    time: '1 hour ago',
                    icon: 'package'
                },
                {
                    type: 'listing',
                    user: 'Investor #5678',
                    action: 'listed 50 tokens at',
                    target: '$28/token',
                    time: '2 hours ago',
                    icon: 'tag'
                },
                {
                    type: 'purchase',
                    user: 'Investor #9012',
                    action: 'purchased 25 tokens from',
                    target: 'Highland Coffee Grove',
                    time: '3 hours ago',
                    icon: 'shopping-cart'
                },
                {
                    type: 'registration',
                    user: 'Farmer #3456',
                    action: 'registered new grove:',
                    target: 'Valley View Plantation',
                    time: '5 hours ago',
                    icon: 'home'
                }
            ];

            this.activityFeed = activities;
            this.renderActivityFeed();

        } catch (error) {
            console.error('[Dashboard] Error loading activity feed:', error);
            document.getElementById('activityFeed').innerHTML = '<div class="error-message">Failed to load activity</div>';
        }
    }

    renderActivityFeed() {
        const feedEl = document.getElementById('activityFeed');
        
        if (this.activityFeed.length === 0) {
            feedEl.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        feedEl.innerHTML = this.activityFeed.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    ${this.getActivityIcon(activity.icon)}
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${activity.user}</strong> ${activity.action} <strong>${activity.target}</strong>
                    </div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }

    getActivityIcon(iconType) {
        const icons = {
            'dollar': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
            'package': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>',
            'tag': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
            'shopping-cart': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
            'home': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>'
        };
        return icons[iconType] || icons['dollar'];
    }

    async loadTopGroves() {
        try {
            // Mock top groves data (replace with real API)
            const groves = [
                {
                    name: 'Yirgacheffe Estate',
                    healthScore: 95,
                    roi: 12.5,
                    lastHarvest: '2 days ago',
                    location: 'Ethiopia, Yirgacheffe'
                },
                {
                    name: 'Mount Elgon Grove',
                    healthScore: 92,
                    roi: 11.8,
                    lastHarvest: '1 week ago',
                    location: 'Uganda, Mbale'
                },
                {
                    name: 'Nyeri Highlands',
                    healthScore: 90,
                    roi: 10.2,
                    lastHarvest: '3 days ago',
                    location: 'Kenya, Nyeri'
                }
            ];

            this.topGroves = groves;
            this.renderTopGroves();

        } catch (error) {
            console.error('[Dashboard] Error loading top groves:', error);
        }
    }

    renderTopGroves() {
        const listEl = document.getElementById('topGrovesList');
        
        if (this.topGroves.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No groves available</div>';
            return;
        }

        listEl.innerHTML = this.topGroves.map((grove, index) => `
            <div class="top-grove-item">
                <div class="grove-rank">#${index + 1}</div>
                <div class="grove-info">
                    <div class="grove-name">${grove.name}</div>
                    <div class="grove-location">${grove.location}</div>
                </div>
                <div class="grove-stats">
                    <div class="grove-stat">
                        <span class="stat-label">Health</span>
                        <span class="stat-value health-${this.getHealthClass(grove.healthScore)}">${grove.healthScore}</span>
                    </div>
                    <div class="grove-stat">
                        <span class="stat-label">ROI</span>
                        <span class="stat-value positive">${grove.roi}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getHealthClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'fair';
        return 'poor';
    }

    async loadMarketActivity() {
        try {
            // Mock market activity data
            document.getElementById('recentTransactions').textContent = '47';
            document.getElementById('activeListings').textContent = '23';
            document.getElementById('recentHarvests').textContent = '12';
        } catch (error) {
            console.error('[Dashboard] Error loading market activity:', error);
        }
    }

    async loadRevenueStats() {
        try {
            const farmerAddress = window.walletManager?.getAccountId();
            
            if (!farmerAddress) {
                // Show placeholder if not connected
                document.getElementById('monthlyDistribution').textContent = '-';
                document.getElementById('pendingDistributions').textContent = '-';
                document.getElementById('nextPayout').textContent = '-';
                return;
            }

            // Fetch harvest stats from backend
            const response = await window.coffeeAPI.getHarvestStats(farmerAddress);
            
            console.log('[Dashboard] Revenue stats response:', response);
            
            if (response.success && response.data) {
                const stats = response.data;
                
                console.log('[Dashboard] Stats data:', {
                    monthlyEarnings: stats.monthlyEarnings,
                    pendingDistributions: stats.pendingDistributions,
                    totalEarnings: stats.totalEarnings
                });
                
                // Monthly distribution (distributed this month)
                const monthlyDistribution = stats.monthlyEarnings || 0;
                document.getElementById('monthlyDistribution').textContent = `$${monthlyDistribution.toFixed(2)}`;
                
                // Pending distributions (not yet distributed)
                const pendingDistributions = stats.pendingDistributions || 0;
                document.getElementById('pendingDistributions').textContent = `$${pendingDistributions.toFixed(2)}`;
                
                // Next payout (estimate based on pending)
                if (pendingDistributions > 0) {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    nextMonth.setDate(15); // Assume 15th of next month
                    document.getElementById('nextPayout').textContent = nextMonth.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                } else {
                    document.getElementById('nextPayout').textContent = 'No pending';
                }
            } else {
                console.warn('[Dashboard] No revenue stats data:', response);
                // Show zeros if no data
                document.getElementById('monthlyDistribution').textContent = '$0.00';
                document.getElementById('pendingDistributions').textContent = '$0.00';
                document.getElementById('nextPayout').textContent = 'No pending';
            }
        } catch (error) {
            console.error('[Dashboard] Error loading revenue stats:', error);
            // Show error state
            document.getElementById('monthlyDistribution').textContent = 'Error';
            document.getElementById('pendingDistributions').textContent = 'Error';
            document.getElementById('nextPayout').textContent = 'Error';
        }
    }

    async loadPriceHistory() {
        try {
            const response = await window.coffeeAPI.getPriceHistory('Arabica', this.currentPeriod);
            
            if (response.success && response.history) {
                this.priceHistory = response.history;
            } else {
                // Mock price history data
                this.priceHistory = this.generateMockPriceData(this.currentPeriod);
            }
            
            this.updatePriceChart();

        } catch (error) {
            console.error('[Dashboard] Error loading price history:', error);
            this.priceHistory = this.generateMockPriceData(this.currentPeriod);
            this.updatePriceChart();
        }
    }

    generateMockPriceData(days) {
        const data = [];
        const basePrice = 4.25;
        const now = Date.now();
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now - i * 24 * 60 * 60 * 1000);
            const variation = (Math.random() - 0.5) * 0.3;
            data.push({
                timestamp: date.getTime(),
                price: basePrice + variation
            });
        }
        
        return data;
    }

    updatePriceChart() {
        const canvas = document.getElementById('priceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        // Simple chart implementation (you can replace with Chart.js for better visuals)
        this.renderSimpleChart(ctx, canvas);
    }

    renderSimpleChart(ctx, canvas) {
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = 200;
        
        if (this.priceHistory.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No price data available', width / 2, height / 2);
            return;
        }

        const prices = this.priceHistory.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
        
        // Draw price line
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.priceHistory.forEach((point, index) => {
            const x = padding + (chartWidth / (this.priceHistory.length - 1)) * index;
            const y = padding + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw labels
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 4; i++) {
            const price = maxPrice - (priceRange / 4) * i;
            const y = padding + (chartHeight / 4) * i;
            ctx.fillText(`$${price.toFixed(2)}`, padding - 10, y + 4);
        }
    }

    async refreshActivity() {
        console.log('[Dashboard] Refreshing activity feed...');
        await this.loadActivityFeed();
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

// Add this function to handle quick actions
function initializeQuickActions() {
    const quickActionButtons = document.querySelectorAll('.action-btn[data-action]');
    
    quickActionButtons.forEach(button => {
        // Remove existing listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = newButton.dataset.action;
            console.log('Quick action clicked:', action);
            
            switch(action) {
                case 'investor-portfolio':
                    if (window.viewManager) {
                        window.viewManager.switchView('investor');
                        setTimeout(() => {
                            if (window.investorPortal && window.investorPortal.switchSection) {
                                window.investorPortal.switchSection('browse');
                            }
                        }, 100);
                    }
                    break;
                    
                case 'investor-marketplace':
                    if (window.viewManager) {
                        window.viewManager.switchView('investor');
                        setTimeout(() => {
                            if (window.investorPortal && window.investorPortal.switchSection) {
                                window.investorPortal.switchSection('marketplace');
                            }
                        }, 100);
                    }
                    break;
                    
                case 'farmer-portal':
                    if (window.viewManager) {
                        window.viewManager.switchView('farmer');
                    }
                    break;
                    
                default:
                    console.warn('Unknown action:', action);
            }
        });
    });
    
    console.log('✅ Quick action buttons initialized:', quickActionButtons.length);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.dashboardEnhanced = new DashboardEnhanced();
        // Initialize quick actions
        initializeQuickActions();
    });
} else {
    window.dashboardEnhanced = new DashboardEnhanced();
    // Initialize quick actions
    initializeQuickActions();
}