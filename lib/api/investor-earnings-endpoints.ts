/**
 * Investor Earnings API Endpoints
 * HTTP endpoints for investor earnings tracking and claims
 */

import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { balanceCalculationService } from './balance-calculation-service';
import { investorClaimService } from './investor-claim-service';
import { db } from '../db';
import { investorEarnings, investorClaims } from '../db/schema/earnings-distribution';
import { coffeeGroves } from '../db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';

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
 * GET /api/investor/balance/:address
 * Get investor balance summary
 */
export async function getInvestorBalance(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const pathParts = parsedUrl.pathname?.split('/') || [];
        const investorAddress = pathParts[pathParts.length - 1];

        if (!investorAddress) {
            return sendError(res, 400, 'Investor address is required');
        }

        const balance = await balanceCalculationService.getInvestorBalance(investorAddress);

        sendResponse(res, 200, {
            success: true,
            data: balance
        });
    } catch (error: any) {
        console.error('Error getting investor balance:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/investor/earnings/unclaimed/:address
 * Get investor's unclaimed earnings breakdown
 */
export async function getInvestorUnclaimedEarnings(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const pathParts = parsedUrl.pathname?.split('/') || [];
        const investorAddress = pathParts[pathParts.length - 1];

        if (!investorAddress) {
            return sendError(res, 400, 'Investor address is required');
        }

        const earnings = await investorClaimService.getUnclaimedEarnings(investorAddress);

        // Enrich earnings with grove names
        const enrichedEarnings = await Promise.all(
            earnings.all.map(async (earning) => {
                if (earning.groveId) {
                    const grove = await db.query.coffeeGroves.findFirst({
                        where: eq(coffeeGroves.id, earning.groveId)
                    });
                    return {
                        ...earning,
                        groveName: grove?.groveName || `Grove #${earning.groveId}`
                    };
                }
                return earning;
            })
        );

        sendResponse(res, 200, {
            success: true,
            data: {
                all: enrichedEarnings,
                grouped: earnings.grouped,
                totals: earnings.totals
            }
        });
    } catch (error: any) {
        console.error('Error getting unclaimed earnings:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * POST /api/investor/claim
 * Process investor claim
 */
export async function processInvestorClaim(req: IncomingMessage, res: ServerResponse) {
    try {
        // Body is already parsed by the main server
        const body = (req as any).body || {};
        const { investorAddress, earningIds, amount } = body;

        if (!investorAddress || !earningIds || !amount) {
            return sendError(res, 400, 'Missing required fields: investorAddress, earningIds, amount');
        }

        if (!Array.isArray(earningIds) || earningIds.length === 0) {
            return sendError(res, 400, 'earningIds must be a non-empty array');
        }

        // Validate claim request
        const validation = await investorClaimService.validateClaimRequest({
            investorAddress,
            earningIds,
            amount
        });

        if (!validation.isValid) {
            return sendError(res, 400, validation.errors.join(', '));
        }

        // Process claim
        const result = await investorClaimService.processInvestorClaim({
            investorAddress,
            earningIds,
            amount
        });

        if (result.success) {
            sendResponse(res, 200, {
                success: true,
                data: {
                    claimId: result.claimId,
                    transactionHash: result.transactionHash,
                    amount: result.amount,
                    message: 'Claim processed successfully'
                }
            });
        } else {
            // Return the actual error message from the claim service
            const errorMsg = result.error || 'Failed to process claim';
            sendError(res, 400, errorMsg);
        }
    } catch (error: any) {
        console.error('Error processing investor claim:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}

/**
 * GET /api/investor/claims/:address
 * Get investor's claim history
 */
export async function getInvestorClaimHistory(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedUrl = parse(req.url || '', true);
        const pathParts = parsedUrl.pathname?.split('/') || [];
        const investorAddress = pathParts[pathParts.length - 1];
        const limit = parseInt(parsedUrl.query.limit as string) || 50;

        if (!investorAddress) {
            return sendError(res, 400, 'Investor address is required');
        }

        const claims = await investorClaimService.getClaimHistory(investorAddress, limit);

        sendResponse(res, 200, {
            success: true,
            data: {
                claims
            }
        });
    } catch (error: any) {
        console.error('Error getting claim history:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}


/**
 * GET /api/investor/transactions/:address
 * Get complete transaction history (earnings + claims)
 */
export async function getInvestorTransactions(req: IncomingMessage, res: ServerResponse, investorAddress: string) {
    try {
        console.log(`[Investor Transactions] Fetching for ${investorAddress}`);
        
        // Get all earnings
        const earnings = await db.query.investorEarnings.findMany({
            where: eq(investorEarnings.investorAddress, investorAddress),
            orderBy: [desc(investorEarnings.distributedAt)]
        });
        
        // Get all claims
        const claims = await db.query.investorClaims.findMany({
            where: eq(investorClaims.investorAddress, investorAddress),
            orderBy: [desc(investorClaims.requestedAt)]
        });
        
        // Combine and format transactions
        const transactions = [
            // Earnings
            ...earnings.map(e => ({
                id: `earning-${e.id}`,
                type: 'earning',
                date: e.distributedAt,
                amount: e.earningAmount / 100,
                status: e.status,
                description: `Harvest earnings`,
                transactionHash: null,
                blockExplorerUrl: null
            })),
            // Claims
            ...claims.map(c => ({
                id: `claim-${c.id}`,
                type: 'claim',
                date: c.completedAt || c.requestedAt,
                amount: -(c.claimAmount / 100), // Negative for claims
                status: c.status,
                description: `Claimed earnings`,
                transactionHash: c.transactionHash,
                blockExplorerUrl: c.blockExplorerUrl
            }))
        ];
        
        // Sort by date descending
        transactions.sort((a, b) => b.date - a.date);
        
        console.log(`[Investor Transactions] Found ${transactions.length} transactions`);
        
        sendResponse(res, 200, {
            success: true,
            data: transactions
        });
    } catch (error: any) {
        console.error('[Investor Transactions] Error:', error);
        sendError(res, 500, error.message || 'Internal server error');
    }
}
