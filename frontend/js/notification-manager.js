/**
 * Notification Manager
 * Handles displaying toast notifications for user feedback
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.nextId = 1;
        this.autoDismissTimeout = 10000; // 10 seconds
        this.init();
    }

    /**
     * Initialize the notification container
     */
    init() {
        // Create notification container if it doesn't exist
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            // Check for alternative container ID used in app.html
            this.container = document.getElementById('toastContainer');
        }
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
        
        // Debug logging
        if (window.location.hostname === 'localhost') {
            console.log('NotificationManager initialized with container:', this.container.id);
        }
    }

    /**
     * Show a success notification
     * @param {string} message - The message to display
     * @param {Object} options - Additional options
     * @returns {number} Notification ID
     */
    success(message, options = {}) {
        if (window.location.hostname === 'localhost') {
            console.log('Showing success notification:', message);
        }
        return this.show({
            type: 'success',
            message,
            ...options
        });
    }

    /**
     * Show an error notification
     * @param {string} message - The message to display
     * @param {Object} options - Additional options
     * @returns {number} Notification ID
     */
    error(message, options = {}) {
        if (window.location.hostname === 'localhost') {
            console.log('Showing error notification:', message);
        }
        return this.show({
            type: 'error',
            message,
            autoDismiss: false, // Errors don't auto-dismiss by default
            ...options
        });
    }

    /**
     * Show a warning notification
     * @param {string} message - The message to display
     * @param {Object} options - Additional options
     * @returns {number} Notification ID
     */
    warning(message, options = {}) {
        if (window.location.hostname === 'localhost') {
            console.log('Showing warning notification:', message);
        }
        return this.show({
            type: 'warning',
            message,
            ...options
        });
    }

    /**
     * Show an info notification
     * @param {string} message - The message to display
     * @param {Object} options - Additional options
     * @returns {number} Notification ID
     */
    info(message, options = {}) {
        if (window.location.hostname === 'localhost') {
            console.log('Showing info notification:', message);
        }
        return this.show({
            type: 'info',
            message,
            ...options
        });
    }

    /**
     * Show a notification
     * @param {Object} config - Notification configuration
     * @returns {number} Notification ID
     */
    show(config) {
        const {
            type = 'info',
            message,
            title = null,
            autoDismiss = true,
            duration = this.autoDismissTimeout,
            action = null,
            actionLabel = null
        } = config;

        const id = this.nextId++;

        // Create notification element
        const notification = this.createNotificationElement({
            id,
            type,
            message,
            title,
            action,
            actionLabel
        });

        // Add to container
        this.container.appendChild(notification);

        // Store notification reference
        this.notifications.push({
            id,
            element: notification,
            type,
            message
        });

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto-dismiss if enabled
        if (autoDismiss) {
            setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }

        return id;
    }

    /**
     * Create notification DOM element
     * @param {Object} config - Notification configuration
     * @returns {HTMLElement} Notification element
     */
    createNotificationElement(config) {
        const { id, type, message, title, action, actionLabel } = config;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.dataset.notificationId = id;

        // Icon
        const icon = this.getIconForType(type);
        const iconElement = document.createElement('div');
        iconElement.className = 'notification-icon';
        iconElement.innerHTML = icon;

        // Content
        const content = document.createElement('div');
        content.className = 'notification-content';

        if (title) {
            const titleElement = document.createElement('div');
            titleElement.className = 'notification-title';
            titleElement.textContent = title;
            content.appendChild(titleElement);
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = message;
        content.appendChild(messageElement);

        // Action button (optional)
        if (action && actionLabel) {
            const actionButton = document.createElement('button');
            actionButton.className = 'notification-action';
            actionButton.textContent = actionLabel;
            actionButton.onclick = (e) => {
                e.stopPropagation();
                action();
                this.dismiss(id);
            };
            content.appendChild(actionButton);
        }

        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => this.dismiss(id);

        // Assemble notification
        notification.appendChild(iconElement);
        notification.appendChild(content);
        notification.appendChild(closeButton);

        return notification;
    }

    /**
     * Get icon HTML for notification type
     * @param {string} type - Notification type
     * @returns {string} Icon HTML
     */
    getIconForType(type) {
        const icons = {
            success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>`,
            error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`,
            warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    /**
     * Dismiss a notification
     * @param {number} id - Notification ID
     */
    dismiss(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;

        // Remove show class to trigger exit animation
        notification.element.classList.remove('show');

        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            // Remove from notifications array
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        const ids = this.notifications.map(n => n.id);
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Get all active notifications
     * @returns {Array} Active notifications
     */
    getActiveNotifications() {
        return [...this.notifications];
    }

    /**
     * Check if there are any active notifications of a specific type
     * @param {string} type - Notification type
     * @returns {boolean} True if there are active notifications of that type
     */
    hasActiveNotificationsOfType(type) {
        return this.notifications.some(n => n.type === type);
    }
}

// Create global instance
window.notificationManager = new NotificationManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}