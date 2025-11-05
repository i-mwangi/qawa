/**
 * Hedera Wallet Connect Configuration
 * Based on official Hedera WalletConnect example
 */

// Get LedgerId from global Hedera SDK (loaded via CDN in app.html)
const LedgerId = window.hashgraph?.LedgerId;

// App metadata for WalletConnect
export const metadata = {
  name: 'Chai Platform',
  description: 'Invest in Sustainable Coffee Production',
  url: window.location.origin,
  icons: [window.location.origin + '/chai.png']
};

// WalletConnect Project ID from Reown Cloud
// Get yours at: https://cloud.reown.com
export const PROJECT_ID = '39948bbdaaebec2790629f3e9589793a';

// Default network (can be changed to MAINNET for production)
// Using the correct LedgerId.TESTNET as per the integration guide
export const DEFAULT_NETWORK = LedgerId?.TESTNET || 'testnet';

// Default RPC URL for Hedera
export const DEFAULT_RPC_URL = 'https://testnet.hedera.api.hgraph.io/v1/pk_prod_ab2c41b848c0b568e96a31ef0ca2f2fbaa549470/rpc';

// Session storage keys
export const STORAGE_KEYS = {
  V1_SESSION: 'hwcV1Session',
  PROJECT_ID: 'reownProjectId',
  SESSION_TOPIC: 'hwcSessionTopic'
};

// Platform token IDs (loaded from environment or API)
export const TOKEN_IDS = {
  LP_USDC: null, // Will be loaded from API
  PLATFORM_ACCOUNT: null // Will be loaded from API
};
