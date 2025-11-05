/**
 * Farmer Balance API Endpoints
 * HTTP endpoints for farmer revenue tracking and withdrawals
 */

import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { balanceCalculationService } from './balance-calculation-service';
import { db } from '../db';
import { farmerWithdrawals, coffeeGroves } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

// Utility functions
function sendResponse(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message });
}

function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * GET /api/farmer/balance/:address
 * Get all grove balances for a farmer
 */
export async function getAllFarmerGroveBalances(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const pathParts = parsedUrl.pathname?.split('/') || [];
        const farmerAddress = pathParts[pathParts.length - 1];

        if (!farmerAddress) {
            return sendError(res, 400, 'Farmer address is required');
        }

        // Get all grove balances
        const balances = await balanceCalculationService.getAllFarmerGroveBalances(farmerAddress);

        // Get grove names
        const balancesWithNames = await Promise.all(
            balances.map(async (balance) => {
                const grove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.id, balance.groveId)
                });
                return {
                    ...balance,
                    groveName: grove?.groveName || `Grove #${balance.groveId}`
                };
            })
        );

        sendResponse(res, 200, {
            success: true,
            data: {
                groves: balancesWithNames
            }
        });
    } catch (error: any) {
        console.error('Error getting farmer grove balances:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/revenue/farmer-balance?farmerAddress=...
 * Legacy endpoint for backward compatibility
 * Returns aggregated balance across all groves
 */
export async function getLegacyFarmerBalance(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const farmerAddress = parsedUrl.query.farmerAddress as string;

        if (!farmerAddress) {
            return sendError(res, 400, 'Farmer address is required');
        }

        // Get all grove balances
        const balances = await balanceCalculationService.getAllFarmerGroveBalances(farmerAddress);

        // Aggregate totals across all groves
        const totals = balances.reduce((acc, balance) => ({
            thisMonthDistributed: acc.thisMonthDistributed + balance.thisMonthDistributed,
            availableBalance: acc.availableBalance + balance.availableBalance,
            pendingDistribution: acc.pendingDistribution + balance.pendingDistribution,
            totalWithdrawn: acc.totalWithdrawn + balance.totalWithdrawn,
            totalEarned: acc.totalEarned + balance.totalEarned
        }), {
            thisMonthDistributed: 0,
            availableBalance: 0,
            pendingDistribution: 0,
            totalWithdrawn: 0,
            totalEarned: 0
        });

        sendResponse(res, 200, {
            success: true,
            data: {
                farmerAddress,
                ...totals,
                groveCount: balances.length
            }
        });
    } catch (error: any) {
        console.error('Error getting legacy farmer balance:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/farmer/balance/:address/grove/:groveId
 * Get balance for a specific grove
 */
export async function getFarmerGroveBalance(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const pathParts = parsedUrl.pathname?.split('/') || [];
        const groveId = parseInt(pathParts[pathParts.length - 1]);
        const farmerAddress = pathParts[pathParts.length - 3];

        if (!farmerAddress || isNaN(groveId)) {
            return sendError(res, 400, 'Farmer address and grove ID are required');
        }

        const balance = await balanceCalculationService.getFarmerGroveBalance(farmerAddress, groveId);

        // Get grove name
        const grove = await db.query.coffeeGroves.findFirst({
            where: eq(coffeeGroves.id, groveId)
        });

        sendResponse(res, 200, {
            success: true,
            data: {
                ...balance,
                groveName: grove?.groveName || `Grove #${groveId}`
            }
        });
    } catch (error: any) {
        console.error('Error getting farmer grove balance:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/farmer/transactions/:address
 * Get complete transaction history (earnings + withdrawals)
 */
export async function getFarmerTransactions(req: IncomingMessage, res: ServerResponse, farmerAddress: string) {
    try {
        console.log(`[Farmer Transactions] Fetching transaction history for ${farmerAddress}`);
        
        const { farmerGroveEarnings } = await import('../db/schema/earnings-distribution');
        
        // Get all earnings
        const earnings = await db.query.farmerGroveEarnings.findMany({
            where: eq(farmerGroveEarnings.farmerAddress, farmerAddress),
            orderBy: [desc(farmerGroveEarnings.distributedAt)]
        });
        
        // Get all withdrawals
        const withdrawals = await db.query.farmerWithdrawals.findMany({
            where: eq(farmerWithdrawals.farmerAddress, farmerAddress),
            orderBy: [desc(farmerWithdrawals.requestedAt)]
        });
        
        // Get grove names
        const groveIds = [...new Set([...earnings.map(e => e.groveId), ...withdrawals.map(w => w.groveId)])];
        const groves = await db.query.coffeeGroves.findMany({
            where: (coffeeGroves, { inArray }) => inArray(coffeeGroves.id, groveIds)
        });
        const groveMap = Object.fromEntries(groves.map(g => [g.id, g.groveName]));
        
        // Combine and format transactions
        const transactions = [
            // Earnings
            ...earnings.map(e => ({
                id: `earning-${e.id}`,
                type: 'earning',
                date: e.distributedAt,
                groveId: e.groveId,
                groveName: groveMap[e.groveId] || 'Unknown Grove',
                amount: e.earningAmount / 100,
                status: e.distributionStatus,
                description: `Harvest earnings from ${groveMap[e.groveId] || 'grove'}`,
                transactionHash: null,
                blockExplorerUrl: null
            })),
            // Withdrawals
            ...withdrawals.map(w => ({
                id: `withdrawal-${w.id}`,
                type: 'withdrawal',
                date: w.completedAt || w.requestedAt,
                groveId: w.groveId,
                groveName: groveMap[w.groveId] || 'Unknown Grove',
                amount: -(w.amount / 100), // Negative for withdrawals
                status: w.status,
                description: `Withdrawal to wallet`,
                transactionHash: w.transactionHash,
                blockExplorerUrl: w.blockExplorerUrl
            }))
        ];
        
        // Sort by date descending
        transactions.sort((a, b) => b.date - a.date);
        
        console.log(`[Farmer Transactions] Found ${transactions.length} transactions`);
        
        sendResponse(res, 200, {
            success: true,
            data: transactions
        });
    } catch (error: any) {
        console.error('[Farmer Transactions] Error:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/farmer/withdrawals/:address
 * Get farmer withdrawal history
 */
export async function getFarmerWithdrawals(req: IncomingMessage, res: ServerResponse, farmerAddress: string) {
    try {
        console.log(`[Farmer Withdrawals] Fetching withdrawal history for ${farmerAddress}`);
        
        // Get all withdrawals for this farmer
        const withdrawals = await db.query.farmerWithdrawals.findMany({
            where: eq(farmerWithdrawals.farmerAddress, farmerAddress),
            orderBy: [desc(farmerWithdrawals.requestedAt)]
        });
        
        console.log(`[Farmer Withdrawals] Found ${withdrawals.length} withdrawals`);
        
        sendResponse(res, 200, {
            success: true,
            data: withdrawals.map(w => ({
                id: w.id,
                groveId: w.groveId,
                amount: w.amount / 100, // Convert cents to dollars
                status: w.status,
                transactionHash: w.transactionHash,
                blockExplorerUrl: w.blockExplorerUrl,
                requestedAt: w.requestedAt,
                completedAt: w.completedAt,
                errorMessage: w.errorMessage
            }))
        });
    } catch (error: any) {
        console.error('[Farmer Withdrawals] Error:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * POST /api/farmer/withdraw
 * Process farmer withdrawal
 */
export async function processFarmerWithdrawal(req: IncomingMessage, res: ServerResponse) {
    try {
        console.log('[Farmer Withdrawal] Starting withdrawal process');
        // Body is already parsed by the main server
        const body = (req as any).body || {};
        console.log('[Farmer Withdrawal] Request body:', body);
        
        const { farmerAddress, groveId, amount } = body;

        if (!farmerAddress || !groveId || !amount) {
            console.log('[Farmer Withdrawal] Missing required fields');
            return sendError(res, 400, 'Missing required fields: farmerAddress, groveId, amount');
        }
        
        console.log(`[Farmer Withdrawal] Processing withdrawal for farmer ${farmerAddress}, grove ${groveId}, amount ${amount}`);

        // Get grove balance
        console.log('[Farmer Withdrawal] Fetching balance...');
        const balance = await balanceCalculationService.getFarmerGroveBalance(farmerAddress, groveId);
        console.log('[Farmer Withdrawal] Balance:', balance);

        if (!balance) {
            console.log('[Farmer Withdrawal] Balance not found');
            return sendError(res, 404, 'Grove balance not found');
        }

        // Convert amount to cents
        const amountInCents = Math.floor(amount * 100);

        // Check if sufficient balance
        if (balance.availableBalance < amountInCents) {
            return sendError(res, 400, `Insufficient balance. Available: ${(balance.availableBalance / 100).toFixed(2)}`);
        }

        // Create withdrawal record
        const withdrawalId = `fw_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const now = Date.now();

        await db.insert(farmerWithdrawals).values({
            id: withdrawalId,
            farmerAddress,
            groveId,
            amount: amountInCents,
            status: 'pending',
            requestedAt: now,
            createdAt: now,
            updatedAt: now
        });

        // Execute Hedera USDC transfer
        const useBlockchain = process.env.USE_HEDERA_BLOCKCHAIN === 'true';
        console.log(`[Farmer Withdrawal] useBlockchain: ${useBlockchain}`);
        let transactionHash: string;
        let blockExplorerUrl: string | undefined;

        if (useBlockchain) {
            console.log('[Farmer Withdrawal] Using real blockchain transaction');
            // Real blockchain transaction
            const { getHederaWithdrawalService } = await import('./hedera-withdrawal-service');
            const hederaService = getHederaWithdrawalService();
            
            // Check if farmer has associated the USDC token
            console.log('[Farmer Withdrawal] Checking token association...');
            const isAssociated = await hederaService.checkTokenAssociation(farmerAddress);
            
            if (!isAssociated) {
                console.log('[Farmer Withdrawal] Token not associated - farmer needs to associate in HashPack');
                
                // Update withdrawal as failed
                await db.update(farmerWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: 'Token not associated. Please associate USDC token in HashPack wallet.',
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerWithdrawals.id, withdrawalId));
                
                return sendError(res, 400, 
                    `Please associate USDC token (${process.env.HEDERA_USDC_TOKEN_ID}) in your HashPack wallet first. ` +
                    `Go to Tokens → Manage Tokens → Add Token and enter the token ID.`
                );
            }
            
            console.log('[Farmer Withdrawal] Token is associated ✅');
            console.log('[Farmer Withdrawal] Calling Hedera service...');
            const result = await hederaService.transferUSDC(farmerAddress, amountInCents);
            console.log('[Farmer Withdrawal] Hedera result:', result);
            
            if (!result.success) {
                // Transaction failed, update withdrawal as failed
                await db.update(farmerWithdrawals)
                    .set({
                        status: 'failed',
                        errorMessage: result.error,
                        updatedAt: Date.now()
                    })
                    .where(eq(farmerWithdrawals.id, withdrawalId));
                
                return sendError(res, 500, `Blockchain transaction failed: ${result.error}`);
            }
            
            transactionHash = result.transactionHash!;
            blockExplorerUrl = result.blockExplorerUrl;
            
            console.log(`✅ Hedera transfer successful: ${transactionHash}`);
        } else {
            // Mock transaction for development
            console.log('[Farmer Withdrawal] Using mock transaction');
            transactionHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substring(2)}`;
            console.log(`[Farmer Withdrawal] Mock transaction hash: ${transactionHash}`);
        }

        // Update withdrawal as completed
        await db.update(farmerWithdrawals)
            .set({
                status: 'completed',
                transactionHash,
                blockExplorerUrl,
                completedAt: Date.now(),
                updatedAt: Date.now()
            })
            .where(eq(farmerWithdrawals.id, withdrawalId));

        // Update farmer earnings as withdrawn
        const { farmerGroveEarnings } = await import('../db/schema/earnings-distribution');
        await db.update(farmerGroveEarnings)
            .set({
                distributionStatus: 'withdrawn',
                withdrawnAt: Date.now(),
                withdrawalTxHash: transactionHash
            })
            .where(and(
                eq(farmerGroveEarnings.farmerAddress, farmerAddress),
                eq(farmerGroveEarnings.groveId, groveId),
                eq(farmerGroveEarnings.distributionStatus, 'distributed')
            ));

        // Update balance
        console.log('[Farmer Withdrawal] Updating balance...');
        await balanceCalculationService.updateFarmerGroveBalance(farmerAddress, groveId);
        console.log('[Farmer Withdrawal] Balance updated');

        console.log('[Farmer Withdrawal] Sending success response');
        sendResponse(res, 200, {
            success: true,
            data: {
                withdrawalId,
                transactionHash,
                blockExplorerUrl,
                amount,
                message: 'Withdrawal processed successfully'
            }
        });
    } catch (error: any) {
        console.error('Error processing farmer withdrawal:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}
