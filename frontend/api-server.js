#!/usr/bin/env node

/**
 * Simple API Server for Coffee Tree Platform Frontend Demo
 * Provides mock API endpoints without heavy dependencies
 */

import http from 'http';
import https from 'https';
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.API_PORT || '3005');
const DATA_FILE = path.join(__dirname, 'mock-data.json');

// Helper function to make HTTP requests to backend
function proxyToBackend(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (error) {
                    reject(new Error('Failed to parse response'));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Helper function to load persisted data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            console.log('✅ Loaded persisted data from', DATA_FILE);
            return data;
        }
    } catch (error) {
        console.error('⚠️ Error loading data, using defaults:', error.message);
    }
    return getDefaultData();
}

function getDefaultData() {
    return {
        groves: [
        {
            id: '1',
            groveName: 'Sunrise Valley Grove',
            location: 'Costa Rica, Central Valley',
            coordinates: { lat: 9.7489, lng: -83.7534 },
            treeCount: 150,
            coffeeVariety: 'Arabica',
            expectedYieldPerTree: 4.5,
            healthScore: 85,
            verificationStatus: 'verified',
            createdAt: new Date('2024-01-15').toISOString(),
            farmerAddress: '0.0.123456'
        },
        {
            id: '2',
            groveName: 'Mountain Peak Coffee',
            location: 'Colombia, Huila',
            coordinates: { lat: 2.5358, lng: -75.5273 },
            treeCount: 200,
            coffeeVariety: 'Bourbon',
            expectedYieldPerTree: 3.8,
            healthScore: 92,
            verificationStatus: 'verified',
            createdAt: new Date('2024-02-20').toISOString(),
            farmerAddress: '0.0.789012'
        }
    ],
    harvests: [
        {
            id: '1',
            groveId: '1',
            groveName: 'Sunrise Valley Grove',
            farmerAddress: '0.0.123456',
            harvestDate: '2024-11-15',
            yieldKg: 675,
            qualityGrade: 8,
            salePricePerKg: 4.25,
            totalRevenue: 2868.75,
            revenueDistributed: true
        }
    ],
    prices: {
        arabica: 4.25,
        robusta: 2.85,
        bourbon: 4.50,
        typica: 4.10,
        caturra: 4.35,
        geisha: 8.50
    }
};
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(mockData, null, 2));
        console.log('💾 Data persisted to', DATA_FILE);
    } catch (error) {
        console.error('⚠️ Error saving data:', error.message);
    }
}

// Load data on startup
const mockData = loadData();

// Revenue distributions store for mock server
mockData.revenueDistributions = [];

// Farmer withdrawals store
mockData.farmerWithdrawals = [];

// Mock user settings storage (in-memory for demo)
const mockUserSettings = {};

// Add a mock transaction history store
const mockTransactions = [];

// Add a store for investor holdings
const investorHoldings = new Map(); // Map of investorAddress -> array of holdings

// Utility functions
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-bypass'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    sendResponse(res, statusCode, { success: false, error: message });
}

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-bypass'
        });
        res.end();
        return;
    }
    
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';
    
    // Debug logging for investor verification requests
    if (pathname.includes('investor-verification')) {
        console.log(`🔍 Investor verification request: ${method} ${pathname}`);
    }
    
    try {
        // Parse request body for POST/PUT requests
        let body = {};
        if (method === 'POST' || method === 'PUT') {
            try {
                body = await parseRequestBody(req);
            } catch (error) {
                sendError(res, 400, 'Invalid JSON in request body');
                return;
            }
        }

        // Health check (support both /health and /api/health)
        if ((pathname === '/health' || pathname === '/api/health') && method === 'GET') {
            sendResponse(res, 200, { 
                success: true, 
                message: 'Coffee Tree Platform API is running',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
        
        // Market data endpoints
        else if (pathname === '/api/market/prices' && method === 'GET') {
            // Generate realistic market prices with multiple sources and grades
            const timestamp = new Date();
            const prices = [
                // Arabica prices from different sources
                {
                    variety: 0, // ARABICA
                    grade: 1,
                    pricePerKg: 4.50,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'ICE',
                    region: 'Global'
                },
                {
                    variety: 0, // ARABICA
                    grade: 1,
                    pricePerKg: 4.45,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'Yahoo Finance',
                    region: 'Global'
                },
                // Robusta prices
                {
                    variety: 1, // ROBUSTA
                    grade: 1,
                    pricePerKg: 2.85,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'ICE',
                    region: 'Global'
                },
                {
                    variety: 1, // ROBUSTA
                    grade: 1,
                    pricePerKg: 2.80,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'Investing.com',
                    region: 'Global'
                },
                // Specialty coffee (premium Arabica)
                {
                    variety: 2, // SPECIALTY
                    grade: 1,
                    pricePerKg: 6.08,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'Estimated (35% premium)',
                    region: 'Global'
                },
                // Organic coffee
                {
                    variety: 3, // ORGANIC
                    grade: 1,
                    pricePerKg: 5.63,
                    currency: 'USD',
                    timestamp: timestamp.toISOString(),
                    source: 'Estimated (25% premium)',
                    region: 'Global'
                }
            ];
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    prices: prices,
                    lastUpdated: timestamp.toISOString()
                }
            });
        }
        
        // Add a new endpoint for geocoding requests
        else if (pathname === '/api/geocode' && method === 'GET') {
            const { q } = parsedUrl.query;
            if (!q) {
                sendError(res, 400, 'Query parameter "q" is required');
                return;
            }

            try {
                // Proxy the request to Nominatim
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
                
                const proxyReq = https.get(url, {
                    headers: {
                        'User-Agent': 'CoffeeTreePlatform/1.0 (localhost development)',
                        'Referer': 'http://localhost:3001'
                    }
                }, (proxyRes) => {
                    let data = '';
                    proxyRes.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    proxyRes.on('end', () => {
                        // Set CORS headers to allow frontend access
                        res.writeHead(proxyRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                        });
                        res.end(data);
                    });
                });
                
                proxyReq.on('error', (error) => {
                    console.error('Geocoding proxy error:', error);
                    sendError(res, 500, 'Geocoding service unavailable');
                });
            } catch (error) {
                console.error('Geocoding error:', error);
                sendError(res, 500, 'Failed to process geocoding request');
            }
        }
        
        else if (pathname === '/api/market/overview' && method === 'GET') {
            sendResponse(res, 200, {
                success: true,
                totalGroves: mockData.groves.length,
                activeFarmers: 2,
                totalRevenue: 125000,
                timestamp: new Date().toISOString()
            });
        }
        
        else if (pathname === '/api/pricing/seasonal-multipliers' && method === 'GET') {
            // Seasonal price multipliers by month (1-12)
            // Based on typical coffee harvest seasons
            const multipliers = {
                1: 1.05,   // January - Post-harvest, moderate prices
                2: 1.08,   // February - Lower supply, prices rise
                3: 1.10,   // March - Pre-harvest peak
                4: 1.12,   // April - Highest prices before harvest
                5: 1.08,   // May - Early harvest begins
                6: 1.00,   // June - Main harvest, prices normalize
                7: 0.95,   // July - Peak harvest, lower prices
                8: 0.92,   // August - Abundant supply
                9: 0.95,   // September - Harvest ending
                10: 1.00,  // October - Post-harvest stabilization
                11: 1.03,  // November - Supply tightening
                12: 1.05   // December - Holiday demand
            };
            
            sendResponse(res, 200, {
                success: true,
                data: multipliers
            });
        }
        
        // Grove management endpoints
        else if (pathname.includes('/api/groves') && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            const includeAll = parsedUrl.query.includeAll === 'true';
            let groves = mockData.groves;
            
            if (farmerAddress && !includeAll) {
                // Filter by farmer for farmer dashboard
                groves = groves.filter(g => g.farmerAddress === farmerAddress);
            } else if (includeAll) {
                // Return all verified groves for investors
                groves = groves.filter(g => g.verificationStatus === 'verified');
            }
            
            sendResponse(res, 200, {
                success: true,
                groves: groves
            });
        }
        
        else if (pathname === '/api/groves/register' && method === 'POST') { // This is the correct endpoint
            console.log('[MOCK API] Received request for /api/groves/register');
            console.log('[MOCK API] Request body:', JSON.stringify(body, null, 2));
            
            // Ensure farmerAddress from the request body is included
            const newGrove = {
                id: (mockData.groves.length + 1).toString(),
                ...body,
                healthScore: Math.floor(Math.random() * 30) + 70,
                verificationStatus: 'pending',
                createdAt: new Date().toISOString(),
                farmerAddress: body.farmerAddress // Explicitly add farmerAddress
            };
            
            mockData.groves.push(newGrove);
            saveData();
            
            console.log('[MOCK API] Grove registered successfully:', newGrove);
            
            sendResponse(res, 200, {
                success: true,
                message: 'Grove registered successfully (Mock API)',
                groveId: newGrove.id
            });
        }
        // Backwards-compatible endpoint used by older UI code
        else if (pathname === '/api/farmer-verification/register-grove' && method === 'POST') {
            // First check if grove already exists
            const { groveName, farmerAddress } = body;
            const existingGroveIndex = mockData.groves.findIndex(g => 
                g.groveName === groveName && g.farmerAddress === farmerAddress
            );
            
            // If grove already exists, return success (idempotent behavior)
            if (existingGroveIndex >= 0) {
                sendResponse(res, 200, {
                    success: true,
                    message: 'Grove already registered',
                    groveId: mockData.groves[existingGroveIndex].id
                });
                return;
            }
            
            // Proxy to real backend API
            const backendPort = process.env.BACKEND_PORT || '3001';
            const backendUrl = `http://localhost:${backendPort}/api/farmer-verification/register-grove`;
            
            try {
                console.log('[PROXY] Forwarding grove registration to backend:', backendUrl);
                const result = await proxyToBackend(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                
                console.log('[PROXY] Backend grove registration response:', result.status, result.data.success ? 'SUCCESS' : 'FAILED');
                sendResponse(res, result.status, result.data);
            } catch (error) {
                console.error('[PROXY] Error proxying grove registration to backend:', error.message);
                // Fallback to mock implementation
                const newGrove = {
                    id: (mockData.groves.length + 1).toString(),
                    ...body,
                    healthScore: Math.floor(Math.random() * 30) + 70,
                    verificationStatus: 'pending',
                    createdAt: new Date().toISOString()
                };

                mockData.groves.push(newGrove);

                sendResponse(res, 200, {
                    success: true,
                    message: 'Grove registered successfully',
                    groveId: newGrove.id
                });
            }
        }
        
        // Harvest endpoints
        else if (pathname === '/api/harvest/history' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            let harvests = mockData.harvests;
            
            if (farmerAddress) {
                harvests = harvests.filter(h => h.farmerAddress === farmerAddress);
            }
            
            sendResponse(res, 200, {
                success: true,
                harvests: harvests
            });
        }
        
        else if (pathname === '/api/harvest/report' && method === 'POST') {
            console.log('[LOG] Received request for /api/harvest/report');
            try {
                const newHarvest= {
                    id: (mockData.harvests.length + 1).toString(),
                    ...body,
                    totalRevenue: body.yieldKg * body.salePricePerKg,
                    revenueDistributed: false,
                    createdAt: new Date().toISOString()
                };
                console.log('[LOG] Created new harvest object:', newHarvest);
            
            mockData.harvests.push(newHarvest);
            console.log('[LOG] Pushed new harvest to mockData.harvests');
            saveData();
            sendResponse(res, 200, {
                success: true,
                message: 'Harvest reported successfully',
                harvestId: newHarvest.id
                });
            console.log('[LOG] Response sent.');
        } catch (error) {
            console.error('[ERROR] An error occurred in /api/harvest/report handler:', error);
            sendError(res, 500, 'Internal server error in harvest report');
        }
        }

        else if (pathname === '/api/harvest/distribute' && method === 'POST') {
            const { harvestId } = body;
            if (!harvestId) {
                return sendError(res, 400, 'Harvest ID is required.');
            }

            const harvest = mockData.harvests.find(h => String(h.id) === String(harvestId));

            if (!harvest) {
                return sendError(res, 404, 'Harvest not found.');
            }

            harvest.revenueDistributed = true;

            sendResponse(res, 200, {
                success: true,
                message: `Revenue for harvest ${harvestId} has been distributed.`
            });
        }


        // Calculate distribution preview for a harvest
        else if (pathname === '/api/harvest/calculate-distribution' && method === 'POST') {
            const harvestId = body.harvestId || body.harvestId === 0 ? String(body.harvestId) : null;
            if (!harvestId) {
                sendError(res, 400, 'harvestId is required')
                return
            }

            const harvest = mockData.harvests.find(h => String(h.id) === String(harvestId))
            if (!harvest) {
                sendError(res, 404, 'Harvest not found')
                return
            }

            // Use farmerShare/investorShare if present, otherwise calculate 30/70 split
            const totalRevenue = Number(harvest.totalRevenue || (harvest.yieldKg * harvest.salePricePerKg) || 0)
            const farmerShare = Number(harvest.farmerShare ?? Math.floor(totalRevenue * 0.3))
            const investorShare = Number(harvest.investorShare ?? (totalRevenue - farmerShare))

            // Mock holders: split investorShare across 5 sample holders
            const numHolders = 5
            const perHolder = +(investorShare / numHolders).toFixed(2)
            const distributions = []
            for (let i = 0; i < numHolders; i++) {
                distributions.push({ holder: `0xMOCKHOLDER${i + 1}`, amount: perHolder })
            }

            sendResponse(res, 200, {
                success: true,
                data: {
                    harvestId: harvest.id,
                    totalRevenue,
                    farmerShare,
                    investorShare,
                    distributions
                }
            })
        }

        // Record a distribution and mark harvest as distributed
        else if (pathname === '/api/harvest/record-distribution' && method === 'POST') {
            const harvestId = body.harvestId || body.harvestId === 0 ? String(body.harvestId) : null
            const distributions = body.distributions || []

            if (!harvestId) {
                sendError(res, 400, 'harvestId is required')
                return
            }

            const harvest = mockData.harvests.find(h => String(h.id) === String(harvestId))
            if (!harvest) {
                sendError(res, 404, 'Harvest not found')
                return
            }

            // Record distribution
            const distRecord = {
                id: (mockData.revenueDistributions.length + 1).toString(),
                harvestId: harvest.id,
                date: new Date().toISOString(),
                amount: distributions.reduce((s, d) => s + (Number(d.amount) || 0), 0),
                distributions
            }

            mockData.revenueDistributions.push(distRecord)

            // Mark harvest as distributed
            harvest.revenueDistributed = true

            sendResponse(res, 200, {
                success: true,
                message: 'Distribution recorded',
                distributionId: distRecord.id
            })
        }

        // List pending distributions (harvests not yet distributed)
        else if (pathname === '/api/harvest/pending-distributions' && method === 'GET') {
            const pending = mockData.harvests.filter(h => !h.revenueDistributed)
            sendResponse(res, 200, {
                success: true,
                harvests: pending
            })
        }
        
        else if (pathname === '/api/harvest/stats' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            const farmerHarvests = mockData.harvests.filter(h => h.farmerAddress === farmerAddress);
            
            const totalEarnings = farmerHarvests.reduce((sum, h) => sum + (h.totalRevenue || 0), 0);
            const monthlyEarnings = farmerHarvests
                .filter(h => new Date(h.harvestDate).getMonth() === new Date().getMonth())
                .reduce((sum, h) => sum + (h.totalRevenue || 0), 0);
            
            // Calculate farmer's 30% share
            const farmerTotalShare = totalEarnings * 0.3;
            const farmerMonthlyShare = monthlyEarnings * 0.3;
            
            // Calculate pending (harvests not yet distributed)
            const pendingHarvests = farmerHarvests.filter(h => !h.revenueDistributed);
            const pendingDistributions = pendingHarvests.reduce((sum, h) => sum + (h.totalRevenue || 0), 0) * 0.3;
            
            // Calculate available balance (distributed but not withdrawn)
            const distributedHarvests = farmerHarvests.filter(h => h.revenueDistributed === true);
            const totalDistributedShare = distributedHarvests.reduce((sum, h) => sum + (h.totalRevenue || 0), 0) * 0.3;
            
            // Get total withdrawn
            const farmerWithdrawals = mockData.farmerWithdrawals?.filter(w => w.farmerAddress === farmerAddress) || [];
            const totalWithdrawn = farmerWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
            
            const availableBalance = totalDistributedShare - totalWithdrawn;
            
            sendResponse(res, 200, {
                success: true,
                stats: {
                    totalEarnings: farmerTotalShare,
                    monthlyEarnings: farmerMonthlyShare,
                    pendingDistributions: pendingDistributions,
                    availableBalance: availableBalance,
                    pendingBalance: pendingDistributions,
                    totalWithdrawn: totalWithdrawn
                }
            });
        }
        
        else if (pathname === '/api/revenue/withdraw-farmer-share' && method === 'POST') {
            const { groveId, amount, farmerAddress } = body;
            
            if (!farmerAddress || !amount || amount <= 0) {
                sendError(res, 400, 'Invalid withdrawal request');
                return;
            }
            
            // Create withdrawal record
            const withdrawal = {
                id: (mockData.farmerWithdrawals.length + 1).toString(),
                farmerAddress: farmerAddress,
                groveId: groveId,
                amount: amount,
                date: new Date().toISOString(),
                status: 'completed'
            };
            
            mockData.farmerWithdrawals.push(withdrawal);
            
            sendResponse(res, 200, { success: true, message: 'Withdrawal processed successfully', withdrawalId: withdrawal.id });
        }
        
        // Holder earnings endpoint for charts
        else if (pathname.match(/^\/api\/harvest\/holder\/[^\/]+\/earnings$/) && method === 'GET') {
            const holderAddress = pathname.split('/')[4];
            const farmerHarvests = mockData.harvests.filter(h => h.farmerAddress === holderAddress);
            
            // Create distribution history from harvests
            const distributionHistory = farmerHarvests.map(h => ({
                date: h.harvestDate,
                amount: (h.totalRevenue || 0) * 0.3, // Farmer gets 30%
                harvestId: h.id,
                groveName: h.groveName
            }));
            
            const totalEarnings = distributionHistory.reduce((sum, d) => sum + d.amount, 0);
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    totalEarnings: totalEarnings,
                    distributionHistory: distributionHistory
                }
            });
        }
        
        // Farmer revenue/withdrawal endpoints
        else if (pathname === '/api/revenue/farmer-balance' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            const farmerHarvests = mockData.harvests.filter(h => h.farmerAddress === farmerAddress);
            
            // Calculate distributed amount (30% of distributed harvests)
            const distributedHarvests = farmerHarvests.filter(h => h.revenueDistributed);
            const distributedAmount = distributedHarvests.reduce((sum, h) => sum + (h.totalRevenue || 0), 0) * 0.3;
            
            // Get total withdrawn
            const farmerWithdrawals = mockData.farmerWithdrawals.filter(w => w.farmerAddress === farmerAddress);
            const totalWithdrawn = farmerWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
            
            const availableBalance = distributedAmount - totalWithdrawn;
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    availableBalance: availableBalance,
                    totalWithdrawn: totalWithdrawn
                }
            });
        }
        
        else if (pathname === '/api/revenue/withdraw-farmer-share' && method === 'POST') {
            const { groveId, amount, farmerAddress } = body;
            
            if (!farmerAddress || !amount || amount <= 0) {
                sendError(res, 400, 'Invalid withdrawal request');
                return;
            }
            
            // Create withdrawal record
            const withdrawal = {
                id: (mockData.farmerWithdrawals.length + 1).toString(),
                farmerAddress: farmerAddress,
                groveId: groveId,
                amount: amount,
                date: new Date().toISOString(),
                status: 'completed'
            };
            
            mockData.farmerWithdrawals.push(withdrawal);
            
            sendResponse(res, 200, {
                success: true,
                message: 'Withdrawal processed successfully',
                withdrawalId: withdrawal.id
            });
        }
        
        else if (pathname === '/api/revenue/withdrawal-history' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            const withdrawals = mockData.farmerWithdrawals.filter(w => w.farmerAddress === farmerAddress);
            
            sendResponse(res, 200, {
                success: true,
                withdrawals: withdrawals
            });
        }
        
        // Farmer verification endpoints
        else if (pathname.startsWith('/api/farmer-verification/status/') && method === 'GET') {
            const farmerAddress = pathname.split('/').pop();
            
            // Simulate different verification statuses based on account ID
            let status = 'pending';
            let verificationDate = null;
            let rejectionReason = null;
            
            // Mock logic: some accounts are verified, some pending, some rejected
            const lastDigit = parseInt(farmerAddress.split('.')[2]) % 10;
            
            if (lastDigit < 3) {
                status = 'verified';
                verificationDate = new Date('2024-01-01').toISOString();
            } else if (lastDigit < 7) {
                status = 'pending';
            } else {
                status = 'rejected';
                rejectionReason = 'Land ownership documents were unclear. Please provide clearer images.';
            }
            
            sendResponse(res, 200, {
                success: true,
                verification: {
                    status: status,
                    verificationDate: verificationDate,
                    rejectionReason: rejectionReason,
                    submissionDate: new Date('2024-12-01').toISOString()
                }
            });
        }
        
        else if (pathname === '/api/farmer-verification/submit-documents' && method === 'POST') {
            sendResponse(res, 200, {
                success: true,
                message: 'Documents submitted successfully'
            });
        }
        
        // Investor verification endpoints
        else if (pathname.startsWith('/api/investor-verification/status/') && method === 'GET') {
            console.log('Investor verification status request:', pathname);
            const investorAddress = pathname.split('/').pop();
            
            // Simulate different verification statuses based on account ID
            let status = 'pending';
            let verificationDate = null;
            let rejectionReason = null;
            
            // Mock logic: different from farmers - some accounts are verified, some pending, some rejected
            const lastDigit = parseInt(investorAddress.split('.')[2]) % 10;
            
            if (lastDigit < 4) {
                status = 'verified';
                verificationDate = new Date('2024-01-01').toISOString();
            } else if (lastDigit < 8) {
                status = 'pending';
            } else {
                status = 'rejected';
                rejectionReason = 'Financial information was insufficient. Please provide more recent bank statements.';
            }
            
            sendResponse(res, 200, {
                success: true,
                verification: {
                    status: status,
                    verificationDate: verificationDate,
                    rejectionReason: rejectionReason,
                    submissionDate: new Date('2024-12-01').toISOString()
                }
            });
        }
        
        else if (pathname === '/api/investor-verification/submit-documents' && method === 'POST') {
            sendResponse(res, 200, {
                success: true,
                message: 'Investor documents submitted successfully'
            });
        }
        
        // Investment endpoints (mock)
        else if (pathname === '/api/investment/available-groves' && method === 'GET') {
            // Use mock data directly (backend server not running)
            const availableGroves = mockData.groves
                .filter(grove => grove.verificationStatus === 'verified') // Only show verified groves
                .map(grove => ({
                    ...grove,
                    tokensAvailable: Math.floor(grove.treeCount * 0.5),
                    pricePerToken: 25 + Math.random() * 10,
                    projectedAnnualReturn: 10 + Math.random() * 8
                }));
            
            sendResponse(res, 200, {
                success: true,
                groves: availableGroves
            });
        }
        
        else if (pathname === '/api/investment/portfolio' && method === 'GET') {
            // Proxy to real backend API
            const backendPort = process.env.BACKEND_PORT || '3001';
            const backendUrl = `http://localhost:${backendPort}${req.url}`;
            
            try {
                console.log('[PROXY] Forwarding portfolio request to backend:', backendUrl);
                const result = await proxyToBackend(backendUrl, {
                    method: 'GET'
                });
                
                console.log('[PROXY] Backend portfolio response:', result.status, `${result.data.portfolio?.holdings?.length || 0} holdings`);
                sendResponse(res, result.status, result.data);
            } catch (error) {
                console.error('[PROXY] Error proxying portfolio to backend:', error.message);
                // Fallback to mock implementation
                const investorAddress = parsedUrl.query.investorAddress;
                const holdings = investorHoldings.get(investorAddress) || [];
                
                let totalInvestment = 0;
                let currentValue = 0;
                let totalReturns = 0;
                
                holdings.forEach(holding => {
                    totalInvestment += holding.totalInvestment;
                    currentValue += holding.currentWorth;
                });
                
                totalReturns = currentValue - totalInvestment;
                const roi = totalInvestment > 0 ? (totalReturns / totalInvestment) * 100 : 0;
                
                sendResponse(res, 200, {
                    success: true,
                    portfolio: {
                        totalInvestment: totalInvestment,
                        currentValue: currentValue,
                        totalReturns: totalReturns,
                        roi: roi,
                        holdings: holdings
                    }
                });
            }
        }
        
        else if (pathname === '/api/investment/invest' && method === 'POST') {
            sendResponse(res, 200, {
                success: true,
                message: 'Investment successful'
            });
        }
        
        else if (pathname === '/api/investment/purchase-tokens' && method === 'POST') {
            // Proxy to real backend API
            const backendPort = process.env.BACKEND_PORT || '3001';
            const backendUrl = `http://localhost:${backendPort}/api/investment/purchase-tokens`;
            
            try {
                console.log('[PROXY] Forwarding purchase request to backend:', backendUrl);
                const result = await proxyToBackend(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                
                console.log('[PROXY] Backend response:', result.status, result.data.success ? 'SUCCESS' : 'FAILED');
                sendResponse(res, result.status, result.data);
            } catch (error) {
                console.error('[PROXY] Error proxying purchase to backend:', error.message);
                // Fallback to mock implementation
                try {
                    const { groveId, tokenAmount, investorAddress } = body;
                    
                    if (!groveId || !tokenAmount || !investorAddress) {
                        sendError(res, 400, 'Missing required parameters: groveId, tokenAmount, investorAddress');
                        return;
                    }
                    
                    if (tokenAmount <= 0) {
                        sendError(res, 400, 'Token amount must be positive');
                        return;
                    }
                    
                    const grove = mockData.groves.find(g => g.id === groveId);
                    if (!grove) {
                        sendError(res, 404, 'Grove not found');
                        return;
                    }
                    
                    const pricePerToken = 25 + Math.random() * 10;
                    const totalInvestment = tokenAmount * pricePerToken;
                    const currentWorth = totalInvestment * 1.1;
                    
                    const newHolding = {
                        groveId: grove.id,
                        groveName: grove.groveName,
                        tokenAmount: tokenAmount,
                        purchasePrice: pricePerToken,
                        currentValue: currentWorth,
                        totalInvestment: totalInvestment,
                        currentWorth: currentWorth,
                        earnings: currentWorth - totalInvestment,
                        purchaseDate: new Date().toISOString()
                    };
                    
                    if (!investorHoldings.has(investorAddress)) {
                        investorHoldings.set(investorAddress, []);
                    }
                    
                    const holdings = investorHoldings.get(investorAddress);
                    const existingHoldingIndex = holdings.findIndex(h => h.groveId === groveId);
                    
                    if (existingHoldingIndex >= 0) {
                        const existingHolding = holdings[existingHoldingIndex];
                        const totalTokens = existingHolding.tokenAmount + tokenAmount;
                        const totalInvested = existingHolding.totalInvestment + totalInvestment;
                        const avgPrice = totalInvested / totalTokens;
                        
                        holdings[existingHoldingIndex] = {
                            ...existingHolding,
                            tokenAmount: totalTokens,
                            purchasePrice: avgPrice,
                            totalInvestment: totalInvested,
                            currentWorth: totalTokens * avgPrice * 1.1,
                            earnings: totalTokens * avgPrice * 0.1,
                            purchaseDate: new Date().toISOString()
                        };
                    } else {
                        holdings.push(newHolding);
                    }
                    
                    sendResponse(res, 200, {
                        success: true,
                        message: 'Tokens purchased successfully',
                        transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
                    });
                } catch (fallbackError) {
                    console.error('Error in fallback implementation:', fallbackError);
                    sendError(res, 500, 'Failed to process token purchase');
                }
            }
        }
        
        // Earnings endpoints
        else if (pathname === '/api/earnings/holder' && method === 'GET') {
            const holderAddress = parsedUrl.query.holderAddress;
            
            sendResponse(res, 200, {
                success: true,
                earnings: {
                    totalEarnings: 1250.75,
                    monthlyEarnings: 125.50,
                    pendingDistributions: 45.25,
                    lastDistribution: new Date('2024-11-15').toISOString(),
                    earningsHistory: [
                        {
                            date: '2024-11-15',
                            amount: 125.50,
                            groveId: '1',
                            groveName: 'Sunrise Valley Grove',
                            tokenAmount: 25,
                            harvestId: 'H001'
                        },
                        {
                            date: '2024-10-15',
                            amount: 98.75,
                            groveId: '1',
                            groveName: 'Sunrise Valley Grove',
                            tokenAmount: 25,
                            harvestId: 'H002'
                        },
                        {
                            date: '2024-09-15',
                            amount: 110.25,
                            groveId: '1',
                            groveName: 'Sunrise Valley Grove',
                            tokenAmount: 25,
                            harvestId: 'H003'
                        },
                        {
                            date: '2024-08-15',
                            amount: 95.00,
                            groveId: '1',
                            groveName: 'Sunrise Valley Grove',
                            tokenAmount: 25,
                            harvestId: 'H004'
                        },
                        {
                            date: '2024-07-15',
                            amount: 87.50,
                            groveId: '1',
                            groveName: 'Sunrise Valley Grove',
                            tokenAmount: 25,
                            harvestId: 'H005'
                        }
                    ]
                }
            });
        }
        
        // Marketplace endpoints
        else if (pathname === '/api/marketplace/listings' && method === 'GET') {
            sendResponse(res, 200, {
                success: true,
                listings: [
                    {
                        id: '1',
                        groveId: '1',
                        groveName: 'Sunrise Valley Grove',
                        tokenAmount: 10,
                        pricePerToken: 28.50,
                        originalPrice: 25.00,
                        totalPrice: 285.00,
                        sellerAddress: '0.0.123456',
                        coffeeVariety: 'Arabica',
                        location: 'Costa Rica, Central Valley',
                        healthScore: 85,
                        listingDate: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: '2',
                        groveId: '2',
                        groveName: 'Mountain Peak Coffee',
                        tokenAmount: 5,
                        pricePerToken: 32.00,
                        originalPrice: 30.00,
                        totalPrice: 160.00,
                        sellerAddress: '0.0.789012',
                        coffeeVariety: 'Bourbon',
                        location: 'Colombia, Huila',
                        healthScore: 92,
                        listingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ]
            });
        }
        
        else if (pathname === '/api/marketplace/list-tokens' && method === 'POST') {
            sendResponse(res, 200, {
                success: true,
                message: 'Tokens listed for sale successfully',
                listingId: Math.random().toString(36).substr(2, 9)
            });
        }
        
        else if (pathname === '/api/marketplace/purchase' && method === 'POST') {
            try {
                const { listingId, tokenAmount, buyerAddress } = body;
                
                // Validate inputs
                if (!listingId || !tokenAmount || !buyerAddress) {
                    sendError(res, 400, 'Missing required parameters: listingId, tokenAmount, buyerAddress');
                    return;
                }
                
                if (tokenAmount <= 0) {
                    sendError(res, 400, 'Token amount must be positive');
                    return;
                }
                
                // Find the listing (mock data - in a real implementation this would query the database)
                const mockListings = [
                    {
                        id: '1',
                        groveId: '1',
                        groveName: 'Sunrise Valley Grove',
                        tokenAmount: 100,
                        pricePerToken: 28.50,
                        sellerAddress: '0.0.123456',
                        isActive: true
                    },
                    {
                        id: '2',
                        groveId: '2',
                        groveName: 'Mountain Peak Coffee',
                        tokenAmount: 50,
                        pricePerToken: 32.00,
                        sellerAddress: '0.0.789012',
                        isActive: true
                    }
                ];
                
                const listing = mockListings.find(l => l.id === listingId && l.isActive);
                if (!listing) {
                    sendError(res, 404, 'Listing not found or inactive');
                    return;
                }
                
                // Check if enough tokens available
                if (tokenAmount > listing.tokenAmount) {
                    sendError(res, 400, 'Not enough tokens available');
                    return;
                }
                
                // Calculate purchase details
                const totalInvestment = tokenAmount * listing.pricePerToken;
                const currentWorth = totalInvestment * 1.1; // Mock 10% gain
                
                // Create holding record
                const newHolding = {
                    groveId: listing.groveId,
                    groveName: listing.groveName,
                    tokenAmount: tokenAmount,
                    purchasePrice: listing.pricePerToken,
                    currentValue: currentWorth,
                    totalInvestment: totalInvestment,
                    currentWorth: currentWorth,
                    earnings: currentWorth - totalInvestment,
                    purchaseDate: new Date().toISOString()
                };
                
                // Add to buyer's holdings
                if (!investorHoldings.has(buyerAddress)) {
                    investorHoldings.set(buyerAddress, []);
                }
                
                const holdings = investorHoldings.get(buyerAddress);
                // Check if buyer already has holdings in this grove
                const existingHoldingIndex = holdings.findIndex(h => h.groveId === listing.groveId);
                
                if (existingHoldingIndex >= 0) {
                    // Update existing holding
                    const existingHolding = holdings[existingHoldingIndex];
                    const totalTokens = existingHolding.tokenAmount + tokenAmount;
                    const totalInvested = existingHolding.totalInvestment + totalInvestment;
                    const avgPrice = totalInvested / totalTokens;
                    
                    holdings[existingHoldingIndex] = {
                        ...existingHolding,
                        tokenAmount: totalTokens,
                        purchasePrice: avgPrice,
                        totalInvestment: totalInvested,
                        currentWorth: totalTokens * avgPrice * 1.1, // Maintain 10% gain
                        earnings: totalTokens * avgPrice * 0.1,
                        purchaseDate: new Date().toISOString() // Update purchase date
                    };
                } else {
                    // Add new holding
                    holdings.push(newHolding);
                }
                
                sendResponse(res, 200, {
                    success: true,
                    message: 'Tokens purchased successfully',
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
                });
            } catch (error) {
                console.error('Error processing marketplace purchase:', error);
                sendError(res, 500, 'Failed to process marketplace purchase');
            }
        }
        
        else if (pathname === '/api/marketplace/stats' && method === 'GET') {
            sendResponse(res, 200, {
                success: true,
                stats: {
                    totalListings: 5,
                    totalVolume: 12500.00,
                    averagePrice: 27.50,
                    activeListings: 3
                }
            });
        }
        
        else if (pathname === '/api/marketplace/user-listings' && method === 'GET') {
            const sellerAddress = parsedUrl.query.sellerAddress;
            
            sendResponse(res, 200, {
                success: true,
                listings: [
                    {
                        id: '1',
                        groveId: '1',
                        groveName: 'Sunrise Valley Grove',
                        tokenAmount: 10,
                        pricePerToken: 28.50,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    }
                ]
            });
        }
        
        // User settings endpoints
        else if (pathname.startsWith('/api/user/settings/') && method === 'GET') {
            const accountId = pathname.split('/').pop();
            
            // Return stored settings or defaults
            const settings = mockUserSettings[accountId] || {
                skipFarmerVerification: false,
                skipInvestorVerification: false,
                demoBypass: false
            };
            
            sendResponse(res, 200, {
                success: true,
                settings: settings
            });
        }

        else if (pathname.startsWith('/api/user/settings/') && method === 'PUT') {
            const accountId = pathname.split('/').pop();
            const settings = body || {};
            
            // Store the settings in memory
            mockUserSettings[accountId] = {
                skipFarmerVerification: settings.skipFarmerVerification || false,
                skipInvestorVerification: settings.skipInvestorVerification || false,
                demoBypass: settings.demoBypass || false,
                updatedAt: new Date().toISOString()
            };
            
            sendResponse(res, 200, {
                success: true,
                settings: mockUserSettings[accountId]
            });
        }
        
        // Pricing API endpoints
        else if (pathname === '/api/pricing/all-varieties' && method === 'GET') {
            try {
                // Base prices by variety with grades 1-10 (these would come from the contract in a real implementation)
                const varieties = [
                    {
                        variety: 'ARABICA',
                        grades: Array.from({length: 10}, (_, i) => ({
                            grade: i + 1,
                            price: 2.50 + (i * 0.35)
                        }))
                    },
                    {
                        variety: 'ROBUSTA',
                        grades: Array.from({length: 10}, (_, i) => ({
                            grade: i + 1,
                            price: 1.80 + (i * 0.24)
                        }))
                    },
                    {
                        variety: 'SPECIALTY',
                        grades: Array.from({length: 10}, (_, i) => ({
                            grade: i + 1,
                            price: 3.50 + (i * 0.55)
                        }))
                    },
                    {
                        variety: 'ORGANIC',
                        grades: Array.from({length: 10}, (_, i) => ({
                            grade: i + 1,
                            price: 3.00 + (i * 0.45)
                        }))
                    },
                    {
                        variety: 'TYPICA',
                        grades: Array.from({length: 10}, (_, i) => ({
                            grade: i + 1,
                            price: 3.20 + (i * 0.40)
                        }))
                    }
                ];
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        varieties,
                        lastUpdated: new Date().toISOString()
                    }
                });
            } catch (error) {
                console.error('Error fetching all variety prices:', error);
                sendError(res, 500, 'Failed to fetch variety prices');
            }
        }
        
        else if (pathname === '/api/pricing/seasonal-multipliers' && method === 'GET') {
            try {
                // Mock seasonal multipliers (these would come from the contract in a real implementation)
                const seasonalMultipliers = {
                    1: 0.9,  // January - Low season
                    2: 0.85, // February - Low season
                    3: 0.95, // March - Low season
                    4: 1.1,  // April - Harvest season
                    5: 1.2,  // May - Harvest season
                    6: 1.3,  // June - Peak harvest
                    7: 1.25, // July - Peak harvest
                    8: 1.2,  // August - Harvest season
                    9: 1.1,  // September - Harvest season
                    10: 1.0, // October - Normal
                    11: 0.95,// November - Normal
                    12: 0.9  // December - Low season
                };
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        seasonalMultipliers,
                        lastUpdated: new Date().toISOString()
                    }
                });
            } catch (error) {
                console.error('Error fetching seasonal multipliers:', error);
                sendError(res, 500, 'Failed to fetch seasonal multipliers');
            }
        }
        
        else if (pathname === '/api/pricing/projected-revenue' && method === 'POST') {
            const { groveTokenAddress, variety, grade, expectedYieldKg, harvestMonth } = body || {};
            
            console.log('Projected revenue request body:', body);
            
            // Validate required parameters
            if (!variety || grade === undefined || !expectedYieldKg || !harvestMonth) {
                sendError(res, 400, 'variety, grade, expectedYieldKg, and harvestMonth are required');
                return;
            }
            
            // Normalize variety to uppercase
            const normalizedVariety = typeof variety === 'string' ? variety.toUpperCase() : variety;
            
            try {
                // Mock seasonal multipliers (these would come from the contract in a real implementation)
                const seasonalMultipliers = {
                    1: 0.9,  // January - Low season
                    2: 0.85, // February - Low season
                    3: 0.95, // March - Low season
                    4: 1.1,  // April - Harvest season
                    5: 1.2,  // May - Harvest season
                    6: 1.3,  // June - Peak harvest
                    7: 1.25, // July - Peak harvest
                    8: 1.2,  // August - Harvest season
                    9: 1.1,  // September - Harvest season
                    10: 1.0, // October - Normal
                    11: 0.95,// November - Normal
                    12: 0.9  // December - Low season
                };
                
                // Base prices by variety (these would come from the contract in a real implementation)
                const basePrices = {
                    'ARABICA': 4.50,
                    'ROBUSTA': 2.80,
                    'SPECIALTY': 6.00,
                    'ORGANIC': 5.20,
                    'TYPICA': 4.20
                };
                
                const basePrice = basePrices[normalizedVariety] || 4.00;
                const multiplier = seasonalMultipliers[harvestMonth] || 1.0;
                const pricePerKg = basePrice * multiplier;
                const projectedRevenue = expectedYieldKg * pricePerKg;
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        projectedRevenue: parseFloat(projectedRevenue.toFixed(2)),
                        pricePerKg: parseFloat(pricePerKg.toFixed(2)),
                        basePrice: parseFloat(basePrice.toFixed(2)),
                        seasonalMultiplier: multiplier,
                        expectedYieldKg,
                        variety: normalizedVariety,
                        grade,
                        harvestMonth
                    }
                });
            } catch (error) {
                console.error('Error calculating projected revenue:', error);
                sendError(res, 500, 'Failed to calculate projected revenue');
            }
        }
        
        else if (pathname === '/api/pricing/validate-price' && method === 'POST') {
            const { variety, grade, proposedPrice } = body || {};
            
            if (!variety || grade === undefined || !proposedPrice) {
                sendError(res, 400, 'variety, grade, and proposedPrice are required');
                return;
            }
            
            // Normalize variety to uppercase
            const normalizedVariety = typeof variety === 'string' ? variety.toUpperCase() : variety;
            
            try {
                // Base prices by variety (these would come from the contract in a real implementation)
                const basePrices = {
                    'ARABICA': 4.50,
                    'ROBUSTA': 2.80,
                    'SPECIALTY': 6.00,
                    'ORGANIC': 5.20,
                    'TYPICA': 4.20
                };
                
                const marketPrice = basePrices[normalizedVariety] || 4.00;
                const minPrice = marketPrice * 0.5;
                const maxPrice = marketPrice * 2.0;
                
                const isValid = proposedPrice >= minPrice && proposedPrice <= maxPrice;
                let message = '';
                
                if (isValid) {
                    message = 'Price is within acceptable range';
                } else if (proposedPrice < minPrice) {
                    message = `Price too low. Minimum acceptable: $${minPrice.toFixed(2)}/kg`;
                } else {
                    message = `Price too high. Maximum acceptable: $${maxPrice.toFixed(2)}/kg`;
                }
                
                sendResponse(res, 200, {
                    success: true,
                    data: {
                        isValid,
                        message,
                        marketPrice: parseFloat(marketPrice.toFixed(2)),
                        minPrice: parseFloat(minPrice.toFixed(2)),
                        maxPrice: parseFloat(maxPrice.toFixed(2)),
                        proposedPrice: parseFloat(proposedPrice.toFixed(2))
                    }
                });
            } catch (error) {
                console.error('Error validating price:', error);
                sendError(res, 500, 'Failed to validate price');
            }
        }
        
        // Revenue Distribution endpoints
        else if (pathname === '/api/revenue/farmer-balance' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            
            // Calculate farmer's available balance from harvests
            const farmerHarvests = mockData.harvests.filter(h => h.farmerAddress === farmerAddress);
            const totalRevenue = farmerHarvests.reduce((sum, h) => sum + (h.totalRevenue || 0), 0);
            const farmerShare = totalRevenue * 0.3; // 30% farmer share
            const withdrawn = 0; // Mock: no withdrawals yet
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    farmerAddress,
                    availableBalance: farmerShare - withdrawn,
                    pendingBalance: 0,
                    totalWithdrawn: withdrawn,
                    lastWithdrawal: null
                }
            });
        }
        
        else if (pathname === '/api/revenue/withdrawal-history' && method === 'GET') {
            const farmerAddress = parsedUrl.query.farmerAddress;
            
            // Mock: return empty withdrawal history
            sendResponse(res, 200, {
                success: true,
                data: {
                    farmerAddress,
                    withdrawals: [],
                    pagination: {
                        total: 0,
                        limit: 20,
                        offset: 0
                    }
                }
            });
        }
        
        else if (pathname === '/api/revenue/withdraw-farmer-share' && method === 'POST') {
            const { groveId, amount, farmerAddress } = body || {};
            
            console.log('Withdrawal request received:', { groveId, amount, farmerAddress });
            
            // Create a transaction record
            const transaction = {
                id: `txn_${Date.now()}`,
                type: 'withdrawal',
                amount: amount,
                farmerAddress: farmerAddress,
                groveId: groveId,
                timestamp: new Date().toISOString(),
                status: 'completed',
                transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
            };
            
            // Save transaction to history
            mockTransactions.push(transaction);
            console.log('Transaction saved:', transaction);
            console.log('Current mockTransactions length:', mockTransactions.length);
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    withdrawalId: `withdraw_${Date.now()}`,
                    farmerAddress,
                    amount,
                    transactionHash: transaction.transactionHash,
                    withdrawnAt: new Date().toISOString(),
                    remainingBalance: 0
                }
            });
        }
        
        else if (pathname === '/api/revenue/distribution-history' && method === 'GET') {
            const holderAddress = parsedUrl.query.holderAddress;
            
            // Mock: return empty distribution history
            sendResponse(res, 200, {
                success: true,
                data: {
                    holderAddress,
                    totalEarnings: 0,
                    distributions: [],
                    pagination: {
                        total: 0,
                        limit: 20,
                        offset: 0
                    }
                }
            });
        }
        
        else if (pathname === '/api/revenue/pending-distributions' && method === 'GET') {
            const holderAddress = parsedUrl.query.holderAddress;
            
            // Mock pending distributions
            const mockPendingDistributions = [
                {
                    distributionId: 'dist_pending_001',
                    harvestId: 3,
                    groveName: 'Highland Estate',
                    tokenBalance: 75,
                    totalRevenue: 10000,
                    shareAmount: 187.75,
                    distributionDate: new Date().toISOString(),
                    status: 'pending'
                }
            ];
            
            sendResponse(res, 200, {
                success: true,
                distributions: mockPendingDistributions
            });
        }
        
        else if (pathname === '/api/revenue/claim-earnings' && method === 'POST') {
            const { distributionId, holderAddress } = body || {};
            
            // Mock claiming earnings
            sendResponse(res, 200, {
                success: true,
                data: {
                    distributionId,
                    holderAddress,
                    amount: 187.75,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    claimedAt: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/revenue/create-distribution' && method === 'POST') {
            const { harvestId, totalRevenue } = body || {};
            
            // Mock creating distribution
            sendResponse(res, 200, {
                success: true,
                data: {
                    distributionId: `dist_${Date.now()}`,
                    harvestId,
                    totalRevenue,
                    distributedAt: new Date().toISOString(),
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
                }
            });
        }
        
        // Lending Pool endpoints
        else if (pathname === '/api/lending/pools' && method === 'GET') {
            // Mock lending pools
            const mockPools = [
                {
                    assetAddress: 'USDC',
                    assetName: 'USDC Stablecoin',
                    lpTokenAddress: 'LP-USDC-001',
                    totalLiquidity: 150000,
                    availableLiquidity: 95000,
                    totalBorrowed: 55000,
                    utilizationRate: 0.367,
                    currentAPY: 8.5,
                    totalLPTokens: 150000
                },
                {
                    assetAddress: 'KES',
                    assetName: 'Kenyan Shilling',
                    lpTokenAddress: 'LP-KES-001',
                    totalLiquidity: 75000,
                    availableLiquidity: 45000,
                    totalBorrowed: 30000,
                    utilizationRate: 0.4,
                    currentAPY: 12.0,
                    totalLPTokens: 75000
                }
            ];
            
            sendResponse(res, 200, {
                success: true,
                pools: mockPools
            });
        }
        
        else if (pathname === '/api/lending/provide-liquidity' && method === 'POST') {
            const { assetAddress, amount, providerAddress } = body || {};
            
            if (!assetAddress || !amount || !providerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, amount, providerAddress');
                return;
            }
            
            if (amount <= 0) {
                sendError(res, 400, 'Amount must be positive');
                return;
            }
            
            // Mock providing liquidity
            sendResponse(res, 200, {
                success: true,
                data: {
                    assetAddress,
                    amount,
                    lpTokensMinted: amount, // 1:1 for demo
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    providedAt: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/lending/withdraw-liquidity' && method === 'POST') {
            const { assetAddress, lpTokenAmount, providerAddress } = body || {};
            
            if (!assetAddress || !lpTokenAmount || !providerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, lpTokenAmount, providerAddress');
                return;
            }
            
            if (lpTokenAmount <= 0) {
                sendError(res, 400, 'LP token amount must be positive');
                return;
            }
            
            // Mock withdrawing liquidity
            const usdcReturned = lpTokenAmount * 1.05; // 5% rewards for demo
            const rewardsEarned = lpTokenAmount * 0.05;
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    assetAddress,
                    lpTokensBurned: lpTokenAmount,
                    usdcReturned,
                    rewardsEarned,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    withdrawnAt: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/lending/pool-stats' && method === 'GET') {
            const assetAddress = parsedUrl.query.assetAddress;
            
            if (!assetAddress) {
                sendError(res, 400, 'Missing required parameter: assetAddress');
                return;
            }
            
            // Mock pool statistics
            const mockPoolStats = {
                assetAddress,
                totalLiquidity: 150000,
                availableLiquidity: 95000,
                totalBorrowed: 55000,
                utilizationRate: 0.367,
                currentAPY: 8.5,
                totalProviders: 25,
                totalBorrowers: 8,
                averageLoanSize: 1875.00
            };
            
            sendResponse(res, 200, {
                success: true,
                data: mockPoolStats
            });
        }
        
        else if (pathname === '/api/lending/calculate-loan-terms' && method === 'POST') {
            const { assetAddress, loanAmount } = body || {};
            
            if (!assetAddress || !loanAmount) {
                sendError(res, 400, 'Missing required parameters: assetAddress, loanAmount');
                return;
            }
            
            if (loanAmount <= 0) {
                sendError(res, 400, 'Loan amount must be positive');
                return;
            }
            
            // Mock loan terms calculation
            const collateralRequired = loanAmount * 1.25; // 125% collateralization
            const liquidationPrice = 0.90; // 90% of current price
            const repaymentAmount = loanAmount * 1.10; // 10% interest
            const interestRate = 0.10; // 10%
            const maxLoanDuration = 180; // 180 days
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    loanAmount,
                    collateralRequired,
                    collateralizationRatio: 1.25,
                    liquidationPrice,
                    repaymentAmount,
                    interestRate,
                    maxLoanDuration
                }
            });
        }
        
        else if (pathname === '/api/lending/take-loan' && method === 'POST') {
            const { assetAddress, loanAmount, borrowerAddress } = body || {};
            
            if (!assetAddress || !loanAmount || !borrowerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, loanAmount, borrowerAddress');
                return;
            }
            
            if (loanAmount <= 0) {
                sendError(res, 400, 'Loan amount must be positive');
                return;
            }
            
            // Mock taking out a loan
            const collateralRequired = loanAmount * 1.25;
            const repaymentAmount = loanAmount * 1.10;
            const liquidationPrice = 0.90;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 180); // 180 days loan term
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    loanId: `loan_${Date.now()}`,
                    assetAddress,
                    loanAmount,
                    collateralAmount: collateralRequired,
                    repaymentAmount,
                    liquidationPrice,
                    status: 'active',
                    takenAt: new Date().toISOString(),
                    dueDate: dueDate.toISOString(),
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
                }
            });
        }
        
        else if (pathname === '/api/lending/repay-loan' && method === 'POST') {
            const { assetAddress, borrowerAddress } = body || {};
            
            if (!assetAddress || !borrowerAddress) {
                sendError(res, 400, 'Missing required parameters: assetAddress, borrowerAddress');
                return;
            }
            
            // Mock repaying a loan
            sendResponse(res, 200, {
                success: true,
                data: {
                    loanId: 'loan_123',
                    repaymentAmount: 1100.00,
                    collateralReturned: 1250.00,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    repaidAt: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/lending/loan-details' && method === 'GET') {
            const borrowerAddress = parsedUrl.query.borrowerAddress;
            const assetAddress = parsedUrl.query.assetAddress;
            
            if (!borrowerAddress || !assetAddress) {
                sendError(res, 400, 'Missing required parameters: borrowerAddress, assetAddress');
                return;
            }
            
            // Mock loan details
            const mockLoan = {
                loanId: 'loan_123',
                borrowerAddress,
                assetAddress,
                loanAmount: 1000.00,
                collateralAmount: 1250.00,
                repaymentAmount: 1100.00,
                liquidationPrice: 0.90,
                currentPrice: 1.05,
                healthFactor: 1.31,
                status: 'active',
                takenAt: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
                dueDate: new Date(Date.now() + 86400000 * 170).toISOString() // Due in 170 days
            };
            
            sendResponse(res, 200, {
                success: true,
                data: mockLoan
            });
        }
        
        // Balance endpoints
        else if (pathname === '/api/balance/usdc' && method === 'GET') {
            const accountId = parsedUrl.query.accountId;
            
            // Mock USDC balance
            sendResponse(res, 200, {
                success: true,
                data: {
                    accountId,
                    balance: 10000.00, // Mock: 10,000 USDC
                    tokenId: '0.0.429274', // Mock testnet USDC
                    lastUpdated: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/balance/tokens' && method === 'GET') {
            const accountId = parsedUrl.query.accountId;
            
            // Mock token balances for groves
            const tokenBalances = mockData.groves.map(grove => ({
                groveId: grove.id,
                groveName: grove.groveName,
                tokenId: `0.0.${100000 + parseInt(grove.id)}`, // Mock token IDs
                balance: Math.floor(Math.random() * 500) + 100, // Random balance 100-600
                value: (Math.floor(Math.random() * 500) + 100) * 10 // Mock value
            }));
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    accountId,
                    groves: tokenBalances,
                    totalValue: tokenBalances.reduce((sum, t) => sum + t.value, 0),
                    lastUpdated: new Date().toISOString()
                }
            });
        }
        
        else if (pathname === '/api/balance/all' && method === 'GET') {
            const accountId = parsedUrl.query.accountId;
            
            // Mock all balances
            const tokenBalances = mockData.groves.map(grove => ({
                groveId: grove.id,
                groveName: grove.groveName,
                tokenId: `0.0.${100000 + parseInt(grove.id)}`,
                balance: Math.floor(Math.random() * 500) + 100,
                value: (Math.floor(Math.random() * 500) + 100) * 10
            }));
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    accountId,
                    usdc: {
                        balance: 10000.00,
                        tokenId: '0.0.429274'
                    },
                    tokens: tokenBalances,
                    totalValue: tokenBalances.reduce((sum, t) => sum + t.value, 0),
                    lastUpdated: new Date().toISOString()
                }
            });
        }
        
        // LP Token balances endpoint
        else if (pathname === '/api/balance/lp-tokens' && method === 'GET') {
            const accountId = parsedUrl.query.accountId;
            
            // Mock LP token balances for lending pools
            const lpTokenBalances = [
                {
                    assetAddress: 'USDC',
                    assetName: 'USDC Stablecoin',
                    lpTokenAddress: 'LP-USDC-001',
                    balance: Math.floor(Math.random() * 1000) + 500, // Random balance 500-1500
                    value: (Math.floor(Math.random() * 1000) + 500) * 1.0, // 1:1 value for USDC
                    apy: 8.5
                },
                {
                    assetAddress: 'KES',
                    assetName: 'Kenyan Shilling',
                    lpTokenAddress: 'LP-KES-001',
                    balance: Math.floor(Math.random() * 500) + 250, // Random balance 250-750
                    value: (Math.floor(Math.random() * 500) + 250) * 0.0075, // Approximate value for KES
                    apy: 12.0
                }
            ];
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    accountId,
                    lpTokens: lpTokenBalances,
                    totalValue: lpTokenBalances.reduce((sum, t) => sum + t.value, 0),
                    lastUpdated: new Date().toISOString()
                }
            });
        }
        
        // Transaction history endpoint
        else if (pathname === '/api/transactions/history' && method === 'GET') {
            const userAddress = parsedUrl.query.userAddress;
            console.log('Transaction history request for user:', userAddress);
            
            // Filter transactions by user address
            let transactions = mockTransactions;
            if (userAddress) {
                // A user can be the sender (fromAddress) or receiver (toAddress)
                transactions = mockTransactions.filter(txn => 
                    txn.fromAddress === userAddress || 
                    txn.toAddress === userAddress ||
                    txn.farmerAddress === userAddress || // for farmer withdrawals
                    txn.buyerAddress === userAddress // for marketplace purchases
                );
                console.log('Filtered transactions for user:', transactions);
            }
            
            sendResponse(res, 200, {
                success: true,
                transactions: transactions,
                total: transactions.length
            });
        }
        
        // Tree monitoring sensor data endpoint
        else if (pathname === '/api/tree-monitoring/sensor-data' && method === 'POST') {
            try {
                const healthData = body;
                console.log('[MOCK API] Received sensor data:', healthData);
                
                // Update grove health score in mockData
                const grove = mockData.groves.find(g => String(g.id) === String(healthData.groveId));
                if (grove) {
                    grove.healthScore = healthData.healthScore;
                    saveData();
                }
                
                sendResponse(res, 200, {
                    success: true,
                    message: 'Sensor data recorded successfully',
                    data: {
                        ...healthData,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                console.error('[ERROR] Sensor data endpoint:', error);
                sendError(res, 500, 'Failed to process sensor data');
            }
        }
        
        // Admin token holders endpoint
        else if (pathname.startsWith('/api/admin/token-holders') && method === 'GET') {
            const groveId = parsedUrl.query.groveId;
            console.log('[MOCK API] Fetching token holders for grove:', groveId);
            
            // Mock token holders data
            const tokenHolders = [
                {
                    accountId: '0.0.123456',
                    balance: 100,
                    percentage: 25,
                    investedAt: new Date('2024-01-15').toISOString()
                },
                {
                    accountId: '0.0.789012',
                    balance: 150,
                    percentage: 37.5,
                    investedAt: new Date('2024-02-10').toISOString()
                },
                {
                    accountId: '0.0.345678',
                    balance: 150,
                    percentage: 37.5,
                    investedAt: new Date('2024-03-05').toISOString()
                }
            ];
            
            sendResponse(res, 200, {
                success: true,
                data: tokenHolders,
                groveId,
                totalHolders: tokenHolders.length,
                totalTokens: tokenHolders.reduce((sum, h) => sum + h.balance, 0)
            });
        }
        
        // Notifications endpoint
        else if (pathname === '/api/notifications/send' && method === 'POST') {
            console.log('[MOCK API] Sending notifications:', body);
            
            sendResponse(res, 200, {
                success: true,
                message: 'Notifications sent successfully',
                recipients: body.recipients ? body.recipients.length : 0
            });
        }
        
        // Default 404
        else {
            sendError(res, 404, 'Endpoint not found');
        }
        
    } catch (error) {
        console.error('Server error:', error);
        sendError(res, 500, 'Internal server error');
    }
});

server.listen(PORT, () => {
    console.log(`Coffee Tree Platform Mock API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  GET  /api/market/prices');
    console.log('  GET  /api/market/overview');
    console.log('  GET  /api/geocode?q=...');  // Add the new geocoding endpoint
    console.log('  GET  /api/groves?farmerAddress=...');
    console.log('  POST /api/groves/register');
    console.log('  GET  /api/harvest/history?farmerAddress=...');
    console.log('  POST /api/harvest/report');
    console.log('  GET  /api/harvest/stats?farmerAddress=...');
    console.log('  GET  /api/farmer-verification/status/:address');
    console.log('  POST /api/farmer-verification/submit-documents');
    console.log('  GET  /api/investor-verification/status/:address');
    console.log('  POST /api/investor-verification/submit-documents');
    console.log('  GET  /api/investment/available-groves');
    console.log('  GET  /api/investment/portfolio?investorAddress=...');
    console.log('  POST /api/investment/purchase-tokens');
    console.log('  GET  /api/user/settings/:accountId');
    console.log('  PUT  /api/user/settings/:accountId');
    console.log('  POST /api/pricing/projected-revenue');
    console.log('  POST /api/pricing/validate-price');
    console.log('  GET  /api/pricing/all-varieties');
    console.log('  GET  /api/pricing/seasonal-multipliers');
    console.log('  GET  /api/lending/pools');
    console.log('  POST /api/lending/provide-liquidity');
    console.log('  POST /api/lending/withdraw-liquidity');
    console.log('  GET  /api/lending/pool-stats?assetAddress=...');
    console.log('  POST /api/lending/calculate-loan-terms');
    console.log('  POST /api/lending/take-loan');
    console.log('  POST /api/lending/repay-loan');
    console.log('  GET  /api/lending/loan-details?borrowerAddress=...&assetAddress=...');
    console.log('  GET  /api/revenue/pending-distributions?holderAddress=...');
    console.log('  POST /api/revenue/claim-earnings');
    console.log('  GET  /api/revenue/farmer-balance?farmerAddress=...');
    console.log('  POST /api/revenue/withdraw-farmer-share');

});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});