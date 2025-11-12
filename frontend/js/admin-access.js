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
            console.log('[Admin Access] Checking access for account:', this.accountId);
            
            if (!this.accountId) {
                console.log('[Admin Access] No account ID found');
                this.isAdmin = false;
                this.updateUI();
                return false;
            }

            // Check with backend
            console.log('[Admin Access] Calling API to check admin status...');
            const response = await fetch('/api/admin/check-access', {
                headers: {
                    'x-account-id': this.accountId
                }
            });

            this.isAdmin = response.ok;
            console.log('[Admin Access] API response:', response.status, 'isAdmin:', this.isAdmin);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Admin Access] Admin access granted:', data);
            } else {
                console.log('[Admin Access] Admin access denied');
            }
            
            this.updateUI();
            
            return this.isAdmin;
        } catch (error) {
            console.error('[Admin Access] Error checking admin access:', error);
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
    console.log('[Admin Access] walletConnected event received');
    await window.adminAccessManager.checkAccess();
});

// Check access when wallet disconnects
document.addEventListener('walletDisconnected', () => {
    console.log('[Admin Access] walletDisconnected event received');
    window.adminAccessManager.isAdmin = false;
    window.adminAccessManager.accountId = null;
    window.adminAccessManager.updateUI();
});

// Check access on page load if wallet is already connected
window.addEventListener('DOMContentLoaded', async () => {
    console.log('[Admin Access] DOM loaded, checking for wallet...');
    // Wait a bit for wallet manager to initialize
    setTimeout(async () => {
        if (window.walletManager?.getAccountId()) {
            console.log('[Admin Access] Wallet already connected, checking admin access');
            await window.adminAccessManager.checkAccess();
        }
    }, 1000);
});

// Also check periodically in case wallet connects
let checkInterval = setInterval(async () => {
    if (window.walletManager?.getAccountId() && !window.adminAccessManager.isAdmin) {
        console.log('[Admin Access] Wallet detected via polling, checking admin access');
        await window.adminAccessManager.checkAccess();
        // Stop checking once we've verified
        if (window.adminAccessManager.accountId) {
            clearInterval(checkInterval);
        }
    }
}, 2000);
