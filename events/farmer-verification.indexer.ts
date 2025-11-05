import { db } from "../db/index.js";
import { farmerVerifications, farmers, coffeeGroves } from "../db/schema/index.js";
import { farmerVerificationFireStore } from "../lib/stores.js";
import { indexFirestore } from "./utils.js";

console.log("STARTED FARMER VERIFICATION INDEXER");

await indexFirestore({
    contract: 'farmer-verification',
    processor: async (key, data) => {
        console.log("Processing farmer verification event:", key);
        console.log("Event data:", data);
        
        switch (data.type) {
            case "DocumentsSubmitted": {
                console.log("Farmer Documents Submitted", data);
                
                // Check if farmer verification record already exists
                const existing = await db.query.farmerVerifications.findFirst({
                    where: (fields, ops) => ops.eq(fields.farmerAddress, data.farmer)
                });
                
                if (existing) {
                    // Update existing record
                    await db.update(farmerVerifications)
                        .set({
                            documentsHash: data.documentsHash,
                            verificationStatus: "pending",
                            verifierAddress: null,
                            verificationDate: null,
                            rejectionReason: null,
                            createdAt: Math.floor(data.timestamp / 1000)
                        })
                        .where((fields, ops) => ops.eq(fields.id, existing.id));
                } else {
                    // Create new verification record
                    await db.insert(farmerVerifications).values({
                        farmerAddress: data.farmer,
                        documentsHash: data.documentsHash,
                        verificationStatus: "pending",
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                
                // Also update or create farmer record
                const existingFarmer = await db.query.farmers.findFirst({
                    where: (fields, ops) => ops.eq(fields.address, data.farmer)
                });
                
                if (existingFarmer) {
                    await db.update(farmers)
                        .set({
                            location: data.location,
                            verificationStatus: "pending"
                        })
                        .where((fields, ops) => ops.eq(fields.id, existingFarmer.id));
                } else {
                    await db.insert(farmers).values({
                        address: data.farmer,
                        location: data.location,
                        verificationStatus: "pending",
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "FarmerVerified": {
                console.log("Farmer Verified", data);
                
                // Update farmer verification record
                const existing = await db.query.farmerVerifications.findFirst({
                    where: (fields, ops) => ops.eq(fields.farmerAddress, data.farmer)
                });
                
                if (existing) {
                    await db.update(farmerVerifications)
                        .set({
                            verificationStatus: "verified",
                            verifierAddress: data.verifier,
                            verificationDate: Math.floor(data.timestamp / 1000),
                            rejectionReason: null
                        })
                        .where((fields, ops) => ops.eq(fields.id, existing.id));
                } else {
                    // Create new record if it doesn't exist
                    await db.insert(farmerVerifications).values({
                        farmerAddress: data.farmer,
                        verificationStatus: "verified",
                        verifierAddress: data.verifier,
                        verificationDate: Math.floor(data.timestamp / 1000),
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                
                // Update farmer record
                const existingFarmer = await db.query.farmers.findFirst({
                    where: (fields, ops) => ops.eq(fields.address, data.farmer)
                });
                
                if (existingFarmer) {
                    await db.update(farmers)
                        .set({
                            verificationStatus: "verified"
                        })
                        .where((fields, ops) => ops.eq(fields.id, existingFarmer.id));
                } else {
                    await db.insert(farmers).values({
                        address: data.farmer,
                        verificationStatus: "verified",
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "FarmerRejected": {
                console.log("Farmer Rejected", data);
                
                // Update farmer verification record
                const existing = await db.query.farmerVerifications.findFirst({
                    where: (fields, ops) => ops.eq(fields.farmerAddress, data.farmer)
                });
                
                if (existing) {
                    await db.update(farmerVerifications)
                        .set({
                            verificationStatus: "rejected",
                            verifierAddress: data.verifier,
                            verificationDate: Math.floor(data.timestamp / 1000),
                            rejectionReason: data.reason
                        })
                        .where((fields, ops) => ops.eq(fields.id, existing.id));
                } else {
                    // Create new record if it doesn't exist
                    await db.insert(farmerVerifications).values({
                        farmerAddress: data.farmer,
                        verificationStatus: "rejected",
                        verifierAddress: data.verifier,
                        verificationDate: Math.floor(data.timestamp / 1000),
                        rejectionReason: data.reason,
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                
                // Update farmer record
                const existingFarmer = await db.query.farmers.findFirst({
                    where: (fields, ops) => ops.eq(fields.address, data.farmer)
                });
                
                if (existingFarmer) {
                    await db.update(farmers)
                        .set({
                            verificationStatus: "rejected"
                        })
                        .where((fields, ops) => ops.eq(fields.id, existingFarmer.id));
                } else {
                    await db.insert(farmers).values({
                        address: data.farmer,
                        verificationStatus: "rejected",
                        createdAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "GroveOwnershipRegistered": {
                console.log("Grove Ownership Registered", data);
                
                // Update the grove record with ownership verification
                const grove = await db.query.coffeeGroves.findFirst({
                    where: (fields, ops) => ops.eq(fields.groveName, data.groveName)
                });
                
                if (grove) {
                    await db.update(coffeeGroves)
                        .set({
                            verificationStatus: "verified",
                            updatedAt: Math.floor(data.timestamp / 1000)
                        })
                        .where((fields, ops) => ops.eq(fields.id, grove.id));
                } else {
                    // Create grove record if it doesn't exist yet
                    await db.insert(coffeeGroves).values({
                        groveName: data.groveName,
                        farmerAddress: data.farmer,
                        location: "", // Will be updated when grove is registered
                        treeCount: 0, // Will be updated when grove is registered
                        coffeeVariety: "", // Will be updated when grove is registered
                        verificationStatus: "verified",
                        createdAt: Math.floor(data.timestamp / 1000),
                        updatedAt: Math.floor(data.timestamp / 1000)
                    });
                }
                break;
            }
            
            case "VerifierAdded": {
                console.log("Verifier Added", data);
                // This could be tracked in a separate verifiers table if needed
                // For now, just log it
                break;
            }
            
            case "VerifierRemoved": {
                console.log("Verifier Removed", data);
                // This could be tracked in a separate verifiers table if needed
                // For now, just log it
                break;
            }
            
            default: {
                console.log("Unknown farmer verification event type", data.type);
            }
        }
    },
    store: farmerVerificationFireStore
});

console.log("ENDED FARMER VERIFICATION INDEXER");