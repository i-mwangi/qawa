/**
 * Wallet Connection Modal
 * Vanilla JS implementation
 */

import { hederaWallet } from './connector.js';
import { walletState } from './state.js';

export class WalletModal {
  constructor() {
    console.log('Creating WalletModal instance');
    console.log('hederaWallet:', hederaWallet);
    console.log('walletState:', walletState);
    
    this.modal = null;
    this.isConnecting = false;
    this.extensions = [];
  }

  /**
   * Show the connection modal
   */
  async show() {
    console.log('Showing wallet connection modal');
    
    // Initialize connector if needed
    if (!walletState.getState().connector) {
      console.log('Initializing connector...');
      await hederaWallet.init();
      // Give WalletConnect time to fully initialize
      console.log('⏳ Waiting for WalletConnect to fully initialize...');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Verify connector is ready
    if (!hederaWallet.connector || !hederaWallet.connector.walletConnectClient) {
      throw new Error('WalletConnect failed to initialize. Please refresh the page and try again.');
    }

    // Detect extensions
    await this.detectExtensions();

    // Create and show modal
    this.createModal();
    this.render();

    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  /**
   * Detect available extensions
   */
  async detectExtensions() {
    console.log('Detecting wallet extensions...');
    walletState.setState({ isDetectingExtensions: true });

    // Wait longer for extensions to respond and become available
    // Extensions need time to initialize and unlock
    console.log('Waiting 2000ms for extensions to respond...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.extensions = hederaWallet.getAvailableExtensions();
    
    console.log('🔍 Detected extensions:', this.extensions);
    console.log('🔍 Extension details:', this.extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      available: ext.available
    })));

    // Log additional information about the detection process
    console.log('🔍 Detection summary:', {
      totalExtensions: this.extensions.length,
      extensionNames: this.extensions.map(ext => ext.name),
      hasHashPack: this.extensions.some(ext => ext.name?.toLowerCase().includes('hashpack'))
    });

    walletState.setState({ isDetectingExtensions: false });
  }

  /**
   * Create modal DOM element
   */
  createModal() {
    console.log('Creating wallet modal DOM element');
    
    // Remove existing modal if any
    const existing = document.getElementById('wallet-modal');
    if (existing) {
      existing.remove();
    }

    // Create modal
    this.modal = document.createElement('div');
    this.modal.id = 'wallet-modal';
    this.modal.className = 'wallet-modal';
    
    document.body.appendChild(this.modal);
    
    // Add global reference for button onclick handlers
    window.walletModal = this;
  }

  /**
   * Render modal content
   */
  render() {
    console.log('Rendering wallet modal content');
    
    // Safety check to ensure modal exists
    if (!this.modal) {
      console.warn('Modal element not found, creating it now');
      this.createModal();
    }
    
    const state = walletState.getState();

    this.modal.innerHTML = `
      <div class="wallet-modal-overlay" onclick="window.walletModal && window.walletModal.close()"></div>
      <div class="wallet-modal-content">
        <div class="wallet-modal-header">
          <h2>Connect Wallet</h2>
          <button class="wallet-modal-close" onclick="window.walletModal && window.walletModal.close()">×</button>
        </div>

        <div class="wallet-modal-body">
          ${this.isConnecting ? `
            <div class="wallet-connecting">
              <div class="wallet-spinner"></div>
              <p>Connecting to wallet...</p>
            </div>
          ` : `
            <!-- Browser Extensions Section -->
            <div class="extensions-section">
              <h3>Browser Extensions</h3>
              ${state.isDetectingExtensions ? `
                <div class="extensions-loading">
                  <div class="wallet-spinner-small"></div>
                  <p>Detecting browser extensions...</p>
                </div>
              ` : this.extensions.length > 0 ? `
                <div class="extensions-list">
                  ${this.extensions.filter(ext => ext.id).map(ext => `
                    <button 
                      class="extension-button" 
                      onclick="window.walletModal && window.walletModal.connectExtension('${ext.id}')"
                    >
                      ${ext.icon ? `<img src="${ext.icon}" alt="${ext.name}" />` : ''}
                      <span>${ext.name}</span>
                    </button>
                  `).join('')}
                </div>
              ` : `
                <div class="no-extensions">
                  <p>No browser extensions detected.</p>
                  <p class="help-text">Make sure you have a Hedera wallet extension installed (HashPack, Blade, or Kabila).</p>
                  <a href="https://www.hashpack.app/" target="_blank" class="install-link">
                    Install HashPack →
                  </a>
                </div>
              `}
            </div>

            <!-- Divider -->
            <div class="wallet-divider">
              <span>OR</span>
            </div>

            <!-- QR Code Section -->
            <div class="qr-section">
              <h3>Connect with QR Code</h3>
              <p>Scan with a Hedera wallet app</p>
              <button 
                class="qr-button" 
                onclick="window.walletModal && window.walletModal.connectQRCode()"
              >
                Show QR Code
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Connect via extension
   */
  async connectExtension(extensionId) {
    console.log('Connecting via extension:', extensionId);
    
    if (!extensionId) {
      console.error('❌ Extension ID is missing');
      this.showError('Invalid extension selected. Please try again.');
      return;
    }
    
    // Ensure modal exists
    if (!this.modal) {
      console.warn('Modal not found in connectExtension, creating it');
      this.createModal();
    }
    
    this.isConnecting = true;
    this.render();

    try {
      const result = await hederaWallet.connectExtension(extensionId);
      // Safety check for resolve function
      if (this.resolve && typeof this.resolve === 'function') {
        this.resolve(result);
      } else {
        console.warn('Modal resolve function not available, using direct callback');
        // If called directly (not through show()), we need to handle the result differently
        // Use the wallet manager's notifyWalletConnected method to ensure proper state synchronization
        if (window.walletManager && typeof window.walletManager.notifyWalletConnected === 'function') {
          window.walletManager.notifyWalletConnected();
        } else {
          window.dispatchEvent(new CustomEvent('wallet-connected', {
            detail: result
          }));
        }
      }
      this.close();
    } catch (error) {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.showError(error.message);
      // Safety check for reject function
      if (this.reject && typeof this.reject === 'function') {
        this.reject(error);
      }
    }
  }

  /**
   * Connect via QR code
   */
  async connectQRCode() {
    console.log('Connecting via QR code');
    
    // Ensure modal exists
    if (!this.modal) {
      console.warn('Modal not found in connectQRCode, creating it');
      this.createModal();
    }
    
    this.isConnecting = true;
    this.render();

    try {
      const result = await hederaWallet.connectQRCode();
      // Safety check for resolve function
      if (this.resolve && typeof this.resolve === 'function') {
        this.resolve(result);
      } else {
        console.warn('Modal resolve function not available, using direct callback');
        // If called directly (not through show()), we need to handle the result differently
        window.dispatchEvent(new CustomEvent('wallet-connected', {
          detail: result
        }));
      }
      this.close();
    } catch (error) {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.showError(error.message);
      // Safety check for reject function
      if (this.reject && typeof this.reject === 'function') {
        this.reject(error);
      }
    }
  }

  /**
   * Close modal
   */
  close() {
    console.log('Closing wallet modal');
    
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    // Remove global reference
    if (window.walletModal === this) {
      delete window.walletModal;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    console.log('Showing error message:', message);
    
    if (this.modal) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'wallet-error';
      errorDiv.textContent = message;
      this.modal.querySelector('.wallet-modal-body').appendChild(errorDiv);
      
      // Remove error after 5 seconds
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.remove();
        }
      }, 5000);
    }
  }
}