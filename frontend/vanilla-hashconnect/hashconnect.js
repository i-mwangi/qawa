// Use global objects instead of imports for Hashgraph SDK
let AccountId = null;
let LedgerId = null;
let Transaction = null;

// Try to get from global scope (CDN)
if (typeof window !== 'undefined') {
  if (window.HashgraphSdk) {
    AccountId = window.HashgraphSdk.AccountId;
    LedgerId = window.HashgraphSdk.LedgerId;
    Transaction = window.HashgraphSdk.Transaction;
  } else if (window.HederaSdk) {
    AccountId = window.HederaSdk.AccountId;
    LedgerId = window.HederaSdk.LedgerId;
    Transaction = window.HederaSdk.Transaction;
  } else {
    // Try direct global access
    AccountId = window.AccountId;
    LedgerId = window.LedgerId;
    Transaction = window.Transaction;
  }
}

// Use global objects instead of imports for HashConnect
let HashConnect = null;

if (typeof window !== 'undefined') {
  if (window.Hashconnect && window.Hashconnect.HashConnect) {
    HashConnect = window.Hashconnect.HashConnect;
  } else if (window.HashConnect) {
    HashConnect = window.HashConnect;
  }
}

// Fallback to mock implementations if required objects are not available
if (!HashConnect) {
  console.warn('HashConnect not loaded. Using mock implementation.');
  
  // Create a mock HashConnect
  HashConnect = class MockHashConnect {
    constructor() {
      console.warn('Using mock HashConnect');
      this.connectedAccountIds = [];
    }
    
    async init() {
      console.warn('Mock HashConnect initialized');
    }
    
    async sendTransaction() {
      console.warn('Mock sendTransaction called');
      return { success: true };
    }
  };
}

if (!LedgerId || !LedgerId.TESTNET) {
  console.warn('LedgerId not loaded. Using mock implementation.');
  LedgerId = {
    TESTNET: 'testnet',
    fromString: (str) => str
  };
}

if (!AccountId) {
  console.warn('AccountId not loaded. Using mock implementation.');
  AccountId = class MockAccountId {
    static fromString(str) {
      return new MockAccountId(str);
    }
    
    constructor(str) {
      this.str = str;
    }
    
    toString() {
      return this.str;
    }
  };
}

// Configuration
const env = "testnet";
const appMetadata = {
    name: "Vanilla JS dApp",
    description: "An example HashConnect dApp in vanilla JavaScript",
    icons: [window.location.origin + "/favicon.ico"],
    url: window.location.origin,
};
const projectId = "39948bbdaaebec2790629f3e9589793a"; // Get your own project ID from https://cloud.walletconnect.com/

// Initialize HashConnect
export const hc = new HashConnect(
    LedgerId.fromString(env),
    projectId,
    appMetadata,
    true
);

// Export functions to get connected account IDs
export const getConnectedAccountIds = () => {
    return hc.connectedAccountIds;
};

// Initialize HashConnect and export the promise
export const hcInitPromise = hc.init();

// Sign a transaction
export const signTransaction = async (
    accountIdForSigning,
    trans
) => {
    await hcInitPromise;

    const accountIds = getConnectedAccountIds();
    if (!accountIds) {
        throw new Error("No connected accounts");
    }

    const isAccountIdForSigningPaired = accountIds.some(
        (id) => id.toString() === accountIdForSigning.toString()
    );
    if (!isAccountIdForSigningPaired) {
        throw new Error(`Account ${accountIdForSigning} is not paired`);
    }

    const result = await hc.signTransaction(accountIdForSigning, trans);
    return result;
};

// Execute a transaction
export const executeTransaction = async (
    accountIdForSigning,
    trans
) => {
    await hcInitPromise;

    const accountIds = getConnectedAccountIds();
    if (!accountIds) {
        throw new Error("No connected accounts");
    }

    const isAccountIdForSigningPaired = accountIds.some(
        (id) => id.toString() === accountIdForSigning.toString()
    );
    if (!isAccountIdForSigningPaired) {
        throw new Error(`Account ${accountIdForSigning} is not paired`);
    }

    const result = await hc.sendTransaction(accountIdForSigning, trans);
    return result;
};

// Sign messages
export const signMessages = async (
    accountIdForSigning,
    message
) => {
    await hcInitPromise;

    const accountIds = getConnectedAccountIds();
    if (!accountIds) {
        throw new Error("No connected accounts");
    }

    const isAccountIdForSigningPaired = accountIds.some(
        (id) => id.toString() === accountIdForSigning.toString()
    );
    if (!isAccountIdForSigningPaired) {
        throw new Error(`Account ${accountIdForSigning} is not paired`);
    }

    const result = await hc.signMessages(accountIdForSigning, message);
    return result;
};