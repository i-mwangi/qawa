import { db } from './index';
import { coffeeGroves, farmerVerifications, harvestRecords, tokenHoldings, revenueDistributions } from './schema';

export async function seedCoffeeData() {
  console.log('Seeding coffee tree data...');

  try {
    // Clear existing data
    await db.delete(revenueDistributions);
    await db.delete(tokenHoldings);
    await db.delete(harvestRecords);
    await db.delete(coffeeGroves);
    await db.delete(farmerVerifications);

    // Seed farmer verifications
    const farmerVerificationData = [
      {
        farmerAddress: '0x1234567890123456789012345678901234567890',
        verificationStatus: 'verified',
        documentsHash: 'QmX1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T',
        verifierAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        verificationDate: Date.now() - 86400000, // 1 day ago
        createdAt: Date.now() - 172800000 // 2 days ago
      },
      {
        farmerAddress: '0x2345678901234567890123456789012345678901',
        verificationStatus: 'verified',
        documentsHash: 'QmA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W',
        verifierAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        verificationDate: Date.now() - 259200000, // 3 days ago
        createdAt: Date.now() - 345600000 // 4 days ago
      },
      {
        farmerAddress: '0x3456789012345678901234567890123456789012',
        verificationStatus: 'pending',
        documentsHash: 'QmB2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X',
        createdAt: Date.now() - 86400000 // 1 day ago
      }
    ];

    await db.insert(farmerVerifications).values(farmerVerificationData);

    // Seed coffee groves
    const coffeeGroveData = [
      {
        groveName: 'Finca El Paraiso',
        farmerAddress: '0x1234567890123456789012345678901234567890',
        tokenAddress: '0x1111111111111111111111111111111111111111',
        location: 'Antigua, Guatemala',
        coordinatesLat: 14.5586,
        coordinatesLng: -90.7344,
        treeCount: 500,
        coffeeVariety: 'Arabica Bourbon',
        plantingDate: Date.now() - (365 * 24 * 60 * 60 * 1000 * 5), // 5 years ago
        expectedYieldPerTree: 2500, // grams per tree per year
        totalTokensIssued: 5000,
        tokensPerTree: 10,
        verificationStatus: 'verified',
        currentHealthScore: 85,
        createdAt: Date.now() - 172800000, // 2 days ago
        updatedAt: Date.now() - 86400000 // 1 day ago
      },
      {
        groveName: 'Hacienda La Esperanza',
        farmerAddress: '0x2345678901234567890123456789012345678901',
        tokenAddress: '0x2222222222222222222222222222222222222222',
        location: 'Huehuetenango, Guatemala',
        coordinatesLat: 15.3197,
        coordinatesLng: -91.4714,
        treeCount: 750,
        coffeeVariety: 'Arabica Caturra',
        plantingDate: Date.now() - (365 * 24 * 60 * 60 * 1000 * 3), // 3 years ago
        expectedYieldPerTree: 3000, // grams per tree per year
        totalTokensIssued: 7500,
        tokensPerTree: 10,
        verificationStatus: 'verified',
        currentHealthScore: 92,
        createdAt: Date.now() - 345600000, // 4 days ago
        updatedAt: Date.now() - 172800000 // 2 days ago
      },
      {
        groveName: 'Finca Monte Verde',
        farmerAddress: '0x1234567890123456789012345678901234567890',
        tokenAddress: '0x3333333333333333333333333333333333333333',
        location: 'Cobán, Guatemala',
        coordinatesLat: 15.4781,
        coordinatesLng: -90.3706,
        treeCount: 300,
        coffeeVariety: 'Arabica Typica',
        plantingDate: Date.now() - (365 * 24 * 60 * 60 * 1000 * 7), // 7 years ago
        expectedYieldPerTree: 2200, // grams per tree per year
        totalTokensIssued: 3000,
        tokensPerTree: 10,
        verificationStatus: 'verified',
        currentHealthScore: 78,
        createdAt: Date.now() - 259200000, // 3 days ago
        updatedAt: Date.now() - 86400000 // 1 day ago
      },
      {
        groveName: 'Plantación Nueva Vida',
        farmerAddress: '0x3456789012345678901234567890123456789012',
        location: 'Chimaltenango, Guatemala',
        coordinatesLat: 14.6569,
        coordinatesLng: -90.8158,
        treeCount: 200,
        coffeeVariety: 'Arabica Geisha',
        plantingDate: Date.now() - (365 * 24 * 60 * 60 * 1000 * 2), // 2 years ago
        expectedYieldPerTree: 1800, // grams per tree per year (lower yield, premium variety)
        verificationStatus: 'pending',
        currentHealthScore: 88,
        createdAt: Date.now() - 86400000, // 1 day ago
        updatedAt: Date.now() - 43200000 // 12 hours ago
      }
    ];

    const insertedGroves = await db.insert(coffeeGroves).values(coffeeGroveData).returning();

    // Seed harvest records for verified groves
    const harvestData = [
      {
        groveId: insertedGroves[0].id, // Finca El Paraiso
        harvestDate: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        yieldKg: 1200, // 1200 kg total harvest
        qualityGrade: 85, // Grade out of 100
        salePricePerKg: 450, // $4.50 per kg in cents
        totalRevenue: 540000, // $5,400 in cents
        farmerShare: 270000, // 50% to farmer
        investorShare: 270000, // 50% to investors
        revenueDistributed: true,
        transactionHash: '0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        createdAt: Date.now() - (29 * 24 * 60 * 60 * 1000)
      },
      {
        groveId: insertedGroves[1].id, // Hacienda La Esperanza
        harvestDate: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
        yieldKg: 2100, // 2100 kg total harvest
        qualityGrade: 92, // Premium grade
        salePricePerKg: 520, // $5.20 per kg in cents
        totalRevenue: 1092000, // $10,920 in cents
        farmerShare: 546000, // 50% to farmer
        investorShare: 546000, // 50% to investors
        revenueDistributed: true,
        transactionHash: '0xdef456ghi789jkl012mno345pqr678stu901vwx234yza567bc',
        createdAt: Date.now() - (44 * 24 * 60 * 60 * 1000)
      },
      {
        groveId: insertedGroves[0].id, // Finca El Paraiso - second harvest
        harvestDate: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
        yieldKg: 800, // Smaller second harvest
        qualityGrade: 88,
        salePricePerKg: 480, // $4.80 per kg in cents
        totalRevenue: 384000, // $3,840 in cents
        farmerShare: 192000, // 50% to farmer
        investorShare: 192000, // 50% to investors
        revenueDistributed: false, // Not yet distributed
        createdAt: Date.now() - (9 * 24 * 60 * 60 * 1000)
      }
    ];

    const insertedHarvests = await db.insert(harvestRecords).values(harvestData).returning();

    // Seed token holdings (investors)
    const tokenHoldingData = [
      // Investors in Finca El Paraiso
      {
        holderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        groveId: insertedGroves[0].id,
        tokenAmount: 1000, // 20% of total tokens
        purchasePrice: 50000, // $500 in cents
        purchaseDate: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
        isActive: true
      },
      {
        holderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        groveId: insertedGroves[0].id,
        tokenAmount: 1500, // 30% of total tokens
        purchasePrice: 75000, // $750 in cents
        purchaseDate: Date.now() - (55 * 24 * 60 * 60 * 1000), // 55 days ago
        isActive: true
      },
      {
        holderAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        groveId: insertedGroves[0].id,
        tokenAmount: 500, // 10% of total tokens
        purchasePrice: 25000, // $250 in cents
        purchaseDate: Date.now() - (40 * 24 * 60 * 60 * 1000), // 40 days ago
        isActive: true
      },
      // Investors in Hacienda La Esperanza
      {
        holderAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
        groveId: insertedGroves[1].id,
        tokenAmount: 2250, // 30% of total tokens
        purchasePrice: 112500, // $1,125 in cents
        purchaseDate: Date.now() - (70 * 24 * 60 * 60 * 1000), // 70 days ago
        isActive: true
      },
      {
        holderAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        groveId: insertedGroves[1].id,
        tokenAmount: 1500, // 20% of total tokens
        purchasePrice: 75000, // $750 in cents
        purchaseDate: Date.now() - (65 * 24 * 60 * 60 * 1000), // 65 days ago
        isActive: true
      }
    ];

    await db.insert(tokenHoldings).values(tokenHoldingData);

    // Seed revenue distributions for the first harvest
    const revenueDistributionData = [
      // Distributions for Finca El Paraiso first harvest
      {
        harvestId: insertedHarvests[0].id,
        holderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        tokenAmount: 1000,
        revenueShare: 54000, // 20% of investor share (270000 * 0.2)
        distributionDate: Date.now() - (28 * 24 * 60 * 60 * 1000),
        transactionHash: '0x111222333444555666777888999aaabbbcccdddeee'
      },
      {
        harvestId: insertedHarvests[0].id,
        holderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        tokenAmount: 1500,
        revenueShare: 81000, // 30% of investor share (270000 * 0.3)
        distributionDate: Date.now() - (28 * 24 * 60 * 60 * 1000),
        transactionHash: '0x222333444555666777888999aaabbbcccdddeee111'
      },
      {
        harvestId: insertedHarvests[0].id,
        holderAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        tokenAmount: 500,
        revenueShare: 27000, // 10% of investor share (270000 * 0.1)
        distributionDate: Date.now() - (28 * 24 * 60 * 60 * 1000),
        transactionHash: '0x333444555666777888999aaabbbcccdddeee111222'
      },
      // Distributions for Hacienda La Esperanza harvest
      {
        harvestId: insertedHarvests[1].id,
        holderAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
        tokenAmount: 2250,
        revenueShare: 163800, // 30% of investor share (546000 * 0.3)
        distributionDate: Date.now() - (43 * 24 * 60 * 60 * 1000),
        transactionHash: '0x444555666777888999aaabbbcccdddeee111222333'
      },
      {
        harvestId: insertedHarvests[1].id,
        holderAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenAmount: 1500,
        revenueShare: 109200, // 20% of investor share (546000 * 0.2)
        distributionDate: Date.now() - (43 * 24 * 60 * 60 * 1000),
        transactionHash: '0x555666777888999aaabbbcccdddeee111222333444'
      }
    ];

    await db.insert(revenueDistributions).values(revenueDistributionData);

    console.log('✅ Coffee tree seed data inserted successfully!');
    console.log(`📊 Seeded data summary:`);
    console.log(`   - ${farmerVerificationData.length} farmer verifications`);
    console.log(`   - ${coffeeGroveData.length} coffee groves`);
    console.log(`   - ${harvestData.length} harvest records`);
    console.log(`   - ${tokenHoldingData.length} token holdings`);
    console.log(`   - ${revenueDistributionData.length} revenue distributions`);

  } catch (error) {
    console.error('❌ Error seeding coffee tree data:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedCoffeeData()
    .then(() => {
      console.log('🌱 Coffee tree database seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}