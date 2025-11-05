/**
 * Earnings Distribution Router
 * Routes HTTP requests to appropriate endpoint handlers
 */

import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import * as farmerEndpoints from './farmer-balance-endpoints';
import * as investorEndpoints from './investor-earnings-endpoints';

/**
 * Handle earnings-related API requests
 * @param req - HTTP request
 * @param res - HTTP response
 * @returns true if request was handled, false otherwise
 */
export async function handleEarningsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    console.log(`[Earnings Router] Checking: ${method} ${pathname}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return true;
    }

    // Farmer Balance Endpoints
    // Match: /api/farmer/balance/:address/grove/:groveId
    if (pathname.match(/^\/api\/farmer\/balance\/.+\/grove\/\d+$/)) {
        console.log(`[Earnings Router] Matched: farmer grove balance`);
        if (method === 'GET') {
            await farmerEndpoints.getFarmerGroveBalance(req, res);
            return true;
        }
    }

    // Match: /api/farmer/balance/:address
    const farmerBalancePattern = /^\/api\/farmer\/balance\/.+$/;
    const matchesFarmerBalance = farmerBalancePattern.test(pathname);
    const hasGrove = pathname.includes('/grove/');
    
    console.log(`[Earnings Router] Testing farmer balance: matches=${matchesFarmerBalance}, hasGrove=${hasGrove}`);
    
    if (matchesFarmerBalance && !hasGrove) {
        console.log(`[Earnings Router] Matched: farmer all balances`);
        if (method === 'GET') {
            await farmerEndpoints.getAllFarmerGroveBalances(req, res);
            return true;
        }
    }

    // Legacy endpoint for backward compatibility: /api/revenue/farmer-balance
    if (pathname === '/api/revenue/farmer-balance' && method === 'GET') {
        console.log(`[Earnings Router] Matched: legacy farmer balance`);
        await farmerEndpoints.getLegacyFarmerBalance(req, res);
        return true;
    }

    // Match: /api/farmer/transactions/:address
    if (pathname.match(/^\/api\/farmer\/transactions\/.+$/)) {
        if (method === 'GET') {
            const address = pathname.split('/')[4];
            await farmerEndpoints.getFarmerTransactions(req, res, address);
            return true;
        }
    }

    // Match: /api/farmer/withdrawals/:address
    if (pathname.match(/^\/api\/farmer\/withdrawals\/.+$/)) {
        if (method === 'GET') {
            const address = pathname.split('/')[4];
            await farmerEndpoints.getFarmerWithdrawals(req, res, address);
            return true;
        }
    }

    if (pathname === '/api/farmer/withdraw') {
        console.log(`[Earnings Router] Matched: farmer withdraw, method=${method}`);
        // POST /api/farmer/withdraw
        if (method === 'POST') {
            console.log(`[Earnings Router] Calling processFarmerWithdrawal...`);
            await farmerEndpoints.processFarmerWithdrawal(req, res);
            console.log(`[Earnings Router] processFarmerWithdrawal completed`);
            return true;
        }
    }

    // Investor Earnings Endpoints
    // Match: /api/investor/balance/:address
    if (pathname.match(/^\/api\/investor\/balance\/.+$/)) {
        if (method === 'GET') {
            await investorEndpoints.getInvestorBalance(req, res);
            return true;
        }
    }

    // Match: /api/investor/earnings/unclaimed/:address
    if (pathname.match(/^\/api\/investor\/earnings\/unclaimed\/.+$/)) {
        if (method === 'GET') {
            await investorEndpoints.getInvestorUnclaimedEarnings(req, res);
            return true;
        }
    }

    if (pathname === '/api/investor/claim') {
        // POST /api/investor/claim
        if (method === 'POST') {
            await investorEndpoints.processInvestorClaim(req, res);
            return true;
        }
    }

    // Match: /api/investor/transactions/:address
    if (pathname.match(/^\/api\/investor\/transactions\/.+$/)) {
        if (method === 'GET') {
            const address = pathname.split('/')[4];
            await investorEndpoints.getInvestorTransactions(req, res, address);
            return true;
        }
    }

    // Match: /api/investor/claims/:address
    if (pathname.match(/^\/api\/investor\/claims\/.+$/)) {
        if (method === 'GET') {
            await investorEndpoints.getInvestorClaimHistory(req, res);
            return true;
        }
    }

    // Request not handled by this router
    console.log(`[Earnings Router] No match found for: ${method} ${pathname}`);
    return false;
}

/**
 * List all earnings-related endpoints
 */
export function getEarningsEndpoints() {
    return {
        farmer: [
            'GET /api/farmer/balance/:address - Get all grove balances',
            'GET /api/farmer/balance/:address/grove/:groveId - Get specific grove balance',
            'POST /api/farmer/withdraw - Process withdrawal'
        ],
        investor: [
            'GET /api/investor/balance/:address - Get balance summary',
            'GET /api/investor/earnings/unclaimed/:address - Get unclaimed earnings',
            'POST /api/investor/claim - Process claim',
            'GET /api/investor/claims/:address - Get claim history'
        ]
    };
}
