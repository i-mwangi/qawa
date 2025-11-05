# Vanilla JavaScript HashConnect Integration

This is a complete example of how to integrate HashConnect with vanilla JavaScript (no frameworks like React, Vue, etc.).

## Features

- Framework-agnostic HashConnect initialization
- Simple state management with pub/sub pattern
- DOM manipulation for UI updates
- Transaction signing and execution
- Wallet connection/disconnection handling

## Files

1. **index.html** - Main HTML file with UI
2. **hashconnect.js** - HashConnect service initialization and transaction functions
3. **state.js** - Simple state management system
4. **ui.js** - DOM manipulation for UI elements
5. **transactions.js** - Transaction logic

## How to Run

1. Serve the files using any HTTP server:
   ```bash
   npx serve .
   ```
   
2. Open your browser to the provided URL (typically http://localhost:3000)

## Key Implementation Details

### 1. HashConnect Service (hashconnect.js)

The HashConnect initialization is framework-agnostic and works the same in vanilla JS:

```javascript
import { AccountId, LedgerId, Transaction } from "@hashgraph/sdk";
import { HashConnect } from "hashconnect";

const env = "testnet";
const appMetadata = {
    name: "Vanilla JS dApp",
    description: "An example HashConnect dApp in vanilla JavaScript",
    icons: [window.location.origin + "/favicon.ico"],
    url: window.location.origin,
};
const projectId = "YOUR_PROJECT_ID";

export const hc = new HashConnect(
    LedgerId.fromString(env),
    projectId,
    appMetadata,
    true
);

export const hcInitPromise = hc.init();
```

### 2. State Management (state.js)

Instead of Redux, we use a simple state object and event listeners:

```javascript
const state = {
    isConnected: false,
    accountIds: [],
    pairingString: ""
};

const listeners = [];

export function getState() {
    return state;
}

export function setState(updates) {
    Object.assign(state, updates);
    listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
    listeners.push(fn);
    return () => {
        const index = listeners.indexOf(fn);
        if (index > -1) listeners.splice(index, 1);
    };
}
```

### 3. UI Components (ui.js)

Replace React components with DOM manipulation:

```javascript
export function createConnectButton() {
    const button = document.createElement('button');
    
    function updateButton() {
        const { isConnected, accountIds } = getState();
        button.textContent = isConnected 
            ? `Disconnect Account${accountIds.length > 1 ? 's' : ''}`
            : 'Connect';
    }
    
    button.addEventListener('click', async () => {
        const { isConnected } = getState();
        await hcInitPromise;
        
        if (isConnected && getConnectedAccountIds().length > 0) {
            hc.disconnect();
        } else {
            hc.openPairingModal();
        }
    });
    
    subscribe(updateButton);
    updateButton();
    
    return button;
}
```

### 4. Transaction Handling (transactions.js)

Replace React components with DOM manipulation:

```javascript
export async function handleTransfer(fromAccountId, toAccountId) {
    const transferTransaction = new TransferTransaction()
        .addHbarTransfer(fromAccountId, new Hbar(-1))
        .addHbarTransfer(toAccountId, new Hbar(1))
        .setNodeAccountIds([AccountId.fromString("0.0.3")])
        .setTransactionId(TransactionId.generate(fromAccountId));
        
    const frozenTransaction = transferTransaction.freeze();
    
    try {
        const executeResult = await executeTransaction(
            AccountId.fromString(fromAccountId),
            frozenTransaction
        );
        return executeResult;
    } catch(err) {
        throw err;
    }
}
```

## Project Structure

```
vanilla-hashconnect/
├── index.html
├── hashconnect.js
├── state.js
├── ui.js
├── transactions.js
└── README.md
```

## Integration with Project Chai

To integrate this vanilla JS implementation with the existing Project Chai codebase:

1. Copy the required files to your project directory
2. Update the project ID in `hashconnect.js` to your own WalletConnect project ID
3. Use the `chai-integration.js` module to interface with existing code
4. Replace calls to the existing HashConnect manager with the new implementation

Example integration:

```javascript
import chaiHashConnect from './vanilla-hashconnect/chai-integration.js';

// Initialize
await chaiHashConnect.init();

// Create connect button
chaiHashConnect.createConnectButton('wallet-button-container');

// Listen for events
window.addEventListener('chai-wallet-connected', (event) => {
    console.log('Wallet connected:', event.detail.accountId);
});

// Send transfer
await chaiHashConnect.sendTransfer('0.0.12345', '0.0.67890');
```

## Notes

- No bundler required: You can use native ES modules in modern browsers
- State management: The simple pub/sub pattern replaces Redux functionality
- All transaction patterns work: The three transaction signing patterns work identically in vanilla JS
- DOM updates: You need to manually update the DOM when state changes
- Project ID: Remember to get your own WalletConnect project ID from https://cloud.walletconnect.com/

## Dependencies

The implementation uses these CDN-hosted libraries:

- `@hashgraph/sdk` - Hedera SDK
- `hashconnect` - HashConnect library
- `buffer` - Buffer polyfill for browser compatibility

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

For initialization issues specifically, see [INITIALIZATION-TROUBLESHOOTING.md](INITIALIZATION-TROUBLESHOOTING.md).