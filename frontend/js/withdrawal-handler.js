/**
 * Withdrawal Handler
 * Handles withdrawal requests and notifications
 */

class WithdrawalHandler {
    constructor() {
        this.apiBaseUrl = window.location.origin
        this.notificationManager = window.notificationManager
    }

    /**
     * Process farmer withdrawal
     * @param {string} farmerAddress - Farmer's Hedera address
     * @param {number} amount - Amount to withdraw in USDC
     * @param {number} groveId - Optional grove ID
     * @returns {Promise<Object>} Withdrawal result
     */
    async withdrawFarmerShare(farmerAddress, amount, groveId = null) {
        try {
            // Show pending notification
            const pendingNotifId = this.notificationManager.info(
                `Processing withdrawal of $${amount.toFixed(2)}...`,
                { autoDismiss: false }
            )

            const response = await fetch(`${this.apiBaseUrl}/api/revenue/withdraw-farmer-share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    farmerAddress,
                    amount,
                    groveId
                })
            })

            const data = await response.json()

            // Dismiss pending notification
            this.notificationManager.dismiss(pendingNotifId)

            if (!response.ok || !data.success) {
                // Show error notification
                this.notificationManager.error(
                    data.error || 'Withdrawal failed. Please try again.',
                    {
                        title: 'Withdrawal Failed',
                        autoDismiss: false
                    }
                )
                return { success: false, error: data.error }
            }

            // Show success notification with transaction link
            this.notificationManager.success(
                `Successfully withdrew $${amount.toFixed(2)}`,
                {
                    title: 'Withdrawal Complete',
                    action: data.data.transactionHash ? () => {
                        const network = window.location.hostname.includes('testnet') ? 'testnet' : 'mainnet'
                        window.open(
                            `https://hashscan.io/${network}/transaction/${data.data.transactionHash}`,
                            '_blank'
                        )
                    } : null,
                    actionLabel: data.data.transactionHash ? 'View Transaction' : null,
                    duration: 15000
                }
            )

            return {
                success: true,
                data: data.data
            }

        } catch (error) {
            console.error('Error processing farmer withdrawal:', error)
            this.notificationManager.error(
                'Network error. Please check your connection and try again.',
                {
                    title: 'Withdrawal Failed',
                    autoDismiss: false
                }
            )
            return { success: false, error: error.message }
        }
    }

    /**
     * Process liquidity withdrawal
     * @param {string} providerAddress - Provider's Hedera address
     * @param {string} assetAddress - Asset address (USDC, KES, etc.)
     * @param {number} lpTokenAmount - Amount of LP tokens to withdraw
     * @returns {Promise<Object>} Withdrawal result
     */
    async withdrawLiquidity(providerAddress, assetAddress, lpTokenAmount) {
        try {
            // Show pending notification
            const pendingNotifId = this.notificationManager.info(
                `Processing liquidity withdrawal of ${lpTokenAmount.toFixed(2)} LP tokens...`,
                { autoDismiss: false }
            )

            const response = await fetch(`${this.apiBaseUrl}/api/lending/withdraw-liquidity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    providerAddress,
                    assetAddress,
                    lpTokenAmount
                })
            })

            const data = await response.json()

            // Dismiss pending notification
            this.notificationManager.dismiss(pendingNotifId)

            if (!response.ok || !data.success) {
                // Show error notification
                this.notificationManager.error(
                    data.error || 'Withdrawal failed. Please try again.',
                    {
                        title: 'Withdrawal Failed',
                        autoDismiss: false
                    }
                )
                return { success: false, error: data.error }
            }

            // Show success notification with details
            const usdcReturned = data.data.usdcReturned || 0
            const rewardsEarned = data.data.rewardsEarned || 0

            this.notificationManager.success(
                `Withdrew ${lpTokenAmount.toFixed(2)} LP tokens\nReceived: $${usdcReturned.toFixed(2)} (including $${rewardsEarned.toFixed(2)} rewards)`,
                {
                    title: 'Withdrawal Complete',
                    action: data.data.transactionHash ? () => {
                        const network = window.location.hostname.includes('testnet') ? 'testnet' : 'mainnet'
                        window.open(
                            `https://hashscan.io/${network}/transaction/${data.data.transactionHash}`,
                            '_blank'
                        )
                    } : null,
                    actionLabel: data.data.transactionHash ? 'View Transaction' : null,
                    duration: 15000
                }
            )

            return {
                success: true,
                data: data.data
            }

        } catch (error) {
            console.error('Error processing liquidity withdrawal:', error)
            this.notificationManager.error(
                'Network error. Please check your connection and try again.',
                {
                    title: 'Withdrawal Failed',
                    autoDismiss: false
                }
            )
            return { success: false, error: error.message }
        }
    }

    /**
     * Get farmer balance
     * @param {string} farmerAddress - Farmer's Hedera address
     * @returns {Promise<Object>} Balance information
     */
    async getFarmerBalance(farmerAddress) {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/api/revenue/farmer-balance?farmerAddress=${encodeURIComponent(farmerAddress)}`
            )

            const data = await response.json()

            if (!response.ok || !data.success) {
                console.error('Error fetching farmer balance:', data.error)
                return null
            }

            return data.data

        } catch (error) {
            console.error('Error fetching farmer balance:', error)
            return null
        }
    }

    /**
     * Set max withdrawable amount (30% of available balance)
     * @param {string} farmerAddress - Farmer's Hedera address
     * @param {HTMLInputElement} amountInput - Amount input element
     */
    async setMaxWithdrawAmount(farmerAddress, amountInput) {
        try {
            const balance = await this.getFarmerBalance(farmerAddress)
            
            if (!balance) {
                this.notificationManager.error('Failed to fetch balance', {
                    title: 'Error'
                })
                return
            }

            // Set the max withdrawable amount (30% of available balance)
            const maxAmount = balance.maxWithdrawable || 0
            amountInput.value = maxAmount.toFixed(2)

            // Show info notification
            this.notificationManager.info(
                `Maximum withdrawal: ${maxAmount.toFixed(2)} (30% of available balance)`,
                {
                    title: 'Max Amount Set',
                    duration: 5000
                }
            )

        } catch (error) {
            console.error('Error setting max withdraw amount:', error)
            this.notificationManager.error('Failed to set max amount', {
                title: 'Error'
            })
        }
    }

    /**
     * Get farmer withdrawal history
     * @param {string} farmerAddress - Farmer's Hedera address
     * @returns {Promise<Array>} Withdrawal history
     */
    async getFarmerWithdrawalHistory(farmerAddress) {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/api/revenue/withdrawal-history?farmerAddress=${encodeURIComponent(farmerAddress)}`
            )

            const data = await response.json()

            if (!response.ok || !data.success) {
                console.error('Error fetching withdrawal history:', data.error)
                return []
            }

            return data.data.withdrawals || []

        } catch (error) {
            console.error('Error fetching withdrawal history:', error)
            return []
        }
    }

    /**
     * Format withdrawal status for display
     * @param {string} status - Withdrawal status
     * @returns {Object} Formatted status with color and label
     */
    formatStatus(status) {
        const statusMap = {
            pending: { label: 'Pending', color: '#FFA500', icon: '⏳' },
            completed: { label: 'Completed', color: '#4CAF50', icon: '✓' },
            failed: { label: 'Failed', color: '#F44336', icon: '✗' }
        }
        return statusMap[status] || statusMap.pending
    }
}

// Create global instance
window.withdrawalHandler = new WithdrawalHandler()

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WithdrawalHandler
}
