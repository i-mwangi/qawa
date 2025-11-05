#!/usr/bin/env node

/**
 * Complete a pending withdrawal where LP tokens were burned but USDC wasn't sent
 * Use this when a user's withdrawal failed due to USDC not being associated
 */

import { Client, TransferTransaction, AccountId, PrivateKey } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const USDC_TOKEN_ID = process.env.USDC_TOKEN_ID;
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

// User who needs to receive USDC
const USER_ACCOUNT = '0.0.6967933'; // Replace with actual user account
const USDC_AMOUNT = 105000; // Amount to send (100000 principal + 5000 interest)

async function completePendingWithdrawal() {
    console.log('\n💰 Completing Pending Withdrawal...\n');
    console.log(`Network: ${NETWORK}`);
    console.log(`From: ${OPERATOR_ID}`);
    console.log(`To: ${USER_ACCOUNT}`);
    console.log(`Amount: ${USDC_AMOUNT} USDC\n`);

    if (!OPERATOR_ID || !OPERATOR_KEY || !USDC_TOKEN_ID) {
        console.error('❌ Error: Required environment variables not set');
        process.exit(1);
    }

    // Create client
    const client = NETWORK === 'mainnet'
        ? Client.forMainnet()
        : Client.forTestnet();

    const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
    client.setOperator(AccountId.fromString(OPERATOR_ID), operatorKey);

    try {
        console.log('📤 Sending USDC to user...');
        
        const transferTx = await new TransferTransaction()
            .addTokenTransfer(USDC_TOKEN_ID, OPERATOR_ID, -USDC_AMOUNT)
            .addTokenTransfer(USDC_TOKEN_ID, USER_ACCOUNT, USDC_AMOUNT)
            .setTransactionMemo(`Completing withdrawal for ${USER_ACCOUNT}`)
            .freezeWith(client);

        const transferSign = await transferTx.sign(operatorKey);
        const transferSubmit = await transferSign.execute(client);
        const transferReceipt = await transferSubmit.getReceipt(client);

        console.log('\n✅ USDC Transfer Complete!');
        console.log(`Transaction ID: ${transferSubmit.transactionId.toString()}`);
        console.log(`Status: ${transferReceipt.status.toString()}`);
        console.log(`Amount: ${USDC_AMOUNT} USDC`);
        console.log(`Recipient: ${USER_ACCOUNT}`);
        
        console.log('\n🔗 View on HashScan:');
        console.log(`https://hashscan.io/${NETWORK}/transaction/${transferSubmit.transactionId.toString()}`);
        
        console.log('\n✅ Withdrawal completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Error completing withdrawal:', error);
        if (error.message) {
            console.error(`Message: ${error.message}`);
        }
        process.exit(1);
    }

    client.close();
}

completePendingWithdrawal();
