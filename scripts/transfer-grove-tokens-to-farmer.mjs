#!/usr/bin/env node

/**
 * Transfer Grove Tokens to Farmer
 * Use this after a farmer has associated their grove token
 */

import { Client, TransferTransaction, AccountId, TokenId, PrivateKey } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

// CONFIGURE THESE:
const FARMER_ACCOUNT = '0.0.YOUR_ACCOUNT_ID'; // Replace with farmer's account ID
const TOKEN_ID = '0.0.7149184'; // Replace with grove token ID
const AMOUNT = 1000; // Replace with amount to transfer (total supply or percentage)

async function transferTokensToFarmer() {
    console.log('\n📤 Transferring Grove Tokens to Farmer...\n');
    console.log(`Network: ${NETWORK}`);
    console.log(`From: ${OPERATOR_ID} (Platform Treasury)`);
    console.log(`To: ${FARMER_ACCOUNT} (Farmer)`);
    console.log(`Token: ${TOKEN_ID}`);
    console.log(`Amount: ${AMOUNT}\n`);

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
        console.log('🔍 Checking if farmer is associated with token...');
        
        // Check farmer's token balance (will show if associated)
        const { AccountBalanceQuery } = await import('@hashgraph/sdk');
        const balance = await new AccountBalanceQuery()
            .setAccountId(AccountId.fromString(FARMER_ACCOUNT))
            .execute(client);

        const tokenBalance = balance.tokens.get(TokenId.fromString(TOKEN_ID));
        
        if (tokenBalance === undefined) {
            console.error('❌ Farmer has NOT associated this token yet!');
            console.log('\n📋 Farmer needs to:');
            console.log('1. Open HashPack wallet');
            console.log('2. Go to Settings → Tokens');
            console.log(`3. Search for: ${TOKEN_ID}`);
            console.log('4. Click "Associate"');
            console.log('5. Run this script again\n');
            process.exit(1);
        }

        console.log(`✅ Farmer is associated. Current balance: ${tokenBalance.toString()}`);
        
        console.log('\n📤 Transferring tokens...');
        
        const transferTx = await new TransferTransaction()
            .addTokenTransfer(TOKEN_ID, OPERATOR_ID, -AMOUNT)
            .addTokenTransfer(TOKEN_ID, FARMER_ACCOUNT, AMOUNT)
            .setTransactionMemo(`Grove tokens for ${FARMER_ACCOUNT}`)
            .freezeWith(client);

        const transferSign = await transferTx.sign(operatorKey);
        const transferSubmit = await transferSign.execute(client);
        const transferReceipt = await transferSubmit.getReceipt(client);

        console.log('\n✅ Transfer Complete!');
        console.log(`Transaction ID: ${transferSubmit.transactionId.toString()}`);
        console.log(`Status: ${transferReceipt.status.toString()}`);
        console.log(`Amount: ${AMOUNT} tokens`);
        console.log(`Recipient: ${FARMER_ACCOUNT}`);
        
        console.log('\n🔗 View on HashScan:');
        console.log(`https://hashscan.io/${NETWORK}/transaction/${transferSubmit.transactionId.toString()}`);
        
        console.log('\n💡 Farmer can now see tokens in HashPack wallet!');
        console.log(`Token: ${TOKEN_ID}`);
        console.log(`Balance: ${AMOUNT}\n`);

    } catch (error) {
        console.error('\n❌ Error transferring tokens:', error);
        if (error.message) {
            console.error(`Message: ${error.message}`);
        }
        process.exit(1);
    }

    client.close();
}

transferTokensToFarmer();
