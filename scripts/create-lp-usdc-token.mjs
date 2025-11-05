#!/usr/bin/env node

/**
 * Create LP-USDC Token for Lending Pool
 * This creates the liquidity provider token for the USDC lending pool
 */

import { Client, TokenCreateTransaction, TokenType, TokenSupplyType, Hbar, PrivateKey, AccountId } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || process.env.HEDERA_ACCOUNT_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || process.env.HEDERA_PRIVATE_KEY;
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

async function createLPToken() {
    console.log('\n🏦 Creating LP-USDC Token for Lending Pool...\n');
    console.log(`Network: ${NETWORK}`);
    console.log(`Operator: ${OPERATOR_ID}\n`);

    if (!OPERATOR_ID || !OPERATOR_KEY) {
        console.error('❌ Error: HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env');
        process.exit(1);
    }

    // Create client
    const client = NETWORK === 'mainnet'
        ? Client.forMainnet()
        : Client.forTestnet();

    const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
    client.setOperator(AccountId.fromString(OPERATOR_ID), operatorKey);

    try {
        // Create LP token
        console.log('Creating LP-USDC token...');
        
        const tokenCreateTx = await new TokenCreateTransaction()
            .setTokenName('USDC Liquidity Pool Token')
            .setTokenSymbol('LP-USDC')
            .setDecimals(2) // 2 decimals like USDC
            .setInitialSupply(0) // Start with 0, mint on demand
            .setTreasuryAccountId(AccountId.fromString(OPERATOR_ID))
            .setSupplyType(TokenSupplyType.Infinite) // Can mint more as needed
            .setTokenType(TokenType.FungibleCommon)
            .setSupplyKey(operatorKey) // Needed to mint/burn
            .setAdminKey(operatorKey) // Needed to manage token
            .setMaxTransactionFee(new Hbar(20))
            .freezeWith(client);

        const tokenCreateSign = await tokenCreateTx.sign(operatorKey);
        const tokenCreateSubmit = await tokenCreateSign.execute(client);
        const tokenCreateReceipt = await tokenCreateSubmit.getReceipt(client);
        const tokenId = tokenCreateReceipt.tokenId;

        console.log('\n✅ LP-USDC Token Created Successfully!');
        console.log(`Token ID: ${tokenId.toString()}`);
        console.log(`Token Name: USDC Liquidity Pool Token`);
        console.log(`Token Symbol: LP-USDC`);
        console.log(`Decimals: 2`);
        console.log(`Initial Supply: 0`);
        console.log(`Supply Type: Infinite (mintable)`);
        console.log(`Treasury: ${OPERATOR_ID}`);
        
        console.log('\n📋 Add this to your .env file:');
        console.log(`LP_USDC_TOKEN_ID=${tokenId.toString()}`);
        
        console.log('\n🔗 View on HashScan:');
        console.log(`https://hashscan.io/${NETWORK}/token/${tokenId.toString()}`);
        
        console.log('\n💡 Next Steps:');
        console.log('1. Add LP_USDC_TOKEN_ID to .env file');
        console.log('2. Restart your server');
        console.log('3. Users must associate this token before receiving LP tokens');
        console.log('4. Test by providing liquidity to USDC pool\n');

    } catch (error) {
        console.error('\n❌ Error creating LP token:', error);
        if (error.message) {
            console.error('Error message:', error.message);
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

createLPToken()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
