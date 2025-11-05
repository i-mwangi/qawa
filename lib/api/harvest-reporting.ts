import { createServer, IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { db } from '../db'
import { harvestRecords, coffeeGroves, revenueDistributions, tokenHoldings } from '../db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { revenueDistributionService } from './revenue-distribution-service'
import { groveTokenizationService } from './grove-tokenization-service'
import { withdrawalService } from './withdrawal-service'
import { autoDistributionService } from './auto-distribution-service'

// Types for API requests and responses
interface ReportHarvestRequest {
    groveName: string
    farmerAddress: string
    yieldKg: number
    qualityGrade: number
    salePricePerKg: number
}

interface DistributeRevenueRequest {
    harvestId: number
    farmerAddress: string
    transactionHash: string
}

interface GetHarvestHistoryQuery {
    groveName?: string
    farmerAddress?: string
    limit?: number
    offset?: number
    status?: 'distributed' | 'pending'
}

interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

// Utility functions
function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        console.log('Starting to parse request body');
        let body = ''
        req.on('data', chunk => {
            console.log('Received data chunk:', chunk.toString());
            body += chunk.toString()
        })
        req.on('end', () => {
            console.log('Finished receiving data. Body:', body);
            try {
                const parsed = JSON.parse(body)
                console.log('Parsed body:', parsed);
                resolve(parsed)
            } catch (error) {
                console.error('Failed to parse JSON:', error);
                reject(new Error('Invalid JSON'))
            }
        })
        req.on('error', error => {
            console.error('Request error:', error);
            reject(error)
        })
        
        // Add a timeout to prevent hanging
        setTimeout(() => {
            console.log('Request body parsing timeout');
            reject(new Error('Request body parsing timeout'))
        }, 10000) // 10 second timeout
    })
}

function sendResponse(res: ServerResponse, statusCode: number, data: ApiResponse) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message })
}

// Validation functions
function validateAddress(address: string): boolean {
    // Accept either Ethereum-style 0x... addresses or Hedera account IDs like 0.0.123456
    const eth = /^0x[a-fA-F0-9]{40}$/.test(address)
    const hedera = /^\d+\.\d+\.\d+$/.test(address)
    return eth || hedera
}

function validateHarvestData(data: ReportHarvestRequest): string | null {
    if (!data.groveName || data.groveName.trim().length === 0) {
        return 'Grove name is required'
    }
    if (!validateAddress(data.farmerAddress)) {
        return 'Invalid farmer address format'
    }
    if (!data.yieldKg || data.yieldKg <= 0) {
        return 'Yield must be a positive number'
    }
    if (!data.qualityGrade || data.qualityGrade < 1 || data.qualityGrade > 100) {
        return 'Quality grade must be between 1 and 100'
    }
    if (!data.salePricePerKg || data.salePricePerKg <= 0) {
        return 'Sale price per kg must be a positive number'
    }
    return null
}

// API Handlers
class HarvestReportingAPI {
    
    /**
     * Report a new harvest for a coffee grove
     * POST /api/harvest/report
     */
    async reportHarvest(req: IncomingMessage, res: ServerResponse) {
        const startTime = Date.now();
        console.log('Harvest report request received at:', new Date(startTime).toISOString());
        console.log('Request headers:', req.headers);
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        
        try {
            console.log('About to parse request body');
            // Use the pre-parsed body from the main server instead of parsing it again
            const anyReq = req as any;
            const body: ReportHarvestRequest = anyReq.body || await parseBody(req);
            console.log('Parsed request body:', body);
            console.log('Request body parsed successfully');
            
            // Validate harvest data
            const validationError = validateHarvestData(body)
            if (validationError) {
                console.log('Validation error:', validationError);
                return sendError(res, 400, validationError)
            }
            console.log('Validation passed');
            
            // Check if grove exists and farmer owns it
            // Use direct select approach which works reliably
            const groves = await db.select().from(coffeeGroves).where(
                and(
                    eq(coffeeGroves.groveName, body.groveName),
                    eq(coffeeGroves.farmerAddress, body.farmerAddress)
                )
            );
            
            const grove = groves.length > 0 ? groves[0] : null;
            
            if (!grove) {
                return sendError(res, 404, 'Grove not found or farmer does not own this grove')
            }
            
            if (grove.verificationStatus !== 'verified') {
                return sendError(res, 403, 'Grove must be verified before reporting harvests')
            }
            
            // Validate yield against grove capacity
            console.log('Validating yield against grove capacity');
            const yieldValidationStart = Date.now();
            if (grove.expectedYieldPerTree && grove.treeCount) {
                const maxExpectedYield = grove.treeCount * grove.expectedYieldPerTree
                const maxReasonableYield = maxExpectedYield * 1.5 // Allow 50% over expected
                if (body.yieldKg > maxReasonableYield) {
                    console.log('Yield exceeds reasonable maximum');
                    return sendError(res, 400, `Yield (${body.yieldKg}kg) exceeds reasonable maximum for grove size (${maxReasonableYield}kg)`)
                }
            }
            console.log('Yield validation took:', Date.now() - yieldValidationStart, 'ms');
            
            // Check for recent harvests (prevent spam) - TEMPORARILY DISABLED
            console.log('Skipping recent harvest check (temporarily disabled)');
            /*
            // Check for recent harvests (prevent spam) - SIMPLIFIED VERSION
            console.log('Checking for recent harvests');
            const recentHarvestQueryStart = Date.now();
            const sevenDaysAgoSeconds = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
            
            // Simplified query to avoid potential hangs
            let recentHarvestExists = false;
            try {
                const recentHarvests = await db.select()
                    .from(harvestRecords)
                    .where(and(
                        eq(harvestRecords.groveId, grove.id),
                        sql`${harvestRecords.harvestDate} > ${sevenDaysAgoSeconds}`
                    ))
                    .limit(1);
                
                recentHarvestExists = recentHarvests.length > 0;
            } catch (queryError) {
                console.warn('Failed to check for recent harvests, continuing anyway:', queryError);
                // Don't block the harvest report if this check fails
            }
            
            console.log('Recent harvest query took:', Date.now() - recentHarvestQueryStart, 'ms');

            if (recentHarvestExists) {
                console.log('Harvest reported within 7 days');
                return sendError(res, 409, 'Cannot report harvest within 7 days of previous harvest');
            }
            */
            
            // Calculate revenue shares
            console.log('Calculating revenue shares');
            const revenueCalcStart = Date.now();
            const totalRevenue = body.yieldKg * body.salePricePerKg
            const farmerShare = Math.floor(totalRevenue * 0.3) // 30% to farmer
            const investorShare = totalRevenue - farmerShare // 70% to investors
            console.log('Revenue calculation took:', Date.now() - revenueCalcStart, 'ms');
            
            // Insert harvest record
            console.log('Inserting harvest record');
            const insertStart = Date.now();
            const nowSeconds = Math.floor(Date.now() / 1000)
            const harvestData = {
                groveId: grove.id,
                harvestDate: nowSeconds,
                yieldKg: body.yieldKg,
                qualityGrade: body.qualityGrade,
                salePricePerKg: body.salePricePerKg,
                totalRevenue: totalRevenue,
                farmerShare: farmerShare,
                investorShare: investorShare,
                revenueDistributed: false,
                createdAt: nowSeconds
            }
            
            console.log('About to insert harvest data:', JSON.stringify(harvestData));
            try {
                const insertResult = await db.insert(harvestRecords).values(harvestData).returning();
                console.log('Insert result:', JSON.stringify(insertResult));
                const insertedHarvest = insertResult[0];
                console.log('Insert took:', Date.now() - insertStart, 'ms');
                console.log('Inserted harvest record:', JSON.stringify(insertedHarvest));
                
                // Step 1.5: Automatically distribute earnings to farmers and investors
                // This creates earnings records and updates balances immediately
                let distributionResult = null;
                try {
                    console.log(`\n💰 Triggering automatic distribution...`);
                    distributionResult = await autoDistributionService.distributeHarvestEarnings(insertedHarvest.id);
                    
                    if (distributionResult.success) {
                        console.log(`✅ Automatic distribution completed`);
                        console.log(`   Farmer earnings: 1 record created`);
                        console.log(`   Investor earnings: ${distributionResult.investorEarningsCreated} records created`);
                    } else {
                        console.error(`⚠️  Automatic distribution failed: ${distributionResult.error}`);
                    }
                } catch (distError) {
                    console.error('⚠️  Failed to auto-distribute earnings:', distError);
                    // Don't fail the harvest report if distribution fails
                }
                
                // Step 2: Mint additional tokens based on harvest yield (optional growth-based minting)
                // This represents increased grove value from successful harvest
                let tokenMintResult = null
                if (groveTokenizationService.isAvailable() && grove.tokenAddress) {
                    // Calculate bonus tokens: 1 token per 10kg of high-quality harvest
                    const bonusTokens = body.qualityGrade >= 8 ? Math.floor(body.yieldKg / 10) : 0
                    
                    if (bonusTokens > 0) {
                        console.log(`\n🪙 Minting ${bonusTokens} bonus tokens for high-quality harvest...`)
                        tokenMintResult = await groveTokenizationService.mintAdditionalTokens(grove.id, bonusTokens)
                        
                        if (tokenMintResult.success) {
                            console.log(`✅ Bonus tokens minted successfully`)
                        } else {
                            console.warn(`⚠️  Token minting failed: ${tokenMintResult.error}`)
                        }
                    }
                }
                
                const totalTime = Date.now() - startTime;
                console.log('Harvest report completed successfully in', totalTime, 'ms');
                
                const response = {
                    success: true,
                    message: 'Harvest reported and earnings distributed successfully',
                    data: {
                        harvestId: insertedHarvest.id,
                        groveName: body.groveName,
                        yieldKg: body.yieldKg,
                        qualityGrade: body.qualityGrade,
                        totalRevenue: totalRevenue,
                        farmerShare: farmerShare,
                        investorShare: investorShare,
                        harvestDate: new Date(insertedHarvest.harvestDate * 1000).toISOString(),
                        distribution: distributionResult ? {
                            success: distributionResult.success,
                            farmerEarningsCreated: distributionResult.farmerEarningsCreated,
                            investorEarningsCreated: distributionResult.investorEarningsCreated,
                            totalDistributed: distributionResult.totalDistributed,
                            error: distributionResult.error
                        } : null,
                        tokenMinting: tokenMintResult ? {
                            success: tokenMintResult.success,
                            error: tokenMintResult.error
                        } : null
                    }
                };
                
                console.log('About to send response:', JSON.stringify(response));
                sendResponse(res, 201, response);
                console.log('Response sent successfully');
            } catch (insertError) {
                console.error('Database insert failed:', insertError);
                sendError(res, 500, 'Database insert failed');
            }
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error('Error reporting harvest (took', totalTime, 'ms):', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get harvest history for a grove or farmer
     * GET /api/harvest/history
     */
    async getHarvestHistory(req: IncomingMessage, res: ServerResponse) {
        try {
            const parsedUrl = parse(req.url || '', true)
            const query = parsedUrl.query as any
            
            const limit = parseInt(query.limit as string) || 50
            const offset = parseInt(query.offset as string) || 0
            
            if (limit > 100) {
                return sendError(res, 400, 'Limit cannot exceed 100')
            }
            
            let whereConditions: any[] = []
            
            // Filter by grove name
            if (query.groveName) {
                const grove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.groveName, query.groveName as string)
                })
                if (!grove) {
                    return sendError(res, 404, 'Grove not found')
                }
                whereConditions.push(eq(harvestRecords.groveId, grove.id))
            }
            
            // Filter by farmer address
            if (query.farmerAddress) {
                if (!validateAddress(query.farmerAddress as string)) {
                    return sendError(res, 400, 'Invalid farmer address format')
                }
                
                const farmerGroves = await db.query.coffeeGroves.findMany({
                    where: eq(coffeeGroves.farmerAddress, query.farmerAddress as string)
                })
                
                if (farmerGroves.length === 0) {
                    return sendResponse(res, 200, { success: true, data: { harvests: [], total: 0 } })
                }
                
                const groveIds = farmerGroves.map(g => g.id)
                whereConditions.push(inArray(harvestRecords.groveId, groveIds))
            }
            
            // Filter by distribution status
            if (query.status === 'distributed') {
                whereConditions.push(eq(harvestRecords.revenueDistributed, true))
            } else if (query.status === 'pending') {
                whereConditions.push(eq(harvestRecords.revenueDistributed, false))
            }
            
            // Build where clause
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined
            
            // Get harvests with grove information
            // Modified query to ensure proper join handling in in-memory DB
            let harvests = [];
            let totalCount = [{ count: 0 }];
            
            if (whereClause) {
                harvests = await db.select({
                    harvestId: harvestRecords.id,
                    groveName: coffeeGroves.groveName,
                    farmerAddress: coffeeGroves.farmerAddress,
                    harvestDate: harvestRecords.harvestDate,
                    yieldKg: harvestRecords.yieldKg,
                    qualityGrade: harvestRecords.qualityGrade,
                    salePricePerKg: harvestRecords.salePricePerKg,
                    totalRevenue: harvestRecords.totalRevenue,
                    farmerShare: harvestRecords.farmerShare,
                    investorShare: harvestRecords.investorShare,
                    revenueDistributed: harvestRecords.revenueDistributed,
                    transactionHash: harvestRecords.transactionHash
                })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .where(whereClause)
                .orderBy(desc(harvestRecords.harvestDate))
                .limit(limit)
                .offset(offset);
                
                // Get total count
                totalCount = await db.select({ count: sql<number>`count(*)` })
                    .from(harvestRecords)
                    .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                    .where(whereClause);
            } else {
                // If no where clause, get all harvests
                harvests = await db.select({
                    harvestId: harvestRecords.id,
                    groveName: coffeeGroves.groveName,
                    farmerAddress: coffeeGroves.farmerAddress,
                    harvestDate: harvestRecords.harvestDate,
                    yieldKg: harvestRecords.yieldKg,
                    qualityGrade: harvestRecords.qualityGrade,
                    salePricePerKg: harvestRecords.salePricePerKg,
                    totalRevenue: harvestRecords.totalRevenue,
                    farmerShare: harvestRecords.farmerShare,
                    investorShare: harvestRecords.investorShare,
                    revenueDistributed: harvestRecords.revenueDistributed,
                    transactionHash: harvestRecords.transactionHash
                })
                .from(harvestRecords)
                .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
                .orderBy(desc(harvestRecords.harvestDate))
                .limit(limit)
                .offset(offset);
                
                // Get total count
                totalCount = await db.select({ count: sql<number>`count(*)` })
                    .from(harvestRecords)
                    .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id));
            }

            const formattedHarvests = harvests.map(harvest => ({
                ...harvest,
                harvestDate: new Date(harvest.harvestDate * 1000).toISOString(),
                revenueDistributed: Boolean(harvest.revenueDistributed)
            }))

            sendResponse(res, 200, {
                success: true,
                data: {
                    harvests: formattedHarvests,
                    total: totalCount[0].count,
                    limit,
                    offset
                }
            })
            
        } catch (error) {
            console.error('Error getting harvest history:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get pending harvests (not yet distributed)
     * GET /api/harvest/pending
     */
    async getPendingHarvests(req: IncomingMessage, res: ServerResponse) {
        try {
            const parsedUrl = parse(req.url || '', true)
            const query = parsedUrl.query as any
            
            let whereConditions = [eq(harvestRecords.revenueDistributed, false)]
            
            // Filter by farmer address if provided
            if (query.farmerAddress) {
                if (!validateAddress(query.farmerAddress as string)) {
                    return sendError(res, 400, 'Invalid farmer address format')
                }
                
                const farmerGroves = await db.query.coffeeGroves.findMany({
                    where: eq(coffeeGroves.farmerAddress, query.farmerAddress as string)
                })
                
                if (farmerGroves.length === 0) {
                    return sendResponse(res, 200, { success: true, data: [] })
                }
                
                const groveIds = farmerGroves.map(g => g.id)
                whereConditions.push(inArray(harvestRecords.groveId, groveIds))
            }
            
            // Modified query to ensure proper join handling in in-memory DB
            const pendingHarvests = await db.select({
                harvestId: harvestRecords.id,
                groveName: coffeeGroves.groveName,
                farmerAddress: coffeeGroves.farmerAddress,
                tokenAddress: coffeeGroves.tokenAddress,
                harvestDate: harvestRecords.harvestDate,
                yieldKg: harvestRecords.yieldKg,
                qualityGrade: harvestRecords.qualityGrade,
                totalRevenue: harvestRecords.totalRevenue,
                farmerShare: harvestRecords.farmerShare,
                investorShare: harvestRecords.investorShare
            })
            .from(harvestRecords)
            .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
            .where(and(...whereConditions))
            .orderBy(desc(harvestRecords.harvestDate))
            
            const formattedHarvests = pendingHarvests.map(harvest => ({
                ...harvest,
                harvestDate: new Date(harvest.harvestDate * 1000).toISOString()
            }))

            sendResponse(res, 200, {
                success: true,
                data: formattedHarvests
            })
        } catch (error) {
            console.error('Error getting pending harvests:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Distribute revenue on-chain via Hedera smart contract
     * POST /api/harvest/distribute-onchain
     */
    async distributeRevenueOnChain(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = await parseBody(req)
            
            if (!body.harvestId) {
                return sendError(res, 400, 'Missing required field: harvestId')
            }

            console.log(`\n🚀 Initiating on-chain revenue distribution for harvest ${body.harvestId}`)

            const result = await revenueDistributionService.distributeRevenueOnChain(body.harvestId)

            if (result.success) {
                sendResponse(res, 200, {
                    success: true,
                    message: 'Revenue distributed on-chain successfully',
                    data: {
                        harvestId: body.harvestId,
                        transactionId: result.transactionId
                    }
                })
            } else {
                sendError(res, 500, result.error || 'Failed to distribute revenue on-chain')
            }

        } catch (error) {
            console.error('Error distributing revenue on-chain:', error)
            sendError(res, 500, 'Internal server error')
        }
    }

    /**
     * Mark harvest as distributed and record transaction
     * POST /api/harvest/distribute
     */
    async markHarvestDistributed(req: IncomingMessage, res: ServerResponse) {
        try {
            const body: DistributeRevenueRequest = await parseBody(req)
            
            // Validate required fields
            if (!body.harvestId || !body.farmerAddress || !body.transactionHash) {
                return sendError(res, 400, 'Missing required fields: harvestId, farmerAddress, transactionHash')
            }
            
            if (!validateAddress(body.farmerAddress)) {
                return sendError(res, 400, 'Invalid farmer address format')
            }
            
            // Validate transaction hash format
            if (!/^0x[a-fA-F0-9]{64}$/.test(body.transactionHash)) {
                return sendError(res, 400, 'Invalid transaction hash format')
            }
            
            // Get harvest record with grove information
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
            .from(harvestRecords)
            .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
            .where(eq(harvestRecords.id, body.harvestId))
            .limit(1)
            
            if (harvestWithGrove.length === 0) {
                return sendError(res, 404, 'Harvest not found')
            }
            
            const { harvest, grove } = harvestWithGrove[0]
            
            // Verify farmer owns the grove
            if (grove.farmerAddress !== body.farmerAddress) {
                return sendError(res, 403, 'Farmer does not own this grove')
            }
            
            // Check if already distributed
            if (harvest.revenueDistributed) {
                return sendError(res, 409, 'Revenue already distributed for this harvest')
            }
            
            // Update harvest record
            await db.update(harvestRecords)
                .set({
                    revenueDistributed: true,
                    transactionHash: body.transactionHash
                })
                .where(eq(harvestRecords.id, body.harvestId))

            // Move farmer's share from pending to available balance
            try {
                await withdrawalService.movePendingToAvailable(
                    body.farmerAddress,
                    harvest.farmerShare
                );
                console.log(`✅ Moved farmer's share (${harvest.farmerShare}) from pending to available`);
            } catch (balanceError) {
                console.error('⚠️  Failed to update farmer balance:', balanceError);
                // Don't fail the distribution if balance update fails
            }

            sendResponse(res, 200, {
                success: true,
                message: 'Harvest marked as distributed successfully',
                data: {
                    harvestId: body.harvestId,
                    groveName: grove.groveName,
                    transactionHash: body.transactionHash,
                    distributionDate: new Date().toISOString()
                }
            })
            
        } catch (error) {
            console.error('Error marking harvest as distributed:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get harvest statistics for a grove or farmer
     * GET /api/harvest/stats
     */
    async getHarvestStats(req: IncomingMessage, res: ServerResponse) {
        try {
            const parsedUrl = parse(req.url || '', true)
            const query = parsedUrl.query as any
            
            let whereConditions: any[] = []
            
            // Filter by grove name or farmer address
            if (query.groveName) {
                const grove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.groveName, query.groveName as string)
                })
                if (!grove) {
                    return sendError(res, 404, 'Grove not found')
                }
                whereConditions.push(eq(harvestRecords.groveId, grove.id))
            } else if (query.farmerAddress) {
                if (!validateAddress(query.farmerAddress as string)) {
                    return sendError(res, 400, 'Invalid farmer address format')
                }
                
                const farmerGroves = await db.query.coffeeGroves.findMany({
                    where: eq(coffeeGroves.farmerAddress, query.farmerAddress as string)
                })
                
                if (farmerGroves.length === 0) {
                    return sendResponse(res, 200, {
                        success: true,
                        data: {
                            totalHarvests: 0,
                            totalYieldKg: 0,
                            totalRevenue: 0,
                            averageQuality: 0,
                            pendingDistributions: 0,
                            distributedHarvests: 0
                        }
                    })
                }
                
                const groveIds = farmerGroves.map(g => g.id)
                whereConditions.push(inArray(harvestRecords.groveId, groveIds))
            } else {
                return sendError(res, 400, 'Either groveName or farmerAddress is required')
            }
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined
            
            // Get harvest statistics
            const stats = await db.select({
                totalHarvests: sql<number>`count(*)`,
                totalYieldKg: sql<number>`sum(${harvestRecords.yieldKg})`,
                totalRevenue: sql<number>`sum(${harvestRecords.totalRevenue})`,
                averageQuality: sql<number>`avg(${harvestRecords.qualityGrade})`,
                pendingDistributions: sql<number>`sum(case when ${harvestRecords.revenueDistributed} = 0 then 1 else 0 end)`,
                distributedHarvests: sql<number>`sum(case when ${harvestRecords.revenueDistributed} = 1 then 1 else 0 end)`
            })
            .from(harvestRecords)
            .where(whereClause)
            
            const result = stats[0]
            
            // Calculate farmer's 30% share
            const totalRevenue = result.totalRevenue || 0
            const farmerTotalShare = totalRevenue * 0.3
            
            // Calculate monthly earnings (current month only)
            const currentMonth = new Date().getMonth()
            const currentYear = new Date().getFullYear()
            
            const monthlyStats = await db.select({
                monthlyRevenue: sql<number>`sum(${harvestRecords.totalRevenue})`
            })
            .from(harvestRecords)
            .where(
                and(
                    whereClause,
                    sql`strftime('%m', ${harvestRecords.harvestDate}) = ${String(currentMonth + 1).padStart(2, '0')}`,
                    sql`strftime('%Y', ${harvestRecords.harvestDate}) = ${String(currentYear)}`
                )
            )
            
            const monthlyRevenue = monthlyStats[0]?.monthlyRevenue || 0
            const farmerMonthlyShare = monthlyRevenue * 0.3
            
            // Calculate pending distributions (30% of undistributed harvests)
            const pendingStats = await db.select({
                pendingRevenue: sql<number>`sum(${harvestRecords.totalRevenue})`
            })
            .from(harvestRecords)
            .where(
                and(
                    whereClause,
                    eq(harvestRecords.revenueDistributed, false)
                )
            )
            
            const pendingRevenue = pendingStats[0]?.pendingRevenue || 0
            const pendingDistributions = pendingRevenue * 0.3
            
            // Calculate available balance (distributed but not withdrawn)
            const distributedStats = await db.select({
                distributedRevenue: sql<number>`sum(${harvestRecords.totalRevenue})`
            })
            .from(harvestRecords)
            .where(
                and(
                    whereClause,
                    eq(harvestRecords.revenueDistributed, true)
                )
            )
            
            const distributedRevenue = distributedStats[0]?.distributedRevenue || 0
            const distributedAmount = distributedRevenue * 0.3
            
            // Get total withdrawn (would need a withdrawals table, for now return 0)
            const totalWithdrawn = 0
            const availableBalance = distributedAmount - totalWithdrawn
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    totalEarnings: farmerTotalShare,
                    monthlyEarnings: farmerMonthlyShare,
                    pendingDistributions: pendingDistributions,
                    availableBalance: availableBalance,
                    pendingBalance: pendingDistributions,
                    totalWithdrawn: totalWithdrawn
                }
            })
            
        } catch (error) {
            console.error('Error getting harvest stats:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Calculate revenue distribution for a harvest
     * POST /api/harvest/calculate-distribution
     */
    async calculateDistribution(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = await parseBody(req)
            
            if (!body.harvestId) {
                return sendError(res, 400, 'Missing required field: harvestId')
            }
            
            const harvestId = parseInt(body.harvestId)
            if (isNaN(harvestId)) {
                return sendError(res, 400, 'Invalid harvest ID')
            }
            
            const calculation = await revenueDistributionService.calculateDistribution(harvestId)
            
            if (!calculation) {
                return sendError(res, 404, 'Harvest not found or already distributed')
            }
            
            // Validate the calculation
            const validation = await revenueDistributionService.validateDistribution(calculation)
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    calculation,
                    validation
                }
            })
            
        } catch (error) {
            console.error('Error calculating distribution:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }
    
    /**
     * Record revenue distribution (after blockchain transaction)
     * POST /api/harvest/record-distribution
     */
    async recordDistribution(req: IncomingMessage, res: ServerResponse) {
        try {
            const body = await parseBody(req)
            
            if (!body.harvestId || !body.distributions || !Array.isArray(body.distributions)) {
                return sendError(res, 400, 'Missing required fields: harvestId, distributions')
            }
            
            const harvestId = parseInt(body.harvestId)
            if (isNaN(harvestId)) {
                return sendError(res, 400, 'Invalid harvest ID')
            }
            
            // Validate distribution data
            for (const dist of body.distributions) {
                if (!dist.holderAddress || !validateAddress(dist.holderAddress)) {
                    return sendError(res, 400, 'Invalid holder address in distributions')
                }
                if (typeof dist.tokenAmount !== 'number' || dist.tokenAmount <= 0) {
                    return sendError(res, 400, 'Invalid token amount in distributions')
                }
                if (typeof dist.revenueShare !== 'number' || dist.revenueShare < 0) {
                    return sendError(res, 400, 'Invalid revenue share in distributions')
                }
            }
            
            await revenueDistributionService.recordDistribution(
                harvestId,
                body.distributions,
                body.transactionHash
            )
            
            sendResponse(res, 200, {
                success: true,
                message: 'Distribution recorded successfully',
                data: {
                    harvestId,
                    distributionCount: body.distributions.length,
                    transactionHash: body.transactionHash
                }
            })
            
        } catch (error) {
            console.error('Error recording distribution:', error)
            sendError(res, 500, error.message || 'Internal server error')
        }
    }
    
    /**
     * Get holder's distribution history and earnings
     * GET /api/harvest/holder/:holderAddress/earnings
     */
    async getHolderEarnings(req: IncomingMessage, res: ServerResponse, holderAddress: string) {
        try {
            if (!validateAddress(holderAddress)) {
                return sendError(res, 400, 'Invalid holder address format')
            }
            
            // Check if this is a farmer by looking for their groves
            const farmerGroves = await db.query.coffeeGroves.findMany({
                where: eq(coffeeGroves.farmerAddress, holderAddress)
            })
            
            if (farmerGroves.length > 0) {
                // This is a farmer - get their harvest earnings
                const groveIds = farmerGroves.map(g => g.id)
                const harvests = await db.query.harvestRecords.findMany({
                    where: inArray(harvestRecords.groveId, groveIds)
                })
                
                // Create distribution history from harvests (farmer gets 30%)
                const distributionHistory = harvests.map(h => ({
                    date: h.harvestDate,
                    amount: (h.totalRevenue || 0) * 0.3,
                    harvestId: h.id,
                    groveName: h.groveName || 'Unknown Grove'
                }))
                
                const totalEarnings = distributionHistory.reduce((sum, d) => sum + d.amount, 0)
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        holderAddress,
                        totalEarnings,
                        distributionHistory
                    }
                })
            } else {
                // This is an investor - use revenue distribution service
                const [distributionHistory, totalEarnings] = await Promise.all([
                    revenueDistributionService.getHolderDistributionHistory(holderAddress),
                    revenueDistributionService.getHolderTotalEarnings(holderAddress)
                ])
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        holderAddress,
                        totalEarnings,
                        distributionHistory: distributionHistory.map(dist => ({
                            ...dist,
                            distributionDate: new Date(dist.distributionDate * 1000).toISOString()
                        }))
                    }
                })
            }
            
        } catch (error) {
            console.error('Error getting holder earnings:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get distribution summary for a harvest
     * GET /api/harvest/:harvestId/distribution-summary
     */
    async getDistributionSummary(req: IncomingMessage, res: ServerResponse, harvestId: string) {
        try {
            const harvestIdNum = parseInt(harvestId)
            if (isNaN(harvestIdNum)) {
                return sendError(res, 400, 'Invalid harvest ID')
            }
            
            const summary = await revenueDistributionService.getDistributionSummary(harvestIdNum)
            
            if (!summary) {
                return sendError(res, 404, 'Harvest not found')
            }
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    ...summary,
                    distributionDate: summary.distributionDate ? new Date(summary.distributionDate * 1000).toISOString() : null
                }
            })
            
        } catch (error) {
            console.error('Error getting distribution summary:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get all pending distributions across the platform
     * GET /api/harvest/pending-distributions
     */
    async getAllPendingDistributions(req: IncomingMessage, res: ServerResponse) {
        try {
            const pendingDistributions = await revenueDistributionService.getPendingDistributions()
            
            const formattedDistributions = pendingDistributions.map(dist => ({
                ...dist,
                harvestDate: new Date(dist.harvestDate * 1000).toISOString()
            }))
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    pendingDistributions: formattedDistributions,
                    totalPending: formattedDistributions.length,
                    totalRevenuePending: formattedDistributions.reduce((sum, dist) => sum + dist.totalRevenue, 0)
                }
            })
            
        } catch (error) {
            console.error('Error getting pending distributions:', error)
            sendError(res, 500, 'Internal server error')
        }
    }

    /**
     * Get token holder earnings for a specific harvest
     * GET /api/harvest/:harvestId/earnings
     */
    async getHarvestEarnings(req: IncomingMessage, res: ServerResponse, harvestId: string) {
        try {
            const harvestIdNum = parseInt(harvestId)
            if (isNaN(harvestIdNum)) {
                return sendError(res, 400, 'Invalid harvest ID')
            }
            
            // Get harvest with grove information
            const harvestWithGrove = await db.select({
                harvest: harvestRecords,
                grove: coffeeGroves
            })
            .from(harvestRecords)
            .innerJoin(coffeeGroves, eq(harvestRecords.groveId, coffeeGroves.id))
            .where(eq(harvestRecords.id, harvestIdNum))
            .limit(1)
            
            if (harvestWithGrove.length === 0) {
                return sendError(res, 404, 'Harvest not found')
            }
            
            const { harvest, grove } = harvestWithGrove[0]
            
            // Get revenue distributions for this harvest
            const distributions = await db.query.revenueDistributions.findMany({
                where: eq(revenueDistributions.harvestId, harvestIdNum)
            })
            
            // Get current token holders for the grove
            const currentHolders = await db.query.tokenHoldings.findMany({
                where: and(
                    eq(tokenHoldings.groveId, grove.id),
                    eq(tokenHoldings.isActive, true)
                )
            })
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    harvestId: harvest.id,
                    groveName: grove.groveName,
                    totalRevenue: harvest.totalRevenue,
                    investorShare: harvest.investorShare,
                    farmerShare: harvest.farmerShare,
                    revenueDistributed: Boolean(harvest.revenueDistributed),
                    distributions: distributions.map(d => ({
                        holderAddress: d.holderAddress,
                        tokenAmount: d.tokenAmount,
                        revenueShare: d.revenueShare,
                        distributionDate: new Date(d.distributionDate * 1000).toISOString(),
                        transactionHash: d.transactionHash
                    })),
                    currentHolders: currentHolders.map(h => ({
                        holderAddress: h.holderAddress,
                        tokenAmount: h.tokenAmount,
                        purchasePrice: h.purchasePrice,
                        purchaseDate: new Date(h.purchaseDate * 1000).toISOString()
                    }))
                }
            })
            
        } catch (error) {
            console.error('Error getting harvest earnings:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
}

// Route handler
export function createHarvestReportingServer(port: number = 3001) {
    const api = new HarvestReportingAPI()
    
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            res.end()
            return
        }
        
        const parsedUrl = parse(req.url || '', true)
        const pathname = parsedUrl.pathname || ''
        const method = req.method || 'GET'
        
        try {
            // Route handling
            if (pathname === '/api/harvest/report' && method === 'POST') {
                await api.reportHarvest(req, res)
            } else if (pathname === '/api/harvest/history' && method === 'GET') {
                await api.getHarvestHistory(req, res)
            } else if (pathname === '/api/harvest/pending' && method === 'GET') {
                await api.getPendingHarvests(req, res)
            } else if (pathname === '/api/harvest/distribute' && method === 'POST') {
                await api.markHarvestDistributed(req, res)
            } else if (pathname === '/api/harvest/stats' && method === 'GET') {
                await api.getHarvestStats(req, res)
            } else if (pathname === '/api/harvest/calculate-distribution' && method === 'POST') {
                await api.calculateDistribution(req, res)
            } else if (pathname === '/api/harvest/record-distribution' && method === 'POST') {
                await api.recordDistribution(req, res)
            } else if (pathname === '/api/harvest/pending-distributions' && method === 'GET') {
                await api.getAllPendingDistributions(req, res)
            } else if (pathname.startsWith('/api/harvest/holder/') && pathname.endsWith('/earnings') && method === 'GET') {
                const holderAddress = pathname.split('/')[4]
                await api.getHolderEarnings(req, res, holderAddress)
            } else if (pathname.startsWith('/api/harvest/') && pathname.endsWith('/distribution-summary') && method === 'GET') {
                const harvestId = pathname.split('/')[3]
                await api.getDistributionSummary(req, res, harvestId)
            } else if (pathname.startsWith('/api/harvest/') && pathname.endsWith('/earnings') && method === 'GET') {
                const harvestId = pathname.split('/')[3]
                await api.getHarvestEarnings(req, res, harvestId)
            } else if (pathname === '/health' && method === 'GET') {
                sendResponse(res, 200, { success: true, message: 'Harvest Reporting API is running' })
            } else {
                sendError(res, 404, 'Endpoint not found')
            }
        } catch (error) {
            console.error('Server error:', error)
            sendError(res, 500, 'Internal server error')
        }
    })
    
    server.listen(port, () => {
        console.log(`Harvest Reporting API server running on port ${port}`)
        console.log(`Health check: http://localhost:${port}/health`)
        console.log('Available endpoints:')
        console.log('  POST /api/harvest/report')
        console.log('  GET  /api/harvest/history')
        console.log('  GET  /api/harvest/pending')
        console.log('  POST /api/harvest/distribute')
        console.log('  GET  /api/harvest/stats')
        console.log('  POST /api/harvest/calculate-distribution')
        console.log('  POST /api/harvest/record-distribution')
        console.log('  GET  /api/harvest/pending-distributions')
        console.log('  GET  /api/harvest/holder/:holderAddress/earnings')
        console.log('  GET  /api/harvest/:harvestId/distribution-summary')
        console.log('  GET  /api/harvest/:harvestId/earnings')
    })
    
    return server
}

// Export for use in other modules
export { HarvestReportingAPI }