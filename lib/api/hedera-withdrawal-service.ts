/**
 * Hedera Withdrawal Service
 * Handles USDC transfers to farmers via Hedera Token Service
 */

import {
    Client,
    AccountId,
    PrivateKey,
    TransferTransaction,
    Hbar,
    TokenId,
    Status,
    TokenAssociateTransaction,
    AccountInfoQuery
} from '@hashgraph/sdk';

export interface WithdrawalResult {
    success: boolean;
    transactionId?: string;
    transactionHash?: string;
    blockExplorerUrl?: string;
    error?: string;
    status?: string;
}

export class HederaWithdrawalService {
    private client: Client;
    private treasuryAccountId: AccountId;
    private treasuryPrivateKey: PrivateKey;
    private usdcTokenId: TokenId;
    private network: string;

    constructor() {
        this.network = process.env.HEDERA_NETWORK || 'testnet';
        
        // Initialize Hedera client
        if (this.network === 'mainnet') {
            this.client = Client.forMainnet();
        } else {
            this.client = Client.forTestnet();
        }

        // Set operator (treasury account that pays gas fees)
        const operatorId = process.env.HEDERA_OPERATOR_ID;
        const operatorKey = process.env.HEDERA_OPERATOR_KEY;

        if (!operatorId || !operatorKey) {
            throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in environment');
        }

        this.treasuryAccountId = AccountId.fromString(operatorId);
        this.treasuryPrivateKey = PrivateKey.fromString(operatorKey);
        
        this.client.setOperator(this.treasuryAccountId, this.treasuryPrivateKey);

        // USDC Token ID
        const usdcTokenId = process.env.HEDERA_USDC_TOKEN_ID;
        if (!usdcTokenId) {
            throw new Error('Missing HEDERA_USDC_TOKEN_ID in environment');
        }
        this.usdcTokenId = TokenId.fromString(usdcTokenId);

        console.log(`✅ Hedera Withdrawal Service initialized on ${this.network}`);
        console.log(`   Treasury: ${this.treasuryAccountId.toString()}`);
        console.log(`   USDC Token: ${this.usdcTokenId.toString()}`);
    }

    /**
     * Transfer USDC to farmer
     * @param farmerAddress - Farmer's Hedera account ID (e.g., "0.0.5792828")
     * @param amountInCents - Amount in cents (e.g., 3000000 = $30,000)
     * @returns Withdrawal result with transaction details
     */
    async transferUSDC(farmerAddress: string, amountInCents: number): Promise<WithdrawalResult> {
        try {
            console.log(`[Hedera] Initiating USDC transfer:`);
            console.log(`   From: ${this.treasuryAccountId.toString()}`);
            console.log(`   To: ${farmerAddress}`);
            console.log(`   Amount: ${amountInCents} cents ($${(amountInCents / 100).toFixed(2)})`);

            // Parse farmer account ID
            const farmerAccountId = AccountId.fromString(farmerAddress);

            // Our USDC token has 2 decimals (as created)
            // amountInCents is already in the smallest unit (cents)
            // Example: 240000 cents = $2400.00 = 240000 token units (with 2 decimals)
            const usdcAmount = amountInCents;

            // Create transfer transaction
            const transaction = new TransferTransaction()
                .addTokenTransfer(this.usdcTokenId, this.treasuryAccountId, -usdcAmount)
                .addTokenTransfer(this.usdcTokenId, farmerAccountId, usdcAmount)
                .setTransactionMemo(`Farmer withdrawal: Grove earnings`)
                .freezeWith(this.client);

            // Sign with treasury key
            const signedTx = await transaction.sign(this.treasuryPrivateKey);

            // Execute transaction
            console.log(`[Hedera] Executing transaction...`);
            const txResponse = await signedTx.execute(this.client);

            // Get receipt to confirm success
            const receipt = await txResponse.getReceipt(this.client);
            
            if (receipt.status !== Status.Success) {
                throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
            }

            const transactionId = txResponse.transactionId.toString();
            const transactionHash = txResponse.transactionHash.toString('hex');
            
            // Build block explorer URL
            const explorerBaseUrl = this.network === 'mainnet' 
                ? 'https://hashscan.io/mainnet'
                : 'https://hashscan.io/testnet';
            const blockExplorerUrl = `${explorerBaseUrl}/transaction/${transactionId}`;

            console.log(`[Hedera] ✅ Transfer successful!`);
            console.log(`   Transaction ID: ${transactionId}`);
            console.log(`   Hash: 0x${transactionHash}`);
            console.log(`   Explorer: ${blockExplorerUrl}`);

            return {
                success: true,
                transactionId,
                transactionHash: `0x${transactionHash}`,
                blockExplorerUrl,
                status: receipt.status.toString()
            };

        } catch (error: any) {
            console.error(`[Hedera] ❌ Transfer failed:`, error);
            
            return {
                success: false,
                error: error.message || 'Unknown error during transfer',
                status: 'FAILED'
            };
        }
    }

    /**
     * Check if farmer account is associated with USDC token
     */
    async checkTokenAssociation(farmerAddress: string): Promise<boolean> {
        try {
            const farmerAccountId = AccountId.fromString(farmerAddress);
            
            console.log(`[Hedera] Checking token association for ${farmerAddress}...`);
            
            // Query account info
            const accountInfo = await new AccountInfoQuery()
                .setAccountId(farmerAccountId)
                .execute(this.client);
            
            console.log(`[Hedera] Account info retrieved, checking token relationships...`);
            console.log(`[Hedera] Looking for token:`, this.usdcTokenId.toString());
            
            // Check if USDC token is in the account's token relationships
            let isAssociated = false;
            
            // Try to access the internal Map
            const tokenRels = accountInfo.tokenRelationships;
            
            if (tokenRels && typeof tokenRels.get === 'function') {
                // It has a get method, try to get the token
                try {
                    const relationship = tokenRels.get(this.usdcTokenId);
                    isAssociated = relationship !== null && relationship !== undefined;
                    console.log(`[Hedera] Token relationship found:`, isAssociated);
                } catch (e) {
                    console.log(`[Hedera] Error using get():`, e.message);
                }
            }
            
            // If still not found, try iterating
            if (!isAssociated && tokenRels && typeof tokenRels._map === 'object') {
                // Access internal _map property
                const internalMap = tokenRels._map;
                const tokenIdString = this.usdcTokenId.toString();
                console.log(`[Hedera] Checking internal map for token...`);
                
                for (const [key, value] of Object.entries(internalMap)) {
                    if (key.includes(tokenIdString) || key === tokenIdString) {
                        isAssociated = true;
                        console.log(`[Hedera] Found token in internal map:`, key);
                        break;
                    }
                }
            }
            
            console.log(`[Hedera] Final association check result:`, isAssociated);
            
            console.log(`[Hedera] Token association status: ${isAssociated ? 'Associated ✅' : 'Not associated ❌'}`);
            
            return isAssociated;
            
        } catch (error: any) {
            console.error(`[Hedera] Error checking token association:`, error.message);
            console.error(`[Hedera] Full error:`, error);
            return false;
        }
    }

    /**
     * Associate USDC token with farmer account
     * Platform pays the association fee (~$0.05)
     */
    async associateToken(farmerAddress: string): Promise<WithdrawalResult> {
        try {
            const farmerAccountId = AccountId.fromString(farmerAddress);
            
            console.log(`[Hedera] Associating USDC token with ${farmerAddress}...`);
            console.log(`[Hedera] Platform will pay the association fee (~$0.05)`);
            
            // Create token association transaction
            // Note: This requires the farmer's signature, which we don't have
            // So we need to use a different approach
            
            // Alternative: Send a small HBAR amount to trigger auto-association
            // But this only works if the token has auto-association enabled
            
            console.log(`[Hedera] ⚠️  Token association requires farmer's signature`);
            console.log(`[Hedera] Farmer must associate token manually in HashPack`);
            
            return {
                success: false,
                error: 'Token association requires farmer signature. Please associate token in HashPack wallet.',
                status: 'REQUIRES_MANUAL_ASSOCIATION'
            };
            
        } catch (error: any) {
            console.error(`[Hedera] Error associating token:`, error.message);
            return {
                success: false,
                error: error.message,
                status: 'ASSOCIATION_FAILED'
            };
        }
    }

    /**
     * Get treasury USDC balance
     */
    async getTreasuryBalance(): Promise<number> {
        try {
            // Query treasury account balance
            // This would use Hedera Mirror Node API
            // For now, return placeholder
            
            console.log(`[Hedera] Querying treasury balance...`);
            return 0; // Placeholder
            
        } catch (error) {
            console.error(`[Hedera] Error getting treasury balance:`, error);
            return 0;
        }
    }

    /**
     * Close client connection
     */
    close() {
        this.client.close();
    }
}

// Singleton instance
let hederaWithdrawalService: HederaWithdrawalService | null = null;

export function getHederaWithdrawalService(): HederaWithdrawalService {
    if (!hederaWithdrawalService) {
        hederaWithdrawalService = new HederaWithdrawalService();
    }
    return hederaWithdrawalService;
}
