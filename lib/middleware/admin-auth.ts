/**
 * Admin Authentication Middleware
 * Provides role-based access control for admin-only features
 */

/**
 * Check if a Hedera account ID has admin privileges
 * @param accountId - Hedera account ID (e.g., "0.0.5792828")
 * @returns true if account is an admin, false otherwise
 */
export function isAdmin(accountId: string | null | undefined): boolean {
    if (!accountId) {
        return false;
    }

    // Get admin accounts from environment variable
    const adminAccounts = process.env.ADMIN_ACCOUNTS?.split(',').map(id => id.trim()) || [];
    
    // Check if account is in the admin list
    return adminAccounts.includes(accountId);
}

/**
 * Get list of all admin accounts
 * @returns Array of admin account IDs
 */
export function getAdminAccounts(): string[] {
    return process.env.ADMIN_ACCOUNTS?.split(',').map(id => id.trim()) || [];
}

/**
 * Validate admin access and return appropriate error response
 * @param accountId - Hedera account ID to check
 * @returns Object with success status and optional error message
 */
export function validateAdminAccess(accountId: string | null | undefined): {
    success: boolean;
    error?: string;
} {
    if (!accountId) {
        return {
            success: false,
            error: 'Authentication required. Please connect your wallet.'
        };
    }

    if (!isAdmin(accountId)) {
        return {
            success: false,
            error: 'Access denied. Admin privileges required.'
        };
    }

    return { success: true };
}
