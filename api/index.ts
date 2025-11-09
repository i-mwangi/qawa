/**
 * Vercel Serverless Function Entry Point
 * Single entry point for all API routes to stay within Hobby plan limits
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// For now, return a simple response
// TODO: Refactor server.ts to export a request handler instead of creating HTTP server
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // Health check endpoint
  if (url.includes('/health')) {
    return res.status(200).json({ 
      success: true, 
      message: 'API is running',
      timestamp: new Date().toISOString()
    });
  }

  // Groves endpoints
  if (url.includes('/groves/register') && req.method === 'POST') {
    const { db } = await import('../db/index.js');
    const { coffeeGroves } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');
    
    try {
      const groveData = req.body;
      const tokensPerTree = groveData.tokensPerTree || 10; // Default 10 tokens per tree
      
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
            
            tokenizationResult = {
              success: true,
              tokenId: tokenResult.tokenId,
              tokenSymbol: symbol,
              totalTokens: totalTokens,
              transactionId: tokenResult.transactionId
            };
            
            console.log(`✅ Grove tokenized successfully: ${tokenResult.tokenId}`);
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
      
      // Parse autoDistribute query parameter (default false)
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
      
      // Optionally trigger automatic distribution
      let distributionResult = null;
      if (autoDistribute) {
        console.log(`[HarvestReport] Auto-distributing revenue for harvest ${harvest.id}`);
        
        try {
          const { revenueDistributionService } = await import('../lib/services/revenue-distribution-service.js');
          const distribution = await revenueDistributionService.distributeRevenue(harvest.id);
          
          if (distribution.success) {
            distributionResult = distribution.distribution;
            console.log(`[HarvestReport] Auto-distribution completed successfully`);
          } else {
            console.warn(`[HarvestReport] Auto-distribution failed: ${distribution.error}`);
            // Don't fail the harvest report if distribution fails
            // Just log the error and return the harvest without distribution
          }
        } catch (distError: any) {
          console.error('[HarvestReport] Error during auto-distribution:', distError);
          // Continue without failing the harvest report
        }
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
      
      // Get all groves for this farmer with their balances
      const groves = await db.all(sql`
        SELECT 
          g.id,
          g.grove_name as groveName,
          COALESCE(SUM(h.farmer_share), 0) as totalEarned,
          COALESCE(SUM(w.amount), 0) as totalWithdrawn,
          COALESCE(SUM(h.farmer_share), 0) - COALESCE(SUM(w.amount), 0) as availableBalance,
          0 as thisMonthDistributed
        FROM coffee_groves g
        LEFT JOIN harvest_records h ON g.id = h.grove_id
        LEFT JOIN farmer_withdrawals w ON g.id = w.grove_id AND w.status = 'completed'
        WHERE g.farmer_address = ${farmerAddress}
        GROUP BY g.id, g.grove_name
      `);
      
      // Convert from cents to dollars
      const mappedGroves = groves.map((g: any) => ({
        groveId: g.id,
        groveName: g.groveName,
        totalEarned: g.totalEarned / 100,
        availableBalance: g.availableBalance / 100,
        withdrawn: g.totalWithdrawn / 100,
        thisMonthDistributed: 0
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
      
      const result = await db.get(sql`
        SELECT 
          COALESCE(SUM(h.farmer_share), 0) as totalEarned
        FROM harvest_records h
        INNER JOIN coffee_groves g ON h.grove_id = g.id
        WHERE g.farmer_address = ${farmerAddress}
      `);
      
      const totalEarned = (result?.totalEarned || 0) / 100;
      
      return res.status(200).json({
        success: true,
        balance: totalEarned,
        availableBalance: totalEarned,
        withdrawn: 0
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
  if (url.includes('/farmer/withdraw') && req.method === 'POST') {
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
      
      // Verify farmer has sufficient balance (earned - already withdrawn)
      const balanceCheck = await db.get(sql`
        SELECT 
          COALESCE(SUM(h.farmer_share), 0) as totalEarned,
          COALESCE(SUM(w.amount), 0) as totalWithdrawn
        FROM harvest_records h
        INNER JOIN coffee_groves g ON h.grove_id = g.id
        LEFT JOIN farmer_withdrawals w ON g.id = w.grove_id AND w.status = 'completed'
        WHERE g.id = ${groveId} AND g.farmer_address = ${farmerAddress}
      `);
      
      const totalEarned = (balanceCheck?.totalEarned || 0) / 100;
      const totalWithdrawn = (balanceCheck?.totalWithdrawn || 0) / 100;
      const availableBalance = totalEarned - totalWithdrawn;
      
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
          SET totalWithdrawn = totalWithdrawn + ${amountInCents},
              availableBalance = availableBalance - ${amountInCents},
              updatedAt = ${Date.now()}
          WHERE farmerAddress = ${farmerAddress} AND groveId = ${groveId}
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
  if (url.includes('/farmer/withdrawals/') && req.method === 'GET') {
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
      const mappedWithdrawals = withdrawals.map((w: any) => ({
        id: w.id,
        groveId: w.grove_id,
        groveName: w.groveName || 'Unknown Grove',
        amount: w.amount / 100, // Convert from cents
        status: w.status,
        transactionHash: w.transaction_hash,
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

  // Token purchase endpoint (POST /tokens/purchase)
  if (url.includes('/tokens/purchase') && req.method === 'POST') {
    try {
      const { investorAddress, groveId, tokenAmount, paymentAmount } = req.body;
      
      // Validate request body
      if (!investorAddress || !groveId || !tokenAmount || !paymentAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: investorAddress, groveId, tokenAmount, paymentAmount'
        });
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
      
      // Parse query parameter for withPayments
      const urlObj = new URL(url, `http://localhost`);
      const withPayments = urlObj.searchParams.get('withPayments') === 'true';
      
      // Import and call RevenueDistributionService
      const { revenueDistributionService } = await import('../lib/services/revenue-distribution-service.js');
      
      // Call appropriate method based on withPayments flag
      const result = withPayments 
        ? await revenueDistributionService.distributeRevenueWithPayments(harvestId)
        : await revenueDistributionService.distributeRevenue(harvestId);
      
      if (!result.success) {
        // Determine appropriate status code based on error
        let statusCode = 400;
        if (result.error?.includes('not found')) {
          statusCode = 404;
        } else if (result.error?.includes('already distributed')) {
          statusCode = 409; // Conflict
        }
        
        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }
      
      // Build response based on whether payments were included
      const response: any = {
        success: true,
        distribution: result.distribution,
        message: withPayments 
          ? 'Revenue distributed with USDC payments successfully'
          : 'Revenue distributed successfully'
      };
      
      // Add payment details if withPayments was enabled
      if (withPayments) {
        // Type assertion since we know distributeRevenueWithPayments returns DistributionWithPayments
        const paymentResult = result as any;
        if (paymentResult.farmerPayment) {
          response.farmerPayment = paymentResult.farmerPayment;
        }
        if (paymentResult.investorPayments) {
          response.investorPayments = paymentResult.investorPayments;
        }
        if (paymentResult.failedPayments !== undefined) {
          response.failedPayments = paymentResult.failedPayments;
        }
      }
      
      return res.status(200).json(response);
      
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
  if (url.includes('/investor/withdraw') && req.method === 'POST') {
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
  if (url.includes('/investor/withdrawals/') && req.method === 'GET') {
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

  // Lending pools - return empty data
  if (url.includes('/lending/pools')) {
    return res.status(200).json({
      success: true,
      pools: []
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
      const { investorAddress, groveId, tokenAmount } = req.body;
      
      // Validate request body
      if (!investorAddress || !groveId || !tokenAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: investorAddress, groveId, tokenAmount'
        });
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

  // Marketplace listings - return empty data
  if (url.includes('/marketplace/listings')) {
    return res.status(200).json({
      success: true,
      listings: []
    });
  }

  // Harvest history - return empty data
  if (url.includes('/harvest/history')) {
    return res.status(200).json({
      success: true,
      harvests: []
    });
  }

  // Return 501 for other routes until full migration
  return res.status(501).json({ 
    error: 'API migration in progress',
    message: 'This endpoint is being migrated to serverless architecture'
  });
}
