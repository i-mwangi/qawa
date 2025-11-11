/**
 * Simple Transfer to Farmer
 * Transfers tokens assuming association is already done
 */

import { hederaTokenService } from '../lib/api/hedera-token-service.js';
import { db } from '../db/index.js';
import { coffeeGroves } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

async function simpleTransfer() {
    console.log('📤 Simple Token Transfer to Farmer\n');

    try {
        const groveId = process.argv[2];
        
        if (!groveId) {
            console.error('❌ Please provide grove ID');
            console.log('Usage: npx tsx scripts/simple-transfer-to-farmer.ts 4');
            process.exit(1);
        }

        const grove = await db.query.coffeeGroves.findFirst({
            where: eq(coffeeGroves.id, parseInt(groveId))
        });

        if (!grove) {
            console.error(`❌ Grove #${groveId} not found`);
            process.exit(1);
        }

        console.log(`Grove: ${grove.groveName}`);
        console.log(`Farmer: ${grove.farmerAddress}`);
        console.log(`Token: ${grove.tokenAddress}`);

        const availableTokens = (grove.totalTokensIssued || 0) - (grove.tokensSold || 0);
        
        console.log(`\n📊 Transferring ${availableTokens} tokens...`);

        const transferResult = await hederaTokenService.transferTokens(
            grove.tokenAddress!,
            grove.farmerAddress!,
            availableTokens
        );

        if (!transferResult.success) {
            console.error(`\n❌ Transfer failed: ${transferResult.error}`);
            
            if (transferResult.error?.includes('TOKEN_NOT_ASSOCIATED')) {
                console.log(`\n💡 The farmer needs to associate the token first:`);
                console.log(`   1. Open HashPack with account ${grove.farmerAddress}`);
                console.log(`   2. Go to Tokens tab`);
                console.log(`   3. Click "Associate Token"`);
                console.log(`   4. Enter token ID: ${grove.tokenAddress}`);
                console.log(`   5. Confirm transaction`);
                console.log(`   6. Run this script again`);
            }
            
            process.exit(1);
        }

        console.log(`\n✅ Transfer successful!`);
        console.log(`   Transaction: ${transferResult.transactionId}`);
        console.log(`   Amount: ${availableTokens} tokens`);
        console.log(`\n🎉 Farmer can now see tokens in HashPack!`);
        console.log(`\n🔍 Verify:`);
        console.log(`   https://hashscan.io/testnet/account/${grove.farmerAddress}`);

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

simpleTransfer();
