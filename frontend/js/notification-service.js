/**
 * Notification Service
 * Handles in-app notifications for funding requests and other events
 */

class NotificationService {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.initialized = false;
    }

    /**
     * Initialize notification service
     */
    init() {
        if (this.initialized) return;
        
        // Create notification bell in navbar
        this.createNotificationBell();
        
        // Load notifications from localStorage
        this.loadNotifications();
        
        // Check for new notifications periodically
        this.startPolling();
        
        this.initialized = true;
        console.log('[Notifications] Service initialized');
    }

    /**
     * Create notification bell UI
     */
    createNotificationBell() {
        const navUser = document.querySelector('.nav-user');
        if (!navUser) return;

        const bellContainer = document.createElement('div');
        bellContainer.className = 'notification-bell-container';
        bellContainer.innerHTML = `
            <button class="notification-bell" id="notificationBell">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
            </button>
            <div class="notification-dropdown" id="notificationDropdown" style="display: none;">
                <div class="notification-header">
                    <h4>Notifications</h4>
                    <button class="btn-link" onclick="window.notificationService.markAllAsRead()">Mark all read</button>
                </div>
                <div class="notification-list" id="notificationList">
                    <div class="empty-state">No notifications</div>
                </div>
            </div>
        `;

        navUser.insertBefore(bellContainer, navUser.firstChild);

        // Add event listeners
        document.getElementById('notificationBell').addEventListener('click', () => {
            this.toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-bell-container')) {
                this.closeDropdown();
            }
        });
    }

    /**
     * Toggle notification dropdown
     */
    toggleDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            if (dropdown.style.display === 'block') {
                this.renderNotifications();
            }
        }
    }

    /**
     * Close notification dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    /**
     * Add a new notification
     */
    addNotification(notification) {
        const newNotification = {
            id: Date.now(),
            ...notification,
            read: false,
            timestamp: Date.now()
        };

        this.notifications.unshift(newNotification);
        this.unreadCount++;
        
        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.saveNotifications();
        this.updateBadge();
        
        // Show toast notification
        if (window.walletManager && typeof window.walletManager.showToast === 'function') {
            window.walletManager.showToast(notification.message, notification.type || 'info');
        }

        console.log('[Notifications] New notification added:', notification);
    }

    /**
     * Mark notification as read
     */
    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveNotifications();
            this.updateBadge();
            this.renderNotifications();
        }
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateBadge();
        this.renderNotifications();
    }

    /**
     * Update notification badge
     */
    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Render notifications in dropdown
     */
    renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = '<div class="empty-state">No notifications</div>';
            return;
        }

        list.innerHTML = this.notifications.map(notification => {
            const timeAgo = this.getTimeAgo(notification.timestamp);
            const icon = this.getNotificationIcon(notification.type);
            
            return `
                <div class="notification-item ${notification.read ? 'read' : 'unread'}" 
                     onclick="window.notificationService.markAsRead(${notification.id})">
                    <div class="notification-icon ${notification.type}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    ${!notification.read ? '<div class="notification-dot"></div>' : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Get notification icon based on type
     */
    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle',
            'funding': 'fa-hand-holding-usd',
            'harvest': 'fa-seedling',
            'payment': 'fa-dollar-sign'
        };
        return icons[type] || 'fa-bell';
    }

    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Save notifications to localStorage
     */
    saveNotifications() {
        try {
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
            localStorage.setItem('unreadCount', this.unreadCount.toString());
        } catch (error) {
            console.error('[Notifications] Error saving:', error);
        }
    }

    /**
     * Load notifications from localStorage
     */
    loadNotifications() {
        try {
            const saved = localStorage.getItem('notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.unreadCount = parseInt(localStorage.getItem('unreadCount') || '0');
                this.updateBadge();
            }
        } catch (error) {
            console.error('[Notifications] Error loading:', error);
        }
    }

    /**
     * Start polling for new notifications
     */
    startPolling() {
        // Poll every 30 seconds
        setInterval(() => {
            this.checkForNewNotifications();
        }, 30000);
    }

    /**
     * Check for new notifications from server
     */
    async checkForNewNotifications() {
        const accountId = window.walletManager?.getAccountId();
        if (!accountId) return;

        try {
            // Check for pending funding requests (for farmers)
            const response = await fetch(`/api/funding/requests/${accountId}`, {
                headers: { 'x-account-id': accountId }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.requests) {
                    // Check for newly approved/rejected requests
                    data.requests.forEach(request => {
                        const lastCheck = localStorage.getItem('lastNotificationCheck') || '0';
                        const requestTime = new Date(request.reviewedAt || request.createdAt).getTime();
                        
                        if (requestTime > parseInt(lastCheck)) {
                            if (request.status === 'approved' || request.status === 'disbursed') {
                                this.addNotification({
                                    type: 'success',
                                    title: 'Funding Request Approved',
                                    message: `Your funding request for $${(request.amountApproved / 100).toFixed(2)} has been approved!`
                                });
                            } else if (request.status === 'rejected') {
                                this.addNotification({
                                    type: 'error',
                                    title: 'Funding Request Rejected',
                                    message: `Your funding request was rejected. Reason: ${request.rejectionReason || 'Not specified'}`
                                });
                            }
                        }
                    });
                }
            }
            
            localStorage.setItem('lastNotificationCheck', Date.now().toString());
        } catch (error) {
            console.error('[Notifications] Error checking for new notifications:', error);
        }
    }

    /**
     * Notify farmer of request status change
     */
    notifyFarmerRequestApproved(amount, milestone) {
        this.addNotification({
            type: 'success',
            title: 'Funding Approved! 🎉',
            message: `Your ${milestone} funding request for $${amount} has been approved and funds are being disbursed.`
        });
    }

    notifyFarmerRequestRejected(reason) {
        this.addNotification({
            type: 'error',
            title: 'Funding Request Rejected',
            message: `Your request was rejected. Reason: ${reason}`
        });
    }

    notifyFarmerFundsDisbursed(amount, transactionId) {
        this.addNotification({
            type: 'payment',
            title: 'Funds Disbursed 💰',
            message: `$${amount} has been sent to your wallet. Transaction: ${transactionId.substring(0, 10)}...`
        });
    }

    /**
     * Notify admin of new request
     */
    notifyAdminNewRequest(farmerAddress, amount, milestone) {
        this.addNotification({
            type: 'funding',
            title: 'New Funding Request',
            message: `Farmer ${farmerAddress.substring(0, 10)}... requested $${amount} for ${milestone}`
        });
    }
}

// Create global instance
window.notificationService = new NotificationService();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationService.init();
    });
} else {
    window.notificationService.init();
}
