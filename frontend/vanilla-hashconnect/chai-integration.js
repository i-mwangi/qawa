/**
 * Chai Platform - Vanilla JS HashConnect Integration
 * This file demonstrates how to integrate the vanilla JS implementation with the existing Chai codebase
 */

// Import our vanilla JS modules
import { hc, hcInitPromise, getConnectedAccountIds, executeTransaction } from './hashconnect.js';
import { getState, setState, subscribe } from './state.js';
import { createConnectButton } from './ui.js';
import { handleTransfer } from './transactions.js';

// Buffer polyfill
window.Buffer = window.Buffer || buffer.Buffer;

/**
 * Initialize HashConnect for Chai Platform
 */
export async function initChaiHashConnect() {
    try {
        console.log('Initializing HashConnect for Chai Platform...');
        
        // Wait for HashConnect to initialize
        await hcInitPromise;
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('HashConnect initialized successfully for Chai Platform');
        return { success: true };
        
    } catch (error) {
        console.error('Failed to initialize HashConnect:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set up HashConnect event listeners
 */
function setupEventListeners() {
    // Pairing event
    hc.pairingEvent.on((pairingData) => {
        console.log('Wallet paired:', pairingData);
        syncWithHashConnect();
        // Notify the existing system of connection
        window.dispatchEvent(new CustomEvent('chai-wallet-connected', {
            detail: { accountId: pairingData.accountIds[0] }
        }));
    });
    
    // Disconnection event
    hc.disconnectionEvent.on(() => {
        console.log('Wallet disconnected');
        syncWithHashConnect();
        // Notify the existing system of disconnection
        window.dispatchEvent(new CustomEvent('chai-wallet-disconnected'));
    });
    
    // Connection status change event
    hc.connectionStatusChangeEvent.on((status) => {
        console.log('Connection status changed:', status);
        syncWithHashConnect();
    });
}

/**
 * Sync HashConnect state with our local state
 */
function syncWithHashConnect() {
    const connectedAccountIds = getConnectedAccountIds();
    if (connectedAccountIds.length > 0) {
        setState({
            accountIds: connectedAccountIds.map(o => o.toString()),
            isConnected: true,
            pairingString: hc.pairingString ?? ""
        });
    } else {
        setState({
            accountIds: [],
            isConnected: false,
            pairingString: hc.pairingString ?? ""
        });
    }
}

/**
 * Create and inject the connect button into Chai UI
 * @param {string} containerId - ID of the container element
 */
export function createChaiConnectButton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    const connectButton = createConnectButton();
    container.appendChild(connectButton);
    
    // Subscribe to state changes for additional UI updates
    subscribe((state) => {
        // Dispatch custom events for the existing system
        if (state.isConnected) {
            window.dispatchEvent(new CustomEvent('chai-wallet-status-change', {
                detail: { connected: true, accountIds: state.accountIds }
            }));
        } else {
            window.dispatchEvent(new CustomEvent('chai-wallet-status-change', {
                detail: { connected: false, accountIds: [] }
            }));
        }
    });
}

/**
 * Send HBAR transfer transaction
 * @param {string} fromAccountId - Sender account ID
 * @param {string} toAccountId - Receiver account ID
 * @returns {Promise} Transaction result
 */
export async function sendChaiTransfer(fromAccountId, toAccountId) {
    try {
        const result = await handleTransfer(fromAccountId, toAccountId);
        console.log('Transfer completed:', result);
        
        // Notify existing system
        window.dispatchEvent(new CustomEvent('chai-transfer-completed', {
            detail: { result }
        }));
        
        return result;
    } catch (error) {
        console.error('Transfer failed:', error);
        
        // Notify existing system
        window.dispatchEvent(new CustomEvent('chai-transfer-failed', {
            detail: { error: error.message }
        }));
        
        throw error;
    }
}

/**
 * Get current connection status
 * @returns {Object} Current state
 */
export function getChaiWalletStatus() {
    return getState();
}

/**
 * Get connected account ID
 * @returns {string|null} Account ID or null
 */
export function getChaiAccountId() {
    const state = getState();
    return state.isConnected && state.accountIds.length > 0 ? state.accountIds[0] : null;
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initChaiHashConnect().then(result => {
        if (result.success) {
            console.log('Chai HashConnect ready for use');
        } else {
            console.error('Failed to initialize Chai HashConnect:', result.error);
        }
    });
});

// Export for use in other modules
export default {
    init: initChaiHashConnect,
    createConnectButton: createChaiConnectButton,
    sendTransfer: sendChaiTransfer,
    getStatus: getChaiWalletStatus,
    getAccountId: getChaiAccountId
};