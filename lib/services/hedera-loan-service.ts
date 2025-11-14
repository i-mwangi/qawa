/**
 * Hedera Loan Service
 * Handles loan origination, repayment, and collateral management on Hedera
 */

import {
    Client,
    AccountId,
    PrivateKey,
    TransferTransaction,
    TokenAssociateTransaction,
    AccountBalanceQuery,
    TransactionId,
    Hbar,
    Status
} from '@hashgraph/sdk';

interface LoanOriginationParams {
    borrowerAccount: string;
    loanAmount: number;
    collateralTokenId: string;
    collateralAmount: number;
}

interface LoanOriginationResult {
    success: boolean;
    loanId?: string;
    transactionId?: string;
    collateralLocked?: boolean;
    usdcTransferred?: boolean;
    error?: string;
}

interface LoanRepaymentParams {
    loanId: string;
    borrowerAccount: string;
    repaymentAmount: number;
    collateralTokenId: string;
    collateralAmount: number;
}

interface LoanRepaymentResult {
    success: boolean;
    transactionId?: string;
    collateralUnlocked?: boolean;
    usdcReceived?: boolean;
    error?: string;
}

interface CollateralLockParams {
    borrowerAccount: string;
    tokenId: string;
    amount: number;
}

interface CollateralUnlockParams {
    borrowerAccount: string;
    tokenId: string;
    amount: number;
}

interface TransactionResult {
    success: boolean;
    transactionId?: string;
    error?: string;
}

export class HederaLoanService {
    private client: Client;
    private operatorId: AccountId;
    private operatorKey: PrivateKey;
    private treasuryId: AccountId;
    private usdcTokenId: string;

    constructor() {
        // Initialize Hedera client
        const network = process.env.HEDERA_NETWORK || 'testnet';
        
        if (network === 'testnet') {
            this.client = Client.forTestnet();
        } else if (network === 'mainnet') {
            this.client = Client.forMainnet();
        } else {
            throw new Error(`Unsupported network: ${network}`);
        }

        // Set operator
        const operatorIdStr = process.env.HEDERA_OPERATOR_ID;
        const operatorKeyStr = process.env.HEDERA_OPERATOR_KEY;
        const treasuryIdStr = process.env.HEDERA_TREASURY_ID || operatorIdStr;
        const usdcTokenId = process.env.USDC_TOKEN_ID;

        if (!operatorIdStr || !operatorKeyStr || !usdcTokenId) {
            throw new Error('Missing required Hedera configuration');
        }

        this.operatorId = AccountId.fromString(operatorIdStr);
        this.operatorKey = PrivateKey.fromString(operatorKeyStr);
        this.treasuryId = AccountId.fromString(treasuryIdStr!);
        this.usdcTokenId = usdcTokenId;

        this.client.setOperator(this.operatorId, this.operatorKey);

        console.log('[HederaLoanService] Initialized');
        console.log(`  Operator: ${this.operatorId.toString()}`);
        console.log(`  Treasury: ${this.treasuryId.toString()}`);
        console.log(`  USDC Token: ${this.usdcTokenId}`);
    }

    /**
     * Originate a new loan
     * 1. Lock collateral tokens from borrower
     * 2. Transfer USDC to borrower
     */
    async originateLoan(params: LoanOriginationParams): Promise<LoanOriginationResult> {
        const { borrowerAccount, loanAmount, collateralTokenId, collateralAmount } = params;

        console.log('[HederaLoanService] Originating loan:');
        console.log(`  Borrower: ${borrowerAccount}`);
        console.log(`  Loan Amount: ${loanAmount} USDC`);
        console.log(`  Collateral: ${collateralAmount} tokens (${collateralTokenId})`);

        try {
            // Generate unique loan ID
            const loanId = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Step 1: Lock collateral (transfer from borrower to treasury)
            console.log('[HederaLoanService] Step 1: Locking collateral...');
            const collateralResult = await this.lockCollateral({
                borrowerAccount,
                tokenId: collateralTokenId,
                amount: collateralAmount
            });

            if (!collateralResult.success) {
                return {
                    success: false,
                    error: `Failed to lock collateral: ${collateralResult.error}`
                };
            }

            console.log(`  ✅ Collateral locked: ${collateralResult.transactionId}`);

            // Step 2: Transfer USDC to borrower
            console.log('[HederaLoanService] Step 2: Transferring USDC to borrower...');
            const usdcResult = await this.transferUSDC(
                this.treasuryId.toString(),
                borrowerAccount,
                loanAmount
            );

            if (!usdcResult.success) {
                // TODO: In production, we should unlock collateral if USDC transfer fails
                console.error('  ❌ USDC transfer failed, but collateral is locked!');
                return {
                    success: false,
                    error: `Failed to transfer USDC: ${usdcResult.error}`,
                    loanId,
                    collateralLocked: true,
                    usdcTransferred: false
                };
            }

            console.log(`  ✅ USDC transferred: ${usdcResult.transactionId}`);

            return {
                success: true,
                loanId,
                transactionId: usdcResult.transactionId,
                collateralLocked: true,
                usdcTransferred: true
            };

        } catch (error: any) {
            console.error('[HederaLoanService] Error originating loan:', error);
            return {
                success: false,
                error: error.message || 'Unknown error during loan origination'
            };
        }
    }

    /**
     * Repay a loan
     * 1. Receive USDC repayment from borrower
     * 2. Unlock and return collateral to borrower
     */
    async repayLoan(params: LoanRepaymentParams): Promise<LoanRepaymentResult> {
        const { loanId, borrowerAccount, repaymentAmount, collateralTokenId, collateralAmount } = params;

        console.log('[HederaLoanService] Processing loan repayment:');
        console.log(`  Loan ID: ${loanId}`);
        console.log(`  Borrower: ${borrowerAccount}`);
        console.log(`  Repayment: ${repaymentAmount} USDC`);
        console.log(`  Collateral to unlock: ${collateralAmount} tokens`);

        try {
            // Step 1: Receive USDC repayment (transfer from borrower to treasury)
            console.log('[HederaLoanService] Step 1: Receiving USDC repayment...');
            const usdcResult = await this.transferUSDC(
                borrowerAccount,
                this.treasuryId.toString(),
                repaymentAmount
            );

            if (!usdcResult.success) {
                return {
                    success: false,
                    error: `Failed to receive USDC repayment: ${usdcResult.error}`
                };
            }

            console.log(`  ✅ USDC received: ${usdcResult.transactionId}`);

            // Step 2: Unlock collateral (transfer from treasury back to borrower)
            console.log('[HederaLoanService] Step 2: Unlocking collateral...');
            const collateralResult = await this.unlockCollateral({
                borrowerAccount,
                tokenId: collateralTokenId,
                amount: collateralAmount
            });

            if (!collateralResult.success) {
                // TODO: In production, we should handle this case carefully
                console.error('  ❌ Collateral unlock failed, but USDC was received!');
                return {
                    success: false,
                    error: `Failed to unlock collateral: ${collateralResult.error}`,
                    transactionId: usdcResult.transactionId,
                    usdcReceived: true,
                    collateralUnlocked: false
                };
            }

            console.log(`  ✅ Collateral unlocked: ${collateralResult.transactionId}`);

            return {
                success: true,
                transactionId: collateralResult.transactionId,
                usdcReceived: true,
                collateralUnlocked: true
            };

        } catch (error: any) {
            console.error('[HederaLoanService] Error repaying loan:', error);
            return {
                success: false,
                error: error.message || 'Unknown error during loan repayment'
            };
        }
    }

    /**
     * Lock collateral tokens (transfer from borrower to treasury)
     */
    async lockCollateral(params: CollateralLockParams): Promise<TransactionResult> {
        const { borrowerAccount, tokenId, amount } = params;

        try {
            console.log(`[HederaLoanService] Locking ${amount} tokens (${tokenId}) from ${borrowerAccount}`);

            // Create transfer transaction
            // Note: In production, this would require the borrower to sign the transaction
            // For now, we'll simulate this with operator signing
            const transaction = new TransferTransaction()
                .addTokenTransfer(tokenId, borrowerAccount, -amount)
                .addTokenTransfer(tokenId, this.treasuryId, amount)
                .setTransactionMemo(`Lock collateral for loan`)
                .freezeWith(this.client);

            // Sign and execute
            const signedTx = await transaction.sign(this.operatorKey);
            const txResponse = await signedTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status !== Status.Success) {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            const transactionId = txResponse.transactionId.toString();
            console.log(`  ✅ Collateral locked: ${transactionId}`);

            return {
                success: true,
                transactionId
            };

        } catch (error: any) {
            console.error('[HederaLoanService] Error locking collateral:', error);
            return {
                success: false,
                error: error.message || 'Failed to lock collateral'
            };
        }
    }

    /**
     * Unlock collateral tokens (transfer from treasury back to borrower)
     */
    async unlockCollateral(params: CollateralUnlockParams): Promise<TransactionResult> {
        const { borrowerAccount, tokenId, amount } = params;

        try {
            console.log(`[HederaLoanService] Unlocking ${amount} tokens (${tokenId}) to ${borrowerAccount}`);

            // Create transfer transaction
            const transaction = new TransferTransaction()
                .addTokenTransfer(tokenId, this.treasuryId, -amount)
                .addTokenTransfer(tokenId, borrowerAccount, amount)
                .setTransactionMemo(`Unlock collateral after loan repayment`)
                .freezeWith(this.client);

            // Sign and execute
            const signedTx = await transaction.sign(this.operatorKey);
            const txResponse = await signedTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status !== Status.Success) {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            const transactionId = txResponse.transactionId.toString();
            console.log(`  ✅ Collateral unlocked: ${transactionId}`);

            return {
                success: true,
                transactionId
            };

        } catch (error: any) {
            console.error('[HederaLoanService] Error unlocking collateral:', error);
            return {
                success: false,
                error: error.message || 'Failed to unlock collateral'
            };
        }
    }

    /**
     * Transfer USDC between accounts
     */
    private async transferUSDC(
        fromAccount: string,
        toAccount: string,
        amount: number
    ): Promise<TransactionResult> {
        try {
            console.log(`[HederaLoanService] Transferring ${amount} USDC from ${fromAccount} to ${toAccount}`);

            // Convert amount to smallest unit (assuming 2 decimals for USDC)
            const amountInSmallestUnit = Math.floor(amount * 100);

            // Create transfer transaction
            const transaction = new TransferTransaction()
                .addTokenTransfer(this.usdcTokenId, fromAccount, -amountInSmallestUnit)
                .addTokenTransfer(this.usdcTokenId, toAccount, amountInSmallestUnit)
                .setTransactionMemo(`Loan USDC transfer`)
                .freezeWith(this.client);

            // Sign and execute
            const signedTx = await transaction.sign(this.operatorKey);
            const txResponse = await signedTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status !== Status.Success) {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            const transactionId = txResponse.transactionId.toString();
            console.log(`  ✅ USDC transferred: ${transactionId}`);

            return {
                success: true,
                transactionId
            };

        } catch (error: any) {
            console.error('[HederaLoanService] Error transferring USDC:', error);
            return {
                success: false,
                error: error.message || 'Failed to transfer USDC'
            };
        }
    }

    /**
     * Get token price (placeholder - will be implemented with price oracle)
     */
    async getTokenPrice(tokenId: string): Promise<number> {
        // TODO: Implement real price oracle integration
        // For now, return a mock price based on token ID
        console.log(`[HederaLoanService] Getting price for token: ${tokenId}`);
        
        // Mock prices for testing
        if (tokenId.includes('USDC')) {
            return 1.0; // $1.00
        }
        
        // Default grove token price (will be replaced with marketplace data)
        return 10.0; // $10.00 per token
    }

    /**
     * Check if account has associated token
     */
    async isTokenAssociated(accountId: string, tokenId: string): Promise<boolean> {
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(this.client);

            return balance.tokens?.get(tokenId) !== undefined;
        } catch (error) {
            console.error('[HederaLoanService] Error checking token association:', error);
            return false;
        }
    }

    /**
     * Get account token balance
     */
    async getTokenBalance(accountId: string, tokenId: string): Promise<number> {
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(this.client);

            const tokenBalance = balance.tokens?.get(tokenId);
            return tokenBalance ? tokenBalance.toNumber() : 0;
        } catch (error) {
            console.error('[HederaLoanService] Error getting token balance:', error);
            return 0;
        }
    }

    /**
     * Close the Hedera client
     */
    close() {
        this.client.close();
    }
}

// Export singleton instance
export const hederaLoanService = new HederaLoanService();
