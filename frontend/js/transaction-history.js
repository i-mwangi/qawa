/**
 * Transaction History Manager
 * Handles transaction history tracking, display, and export functionality
 */

// Transaction Types
export const TransactionType = {
    PURCHASE: 'purchase',
    SALE: 'sale',
    DISTRIBUTION: 'distribution',
    LOAN: 'loan',
    LOAN_REPAYMENT: 'loan_repayment',
    WITHDRAWAL: 'withdrawal',
    LIQUIDITY_PROVIDED: 'liquidity_provided',
    LIQUIDITY_WITHDRAWN: 'liquidity_withdrawn',
    TOKEN_MINT: 'token_mint',
    TOKEN_BURN: 'token_burn',
    KYC_GRANT: 'kyc_grant',
    KYC_REVOKE: 'kyc_revoke'
};

// Transaction Status
export const TransactionStatus = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * Transaction Record Structure
 * @typedef {Object} TransactionRecord
 * @property {string} id - Unique transaction ID
 * @property {string} type - Transaction type from TransactionType enum
 * @property {number} amount - Transaction amount (in smallest unit)
 * @property {string} asset - Asset symbol (USDC, KES, grove token, etc.)
 * @property {string} fromAddress - Sender address
 * @property {string} toAddress - Receiver address
 * @property {string} status - Transaction status from TransactionStatus enum
 * @property {number} timestamp - Unix timestamp
 * @property {string} transactionHash - Blockchain transaction hash
 * @property {string} blockExplorerUrl - URL to view transaction on block explorer
 * @property {Object} metadata - Additional transaction-specific data
 */

class TransactionHistoryManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.transactions = [];
        this.filteredTransactions = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentFilter = 'all';
    }

    /**
     * Create a transaction record
     * @param {Object} txData - Transaction data
     * @returns {TransactionRecord}
     */
    createTransactionRecord(txData) {
        const record = {
            id: txData.id || this.generateTransactionId(),
            type: txData.type,
            amount: txData.amount,
            asset: txData.asset || 'USDC',
            fromAddress: txData.fromAddress || '',
            toAddress: txData.toAddress || '',
            status: txData.status || TransactionStatus.PENDING,
            timestamp: txData.timestamp || Date.now(),
            transactionHash: txData.transactionHash || '',
            blockExplorerUrl: txData.blockExplorerUrl || this.generateBlockExplorerUrl(txData.transactionHash),
            metadata: txData.metadata || {}
        };

        return record;
    }

    /**
     * Generate a unique transaction ID
     * @returns {string}
     */
    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate block explorer URL for Hedera
     * @param {string} transactionHash
     * @returns {string}
     */
    generateBlockExplorerUrl(transactionHash) {
        if (!transactionHash) return '';
        // Hedera HashScan explorer URL
        return `https://hashscan.io/testnet/transaction/${transactionHash}`;
    }

    /**
     * Add a transaction to history
     * @param {Object} txData
     */
    async addTransaction(txData) {
        const record = this.createTransactionRecord(txData);
        this.transactions.unshift(record); // Add to beginning
        
        // Persist to backend
        try {
            await this.apiClient.saveTransaction(record);
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }

        return record;
    }

    /**
     * Fetch transaction history for a user
     * @param {string} userAddress
     * @param {Object} options - Filter options
     * @returns {Promise<TransactionRecord[]>}
     */
    async fetchTransactionHistory(userAddress, options = {}) {
        try {
            const response = await this.apiClient.getTransactionHistory(userAddress, options);
            this.transactions = response.transactions || [];
            this.applyFilter(this.currentFilter);
            return this.transactions;
        } catch (error) {
            console.error('Failed to fetch transaction history:', error);
            throw error;
        }
    }

    /**
     * Apply filter to transactions
     * @param {string} filterType - 'all' or specific TransactionType
     */
    applyFilter(filterType) {
        this.currentFilter = filterType;
        
        if (filterType === 'all') {
            this.filteredTransactions = [...this.transactions];
        } else {
            this.filteredTransactions = this.transactions.filter(tx => tx.type === filterType);
        }
        
        this.currentPage = 1; // Reset to first page
    }

    /**
     * Get paginated transactions
     * @param {number} page
     * @returns {Object} - { transactions, totalPages, currentPage }
     */
    getPaginatedTransactions(page = 1) {
        this.currentPage = page;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        
        const paginatedTxs = this.filteredTransactions.slice(startIndex, endIndex);
        const totalPages = Math.ceil(this.filteredTransactions.length / this.itemsPerPage);
        
        return {
            transactions: paginatedTxs,
            totalPages,
            currentPage: this.currentPage,
            totalTransactions: this.filteredTransactions.length
        };
    }

    /**
     * Update transaction status
     * @param {string} transactionId
     * @param {string} status
     * @param {string} transactionHash
     */
    async updateTransactionStatus(transactionId, status, transactionHash = null) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (tx) {
            tx.status = status;
            if (transactionHash) {
                tx.transactionHash = transactionHash;
                tx.blockExplorerUrl = this.generateBlockExplorerUrl(transactionHash);
            }
            
            // Update in backend
            try {
                await this.apiClient.updateTransaction(transactionId, { status, transactionHash });
            } catch (error) {
                console.error('Failed to update transaction:', error);
            }
        }
    }

    /**
     * Get transaction type display info
     * @param {string} type
     * @returns {Object} - { label, icon, color }
     */
    getTransactionTypeInfo(type) {
        const typeInfo = {
            [TransactionType.PURCHASE]: {
                label: 'Token Purchase',
                icon: '🛒',
                color: '#10b981'
            },
            [TransactionType.SALE]: {
                label: 'Token Sale',
                icon: '💰',
                color: '#f59e0b'
            },
            [TransactionType.DISTRIBUTION]: {
                label: 'Revenue Distribution',
                icon: '💵',
                color: '#3b82f6'
            },
            [TransactionType.LOAN]: {
                label: 'Loan Taken',
                icon: '🏦',
                color: '#8b5cf6'
            },
            [TransactionType.LOAN_REPAYMENT]: {
                label: 'Loan Repayment',
                icon: '✅',
                color: '#10b981'
            },
            [TransactionType.WITHDRAWAL]: {
                label: 'Withdrawal',
                icon: '💸',
                color: '#ef4444'
            },
            [TransactionType.LIQUIDITY_PROVIDED]: {
                label: 'Liquidity Provided',
                icon: '➕',
                color: '#06b6d4'
            },
            [TransactionType.LIQUIDITY_WITHDRAWN]: {
                label: 'Liquidity Withdrawn',
                icon: '➖',
                color: '#f97316'
            },
            [TransactionType.TOKEN_MINT]: {
                label: 'Tokens Minted',
                icon: '🪙',
                color: '#84cc16'
            },
            [TransactionType.TOKEN_BURN]: {
                label: 'Tokens Burned',
                icon: '🔥',
                color: '#dc2626'
            },
            [TransactionType.KYC_GRANT]: {
                label: 'KYC Granted',
                icon: '✓',
                color: '#22c55e'
            },
            [TransactionType.KYC_REVOKE]: {
                label: 'KYC Revoked',
                icon: '✗',
                color: '#ef4444'
            }
        };

        return typeInfo[type] || {
            label: 'Unknown',
            icon: '❓',
            color: '#6b7280'
        };
    }

    /**
     * Get transaction status display info
     * @param {string} status
     * @returns {Object} - { label, color, icon }
     */
    getTransactionStatusInfo(status) {
        const statusInfo = {
            [TransactionStatus.PENDING]: {
                label: 'Pending',
                color: '#f59e0b',
                icon: '⏳'
            },
            [TransactionStatus.COMPLETED]: {
                label: 'Completed',
                color: '#10b981',
                icon: '✓'
            },
            [TransactionStatus.FAILED]: {
                label: 'Failed',
                color: '#ef4444',
                icon: '✗'
            },
            [TransactionStatus.CANCELLED]: {
                label: 'Cancelled',
                color: '#6b7280',
                icon: '⊘'
            }
        };

        return statusInfo[status] || statusInfo[TransactionStatus.PENDING];
    }

    /**
     * Format amount for display
     * @param {number} amount
     * @param {string} asset
     * @returns {string}
     */
    formatAmount(amount, asset) {
        // Convert from smallest unit (cents for USDC)
        const displayAmount = asset === 'USDC' ? amount / 100 : amount;
        return `${displayAmount.toLocaleString()} ${asset}`;
    }

    /**
     * Format timestamp for display
     * @param {number} timestamp
     * @returns {string}
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Export transactions to CSV
     * @param {TransactionRecord[]} transactions - Transactions to export (defaults to all filtered)
     * @returns {string} - CSV content
     */
    exportToCSV(transactions = null) {
        const txsToExport = transactions || this.filteredTransactions;
        
        // CSV headers
        const headers = [
            'Transaction ID',
            'Type',
            'Amount',
            'Asset',
            'From',
            'To',
            'Status',
            'Date',
            'Transaction Hash',
            'Block Explorer URL'
        ];

        // CSV rows
        const rows = txsToExport.map(tx => {
            const typeInfo = this.getTransactionTypeInfo(tx.type);
            return [
                tx.id,
                typeInfo.label,
                tx.amount,
                tx.asset,
                tx.fromAddress,
                tx.toAddress,
                tx.status,
                this.formatTimestamp(tx.timestamp),
                tx.transactionHash,
                tx.blockExplorerUrl
            ];
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Download CSV file
     * @param {string} filename
     */
    downloadCSV(filename = 'transaction-history.csv') {
        const csvContent = this.exportToCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Get transaction statistics
     * @returns {Object}
     */
    getStatistics() {
        const stats = {
            total: this.transactions.length,
            byType: {},
            byStatus: {},
            totalVolume: 0
        };

        this.transactions.forEach(tx => {
            // Count by type
            stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1;
            
            // Count by status
            stats.byStatus[tx.status] = (stats.byStatus[tx.status] || 0) + 1;
            
            // Calculate total volume (USDC only)
            if (tx.asset === 'USDC' && tx.status === TransactionStatus.COMPLETED) {
                stats.totalVolume += tx.amount;
            }
        });

        return stats;
    }
}

export default TransactionHistoryManager;
