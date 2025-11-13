import { db } from '../../db/index.js';
import { coffeeGroves, tokenHoldings } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { recordTokenPurchase } from './transaction-recorder.js';
import { fundingPoolService } from './funding-pool-service.js';

/**
 * Helper function to convert BigInt values to numbers in an object
 */
function convertBigIntsToNumbers(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return Number(obj);
    if (Array.isArray(obj)) return obj.map(convertBigIntsToNumbers);
    if (typeof obj === 'object') {
        const converted: any = {};
        for (const key in obj) {
            converted[key] = convertBigIntsToNumbers(obj[key]);
        }
        return converted;
    }
    return obj;
}

/**
 * Token Purchase Service
 * Handles primary and secondary market token purchases
 */

export interface PurchaseResult {
    success: boolean;
    holding?: {
        id: number;
        holderAddress: string;
        groveId: number;
        tokenAmount: number;
        purchasePrice: number;
        purchaseDate: number;
    };
    availableTokens?: number;
    error?: string;
}

export interface TransferResult {
    success: boolean;
    transfer?: {
        groveId: number;
        fromAddress: string;
        toAddress: string;
        tokenAmount: number;
        transferPrice: number;
        transferDate: number;
    };
    error?: string;
}

export class TokenPurchaseService {
    /**
     * Purchase tokens from primary market (grove's available supply)
     */
    async purchaseTokensPrimary(params: {
        investorAddress: string;
        groveId: number;
        tokenAmount: number;
        paymentAmount: number;
    }): Promise<PurchaseResult> {
        const { investorAddress, groveId, tokenAmount, paymentAmount } = params;

        try {
            // Validate inputs
            if (tokenAmount <= 0) {
                return { success: false, error: 'Token amount must be greater than zero' };
            }
            if (paymentAmount <= 0) {
                return { success: false, error: 'Payment amount must be greater than zero' };
            }

            // Step 1: Validate grove exists and is tokenized
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                return { success: false, error: 'Grove not found' };
            }

            if (!grove.isTokenized) {
                return { success: false, error: 'Grove has not been tokenized' };
            }

            // Step 2: Check available tokens
            const totalTokensIssued = grove.totalTokensIssued || 0;
            const tokensSold = grove.tokensSold || 0;
            const availableTokens = totalTokensIssued - tokensSold;

            if (availableTokens < tokenAmount) {
                return { 
                    success: false, 
                    error: 'Insufficient tokens available',
                    availableTokens 
                };
            }

            // Step 3: Create or update token holding record
            // Use raw SQL to avoid Drizzle column name mapping issues
            const { sql } = await import('drizzle-orm');
            const existingHoldingResult = await db.all(sql`
                SELECT * FROM token_holdings 
                WHERE holderAddress = ${investorAddress}
                  AND groveId = ${groveId}
                  AND isActive = 1
                LIMIT 1
            `);
            const existingHolding = existingHoldingResult[0] as any;

            let holdingResult;
            const purchaseDate = Date.now();

            if (existingHolding) {
                // Update existing holding
                const newTokenAmount = existingHolding.tokenAmount + tokenAmount;
                const newTotalPrice = existingHolding.purchasePrice + paymentAmount;

                await db.run(sql`
                    UPDATE token_holdings 
                    SET tokenAmount = ${newTokenAmount},
                        purchasePrice = ${newTotalPrice}
                    WHERE id = ${existingHolding.id}
                `);

                holdingResult = {
                    id: existingHolding.id,
                    holderAddress: investorAddress,
                    groveId,
                    tokenAmount: newTokenAmount,
                    purchasePrice: newTotalPrice,
                    purchaseDate: existingHolding.purchaseDate
                };
            } else {
                // Create new holding using raw SQL
                const result = await db.run(sql`
                    INSERT INTO token_holdings (holderAddress, groveId, tokenAmount, purchasePrice, purchaseDate, isActive)
                    VALUES (${investorAddress}, ${groveId}, ${tokenAmount}, ${paymentAmount}, ${purchaseDate}, 1)
                `);
                
                const newId = Number(result.lastInsertRowid);

                holdingResult = {
                    id: newId,
                    holderAddress: investorAddress,
                    groveId,
                    tokenAmount,
                    purchasePrice: paymentAmount,
                    purchaseDate
                };
            }

            // Step 4: Update grove's tokensSold count
            const newTokensSold = tokensSold + tokenAmount;
            await db.update(coffeeGroves)
                .set({
                    tokensSold: newTokensSold,
                    updatedAt: Date.now()
                })
                .where(eq(coffeeGroves.id, groveId));

            // Step 5: Add investment to funding pool (40/30/30 split)
            await fundingPoolService.addInvestment(groveId, paymentAmount);

            // Step 6: Record transaction
            await recordTokenPurchase({
                buyerAddress: investorAddress,
                groveId: groveId,
                tokenAmount,
                paymentAmount,
                transactionType: 'primary'
            });

            console.log(`[TokenPurchase] Primary purchase completed: ${investorAddress} bought ${tokenAmount} tokens from grove ${groveId}`);

            return convertBigIntsToNumbers({
                success: true,
                holding: holdingResult,
                availableTokens: availableTokens - tokenAmount
            });

        } catch (error: any) {
            console.error('[TokenPurchase] Error in purchaseTokensPrimary:', error);
            return {
                success: false,
                error: error.message || 'Failed to purchase tokens'
            };
        }
    }

    /**
     * Transfer tokens between investors (secondary market)
     */
    async transferTokensSecondary(params: {
        sellerAddress: string;
        buyerAddress: string;
        groveId: number;
        tokenAmount: number;
        transferPrice: number;
    }): Promise<TransferResult> {
        const { sellerAddress, buyerAddress, groveId, tokenAmount, transferPrice } = params;

        try {
            // Validate inputs
            if (tokenAmount <= 0) {
                return { success: false, error: 'Transfer amount must be greater than zero' };
            }
            if (sellerAddress === buyerAddress) {
                return { success: false, error: 'Cannot transfer to same address' };
            }

            // Step 1: Validate seller has sufficient tokens (use raw SQL)
            const { sql } = await import('drizzle-orm');
            const sellerHoldingResult = await db.all(sql`
                SELECT * FROM token_holdings 
                WHERE holderAddress = ${sellerAddress}
                  AND groveId = ${groveId}
                  AND isActive = 1
                LIMIT 1
            `);
            const sellerHolding = sellerHoldingResult[0] as any;

            if (!sellerHolding) {
                return { success: false, error: 'Seller does not have token holdings' };
            }

            if (sellerHolding.tokenAmount < tokenAmount) {
                return { success: false, error: 'Seller has insufficient tokens' };
            }

            // Step 2: Reduce seller's token holding
            const newSellerAmount = sellerHolding.tokenAmount - tokenAmount;
            
            if (newSellerAmount === 0) {
                // Mark as inactive if no tokens left
                await db.run(sql`
                    UPDATE token_holdings 
                    SET tokenAmount = 0, isActive = 0
                    WHERE id = ${sellerHolding.id}
                `);
            } else {
                await db.run(sql`
                    UPDATE token_holdings 
                    SET tokenAmount = ${newSellerAmount}
                    WHERE id = ${sellerHolding.id}
                `);
            }

            // Step 3: Create or update buyer's token holding
            const buyerHoldingResult = await db.all(sql`
                SELECT * FROM token_holdings 
                WHERE holderAddress = ${buyerAddress}
                  AND groveId = ${groveId}
                  AND isActive = 1
                LIMIT 1
            `);
            const buyerHolding = buyerHoldingResult[0] as any;

            const transferDate = Date.now();

            if (buyerHolding) {
                // Update existing holding
                const newBuyerAmount = buyerHolding.tokenAmount + tokenAmount;
                const newBuyerPrice = buyerHolding.purchasePrice + transferPrice;

                await db.run(sql`
                    UPDATE token_holdings 
                    SET tokenAmount = ${newBuyerAmount},
                        purchasePrice = ${newBuyerPrice}
                    WHERE id = ${buyerHolding.id}
                `);
            } else {
                // Create new holding for buyer
                await db.run(sql`
                    INSERT INTO token_holdings (holderAddress, groveId, tokenAmount, purchasePrice, purchaseDate, isActive)
                    VALUES (${buyerAddress}, ${groveId}, ${tokenAmount}, ${transferPrice}, ${transferDate}, 1)
                `);
            }

            // Step 4: Record transaction for both parties
            await recordTokenPurchase({
                buyerAddress,
                groveId,
                tokenAmount,
                paymentAmount: transferPrice,
                transactionType: 'secondary',
                sellerAddress
            });

            console.log(`[TokenPurchase] Secondary transfer completed: ${sellerAddress} -> ${buyerAddress}, ${tokenAmount} tokens from grove ${groveId}`);

            return {
                success: true,
                transfer: {
                    groveId,
                    fromAddress: sellerAddress,
                    toAddress: buyerAddress,
                    tokenAmount,
                    transferPrice,
                    transferDate
                }
            };

        } catch (error: any) {
            console.error('[TokenPurchase] Error in transferTokensSecondary:', error);
            return {
                success: false,
                error: error.message || 'Failed to transfer tokens'
            };
        }
    }

    /**
     * Get available tokens for a grove
     */
    async getAvailableTokens(groveId: number): Promise<number> {
        try {
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                return 0;
            }

            const totalTokensIssued = grove.totalTokensIssued || 0;
            const tokensSold = grove.tokensSold || 0;
            
            return totalTokensIssued - tokensSold;

        } catch (error: any) {
            console.error('[TokenPurchase] Error in getAvailableTokens:', error);
            return 0;
        }
    }
}

// Export singleton instance
export const tokenPurchaseService = new TokenPurchaseService();
