/**
 * Hedera Payment Service
 * Handles bidirectional USDC transfers for investors via Hedera Token Service
 * Extends the withdrawal service pattern to support both incoming and outgoing payments
 */

import {
    Client,
    AccountId,
    PrivateKey,
    TransferTransaction,
    TokenId,
    Status,
    AccountInfoQuery
} from '@hashgraph/sdk';

export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    transactionHash?: string;
    blockExplorerUrl?: string;
    error?: string;
    status?: string;
}

export class HederaPaymentService {
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

        console.log(`✅ Hedera Payment Service initialized on ${this.network}`);
        console.log(`   Treasury: ${this.treasuryAccountId.toString()}`);
        console.log(`   USDC Token: ${this.usdcTokenId.toString()}`);
    }

    /**
     * Transfer USDC from treasury to any recipient (withdrawals, distributions)
     * @param recipientAddress - Recipient's Hedera account ID (e.g., "0.0.1234567")
     * @param amountInCents - Amount in cents (e.g., 100000 = $1,000.00)
     * @param memo - Transaction memo describing the payment
     * @returns Payment result with transaction details
     */
    async transferFromTreasury(
        recipientAddress: string,
        amountInCents: number,
        memo: string
    ): Promise<PaymentResult> {
        try {
            console.log(`[Hedera Payment] Initiating USDC transfer:`);
            console.log(`   From: ${this.treasuryAccountId.toString()}`);
            console.log(`   To: ${recipientAddress}`);
            console.log(`   Amount: ${amountInCents} cents ($${(amountInCents / 100).toFixed(2)})`);
            console.log(`   Memo: ${memo}`);

            // Parse recipient account ID
            const recipientAccountId = AccountId.fromString(recipientAddress);

            // Our USDC token has 2 decimals (as created)
            // amountInCents is already in the smallest unit (cents)
            // Example: 100000 cents = $1000.00 = 100000 token units (with 2 decimals)
            const usdcAmount = amountInCents;

            // Create transfer transaction
            const transaction = new TransferTransaction()
                .addTokenTransfer(this.usdcTokenId, this.treasuryAccountId, -usdcAmount)
                .addTokenTransfer(this.usdcTokenId, recipientAccountId, usdcAmount)
                .setTransactionMemo(memo)
                .freezeWith(this.client);

            // Sign with treasury key
            const signedTx = await transaction.sign(this.treasuryPrivateKey);

            // Execute transaction
            console.log(`[Hedera Payment] Executing transaction...`);
            const txResponse = await signedTx.execute(this.client);

            // Get receipt to confirm success
            const receipt = await txResponse.getReceipt(this.client);
            
            if (receipt.status !== Status.Success) {
                throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
            }

            const transactionId = txResponse.transactionId.toString();
            const transactionHash = Buffer.from(txResponse.transactionHash).toString('hex');
            
            // Build block explorer URL
            const explorerBaseUrl = this.network === 'mainnet' 
                ? 'https://hashscan.io/mainnet'
                : 'https://hashscan.io/testnet';
            const blockExplorerUrl = `${explorerBaseUrl}/transaction/${transactionId}`;

            console.log(`[Hedera Payment] ✅ Transfer successful!`);
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
            console.error(`[Hedera Payment] ❌ Transfer failed:`, error);
            
            return {
                success: false,
                error: error.message || 'Unknown error during transfer',
                status: 'FAILED'
            };
        }
    }

    /**
     * Check if account has associated the USDC token
     * @param accountAddress - Hedera account ID to check
     * @returns true if token is associated, false otherwise
     */
    async checkTokenAssociation(accountAddress: string): Promise<boolean> {
        try {
            const accountId = AccountId.fromString(accountAddress);
            
            console.log(`[Hedera Payment] Checking token association for ${accountAddress}...`);
            
            // Query account info
            const accountInfo = await new AccountInfoQuery()
                .setAccountId(accountId)
                .execute(this.client);
            
            console.log(`[Hedera Payment] Account info retrieved, checking token relationships...`);
            console.log(`[Hedera Payment] Looking for token:`, this.usdcTokenId.toString());
            
            // Check if USDC token is in the account's token relationships
            let isAssociated = false;
            
            // Try to access the internal Map
            const tokenRels = accountInfo.tokenRelationships;
            
            if (tokenRels && typeof tokenRels.get === 'function') {
                // It has a get method, try to get the token
                try {
                    const relationship = tokenRels.get(this.usdcTokenId);
                    isAssociated = relationship !== null && relationship !== undefined;
                    console.log(`[Hedera Payment] Token relationship found:`, isAssociated);
                } catch (e: any) {
                    console.log(`[Hedera Payment] Error using get():`, e.message);
                }
            }
            
            // If still not found, try iterating
            if (!isAssociated && tokenRels && typeof (tokenRels as any)._map === 'object') {
                // Access internal _map property
                const internalMap = (tokenRels as any)._map;
                const tokenIdString = this.usdcTokenId.toString();
                console.log(`[Hedera Payment] Checking internal map for token...`);
                
                for (const [key, value] of Object.entries(internalMap)) {
                    if (key.includes(tokenIdString) || key === tokenIdString) {
                        isAssociated = true;
                        console.log(`[Hedera Payment] Found token in internal map:`, key);
                        break;
                    }
                }
            }
            
            console.log(`[Hedera Payment] Final association check result:`, isAssociated);
            console.log(`[Hedera Payment] Token association status: ${isAssociated ? 'Associated ✅' : 'Not associated ❌'}`);
            
            return isAssociated;
            
        } catch (error: any) {
            console.error(`[Hedera Payment] Error checking token association:`, error.message);
            console.error(`[Hedera Payment] Full error:`, error);
            return false;
        }
    }

    /**
     * Verify a payment transaction on Hedera mirror node
     * @param transactionId - Hedera transaction ID (e.g., "0.0.1234567@1234567890.123456789")
     * @param expectedRecipient - Expected recipient account ID
     * @param expectedAmountInCents - Expected amount in cents
     * @returns true if payment is verified, false otherwise
     */
    async verifyPayment(
        transactionId: string,
        expectedRecipient: string,
        expectedAmountInCents: number
    ): Promise<boolean> {
        try {
            console.log(`[Hedera Payment] Verifying payment transaction:`);
            console.log(`   Transaction ID: ${transactionId}`);
            console.log(`   Expected Recipient: ${expectedRecipient}`);
            console.log(`   Expected Amount: ${expectedAmountInCents} cents ($${(expectedAmountInCents / 100).toFixed(2)})`);

            // Build mirror node API URL
            const mirrorNodeUrl = this.network === 'mainnet'
                ? 'https://mainnet-public.mirrornode.hedera.com'
                : 'https://testnet.mirrornode.hedera.com';
            
            const apiUrl = `${mirrorNodeUrl}/api/v1/transactions/${transactionId}`;
            
            console.log(`[Hedera Payment] Querying mirror node: ${apiUrl}`);
            
            // Query mirror node
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                console.error(`[Hedera Payment] Mirror node query failed: ${response.status} ${response.statusText}`);
                return false;
            }
            
            const data = await response.json();
            
            // Check if transaction exists
            if (!data.transactions || data.transactions.length === 0) {
                console.error(`[Hedera Payment] Transaction not found on mirror node`);
                return false;
            }
            
            const transaction = data.transactions[0];
            
            // Verify transaction was successful
            if (transaction.result !== 'SUCCESS') {
                console.error(`[Hedera Payment] Transaction status is not SUCCESS: ${transaction.result}`);
                return false;
            }
            
            // Verify token transfers
            const tokenTransfers = transaction.token_transfers || [];
            
            // Find USDC token transfers
            const usdcTransfers = tokenTransfers.filter((transfer: any) => 
                transfer.token_id === this.usdcTokenId.toString()
            );
            
            if (usdcTransfers.length === 0) {
                console.error(`[Hedera Payment] No USDC token transfers found in transaction`);
                return false;
            }
            
            // Find transfer to expected recipient
            const recipientTransfer = usdcTransfers.find((transfer: any) => 
                transfer.account === expectedRecipient && transfer.amount > 0
            );
            
            if (!recipientTransfer) {
                console.error(`[Hedera Payment] No transfer to expected recipient found`);
                return false;
            }
            
            // Verify amount (mirror node returns amount in token's smallest unit)
            const actualAmount = parseInt(recipientTransfer.amount);
            
            if (actualAmount !== expectedAmountInCents) {
                console.error(`[Hedera Payment] Amount mismatch: expected ${expectedAmountInCents}, got ${actualAmount}`);
                return false;
            }
            
            console.log(`[Hedera Payment] ✅ Payment verified successfully!`);
            console.log(`   Recipient: ${recipientTransfer.account}`);
            console.log(`   Amount: ${actualAmount} cents ($${(actualAmount / 100).toFixed(2)})`);
            
            return true;
            
        } catch (error: any) {
            console.error(`[Hedera Payment] Error verifying payment:`, error.message);
            return false;
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
let hederaPaymentService: HederaPaymentService | null = null;

export function getHederaPaymentService(): HederaPaymentService {
    if (!hederaPaymentService) {
        hederaPaymentService = new HederaPaymentService();
    }
    return hederaPaymentService;
}
