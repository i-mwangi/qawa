/**
 * State management for wallet connection
 * Vanilla JS implementation (no React hooks)
 */

export class WalletState {
  constructor() {
    console.log('Creating WalletState instance');
    
    this.state = {
      isConnected: false,
      isInitializing: false,
      connector: null,
      session: null,
      signers: [],
      accountId: null,
      error: null,
      isDetectingExtensions: true
    };
    
    this.listeners = [];
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Update state and notify listeners
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state change
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Reset state
  reset() {
    this.setState({
      isConnected: false,
      isInitializing: false,
      connector: null,
      session: null,
      signers: [],
      accountId: null,
      error: null,
      isDetectingExtensions: true
    });
  }
}

// Create global instance
export const walletState = new WalletState();