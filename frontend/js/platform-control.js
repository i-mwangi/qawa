/**
 * Platform Control Admin Panel
 * Handles platform-wide administrative controls
 */

class PlatformControlPanel {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.init();
    }

    async init() {
        await this.loadPlatformStatus();
        this.setupEventListeners();
        
        // Auto-refresh status every 30 seconds
        setInterval(() => this.loadPlatformStatus(), 30000);
    }

    async loadPlatformStatus() {
        try {
            const response = await this.apiClient.getPlatformStatus();
            
            if (response.success) {
                this.updateStatusDisplay(response.status);
            }
        } catch (error) {
            console.error('Failed to load platform status:', error);
            this.showError('Failed to load platform status');
        }
    }

    updateStatusDisplay(status) {
        // Update status indicators
        const tradingStatus = document.getElementById('trading-status');
        const registrationStatus = document.getElementById('registration-status');
        const harvestStatus = document.getElementById('harvest-status');
        const purchaseStatus = document.getElementById('purchase-status');

        if (tradingStatus) {
            tradingStatus.textContent = status.tradingPaused ? 'Paused' : 'Active';
            tradingStatus.className = `status-badge ${status.tradingPaused ? 'status-paused' : 'status-active'}`;
        }

        if (registrationStatus) {
            registrationStatus.textContent = status.groveRegistrationPaused ? 'Paused' : 'Active';
            registrationStatus.className = `status-badge ${status.groveRegistrationPaused ? 'status-paused' : 'status-active'}`;
        }

        if (harvestStatus) {
            harvestStatus.textContent = status.harvestReportingPaused ? 'Paused' : 'Active';
            harvestStatus.className = `status-badge ${status.harvestReportingPaused ? 'status-paused' : 'status-active'}`;
        }

        if (purchaseStatus) {
            purchaseStatus.textContent = status.tokenPurchasePaused ? 'Paused' : 'Active';
            purchaseStatus.className = `status-badge ${status.tokenPurchasePaused ? 'status-paused' : 'status-active'}`;
        }

        // Update button states
        const pauseTradingBtn = document.getElementById('pause-trading-btn');
        const resumeTradingBtn = document.getElementById('resume-trading-btn');
        
        if (pauseTradingBtn && resumeTradingBtn) {
            pauseTradingBtn.disabled = status.tradingPaused;
            resumeTradingBtn.disabled = !status.tradingPaused;
        }

        const pauseRegistrationBtn = document.getElementById('pause-registration-btn');
        const resumeRegistrationBtn = document.getElementById('resume-registration-btn');
        
        if (pauseRegistrationBtn && resumeRegistrationBtn) {
            pauseRegistrationBtn.disabled = status.groveRegistrationPaused;
            resumeRegistrationBtn.disabled = !status.groveRegistrationPaused;
        }
    }

    setupEventListeners() {
        // Trading controls
        const pauseTradingBtn = document.getElementById('pause-trading-btn');
        const resumeTradingBtn = document.getElementById('resume-trading-btn');
        
        if (pauseTradingBtn) {
            pauseTradingBtn.addEventListener('click', () => this.pauseTrading());
        }
        
        if (resumeTradingBtn) {
            resumeTradingBtn.addEventListener('click', () => this.resumeTrading());
        }

        // Registration controls
        const pauseRegistrationBtn = document.getElementById('pause-registration-btn');
        const resumeRegistrationBtn = document.getElementById('resume-registration-btn');
        
        if (pauseRegistrationBtn) {
            pauseRegistrationBtn.addEventListener('click', () => this.pauseRegistration());
        }
        
        if (resumeRegistrationBtn) {
            resumeRegistrationBtn.addEventListener('click', () => this.resumeRegistration());
        }

        // Emergency controls
        const emergencyShutdownBtn = document.getElementById('emergency-shutdown-btn');
        const emergencyResumeBtn = document.getElementById('emergency-resume-btn');
        
        if (emergencyShutdownBtn) {
            emergencyShutdownBtn.addEventListener('click', () => this.confirmEmergencyShutdown());
        }
        
        if (emergencyResumeBtn) {
            emergencyResumeBtn.addEventListener('click', () => this.emergencyResume());
        }
    }

    async pauseTrading() {
        if (!confirm('Are you sure you want to pause trading?')) {
            return;
        }

        try {
            this.showLoading('Pausing trading...');
            const response = await this.apiClient.pauseTrading();
            
            if (response.success) {
                this.showSuccess('Trading paused successfully');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to pause trading');
            }
        } catch (error) {
            console.error('Failed to pause trading:', error);
            this.showError('Failed to pause trading: ' + error.message);
        }
    }

    async resumeTrading() {
        try {
            this.showLoading('Resuming trading...');
            const response = await this.apiClient.resumeTrading();
            
            if (response.success) {
                this.showSuccess('Trading resumed successfully');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to resume trading');
            }
        } catch (error) {
            console.error('Failed to resume trading:', error);
            this.showError('Failed to resume trading: ' + error.message);
        }
    }

    async pauseRegistration() {
        if (!confirm('Are you sure you want to pause grove registration?')) {
            return;
        }

        try {
            this.showLoading('Pausing grove registration...');
            const response = await this.apiClient.pauseGroveRegistration();
            
            if (response.success) {
                this.showSuccess('Grove registration paused successfully');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to pause registration');
            }
        } catch (error) {
            console.error('Failed to pause registration:', error);
            this.showError('Failed to pause registration: ' + error.message);
        }
    }

    async resumeRegistration() {
        try {
            this.showLoading('Resuming grove registration...');
            const response = await this.apiClient.resumeGroveRegistration();
            
            if (response.success) {
                this.showSuccess('Grove registration resumed successfully');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to resume registration');
            }
        } catch (error) {
            console.error('Failed to resume registration:', error);
            this.showError('Failed to resume registration: ' + error.message);
        }
    }

    confirmEmergencyShutdown() {
        const confirmed = confirm(
            '⚠️ EMERGENCY SHUTDOWN ⚠️\n\n' +
            'This will immediately pause ALL platform operations:\n' +
            '- Trading\n' +
            '- Grove Registration\n' +
            '- Harvest Reporting\n' +
            '- Token Purchases\n\n' +
            'Are you absolutely sure you want to proceed?'
        );

        if (confirmed) {
            const doubleCheck = confirm(
                'This is your final confirmation.\n\n' +
                'Proceed with emergency shutdown?'
            );

            if (doubleCheck) {
                this.emergencyShutdown();
            }
        }
    }

    async emergencyShutdown() {
        try {
            this.showLoading('Activating emergency shutdown...');
            const response = await this.apiClient.emergencyShutdown();
            
            if (response.success) {
                this.showSuccess('🚨 Emergency shutdown activated! All platform operations paused.');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to activate emergency shutdown');
            }
        } catch (error) {
            console.error('Failed to activate emergency shutdown:', error);
            this.showError('Failed to activate emergency shutdown: ' + error.message);
        }
    }

    async emergencyResume() {
        if (!confirm('Resume all platform operations?')) {
            return;
        }

        try {
            this.showLoading('Resuming platform operations...');
            const response = await this.apiClient.emergencyResume();
            
            if (response.success) {
                this.showSuccess('✅ Platform operations resumed successfully');
                await this.loadPlatformStatus();
            } else {
                this.showError(response.error || 'Failed to resume platform');
            }
        } catch (error) {
            console.error('Failed to resume platform:', error);
            this.showError('Failed to resume platform: ' + error.message);
        }
    }

    showLoading(message) {
        const statusMessage = document.getElementById('platform-status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message loading';
        }
    }

    showSuccess(message) {
        const statusMessage = document.getElementById('platform-status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message success';
            
            setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 5000);
        }
    }

    showError(message) {
        const statusMessage = document.getElementById('platform-status-message');
        if (statusMessage) {
            statusMessage.textContent = '❌ ' + message;
            statusMessage.className = 'status-message error';
            
            setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 8000);
        }
    }
}

// Make available globally
window.PlatformControlPanel = PlatformControlPanel;
