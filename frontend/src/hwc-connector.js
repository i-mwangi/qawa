// Use global objects instead of imports
let DAppConnector = null;
let HederaJsonRpcMethod = {};
let HederaSessionEvent = {};
let HederaChainId = {};

// Try to get from various global sources
if (typeof window !== 'undefined') {
  // Different possible locations for the Wallet Connect library
  if (window.HashgraphHederaWalletConnect) {
    DAppConnector = window.HashgraphHederaWalletConnect.DAppConnector;
    HederaJsonRpcMethod = window.HashgraphHederaWalletConnect.HederaJsonRpcMethod || {};
    HederaSessionEvent = window.HashgraphHederaWalletConnect.HederaSessionEvent || {};
    HederaChainId = window.HashgraphHederaWalletConnect.HederaChainId || {};
  } else if (window.HederaWalletConnect) {
    DAppConnector = window.HederaWalletConnect.DAppConnector;
    HederaJsonRpcMethod = window.HederaWalletConnect.HederaJsonRpcMethod || {};
    HederaSessionEvent = window.HederaWalletConnect.HederaSessionEvent || {};
    HederaChainId = window.HederaWalletConnect.HederaChainId || {};
  } else if (window.DAppConnector) {
    DAppConnector = window.DAppConnector;
  }
  
  // Fallback: Try to find any object that looks like DAppConnector
  if (!DAppConnector) {
    // Look for any property that might be the DAppConnector
    for (const key in window) {
      if (key.includes('DApp') || key.includes('Wallet') || key.includes('Connect')) {
        const obj = window[key];
        if (obj && typeof obj === 'function' && (obj.name && obj.name.includes('DApp') || obj.name && obj.name.includes('Connect'))) {
          DAppConnector = obj;
          break;
        }
      }
    }
  }
}

// Use global objects instead of imports for Hashgraph SDK
let LedgerId = { TESTNET: 'testnet' };

if (typeof window !== 'undefined') {
  if (window.HashgraphSdk && window.HashgraphSdk.LedgerId) {
    LedgerId = window.HashgraphSdk.LedgerId;
  } else if (window.HederaSdk && window.HederaSdk.LedgerId) {
    LedgerId = window.HederaSdk.LedgerId;
  } else if (window.LedgerId) {
    LedgerId = window.LedgerId;
  }
}

export class HWCConnector {
    constructor() {
        this.connector = null;
        this.session = null;
        this.accountId = null;
        this.isConnected = false;
        this.isInitializing = false;

        // Fallback to mock implementations if required objects are not available
        if (!DAppConnector) {
          console.warn('Hedera Wallet Connect library not loaded. Using mock implementation.');
          
          // Create a mock connector
          DAppConnector = class MockDAppConnector {
            constructor() {
              console.warn('Using mock DAppConnector');
            }
            
            async init() {
              console.warn('Mock connector initialized');
            }
            
            async openModal() {
              console.warn('Mock openModal called');
              return null;
            }
          };
        }

        // App metadata
        this.metadata = {
            name: 'Chai Platform',
            description: 'Invest in Sustainable Coffee Production',
            url: window.location.origin,
            icons: [window.location.origin + '/chai.png']
        };

        // Your Reown Project ID
        this.projectId = '39948bbdaaebec2790629f3e9589793a';

        // Network - use the correct LedgerId.TESTNET as per the integration guide
        this.network = LedgerId.TESTNET;
    }

    /**
     * Initialize the DAppConnector
     */
    async init() {
        if (this.connector || this.isInitializing) {
            return this.connector;
        }

        this.isInitializing = true;

        try {
            console.log('🔧 Initializing HWC v1 DAppConnector...');

            // Create connector with correct v1.5.1 parameters
            this.connector = new DAppConnector(
                this.metadata,
                this.network,
                this.projectId,
                Object.values(HederaJsonRpcMethod),
                [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
                [HederaChainId.Testnet]
            );

            // Initialize - the init method might not accept parameters in v1.5.1
            try {
                await this.connector.init({ logger: 'error' });
            } catch (e) {
                // If init with params fails, try without
                console.log('Trying init without parameters...');
                await this.connector.init();
            }

            // Set up event listeners
            this.setupEventListeners();

            // Check for existing session
            if (this.connector.signers && this.connector.signers.length > 0) {
                const existingSession = this.connector.signers[0];
                if (existingSession) {
                    console.log('✅ Found existing session');
                    this.session = existingSession;
                    this.accountId = existingSession.getAccountId().toString();
                    this.isConnected = true;
                }
            }

            console.log('✅ HWC v1 initialized');
            return this.connector;

        } catch (error) {
            console.error('❌ Failed to initialize HWC:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Set up event listeners for session changes
     */
    setupEventListeners() {
        if (!this.connector) return;

        // The DAppConnector doesn't have onSessionEvent in v1.5.1
        // Events are handled through the WalletConnect client internally
        // We can listen to the walletconnect events if needed
        console.log('✅ Event listeners ready (handled internally by DAppConnector)');
    }

    /**
     * Get available browser extensions
     */
    getAvailableExtensions() {
        if (!this.connector) {
            console.log('⚠️ Connector not initialized');
            return [];
        }

        // In v1.5.1, extensions might be available differently
        const extensions = this.connector.extensions || [];
        console.log('🔍 Available extensions:', extensions);
        return extensions;
    }

    /**
     * Connect via browser extension
     */
    async connectExtension(extensionId) {
        try {
            if (!this.connector) {
                await this.init();
            }

            console.log('🔌 Connecting via extension:', extensionId);

            const session = await this.connector.connectExtension(extensionId);

            if (session) {
                this.session = session;
                this.accountId = session.topic; // Will be updated by event
                this.isConnected = true;

                // Get account from signers
                const signer = this.connector.signers[0];
                if (signer) {
                    const accountId = signer.getAccountId();
                    this.accountId = accountId ? (accountId.toString ? accountId.toString() : String(accountId)) : null;
                }

                console.log('✅ Connected via extension:', this.accountId || 'No account ID');

                return {
                    success: true,
                    accountId: this.accountId,
                    session: this.session
                };
            }

            throw new Error('Failed to establish session');

        } catch (error) {
            console.error('❌ Extension connection error:', error);

            if (error.message.includes('Expired') || error.message.includes('expired')) {
                throw new Error('Connection request expired. Please try again.');
            }

            throw error;
        }
    }

    /**
     * Connect via QR code (opens WalletConnect modal)
     */
    async connectQRCode() {
        try {
            if (!this.connector) {
                await this.init();
            }

            console.log('📱 Opening QR code modal...');

            // openModal returns a session
            const session = await this.connector.openModal();

            if (session) {
                this.session = session;
                this.isConnected = true;

                // Get account from signers
                const signer = this.connector.signers[0];
                if (signer) {
                    const accountId = signer.getAccountId();
                    this.accountId = accountId ? (accountId.toString ? accountId.toString() : String(accountId)) : null;
                }

                console.log('✅ Connected via QR code:', this.accountId || 'No account ID');

                return {
                    success: true,
                    accountId: this.accountId,
                    session: this.session
                };
            }

            throw new Error('Failed to establish connection');

        } catch (error) {
            console.error('❌ QR code connection error:', error);

            if (error.message.includes('Expired') || error.message.includes('expired')) {
                throw new Error('Connection request expired. Please try again.');
            }

            if (error.message.includes('User closed modal')) {
                throw new Error('Connection cancelled by user');
            }

            throw error;
        }
    }

    /**
     * Disconnect wallet
     */
    async disconnect() {
        try {
            if (this.connector && this.session) {
                await this.connector.disconnectAll();
            }
        } catch (error) {
            console.warn('⚠️ Error disconnecting:', error);
        }

        this.session = null;
        this.accountId = null;
        this.isConnected = false;

        console.log('✅ Disconnected');
    }

    /**
     * Get signer for transactions
     */
    getSigner() {
        if (!this.isConnected || !this.connector) {
            throw new Error('Wallet not connected');
        }

        const signer = this.connector.signers[0];
        if (!signer) {
            throw new Error('No signer available');
        }

        return signer;
    }

    /**
     * Send transaction
     */
    async sendTransaction(transaction) {
        const signer = this.getSigner();
        return await signer.call(transaction);
    }

    /**
     * Sign message
     */
    async signMessage(message) {
        const signer = this.getSigner();
        return await signer.sign([message]);
    }

    /**
     * Get account ID
     */
    getAccountId() {
        return this.accountId;
    }

    /**
     * Check if connected
     */
    isWalletConnected() {
        return this.isConnected;
    }
}

// Create global instance
export const hwcConnector = new HWCConnector();