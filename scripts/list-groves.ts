/**
 * List All Groves
 * Shows grove IDs and details
 */

import { db } from '../db/index.js';
import { coffeeGroves } from '../db/schema/index.js';
import { desc } from 'drizzle-orm';

async function listGroves() {
    console.log('📋 Listing all groves...\n');

    try {
        const groves = await db.query.coffeeGroves.findMany({
            orderBy: [desc(coffeeGroves.id)]
        });

        if (groves.length === 0) {
            console.log('No groves found');
            return;
        }

        console.log(`Found ${groves.length} groves:\n`);

        for (const grove of groves) {
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Grove ID: ${grove.id}`);
            console.log(`Name: ${grove.groveName}`);
            console.log(`Farmer: ${grove.farmerAddress}`);
            console.log(`Trees: ${grove.treeCount}`);
            console.log(`Tokenized: ${grove.isTokenized ? 'Yes' : 'No'}`);
            
            if (grove.isTokenized) {
                console.log(`Token ID: ${grove.tokenAddress}`);
                console.log(`Token Symbol: ${grove.tokenSymbol}`);
                console.log(`Total Tokens: ${grove.totalTokensIssued}`);
                console.log(`Tokens Sold: ${grove.tokensSold || 0}`);
                console.log(`Available: ${(grove.totalTokensIssued || 0) - (grove.tokensSold || 0)}`);
            }
            
            console.log('');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

listGroves();
