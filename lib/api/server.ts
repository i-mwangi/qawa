#!/usr/bin/env node

/**
 * Coffee Tree Platform API Server
 * 
 * This server provides REST endpoints for:
 * - Farmer verification functionality
 * - Harvest reporting and revenue distribution
 * - Grove management and token holder tracking
 */

// Load Node 18 polyfill first
import './node18-polyfill';

// Load and configure environment variables
import './env-setup';

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { FarmerVerificationAPI } from './farmer-verification'
import { InvestorVerificationAPI } from './investor-verification'
import { HarvestReportingAPI } from './harvest-reporting'
import { TreeMonitoringAPI } from './tree-monitoring'
import { TreeHealthReportingService } from './tree-health-reporting'
import { LendingAPI } from './lending-api'
import { groveHistoryAPI } from './grove-history-api'
import { RevenueDistributionAPI } from './revenue-distribution-api'
import { InvestmentAPI } from './investment-api'
import { runMigrations } from '../db/migrate'
import { runHealthCheck, DatabaseHealthCheck } from '../db/health-check'
import {
    initializeMarketServices,
    getCurrentPrices,
    getPriceHistory,
    getMarketConditions,
    validatePrice,
    getMarketAlerts,
    acknowledgeAlert,
    updateNotificationPreferences,
    triggerPriceUpdate,
    getMarketOverview
} from './market-data'
import {
    CoffeeGroveAnalytics,
    InvestorPortfolioAnalytics,
    FarmerEarningsAnalytics,
    MarketTrendAnalytics,
    PlatformAnalytics
} from '../lib/coffee-analytics'
import { transactionRecorder } from './transaction-recording-service'
import {
    getMarketplaceListings,
    listTokensForSale,
    purchaseFromMarketplace,
    cancelListing,
    updateListing,
    getTradeHistory,
    getMarketplaceStats,
    getUserListings
} from './marketplace'
import { db } from '../db'
import { userSettings, coffeeGroves, tokenHoldings } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUserSettings, updateUserSettings } from './user-settings'
import { validateAccountIdParam, validateUserSettingsBody, ensureUserSettingsTable } from './validation'
import { handleEarningsRequest } from './earnings-router'

const PORT = parseInt(process.env.API_PORT || '3001')

// Developer toggle: for Option A we want verification flows disabled by default.
const DISABLE_INVESTOR_KYC = true

// Utility functions
function sendResponse(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-bypass'
    })
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
    sendResponse(res, statusCode, { success: false, error: message })
}

// Parse request body
function parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => {
            body += chunk.toString()
        })
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {})
            } catch (error) {
                reject(error)
            }
        })
        req.on('error', reject)
    })
}

// Enhanced request object with body and params
interface EnhancedRequest extends IncomingMessage {
    body?: any
    params?: { [key: string]: string }
    query?: { [key: string]: string | string[] | undefined }
}

// Ensure HEDERA_NETWORK is respected if NETWORK is not set
if (process.env.HEDERA_NETWORK && !process.env.NETWORK) {
    process.env.NETWORK = process.env.HEDERA_NETWORK;
}

// Create combined server
function createCoffeeTreePlatformServer(port: number = 3001) {
    const farmerVerificationAPI = new FarmerVerificationAPI()
    const investorVerificationAPI = new InvestorVerificationAPI()
    const harvestReportingAPI = new HarvestReportingAPI()
    const treeMonitoringAPI = new TreeMonitoringAPI()
    const treeHealthReportingService = new TreeHealthReportingService()
    const lendingAPI = new LendingAPI()
    const revenueDistributionAPI = new RevenueDistributionAPI()
    const investmentAPI = new InvestmentAPI()
    // Note: user settings persisted to DB via `user_settings` table in schema

    // Initialize market services with coffee price oracle contract ID
    const coffeeOracleContractId = process.env.COFFEE_ORACLE_CONTRACT_ID || '0.0.123456'
    initializeMarketServices(coffeeOracleContractId)

    const server = createServer(async (req: EnhancedRequest, res: ServerResponse) => {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-bypass'
            })
            res.end()
            return
        }

        const parsedUrl = parse(req.url || '', true)
        const pathname = parsedUrl.pathname || ''
        const method = req.method || 'GET'

        // Parse request body for POST/PUT requests
        if (method === 'POST' || method === 'PUT') {
            try {
                req.body = await parseRequestBody(req)
            } catch (error) {
                sendError(res, 400, 'Invalid JSON in request body')
                return
            }
        }

        // Add query parameters
        req.query = parsedUrl.query

        // Create an Express-like response adapter so existing modules
        // that call `res.status(...).json(...)` or `res.json(...)`
        // continue to work with the raw Node `ServerResponse`.
        const expressRes = {
            status(code: number) {
                return {
                    json: (data: any) => sendResponse(res, code, data)
                }
            },
            json: (data: any) => sendResponse(res, 200, data)
            ,
            // Provide low-level ServerResponse methods for modules that
            // call `res.writeHead`, `res.end`, `res.setHeader`, or `res.write`.
            writeHead: (statusCode: number, headers?: any) => {
                try {
                    return (res as ServerResponse).writeHead(statusCode, headers)
                } catch (e) {
                    // If underlying res doesn't support writeHead, ignore and let
                    // higher-level sendResponse handle it.
                    return undefined as any
                }
            },
            end: (data?: any) => (res as ServerResponse).end(data),
            setHeader: (name: string, value: string | number | readonly string[]) => (res as ServerResponse).setHeader(name, value),
            write: (chunk: any, encoding?: string) => (res as any).write(chunk, encoding)
        }

        try {
            // Health Check Route
            if (pathname === '/api/health' && method === 'GET') {
                const healthResult = await runHealthCheck()
                sendResponse(res, healthResult.healthy ? 200 : 503, {
                    success: healthResult.healthy,
                    ...healthResult
                })

                // Farmer Verification Routes
            } else if (pathname === '/api/farmer-verification/submit-documents' && method === 'POST') {
                await farmerVerificationAPI.submitDocuments(req, expressRes as any)
            } else if (pathname === '/api/farmer-verification/verify' && method === 'POST') {
                await farmerVerificationAPI.verifyFarmer(req, expressRes as any)
            } else if (pathname.startsWith('/api/farmer-verification/status/') && method === 'GET') {
                const farmerAddress = pathname.split('/').pop() || ''
                await farmerVerificationAPI.getVerificationStatus(req, expressRes as any, farmerAddress)
            } else if (pathname === '/api/farmer-verification/register-grove' && method === 'POST') {
                await farmerVerificationAPI.registerGroveOwnership(req, expressRes as any)
            } else if (pathname === '/api/farmer-verification/pending' && method === 'GET') {
                await farmerVerificationAPI.getPendingVerifications(req, expressRes as any)
            } else if (pathname === '/api/farmer-verification/upload' && method === 'POST') {
                await farmerVerificationAPI.uploadFile(req, expressRes as any)

                // Investor Verification Routes
            } else if (pathname === '/api/investor-verification/submit-documents' && method === 'POST') {
                await investorVerificationAPI.submitDocuments(req, expressRes as any)
            } else if (pathname.startsWith('/api/investor-verification/status/') && method === 'GET') {
                const investorAddress = pathname.split('/').pop() || ''
                await investorVerificationAPI.getVerificationStatus(req, expressRes as any, investorAddress)
            } else if (pathname === '/api/investor-verification/pending' && method === 'GET') {
                await investorVerificationAPI.getPendingVerifications(req, expressRes as any)
            } else if (pathname === '/api/investor-verification/process' && method === 'POST') {
                await investorVerificationAPI.processVerification(req, expressRes as any)
            } else if (pathname === '/api/investor-verification/metrics' && method === 'GET') {
                await investorVerificationAPI.getVerificationMetrics(req, expressRes as any)

                // Harvest Reporting Routes
            } else if (pathname === '/api/harvest/report' && method === 'POST') {
                await harvestReportingAPI.reportHarvest(req, expressRes as any)
            } else if (pathname === '/api/harvest/history' && method === 'GET') {
                await harvestReportingAPI.getHarvestHistory(req, expressRes as any)
            } else if (pathname === '/api/harvest/pending' && method === 'GET') {
                await harvestReportingAPI.getPendingHarvests(req, expressRes as any)
            } else if (pathname === '/api/harvest/distribute-onchain' && method === 'POST') {
                await harvestReportingAPI.distributeRevenueOnChain(req, expressRes as any)
            } else if (pathname === '/api/harvest/distribute' && method === 'POST') {
                await harvestReportingAPI.markHarvestDistributed(req, expressRes as any)
            } else if (pathname === '/api/harvest/stats' && method === 'GET') {
                await harvestReportingAPI.getHarvestStats(req, expressRes as any)
            } else if (pathname === '/api/harvest/calculate-distribution' && method === 'POST') {
                await harvestReportingAPI.calculateDistribution(req, expressRes as any)
            } else if (pathname === '/api/harvest/record-distribution' && method === 'POST') {
                await harvestReportingAPI.recordDistribution(req, expressRes as any)
            } else if (pathname === '/api/harvest/pending-distributions' && method === 'GET') {
                await harvestReportingAPI.getAllPendingDistributions(req, expressRes as any)
            } else if (pathname.startsWith('/api/harvest/holder/') && pathname.endsWith('/earnings') && method === 'GET') {
                const holderAddress = pathname.split('/')[4]
                await harvestReportingAPI.getHolderEarnings(req, expressRes as any, holderAddress)
            } else if (pathname.startsWith('/api/harvest/') && pathname.endsWith('/distribution-summary') && method === 'GET') {
                const harvestId = pathname.split('/')[3]
                await harvestReportingAPI.getDistributionSummary(req, expressRes as any, harvestId)
            } else if (pathname.startsWith('/api/harvest/') && pathname.endsWith('/earnings') && method === 'GET') {
                const harvestId = pathname.split('/')[3]
                await harvestReportingAPI.getHarvestEarnings(req, expressRes as any, harvestId)

                // Earnings Distribution Routes (New Automated System)
            } else if (await handleEarningsRequest(req, res)) {
                // Request was handled by earnings router
                return

                // Market Data Routes
            } else if (pathname === '/api/market/prices' && method === 'GET') {
                await getCurrentPrices(req as any, expressRes as any)
            } else if (pathname === '/api/market/price-history' && method === 'GET') {
                await getPriceHistory(req as any, expressRes as any)
            } else if (pathname === '/api/market/conditions' && method === 'GET') {
                await getMarketConditions(req as any, expressRes as any)
            } else if (pathname === '/api/market/validate-price' && method === 'POST') {
                await validatePrice(req as any, expressRes as any)
            } else if (pathname.startsWith('/api/market/alerts/') && method === 'GET') {
                const farmerAddress = pathname.split('/').pop() || ''
                req.params = { farmerAddress }
                await getMarketAlerts(req as any, expressRes as any)
            } else if (pathname.startsWith('/api/market/alerts/') && pathname.endsWith('/acknowledge') && method === 'POST') {
                const alertId = pathname.split('/')[4]
                req.params = { alertId }
                await acknowledgeAlert(req as any, expressRes as any)
            } else if (pathname.startsWith('/api/market/preferences/') && method === 'PUT') {
                const farmerAddress = pathname.split('/').pop() || ''
                req.params = { farmerAddress }
                await updateNotificationPreferences(req as any, expressRes as any)
                // User settings (simple key/value store per account)
            } else if (pathname.startsWith('/api/user/settings/') && method === 'PUT') {
                const accountId = pathname.split('/').pop() || ''

                // Validate account ID
                if (!validateAccountIdParam(accountId, res)) {
                    return
                }

                // Validate request body
                if (!validateUserSettingsBody(req.body, res)) {
                    return
                }

                try {
                    // Ensure table exists with automatic creation fallback
                    await ensureUserSettingsTable(db)

                    // Update settings using the service
                    const updatedSettings = await updateUserSettings(accountId, req.body)

                    sendResponse(res, 200, {
                        success: true,
                        settings: updatedSettings
                    })
                } catch (error) {
                    console.error('[Server] Error updating user settings:', error)

                    // Provide detailed error message
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    sendError(res, 500, `Failed to update user settings: ${errorMessage}`)
                }
            } else if (pathname.startsWith('/api/user/settings/') && method === 'GET') {
                const accountId = pathname.split('/').pop() || ''

                // Validate account ID
                if (!validateAccountIdParam(accountId, res)) {
                    return
                }

                try {
                    // Ensure table exists with automatic creation fallback
                    await ensureUserSettingsTable(db)

                    // Get settings using the service (with caching and error recovery)
                    const settings = await getUserSettings(accountId)

                    sendResponse(res, 200, {
                        success: true,
                        settings
                    })
                } catch (error) {
                    console.error('[Server] Error fetching user settings:', error)

                    // Provide detailed error message
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
                    sendError(res, 500, `Failed to fetch user settings: ${errorMessage}`)
                }
            } else if (pathname === '/api/market/update-prices' && method === 'POST') {
                await triggerPriceUpdate(req as any, expressRes as any)
            } else if (pathname === '/api/market/overview' && method === 'GET') {
                await getMarketOverview(req as any, expressRes as any)

            // Grove History Routes (for investor transparency) - MUST come before /api/groves catch-all
            } else if (pathname.match(/^\/api\/groves\/(\d+)\/history$/) && method === 'GET') {
                const groveId = parseInt(pathname.split('/')[3])
                await groveHistoryAPI.getGroveHistory(req, res, groveId)
            } else if (pathname.match(/^\/api\/investor\/([^\/]+)\/earnings\/(\d+)$/) && method === 'GET') {
                const parts = pathname.split('/')
                const investorAddress = parts[3]
                const groveId = parseInt(parts[5])
                await groveHistoryAPI.getInvestorEarnings(req, res, investorAddress, groveId)
            
                // Grove management endpoints (UI expects /api/groves)
            } else if (pathname.startsWith('/api/groves') && method === 'GET') {
                try {
                    const farmerAddress = (req.query && (req.query as any).farmerAddress) ? String((req.query as any).farmerAddress) : undefined
                    let groves
                    if ((db as any).__dumpStorage) {
                        // In-memory DB fallback: locate any table that looks like coffee_groves
                        const dump = (db as any).__dumpStorage()
                        const allTables = Object.values(dump || {}) as any[]
                        const candidates = allTables.flat().filter(r => r && typeof r === 'object' && ('groveName' in r || 'grove_name' in r))
                        // Normalize and filter by farmerAddress (accept different key names and formats)
                        if (farmerAddress) {
                            const q = String(farmerAddress).trim()
                            groves = candidates.filter((g: any) => {
                                const stored = String(g.farmerAddress ?? g.farmer_address ?? '').trim()
                                return stored === q
                            })
                        } else {
                            groves = candidates
                        }
                        // Format coordinates for frontend
                        groves = groves.map((g: any) => {
                            return {
                                ...g,
                                coordinates: g.coordinatesLat && g.coordinatesLng ? {
                                    lat: g.coordinatesLat,
                                    lng: g.coordinatesLng
                                } : undefined
                            }
                        })
                    } else {
                        if (farmerAddress) {
                            groves = await db.select().from(coffeeGroves).where(eq(coffeeGroves.farmerAddress, farmerAddress))
                        } else {
                            groves = await db.select().from(coffeeGroves)
                        }
                        // Format coordinates for frontend
                        groves = groves.map((g: any) => {
                            return {
                                ...g,
                                coordinates: g.coordinatesLat && g.coordinatesLng ? {
                                    lat: g.coordinatesLat,
                                    lng: g.coordinatesLng
                                } : undefined
                            }
                        })
                    }
                    sendResponse(res, 200, { success: true, groves })
                } catch (error) {
                    console.error('Error fetching groves:', error)
                    sendError(res, 500, 'Failed to fetch groves')
                }
            } else if (pathname === '/api/groves/register' && method === 'POST') {
                // Delegate to the existing farmer verification handler for registration logic
                await farmerVerificationAPI.registerGroveOwnership(req, expressRes as any)

                // Investment endpoints (basic compatibility with frontend/demo)
            } else if (pathname === '/api/investment/available-groves' && method === 'GET') {
                try {
                    // Pull groves from the DB and shape them like the demo/mock server expects
                    let groves: any[] = []
                    if ((db as any).__dumpStorage) {
                        const dump = (db as any).__dumpStorage()
                        const allTables = Object.values(dump || {}) as any[]
                        groves = allTables.flat().filter(r => r && typeof r === 'object' && 'groveName' in r)
                    } else {
                        groves = await db.select().from(coffeeGroves)
                    }
                    // Calculate available tokens for each grove
                    const availableGroves = await Promise.all(groves.map(async (grove) => {
                        const treeCount = Number((grove as any).treeCount || 0)
                        const groveId = (grove as any).id

                        // Calculate total tokens for this grove
                        const totalTokens = (grove as any).totalTokensIssued || (treeCount * ((grove as any).tokensPerTree || 1))

                        // Get total tokens already sold
                        const soldTokensResult = await db
                            .select({ total: sql<number>`COALESCE(SUM(${tokenHoldings.tokenAmount}), 0)` })
                            .from(tokenHoldings)
                            .where(and(
                                eq(tokenHoldings.groveId, groveId),
                                eq(tokenHoldings.isActive, true)
                            ))

                        const soldTokens = Number(soldTokensResult[0]?.total || 0)
                        const tokensAvailable = totalTokens - soldTokens

                        return {
                            ...grove,
                            healthScore: grove.currentHealthScore || 0,
                            tokensAvailable: tokensAvailable,
                            pricePerToken: 25 + Math.floor(Math.random() * 100) / 10,
                            projectedAnnualReturn: 10 + Math.floor(Math.random() * 80) / 10
                        }
                    }))
                    sendResponse(res, 200, { success: true, groves: availableGroves })
                } catch (error) {
                    console.error('Error fetching available groves:', error)
                    sendError(res, 500, 'Failed to fetch available groves')
                }
            } else if (pathname === '/api/investment/purchase-tokens' && method === 'POST') {
                await investmentAPI.purchaseTokens(req, res)
            } else if (pathname === '/api/investment/portfolio' && method === 'GET') {
                await investmentAPI.getPortfolio(req, res)

                // Tree Monitoring Routes
            } else if (pathname === '/api/tree-monitoring/sensor-data' && method === 'POST') {
                await treeMonitoringAPI.ingestSensorData(req, expressRes as any)
            } else if (pathname.startsWith('/api/tree-monitoring/sensor-data/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeMonitoringAPI.getSensorData(req, expressRes as any, groveId)
            } else if (pathname.startsWith('/api/tree-monitoring/health/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeMonitoringAPI.getTreeHealth(req, expressRes as any, groveId)
            } else if (pathname.startsWith('/api/tree-monitoring/alerts/') && !pathname.includes('/acknowledge') && !pathname.includes('/resolve') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeMonitoringAPI.getEnvironmentalAlerts(req, expressRes as any, groveId)
            } else if (pathname.startsWith('/api/tree-monitoring/alerts/') && pathname.endsWith('/acknowledge') && method === 'POST') {
                const alertId = pathname.split('/')[4]
                await treeMonitoringAPI.acknowledgeAlert(req, expressRes as any, alertId)
            } else if (pathname.startsWith('/api/tree-monitoring/alerts/') && pathname.endsWith('/resolve') && method === 'POST') {
                const alertId = pathname.split('/')[4]
                await treeMonitoringAPI.resolveAlert(req, expressRes as any, alertId)
            } else if (pathname === '/api/tree-monitoring/maintenance' && method === 'POST') {
                await treeMonitoringAPI.logMaintenanceActivity(req, expressRes as any)
            } else if (pathname.startsWith('/api/tree-monitoring/maintenance/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeMonitoringAPI.getMaintenanceActivities(req, expressRes as any, groveId)

                // Tree Health Reporting Routes
            } else if (pathname.startsWith('/api/tree-monitoring/reports/health-trend/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeHealthReportingService.generateHealthTrendReport(req, res, groveId)
            } else if (pathname === '/api/tree-monitoring/reports/grove-comparison' && method === 'GET') {
                await treeHealthReportingService.generateGroveComparisonReport(req, res)
            } else if (pathname.startsWith('/api/tree-monitoring/reports/yield-impact/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeHealthReportingService.generateYieldImpactAnalysis(req, res, groveId)
            } else if (pathname.startsWith('/api/tree-monitoring/reports/maintenance-effectiveness/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeHealthReportingService.generateMaintenanceEffectivenessReport(req, res, groveId)
            } else if (pathname.startsWith('/api/tree-monitoring/reports/risk-assessment/') && method === 'GET') {
                const groveId = pathname.split('/').pop() || ''
                await treeHealthReportingService.generateRiskAssessment(req, res, groveId)

                // Lending Pool Routes
            } else if (pathname === '/api/lending/config' && method === 'GET') {
                await lendingAPI.getConfig(req, res)
            } else if (pathname === '/api/lending/pools' && method === 'GET') {
                await lendingAPI.getLendingPools(req, res)
            } else if (pathname.startsWith('/api/lending/liquidity-positions/') && method === 'GET') {
                const userAddress = pathname.split('/').pop() || ''
                await lendingAPI.getLiquidityPositions(req, res, userAddress)
            } else if (pathname === '/api/lending/provide-liquidity' && method === 'POST') {
                await lendingAPI.provideLiquidity(req, res)
            } else if (pathname === '/api/lending/withdraw-liquidity' && method === 'POST') {
                await lendingAPI.withdrawLiquidity(req, res)
            } else if (pathname.startsWith('/api/lending/pool-stats') && method === 'GET') {
                await lendingAPI.getPoolStatistics(req, res)
            } else if (pathname === '/api/lending/calculate-loan-terms' && method === 'POST') {
                await lendingAPI.calculateLoanTerms(req, res)
            } else if (pathname === '/api/lending/take-loan' && method === 'POST') {
                await lendingAPI.takeOutLoan(req, res)
            } else if (pathname === '/api/lending/repay-loan' && method === 'POST') {
                await lendingAPI.repayLoan(req, res)
            } else if (pathname.startsWith('/api/lending/loan-details') && method === 'GET') {
                // Handle both path parameters and query parameters
                let borrowerAddress = ''
                let assetAddress = ''

                // Check for path parameters first
                const pathParts = pathname.split('/')
                if (pathParts.length >= 6) {
                    borrowerAddress = pathParts[4] || ''
                    assetAddress = pathParts[5] || ''
                }

                // If not in path, check query parameters
                if (!borrowerAddress && req.query && (req.query as any).borrowerAddress) {
                    borrowerAddress = (req.query as any).borrowerAddress as string
                }
                if (!assetAddress && req.query && (req.query as any).assetAddress) {
                    assetAddress = (req.query as any).assetAddress as string
                }

                await lendingAPI.getLoanDetails(req, res, borrowerAddress, assetAddress)

                // Revenue Distribution Routes
            } else if (pathname === '/api/revenue/create-distribution' && method === 'POST') {
                await revenueDistributionAPI.createDistribution(req, res)
            } else if (pathname === '/api/revenue/distribution-history' && method === 'GET') {
                await revenueDistributionAPI.getDistributionHistory(req, res)
            } else if (pathname === '/api/revenue/pending-distributions' && method === 'GET') {
                await revenueDistributionAPI.getPendingDistributions(req, res)
            } else if (pathname === '/api/revenue/claim-earnings' && method === 'POST') {
                await revenueDistributionAPI.claimEarnings(req, res)
            } else if (pathname === '/api/revenue/farmer-balance' && method === 'GET') {
                await revenueDistributionAPI.getFarmerBalance(req, res)
            } else if (pathname === '/api/revenue/withdraw-farmer-share' && method === 'POST') {
                await revenueDistributionAPI.withdrawFarmerShare(req, res)
            } else if (pathname === '/api/revenue/withdrawal-history' && method === 'GET') {
                await revenueDistributionAPI.getFarmerWithdrawalHistory(req, res)

                // Transaction History Routes
            } else if (pathname === '/api/transactions/history' && method === 'GET') {
                try {
                    const { userAddress, limit = 50, offset = 0, type } = req.query

                    if (!userAddress) {
                        sendError(res, 400, 'userAddress is required')
                        return
                    }

                    console.log('[TransactionHistory] Fetching for user:', userAddress)

                    try {
                        // Import database and schema
                        const { db } = await import('../db')
                        const { transactionHistory } = await import('../db/schema')
                        const { or, eq, desc, and } = await import('drizzle-orm')

                        // Build where condition
                        const userCondition = or(
                            eq(transactionHistory.fromAddress, userAddress as string),
                            eq(transactionHistory.toAddress, userAddress as string)
                        )

                        const whereCondition = type
                            ? and(userCondition, eq(transactionHistory.type, type as string))
                            : userCondition

                        // Get transactions
                        const transactions = await db.select()
                            .from(transactionHistory)
                            .where(whereCondition)
                            .orderBy(desc(transactionHistory.timestamp))
                            .limit(parseInt(limit as string))
                            .offset(parseInt(offset as string))

                        console.log('[TransactionHistory] Found', transactions.length, 'transactions')

                        // Get total count
                        const allTransactions = await db.select()
                            .from(transactionHistory)
                            .where(whereCondition)

                        const total = allTransactions.length

                        sendResponse(res, 200, {
                            success: true,
                            transactions: transactions,
                            total: total,
                            limit: parseInt(limit as string),
                            offset: parseInt(offset as string)
                        })
                    } catch (dbError) {
                        // If database query fails, return empty array
                        console.warn('[TransactionHistory] Database query failed, returning empty:', dbError)
                        sendResponse(res, 200, {
                            success: true,
                            transactions: [],
                            total: 0,
                            limit: parseInt(limit as string),
                            offset: parseInt(offset as string)
                        })
                    }
                } catch (error) {
                    console.error('[TransactionHistory] Error:', error)
                    sendError(res, 500, 'Failed to fetch transaction history')
                }
            } else if (pathname.startsWith('/api/transactions/') && method === 'GET') {
                try {
                    const transactionId = pathname.split('/').pop()

                    // Mock single transaction lookup
                    sendResponse(res, 200, {
                        success: true,
                        transaction: null
                    })
                } catch (error) {
                    console.error('Error fetching transaction:', error)
                    sendError(res, 500, 'Failed to fetch transaction')
                }
            } else if (pathname === '/api/transactions/save' && method === 'POST') {
                try {
                    const transactionData = req.body

                    // Mock save transaction
                    sendResponse(res, 200, {
                        success: true,
                        message: 'Transaction saved successfully',
                        transactionId: Date.now().toString()
                    })
                } catch (error) {
                    console.error('Error saving transaction:', error)
                    sendError(res, 500, 'Failed to save transaction')
                }
            } else if (pathname === '/api/transactions/update' && method === 'PUT') {
                try {
                    const { transactionId, updates } = req.body

                    if (!transactionId) {
                        sendError(res, 400, 'transactionId is required')
                        return
                    }

                    // Mock update transaction
                    sendResponse(res, 200, {
                        success: true,
                        message: 'Transaction updated successfully'
                    })
                } catch (error) {
                    console.error('Error updating transaction:', error)
                    sendError(res, 500, 'Failed to update transaction')
                }

                // Analytics Routes - Grove Performance
            } else if (pathname.startsWith('/api/analytics/grove/') && pathname.endsWith('/performance') && method === 'GET') {
                const groveId = parseInt(pathname.split('/')[4])
                const { startDate, endDate } = req.query || {}
                let timeframe
                if (startDate && endDate) {
                    timeframe = {
                        start: parseInt(startDate as string),
                        end: parseInt(endDate as string)
                    }
                }
                try {
                    const performance = await CoffeeGroveAnalytics.getGrovePerformance(groveId, timeframe)
                    sendResponse(res, 200, performance)
                } catch (error) {
                    console.error('Error fetching grove performance:', error)
                    sendError(res, 500, 'Failed to fetch grove performance data')
                }
            } else if (pathname.startsWith('/api/analytics/grove/') && pathname.endsWith('/health') && method === 'GET') {
                const groveId = parseInt(pathname.split('/')[4])
                const days = parseInt(req.query?.days as string) || 30
                try {
                    const healthAnalytics = await CoffeeGroveAnalytics.getGroveHealthAnalytics(groveId, days)
                    sendResponse(res, 200, healthAnalytics)
                } catch (error) {
                    console.error('Error fetching grove health analytics:', error)
                    sendError(res, 500, 'Failed to fetch grove health data')
                }
            } else if (pathname.startsWith('/api/analytics/grove/') && pathname.endsWith('/maintenance') && method === 'GET') {
                const groveId = parseInt(pathname.split('/')[4])
                const { startDate, endDate } = req.query || {}
                let timeframe
                if (startDate && endDate) {
                    timeframe = {
                        start: parseInt(startDate as string),
                        end: parseInt(endDate as string)
                    }
                }
                try {
                    const maintenance = await CoffeeGroveAnalytics.getMaintenanceAnalytics(groveId, timeframe)
                    sendResponse(res, 200, maintenance)
                } catch (error) {
                    console.error('Error fetching maintenance analytics:', error)
                    sendError(res, 500, 'Failed to fetch maintenance data')
                }

                // Analytics Routes - Investor Portfolio
            } else if (pathname.startsWith('/api/analytics/investor/') && pathname.endsWith('/portfolio') && method === 'GET') {
                const investorAddress = pathname.split('/')[4]
                try {
                    const portfolio = await InvestorPortfolioAnalytics.getInvestorPortfolio(investorAddress)
                    sendResponse(res, 200, portfolio)
                } catch (error) {
                    console.error('Error fetching investor portfolio:', error)
                    sendError(res, 500, 'Failed to fetch investor portfolio data')
                }
            } else if (pathname.startsWith('/api/analytics/investor/') && pathname.endsWith('/projections') && method === 'GET') {
                const investorAddress = pathname.split('/')[4]
                try {
                    const projections = await InvestorPortfolioAnalytics.getReturnProjections(investorAddress)
                    sendResponse(res, 200, projections)
                } catch (error) {
                    console.error('Error fetching return projections:', error)
                    sendError(res, 500, 'Failed to fetch return projections')
                }

                // Analytics Routes - Farmer Earnings
            } else if (pathname.startsWith('/api/analytics/farmer/') && pathname.endsWith('/earnings') && method === 'GET') {
                const farmerAddress = pathname.split('/')[4]
                const { startDate, endDate } = req.query || {}
                let timeframe
                if (startDate && endDate) {
                    timeframe = {
                        start: parseInt(startDate as string),
                        end: parseInt(endDate as string)
                    }
                }
                try {
                    const earnings = await FarmerEarningsAnalytics.getFarmerEarnings(farmerAddress, timeframe)
                    sendResponse(res, 200, earnings)
                } catch (error) {
                    console.error('Error fetching farmer earnings:', error)
                    sendError(res, 500, 'Failed to fetch farmer earnings data')
                }
            } else if (pathname.startsWith('/api/analytics/farmer/') && pathname.endsWith('/performance') && method === 'GET') {
                const farmerAddress = pathname.split('/')[4]
                try {
                    const performance = await FarmerEarningsAnalytics.getFarmerPerformanceMetrics(farmerAddress)
                    sendResponse(res, 200, performance)
                } catch (error) {
                    console.error('Error fetching farmer performance:', error)
                    sendError(res, 500, 'Failed to fetch farmer performance data')
                }

                // Analytics Routes - Market Trends
            } else if (pathname === '/api/analytics/market/price-trends' && method === 'GET') {
                const variety = parseInt(req.query?.variety as string) || 1
                const grade = parseInt(req.query?.grade as string) || 1
                const days = parseInt(req.query?.days as string) || 90
                try {
                    const trends = await MarketTrendAnalytics.getCoffeePriceTrends(variety, grade, days)
                    sendResponse(res, 200, trends)
                } catch (error) {
                    console.error('Error fetching price trends:', error)
                    sendError(res, 500, 'Failed to fetch price trend data')
                }
            } else if (pathname === '/api/analytics/market/yield-price-correlation' && method === 'GET') {
                const { startDate, endDate } = req.query || {}
                let timeframe
                if (startDate && endDate) {
                    timeframe = {
                        start: parseInt(startDate as string),
                        end: parseInt(endDate as string)
                    }
                }
                try {
                    const correlation = await MarketTrendAnalytics.getYieldPriceCorrelation(timeframe)
                    sendResponse(res, 200, correlation)
                } catch (error) {
                    console.error('Error fetching yield-price correlation:', error)
                    sendError(res, 500, 'Failed to fetch correlation data')
                }
            } else if (pathname === '/api/analytics/market/insights' && method === 'GET') {
                try {
                    const insights = await MarketTrendAnalytics.getMarketInsights()
                    sendResponse(res, 200, insights)
                } catch (error) {
                    console.error('Error fetching market insights:', error)
                    sendError(res, 500, 'Failed to fetch market insights')
                }

                // Analytics Routes - Platform Statistics
            } else if (pathname === '/api/analytics/platform/stats' && method === 'GET') {
                try {
                    const stats = await PlatformAnalytics.getPlatformStats()
                    sendResponse(res, 200, stats)
                } catch (error) {
                    console.error('Error fetching platform stats:', error)
                    sendError(res, 500, 'Failed to fetch platform statistics')
                }
            } else if (pathname === '/api/analytics/platform/growth' && method === 'GET') {
                const days = parseInt(req.query?.days as string) || 90
                try {
                    const growth = await PlatformAnalytics.getPlatformGrowthMetrics(days)
                    sendResponse(res, 200, growth)
                } catch (error) {
                    console.error('Error fetching platform growth:', error)
                    sendError(res, 500, 'Failed to fetch platform growth data')
                }

                // Health check and API info
            } else if (pathname === '/health' && method === 'GET') {
                sendResponse(res, 200, {
                    success: true,
                    message: 'Coffee Tree Platform API is running',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                })
            } else if (pathname === '/api' && method === 'GET') {
                sendResponse(res, 200, {
                    success: true,
                    message: 'Coffee Tree Platform API',
                    endpoints: {
                        farmerVerification: [
                            'POST /api/farmer-verification/submit-documents',
                            'POST /api/farmer-verification/verify',
                            'GET  /api/farmer-verification/status/:farmerAddress',
                            'POST /api/farmer-verification/register-grove',
                            'GET  /api/farmer-verification/pending',
                            'POST /api/farmer-verification/upload'
                        ],
                        investorVerification: [
                            'POST /api/investor-verification/submit-documents',
                            'GET  /api/investor-verification/status/:investorAddress',
                            'GET  /api/investor-verification/pending',
                            'POST /api/investor-verification/process',
                            'GET  /api/investor-verification/metrics'
                        ],
                        harvestReporting: [
                            'POST /api/harvest/report',
                            'GET  /api/harvest/history',
                            'GET  /api/harvest/pending',
                            'POST /api/harvest/distribute',
                            'GET  /api/harvest/stats',
                            'POST /api/harvest/calculate-distribution',
                            'POST /api/harvest/record-distribution',
                            'GET  /api/harvest/pending-distributions',
                            'GET  /api/harvest/holder/:holderAddress/earnings',
                            'GET  /api/harvest/:harvestId/distribution-summary',
                            'GET  /api/harvest/:harvestId/earnings'
                        ],
                        marketData: [
                            'GET  /api/market/prices',
                            'GET  /api/market/price-history',
                            'GET  /api/market/conditions',
                            'POST /api/market/validate-price',
                            'GET  /api/market/alerts/:farmerAddress',
                            'POST /api/market/alerts/:alertId/acknowledge',
                            'PUT  /api/market/preferences/:farmerAddress',
                            'POST /api/market/update-prices',
                            'GET  /api/market/overview'
                        ],
                        treeMonitoring: [
                            'POST /api/tree-monitoring/sensor-data',
                            'GET  /api/tree-monitoring/sensor-data/:groveId',
                            'GET  /api/tree-monitoring/health/:groveId',
                            'GET  /api/tree-monitoring/alerts/:groveId',
                            'POST /api/tree-monitoring/alerts/:alertId/acknowledge',
                            'POST /api/tree-monitoring/alerts/:alertId/resolve',
                            'POST /api/tree-monitoring/maintenance',
                            'GET  /api/tree-monitoring/maintenance/:groveId'
                        ],
                        treeHealthReporting: [
                            'GET  /api/tree-monitoring/reports/health-trend/:groveId',
                            'GET  /api/tree-monitoring/reports/grove-comparison',
                            'GET  /api/tree-monitoring/reports/yield-impact/:groveId',
                            'GET  /api/tree-monitoring/reports/maintenance-effectiveness/:groveId',
                            'GET  /api/tree-monitoring/reports/risk-assessment/:groveId'
                        ],
                        lending: [
                            'GET  /api/lending/pools',
                            'POST /api/lending/provide-liquidity',
                            'POST /api/lending/withdraw-liquidity',
                            'GET  /api/lending/pool-stats/:assetAddress',
                            'POST /api/lending/calculate-loan-terms',
                            'POST /api/lending/take-loan',
                            'POST /api/lending/repay-loan',
                            'GET  /api/lending/loan-details/:borrowerAddress/:assetAddress'
                        ],
                        revenueDistribution: [
                            'POST /api/revenue/create-distribution',
                            'GET  /api/revenue/distribution-history/:holderAddress',
                            'GET  /api/revenue/pending-distributions/:holderAddress',
                            'POST /api/revenue/claim-earnings',
                            'GET  /api/revenue/farmer-balance/:farmerAddress',
                            'POST /api/revenue/withdraw-farmer-share',
                            'GET  /api/revenue/withdrawal-history/:farmerAddress'
                        ],
                        analytics: [
                            'GET  /api/analytics/grove/:groveId/performance',
                            'GET  /api/analytics/grove/:groveId/health',
                            'GET  /api/analytics/grove/:groveId/maintenance',
                            'GET  /api/analytics/investor/:address/portfolio',
                            'GET  /api/analytics/investor/:address/projections',
                            'GET  /api/analytics/farmer/:address/earnings',
                            'GET  /api/analytics/farmer/:address/performance',
                            'GET  /api/analytics/market/price-trends',
                            'GET  /api/analytics/market/yield-price-correlation',
                            'GET  /api/analytics/market/insights',
                            'GET  /api/analytics/platform/stats',
                            'GET  /api/analytics/platform/growth'
                        ]
                    }
                })
                // Marketplace Routes
            } else if (pathname === '/api/marketplace/listings' && method === 'GET') {
                await getMarketplaceListings(req, res)
            } else if (pathname === '/api/marketplace/list-tokens' && method === 'POST') {
                await listTokensForSale(req, res)
            } else if (pathname === '/api/marketplace/purchase' && method === 'POST') {
                await purchaseFromMarketplace(req, res)
            } else if (pathname === '/api/marketplace/cancel-listing' && method === 'POST') {
                await cancelListing(req, res)
            } else if (pathname === '/api/marketplace/update-listing' && method === 'POST') {
                await updateListing(req, res)
            } else if (pathname === '/api/marketplace/trades' && method === 'GET') {
                await getTradeHistory(req, res)
            } else if (pathname === '/api/marketplace/stats' && method === 'GET') {
                await getMarketplaceStats(req, res)
            } else if (pathname === '/api/marketplace/user-listings' && method === 'GET') {
                await getUserListings(req, res)

                // USDC Routes
            } else if (pathname === '/api/usdc/airdrop' && method === 'POST') {
                try {
                    const { amount, accountId } = req.body || {}
                    
                    if (!amount || amount <= 0) {
                        sendError(res, 400, 'Valid amount is required')
                        return
                    }

                    // For testnet only
                    if (process.env.HEDERA_NETWORK !== 'testnet') {
                        sendError(res, 403, 'USDC airdrop only available on testnet')
                        return
                    }

                    // In real implementation, call USDC contract
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        amount: amount,
                        accountId: accountId || 'current-user',
                        transactionId: transactionId,
                        message: `${amount} USDC airdropped successfully`
                    })
                } catch (error: any) {
                    console.error('USDC airdrop error:', error)
                    sendError(res, 500, error.message || 'Failed to process USDC airdrop')
                }
            } else if (pathname === '/api/usdc/token-address' && method === 'GET') {
                try {
                    const tokenAddress = process.env.USDC_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'
                    
                    sendResponse(res, 200, {
                        success: true,
                        tokenAddress: tokenAddress
                    })
                } catch (error: any) {
                    console.error('Get USDC token address error:', error)
                    sendError(res, 500, error.message || 'Failed to get USDC token address')
                }

                // Platform Control Routes
            } else if (pathname === '/api/platform/status' && method === 'GET') {
                try {
                    // In real implementation, query PlatformControl contract
                    sendResponse(res, 200, {
                        success: true,
                        status: {
                            tradingPaused: false,
                            groveRegistrationPaused: false,
                            harvestReportingPaused: false,
                            tokenPurchasePaused: false
                        }
                    })
                } catch (error: any) {
                    console.error('Get platform status error:', error)
                    sendError(res, 500, error.message || 'Failed to get platform status')
                }
            } else if (pathname === '/api/platform/pause-trading' && method === 'POST') {
                try {
                    // Admin only check would go here
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Trading paused successfully'
                    })
                } catch (error: any) {
                    console.error('Pause trading error:', error)
                    sendError(res, 500, error.message || 'Failed to pause trading')
                }
            } else if (pathname === '/api/platform/resume-trading' && method === 'POST') {
                try {
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Trading resumed successfully'
                    })
                } catch (error: any) {
                    console.error('Resume trading error:', error)
                    sendError(res, 500, error.message || 'Failed to resume trading')
                }
            } else if (pathname === '/api/platform/pause-registration' && method === 'POST') {
                try {
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Grove registration paused successfully'
                    })
                } catch (error: any) {
                    console.error('Pause registration error:', error)
                    sendError(res, 500, error.message || 'Failed to pause grove registration')
                }
            } else if (pathname === '/api/platform/resume-registration' && method === 'POST') {
                try {
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Grove registration resumed successfully'
                    })
                } catch (error: any) {
                    console.error('Resume registration error:', error)
                    sendError(res, 500, error.message || 'Failed to resume grove registration')
                }
            } else if (pathname === '/api/platform/emergency-shutdown' && method === 'POST') {
                try {
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Emergency shutdown activated'
                    })
                } catch (error: any) {
                    console.error('Emergency shutdown error:', error)
                    sendError(res, 500, error.message || 'Failed to activate emergency shutdown')
                }
            } else if (pathname === '/api/platform/emergency-resume' && method === 'POST') {
                try {
                    const transactionId = '0x' + Math.random().toString(16).substr(2, 10)
                    
                    sendResponse(res, 200, {
                        success: true,
                        transactionId: transactionId,
                        message: 'Platform operations resumed'
                    })
                } catch (error: any) {
                    console.error('Emergency resume error:', error)
                    sendError(res, 500, error.message || 'Failed to resume platform operations')
                }

                // Pricing API Routes
            } else if (pathname === '/api/pricing/seasonal-price' && method === 'POST') {
                const { variety, grade, month } = req.body || {};

                if (!variety || grade === undefined || !month) {
                    sendError(res, 400, 'variety, grade, and month are required');
                    return;
                }

                try {
                    // For demo purposes, we'll create a mock response since we don't have the actual contract setup
                    // In a real implementation, you would initialize the PriceOracleContract and call getSeasonalCoffeePrice

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
                        'ORGANIC': 5.20
                    };

                    const varietyKey = typeof variety === 'string' ? variety.toUpperCase() : variety;
                    const basePrice = basePrices[varietyKey] || 4.00;
                    const multiplier = seasonalMultipliers[month] || 1.0;
                    const seasonalPrice = basePrice * multiplier;

                    sendResponse(res, 200, {
                        success: true,
                        data: {
                            seasonalPrice: parseFloat(seasonalPrice.toFixed(2)),
                            basePrice: parseFloat(basePrice.toFixed(2)),
                            seasonalMultiplier: multiplier,
                            variety,
                            grade,
                            month
                        }
                    });
                } catch (error) {
                    console.error('Error calculating seasonal price:', error);
                    sendError(res, 500, 'Failed to calculate seasonal price');
                }
            } else if (pathname === '/api/pricing/projected-revenue' && method === 'POST') {
                const { groveTokenAddress, variety, grade, expectedYieldKg, harvestMonth } = req.body || {};

                // Validate required parameters
                if (!variety || grade === undefined || !expectedYieldKg || !harvestMonth) {
                    sendError(res, 400, 'variety, grade, expectedYieldKg, and harvestMonth are required');
                    return;
                }

                // Normalize variety to uppercase
                const normalizedVariety = typeof variety === 'string' ? variety.toUpperCase() : variety;

                try {
                    // For demo purposes, we'll create a mock response since we don't have the actual contract setup
                    // In a real implementation, you would initialize the PriceOracleContract and call calculateProjectedRevenue

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
                        'ORGANIC': 5.20
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
            } else if (pathname === '/api/pricing/validate-price' && method === 'POST') {
                const { variety, grade, proposedPrice } = req.body || {};

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
                        'ORGANIC': 5.20
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
            } else if (pathname === '/api/pricing/all-varieties' && method === 'GET') {
                try {
                    // Base prices by variety with grades 1-10 (these would come from the contract in a real implementation)
                    const varieties = [
                        {
                            variety: 'ARABICA',
                            grades: Array.from({ length: 10 }, (_, i) => ({
                                grade: i + 1,
                                price: 2.50 + (i * 0.35)
                            }))
                        },
                        {
                            variety: 'ROBUSTA',
                            grades: Array.from({ length: 10 }, (_, i) => ({
                                grade: i + 1,
                                price: 1.80 + (i * 0.24)
                            }))
                        },
                        {
                            variety: 'SPECIALTY',
                            grades: Array.from({ length: 10 }, (_, i) => ({
                                grade: i + 1,
                                price: 3.50 + (i * 0.55)
                            }))
                        },
                        {
                            variety: 'ORGANIC',
                            grades: Array.from({ length: 10 }, (_, i) => ({
                                grade: i + 1,
                                price: 3.00 + (i * 0.45)
                            }))
                        },
                        {
                            variety: 'TYPICA',
                            grades: Array.from({ length: 10 }, (_, i) => ({
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
            } else if (pathname === '/api/pricing/seasonal-multipliers' && method === 'GET') {
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

                // Balance endpoints - USDC balance
            } else if (pathname === '/api/balance/usdc' && method === 'GET') {
                try {
                    const { accountId } = req.query || {};

                    if (!accountId) {
                        sendError(res, 400, 'Missing required parameter: accountId');
                        return;
                    }

                    // Mock USDC balance - in a real implementation, this would query the actual USDC token balance
                    // For demo purposes, we'll return a random balance between 1000 and 10000 USDC
                    const mockBalance = Math.floor(Math.random() * 9000) + 1000;

                    sendResponse(res, 200, {
                        success: true,
                        data: {
                            accountId,
                            asset: 'USDC',
                            balance: mockBalance,
                            decimals: 6,
                            symbol: 'USDC',
                            name: 'USD Coin'
                        }
                    });
                } catch (error) {
                    console.error('Error fetching USDC balance:', error);
                    sendError(res, 500, 'Failed to fetch USDC balance');
                }

                // Balance endpoints - LP token balances
            } else if (pathname === '/api/balance/lp-tokens' && method === 'GET') {
                try {
                    const { accountId } = req.query || {};

                    if (!accountId) {
                        sendError(res, 400, 'Missing required parameter: accountId');
                        return;
                    }

                    // Mock LP token balances - in a real implementation, this would query the actual LP token balances
                    // For demo purposes, we'll return mock data for LP tokens
                    const mockLPTokens = [
                        {
                            asset: 'USDC',
                            lpTokenAddress: 'LP-USDC-001',
                            balance: Math.floor(Math.random() * 5000) + 1000,
                            decimals: 6,
                            symbol: 'LP-USDC',
                            name: 'LP Token for USDC'
                        },
                        {
                            asset: 'KES',
                            lpTokenAddress: 'LP-KES-001',
                            balance: Math.floor(Math.random() * 3000) + 500,
                            decimals: 6,
                            symbol: 'LP-KES',
                            name: 'LP Token for KES'
                        }
                    ];

                    sendResponse(res, 200, {
                        success: true,
                        data: {
                            accountId,
                            lpTokens: mockLPTokens
                        }
                    });
                } catch (error) {
                    console.error('Error fetching LP token balances:', error);
                    sendError(res, 500, 'Failed to fetch LP token balances');
                }

                // Debug endpoint: dump in-memory DB storage or query groves
            } else if (pathname === '/__debug/db' && method === 'GET') {
                try {
                    // If running with in-memory DB, expose the raw storage map
                    if ((db as any).__dumpStorage) {
                        return sendResponse(res, 200, { success: true, inmemory: (db as any).__dumpStorage() })
                    }

                    // Otherwise, return the coffee_groves rows
                    const groves = await db.select().from(coffeeGroves)
                    return sendResponse(res, 200, { success: true, groves })
                } catch (e) {
                    console.error('Debug DB dump failed:', e)
                    return sendError(res, 500, 'Failed to dump DB')
                }
            } else {
                sendError(res, 404, 'Endpoint not found')
            }
        } catch (error) {
            console.error('Server error:', error)
            sendError(res, 500, 'Internal server error')
        }
    })

    server.listen(port, () => {
        console.log(`Coffee Tree Platform API server running on port ${port}`)
        if (DISABLE_INVESTOR_KYC) {
            console.warn('\n⚠️  WARNING: Investor KYC is DISABLED (DISABLE_INVESTOR_KYC=true)')
            console.warn('         This mode auto-approves investors and should only be used for demos or testing.')
            console.warn('         Do NOT enable in production environments where regulatory compliance is required.\n')
        }
        console.log(`Health check: http://localhost:${port}/api/health`)
        console.log(`API info: http://localhost:${port}/api`)
        console.log('')
        console.log('Verification: farmer and investor verification flows are DISABLED in this build (auto-approve mode).')
        console.log('')
        console.log('Harvest Reporting Endpoints:')
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
        console.log('')
        console.log('Market Data Endpoints:')
        console.log('  GET  /api/market/prices')
        console.log('  GET  /api/market/price-history')
        console.log('  GET  /api/market/conditions')
        console.log('  POST /api/market/validate-price')
        console.log('  GET  /api/market/alerts/:farmerAddress')
        console.log('  POST /api/market/alerts/:alertId/acknowledge')
        console.log('  PUT  /api/market/preferences/:farmerAddress')
        console.log('  POST /api/market/update-prices')
        console.log('  GET  /api/market/overview')
        console.log('')
        console.log('Tree Monitoring Endpoints:')
        console.log('  POST /api/tree-monitoring/sensor-data')
        console.log('  GET  /api/tree-monitoring/sensor-data/:groveId')
        console.log('  GET  /api/tree-monitoring/health/:groveId')
        console.log('  GET  /api/tree-monitoring/alerts/:groveId')
        console.log('  POST /api/tree-monitoring/alerts/:alertId/acknowledge')
        console.log('  POST /api/tree-monitoring/alerts/:alertId/resolve')
        console.log('  POST /api/tree-monitoring/maintenance')
        console.log('  GET  /api/tree-monitoring/maintenance/:groveId')
        console.log('')
        console.log('Tree Health Reporting Endpoints:')
        console.log('  GET  /api/tree-monitoring/reports/health-trend/:groveId')
        console.log('  GET  /api/tree-monitoring/reports/grove-comparison')
        console.log('  GET  /api/tree-monitoring/reports/yield-impact/:groveId')
        console.log('  GET  /api/tree-monitoring/reports/maintenance-effectiveness/:groveId')
        console.log('  GET  /api/tree-monitoring/reports/risk-assessment/:groveId')
        console.log('')
        console.log('Analytics Endpoints:')
        console.log('  GET  /api/analytics/grove/:groveId/performance')
        console.log('  GET  /api/analytics/grove/:groveId/health')
        console.log('  GET  /api/analytics/grove/:groveId/maintenance')
        console.log('  GET  /api/analytics/investor/:address/portfolio')
        console.log('  GET  /api/analytics/investor/:address/projections')
        console.log('  GET  /api/analytics/farmer/:address/earnings')
        console.log('  GET  /api/analytics/farmer/:address/performance')
        console.log('  GET  /api/analytics/market/price-trends')
        console.log('  GET  /api/analytics/market/yield-price-correlation')
        console.log('  GET  /api/analytics/market/insights')
        console.log('  GET  /api/analytics/platform/stats')
        console.log('  GET  /api/analytics/platform/growth')
    })

    return server
}

// Run migrations and start the server
async function startServer() {
    try {
        console.log('🚀 Starting Coffee Tree Platform API Server...')
        console.log('')

        // Run database migrations
        console.log('📊 Running database migrations...')
        let migrationResult
        // Check if we should skip custom migrations (e.g., when drizzle-kit has already run)
        if (process.env.SKIP_CUSTOM_MIGRATIONS === 'true') {
            console.log('⏭️  Skipping custom migrations (SKIP_CUSTOM_MIGRATIONS=true)')
            migrationResult = { success: true, migrationsRun: [], errors: [] }
        } else {
            migrationResult = await runMigrations()
        }

        if (!migrationResult.success) {
            console.error('❌ Critical migrations failed. Server startup aborted.')
            console.error('Migration errors:', migrationResult.errors)
            process.exit(1)
        }

        if (migrationResult.migrationsRun.length > 0) {
            console.log(`✅ Successfully ran ${migrationResult.migrationsRun.length} migrations`)
            migrationResult.migrationsRun.forEach(migration => {
                console.log(`   - ${migration}`)
            })
        } else {
            console.log('✅ No pending migrations')
        }
        console.log('')

        // Run health check
        console.log('🏥 Running database health check...')
        const healthResult = await runHealthCheck()

        if (!healthResult.healthy) {
            console.warn('⚠️  Database health check failed, but continuing startup...')
            healthResult.diagnostics.forEach(diagnostic => {
                console.warn(`   ${diagnostic}`)
            })
        } else {
            console.log('✅ Database health check passed')
        }
        console.log('')

        // Start connection pool monitoring for SQLite
        console.log('🔄 Starting connection pool monitoring...')
        const healthCheck = new DatabaseHealthCheck()
        healthCheck.startConnectionMonitoring()
        console.log('✅ Connection pool monitoring started')
        console.log('')

        // Start the server
        const server = createCoffeeTreePlatformServer(PORT)

            // Store health check instance for graceful shutdown
            ; (server as any).__healthCheck = healthCheck

        return server
    } catch (error) {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

// Start the server
const server = await startServer()

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully')

    // Stop connection pool monitoring
    const healthCheck = (server as any).__healthCheck
    if (healthCheck) {
        healthCheck.stopConnectionMonitoring()
    }

    server.close(() => {
        console.log('Server closed')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully')
    server.close(() => {
        console.log('Server closed')
        process.exit(0)
    })
})