# Hedera Wallet Connect Integration

This directory contains the Hedera Wallet Connect v1 integration for the Chai Platform, based on the official [Hedera WalletConnect example](https://github.com/hashgraph/hedera-wallet-connect/).

## Features

- ✅ **Multiple Wallet Support**: HashPack, Blade, Kabila browser extensions
- ✅ **QR Code Connection**: Mobile wallet support via WalletConnect
- ✅ **Session Persistence**: Automatic reconnection on page reload
- ✅ **Transaction Support**: Sign and execute Hedera transactions
- ✅ **Vanilla JavaScript**: No framework dependencies

## Architecture

```
wallet/
├── config.js       # Configuration (Project ID, network, metadata)
├── state.js        # State management (connection status, account info)
├── connector.js    # DAppConnector wrapper (core wallet logic)
├── modal.js        # Connection modal UI
├── modal.css       # Modal styles
├── manager.js      # High-level API for the app
└── index.js        # Entry point
```

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

The following packages are required:
- `@hashgraph/hedera-wallet-connect@2.0.4-canary.3ca04e9.0`
- `@hashgraph/sdk@^2.72.0`
- `@walletconnect/sign-client@2.19.1`
- `@walletconnect/universal-provider@2.21.5`
- `@walletconnect/utils@2.19.1`
- `@reown/appkit@^1.8.4`

### 2. Configuration

The Project ID is already configured in `config.js`:
```javascript
export const PROJECT_ID = '39948bbdaaebec2790629f3e9589793a';
```

To use your own Project ID:
1. Visit [https://cloud.reown.com](https://cloud.reown.com)
2. Create a new project
3. Copy your Project ID
4. Update `PROJECT_ID` in `config.js`

### 3. Usage in Your App

The wallet manager is available globally as `window.walletManager`:

```javascript
// Connect wallet
await walletManager.connect();

// Check connection status
if (walletManager.isWalletConnected()) {
  const accountId = walletManager.getAccountId();
  console.log('Connected:', accountId);
}

// Send transaction
const result = await walletManager.sendTransaction(
  '0.0.12345',  // recipient
  '10'          // amount in HBAR
);

// Disconnect
await walletManager.disconnect();
```

### 4. Listen to Events

```javascript
// Wallet connected
window.addEventListener('wallet-connected', (event) => {
  console.log('Connected:', event.detail.accountId);
  console.log('User type:', event.detail.userType);
});

// Wallet disconnected
window.addEventListener('wallet-disconnected', () => {
  console.log('Disconnected');
});
```

## API Reference

### WalletManager

#### Methods

- `init()` - Initialize wallet manager and restore session
- `connect()` - Show connection modal and connect wallet
- `disconnect()` - Disconnect wallet and clear session
- `isWalletConnected()` - Check if wallet is connected
- `getAccountId()` - Get connected account ID
- `getUserType()` - Get user type ('farmer' or 'investor')
- `setUserType(type)` - Set user type
- `sendTransaction(recipientId, amount)` - Send HBAR transaction

### HederaWalletConnector (Low-level API)

- `init(checkExistingSession)` - Initialize DAppConnector
- `connectExtension(extensionId)` - Connect via browser extension
- `connectQRCode()` - Connect via QR code
- `disconnect()` - Disconnect wallet
- `getSigner()` - Get signer for transactions
- `signAndExecuteTransaction(recipientId, amount)` - Sign and execute transaction

### WalletState

- `getState()` - Get current state
- `setState(updates)` - Update state
- `subscribe(listener)` - Subscribe to state changes
- `reset()` - Reset state

## Connection Flow

### Browser Extension Connection

1. User clicks "Connect Wallet"
2. Modal shows available extensions (HashPack, Blade, Kabila)
3. User selects extension
4. Extension opens for approval
5. User approves connection
6. Session established and saved

### QR Code Connection

1. User clicks "Show QR Code"
2. WalletConnect modal opens with QR code
3. User scans with mobile wallet
4. User approves connection in wallet
5. Session established and saved

## Session Persistence

Sessions are stored in `sessionStorage` with key `hwcV1Session`:

```javascript
{
  topic: "session-topic-hash",
  accountId: "0.0.12345",
  timestamp: 1234567890
}
```

On page reload, the connector automatically restores the session if found.

## Network Configuration

Default network is **Testnet**. To use Mainnet:

```javascript
// In config.js
export const DEFAULT_NETWORK = LedgerId.MAINNET;
```

## Supported Wallets

### Browser Extensions
- **HashPack** - [Install](https://www.hashpack.app/)
- **Blade** - [Install](https://bladewallet.io/)
- **Kabila** - [Install](https://kabila.app/)

### Mobile Wallets (via QR Code)
- Any WalletConnect v2 compatible Hedera wallet

## Transaction Examples

### Basic HBAR Transfer

```javascript
const result = await walletManager.sendTransaction(
  '0.0.12345',  // recipient
  '10'          // amount in HBAR
);

console.log('Transaction ID:', result.transactionId);
console.log('Status:', result.status);
```

### Custom Transaction (Advanced)

```javascript
import { hederaWallet } from './wallet/connector.js';
import { TokenAssociateTransaction } from '@hashgraph/sdk';

const signer = hederaWallet.getSigner();
const accountId = signer.getAccountId();

const transaction = new TokenAssociateTransaction()
  .setAccountId(accountId)
  .setTokenIds(['0.0.11111']);

// Sign and execute
const signedTx = await signer.signTransaction(transaction);
const txResponse = await signedTx.executeWithSigner(signer);
const receipt = await txResponse.getReceiptWithSigner(signer);
```

## Troubleshooting

### Extension Not Detected

- Make sure the wallet extension is installed and enabled
- Refresh the page after installing
- Check browser console for errors

### Connection Expired

- QR codes expire after 5 minutes
- Click "Show QR Code" again to generate a new one

### Session Not Restored

- Check if `sessionStorage` is enabled in browser
- Clear `sessionStorage` and reconnect if corrupted

### Transaction Failed

- Ensure sufficient HBAR balance for transaction + fees
- Check network status (testnet/mainnet)
- Verify recipient account ID format

## Development

### Testing Locally

```bash
# Start development server
pnpm run dev:vite

# Open http://localhost:3000/app.html
```

### Building for Production

```bash
# Build optimized bundle
pnpm run frontend:build

# Preview production build
pnpm run frontend:preview
```

## Migration from Old Implementation

The old wallet integration files have been replaced:
- ❌ `frontend/src/hwc-connector.js` (old v1.5.1)
- ❌ `frontend/src/main.js` (old implementation)
- ❌ `frontend/src/hwc-modal.js` (old modal)
- ✅ `frontend/wallet/*` (new v2.0.4 canary)

The new implementation is based on the official Hedera example and uses the latest canary version with better stability and features.

## Resources

- [Hedera WalletConnect Docs](https://docs.hedera.com/hedera/tutorials/more-tutorials/wallet-connect)
- [Official Example Repo](https://github.com/hashgraph/hedera-wallet-connect/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [Reown Cloud](https://cloud.reown.com/)

## Support

For issues or questions:
1. Check the [Hedera Discord](https://hedera.com/discord)
2. Review [GitHub Issues](https://github.com/hashgraph/hedera-wallet-connect/issues)
3. Consult [Hedera Docs](https://docs.hedera.com/)
