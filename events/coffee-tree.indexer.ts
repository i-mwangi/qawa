import { db } from "../db/index.js";
import { 
    coffeeGroves, 
    harvestRecords, 
    tokenHoldings, 
    revenueDistributions, 
    farmerVerifications,
    treeHealthRecords,
    environmentalAlerts
} from "../db/schema/index.js";
import { coffeeTreeFireStore } from "../lib/stores.js";
import { indexFirestore } from "./utils.js";
import { generateId } from "../lib/utils.js";

console.log("STARTED COFFEE TREE INDEXER");

await indexFirestore({
    contract: 'coffee-tree-issuer',
    processor: async (key, data) => {
        console.log("Processing coffee tree event:", key);
        console.log("Event data:", data);
        
        switch (data.type) {
            case "CoffeeGroveRegistered": {
                console.log("Coffee Grove Registered", data);
                
                // Extract grove name from bytes32
                const groveName = data.groveName || "";
                
                await db.insert(coffeeGroves).values({
                    groveName: groveName,
                    farmerAddress: data.farmer,
                    location: data.location || "",
                    treeCount: Number(data.treeCount) || 0,
                    coffeeVariety: data.coffeeVariety || "",
                    verificationStatus: "verified", // Assume verified since they can register
                    createdAt: Math.floor(data.timestamp / 1000),
                    updatedAt: Math.floor(data.timestamp / 1000)
                });
                break;
            }
            
            case "CoffeeGroveTokenized": {
                console.log("Coffee Grove Tokenized", data);
                
                const groveName = data.groveName || "";
                
                // Update existing grove with tokenization data
                const existingGrove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.groveName, groveName)
                });
                
                if (existingGrove) {
                    await db.update(coffeeGroves)
                        .set({
                            tokenAddress: data.token,
                            totalTokensIssued: Number(data.totalTokens) || 0,
                            tokensPerTree: Number(data.tokensPerTree) || 0,
                            updatedAt: Math.floor(data.timestamp / 1000)
                        })
                        .where((fields, ops) => ops.eq(fields.id, existingGrove.id));
                }
                break;
            }
            
            case "TreeTokensPurchased": {
                console.log("Tree Tokens Purchased", data);
                
                // Find the grove by token address
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.tokenAddress, data.grove)
                });
                
                if (grove) {
                    await db.insert(tokenHoldings).values({
                        holderAddress: data.investor,
                        groveId: grove.id,
                        tokenAmount: Number(data.amount) || 0,
                        purchasePrice: Number(data.totalCost) || 0,
                        purchaseDate: Math.floor(data.timestamp / 1000),
                        isActive: true
                    });
                }
                break;
            }
            
            case "TreeTokensSold": {
                console.log("Tree Tokens Sold", data);
                
                // Find the grove by token address
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.tokenAddress, data.grove)
                });
                
                if (grove) {
                    // Mark tokens as inactive (sold)
                    const existingHolding = await db.query.tokenHoldings.findFirst({
                        where: (fields, ops) => ops.and(
                            ops.eq(fields.holderAddress, data.seller),
                            ops.eq(fields.groveId, grove.id),
                            ops.eq(fields.isActive, true)
                        )
                    });
                    
                    if (existingHolding) {
                        // Update the holding to reduce token amount or mark as inactive
                        const remainingTokens = existingHolding.tokenAmount - Number(data.amount);
                        if (remainingTokens <= 0) {
                            await db.update(tokenHoldings)
                                .set({ isActive: false })
                                .where((fields, ops) => ops.eq(fields.id, existingHolding.id));
                        } else {
                            await db.update(tokenHoldings)
                                .set({ tokenAmount: remainingTokens })
                                .where((fields, ops) => ops.eq(fields.id, existingHolding.id));
                        }
                    }
                }
                break;
            }
            
            case "HarvestReported": {
                console.log("Harvest Reported", data);
                
                const groveName = data.groveName || "";
                
                // Find the grove
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.groveName, groveName)
                });
                
                if (grove) {
                    await db.insert(harvestRecords).values({
                        groveId: grove.id,
                        harvestDate: Math.floor(data.harvestDate || data.timestamp / 1000),
                        yieldKg: Number(data.yieldKg) || 0,
                        qualityGrade: Number(data.qualityGrade) || 0,
                        salePricePerKg: 0, // Will be updated when revenue is calculated
                        totalRevenue: Number(data.totalRevenue) || 0,
                        farmerShare: 0, // Will be calculated during distribution
                        investorShare: 0, // Will be calculated during distribution
                        revenueDistributed: false,
                        transactionHash: data.hash,
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "RevenueCalculated": {
                console.log("Revenue Calculated", data);
                
                const groveName = data.groveName || "";
                const harvestIndex = Number(data.harvestIndex) || 0;
                
                // Find the grove
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.groveName, groveName)
                });
                
                if (grove) {
                    // Find the harvest record by grove and index (approximate)
                    const harvests = await db.query.harvestRecords.findMany({
                        where: (fields, ops) => ops.eq(fields.groveId, grove.id),
                        orderBy: (fields, ops) => ops.asc(fields.createdAt)
                    });
                    
                    if (harvests[harvestIndex]) {
                        await db.update(harvestRecords)
                            .set({
                                totalRevenue: Number(data.totalRevenue) || 0,
                                farmerShare: Number(data.farmerShare) || 0,
                                investorShare: Number(data.investorShare) || 0
                            })
                            .where((fields, ops) => ops.eq(fields.id, harvests[harvestIndex].id));
                    }
                }
                break;
            }
            
            case "RevenueDistributed": {
                console.log("Revenue Distributed", data);
                
                const groveName = data.groveName || "";
                const harvestIndex = Number(data.harvestIndex) || 0;
                
                // Find the grove
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.groveName, groveName)
                });
                
                if (grove) {
                    // Find the harvest record
                    const harvests = await db.query.harvestRecords.findMany({
                        where: (fields, ops) => ops.eq(fields.groveId, grove.id),
                        orderBy: (fields, ops) => ops.asc(fields.createdAt)
                    });
                    
                    if (harvests[harvestIndex]) {
                        // Mark harvest as distributed
                        await db.update(harvestRecords)
                            .set({
                                revenueDistributed: true,
                                transactionHash: data.hash
                            })
                            .where((fields, ops) => ops.eq(fields.id, harvests[harvestIndex].id));
                        
                        // Get all token holders for this grove
                        const holders = await db.query.tokenHoldings.findMany({
                            where: (fields, ops) => ops.and(
                                ops.eq(fields.groveId, grove.id),
                                ops.eq(fields.isActive, true)
                            )
                        });
                        
                        // Create revenue distribution records for each holder
                        const totalTokens = holders.reduce((sum, holder) => sum + holder.tokenAmount, 0);
                        const investorShare = Number(data.investorShare) || 0;
                        
                        for (const holder of holders) {
                            const holderShare = totalTokens > 0 
                                ? Math.floor((holder.tokenAmount / totalTokens) * investorShare)
                                : 0;
                            
                            if (holderShare > 0) {
                                await db.insert(revenueDistributions).values({
                                    harvestId: harvests[harvestIndex].id,
                                    holderAddress: holder.holderAddress,
                                    tokenAmount: holder.tokenAmount,
                                    revenueShare: holderShare,
                                    distributionDate: Math.floor(data.timestamp / 1000),
                                    transactionHash: data.hash
                                });
                            }
                        }
                    }
                }
                break;
            }
            
            case "HarvestValidationFailed": {
                console.log("Harvest Validation Failed", data);
                
                // Log validation failures for monitoring
                // Could be stored in a separate validation_failures table if needed
                console.warn(`Harvest validation failed for grove ${data.groveName}: ${data.reason}`);
                break;
            }
            
            default: {
                console.log("Unknown coffee tree event type", data.type);
            }
        }
    },
    store: coffeeTreeFireStore
});

console.log("ENDED COFFEE TREE INDEXER");