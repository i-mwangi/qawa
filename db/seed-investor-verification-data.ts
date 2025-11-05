import { db } from './index';
import { investorVerifications, investorVerificationHistory, investorProfiles } from './schema';

// Force-disable KYC for local/demo runs. To restore behavior, use the
// environment variable `DISABLE_INVESTOR_KYC` and parse it instead.
const DISABLE_INVESTOR_KYC = true

export async function seedInvestorVerificationData() {
  console.log('Seeding investor verification data...');

  try {
    // Clear existing data
    await db.delete(investorVerificationHistory);
    await db.delete(investorVerifications);
    await db.delete(investorProfiles);

    // Seed investor profiles first
    const investorProfileData = [
      {
        investorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        name: 'Alice Johnson',
        email: 'alice.johnson@email.com',
        phone: '+1-555-0101',
        country: 'United States',
        investorType: 'individual',
        riskTolerance: 'medium',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Central America', 'South America'],
          maxInvestmentAmount: 50000,
          sustainabilityFocus: true,
          preferredVarieties: ['Arabica']
        }),
        createdAt: Date.now() - (90 * 24 * 60 * 60 * 1000), // 90 days ago
        updatedAt: Date.now() - (30 * 24 * 60 * 60 * 1000)  // 30 days ago
      },
      {
        investorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        name: 'Bob Smith',
        email: 'bob.smith@email.com',
        phone: '+1-555-0102',
        country: 'Canada',
        investorType: 'accredited',
        riskTolerance: 'high',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Africa', 'Asia'],
          maxInvestmentAmount: 200000,
          sustainabilityFocus: false,
          preferredVarieties: ['Arabica', 'Robusta']
        }),
        createdAt: Date.now() - (120 * 24 * 60 * 60 * 1000), // 120 days ago
        updatedAt: Date.now() - (15 * 24 * 60 * 60 * 1000)   // 15 days ago
      },
      {
        investorAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        name: 'Carol Davis',
        email: 'carol.davis@email.com',
        phone: '+44-20-7946-0958',
        country: 'United Kingdom',
        investorType: 'individual',
        riskTolerance: 'low',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Central America'],
          maxInvestmentAmount: 25000,
          sustainabilityFocus: true,
          preferredVarieties: ['Arabica']
        }),
        createdAt: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
        updatedAt: Date.now() - (10 * 24 * 60 * 60 * 1000)  // 10 days ago
      },
      {
        investorAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
        name: 'David Wilson',
        email: 'david.wilson@email.com',
        phone: '+1-555-0104',
        country: 'United States',
        investorType: 'institutional',
        riskTolerance: 'medium',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Global'],
          maxInvestmentAmount: 1000000,
          sustainabilityFocus: true,
          preferredVarieties: ['Arabica', 'Specialty']
        }),
        createdAt: Date.now() - (150 * 24 * 60 * 60 * 1000), // 150 days ago
        updatedAt: Date.now() - (5 * 24 * 60 * 60 * 1000)    // 5 days ago
      },
      {
        investorAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        name: 'Eva Martinez',
        email: 'eva.martinez@email.com',
        phone: '+34-91-123-4567',
        country: 'Spain',
        investorType: 'individual',
        riskTolerance: 'medium',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Central America', 'South America'],
          maxInvestmentAmount: 75000,
          sustainabilityFocus: true,
          preferredVarieties: ['Arabica']
        }),
        createdAt: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: Date.now() - (2 * 24 * 60 * 60 * 1000)   // 2 days ago
      },
      {
        investorAddress: '0xffffffffffffffffffffffffffffffffffffffff',
        name: 'Frank Thompson',
        email: 'frank.thompson@email.com',
        phone: '+1-555-0106',
        country: 'United States',
        investorType: 'individual',
        riskTolerance: 'high',
        investmentPreferences: JSON.stringify({
          preferredRegions: ['Africa'],
          maxInvestmentAmount: 100000,
          sustainabilityFocus: false,
          preferredVarieties: ['Robusta', 'Specialty']
        }),
        createdAt: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
        updatedAt: Date.now() - (1 * 24 * 60 * 60 * 1000)  // 1 day ago
      }
    ];

    await db.insert(investorProfiles).values(investorProfileData);

    if (DISABLE_INVESTOR_KYC) {
      console.log('DISABLE_INVESTOR_KYC=true: inserting minimal auto-verified investor records')

      const autoVerified = investorProfileData.map(p => ({
        investorAddress: p.investorAddress,
        verificationStatus: 'verified',
        verificationType: 'basic',
        documentsHash: null,
        identityDocumentHash: null,
        proofOfAddressHash: null,
        financialStatementHash: null,
        accreditationProofHash: null,
        verifierAddress: 'system',
        verificationDate: Date.now(),
        expiryDate: null,
        accessLevel: 'full',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))

      const insertedVerifications = await db.insert(investorVerifications).values(autoVerified).returning();

      // Minimal history entries
      const history = insertedVerifications.map((v: any) => ({
        verificationId: v.id,
        previousStatus: 'unverified',
        newStatus: 'verified',
        actionType: 'approve',
        verifierAddress: 'system',
        reason: 'KYC disabled: auto-approved',
        timestamp: Date.now()
      }))

      await db.insert(investorVerificationHistory).values(history)

      console.log(`✅ Inserted ${insertedVerifications.length} auto-verified investor records`)

      console.log('✅ Investor verification seed (auto-verified) inserted successfully!');
      console.log(`📊 Seeded data summary:`);
      console.log(`   - ${investorProfileData.length} investor profiles`);
      console.log(`   - ${insertedVerifications.length} auto-verified investor records`);
      console.log(`   - ${history.length} verification history records`);

    } else {
      // Seed investor verifications with different scenarios
      const investorVerificationData = [
        // Verified basic investor
        {
          investorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          verificationStatus: 'verified',
          verificationType: 'basic',
          documentsHash: 'QmVerified1BasicDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity1Alice123456789abcdef',
          proofOfAddressHash: 'QmAddress1Alice123456789abcdef',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          verificationDate: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
          expiryDate: Date.now() + (305 * 24 * 60 * 60 * 1000), // 305 days from now (1 year from verification)
          accessLevel: 'limited',
          createdAt: Date.now() - (90 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (60 * 24 * 60 * 60 * 1000)
        },
        // Verified accredited investor
        {
          investorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          verificationStatus: 'verified',
          verificationType: 'accredited',
          documentsHash: 'QmVerified2AccreditedDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity2Bob123456789abcdef',
          proofOfAddressHash: 'QmAddress2Bob123456789abcdef',
          financialStatementHash: 'QmFinancial2Bob123456789abcdef',
          accreditationProofHash: 'QmAccreditation2Bob123456789abcdef',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          verificationDate: Date.now() - (90 * 24 * 60 * 60 * 1000), // 90 days ago
          expiryDate: Date.now() + (275 * 24 * 60 * 60 * 1000), // 275 days from now
          accessLevel: 'full',
          createdAt: Date.now() - (120 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (90 * 24 * 60 * 60 * 1000)
        },
        // Rejected investor
        {
          investorAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
          verificationStatus: 'rejected',
          verificationType: 'basic',
          documentsHash: 'QmRejected3BasicDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity3Carol123456789abcdef',
          proofOfAddressHash: 'QmAddress3Carol123456789abcdef',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          rejectionReason: 'Proof of address document is expired. Please submit a recent utility bill or bank statement dated within the last 3 months.',
          accessLevel: 'none',
          createdAt: Date.now() - (45 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (30 * 24 * 60 * 60 * 1000)
        },
        // Pending institutional investor
        {
          investorAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
          verificationStatus: 'pending',
          verificationType: 'accredited',
          documentsHash: 'QmPending4AccreditedDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity4David123456789abcdef',
          proofOfAddressHash: 'QmAddress4David123456789abcdef',
          financialStatementHash: 'QmFinancial4David123456789abcdef',
          accreditationProofHash: 'QmAccreditation4David123456789abcdef',
          accessLevel: 'none',
          createdAt: Date.now() - (10 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (10 * 24 * 60 * 60 * 1000)
        },
        // Recently submitted basic verification
        {
          investorAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          verificationStatus: 'pending',
          verificationType: 'basic',
          documentsHash: 'QmPending5BasicDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity5Eva123456789abcdef',
          proofOfAddressHash: 'QmAddress5Eva123456789abcdef',
          accessLevel: 'none',
          createdAt: Date.now() - (2 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (2 * 24 * 60 * 60 * 1000)
        },
        // Expired verification (needs renewal)
        {
          investorAddress: '0xffffffffffffffffffffffffffffffffffffffff',
          verificationStatus: 'expired',
          verificationType: 'basic',
          documentsHash: 'QmExpired6BasicDocuments123456789abcdef',
          identityDocumentHash: 'QmIdentity6Frank123456789abcdef',
          proofOfAddressHash: 'QmAddress6Frank123456789abcdef',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          verificationDate: Date.now() - (400 * 24 * 60 * 60 * 1000), // 400 days ago
          expiryDate: Date.now() - (35 * 24 * 60 * 60 * 1000), // Expired 35 days ago
          accessLevel: 'none',
          createdAt: Date.now() - (420 * 24 * 60 * 60 * 1000),
          updatedAt: Date.now() - (35 * 24 * 60 * 60 * 1000)
        }
      ];

      const insertedVerifications = await db.insert(investorVerifications).values(investorVerificationData).returning();

      // Seed verification history for audit trail
      const verificationHistoryData = [
        // Alice's verification history (basic verified)
        {
          verificationId: insertedVerifications[0].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (90 * 24 * 60 * 60 * 1000)
        },
        {
          verificationId: insertedVerifications[0].id,
          previousStatus: 'pending',
          newStatus: 'verified',
          actionType: 'approve',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          reason: 'All documents verified successfully. Basic verification approved.',
          timestamp: Date.now() - (60 * 24 * 60 * 60 * 1000)
        },
        // Bob's verification history (accredited verified)
        {
          verificationId: insertedVerifications[1].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (120 * 24 * 60 * 60 * 1000)
        },
        {
          verificationId: insertedVerifications[1].id,
          previousStatus: 'pending',
          newStatus: 'verified',
          actionType: 'approve',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          reason: 'Accredited investor status confirmed. All financial documents verified.',
          timestamp: Date.now() - (90 * 24 * 60 * 60 * 1000)
        },
        // Carol's verification history (rejected)
        {
          verificationId: insertedVerifications[2].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (45 * 24 * 60 * 60 * 1000)
        },
        {
          verificationId: insertedVerifications[2].id,
          previousStatus: 'pending',
          newStatus: 'rejected',
          actionType: 'reject',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          reason: 'Proof of address document is expired. Please submit a recent utility bill or bank statement dated within the last 3 months.',
          timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
        },
        // David's verification history (pending institutional)
        {
          verificationId: insertedVerifications[3].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000)
        },
        // Eva's verification history (recently submitted)
        {
          verificationId: insertedVerifications[4].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000)
        },
        // Frank's verification history (expired)
        {
          verificationId: insertedVerifications[5].id,
          previousStatus: 'unverified',
          newStatus: 'pending',
          actionType: 'submit',
          timestamp: Date.now() - (420 * 24 * 60 * 60 * 1000)
        },
        {
          verificationId: insertedVerifications[5].id,
          previousStatus: 'pending',
          newStatus: 'verified',
          actionType: 'approve',
          verifierAddress: '0x9999999999999999999999999999999999999999',
          reason: 'Basic verification approved.',
          timestamp: Date.now() - (400 * 24 * 60 * 60 * 1000)
        },
        {
          verificationId: insertedVerifications[5].id,
          previousStatus: 'verified',
          newStatus: 'expired',
          actionType: 'expire',
          reason: 'Verification expired after 1 year. Renewal required.',
          timestamp: Date.now() - (35 * 24 * 60 * 60 * 1000)
        }
      ];

      await db.insert(investorVerificationHistory).values(verificationHistoryData);

      console.log('✅ Investor verification seed data inserted successfully!');
      console.log(`📊 Seeded data summary:`);
      console.log(`   - ${investorProfileData.length} investor profiles`);
      console.log(`   - ${investorVerificationData.length} investor verifications`);
      console.log(`   - ${verificationHistoryData.length} verification history records`);
      console.log(`\n📋 Verification status breakdown:`);
      console.log(`   - Verified: 2 (1 basic, 1 accredited)`);
      console.log(`   - Pending: 2 (1 basic, 1 accredited)`);
      console.log(`   - Rejected: 1 (basic)`);
      console.log(`   - Expired: 1 (basic)`);
    }

  } catch (error) {
    console.error('❌ Error seeding investor verification data:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly (supports both CommonJS and ESM)
const isMain = typeof require !== 'undefined'
  ? // CommonJS
    (require.main === module)
  : // ESM: compare import.meta.url to the executed script path
    (typeof import.meta !== 'undefined' && import.meta.url && import.meta.url.endsWith('/db/seed-investor-verification-data.ts'))

if (isMain) {
  seedInvestorVerificationData()
    .then(() => {
      console.log('🌱 Investor verification database seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}