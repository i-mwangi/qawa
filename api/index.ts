/**
 * Vercel Serverless Function Entry Point
 * Single entry point for all API routes to stay within Hobby plan limits
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Note: revenueDistributionService import causes Windows ESM issues
// Distribution must be done manually via scripts for now

// For now, return a simple response
// TODO: Refactor server.ts to export a request handler instead of creating HTTP server
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Test endpoint to verify code changes
  if (url.includes('/test-funding-api')) {
    return res.status(200).json({
      success: true,
      message: 'Funding API test endpoint - code changes are working!',
      timestamp: new Date().toISOString()
    });
  }

  // Health check endpoint
  if (url.includes('/health')) {
    return res.status(200).json({
      success: true,
      message: 'API is running',
      timestamp: new Date().toISOString()
    });
  }

  // Admin access check endpoint
  if (url.includes('/admin/check-access') && req.method === 'GET') {
    const { isAdmin } = await import('../lib/middleware/admin-auth.js');
    const accountId = req.headers['x-account-id'] as string;

    if (isAdmin(accountId)) {
      return res.status(200).json({
        success: true,
        isAdmin: true,
        accountId
      });
    } else {
      return res.status(403).json({
        success: false,
        isAdmin: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
  }

  // Groves endpoints
  if (url.includes('/groves/register') && req.method === 'POST') {
    const { db } = await import('../db/index.js');
    const { coffeeGroves, farmers } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    try {
      const groveData = req.body;
      const tokensPerTree = groveData.tokensPerTree || 10; // Default 10 tokens per tree

      // Validate terms acceptance
      if (!groveData.termsAccepted) {
        return res.status(400).json({
          success: false,
          error: 'Terms and Conditions must be accepted to register a grove'
        });
      }

      // Record terms acceptance for farmer
      if (groveData.farmerAddress) {
        try {
          await db.update(farmers)
            .set({
              termsAcceptedAt: Date.now(),
              termsVersion: groveData.termsVersion || '1.0',
              termsIpAddress: req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown'
            })
            .where(eq(farmers.address, groveData.farmerAddress));
          console.log(`✅ Terms acceptance recorded for farmer ${groveData.farmerAddress}`);
        } catch (termsError) {
          console.warn('⚠️ Could not record terms acceptance:', termsError);
          // Don't fail the registration if terms recording fails
        }
      }

      // Step 1: Insert grove into database first
      const result = await db.insert(coffeeGroves).values({
        groveName: groveData.groveName,
        location: groveData.location,
        coordinatesLat: groveData.latitude,
        coordinatesLng: groveData.longitude,
        treeCount: groveData.treeCount,
        coffeeVariety: groveData.coffeeVariety,
        expectedYieldPerTree: groveData.expectedYieldPerTree,
        tokensPerTree: tokensPerTree,
        farmerAddress: groveData.farmerAddress,
        verificationStatus: 'pending',
        currentHealthScore: 0,
        isTokenized: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).returning();

      const grove = result[0];
      let tokenizationResult: any = null;

      // Step 2: Attempt tokenization if Hedera credentials are configured
      if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
        try {
          console.log(`🪙 Attempting to tokenize grove: ${grove.groveName}`);

          const { hederaTokenService } = await import('../lib/api/hedera-token-service.js');
          const symbol = `TREE-${grove.groveName.substring(0, 6).toUpperCase()}`;
          const totalTokens = grove.treeCount * tokensPerTree;

          // Create HTS token
          const tokenResult = await hederaTokenService.createGroveToken(
            grove.groveName,
            symbol,
            totalTokens
          );

          if (tokenResult.success && tokenResult.tokenId) {
            // Update grove with token information
            await db.update(coffeeGroves)
              .set({
                tokenAddress: tokenResult.tokenId,
                tokenSymbol: symbol,
                totalTokensIssued: totalTokens,
                isTokenized: true,
                tokenizedAt: Date.now(),
                updatedAt: Date.now()
              })
              .where(eq(coffeeGroves.id, grove.id));

            console.log(`✅ Grove tokenized successfully: ${tokenResult.tokenId}`);

            // Step 3: Transfer tokens to farmer if enabled
            if (grove.farmerAddress && process.env.TRANSFER_TOKENS_TO_FARMER === 'true') {
              const farmerSharePercentage = parseInt(process.env.FARMER_TOKEN_SHARE || '100');
              const farmerTokens = Math.floor(totalTokens * farmerSharePercentage / 100);
              
              console.log(`\n📤 Transferring ${farmerSharePercentage}% of tokens to farmer...`);
              console.log(`   Farmer address: ${grove.farmerAddress}`);
              console.log(`   Farmer tokens: ${farmerTokens}`);
              
              try {
                // Associate token with farmer's account first
                console.log(`🔗 Associating token with farmer's account...`);
                const associateResult = await hederaTokenService.associateToken(
                  tokenResult.tokenId,
                  grove.farmerAddress
                );
                
                if (!associateResult.success) {
                  console.log(`⚠️  Token association failed: ${associateResult.error}`);
                  console.log(`   Farmer must manually associate token in wallet`);
                } else {
                  console.log(`✅ Token associated with farmer's account`);
                  
                  // Transfer tokens to farmer
                  console.log(`📤 Transferring tokens to farmer...`);
                  const transferResult = await hederaTokenService.transferTokens(
                    tokenResult.tokenId,
                    grove.farmerAddress,
                    farmerTokens
                  );
                  
                  if (transferResult.success) {
                    console.log(`✅ Transferred ${farmerTokens} tokens to farmer ${grove.farmerAddress}`);
                  } else {
                    console.log(`⚠️  Token transfer failed: ${transferResult.error}`);
                  }
                }
              } catch (transferError: any) {
                console.error(`❌ Token transfer error:`, transferError.message);
              }
            }

            tokenizationResult = {
              success: true,
              tokenId: tokenResult.tokenId,
              tokenSymbol: symbol,
              totalTokens: totalTokens,
              transactionId: tokenResult.transactionId
            };
          } else {
            console.warn(`⚠️ Tokenization failed: ${tokenResult.error}`);
            tokenizationResult = {
              success: false,
              error: tokenResult.error
            };
          }
        } catch (tokenError: any) {
          console.error('❌ Tokenization error:', tokenError);
          tokenizationResult = {
            success: false,
            error: tokenError.message || 'Tokenization failed'
          };
        }
      } else {
        console.log('ℹ️ Hedera credentials not configured, skipping tokenization');
        tokenizationResult = {
          success: false,
          error: 'Hedera credentials not configured'
        };
      }

      return res.status(200).json({
        success: true,
        grove: result[0],
        tokenization: tokenizationResult,
        message: tokenizationResult?.success
          ? 'Grove registered and tokenized successfully'
          : 'Grove registered (tokenization skipped)'
      });
    } catch (error: any) {
      console.error('Error registering grove:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to register grove'
      });
    }
  }

  // Grove history endpoint (GET /groves/:id/history) - MUST come before /groves
  if (url.match(/\/groves\/\d+\/history/) && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const groveId = parseInt(url.split('/groves/')[1].split('/')[0]);

      // Get harvests for this grove
      const harvests = await db.all(sql`
        SELECT 
          h.*,
          g.grove_name as groveName,
          g.coffee_variety as coffeeVariety
        FROM harvest_records h
        INNER JOIN coffee_groves g ON h.grove_id = g.id
        WHERE h.grove_id = ${groveId}
        ORDER BY h.harvest_date DESC
      `);

      // Calculate stats
      const totalHarvests = harvests.length;
      const totalRevenue = harvests.reduce((sum: number, h: any) => sum + (h.total_revenue || 0), 0) / 100;
      const avgYield = totalHarvests > 0
        ? harvests.reduce((sum: number, h: any) => sum + (h.yield_kg || 0), 0) / totalHarvests
        : 0;

      // Map to frontend format
      const mappedHarvests = harvests.map((h: any) => ({
        id: h.id,
        groveId: h.grove_id,
        groveName: h.groveName,
        coffeeVariety: h.coffeeVariety,
        harvestDate: h.harvest_date,
        yieldKg: h.yield_kg,
        qualityGrade: h.quality_grade,
        salePricePerKg: h.sale_price_per_kg / 100,
        totalRevenue: h.total_revenue / 100,
        farmerShare: h.farmer_share / 100,
        investorShare: h.investor_share / 100,
        revenueDistributed: h.revenue_distributed,
        transactionHash: h.transaction_hash,
        createdAt: h.created_at
      }));

      return res.status(200).json({
        success: true,
        data: {
          harvests: mappedHarvests,
          stats: {
            totalHarvests,
            totalRevenue,
            avgYield
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching grove history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch grove history'
      });
    }
  }

  if (url.includes('/groves') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { coffeeGroves } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    try {
      // Extract farmerAddress from query params
      const urlObj = new URL(url, `http://localhost`);
      const farmerAddress = urlObj.searchParams.get('farmerAddress');

      let groves;
      if (farmerAddress) {
        groves = await db.query.coffeeGroves.findMany({
          where: eq(coffeeGroves.farmerAddress, farmerAddress)
        });
      } else {
        groves = await db.query.coffeeGroves.findMany();
      }

      // Map database fields to frontend expected fields
      const mappedGroves = groves.map(grove => ({
        ...grove,
        latitude: grove.coordinatesLat,
        longitude: grove.coordinatesLng,
        healthScore: grove.currentHealthScore || 0
      }));

      return res.status(200).json({
        success: true,
        groves: mappedGroves
      });
    } catch (error: any) {
      console.error('Error fetching groves:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch groves',
        groves: []
      });
    }
  }

  // Harvest endpoints
  if (url.includes('/harvest/report') && req.method === 'POST') {
    const { db } = await import('../db/index.js');
    const { harvestRecords, coffeeGroves } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    try {
      const harvestData = req.body;

      // Parse autoDistribute query parameter (default false due to Windows ESM issues)
      const urlObj = new URL(url, `http://localhost`);
      const autoDistribute = urlObj.searchParams.get('autoDistribute') === 'true';

      // Get grove to calculate revenue split (70% farmer, 30% investors)
      const grove = await db.query.coffeeGroves.findFirst({
        where: eq(coffeeGroves.id, harvestData.groveId)
      });

      if (!grove) {
        return res.status(404).json({
          success: false,
          error: 'Grove not found'
        });
      }

      const totalRevenue = harvestData.totalRevenue;
      const farmerShare = Math.floor(totalRevenue * 0.3); // 30% to farmer
      const investorShare = totalRevenue - farmerShare; // 70% to investors

      // Convert harvestDate string to timestamp
      const harvestTimestamp = new Date(harvestData.harvestDate).getTime();

      // Insert harvest into database
      const result = await db.insert(harvestRecords).values({
        groveId: harvestData.groveId,
        harvestDate: harvestTimestamp,
        yieldKg: Math.floor(harvestData.yieldKg),
        qualityGrade: harvestData.qualityGrade,
        salePricePerKg: Math.floor(harvestData.salePricePerKg * 100), // Store as cents
        totalRevenue: Math.floor(totalRevenue * 100), // Store as cents
        farmerShare: Math.floor(farmerShare * 100), // Store as cents
        investorShare: Math.floor(investorShare * 100), // Store as cents
        revenueDistributed: false,
        createdAt: Date.now()
      }).returning();

      const harvest = result[0];

      // Auto-distribution disabled due to Windows ESM import issues
      // Use manual distribution script: npx tsx scripts/manually-distribute-harvest-11.ts [HARVEST_ID]
      let distributionResult = null;
      if (autoDistribute) {
        console.log(`[HarvestReport] Auto-distribution requested but disabled. Use manual script.`);
        console.log(`[HarvestReport] Run: npx tsx scripts/manually-distribute-harvest-11.ts ${harvest.id}`);
      }

      return res.status(200).json({
        success: true,
        harvest: harvest,
        distribution: distributionResult,
        revenueDistributed: distributionResult !== null,
        message: distributionResult
          ? 'Harvest reported and revenue distributed successfully'
          : 'Harvest reported successfully'
      });
    } catch (error: any) {
      console.error('Error reporting harvest:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to report harvest'
      });
    }
  }

  if (url.includes('/harvest/history') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const urlObj = new URL(url, `http://localhost`);
      const farmerAddress = urlObj.searchParams.get('farmerAddress');

      let harvests: any[] = [];

      if (farmerAddress) {
        // Use raw SQL to join harvests with groves
        const result = await db.all(sql`
          SELECT 
            h.*,
            g.grove_name as groveName,
            g.coffee_variety as coffeeVariety,
            g.farmer_address as farmerAddress
          FROM harvest_records h
          INNER JOIN coffee_groves g ON h.grove_id = g.id
          WHERE g.farmer_address = ${farmerAddress}
          ORDER BY h.harvest_date DESC
        `);

        harvests = result;
      } else {
        // Get all harvests with grove info
        const result = await db.all(sql`
          SELECT 
            h.*,
            g.grove_name as groveName,
            g.coffee_variety as coffeeVariety,
            g.farmer_address as farmerAddress
          FROM harvest_records h
          INNER JOIN coffee_groves g ON h.grove_id = g.id
          ORDER BY h.harvest_date DESC
        `);

        harvests = result;
      }

      // Map snake_case to camelCase for frontend
      const mappedHarvests = harvests.map(h => ({
        id: h.id,
        groveId: h.grove_id,
        groveName: h.groveName,
        coffeeVariety: h.coffeeVariety,
        farmerAddress: h.farmerAddress,
        harvestDate: h.harvest_date,
        yieldKg: h.yield_kg,
        qualityGrade: h.quality_grade,
        salePricePerKg: h.sale_price_per_kg / 100, // Convert from cents
        totalRevenue: h.total_revenue / 100, // Convert from cents
        farmerShare: h.farmer_share / 100, // Convert from cents
        investorShare: h.investor_share / 100, // Convert from cents
        revenueDistributed: h.revenue_distributed,
        transactionHash: h.transaction_hash,
        createdAt: h.created_at
      }));

      return res.status(200).json({
        success: true,
        harvests: mappedHarvests
      });
    } catch (error: any) {
      console.error('Error fetching harvest history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch harvest history',
        harvests: []
      });
    }
  }

  // Harvest stats endpoint
  if (url.includes('/harvest/stats') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const urlObj = new URL(url, `http://localhost`);
      const farmerAddress = urlObj.searchParams.get('farmerAddress');

      if (!farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address required'
        });
      }

      // Use raw SQL to get stats
      const result = await db.get(sql`
        SELECT 
          COUNT(h.id) as totalHarvests,
          COALESCE(SUM(h.yield_kg), 0) as totalYield,
          COALESCE(SUM(h.total_revenue), 0) as totalRevenue,
          COALESCE(AVG(h.quality_grade), 0) as averageQuality
        FROM harvest_records h
        INNER JOIN coffee_groves g ON h.grove_id = g.id
        WHERE g.farmer_address = ${farmerAddress}
      `);

      const stats = {
        totalHarvests: result?.totalHarvests || 0,
        totalYield: result?.totalYield || 0,
        totalRevenue: (result?.totalRevenue || 0) / 100, // Convert from cents
        averageQuality: result?.averageQuality || 0
      };

      return res.status(200).json({
        success: true,
        stats: stats
      });
    } catch (error: any) {
      console.error('Error fetching harvest stats:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch harvest stats'
      });
    }
  }

  // Farmer balance endpoint
  if (url.includes('/farmer/balance/') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const farmerAddress = url.split('/farmer/balance/')[1]?.split('?')[0];

      if (!farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address required'
        });
      }

      // Get all groves for this farmer with their balances from farmer_grove_balances table
      const groves = await db.all(sql`
        SELECT 
          g.id,
          g.grove_name as groveName,
          COALESCE(b.total_earned, 0) as totalEarned,
          COALESCE(b.total_withdrawn, 0) as totalWithdrawn,
          COALESCE(b.available_balance, 0) as availableBalance,
          COALESCE(b.this_month_distributed, 0) as thisMonthDistributed
        FROM coffee_groves g
        LEFT JOIN farmer_grove_balances b ON g.id = b.grove_id AND b.farmer_address = g.farmer_address
        WHERE g.farmer_address = ${farmerAddress}
      `);

      // Data is already in cents, return as-is (frontend will convert to dollars for display)
      const mappedGroves = groves.map((g: any) => ({
        groveId: g.id,
        groveName: g.groveName,
        totalEarned: g.totalEarned,
        availableBalance: g.availableBalance,
        totalWithdrawn: g.totalWithdrawn,
        thisMonthDistributed: g.thisMonthDistributed
      }));

      return res.status(200).json({
        success: true,
        data: {
          groves: mappedGroves
        }
      });
    } catch (error: any) {
      console.error('Error fetching farmer balance:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch farmer balance'
      });
    }
  }

  // Revenue farmer balance endpoint (alternative path)
  if (url.includes('/revenue/farmer-balance') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const urlObj = new URL(url, `http://localhost`);
      const farmerAddress = urlObj.searchParams.get('farmerAddress');

      if (!farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address required'
        });
      }

      // Get aggregated balance from farmer_grove_balances table
      const result = await db.get(sql`
        SELECT 
          COALESCE(SUM(total_earned), 0) as totalEarned,
          COALESCE(SUM(total_withdrawn), 0) as totalWithdrawn,
          COALESCE(SUM(available_balance), 0) as availableBalance
        FROM farmer_grove_balances
        WHERE farmer_address = ${farmerAddress}
      `);

      const totalEarned = (result?.totalEarned || 0) / 100;
      const totalWithdrawn = (result?.totalWithdrawn || 0) / 100;
      const availableBalance = (result?.availableBalance || 0) / 100;

      return res.status(200).json({
        success: true,
        data: {
          totalEarned,
          totalWithdrawn,
          availableBalance
        }
      });
    } catch (error: any) {
      console.error('Error fetching farmer balance:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch farmer balance'
      });
    }
  }

  // Farmer withdraw endpoint (POST)
  if (url.includes('/api/farmer/withdraw') && req.method === 'POST') {
    const { db } = await import('../db/index.js');
    const { farmerWithdrawals } = await import('../db/schema/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const withdrawalData = req.body;
      const { groveId, amount, farmerAddress } = withdrawalData;

      if (!groveId || !amount || !farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: groveId, amount, farmerAddress'
        });
      }

      console.log(`💰 Withdrawal request: ${farmerAddress} wants to withdraw $${amount} from grove ${groveId}`);

      // Check if Hedera is configured
      if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_USDC_TOKEN_ID) {
        console.log('⚠️ Hedera not configured, returning demo response');
        return res.status(200).json({
          success: true,
          message: 'Withdrawal request received (demo mode - Hedera not configured)',
          withdrawal: {
            groveId,
            amount,
            farmerAddress,
            status: 'pending',
            timestamp: Date.now()
          }
        });
      }

      // Verify farmer has sufficient balance using farmer_grove_balances table
      const balanceCheck = await db.get(sql`
        SELECT 
          available_balance as availableBalance,
          total_earned as totalEarned,
          total_withdrawn as totalWithdrawn
        FROM farmer_grove_balances
        WHERE grove_id = ${groveId} AND farmer_address = ${farmerAddress}
      `);

      if (!balanceCheck) {
        return res.status(404).json({
          success: false,
          error: 'No balance record found for this grove. Please report a harvest first.'
        });
      }

      const availableBalance = (balanceCheck.availableBalance || 0) / 100;

      if (availableBalance < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: $${availableBalance}, Requested: $${amount}`
        });
      }

      // Transfer USDC via Hedera
      console.log('🔄 Initiating Hedera USDC transfer...');
      const { HederaWithdrawalService } = await import('../lib/api/hedera-withdrawal-service.js');
      const withdrawalService = new HederaWithdrawalService();

      const amountInCents = Math.floor(amount * 100);
      const transferResult = await withdrawalService.transferUSDC(farmerAddress, amountInCents);

      if (!transferResult.success) {
        console.error('❌ Hedera transfer failed:', transferResult.error);
        return res.status(500).json({
          success: false,
          error: `Transfer failed: ${transferResult.error}`
        });
      }

      console.log('✅ Hedera transfer successful:', transferResult.transactionId);

      // Record withdrawal in database
      const withdrawalId = `withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.insert(farmerWithdrawals).values({
        id: withdrawalId,
        farmerAddress: farmerAddress,
        groveId: groveId,
        amount: amountInCents,
        status: 'completed',
        transactionHash: transferResult.transactionHash || transferResult.transactionId || '',
        requestedAt: Date.now(),
        completedAt: Date.now()
      });

      console.log('💾 Withdrawal recorded in database');

      // Update farmer_grove_balances table to reflect withdrawal
      try {
        const balanceUpdate = await db.run(sql`
          UPDATE farmer_grove_balances
          SET total_withdrawn = total_withdrawn + ${amountInCents},
              available_balance = available_balance - ${amountInCents},
              updated_at = ${Date.now()}
          WHERE farmer_address = ${farmerAddress} AND grove_id = ${groveId}
        `);
        console.log('✅ Balance updated in farmer_grove_balances');
      } catch (balanceError: any) {
        console.error('⚠️ Failed to update farmer_grove_balances:', balanceError.message);
        // Don't fail the withdrawal if balance update fails - withdrawal already completed
      }

      return res.status(200).json({
        success: true,
        message: `Successfully withdrew $${amount} USDC`,
        withdrawal: {
          id: withdrawalId,
          groveId,
          amount,
          farmerAddress,
          status: 'completed',
          transactionId: transferResult.transactionId,
          transactionHash: transferResult.transactionHash,
          blockExplorerUrl: transferResult.blockExplorerUrl,
          timestamp: Date.now()
        }
      });
    } catch (error: any) {
      console.error('❌ Error processing withdrawal:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal'
      });
    }
  }

  // Farmer withdrawals endpoint (GET)
  if (url.includes('/api/farmer/withdrawals/') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const farmerAddress = url.split('/farmer/withdrawals/')[1]?.split('?')[0];

      if (!farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address required'
        });
      }

      // Fetch withdrawals from database
      const withdrawals = await db.all(sql`
        SELECT 
          w.*,
          g.grove_name as groveName
        FROM farmer_withdrawals w
        LEFT JOIN coffee_groves g ON w.grove_id = g.id
        WHERE w.farmer_address = ${farmerAddress}
        ORDER BY w.requested_at DESC
      `);

      // Map to frontend format
      const network = process.env.HEDERA_NETWORK || 'testnet';
      const mappedWithdrawals = withdrawals.map((w: any) => ({
        id: w.id,
        groveId: w.grove_id,
        groveName: w.groveName || 'Unknown Grove',
        amount: w.amount / 100, // Convert from cents
        status: w.status,
        transactionHash: w.transaction_hash,
        blockExplorerUrl: w.transaction_hash ? `https://hashscan.io/${network}/transaction/${w.transaction_hash}` : null,
        requestedAt: w.requested_at,
        completedAt: w.completed_at
      }));

      return res.status(200).json({
        success: true,
        withdrawals: mappedWithdrawals
      });
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch withdrawals',
        withdrawals: []
      });
    }
  }

  // Farmer transactions endpoint
  if (url.includes('/farmer/transactions/') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const farmerAddress = url.split('/farmer/transactions/')[1]?.split('?')[0];

      if (!farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address required'
        });
      }

      // Fetch withdrawals as transactions
      const withdrawals = await db.all(sql`
        SELECT 
          w.id,
          w.amount,
          w.status,
          w.transaction_hash as transactionHash,
          w.requested_at as timestamp,
          g.grove_name as groveName,
          'withdrawal' as type
        FROM farmer_withdrawals w
        LEFT JOIN coffee_groves g ON w.grove_id = g.id
        WHERE w.farmer_address = ${farmerAddress}
        ORDER BY w.requested_at DESC
      `);

      // Map to transaction format
      const transactions = withdrawals.map((w: any) => ({
        id: w.id,
        type: 'withdrawal',
        amount: w.amount / 100, // Convert from cents
        description: `Withdrawal from ${w.groveName || 'grove'}`,
        status: w.status,
        transactionHash: w.transactionHash,
        timestamp: w.timestamp,
        date: new Date(w.timestamp).toISOString()
      }));

      return res.status(200).json({
        success: true,
        transactions: transactions
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch transactions',
        transactions: []
      });
    }
  }

  // Farmer claim tokens endpoint
  if (url.includes('/api/farmer/claim-tokens/') && req.method === 'POST') {
    try {
      const groveId = parseInt(url.split('/claim-tokens/')[1]?.split('?')[0] || '0');
      const { farmerAddress } = req.body;

      if (!groveId || !farmerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Grove ID and farmer address required'
        });
      }

      const { db } = await import('../db/index.js');
      const { coffeeGroves } = await import('../db/schema/index.js');
      const { eq } = await import('drizzle-orm');
      const { hederaTokenService } = await import('../lib/api/hedera-token-service.js');

      // Get grove details
      const grove = await db.query.coffeeGroves.findFirst({
        where: eq(coffeeGroves.id, groveId)
      });

      if (!grove) {
        return res.status(404).json({
          success: false,
          error: 'Grove not found'
        });
      }

      if (!grove.isTokenized || !grove.tokenAddress) {
        return res.status(400).json({
          success: false,
          error: 'Grove is not tokenized'
        });
      }

      if (grove.farmerAddress !== farmerAddress) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized for this grove'
        });
      }

      const availableTokens = (grove.totalTokensIssued || 0) - (grove.tokensSold || 0);

      if (availableTokens <= 0) {
        return res.status(400).json({
          success: false,
          error: 'No tokens available to claim'
        });
      }

      // Try to transfer tokens (will fail if not associated)
      console.log(`[ClaimTokens] Transferring ${availableTokens} tokens to ${farmerAddress}`);

      const transferResult = await hederaTokenService.transferTokens(
        grove.tokenAddress,
        farmerAddress,
        availableTokens
      );

      if (!transferResult.success) {
        return res.status(400).json({
          success: false,
          error: transferResult.error || 'Failed to transfer tokens'
        });
      }

      console.log(`[ClaimTokens] ✅ Tokens transferred successfully`);

      return res.status(200).json({
        success: true,
        message: 'Tokens claimed successfully',
        transactionId: transferResult.transactionId,
        amount: availableTokens
      });

    } catch (error: any) {
      console.error('[ClaimTokens] Error:', error);

      // Translate technical errors to user-friendly messages
      let friendlyError = error.message || 'Failed to claim tokens';

      if (error.message?.includes('INSUFFICIENT_TOKEN_BALANCE')) {
        friendlyError = 'All tokens have already been claimed or sold. No tokens available in the treasury.';
      } else if (error.message?.includes('TOKEN_NOT_ASSOCIATED')) {
        friendlyError = 'Please associate the token in your HashPack wallet first, then try again.';
      } else if (error.message?.includes('INVALID_SIGNATURE')) {
        friendlyError = 'Transaction signature failed. Please make sure you\'re using the correct wallet.';
      } else if (error.message?.includes('INSUFFICIENT_ACCOUNT_BALANCE')) {
        friendlyError = 'Not enough HBAR in your wallet to pay for the transaction fee (~$0.05 needed).';
      } else if (error.message?.includes('ACCOUNT_FROZEN')) {
        friendlyError = 'Your account is frozen. Please contact support.';
      } else if (error.message?.includes('TOKEN_FROZEN')) {
        friendlyError = 'This token is frozen. Please contact support.';
      }

      return res.status(500).json({
        success: false,
        error: friendlyError
      });
    }
  }

  // Token purchase endpoint (POST /tokens/purchase)
  if (url.includes('/tokens/purchase') && req.method === 'POST') {
    try {
      const { investorAddress, groveId, tokenAmount, paymentAmount, termsAccepted, termsVersion } = req.body;

      // Validate request body
      if (!investorAddress || !groveId || !tokenAmount || !paymentAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: investorAddress, groveId, tokenAmount, paymentAmount'
        });
      }

      // Check if this is investor's first purchase and validate terms acceptance
      const { db } = await import('../db/index.js');
      const { investorProfiles, tokenHoldings } = await import('../db/schema/index.js');
      const { eq, and } = await import('drizzle-orm');

      // Check if investor has any existing holdings
      const existingHoldings = await db.select()
        .from(tokenHoldings)
        .where(eq(tokenHoldings.holderAddress, investorAddress))
        .limit(1);

      // If first purchase, require terms acceptance
      if (existingHoldings.length === 0 && !termsAccepted) {
        return res.status(400).json({
          success: false,
          error: 'Terms and Conditions must be accepted before making your first investment'
        });
      }

      // Record terms acceptance for investor if this is their first purchase
      if (existingHoldings.length === 0 && termsAccepted) {
        try {
          // Check if investor profile exists
          const existingProfile = await db.select()
            .from(investorProfiles)
            .where(eq(investorProfiles.investorAddress, investorAddress))
            .limit(1);

          if (existingProfile.length > 0) {
            // Update existing profile
            await db.update(investorProfiles)
              .set({
                termsAcceptedAt: Date.now(),
                termsVersion: termsVersion || '1.0',
                termsIpAddress: req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown',
                updatedAt: Date.now()
              })
              .where(eq(investorProfiles.investorAddress, investorAddress));
          } else {
            // Create new profile with terms acceptance
            await db.insert(investorProfiles).values({
              investorAddress,
              termsAcceptedAt: Date.now(),
              termsVersion: termsVersion || '1.0',
              termsIpAddress: req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown',
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
          console.log(`✅ Terms acceptance recorded for investor ${investorAddress}`);
        } catch (termsError) {
          console.warn('⚠️ Could not record terms acceptance:', termsError);
          // Don't fail the purchase if terms recording fails
        }
      }

      // Validate types
      if (typeof groveId !== 'number' || typeof tokenAmount !== 'number' || typeof paymentAmount !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'groveId, tokenAmount, and paymentAmount must be numbers'
        });
      }

      // Import and call TokenPurchaseService
      const { tokenPurchaseService } = await import('../lib/services/token-purchase-service.js');

      const result = await tokenPurchaseService.purchaseTokensPrimary({
        investorAddress,
        groveId,
        tokenAmount,
        paymentAmount
      });

      if (!result.success) {
        // Determine appropriate status code based on error
        let statusCode = 400;
        if (result.error?.includes('not found')) {
          statusCode = 404;
        } else if (result.error?.includes('Insufficient tokens')) {
          statusCode = 409; // Conflict
        }

        return res.status(statusCode).json({
          success: false,
          error: result.error,
          availableTokens: result.availableTokens
        });
      }

      return res.status(200).json({
        success: true,
        holding: result.holding,
        availableTokens: result.availableTokens,
        message: 'Token purchase completed successfully'
      });

    } catch (error: any) {
      console.error('Error processing token purchase:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process token purchase'
      });
    }
  }

  // Token transfer endpoint (POST /tokens/transfer)
  if (url.includes('/tokens/transfer') && req.method === 'POST') {
    try {
      const { sellerAddress, buyerAddress, groveId, tokenAmount, transferPrice } = req.body;

      // Validate request body
      if (!sellerAddress || !buyerAddress || !groveId || !tokenAmount || !transferPrice) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sellerAddress, buyerAddress, groveId, tokenAmount, transferPrice'
        });
      }

      // Validate types
      if (typeof groveId !== 'number' || typeof tokenAmount !== 'number' || typeof transferPrice !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'groveId, tokenAmount, and transferPrice must be numbers'
        });
      }

      // Import and call TokenPurchaseService
      const { tokenPurchaseService } = await import('../lib/services/token-purchase-service.js');

      const result = await tokenPurchaseService.transferTokensSecondary({
        sellerAddress,
        buyerAddress,
        groveId,
        tokenAmount,
        transferPrice
      });

      if (!result.success) {
        // Determine appropriate status code based on error
        let statusCode = 400;
        if (result.error?.includes('does not have token holdings')) {
          statusCode = 404;
        } else if (result.error?.includes('insufficient tokens')) {
          statusCode = 409; // Conflict
        }

        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }

      return res.status(200).json({
        success: true,
        transfer: result.transfer,
        message: 'Token transfer completed successfully'
      });

    } catch (error: any) {
      console.error('Error processing token transfer:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process token transfer'
      });
    }
  }

  // Token holdings endpoint (GET /tokens/holdings/:address)
  if (url.includes('/tokens/holdings/') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const address = url.split('/tokens/holdings/')[1]?.split('?')[0];

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Holder address required'
        });
      }

      // Query token holdings with grove information
      // Note: token_holdings uses camelCase, coffee_groves uses snake_case
      const holdings = await db.all(sql`
        SELECT 
          th.id,
          th.holderAddress,
          th.groveId,
          th.tokenAmount,
          th.purchasePrice,
          th.purchaseDate,
          th.isActive,
          g.grove_name as groveName,
          g.token_symbol as tokenSymbol,
          g.token_address as tokenAddress
        FROM token_holdings th
        INNER JOIN coffee_groves g ON th.groveId = g.id
        WHERE th.holderAddress = ${address} AND th.isActive = 1
        ORDER BY th.purchaseDate DESC
      `);

      // Calculate current value for each holding using prices table
      const holdingsWithValue = await Promise.all(holdings.map(async (holding: any) => {
        let currentValue = 0;

        // Try to get current price from prices table
        if (holding.tokenAddress) {
          try {
            const priceResult = await db.get(sql`
              SELECT price
              FROM prices
              WHERE token = ${holding.tokenAddress}
              ORDER BY timestamp DESC
              LIMIT 1
            `);

            if (priceResult && priceResult.price) {
              // Calculate current value: tokenAmount * current price
              currentValue = holding.tokenAmount * priceResult.price;
            } else {
              // Fallback: use purchase price as current value
              currentValue = holding.purchasePrice;
            }
          } catch (error) {
            // If price lookup fails, use purchase price as fallback
            currentValue = holding.purchasePrice;
          }
        } else {
          // No token address, use purchase price
          currentValue = holding.purchasePrice;
        }

        return {
          id: holding.id,
          groveId: holding.groveId,
          groveName: holding.groveName,
          tokenSymbol: holding.tokenSymbol,
          tokenAmount: holding.tokenAmount,
          purchasePrice: holding.purchasePrice / 100, // Convert from cents to dollars
          purchaseDate: holding.purchaseDate,
          currentValue: currentValue / 100 // Convert from cents to dollars
        };
      }));

      // Calculate total portfolio value
      const totalValue = holdingsWithValue.reduce((sum, holding) => sum + holding.currentValue, 0);

      return res.status(200).json({
        success: true,
        holdings: holdingsWithValue,
        totalValue: totalValue
      });

    } catch (error: any) {
      console.error('Error fetching token holdings:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch token holdings',
        holdings: [],
        totalValue: 0
      });
    }
  }

  // Preview distribution endpoint (GET /harvest/preview-distribution/:harvestId)
  if (url.includes('/harvest/preview-distribution/') && req.method === 'GET') {
    try {
      const harvestId = parseInt(url.split('/harvest/preview-distribution/')[1]?.split('?')[0] || '0');

      if (!harvestId || isNaN(harvestId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid harvest ID required'
        });
      }

      const { db } = await import('../db/index.js');
      const { harvestRecords, coffeeGroves, tokenHoldings } = await import('../db/schema/index.js');
      const { eq } = await import('drizzle-orm');

      const harvest = await db.query.harvestRecords.findFirst({
        where: eq(harvestRecords.id, harvestId)
      });

      if (!harvest) {
        return res.status(404).json({
          success: false,
          error: 'Harvest not found'
        });
      }

      const grove = await db.query.coffeeGroves.findFirst({
        where: eq(coffeeGroves.id, harvest.groveId)
      });

      if (!grove) {
        return res.status(404).json({
          success: false,
          error: 'Grove not found'
        });
      }

      const farmerShare = Math.floor(harvest.totalRevenue * 0.6);
      const investorPool = harvest.totalRevenue - farmerShare;

      let holders = [];
      try {
        holders = await db.select()
          .from(tokenHoldings)
          .where(eq(tokenHoldings.groveId, grove.id));
        holders = holders.filter(h => typeof h.groveId === 'number' && h.groveId === grove.id);
      } catch (error: any) {
        holders = [];
      }

      const investorHolders = holders.filter(h => h.holderAddress !== grove.farmerAddress);
      const totalInvestorTokens = investorHolders.reduce((sum, h) => sum + (typeof h.tokenAmount === 'number' ? h.tokenAmount : 0), 0);

      return res.status(200).json({
        success: true,
        preview: {
          harvestId,
          groveName: grove.groveName,
          totalRevenue: harvest.totalRevenue,
          farmerShare,
          investorPool,
          investorCount: investorHolders.length,
          totalInvestorTokens,
          alreadyDistributed: harvest.revenueDistributed || false
        }
      });

    } catch (error: any) {
      console.error('Error previewing distribution:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to preview distribution'
      });
    }
  }

  // Revenue distribution endpoint (POST /harvest/distribute/:harvestId)
  if (url.includes('/harvest/distribute/') && req.method === 'POST') {
    try {
      const harvestId = parseInt(url.split('/harvest/distribute/')[1]?.split('?')[0] || '0');

      if (!harvestId || isNaN(harvestId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid harvest ID required'
        });
      }

      console.log(`[Distribution] Starting manual distribution for harvest ${harvestId}`);

      // Import required modules
      const { db } = await import('../db/index.js');
      const { harvestRecords, coffeeGroves, tokenHoldings } = await import('../db/schema/index.js');
      const { eq } = await import('drizzle-orm');
      const { getHederaPaymentService } = await import('../lib/api/hedera-payment-service.js');
      const hederaPaymentService = getHederaPaymentService();

      // Get harvest details
      const harvest = await db.query.harvestRecords.findFirst({
        where: eq(harvestRecords.id, harvestId)
      });

      if (!harvest) {
        return res.status(404).json({
          success: false,
          error: 'Harvest not found'
        });
      }

      // Check if already distributed
      if (harvest.revenueDistributed) {
        return res.status(400).json({
          success: false,
          error: 'Revenue already distributed for this harvest'
        });
      }

      // Get grove details
      const grove = await db.query.coffeeGroves.findFirst({
        where: eq(coffeeGroves.id, harvest.groveId)
      });

      if (!grove) {
        return res.status(404).json({
          success: false,
          error: 'Grove not found'
        });
      }

      if (!grove.isTokenized || !grove.tokenAddress) {
        return res.status(400).json({
          success: false,
          error: 'Grove must be tokenized before revenue distribution'
        });
      }

      console.log(`[Distribution] Grove: ${grove.groveName}, Revenue: $${harvest.totalRevenue}`);

      // Calculate splits (60% farmer, 40% investors)
      const farmerShare = Math.floor(harvest.totalRevenue * 0.6);
      const investorPool = harvest.totalRevenue - farmerShare;

      console.log(`[Distribution] Farmer share: $${farmerShare}, Investor pool: $${investorPool}`);

      // Get all token holders for this grove
      let holders = [];
      try {
        holders = await db.select()
          .from(tokenHoldings)
          .where(eq(tokenHoldings.groveId, grove.id));
        
        // Filter out corrupted data (where groveId is a string instead of number)
        holders = holders.filter(h => typeof h.groveId === 'number' && h.groveId === grove.id);
      } catch (error: any) {
        console.log(`[Distribution] No token holdings table or no data: ${error.message}`);
        holders = [];
      }

      console.log(`[Distribution] Found ${holders.length} token holders`);

      // Calculate total investor tokens (exclude farmer's tokens)
      const investorHolders = holders.filter(h => h.holderAddress !== grove.farmerAddress);
      const totalInvestorTokens = investorHolders.reduce((sum, h) => sum + (typeof h.tokenAmount === 'number' ? h.tokenAmount : 0), 0);

      console.log(`[Distribution] Total investor tokens: ${totalInvestorTokens}`);

      const distributions: any[] = [];

      // Distribute to farmer
      if (grove.farmerAddress && farmerShare > 0) {
        console.log(`[Distribution] Sending $${farmerShare} to farmer ${grove.farmerAddress}`);
        
        const farmerResult = await hederaPaymentService.transferFromTreasury(
          grove.farmerAddress,
          farmerShare,
          `Harvest revenue - ${grove.groveName}`
        );

        if (farmerResult.success) {
          console.log(`✅ Farmer payment successful: ${farmerResult.transactionId}`);
          distributions.push({
            recipient: grove.farmerAddress,
            amount: farmerShare,
            type: 'farmer',
            transactionId: farmerResult.transactionId
          });
        } else {
          console.error(`❌ Farmer payment failed: ${farmerResult.error}`);
          throw new Error(`Farmer payment failed: ${farmerResult.error}`);
        }
      }

      // Distribute to investors proportionally
      if (totalInvestorTokens > 0 && investorPool > 0) {
        for (const holder of investorHolders) {
          const investorShare = Math.floor((holder.tokenAmount / totalInvestorTokens) * investorPool);
          
          if (investorShare > 0) {
            console.log(`[Distribution] Sending $${investorShare} to investor ${holder.holderAddress}`);
            
            const investorResult = await hederaPaymentService.transferFromTreasury(
              holder.holderAddress,
              investorShare,
              `Investment return - ${grove.groveName}`
            );

            if (investorResult.success) {
              console.log(`✅ Investor payment successful: ${investorResult.transactionId}`);
              distributions.push({
                recipient: holder.holderAddress,
                amount: investorShare,
                type: 'investor',
                tokens: holder.tokenAmount,
                transactionId: investorResult.transactionId
              });
            } else {
              console.error(`⚠️ Investor payment failed for ${holder.holderAddress}: ${investorResult.error}`);
              // Continue with other investors even if one fails
            }
          }
        }
      }

      // Mark harvest as distributed with retry logic
      let dbUpdateSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!dbUpdateSuccess && retryCount < maxRetries) {
        try {
          await db.update(harvestRecords)
            .set({
              revenueDistributed: true,
              transactionHash: distributions[0]?.transactionId || 'multiple'
            })
            .where(eq(harvestRecords.id, harvestId));
          
          dbUpdateSuccess = true;
          console.log(`✅ Distribution complete for harvest ${harvestId}`);
        } catch (dbError: any) {
          retryCount++;
          console.log(`⚠️ Database update attempt ${retryCount} failed: ${dbError.message}`);
          
          if (retryCount < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const waitTime = Math.pow(2, retryCount - 1) * 1000;
            console.log(`   Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.log(`❌ Failed to update database after ${maxRetries} attempts`);
            console.log(`   Payment was successful but harvest status not updated`);
            console.log(`   Transaction IDs: ${distributions.map(d => d.transactionId).join(', ')}`);
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: dbUpdateSuccess 
          ? 'Revenue distributed successfully' 
          : 'Revenue distributed successfully (database status update pending)',
        warning: !dbUpdateSuccess ? 'Harvest status not updated in database due to timeout' : undefined,
        distribution: {
          harvestId,
          totalRevenue: harvest.totalRevenue,
          farmerShare,
          investorPool,
          distributions,
          totalDistributed: distributions.reduce((sum, d) => sum + d.amount, 0),
          databaseUpdated: dbUpdateSuccess
        }
      });

    } catch (error: any) {
      console.error('Error distributing revenue:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to distribute revenue'
      });
    }
  }

  // Revenue preview endpoint (GET /harvest/preview-split)
  if (url.includes('/harvest/preview-split') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://localhost`);
      const groveIdParam = urlObj.searchParams.get('groveId');
      const totalRevenueParam = urlObj.searchParams.get('totalRevenue');

      // Validate required query parameters
      if (!groveIdParam || !totalRevenueParam) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: groveId, totalRevenue'
        });
      }

      const groveId = parseInt(groveIdParam);
      const totalRevenue = parseFloat(totalRevenueParam);

      // Validate parameter types
      if (isNaN(groveId) || isNaN(totalRevenue)) {
        return res.status(400).json({
          success: false,
          error: 'groveId and totalRevenue must be valid numbers'
        });
      }

      if (totalRevenue <= 0) {
        return res.status(400).json({
          success: false,
          error: 'totalRevenue must be greater than zero'
        });
      }

      // Import and call RevenueDistributionService
      const { revenueDistributionService } = await import('../lib/services/revenue-distribution-service.js');

      // Convert totalRevenue to cents for internal calculation
      const totalRevenueInCents = Math.floor(totalRevenue * 100);

      const preview = await revenueDistributionService.previewRevenueSplit({
        groveId,
        totalRevenue: totalRevenueInCents
      });

      // Convert amounts back to dollars for response
      return res.status(200).json({
        success: true,
        preview: {
          totalRevenue: preview.totalRevenue / 100,
          tokenizationPercentage: preview.tokenizationPercentage,
          farmerShare: {
            base: preview.farmerShare.base / 100,
            unsoldBonus: preview.farmerShare.unsoldBonus / 100,
            total: preview.farmerShare.total / 100,
            percentage: preview.farmerShare.percentage
          },
          investorShare: {
            total: preview.investorShare.total / 100,
            perToken: preview.investorShare.perToken / 100,
            percentage: preview.investorShare.percentage
          }
        }
      });

    } catch (error: any) {
      console.error('Error generating revenue preview:', error);

      // Handle specific errors
      if (error.message?.includes('Grove not found')) {
        return res.status(404).json({
          success: false,
          error: 'Grove not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate revenue preview'
      });
    }
  }

  // Market overview endpoint - return mock data
  if (url.includes('/market/overview')) {
    return res.status(200).json({
      success: true,
      totalGroves: 42,
      totalInvestors: 156,
      totalFarmers: 89,
      totalValueLocked: 2450000,
      averageYield: 8.5
    });
  }

  // Market prices endpoint - return mock data
  if (url.includes('/market/prices')) {
    return res.status(200).json({
      success: true,
      prices: [
        { variety: 'Arabica', price: 4.50, change: 2.3 },
        { variety: 'Robusta', price: 2.80, change: -1.2 },
        { variety: 'Specialty', price: 6.25, change: 3.5 }
      ],
      lastUpdated: new Date().toISOString()
    });
  }

  // Transaction history endpoint (GET /transactions/history?userAddress=xxx or /transactions/history/:address)
  if (url.includes('/transactions/history') && req.method === 'GET') {
    try {
      // Support both query parameter and path parameter formats
      const urlObj = new URL(url, `http://localhost`);
      const queryAddress = urlObj.searchParams.get('userAddress');
      const pathAddress = url.includes('/transactions/history/') ? url.split('/transactions/history/')[1]?.split('?')[0] : null;
      const address = queryAddress || pathAddress;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'User address required (provide userAddress query parameter or use /transactions/history/:address)'
        });
      }

      // Parse query parameters (urlObj already created above)
      const type = urlObj.searchParams.get('type') || undefined;
      const startDateParam = urlObj.searchParams.get('startDate');
      const endDateParam = urlObj.searchParams.get('endDate');
      const limitParam = urlObj.searchParams.get('limit');

      // Validate and parse numeric parameters
      const startDate = startDateParam ? parseInt(startDateParam) : undefined;
      const endDate = endDateParam ? parseInt(endDateParam) : undefined;
      const limit = limitParam ? parseInt(limitParam) : 50;

      // Validate date parameters if provided
      if (startDateParam && (isNaN(startDate!) || startDate! < 0)) {
        return res.status(400).json({
          success: false,
          error: 'startDate must be a valid timestamp'
        });
      }

      if (endDateParam && (isNaN(endDate!) || endDate! < 0)) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be a valid timestamp'
        });
      }

      if (limitParam && (isNaN(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({
          success: false,
          error: 'limit must be a number between 1 and 100'
        });
      }

      // Import and call TransactionRecorder service
      const { getTransactionHistory } = await import('../lib/services/transaction-recorder.js');

      const transactions = await getTransactionHistory({
        userAddress: address,
        type,
        startDate,
        endDate,
        limit
      });

      // Convert amounts from cents to dollars for response
      const formattedTransactions = transactions.map(txn => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount / 100, // Convert from cents to dollars
        asset: txn.asset,
        fromAddress: txn.fromAddress,
        toAddress: txn.toAddress,
        status: txn.status,
        timestamp: txn.timestamp,
        transactionHash: txn.transactionHash,
        blockExplorerUrl: txn.blockExplorerUrl,
        metadata: txn.metadata ? JSON.parse(txn.metadata) : null
      }));

      return res.status(200).json({
        success: true,
        transactions: formattedTransactions,
        total: formattedTransactions.length
      });

    } catch (error: any) {
      console.error('Error fetching transaction history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch transaction history',
        transactions: []
      });
    }
  }

  // Credit score endpoint
  if (url.includes('/credit-score/')) {
    const { db } = await import('../db/index.js');
    const { creditScores } = await import('../db/schema/index.js');
    const { getCreditTier } = await import('../lib/credit-scoring/calculator.js');
    const { eq } = await import('drizzle-orm');

    const account = url.split('/credit-score/')[1]?.split('?')[0];

    if (!account) {
      return res.status(400).json({ error: 'Account address required' });
    }

    try {
      const score = await db.query.creditScores.findFirst({
        where: eq(creditScores.account, account)
      });

      if (!score) {
        return res.status(404).json({
          error: 'Credit score not found',
          message: 'No credit history for this account'
        });
      }

      const tierInfo = getCreditTier(score.currentScore);

      return res.status(200).json({
        account: score.account,
        currentScore: score.currentScore,
        tier: tierInfo.tier,
        maxLoanAmount: tierInfo.maxLoanAmount,
        totalLoans: score.totalLoans,
        onTimePayments: score.onTimePayments,
        earlyPayments: score.earlyPayments,
        latePayments: score.latePayments,
        lastUpdated: score.lastUpdated
      });
    } catch (error) {
      console.error('Error fetching credit score:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Investor balance endpoint (GET /investor/balance/:address)
  if (url.includes('/investor/balance/') && req.method === 'GET') {
    try {
      const address = url.split('/investor/balance/')[1]?.split('?')[0];

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Investor address required'
        });
      }

      // Validate address format (basic Hedera account ID format: 0.0.xxxxx)
      if (!address.match(/^0\.0\.\d+$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxx'
        });
      }

      // Import and call InvestorWithdrawalService
      const { investorWithdrawalService } = await import('../lib/services/investor-withdrawal-service.js');

      const balance = await investorWithdrawalService.getBalance(address);

      // Convert amounts from cents to dollars for response
      return res.status(200).json({
        success: true,
        balance: {
          totalEarned: balance.totalEarned / 100,
          totalWithdrawn: balance.totalWithdrawn / 100,
          availableBalance: balance.availableBalance / 100,
          pendingDistributions: balance.pendingDistributions
        }
      });

    } catch (error: any) {
      console.error('Error fetching investor balance:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch investor balance'
      });
    }
  }

  // Investor withdrawal endpoint (POST /investor/withdraw)
  if (url.includes('/api/investor/withdraw') && req.method === 'POST') {
    try {
      const { investorAddress, amount } = req.body;

      // Validate request body
      if (!investorAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: investorAddress'
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: amount'
        });
      }

      // Validate address format (basic Hedera account ID format: 0.0.xxxxx)
      if (!investorAddress.match(/^0\.0\.\d+$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxx'
        });
      }

      // Validate amount is a positive number
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        });
      }

      console.log(`💰 Investor withdrawal request: ${investorAddress} wants to withdraw $${amount.toFixed(2)}`);

      // Import and call InvestorWithdrawalService
      const { investorWithdrawalService } = await import('../lib/services/investor-withdrawal-service.js');

      // Convert amount from dollars to cents for internal processing
      const amountInCents = Math.floor(amount * 100);

      const result = await investorWithdrawalService.processWithdrawal({
        investorAddress,
        amount: amountInCents
      });

      if (!result.success) {
        // Determine appropriate status code and error message based on error type
        let statusCode = 400;
        let errorMessage = result.error || 'Failed to process withdrawal';

        // Check for specific error types
        if (errorMessage.includes('Insufficient balance')) {
          statusCode = 400; // Bad request - insufficient funds
        } else if (errorMessage.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT') ||
          errorMessage.includes('not associated') ||
          errorMessage.includes('associate the USDC token')) {
          statusCode = 400; // Bad request - token not associated
          errorMessage = 'USDC token not associated with your account. Please associate the USDC token (0.0.7144320) with your wallet before withdrawing.';
        } else if (errorMessage.includes('INSUFFICIENT_ACCOUNT_BALANCE') ||
          errorMessage.includes('insufficient treasury balance')) {
          statusCode = 503; // Service unavailable - treasury issue
          errorMessage = 'Platform treasury has insufficient balance. Please contact support.';
        } else if (errorMessage.includes('INVALID_ACCOUNT_ID')) {
          statusCode = 400; // Bad request - invalid address
          errorMessage = 'Invalid Hedera account ID';
        } else {
          statusCode = 500; // Internal server error for other failures
        }

        console.error(`❌ Withdrawal failed: ${errorMessage}`);

        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          status: result.status
        });
      }

      console.log(`✅ Withdrawal completed successfully`);
      console.log(`   Transaction ID: ${result.transactionId}`);
      console.log(`   Explorer: ${result.blockExplorerUrl}`);

      // Return withdrawal details with transaction info
      return res.status(200).json({
        success: true,
        withdrawal: {
          investorAddress,
          amount: amount, // Return in dollars
          status: 'completed',
          transactionId: result.transactionId,
          transactionHash: result.transactionHash,
          blockExplorerUrl: result.blockExplorerUrl,
          timestamp: Date.now()
        },
        message: `Successfully withdrew $${amount.toFixed(2)} USDC`
      });

    } catch (error: any) {
      console.error('❌ Error processing investor withdrawal:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal'
      });
    }
  }

  // Investor withdrawal history endpoint (GET /investor/withdrawals/:address)
  if (url.includes('/api/investor/withdrawals/') && req.method === 'GET') {
    try {
      const address = url.split('/investor/withdrawals/')[1]?.split('?')[0];

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Investor address required'
        });
      }

      // Validate address format (basic Hedera account ID format: 0.0.xxxxx)
      if (!address.match(/^0\.0\.\d+$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxx'
        });
      }

      console.log(`📜 Fetching withdrawal history for investor: ${address}`);

      // Import and call InvestorWithdrawalService
      const { investorWithdrawalService } = await import('../lib/services/investor-withdrawal-service.js');

      const withdrawals = await investorWithdrawalService.getWithdrawalHistory(address);

      // Convert amounts from cents to dollars and add HashScan links
      const formattedWithdrawals = withdrawals.map(withdrawal => {
        const network = process.env.HEDERA_NETWORK || 'testnet';
        const hashScanUrl = withdrawal.transactionId
          ? `https://hashscan.io/${network}/transaction/${withdrawal.transactionId}`
          : withdrawal.blockExplorerUrl;

        return {
          id: withdrawal.id,
          amount: withdrawal.amount / 100, // Convert from cents to dollars
          status: withdrawal.status,
          transactionId: withdrawal.transactionId,
          transactionHash: withdrawal.transactionHash,
          blockExplorerUrl: hashScanUrl,
          errorMessage: withdrawal.errorMessage,
          requestedAt: withdrawal.requestedAt,
          completedAt: withdrawal.completedAt,
          date: new Date(withdrawal.requestedAt).toISOString()
        };
      });

      console.log(`✅ Found ${formattedWithdrawals.length} withdrawal records`);

      return res.status(200).json({
        success: true,
        withdrawals: formattedWithdrawals,
        total: formattedWithdrawals.length
      });

    } catch (error: any) {
      console.error('❌ Error fetching investor withdrawal history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch withdrawal history',
        withdrawals: []
      });
    }
  }

  // Investor transaction history endpoint (GET /investor/transactions/:address)
  if (url.includes('/investor/transactions/') && req.method === 'GET') {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const address = url.split('/investor/transactions/')[1]?.split('?')[0];

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Investor address required'
        });
      }

      // Validate address format (basic Hedera account ID format: 0.0.xxxxx)
      if (!address.match(/^0\.0\.\d+$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxx'
        });
      }

      console.log(`📜 Fetching transaction history for investor: ${address}`);

      // Query token purchases (Requirements: 5.1)
      const purchases = await db.all(sql`
        SELECT 
          th.id,
          th.purchasePrice as amount,
          th.purchaseDate as timestamp,
          'purchase' as type,
          'completed' as status,
          g.grove_name as groveName,
          g.token_symbol as tokenSymbol,
          th.tokenAmount
        FROM token_holdings th
        LEFT JOIN coffee_groves g ON th.groveId = g.id
        WHERE th.holderAddress = ${address}
        ORDER BY th.purchaseDate DESC
      `);

      // Query revenue distributions (Requirements: 5.2)
      const distributions = await db.all(sql`
        SELECT 
          rd.id,
          rd.revenueShare as amount,
          rd.distributionDate as timestamp,
          'distribution' as type,
          COALESCE(rd.payment_status, 'completed') as status,
          rd.transaction_id as transactionId,
          rd.transactionHash,
          h.id as harvestId,
          g.grove_name as groveName
        FROM revenue_distributions rd
        LEFT JOIN harvest_records h ON rd.harvestId = h.id
        LEFT JOIN coffee_groves g ON h.grove_id = g.id
        WHERE rd.holderAddress = ${address}
        ORDER BY rd.distributionDate DESC
      `);

      // Query withdrawals (Requirements: 5.3)
      const withdrawals = await db.all(sql`
        SELECT 
          iw.id,
          iw.amount,
          iw.requested_at as timestamp,
          'withdrawal' as type,
          iw.status,
          iw.transaction_id as transactionId,
          iw.transaction_hash as transactionHash,
          iw.block_explorer_url as blockExplorerUrl
        FROM investor_withdrawals iw
        WHERE iw.investor_address = ${address}
        ORDER BY iw.requested_at DESC
      `);

      // Combine all transactions (Requirements: 5.4)
      const allTransactions = [
        ...purchases.map((p: any) => ({
          id: `purchase_${p.id}`,
          type: 'purchase',
          amount: p.amount / 100, // Convert from cents to dollars
          description: `Purchased ${p.tokenAmount} ${p.tokenSymbol || 'tokens'} from ${p.groveName || 'grove'}`,
          status: p.status,
          timestamp: p.timestamp,
          date: new Date(p.timestamp).toISOString(),
          metadata: {
            groveName: p.groveName,
            tokenSymbol: p.tokenSymbol,
            tokenAmount: p.tokenAmount
          }
        })),
        ...distributions.map((d: any) => ({
          id: `distribution_${d.id}`,
          type: 'distribution',
          amount: d.amount / 100, // Convert from cents to dollars
          description: `Revenue distribution from ${d.groveName || 'grove'}`,
          status: d.status,
          timestamp: d.timestamp,
          date: new Date(d.timestamp).toISOString(),
          transactionId: d.transactionId,
          transactionHash: d.transactionHash,
          blockExplorerUrl: d.transactionId
            ? `https://hashscan.io/${process.env.HEDERA_NETWORK || 'testnet'}/transaction/${d.transactionId}`
            : undefined,
          metadata: {
            harvestId: d.harvestId,
            groveName: d.groveName
          }
        })),
        ...withdrawals.map((w: any) => ({
          id: `withdrawal_${w.id}`,
          type: 'withdrawal',
          amount: w.amount / 100, // Convert from cents to dollars
          description: `Withdrawal to wallet`,
          status: w.status,
          timestamp: w.timestamp,
          date: new Date(w.timestamp).toISOString(),
          transactionId: w.transactionId,
          transactionHash: w.transactionHash,
          blockExplorerUrl: w.blockExplorerUrl || (w.transactionId
            ? `https://hashscan.io/${process.env.HEDERA_NETWORK || 'testnet'}/transaction/${w.transactionId}`
            : undefined)
        }))
      ];

      // Sort by timestamp in descending order (Requirements: 5.4)
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`✅ Found ${allTransactions.length} total transactions (${purchases.length} purchases, ${distributions.length} distributions, ${withdrawals.length} withdrawals)`);

      // Format response (Requirements: 5.5)
      return res.status(200).json({
        success: true,
        transactions: allTransactions,
        summary: {
          totalTransactions: allTransactions.length,
          totalPurchases: purchases.length,
          totalDistributions: distributions.length,
          totalWithdrawals: withdrawals.length
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching investor transaction history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch transaction history',
        transactions: []
      });
    }
  }

  // Investor earnings endpoints - return empty data
  if (url.includes('/investor/earnings/unclaimed/')) {
    return res.status(200).json({
      success: true,
      unclaimed: [],
      total: 0
    });
  }

  // Harvest holder earnings - return empty data
  if (url.includes('/harvest/holder/') && url.includes('/earnings')) {
    return res.status(200).json({
      success: true,
      earnings: [],
      total: 0
    });
  }

  // Revenue distribution endpoints - return empty data
  if (url.includes('/revenue/pending-distributions')) {
    return res.status(200).json({
      success: true,
      distributions: [],
      total: 0
    });
  }

  if (url.includes('/revenue/distribution-history')) {
    return res.status(200).json({
      success: true,
      history: [],
      total: 0
    });
  }

  // Lending pools - return mock data for demo
  if (url.includes('/lending/pools')) {
    return res.status(200).json({
      success: true,
      pools: [
        {
          assetAddress: '0.0.7144320', // USDC token
          assetName: 'USDC Liquidity Pool',
          assetSymbol: 'USDC',
          currentAPY: 12.5,
          totalLiquidity: 500000,
          availableLiquidity: 350000,
          totalBorrowed: 150000,
          utilizationRate: 30,
          totalLPTokens: 500000,
          lpTokenAddress: '0.0.7144321' // Mock LP token
        },
        {
          assetAddress: '0.0.7144320',
          assetName: 'High Yield USDC Pool',
          assetSymbol: 'USDC',
          currentAPY: 18.75,
          totalLiquidity: 250000,
          availableLiquidity: 100000,
          totalBorrowed: 150000,
          utilizationRate: 60,
          totalLPTokens: 250000,
          lpTokenAddress: '0.0.7144322' // Mock LP token
        }
      ]
    });
  }

  // Liquidity positions - return mock data for demo
  if (url.includes('/lending/liquidity-positions/')) {
    const address = url.split('/liquidity-positions/')[1]?.split('?')[0];

    return res.status(200).json({
      success: true,
      demoMode: true,
      positions: [
        {
          id: 1,
          poolAddress: '0.0.7144320',
          poolName: 'USDC Liquidity Pool',
          lpTokenBalance: 10000,
          lpTokenPrice: 1.05,
          initialInvestment: 10000,
          currentAPY: 12.5,
          earnedInterest: 500,
          depositDate: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      ]
    });
  }

  // Investment portfolio - get token holdings for investor
  if (url.includes('/investment/portfolio')) {
    const { db } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');

    try {
      const urlObj = new URL(url, `http://localhost`);
      const investorAddress = urlObj.searchParams.get('investorAddress');

      if (!investorAddress) {
        return res.status(400).json({
          success: false,
          error: 'investorAddress is required'
        });
      }

      // Use raw SQL to avoid Drizzle column name mapping issues
      const holdings = await db.all(sql`
        SELECT 
          th.id,
          th.groveId,
          th.tokenAmount,
          th.purchasePrice,
          th.purchaseDate,
          cg.grove_name as groveName,
          cg.token_symbol as tokenSymbol,
          cg.total_tokens_issued as totalTokensIssued,
          cg.tokens_sold as tokensSold
        FROM token_holdings th
        LEFT JOIN coffee_groves cg ON th.groveId = cg.id
        WHERE th.holderAddress = ${investorAddress}
          AND th.isActive = 1
      `);

      // Calculate portfolio metrics
      const totalInvestment = holdings.reduce((sum: number, h: any) => sum + (h.purchasePrice || 0), 0);
      const currentValue = totalInvestment; // For now, use purchase price as current value
      const totalReturns = 0; // Will be calculated from revenue distributions
      const roi = totalInvestment > 0 ? ((currentValue - totalInvestment) / totalInvestment) * 100 : 0;

      return res.status(200).json({
        success: true,
        portfolio: {
          holdings: holdings.map((h: any) => {
            // Calculate per-token price from total purchase
            const pricePerToken = h.tokenAmount > 0 ? h.purchasePrice / h.tokenAmount : 0;

            return {
              id: h.id,
              groveId: h.groveId,
              groveName: h.groveName || 'Unknown Grove',
              tokenSymbol: h.tokenSymbol || 'GROVE',
              tokenAmount: h.tokenAmount,
              purchasePrice: pricePerToken, // Per-token price for frontend calculations
              totalPurchasePrice: h.purchasePrice, // Total amount paid
              purchaseDate: h.purchaseDate,
              currentValue: h.purchasePrice, // For now, same as purchase price
              totalTokensIssued: h.totalTokensIssued,
              tokensSold: h.tokensSold,
              ownershipPercentage: h.totalTokensIssued > 0
                ? parseFloat(((h.tokenAmount / h.totalTokensIssued) * 100).toFixed(2))
                : 0
            };
          }),
          totalInvestment,
          currentValue,
          totalReturns,
          roi // Return as number, not string
        }
      });
    } catch (error: any) {
      console.error('Error fetching portfolio:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch portfolio'
      });
    }
  }

  // Investment available groves - return tokenized groves available for investment
  if (url.includes('/investment/available-groves')) {
    const { db } = await import('../db/index.js');
    const { coffeeGroves } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    try {
      // Get all tokenized groves
      const groves = await db.query.coffeeGroves.findMany({
        where: eq(coffeeGroves.isTokenized, true)
      });

      // Map to include availability and pricing information
      const availableGroves = groves.map(grove => {
        const tokensAvailable = (grove.totalTokensIssued || 0) - (grove.tokensSold || 0);
        const totalTokens = grove.totalTokensIssued || 1;

        // Calculate price per token (default $1.00, or based on tree value)
        // Assuming each tree is worth ~$100 and produces tokens
        const pricePerToken = grove.tokensPerTree > 0
          ? (100 / grove.tokensPerTree) // $100 per tree / tokens per tree
          : 1.00; // Default $1 per token

        // Calculate projected annual return based on expected yield
        // Assuming coffee sells for ~$3/kg and 70% goes to investors
        const expectedAnnualYield = (grove.treeCount || 0) * (grove.expectedYieldPerTree || 0);
        const expectedRevenue = expectedAnnualYield * 3; // $3 per kg
        const investorShare = expectedRevenue * 0.7; // 70% to investors
        const totalInvestment = totalTokens * pricePerToken;
        const projectedAnnualReturn = totalInvestment > 0
          ? ((investorShare / totalInvestment) * 100).toFixed(1)
          : '15.0'; // Default 15% if can't calculate

        return {
          id: grove.id,
          groveName: grove.groveName,
          farmerAddress: grove.farmerAddress,
          location: grove.location,
          latitude: grove.coordinatesLat,
          longitude: grove.coordinatesLng,
          treeCount: grove.treeCount,
          coffeeVariety: grove.coffeeVariety,
          plantingDate: grove.plantingDate,
          expectedYieldPerTree: grove.expectedYieldPerTree,
          tokenAddress: grove.tokenAddress,
          tokenSymbol: grove.tokenSymbol,
          totalTokensIssued: grove.totalTokensIssued,
          tokensSold: grove.tokensSold,
          tokensAvailable,
          tokensPerTree: grove.tokensPerTree,
          verificationStatus: grove.verificationStatus,
          currentHealthScore: grove.currentHealthScore,
          healthScore: grove.currentHealthScore || 0,
          isTokenized: grove.isTokenized,
          tokenizedAt: grove.tokenizedAt,
          createdAt: grove.createdAt,
          // New calculated fields for frontend
          pricePerToken: parseFloat(pricePerToken.toFixed(2)),
          projectedAnnualReturn: parseFloat(projectedAnnualReturn)
        };
      });

      return res.status(200).json({
        success: true,
        groves: availableGroves
      });
    } catch (error: any) {
      console.error('Error fetching available groves:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch available groves',
        groves: []
      });
    }
  }

  // Investment purchase tokens - redirect to /tokens/purchase endpoint
  if (url.includes('/investment/purchase-tokens') && req.method === 'POST') {
    try {
      const { investorAddress, groveId, tokenAmount, termsAccepted, termsVersion } = req.body;

      // Validate request body
      if (!investorAddress || !groveId || !tokenAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: investorAddress, groveId, tokenAmount'
        });
      }

      // Check if this is investor's first purchase and validate terms acceptance
      const { db } = await import('../db/index.js');
      const { investorProfiles, tokenHoldings } = await import('../db/schema/index.js');
      const { eq } = await import('drizzle-orm');

      // Check if investor has any existing holdings
      const existingHoldings = await db.select()
        .from(tokenHoldings)
        .where(eq(tokenHoldings.holderAddress, investorAddress))
        .limit(1);

      // If first purchase, require terms acceptance
      if (existingHoldings.length === 0 && !termsAccepted) {
        return res.status(400).json({
          success: false,
          error: 'Terms and Conditions must be accepted before making your first investment'
        });
      }

      // Record terms acceptance for investor if this is their first purchase
      if (existingHoldings.length === 0 && termsAccepted) {
        try {
          // Check if investor profile exists
          const existingProfile = await db.select()
            .from(investorProfiles)
            .where(eq(investorProfiles.investorAddress, investorAddress))
            .limit(1);

          if (existingProfile.length > 0) {
            // Update existing profile
            await db.update(investorProfiles)
              .set({
                termsAcceptedAt: Date.now(),
                termsVersion: termsVersion || '1.0',
                termsIpAddress: req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown',
                updatedAt: Date.now()
              })
              .where(eq(investorProfiles.investorAddress, investorAddress));
          } else {
            // Create new profile with terms acceptance
            await db.insert(investorProfiles).values({
              investorAddress,
              termsAcceptedAt: Date.now(),
              termsVersion: termsVersion || '1.0',
              termsIpAddress: req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown',
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
          console.log(`✅ Terms acceptance recorded for investor ${investorAddress}`);
        } catch (termsError) {
          console.warn('⚠️ Could not record terms acceptance:', termsError);
          // Don't fail the purchase if terms recording fails
        }
      }

      // Calculate payment amount (for now, use a simple calculation or default)
      // In a real system, this would come from pricing logic
      const paymentAmount = tokenAmount * 100; // Example: 100 cents per token

      // Import and call TokenPurchaseService
      const { tokenPurchaseService } = await import('../lib/services/token-purchase-service.js');

      const result = await tokenPurchaseService.purchaseTokensPrimary({
        investorAddress,
        groveId,
        tokenAmount,
        paymentAmount
      });

      if (!result.success) {
        let statusCode = 400;
        if (result.error?.includes('not found')) {
          statusCode = 404;
        } else if (result.error?.includes('Insufficient tokens')) {
          statusCode = 409;
        }

        return res.status(statusCode).json({
          success: false,
          error: result.error,
          availableTokens: result.availableTokens
        });
      }

      return res.status(200).json({
        success: true,
        holding: result.holding,
        availableTokens: result.availableTokens,
        message: 'Token purchase completed successfully'
      });

    } catch (error: any) {
      console.error('Error processing token purchase:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process token purchase'
      });
    }
  }

  // ========================================
  // MARKETPLACE ENDPOINTS (Peer-to-Peer Trading)
  // ========================================

  // GET /api/marketplace/listings - Get all active listings
  if (url.includes('/api/marketplace/listings') && req.method === 'GET') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const listings = await marketplaceService.getActiveListings();
      
      return res.status(200).json({
        success: true,
        listings
      });
    } catch (error: any) {
      console.error('Error fetching marketplace listings:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch marketplace listings'
      });
    }
  }

  // GET /api/marketplace/listings/user/:address - Get user's listings
  if (url.includes('/api/marketplace/listings/user/') && req.method === 'GET') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const userAddress = url.split('/user/')[1]?.split('?')[0];
      
      if (!userAddress) {
        return res.status(400).json({
          success: false,
          error: 'User address is required'
        });
      }

      const listings = await marketplaceService.getUserListings(userAddress);
      
      return res.status(200).json({
        success: true,
        listings
      });
    } catch (error: any) {
      console.error('Error fetching user listings:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch user listings'
      });
    }
  }

  // POST /api/marketplace/list - List tokens for sale
  if (url.includes('/api/marketplace/list') && req.method === 'POST') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const { sellerAddress, tokenAddress, groveName, tokenAmount, pricePerToken, durationDays } = req.body;

      if (!sellerAddress || !tokenAddress || !groveName || !tokenAmount || !pricePerToken || !durationDays) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const result = await marketplaceService.listTokensForSale(
        sellerAddress,
        tokenAddress,
        groveName,
        tokenAmount,
        pricePerToken,
        durationDays
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error listing tokens:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list tokens'
      });
    }
  }

  // POST /api/marketplace/purchase/:listingId - Purchase tokens
  if (url.includes('/api/marketplace/purchase/') && req.method === 'POST') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const listingId = parseInt(url.split('/purchase/')[1]?.split('?')[0] || '0');
      const { buyerAddress } = req.body;

      if (!buyerAddress || !listingId) {
        return res.status(400).json({
          success: false,
          error: 'Buyer address and listing ID are required'
        });
      }

      const result = await marketplaceService.purchaseTokens(buyerAddress, listingId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error purchasing tokens:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to purchase tokens'
      });
    }
  }

  // POST /api/marketplace/cancel/:listingId - Cancel listing
  if (url.includes('/api/marketplace/cancel/') && req.method === 'POST') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const listingId = parseInt(url.split('/cancel/')[1]?.split('?')[0] || '0');
      const { sellerAddress } = req.body;

      if (!sellerAddress || !listingId) {
        return res.status(400).json({
          success: false,
          error: 'Seller address and listing ID are required'
        });
      }

      const result = await marketplaceService.cancelListing(sellerAddress, listingId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error cancelling listing:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel listing'
      });
    }
  }

  // GET /api/marketplace/trades/:address - Get user's trade history
  if (url.includes('/api/marketplace/trades/') && req.method === 'GET') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const userAddress = url.split('/trades/')[1]?.split('?')[0];
      
      if (!userAddress) {
        return res.status(400).json({
          success: false,
          error: 'User address is required'
        });
      }

      const trades = await marketplaceService.getUserTrades(userAddress);
      
      return res.status(200).json({
        success: true,
        trades
      });
    } catch (error: any) {
      console.error('Error fetching trade history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch trade history'
      });
    }
  }

  // GET /api/marketplace/stats - Get marketplace statistics
  if (url.includes('/api/marketplace/stats') && req.method === 'GET') {
    try {
      const { marketplaceService } = await import('../lib/api/marketplace-service.js');
      const stats = await marketplaceService.getMarketplaceStats();
      
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error('Error fetching marketplace stats:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch marketplace stats'
      });
    }
  }

  // Harvest history - return empty data
  if (url.includes('/harvest/history')) {
    return res.status(200).json({
      success: true,
      harvests: []
    });
  }

  // ========================================
  // FUNDING REQUEST ENDPOINTS
  // ========================================

  // POST /api/funding/request - Create funding request
  if (url.includes('/funding/request') && req.method === 'POST' && !url.includes('/requests/')) {
    try {
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const { groveId, farmerAddress, milestoneType, amount, purpose } = req.body;

      const result = await fundingRequestService.createRequest({
        groveId,
        farmerAddress,
        milestoneType,
        amount,
        purpose
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      return res.status(201).json({
        success: true,
        requestId: result.requestId,
        message: 'Funding request created successfully'
      });
    } catch (error: any) {
      console.error('[API] Error creating funding request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create funding request'
      });
    }
  }

  // GET /api/funding/requests/:address - Get farmer's requests
  if (url.includes('/funding/requests/') && req.method === 'GET') {
    try {
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const address = url.split('/funding/requests/')[1]?.split('?')[0];

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Farmer address is required'
        });
      }

      const requests = await fundingRequestService.getFarmerRequests(address);

      return res.status(200).json({
        success: true,
        requests
      });
    } catch (error: any) {
      console.error('[API] Error getting farmer requests:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get requests'
      });
    }
  }

  // GET /api/funding/pool/:groveId - Get funding pool info
  if (url.includes('/funding/pool/') && req.method === 'GET') {
    try {
      const { fundingPoolService } = await import('../lib/services/funding-pool-service.js');
      const groveId = parseInt(url.split('/funding/pool/')[1]?.split('?')[0] || '0');

      if (!groveId) {
        return res.status(400).json({
          success: false,
          error: 'Grove ID is required'
        });
      }

      const funds = await fundingPoolService.getAvailableFunds(groveId);

      if (!funds) {
        return res.status(404).json({
          success: false,
          error: 'Funding pool not found for this grove'
        });
      }

      return res.status(200).json({
        success: true,
        funds
      });
    } catch (error: any) {
      console.error('[API] Error getting funding pool:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get funding pool'
      });
    }
  }

  // GET /api/funding/request/:id - Get request details
  if (url.match(/\/funding\/request\/\d+$/) && req.method === 'GET') {
    try {
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const requestId = parseInt(url.split('/funding/request/')[1] || '0');

      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
      }

      const request = await fundingRequestService.getRequestById(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }

      return res.status(200).json({
        success: true,
        request
      });
    } catch (error: any) {
      console.error('[API] Error getting request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get request'
      });
    }
  }

  // GET /api/funding/document/:id - Download document
  if (url.match(/\/funding\/document\/\d+$/) && req.method === 'GET') {
    try {
      const { getDocumentStorageService } = await import('../lib/services/document-storage-service.js');
      const documentStorageService = getDocumentStorageService();
      const { fundingRequestDocuments } = await import('../db/schema/index.js');
      const { db } = await import('../db/index.js');
      const { eq } = await import('drizzle-orm');
      
      const documentId = parseInt(url.split('/funding/document/')[1] || '0');

      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
      }

      // Get document metadata
      const document = await db.query.fundingRequestDocuments.findFirst({
        where: eq(fundingRequestDocuments.id, documentId)
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Get file from storage
      const fileBuffer = await documentStorageService.getDocument(document.storagePath);

      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.setHeader('Content-Length', document.fileSize.toString());

      return res.status(200).send(fileBuffer);
    } catch (error: any) {
      console.error('[API] Error downloading document:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to download document'
      });
    }
  }

  // DELETE /api/funding/request/:id - Cancel pending request
  if (url.match(/\/funding\/request\/\d+$/) && req.method === 'DELETE') {
    try {
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const requestId = parseInt(url.split('/funding/request/')[1] || '0');
      const farmerAddress = req.headers['x-account-id'] as string;

      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
      }

      if (!farmerAddress) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const result = await fundingRequestService.cancelRequest(requestId, farmerAddress);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Request cancelled successfully'
      });
    } catch (error: any) {
      console.error('[API] Error cancelling request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel request'
      });
    }
  }

  // ========================================
  // ADMIN FUNDING ENDPOINTS
  // ========================================

  // GET /api/admin/funding/pending - Get pending requests
  if (url.includes('/admin/funding/pending') && req.method === 'GET') {
    try {
      const { isAdmin } = await import('../lib/middleware/admin-auth.js');
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const adminAddress = req.headers['x-account-id'] as string;

      if (!isAdmin(adminAddress)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const requests = await fundingRequestService.getPendingRequests();

      return res.status(200).json({
        success: true,
        requests
      });
    } catch (error: any) {
      console.error('[API] Error getting pending requests:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending requests'
      });
    }
  }

  // GET /api/admin/funding/request/:id - Get full request details
  if (url.match(/\/admin\/funding\/request\/\d+$/) && req.method === 'GET') {
    try {
      const { isAdmin } = await import('../lib/middleware/admin-auth.js');
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const adminAddress = req.headers['x-account-id'] as string;

      if (!isAdmin(adminAddress)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const requestId = parseInt(url.split('/admin/funding/request/')[1] || '0');

      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
      }

      const request = await fundingRequestService.getRequestById(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }

      return res.status(200).json({
        success: true,
        request
      });
    } catch (error: any) {
      console.error('[API] Error getting request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get request'
      });
    }
  }

  // POST /api/admin/funding/approve/:id - Approve request
  if (url.match(/\/admin\/funding\/approve\/\d+$/) && req.method === 'POST') {
    try {
      const { isAdmin } = await import('../lib/middleware/admin-auth.js');
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const adminAddress = req.headers['x-account-id'] as string;

      if (!isAdmin(adminAddress)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const requestId = parseInt(url.split('/admin/funding/approve/')[1] || '0');
      const { notes } = req.body || {};

      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
      }

      // Approve request
      const approveResult = await fundingRequestService.approveRequest(requestId, adminAddress, notes);

      if (!approveResult.success) {
        return res.status(400).json({
          success: false,
          error: approveResult.error
        });
      }

      // Disburse funds
      const disburseResult = await fundingRequestService.disburseFunds(requestId);

      if (!disburseResult.success) {
        return res.status(500).json({
          success: false,
          error: `Request approved but disbursement failed: ${disburseResult.error}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Request approved and funds disbursed',
        transactionId: disburseResult.transactionId
      });
    } catch (error: any) {
      console.error('[API] Error approving request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to approve request'
      });
    }
  }

  // POST /api/admin/funding/reject/:id - Reject request
  if (url.match(/\/admin\/funding\/reject\/\d+$/) && req.method === 'POST') {
    try {
      const { isAdmin } = await import('../lib/middleware/admin-auth.js');
      const { fundingRequestService } = await import('../lib/services/funding-request-service.js');
      const adminAddress = req.headers['x-account-id'] as string;

      if (!isAdmin(adminAddress)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const requestId = parseInt(url.split('/admin/funding/reject/')[1] || '0');
      const { reason } = req.body || {};

      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }

      const result = await fundingRequestService.rejectRequest(requestId, adminAddress, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Request rejected successfully'
      });
    } catch (error: any) {
      console.error('[API] Error rejecting request:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to reject request'
      });
    }
  }

  // GET /api/admin/funding/fees - Get platform fee summary
  if (url.includes('/admin/funding/fees') && req.method === 'GET') {
    try {
      const { isAdmin } = await import('../lib/middleware/admin-auth.js');
      const { db } = await import('../db/index.js');
      const { platformFees } = await import('../db/schema/index.js');
      const { sql } = await import('drizzle-orm');
      const adminAddress = req.headers['x-account-id'] as string;

      if (!isAdmin(adminAddress)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      // Get total fees collected
      const totalResult = await db.get(sql`
        SELECT 
          COALESCE(SUM(fee_amount), 0) as totalFees,
          COUNT(*) as totalRequests
        FROM platform_fees
      `);

      // Get fees by grove
      const byGrove = await db.all(sql`
        SELECT 
          pf.grove_id as groveId,
          g.grove_name as groveName,
          COALESCE(SUM(pf.fee_amount), 0) as totalFees,
          COUNT(*) as requestCount
        FROM platform_fees pf
        LEFT JOIN coffee_groves g ON pf.grove_id = g.id
        GROUP BY pf.grove_id, g.grove_name
        ORDER BY totalFees DESC
      `);

      return res.status(200).json({
        success: true,
        summary: {
          totalFees: (totalResult?.totalFees || 0) / 100,
          totalRequests: totalResult?.totalRequests || 0,
          byGrove: byGrove.map((g: any) => ({
            groveId: g.groveId,
            groveName: g.groveName || 'Unknown Grove',
            totalFees: g.totalFees / 100,
            requestCount: g.requestCount
          }))
        }
      });
    } catch (error: any) {
      console.error('[API] Error getting fees:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get fees'
      });
    }
  }

  // ========================================
  // INVESTOR TRANSPARENCY ENDPOINTS
  // ========================================

  // GET /api/funding/grove/:groveId/history - Get public funding history
  if (url.match(/\/funding\/grove\/\d+\/history$/) && req.method === 'GET') {
    try {
      const { db } = await import('../db/index.js');
      const { fundingRequests } = await import('../db/schema/index.js');
      const { eq, and } = await import('drizzle-orm');
      
      const groveId = parseInt(url.split('/funding/grove/')[1]?.split('/history')[0] || '0');

      if (!groveId) {
        return res.status(400).json({
          success: false,
          error: 'Grove ID is required'
        });
      }

      // Get approved/disbursed requests only (public info)
      const requests = await db.select({
        id: fundingRequests.id,
        milestoneType: fundingRequests.milestoneType,
        amountApproved: fundingRequests.amountApproved,
        purpose: fundingRequests.purpose,
        status: fundingRequests.status,
        disbursedAt: fundingRequests.disbursedAt,
        transactionId: fundingRequests.transactionId
      }).from(fundingRequests)
        .where(and(
          eq(fundingRequests.groveId, groveId),
          eq(fundingRequests.status, 'disbursed')
        ));

      return res.status(200).json({
        success: true,
        requests
      });
    } catch (error: any) {
      console.error('[API] Error getting funding history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get funding history'
      });
    }
  }

  // Return 501 for other routes until full migration
  return res.status(501).json({
    error: 'API migration in progress',
    message: 'This endpoint is being migrated to serverless architecture'
  });
}
