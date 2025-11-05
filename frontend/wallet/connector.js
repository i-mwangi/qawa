/**
 * DAppConnector wrapper for Hedera Wallet Connect v1
 * Vanilla JS implementation
 */

import { DAppConnector, HederaJsonRpcMethod } from '@hashgraph/hedera-wallet-connect';
// Get Hedera SDK classes from global window object (loaded via CDN in app.html)
const { AccountId, TransactionId, TransferTransaction, Hbar } = window.hashgraph || {};
import { walletState } from './state.js';
import { metadata, PROJECT_ID, DEFAULT_NETWORK, STORAGE_KEYS } from './config.js';

export class HederaWalletConnector {
  constructor() {
    this.connector = null;
    this.signedTransaction = null;
  }

  /**
   * Ensure Hashgraph SDK modules are available
   */
  async ensureHashgraphModules() {
    // Modules are already imported from global window.hashgraph
    if (!AccountId || !TransactionId || !TransferTransaction || !Hbar) {
      throw new Error('Hedera SDK not loaded. Make sure the CDN script is included in HTML.');
    }
    return { AccountId, TransactionId, TransferTransaction, Hbar };
  }

  /**
   * Initialize the DAppConnector
   */
  async init(checkExistingSession = true) {
    const state = walletState.getState();
    
    if (state.connector || state.isInitializing) {
      return state.connector;
    }

    walletState.setState({ isInitializing: true, error: null });

    try {
      console.log('🔧 Initializing HWC v1 DAppConnector...');
      console.log('📋 Network config:', {
        DEFAULT_NETWORK,
        type: typeof DEFAULT_NETWORK,
        isUndefined: DEFAULT_NETWORK === undefined,
        isNull: DEFAULT_NETWORK === null,
        value: DEFAULT_NETWORK?.toString?.() || DEFAULT_NETWORK
      });

      // Store project ID in localStorage
      localStorage.setItem(STORAGE_KEYS.PROJECT_ID, PROJECT_ID);

      // Create DAppConnector
      console.log('🔧 Creating DAppConnector with params:', {
        metadata,
        network: DEFAULT_NETWORK,
        projectId: PROJECT_ID,
        methods: Object.values(HederaJsonRpcMethod)
      });

      this.connector = new DAppConnector(
        metadata,
        DEFAULT_NETWORK,
        PROJECT_ID,
        Object.values(HederaJsonRpcMethod),
        ['https://walletconnect.hashpack.app']
      );

      console.log('🔧 DAppConnector created:', this.connector);
      console.log('🔧 DAppConnector extensions before init:', this.connector.extensions);

      // Initialize with error logging
      await this.connector.init({ logger: 'error' });

      console.log('🔧 DAppConnector initialized');
      console.log('🔧 DAppConnector extensions after init:', this.connector.extensions);

      walletState.setState({ 
        connector: this.connector,
        isInitializing: false 
      });

      // Check for existing session
      if (checkExistingSession) {
        await this.restoreSession();
      }

      console.log('✅ HWC v1 initialized');
      return this.connector;

    } catch (error) {
      console.error('❌ Failed to initialize HWC:', error);
      walletState.setState({ 
        error: error.message,
        isInitializing: false 
      });
      throw error;
    }
  }

  /**
   * Restore existing session
   */
  async restoreSession() {
    try {
      console.log('Attempting to restore session...');
      const walletClient = this.connector?.walletConnectClient;
      console.log('Wallet client:', walletClient);
      
      const existingSessions = walletClient?.session?.getAll?.() || [];
      console.log('Existing sessions:', existingSessions);

      // Look for V1 sessions (with hedera namespace)
      const v1Session = existingSessions.find(
        s => s.namespaces?.hedera
      );
      
      console.log('Found V1 session:', v1Session);

      if (v1Session) {
        console.log('✅ Restored existing V1 session');
        const { signers, accountId } = this.updateSigners(v1Session);

        walletState.setState({
          isConnected: true,
          session: v1Session,
          signers,
          accountId
        });

        // Update session marker
        sessionStorage.setItem(
          STORAGE_KEYS.V1_SESSION,
          JSON.stringify({
            topic: v1Session.topic,
            accountId: accountId || null,
            timestamp: Date.now()
          })
        );
      } else {
        console.log('No valid V1 session found');
        // Check if there's a session marker in localStorage
        const sessionMarker = sessionStorage.getItem(STORAGE_KEYS.V1_SESSION);
        console.log('Session marker in storage:', sessionMarker);
        if (sessionMarker) {
          try {
            const parsed = JSON.parse(sessionMarker);
            console.log('Parsed session marker:', parsed);
            // If we have a session marker but no session, the session might have expired
            // Clear the session marker
            sessionStorage.removeItem(STORAGE_KEYS.V1_SESSION);
          } catch (e) {
            console.error('Error parsing session marker:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }

  /**
   * Update signers from session
   */
  updateSigners(session) {
    if (!this.connector || !session) {
      return { signers: [], accountId: null };
    }

    try {
      console.log('📦 Session namespaces detail:', {
        hasHedera: !!session.namespaces?.hedera,
        hasEip155: !!session.namespaces?.eip155,
        hederaAccounts: session.namespaces?.hedera?.accounts,
        hederaMethods: session.namespaces?.hedera?.methods,
        hederaEvents: session.namespaces?.hedera?.events,
        eip155Accounts: session.namespaces?.eip155?.accounts,
        eip155Methods: session.namespaces?.eip155?.methods,
        eip155Events: session.namespaces?.eip155?.events,
      });

      // Get account from session - try both hedera and eip155 namespaces
      const accountIdStr =
        session.namespaces?.hedera?.accounts?.[0]?.split(':').pop() ||
        session.namespaces?.eip155?.accounts?.[0]?.split(':').pop() ||
        null;

      console.log('👤 Extracted account ID:', accountIdStr);

      if (!accountIdStr) {
        console.warn('No account found in session');
        return { signers: [], accountId: null };
      }

      // Try different methods to get the signer (as per integration guide)
      let signer = null;

      // Method 1: Try with AccountId object
      try {
        console.log('🔄 Trying Method 1: AccountId.fromString');
        const accountId = AccountId.fromString(accountIdStr);
        signer = this.connector.getSigner(accountId);
        console.log('✅ Method 1 successful');
      } catch (e) {
        console.log('Method 1 failed, trying method 2:', e.message);
      }

      // Method 2: Try getting all signers
      if (!signer) {
        try {
          console.log('🔄 Trying Method 2: getSigners()');
          const allSigners = this.connector.getSigners?.() || [];
          signer = allSigners[0] || null;
          console.log('✅ Method 2 successful, signers count:', allSigners.length);
        } catch (e) {
          console.log('Method 2 failed, trying method 3:', e.message);
        }
      }

      // Method 3: Try with session topic
      if (!signer && session.topic) {
        try {
          console.log('🔄 Trying Method 3: getSigner with topic');
          signer = this.connector.getSigner?.(session.topic) || null;
          console.log('✅ Method 3 successful');
        } catch (e) {
          console.log('Method 3 failed:', e.message);
        }
      }

      const signers = signer ? [signer] : [];
      console.log('🔐 Signers updated:', { accountId: accountIdStr, signerAvailable: !!signer });

      return { signers, accountId: accountIdStr };
    } catch (error) {
      console.error('❌ Error updating signers:', error);
      return { signers: [], accountId: null };
    }
  }

  /**
   * Get available browser extensions
   */
  getAvailableExtensions() {
    if (!this.connector) {
      console.log('⚠️ Connector not initialized');
      return [];
    }

    console.log('🔍 Detecting available extensions...');
    
    // Give extensions time to respond (as per integration guide)
    // Extensions need ~1000ms to respond to detection queries
    const extensions = this.connector.extensions || [];
    console.log('📋 Raw extensions from connector:', extensions);
    
    // Log detailed extension information
    extensions.forEach((ext, index) => {
      console.log(`📋 Extension ${index}:`, {
        id: ext.id,
        name: ext.name,
        available: ext.available,
        type: typeof ext,
        keys: Object.keys(ext)
      });
    });
    
    // Filter for extensions with ID and that are available
    const availableExtensions = extensions.filter(ext => ext.id && ext.available);
    console.log('✅ Available extensions:', availableExtensions);

    // Deduplicate by ID
    const uniqueExtensions = availableExtensions.reduce((acc, ext) => {
      if (!acc.find(e => e.id === ext.id)) {
        acc.push(ext);
      }
      return acc;
    }, []);

    // Sort to put HashPack first
    return uniqueExtensions.sort((a, b) => {
      const aIsHashPack = a.name?.toLowerCase().includes('hashpack') || false;
      const bIsHashPack = b.name?.toLowerCase().includes('hashpack') || false;

      if (aIsHashPack && !bIsHashPack) return -1;
      if (!aIsHashPack && bIsHashPack) return 1;
      return 0;
    });
  }

  /**
   * Connect via browser extension
   */
  async connectExtension(extensionId) {
    try {
      console.log('🔌 connectExtension called with:', {
        extensionId,
        type: typeof extensionId,
        isUndefined: extensionId === undefined,
        isNull: extensionId === null
      });

      if (!extensionId) {
        throw new Error('Extension ID is required');
      }

      if (!this.connector) {
        console.log('⚠️ Connector not initialized, initializing now...');
        await this.init();
        // Give WalletConnect time to fully initialize
        console.log('⏳ Waiting for WalletConnect to fully initialize...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Verify connector is ready
      if (!this.connector || !this.connector.walletConnectClient) {
        throw new Error('WalletConnect failed to initialize. Please refresh the page and try again.');
      }

      // Get the full extension object for logging purposes
      const allExtensions = this.connector.extensions || [];
      console.log('📋 All connector extensions:', allExtensions);
      
      const targetExtension = allExtensions.find(ext => ext.id === extensionId);
      console.log('🎯 Target extension object:', targetExtension);

      if (!targetExtension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      // Check if extension is actually available
      if (!targetExtension.available) {
        throw new Error(`${targetExtension.name || 'Extension'} is installed but not available. Please make sure the extension is unlocked and try again.`);
      }

      // The SDK expects just the extension ID as a string
      console.log('🔌 Calling SDK connectExtension with ID:', extensionId);
      console.log('📋 Connector state:', {
        hasConnector: !!this.connector,
        connectorType: typeof this.connector,
        network: this.connector?.network,
        projectId: this.connector?.projectId
      });

      const session = await this.connector.connectExtension(extensionId);

      if (session) {
        const { signers, accountId } = this.updateSigners(session);

        walletState.setState({
          isConnected: true,
          session,
          signers,
          accountId
        });

        // Save session marker
        sessionStorage.setItem(
          STORAGE_KEYS.V1_SESSION,
          JSON.stringify({
            topic: session.topic,
            accountId: accountId || null,
            timestamp: Date.now()
          })
        );

        console.log('✅ Connected via extension:', accountId || 'No account ID');

        return { success: true, accountId: accountId || null, session };
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
   * Connect via QR code
   */
  async connectQRCode() {
    try {
      if (!this.connector) {
        console.log('⚠️ Connector not initialized, initializing now...');
        await this.init();
        // Give WalletConnect time to fully initialize
        console.log('⏳ Waiting for WalletConnect to fully initialize...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Verify connector is ready
      if (!this.connector || !this.connector.walletConnectClient) {
        throw new Error('WalletConnect failed to initialize. Please refresh the page and try again.');
      }

      console.log('📱 Opening QR code modal...');
      console.log('📋 Connector state before openModal:', {
        hasConnector: !!this.connector,
        connectorType: typeof this.connector,
        network: this.connector?.network,
        projectId: this.connector?.projectId
      });

      const session = await this.connector.openModal();

      if (session) {
        const { signers, accountId } = this.updateSigners(session);

        walletState.setState({
          isConnected: true,
          session,
          signers,
          accountId
        });

        // Save session marker
        sessionStorage.setItem(
          STORAGE_KEYS.V1_SESSION,
          JSON.stringify({
            topic: session.topic,
            accountId: accountId || null,
            timestamp: Date.now()
          })
        );

        console.log('✅ Connected via QR code:', accountId || 'No account ID');

        return { success: true, accountId: accountId || null, session };
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
      const state = walletState.getState();
      
      if (this.connector && state.session) {
        await this.connector.disconnect(state.session.topic);
      }

      // Clear session from storage
      sessionStorage.removeItem(STORAGE_KEYS.V1_SESSION);

      walletState.reset();

      console.log('✅ Disconnected');
    } catch (error) {
      console.error('⚠️ Error disconnecting:', error);
      // Clear session even on error
      sessionStorage.removeItem(STORAGE_KEYS.V1_SESSION);
      walletState.reset();
    }
  }

  /**
   * Get signer for transactions
   */
  getSigner() {
    const state = walletState.getState();
    
    if (!state.isConnected || !this.connector) {
      throw new Error('Wallet not connected');
    }

    const signer = state.signers[0];
    if (!signer) {
      throw new Error('No signer available');
    }

    return signer;
  }

  /**
   * Sign and execute transaction in one step
   */
  async signAndExecuteTransaction(recipientId, amount) {
    const signer = this.getSigner();
    const accountId = signer.getAccountId();

    if (!accountId) {
      throw new Error('Account ID not available');
    }

    const hbarAmount = new Hbar(Number(amount));
    const recipientAccountId = AccountId.fromString(recipientId);
    
    // Convert accountId to string safely
    const accountIdStr = accountId.toString ? accountId.toString() : String(accountId);
    
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(accountIdStr))
      .addHbarTransfer(accountIdStr, hbarAmount.negated())
      .addHbarTransfer(recipientAccountId, hbarAmount)
      .setMaxTransactionFee(new Hbar(1));

    // Convert to base64
    const transactionBytes = transaction.toBytes();
    const transactionList = Buffer.from(transactionBytes).toString('base64');

    // Call wallet
    const walletResponse = await this.connector.signAndExecuteTransaction({
      signerAccountId: accountIdStr,
      transactionList: transactionList
    });

    return {
      transactionId: walletResponse?.transactionId,
      status: 'SUCCESS'
    };
  }
}

// Create global instance
export const hederaWallet = new HederaWalletConnector();
