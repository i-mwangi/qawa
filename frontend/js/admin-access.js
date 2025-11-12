/**
 * Admin Access Control
 * Checks if connected wallet has admin privileges and shows/hides admin features
 */

class AdminAccessManager {
    constructor() {
        this.isAdmin = false;
        this.accountId = null;
    }

    /**
     * Check if current user has admin access
     */
    async checkAccess() {
        try {
            // Get account ID from wallet manager
            this.accountId = window.walletManager?.getAccountId();
            
            if (!this.accountId) {
                this.isAdmin = false;
                this.updateUI();
                return false;
            }

            // Check with backend
            const response = await fetch('/api/admin/check-access', {
                headers: {
                    'x-account-id': this.accountId
                }
            });

            this.isAdmin = response.ok;
            this.updateUI();
            
            return this.isAdmin;
        } catch (error) {
            console.error('Error checking admin access:', error);
            this.isAdmin = false;
            this.updateUI();
            return false;
        }
    }

    /**
     * Update UI based on admin status
     */
    updateUI() {
        const adminNavBtn = document.getElementById('adminNavBtn');
        
        if (this.isAdmin) {
            // Show admin navigation button
            if (adminNavBtn) {
                adminNavBtn.classList.remove('hidden');
            }
            
            console.log('Admin access granted for:', this.accountId);
        } else {
            // Hide admin navigation button
            if (adminNavBtn) {
                adminNavBtn.classList.add('hidden');
            }
        }
    }

    /**
     * Get admin status
     */
    getAdminStatus() {
        return {
            isAdmin: this.isAdmin,
            accountId: this.accountId
        };
    }
}

// Create global instance
window.adminAccessManager = new AdminAccessManager();

// Check access when wallet connects
document.addEventListener('walletConnected', async () => {
    await window.adminAccessManager.checkAccess();
});

// Check access when wallet disconnects
document.addEventListener('walletDisconnected', () => {
    window.adminAccessManager.isAdmin = false;
    window.adminAccessManager.accountId = null;
    window.adminAccessManager.updateUI();
});

// Check access on page load if wallet is already connected
window.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for wallet manager to initialize
    setTimeout(async () => {
        if (window.walletManager?.getAccountId()) {
            await window.adminAccessManager.checkAccess();
        }
    }, 1000);
});
