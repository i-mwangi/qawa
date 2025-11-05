/**
 * Main Wallet Manager
 * Provides simple API for the rest of the app
 */

import { hederaWallet } from './connector.js';
import { walletState } from './state.js';
import { WalletModal } from './modal.js';

export class WalletManager {
  constructor() {
    console.log('Creating WalletManager instance');
    console.log('hederaWallet:', hederaWallet);
    console.log('walletState:', walletState);
    
    this.modal = null;
    this.userType = null;
    
    // Subscribe to state changes
    walletState.subscribe(state => {
      this.onStateChange(state);
    });
  }

  /**
   * Initialize wallet manager
   */
  async init() {
    try {
      console.log('Initializing WalletManager...');
      
      // Check for existing session
      const existingSession = sessionStorage.getItem('hwcV1Session');
      console.log('Existing session in storage:', existingSession);
      
      if (existingSession) {
        console.log('Found existing session, initializing connector...');
        await hederaWallet.init(true);
      } else {
        console.log('No existing session found, initializing connector...');
        await hederaWallet.init(false);
      }
      
      // Load user type from localStorage
      this.userType = localStorage.getItem('userType') || 'investor';
      console.log('User type:', this.userType);
      
      // Update UI
      this.updateUI();
      
    } catch (error) {
      console.error('Failed to initialize wallet manager:', error);
    }
  }

  /**
   * Connect wallet
   */
  async connect() {
    try {
      this.showLoading('Connecting to wallet...');
      
      // Ensure wallet is initialized before connecting
      if (!hederaWallet.connector) {
        console.log('⚠️ Wallet not initialized, initializing now...');
        await hederaWallet.init();
        // Give it a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Show connection modal
      this.modal = new WalletModal();
      const result = await this.modal.show();
      
      if (result.success) {
        this.hideLoading();
        this.showToast('Wallet connected successfully!', 'success');
        
        // Save to localStorage
        localStorage.setItem('connectedAccount', result.accountId);
        localStorage.setItem('userType', this.userType);
        
        // Notify app
        this.notifyWalletConnected();
        
        return result;
      }
      
    } catch (error) {
      console.error('Connection error:', error);
      this.hideLoading();
      
      let message = 'Failed to connect wallet';
      if (error.message) {
        message = error.message;
      }
      
      if (message.includes('cancelled')) {
        this.showToast('Connection cancelled', 'warning');
      } else {
        this.showToast(message, 'error');
      }
      
      throw error;
    }
  }

  /**
   * Set intended user type - used when navigating to a specific view
   */
  setIntendedUserType(type) {
    this.userType = type;
    localStorage.setItem('userType', type);
  }

  /**
   * Get intended user type
   */
  getIntendedUserType() {
    return this.userType;
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    try {
      await hederaWallet.disconnect();
      
      localStorage.removeItem('connectedAccount');
      localStorage.removeItem('userType');
      
      this.userType = null;
      
      this.updateUI();
      this.showToast('Wallet disconnected', 'info');
      
      // Notify app
      window.dispatchEvent(new CustomEvent('wallet-disconnected'));
      
    } catch (error) {
      console.error('Disconnect error:', error);
      this.showToast('Failed to disconnect', 'error');
    }
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected() {
    const isConnected = walletState.getState().isConnected;
    console.log('isWalletConnected() called - returning:', isConnected);
    console.log('Full wallet state:', walletState.getState());
    return isConnected;
  }

  /**
   * Get connected account ID
   */
  getAccountId() {
    const accountId = walletState.getState().accountId;
    console.log('getAccountId() called - returning:', accountId);
    return accountId;
  }

  /**
   * Get user type
   */
  getUserType() {
    return this.userType;
  }

  /**
   * Set user type
   */
  setUserType(type) {
    this.userType = type;
    localStorage.setItem('userType', type);
  }

  /**
   * Require farmer role - checks if user is a farmer
   */
  requireFarmer() {
    if (!this.isWalletConnected()) {
      this.showToast('Please connect your wallet first', 'warning');
      return false;
    }
    
    if (this.getUserType() !== 'farmer') {
      this.showToast('This action requires farmer privileges', 'warning');
      return false;
    }
    
    return true;
  }

  /**
   * Require investor role - checks if user is an investor
   */
  requireInvestor() {
    if (!this.isWalletConnected()) {
      this.showToast('Please connect your wallet first', 'warning');
      return false;
    }
    
    if (this.getUserType() !== 'investor') {
      this.showToast('This action requires investor privileges', 'warning');
      return false;
    }
    
    return true;
  }

  /**
   * Send transaction
   */
  async sendTransaction(recipientId, amount) {
    try {
      const result = await hederaWallet.signAndExecuteTransaction(recipientId, amount);
      this.showToast('Transaction sent successfully!', 'success');
      return result;
    } catch (error) {
      console.error('Transaction error:', error);
      this.showToast('Transaction failed: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Update UI based on connection state
   */
  updateUI() {
    console.log('Updating UI based on connection state...');
    console.log('isWalletConnected():', this.isWalletConnected());
    console.log('getAccountId():', this.getAccountId());
    
    // Update connect button
    const connectBtn = document.getElementById('connect-wallet-btn');
    const walletInfo = document.getElementById('walletInfo');
    const walletAddress = document.getElementById('walletAddress');
    
    if (connectBtn) {
      if (this.isWalletConnected()) {
        // Hide connect button, show wallet info
        connectBtn.classList.add('hidden');
        if (walletInfo) {
          walletInfo.classList.remove('hidden');
        }
        if (walletAddress) {
          const accountId = this.getAccountId();
          walletAddress.textContent = accountId ? accountId.toString ? accountId.toString() : String(accountId) : 'No account ID';
        }
      } else {
        // Show connect button, hide wallet info
        connectBtn.classList.remove('hidden');
        connectBtn.textContent = 'Connect Wallet';
        connectBtn.onclick = () => this.connect();
        if (walletInfo) {
          walletInfo.classList.add('hidden');
        }
      }
    }
    
    // Setup disconnect button
    const disconnectBtn = document.getElementById('disconnectWallet');
    if (disconnectBtn) {
      disconnectBtn.onclick = () => this.disconnect();
    }
  }

  /**
   * Show loading indicator
   */
  showLoading(message) {
    // Create or show loading overlay
    let loadingOverlay = document.getElementById('wallet-loading-overlay');
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'wallet-loading-overlay';
      loadingOverlay.className = 'wallet-loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="wallet-loading-content">
          <div class="wallet-spinner"></div>
          <p>${message}</p>
        </div>
      `;
      document.body.appendChild(loadingOverlay);
    } else {
      loadingOverlay.querySelector('p').textContent = message;
      loadingOverlay.classList.remove('hidden');
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingOverlay = document.getElementById('wallet-loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Use existing notification manager if available
    if (window.notificationManager) {
      // Call the appropriate method based on type
      switch(type) {
        case 'success':
          window.notificationManager.success(message);
          break;
        case 'error':
          window.notificationManager.error(message);
          break;
        case 'warning':
          window.notificationManager.warning(message);
          break;
        case 'info':
        default:
          window.notificationManager.info(message);
          break;
      }
    } else {
      // Fallback to console
      console.log(`[${type}]`, message);
    }
  }

  /**
   * Notify app that wallet is connected
   */
  notifyWalletConnected() {
    window.dispatchEvent(new CustomEvent('wallet-connected', {
      detail: {
        accountId: this.getAccountId(),
        userType: this.getUserType()
      }
    }));
  }

  /**
   * Handle state changes
   */
  onStateChange(state) {
    // Update UI when state changes
    this.updateUI();
  }
}

// Create global instance
export const walletManager = new WalletManager();