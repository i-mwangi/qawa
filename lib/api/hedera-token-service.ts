/**
 * Hedera Token Service - SDK Implementation
 * Replaces smart contract token operations with direct Hedera SDK calls
 */

import {
    Client,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
    TokenAssociateTransaction,
    AccountBalanceQuery,
    TokenId,
    AccountId,
    PrivateKey,
    Hbar,
    TokenInfoQuery
} from '@hashgraph/sdk'

interface TokenCreationResult {
    success: boolean
    tokenId?: string
    tokenAddress?: string
    transactionId?: string
    error?: string
}

interface TokenOperationResult {
    success: boolean
    transactionId?: string
    newTotalSupply?: number
    error?: string
}

interface TransferResult {
    success: boolean
    transactionId?: string
    amount?: number
    error?: string
}

export class HederaTokenService {
    private client: Client
    private treasuryId: AccountId
    private treasuryKey: PrivateKey

    constructor() {
        // Initialize Hedera client
        const operatorId = process.env.HEDERA_OPERATOR_ID!
        const operatorKey = process.env.HEDERA_OPERATOR_KEY!

        if (!operatorId || !operatorKey) {
            throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in environment')
        }

        // Use testnet by default
        this.client = Client.forTestnet()
        this.treasuryId = AccountId.fromString(operatorId)
        this.treasuryKey = PrivateKey.fromString(operatorKey)
        
        this.client.setOperator(this.treasuryId, this.treasuryKey)
    }

    /**
     * 1. TOKEN CREATION - Create HTS token for a coffee grove
     * Replaces: CoffeeTreeIssuer.createTokenizedAsset(), CoffeeTreeManager.initializeToken()
     * 
     * @param groveName - Name of the grove
     * @param symbol - Token symbol
     * @param initialSupply - Initial token supply
     * @param farmerAccountId - (Optional) Farmer's account to receive tokens. If not provided, uses platform treasury
     */
    async createGroveToken(
        groveName: string,
        symbol: string,
        initialSupply: number = 0,
        farmerAccountId?: string
    ): Promise<TokenCreationResult> {
        try {
            console.log(`Creating token for grove: ${groveName} (${symbol})`)
            
            // Determine treasury account
            // If farmer account provided, they get the tokens (decentralized)
            // Otherwise, platform treasury holds tokens (centralized - for marketplace)
            const treasuryAccount = farmerAccountId 
                ? AccountId.fromString(farmerAccountId)
                : this.treasuryId
            
            console.log(`   Treasury: ${treasuryAccount.toString()}`)
            console.log(`   Initial Supply: ${initialSupply}`)

            // Create fungible token
            const transaction = new TokenCreateTransaction()
                .setTokenName(groveName)
                .setTokenSymbol(symbol)
                .setTokenType(TokenType.FungibleCommon)
                .setDecimals(0) // Whole tokens only
                .setInitialSupply(initialSupply)
                .setTreasuryAccountId(treasuryAccount) // Farmer or platform treasury
                .setSupplyType(TokenSupplyType.Infinite) // Can mint more later
                .setSupplyKey(this.treasuryKey) // Platform can mint/burn (for management)
                .setAdminKey(this.treasuryKey) // Platform is admin (for management)
                .setFreezeDefault(false) // Tokens not frozen by default
                .setMaxTransactionFee(new Hbar(30)) // Max fee

            // Execute transaction
            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)
            const tokenId = receipt.tokenId

            if (!tokenId) {
                return {
                    success: false,
                    error: 'Token creation failed - no token ID returned'
                }
            }

            console.log(`✅ Token created: ${tokenId.toString()}`)

            return {
                success: true,
                tokenId: tokenId.toString(),
                tokenAddress: tokenId.toString(),
                transactionId: txResponse.transactionId.toString()
            }

        } catch (error: any) {
            console.error('Error creating token:', error)
            return {
                success: false,
                error: error.message || 'Failed to create token'
            }
        }
    }

    /**
     * 2. TOKEN MINTING - Mint additional tokens
     * Replaces: CoffeeTreeManager.mint(), mintGroveTokens()
     */
    async mintTokens(
        tokenId: string,
        amount: number
    ): Promise<TokenOperationResult> {
        try {
            console.log(`Minting ${amount} tokens for ${tokenId}`)

            const transaction = new TokenMintTransaction()
                .setTokenId(TokenId.fromString(tokenId))
                .setAmount(amount)
                .setMaxTransactionFee(new Hbar(20))

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            console.log(`✅ Minted ${amount} tokens`)

            // Get new total supply
            const tokenInfo = await new TokenInfoQuery()
                .setTokenId(TokenId.fromString(tokenId))
                .execute(this.client)

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                newTotalSupply: Number(tokenInfo.totalSupply)
            }

        } catch (error: any) {
            console.error('Error minting tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to mint tokens'
            }
        }
    }

    /**
     * 3. TOKEN BURNING - Burn tokens from treasury
     * Replaces: CoffeeTreeManager.burn(), burnTokens()
     */
    async burnTokens(
        tokenId: string,
        amount: number
    ): Promise<TokenOperationResult> {
        try {
            console.log(`Burning ${amount} tokens for ${tokenId}`)

            const transaction = new TokenBurnTransaction()
                .setTokenId(TokenId.fromString(tokenId))
                .setAmount(amount)
                .setMaxTransactionFee(new Hbar(20))

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            console.log(`✅ Burned ${amount} tokens`)

            // Get new total supply
            const tokenInfo = await new TokenInfoQuery()
                .setTokenId(TokenId.fromString(tokenId))
                .execute(this.client)

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                newTotalSupply: Number(tokenInfo.totalSupply)
            }

        } catch (error: any) {
            console.error('Error burning tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to burn tokens'
            }
        }
    }

    /**
     * 4. TOKEN ASSOCIATION - Associate token with user account (replaces KYC)
     * Replaces: CoffeeTreeManager.grantKYC()
     * Note: User must sign this transaction via HashPack
     */
    async associateToken(
        tokenId: string,
        accountId: string
    ): Promise<TokenOperationResult> {
        try {
            console.log(`Associating token ${tokenId} with account ${accountId}`)

            // Note: In production, this transaction should be signed by the user via HashPack
            // This is just for backend-initiated associations
            const transaction = new TokenAssociateTransaction()
                .setAccountId(AccountId.fromString(accountId))
                .setTokenIds([TokenId.fromString(tokenId)])
                .setMaxTransactionFee(new Hbar(20))

            // In real implementation, send this to frontend for user to sign via HashPack
            console.log('⚠️ User must sign this transaction via HashPack')

            return {
                success: true,
                transactionId: 'pending_user_signature'
            }

        } catch (error: any) {
            console.error('Error associating token:', error)
            return {
                success: false,
                error: error.message || 'Failed to associate token'
            }
        }
    }

    /**
     * 5. TOKEN TRANSFER - Transfer tokens to investors/farmers
     * Replaces: CoffeeTreeManager.airdropPurchasedTokens(), airdropRevenueTokens()
     */
    async transferTokens(
        tokenId: string,
        toAccountId: string,
        amount: number,
        memo?: string
    ): Promise<TransferResult> {
        try {
            console.log(`Transferring ${amount} tokens to ${toAccountId}`)

            // Check if recipient is associated with the token
            console.log(`🔍 Checking token association for ${toAccountId}...`);
            const balanceCheck = await this.getTokenBalance(toAccountId, tokenId);
            console.log(`Balance check result:`, balanceCheck);
            
            if (!balanceCheck.success) {
                console.warn(`⚠️ Could not verify token association for ${toAccountId}`);
                console.warn(`Proceeding with transfer anyway (risky)...`);
            } else if (!balanceCheck.isAssociated) {
                console.error(`❌ Account ${toAccountId} is NOT associated with token ${tokenId}`);
                return {
                    success: false,
                    error: `TOKEN_NOT_ASSOCIATED: Account must associate token ${tokenId} before receiving transfers. Please associate the token in your wallet first.`
                };
            } else {
                console.log(`✅ Account is associated. Current balance: ${balanceCheck.balance}`);
            }

            const transaction = new TransferTransaction()
                .addTokenTransfer(
                    TokenId.fromString(tokenId),
                    this.treasuryId,
                    -amount
                )
                .addTokenTransfer(
                    TokenId.fromString(tokenId),
                    AccountId.fromString(toAccountId),
                    amount
                )
                .setMaxTransactionFee(new Hbar(20))

            if (memo) {
                transaction.setTransactionMemo(memo)
            }

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            console.log(`✅ Transferred ${amount} tokens`)

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                amount
            }

        } catch (error: any) {
            console.error('Error transferring tokens:', error)
            
            // Check if error is due to token not associated
            if (error.message && error.message.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
                return {
                    success: false,
                    error: `TOKEN_NOT_ASSOCIATED: Account must associate token ${tokenId} before receiving transfers. Please associate the token in your wallet first.`
                };
            }
            
            return {
                success: false,
                error: error.message || 'Failed to transfer tokens'
            }
        }
    }

    /**
     * Transfer tokens from one account to another (for marketplace)
     * Note: This requires the seller to have approved the platform as an allowance spender
     * OR the seller must sign the transaction
     */
    async transferTokensBetweenAccounts(
        tokenId: string,
        fromAccountId: string,
        toAccountId: string,
        amount: number,
        memo?: string
    ): Promise<TransferResult> {
        try {
            console.log(`Transferring ${amount} tokens from ${fromAccountId} to ${toAccountId}`);

            // For marketplace, we transfer from seller to buyer
            // The platform treasury acts as intermediary
            const transaction = new TransferTransaction()
                .addTokenTransfer(
                    TokenId.fromString(tokenId),
                    AccountId.fromString(fromAccountId),
                    -amount
                )
                .addTokenTransfer(
                    TokenId.fromString(tokenId),
                    AccountId.fromString(toAccountId),
                    amount
                )
                .setMaxTransactionFee(new Hbar(20));

            if (memo) {
                transaction.setTransactionMemo(memo);
            }

            const txResponse = await transaction.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            console.log(`✅ Transferred ${amount} tokens from ${fromAccountId} to ${toAccountId}`);

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                amount
            };

        } catch (error: any) {
            console.error('Error transferring tokens between accounts:', error);
            return {
                success: false,
                error: error.message || 'Failed to transfer tokens'
            };
        }
    }

    /**
     * 6. BATCH TRANSFER - Transfer to multiple recipients
     * Replaces: Revenue distribution to multiple investors
     */
    async batchTransferTokens(
        tokenId: string,
        recipients: Array<{ accountId: string; amount: number }>,
        memo?: string
    ): Promise<TransferResult> {
        try {
            console.log(`Batch transferring to ${recipients.length} recipients`)

            const transaction = new TransferTransaction()
                .setMaxTransactionFee(new Hbar(50))

            // Calculate total amount
            const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0)

            // Deduct from treasury
            transaction.addTokenTransfer(
                TokenId.fromString(tokenId),
                this.treasuryId,
                -totalAmount
            )

            // Add to each recipient
            recipients.forEach(recipient => {
                transaction.addTokenTransfer(
                    TokenId.fromString(tokenId),
                    AccountId.fromString(recipient.accountId),
                    recipient.amount
                )
            })

            if (memo) {
                transaction.setTransactionMemo(memo)
            }

            const txResponse = await transaction.execute(this.client)
            const receipt = await txResponse.getReceipt(this.client)

            console.log(`✅ Batch transferred to ${recipients.length} recipients`)

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                amount: totalAmount
            }

        } catch (error: any) {
            console.error('Error batch transferring tokens:', error)
            return {
                success: false,
                error: error.message || 'Failed to batch transfer tokens'
            }
        }
    }

    /**
     * 7. GET TOKEN BALANCE - Check account token balance
     */
    async getTokenBalance(
        accountId: string,
        tokenId: string
    ): Promise<{ success: boolean; balance?: number; isAssociated?: boolean; error?: string }> {
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(AccountId.fromString(accountId))
                .execute(this.client)

            const tokenBalance = balance.tokens?.get(TokenId.fromString(tokenId))
            
            // If tokenBalance is undefined/null, token is not associated
            // If it's 0 or greater, token IS associated (just has 0 balance)
            const isAssociated = tokenBalance !== undefined && tokenBalance !== null;

            return {
                success: true,
                balance: tokenBalance ? Number(tokenBalance) : 0,
                isAssociated
            }

        } catch (error: any) {
            console.error('Error getting token balance:', error)
            return {
                success: false,
                error: error.message || 'Failed to get token balance'
            }
        }
    }

    /**
     * 8. GET TOKEN INFO - Get token details
     */
    async getTokenInfo(tokenId: string): Promise<{
        success: boolean
        info?: {
            name: string
            symbol: string
            totalSupply: number
            decimals: number
            treasury: string
        }
        error?: string
    }> {
        try {
            const tokenInfo = await new TokenInfoQuery()
                .setTokenId(TokenId.fromString(tokenId))
                .execute(this.client)

            return {
                success: true,
                info: {
                    name: tokenInfo.name,
                    symbol: tokenInfo.symbol,
                    totalSupply: Number(tokenInfo.totalSupply),
                    decimals: tokenInfo.decimals,
                    treasury: tokenInfo.treasuryAccountId.toString()
                }
            }

        } catch (error: any) {
            console.error('Error getting token info:', error)
            return {
                success: false,
                error: error.message || 'Failed to get token info'
            }
        }
    }
}

// Export singleton instance with lazy initialization
let _instance: HederaTokenService | null = null

export const hederaTokenService = new Proxy({} as HederaTokenService, {
    get(target, prop) {
        if (!_instance) {
            _instance = new HederaTokenService()
        }
        return (_instance as any)[prop]
    }
})
