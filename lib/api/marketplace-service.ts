/**
 * Marketplace Service
 * Handles peer-to-peer trading of coffee grove tokens
 */

import { Client, ContractExecuteTransaction, ContractCallQuery, ContractFunctionParameters, AccountId, PrivateKey } from '@hashgraph/sdk';

export class MarketplaceService {
    private client: Client;
    private marketplaceContractId: string;
    private usdcTokenId: string;

    constructor() {
        // Initialize Hedera client
        const operatorId = process.env.HEDERA_OPERATOR_ID;
        const operatorKey = process.env.HEDERA_OPERATOR_KEY;
        const network = process.env.HEDERA_NETWORK || 'testnet';

        if (network === 'mainnet') {
            this.client = Client.forMainnet();
        } else {
            this.client = Client.forTestnet();
        }

        if (operatorId && operatorKey) {
            this.client.setOperator(
                AccountId.fromString(operatorId),
                PrivateKey.fromString(operatorKey)
            );
        }

        this.marketplaceContractId = process.env.MARKETPLACE_CONTRACT_ID || '';
        this.usdcTokenId = process.env.USDC_TOKEN_ID || '';

        if (!this.marketplaceContractId) {
            console.warn('⚠️  MARKETPLACE_CONTRACT_ID not set - marketplace will not function');
        }
    }

    /**
     * List tokens for sale on the marketplace
     */
    async listTokensForSale(
        sellerAccountId: string,
        tokenAddress: string,
        groveName: string,
        tokenAmount: number,
        pricePerToken: number,
        durationDays: number
    ): Promise<{ success: boolean; listingId?: number; transactionId?: string; error?: string }> {
        try {
            if (!this.marketplaceContractId) {
                throw new Error('Marketplace contract not configured');
            }

            console.log(`[Marketplace] Listing tokens for sale:`, {
                seller: sellerAccountId,
                token: tokenAddress,
                grove: groveName,
                amount: tokenAmount,
                price: pricePerToken,
                duration: durationDays
            });

            // Create contract execute transaction
            const transaction = new ContractExecuteTransaction()
                .setContractId(this.marketplaceContractId)
                .setGas(500000)
                .setFunction(
                    'listTokensForSale',
                    new ContractFunctionParameters()
                        .addAddress(tokenAddress)
                        .addString(groveName)
                        .addUint64(tokenAmount)
                        .addUint64(pricePerToken)
                        .addUint256(durationDays)
                );

            // Execute transaction
            const txResponse = await transaction.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Transaction failed: ${receipt.status.toString()}`);
            }

            // Get listing ID from contract logs (simplified - in production parse logs)
            const record = await txResponse.getRecord(this.client);
            
            console.log(`✅ Tokens listed successfully`);

            return {
                success: true,
                transactionId: txResponse.transactionId.toString(),
                listingId: Date.now() // Simplified - should parse from event logs
            };

        } catch (error: any) {
            console.error('[Marketplace] Error listing tokens:', error);
            return {
                success: false,
                error: error.message || 'Failed to list tokens'
            };
        }
    }

    /**
     * Purchase tokens from a marketplace listing
     */
    async purchaseTokens(
        buyerAccountId: string,
        listingId: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            if (!this.marketplaceContractId) {
                throw new Error('Marketplace contract not configured');
            }

            console.log(`[Marketplace] Purchasing tokens:`, {
                buyer: buyerAccountId,
                listingId
            });

            // Create contract execute transaction
            const transaction = new ContractExecuteTransaction()
                .setContractId(this.marketplaceContractId)
                .setGas(500000)
                .setFunction(
                    'purchaseTokens',
                    new ContractFunctionParameters()
                        .addUint256(listingId)
                );

            // Execute transaction
            const txResponse = await transaction.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Transaction failed: ${receipt.status.toString()}`);
            }

            console.log(`✅ Tokens purchased successfully`);

            return {
                success: true,
                transactionId: txResponse.transactionId.toString()
            };

        } catch (error: any) {
            console.error('[Marketplace] Error purchasing tokens:', error);
            return {
                success: false,
                error: error.message || 'Failed to purchase tokens'
            };
        }
    }

    /**
     * Cancel a token listing
     */
    async cancelListing(
        sellerAccountId: string,
        listingId: number
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            if (!this.marketplaceContractId) {
                throw new Error('Marketplace contract not configured');
            }

            console.log(`[Marketplace] Cancelling listing:`, {
                seller: sellerAccountId,
                listingId
            });

            const transaction = new ContractExecuteTransaction()
                .setContractId(this.marketplaceContractId)
                .setGas(300000)
                .setFunction(
                    'cancelListing',
                    new ContractFunctionParameters()
                        .addUint256(listingId)
                );

            const txResponse = await transaction.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Transaction failed: ${receipt.status.toString()}`);
            }

            console.log(`✅ Listing cancelled successfully`);

            return {
                success: true,
                transactionId: txResponse.transactionId.toString()
            };

        } catch (error: any) {
            console.error('[Marketplace] Error cancelling listing:', error);
            return {
                success: false,
                error: error.message || 'Failed to cancel listing'
            };
        }
    }

    /**
     * Get active marketplace listings
     */
    async getActiveListings(offset: number = 0, limit: number = 50): Promise<any[]> {
        try {
            if (!this.marketplaceContractId) {
                console.warn('[Marketplace] Contract not configured, returning mock data');
                return this.getMockListings();
            }

            const query = new ContractCallQuery()
                .setContractId(this.marketplaceContractId)
                .setGas(100000)
                .setFunction(
                    'getActiveListings',
                    new ContractFunctionParameters()
                        .addUint256(offset)
                        .addUint256(limit)
                );

            const result = await query.execute(this.client);
            
            // Parse result (simplified - needs proper ABI decoding)
            const listings = this.parseListingsResult(result);
            
            return listings;

        } catch (error) {
            console.error('[Marketplace] Error fetching listings:', error);
            return this.getMockListings();
        }
    }

    /**
     * Get user's active listings
     */
    async getUserListings(userAccountId: string): Promise<any[]> {
        try {
            if (!this.marketplaceContractId) {
                return [];
            }

            const query = new ContractCallQuery()
                .setContractId(this.marketplaceContractId)
                .setGas(100000)
                .setFunction(
                    'getUserListings',
                    new ContractFunctionParameters()
                        .addAddress(userAccountId)
                );

            const result = await query.execute(this.client);
            return this.parseListingsResult(result);

        } catch (error) {
            console.error('[Marketplace] Error fetching user listings:', error);
            return [];
        }
    }

    /**
     * Get user's trade history
     */
    async getUserTrades(userAccountId: string): Promise<any[]> {
        try {
            if (!this.marketplaceContractId) {
                return [];
            }

            const query = new ContractCallQuery()
                .setContractId(this.marketplaceContractId)
                .setGas(100000)
                .setFunction(
                    'getUserTrades',
                    new ContractFunctionParameters()
                        .addAddress(userAccountId)
                );

            const result = await query.execute(this.client);
            return this.parseTradesResult(result);

        } catch (error) {
            console.error('[Marketplace] Error fetching user trades:', error);
            return [];
        }
    }

    /**
     * Get marketplace statistics
     */
    async getMarketplaceStats(): Promise<{
        totalListings: number;
        activeListings: number;
        totalTrades: number;
        totalVolume: number;
    }> {
        try {
            if (!this.marketplaceContractId) {
                return {
                    totalListings: 3,
                    activeListings: 3,
                    totalTrades: 12,
                    totalVolume: 125000
                };
            }

            const query = new ContractCallQuery()
                .setContractId(this.marketplaceContractId)
                .setGas(100000)
                .setFunction('getMarketplaceStats');

            const result = await query.execute(this.client);
            
            // Parse stats (simplified)
            return {
                totalListings: 0,
                activeListings: 0,
                totalTrades: 0,
                totalVolume: 0
            };

        } catch (error) {
            console.error('[Marketplace] Error fetching stats:', error);
            return {
                totalListings: 0,
                activeListings: 0,
                totalTrades: 0,
                totalVolume: 0
            };
        }
    }

    /**
     * Parse listings result from contract query
     */
    private parseListingsResult(result: any): any[] {
        // Simplified parser - in production, use proper ABI decoding
        // For now, return mock data
        return this.getMockListings();
    }

    /**
     * Parse trades result from contract query
     */
    private parseTradesResult(result: any): any[] {
        // Simplified parser
        return [];
    }

    /**
     * Get mock listings for development/fallback
     */
    private getMockListings(): any[] {
        return [
            {
                id: '1',
                listingId: 1,
                groveName: 'Yirgacheffe Estate',
                sellerAddress: '0.0.7147851',
                tokenAddress: '0.0.7201461',
                tokenAmount: 10,
                pricePerToken: 28.00,
                originalPrice: 25.00,
                listingDate: new Date('2024-12-01').toISOString(),
                expirationDate: new Date('2024-12-31').toISOString(),
                coffeeVariety: 'Arabica',
                location: 'Ethiopia, Yirgacheffe',
                healthScore: 85,
                isActive: true
            },
            {
                id: '2',
                listingId: 2,
                groveName: 'Mount Elgon Grove',
                sellerAddress: '0.0.7149114',
                tokenAddress: '0.0.7201462',
                tokenAmount: 5,
                pricePerToken: 32.00,
                originalPrice: 30.00,
                listingDate: new Date('2024-12-05').toISOString(),
                expirationDate: new Date('2024-12-31').toISOString(),
                coffeeVariety: 'Bourbon',
                location: 'Uganda, Mbale',
                healthScore: 92,
                isActive: true
            }
        ];
    }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();
