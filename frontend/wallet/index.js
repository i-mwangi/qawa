/**
 * Hedera Wallet Connect Integration
 * Main entry point
 */

// Debug: Log when this file is loaded
console.log('Loading wallet/index.js');

// Import all modules
import './config.js';
import './state.js';
import './connector.js';
import './modal.js';
import { walletManager } from './manager.js';
import { hederaWallet } from './connector.js';
import { walletState } from './state.js';

// Export for use in other modules
export { walletManager };
export { hederaWallet };
export { walletState };

// CRITICAL: Make wallet objects globally available
window.walletManager = walletManager;
window.hederaWallet = hederaWallet;
window.walletState = walletState;

console.log('✅ Wallet objects exposed globally:', {
  walletManager: window.walletManager,
  hederaWallet: window.hederaWallet,
  walletState: window.walletState
});

// Initialize on DOM ready or when called explicitly
function initWallet() {
  console.log('Initializing wallet...');
  try {
    console.log('🚀 Initializing Hedera Wallet Connect...');
    console.log('walletManager:', walletManager);
    
    // Check if walletManager is properly initialized
    if (!walletManager) {
      console.error('walletManager is not properly initialized');
      return;
    }
    
    // Debug: Check what global objects are available when initializing
    console.log('=== Global Objects at Wallet Initialization ===');
    const potentialObjects = ['HashgraphHederaWalletConnect', 'HederaWalletConnect', 'DAppConnector', 'HashgraphSdk', 'HederaSdk', 'AccountId', 'TransactionId', 'TransferTransaction', 'Hbar', 'HashConnect', 'hashconnect', 'Hashconnect'];
    potentialObjects.forEach(objName => {
      if (window[objName]) {
        console.log(objName + ':', typeof window[objName]);
      }
    });
    
    // Log the wallet manager state before initialization
    console.log('Wallet manager state before init:', walletManager);
    
    walletManager.init().then(() => {
      console.log('✅ Wallet manager ready');
      // Log the wallet manager state after initialization
      console.log('Wallet manager state after init:', walletManager);
    }).catch(error => {
      console.error('❌ Failed to initialize wallet:', error);
    });
  } catch (error) {
    console.error('❌ Failed to initialize wallet:', error);
  }
}

// Make initWallet available globally
window.initWallet = initWallet;

// Initialize on DOM ready if not already initialized
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  // If DOM is already loaded, initialize immediately
  if (document.documentElement) {
    initWallet();
  }
}
