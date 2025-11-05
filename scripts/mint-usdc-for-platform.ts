#!/usr/bin/env ts-node
/**
 * Mint USDC tokens to platform treasury account
 * Run this to give your platform USDC to pay farmers
 */

import { 
    Client, 
    AccountId, 
    PrivateKey,
    TokenId,
    TokenMintTransaction,
    TransferTransaction
} from '@hashgraph/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function mintUSDC() {
    // Setup client
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromStringED25519(process.env.HEDERA_OPERATOR_KEY!);
    const network = process.env.NETWORK || 'testnet';
    
    const client = network === 'mainnet'
        ? Client.forMainnet()
        : Client.forTestnet();
    
    client.setOperator(operatorId, operatorKey);
    
    // USDC Token
    const usdcTokenId = TokenId.fromString(process.env.USDC_TOKEN_ID || '0.0.429274');
    
    console.log('🪙 Minting USDC Tokens');
    console.log('='.repeat(50));
    console.log(`Network: ${network}`);
    console.log(`USDC Token: ${usdcTokenId.toString()}`);
    console.log(`Platform Account: ${operatorId.toString()}`);
    console.log('');
    
    // Amount to mint (in smallest unit, 2 decimals for USDC)
    // Mint 100,000 USDC = 10,000,000 units (100,000 * 100)
    const amountToMint = 10_000_000; // 100,000 USDC
    
    console.log(`💰 Minting ${amountToMint / 100} USDC...`);
    
    try {
        // Mint tokens
        const mintTx = await new TokenMintTransaction()
            .setTokenId(usdcTokenId)
            .setAmount(amountToMint)
            .freezeWith(client);
        
        const mintTxSigned = await mintTx.sign(operatorKey);
        const mintTxResponse = await mintTxSigned.execute(client);
        const mintReceipt = await mintTxResponse.getReceipt(client);
        
        console.log(`✅ Minted successfully!`);
        console.log(`   Transaction: ${mintTxResponse.transactionId.toString()}`);
        console.log(`   New Total Supply: ${mintReceipt.totalSupply.toString()}`);
        console.log('');
        console.log(`🔗 View on HashScan:`);
        console.log(`   https://hashscan.io/${network}/transaction/${mintTxResponse.transactionId.toString()}`);
        console.log('');
        console.log(`✅ Platform account now has ${amountToMint / 100} USDC`);
        console.log(`   Ready to pay farmers! 💰`);
        
    } catch (error: any) {
        console.error('❌ Error minting USDC:', error.message);
        
        if (error.message.includes('INVALID_SIGNATURE')) {
            console.error('');
            console.error('⚠️  The operator account does not have the Supply Key!');
            console.error('   Only the account with the Supply Key can mint tokens.');
            console.error('   Supply Key: 4e4658983980d1b25a634eeeb26cb2b0f0e2e9c83263ba5b056798d35f2139a8');
        }
    }
    
    client.close();
}

mintUSDC().catch(console.error);
