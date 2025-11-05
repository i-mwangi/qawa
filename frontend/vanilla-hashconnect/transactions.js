// Use global objects instead of imports for Hashgraph SDK
let AccountId = null;
let Hbar = null;
let TransactionId = null;
let TransferTransaction = null;

// Try to get from global scope (CDN)
if (typeof window !== 'undefined') {
  if (window.HashgraphSdk) {
    AccountId = window.HashgraphSdk.AccountId;
    Hbar = window.HashgraphSdk.Hbar;
    TransactionId = window.HashgraphSdk.TransactionId;
    TransferTransaction = window.HashgraphSdk.TransferTransaction;
  } else if (window.HederaSdk) {
    AccountId = window.HederaSdk.AccountId;
    Hbar = window.HederaSdk.Hbar;
    TransactionId = window.HederaSdk.TransactionId;
    TransferTransaction = window.HederaSdk.TransferTransaction;
  } else {
    // Try direct global access
    AccountId = window.AccountId;
    Hbar = window.Hbar;
    TransactionId = window.TransactionId;
    TransferTransaction = window.TransferTransaction;
  }
}

// Fallback to mock implementations if required objects are not available
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

if (!Hbar) {
  console.warn('Hbar not loaded. Using mock implementation.');
  Hbar = class MockHbar {
    constructor(value) {
      this.value = value;
    }
    
    static from(value) {
      return new MockHbar(value);
    }
    
    negated() {
      return new MockHbar(-this.value);
    }
  };
}

if (!TransactionId) {
  console.warn('TransactionId not loaded. Using mock implementation.');
  TransactionId = class MockTransactionId {
    static generate(accountId) {
      return new MockTransactionId(accountId);
    }
    
    constructor(accountId) {
      this.accountId = accountId;
    }
  };
}

if (!TransferTransaction) {
  console.warn('TransferTransaction not loaded. Using mock implementation.');
  TransferTransaction = class MockTransferTransaction {
    addHbarTransfer() {
      return this;
    }
    
    setNodeAccountIds() {
      return this;
    }
    
    setTransactionId() {
      return this;
    }
    
    freeze() {
      return this;
    }
  };
}

import { executeTransaction } from './hashconnect.js';

// Handle HBAR transfer
export async function handleTransfer(fromAccountId, toAccountId) {
    try {
        // Create transfer transaction
        const transferTransaction = new TransferTransaction()
            .addHbarTransfer(fromAccountId, new Hbar(-1)) // Subtract 1 HBAR from sender
            .addHbarTransfer(toAccountId, new Hbar(1))    // Add 1 HBAR to receiver
            .setNodeAccountIds([AccountId.fromString("0.0.3")]) // Set node account
            .setTransactionId(TransactionId.generate(fromAccountId)); // Generate transaction ID
        
        // Freeze the transaction
        const frozenTransaction = transferTransaction.freeze();
        
        // Execute the transaction
        const executeResult = await executeTransaction(
            AccountId.fromString(fromAccountId),
            frozenTransaction
        );
        
        console.log('Transaction executed:', executeResult);
        return executeResult;
        
    } catch(err) {
        console.error('Transaction error:', err);
        throw err;
    }
}