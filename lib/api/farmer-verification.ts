import { createServer, IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { db } from '../db'
import { farmerVerifications, coffeeGroves, userSettings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { groveTokenizationService } from './grove-tokenization-service'

// Farmer verification is intentionally disabled in this build (Option A).
// The API will treat farmers as verified and allow grove registration without
// requiring manual verification. This is a non-destructive, reversible change.
const DISABLE_FARMER_VERIFICATION = true

// Types for API requests and responses
interface SubmitDocumentsRequest {
    farmerAddress: string
    documentsHash: string
    location: string
    coordinates: {
        lat: number
        lng: number
    }
}

interface VerifyFarmerRequest {
    farmerAddress: string
    approved: boolean
    rejectionReason?: string
    verifierAddress: string
}

interface RegisterGroveOwnershipRequest {
    farmerAddress: string
    groveName: string
    ownershipProofHash: string
    verifierAddress: string
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
        // If a previous layer (e.g. api/server.ts) already parsed the body
        // and assigned it to `req.body`, use that to avoid re-reading the
        // incoming message stream which will have already been consumed.
        const anyReq = req as any
        if (anyReq.body !== undefined) {
            resolve(anyReq.body)
            return
        }

        let body = ''
        req.on('data', chunk => {
            body += chunk.toString()
        })
        req.on('end', () => {
            try {
                // If body is empty, resolve with an empty object
                if (!body) return resolve({})
                resolve(JSON.parse(body))
            } catch (error) {
                reject(new Error('Invalid JSON'))
            }
        })
        req.on('error', reject)
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

function validateCoordinates(coordinates: { lat: number, lng: number }): boolean {
    return (
        typeof coordinates.lat === 'number' &&
        typeof coordinates.lng === 'number' &&
        coordinates.lat >= -90 && coordinates.lat <= 90 &&
        coordinates.lng >= -180 && coordinates.lng <= 180
    )
}

// API Handlers
class FarmerVerificationAPI {
    
    /**
     * Submit farmer verification documents
     * POST /api/farmer-verification/submit-documents
     */
    async submitDocuments(req: IncomingMessage, res: ServerResponse) {
        try {
            const body: SubmitDocumentsRequest = await parseBody(req)
            
            // Validate required fields
            if (!body.farmerAddress || !body.documentsHash || !body.location || !body.coordinates) {
                return sendError(res, 400, 'Missing required fields: farmerAddress, documentsHash, location, coordinates')
            }
            
            // Validate farmer address format
            if (!validateAddress(body.farmerAddress)) {
                return sendError(res, 400, 'Invalid farmer address format')
            }
            
            // Validate coordinates
            if (!validateCoordinates(body.coordinates)) {
                return sendError(res, 400, 'Invalid coordinates')
            }
            
            // Validate documents hash (should be IPFS hash format)
            if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(body.documentsHash)) {
                return sendError(res, 400, 'Invalid documents hash format (expected IPFS hash)')
            }
            
            // Since farmer verification is disabled, auto-insert (or update)
            // the farmer record and mark it as 'verified'. This allows the
            // rest of the platform (grove registration, analytics) to operate
            // without manual verifier intervention.
            const existingFarmer = await db.query.farmerVerifications.findFirst({
                where: eq(farmerVerifications.farmerAddress, body.farmerAddress)
            })

            const now = Date.now()
            const farmerData = {
                farmerAddress: body.farmerAddress,
                documentsHash: body.documentsHash,
                verificationStatus: 'verified' as const,
                verifierAddress: 'system',
                verificationDate: now,
                rejectionReason: null,
                createdAt: now
            }

            if (existingFarmer) {
                await db.update(farmerVerifications)
                    .set({
                        documentsHash: body.documentsHash,
                        verificationStatus: 'verified',
                        verifierAddress: 'system',
                        verificationDate: now,
                        rejectionReason: null,
                        createdAt: now
                    })
                    .where(eq(farmerVerifications.farmerAddress, body.farmerAddress))
            } else {
                await db.insert(farmerVerifications).values(farmerData)
            }

            sendResponse(res, 200, {
                success: true,
                message: 'Documents accepted and farmer auto-verified (verification disabled in this build)',
                data: {
                    farmerAddress: body.farmerAddress,
                    status: 'verified',
                    submissionDate: new Date(now).toISOString()
                }
            })
            
        } catch (error) {
            console.error('Error submitting documents:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Verify or reject a farmer
     * POST /api/farmer-verification/verify
     */
    async verifyFarmer(req: IncomingMessage, res: ServerResponse) {
        try {
            const body: VerifyFarmerRequest = await parseBody(req)
            
            // Validate required fields
            if (!body.farmerAddress || typeof body.approved !== 'boolean' || !body.verifierAddress) {
                return sendError(res, 400, 'Missing required fields: farmerAddress, approved, verifierAddress')
            }
            
            // Validate addresses
            if (!validateAddress(body.farmerAddress) || !validateAddress(body.verifierAddress)) {
                return sendError(res, 400, 'Invalid address format')
            }
            
            // If rejecting, require rejection reason
            if (!body.approved && !body.rejectionReason) {
                return sendError(res, 400, 'Rejection reason is required when rejecting a farmer')
            }
            
            // Check if farmer exists and has submitted documents
            const farmer = await db.query.farmerVerifications.findFirst({
                where: eq(farmerVerifications.farmerAddress, body.farmerAddress)
            })
            
            if (!farmer) {
                return sendError(res, 404, 'Farmer not found or has not submitted documents')
            }
            
            if (farmer.verificationStatus === 'verified') {
                return sendError(res, 409, 'Farmer is already verified')
            }
            
            // Update farmer verification status
            const updateData = {
                verificationStatus: body.approved ? 'verified' as const : 'rejected' as const,
                verifierAddress: body.verifierAddress,
                verificationDate: Date.now(),
                rejectionReason: body.approved ? null : body.rejectionReason
            }
            
            await db.update(farmerVerifications)
                .set(updateData)
                .where(eq(farmerVerifications.farmerAddress, body.farmerAddress))
            
            sendResponse(res, 200, {
                success: true,
                message: `Farmer ${body.approved ? 'verified' : 'rejected'} successfully`,
                data: {
                    farmerAddress: body.farmerAddress,
                    status: updateData.verificationStatus,
                    verifierAddress: body.verifierAddress,
                    verificationDate: new Date().toISOString(),
                    rejectionReason: updateData.rejectionReason
                }
            })
            
        } catch (error) {
            console.error('Error verifying farmer:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get farmer verification status
     * GET /api/farmer-verification/status/:farmerAddress
     */
    async getVerificationStatus(req: IncomingMessage, res: ServerResponse, farmerAddress: string) {
        try {
            // Validate farmer address
            if (!validateAddress(farmerAddress)) {
                return sendError(res, 400, 'Invalid farmer address format')
            }
            
            const farmer = await db.query.farmerVerifications.findFirst({
                where: eq(farmerVerifications.farmerAddress, farmerAddress)
            })
            
            // Allow demo bypass via user settings (server-side persisted)
            const userSetting = await db.query.userSettings.findFirst({ where: eq(userSettings.account, farmerAddress) }).catch(() => null)

            // If global bypass is enabled, return a verified-like response regardless
            if (DISABLE_FARMER_VERIFICATION) {
                return sendResponse(res, 200, {
                    success: true,
                    data: {
                        farmerAddress,
                        status: 'verified',
                        documentsHash: farmer ? farmer.documentsHash : null,
                        verifierAddress: farmer ? farmer.verifierAddress : null,
                        verificationDate: farmer && farmer.verificationDate ? new Date(farmer.verificationDate).toISOString() : null,
                        rejectionReason: farmer ? farmer.rejectionReason : null,
                        submissionDate: farmer && farmer.createdAt ? new Date(farmer.createdAt).toISOString() : null,
                        demoBypass: true
                    }
                })
            }

            if (!farmer) {
                // If no farmer record, still allow demo bypass if settings say so
                if (userSetting && userSetting.demoBypass) {
                    return sendResponse(res, 200, {
                        success: true,
                        data: {
                            farmerAddress,
                            status: 'verified',
                            documentsHash: null,
                            verifierAddress: null,
                            verificationDate: null,
                            rejectionReason: null,
                            submissionDate: null,
                            demoBypass: true
                        }
                    })
                }
                return sendError(res, 404, 'Farmer not found')
            }

            // If farmer exists but demoBypass is enabled for this account, return verified-like response
            if (userSetting && userSetting.demoBypass) {
                return sendResponse(res, 200, {
                    success: true,
                    data: {
                        farmerAddress: farmer.farmerAddress,
                        status: 'verified',
                        documentsHash: farmer.documentsHash,
                        verifierAddress: farmer.verifierAddress,
                        verificationDate: farmer.verificationDate ? new Date(farmer.verificationDate).toISOString() : null,
                        rejectionReason: farmer.rejectionReason,
                        submissionDate: new Date(farmer.createdAt!).toISOString(),
                        demoBypass: true
                    }
                })
            }
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    farmerAddress: farmer.farmerAddress,
                    status: farmer.verificationStatus,
                    documentsHash: farmer.documentsHash,
                    verifierAddress: farmer.verifierAddress,
                    verificationDate: farmer.verificationDate ? new Date(farmer.verificationDate).toISOString() : null,
                    rejectionReason: farmer.rejectionReason,
                    submissionDate: new Date(farmer.createdAt!).toISOString()
                }
            })
            
        } catch (error) {
            console.error('Error getting verification status:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Register grove ownership for verified farmer
     * POST /api/farmer-verification/register-grove
     */
    async registerGroveOwnership(req: IncomingMessage, res: ServerResponse) {
        try {
            const bodyAny: any = await parseBody(req)

            // Log incoming payload for debugging
            console.log('registerGroveOwnership payload:', bodyAny)

            // Support demo bypass via header `X-Demo-Bypass: true` or body flag `demoBypass: true`
            const rawDemoHeader = (req.headers && (req.headers['x-demo-bypass'] as string)) || ''
            const demoBypassHeader = String(rawDemoHeader).toLowerCase() === 'true'
            const demoBypassBody = !!bodyAny.demoBypass
            const demoBypass = demoBypassHeader || demoBypassBody

            // Two supported flows:
            // 1) Verifier registers a grove on behalf of a farmer (ownershipProofHash + verifierAddress)
            // 2) Farmer registers their grove via the UI (grove details provided)

            // Flow 1: verifier-assisted registration
            if (bodyAny.ownershipProofHash && bodyAny.verifierAddress) {
                // Validate required fields
                if (!bodyAny.farmerAddress || !bodyAny.groveName) {
                    return sendError(res, 400, 'Missing required fields for verifier flow: farmerAddress, groveName')
                }

                if (!validateAddress(bodyAny.farmerAddress) || !validateAddress(bodyAny.verifierAddress)) {
                    return sendError(res, 400, 'Invalid address format')
                }

                // Check if farmer is verified
                const farmer = await db.query.farmerVerifications.findFirst({
                    where: eq(farmerVerifications.farmerAddress, bodyAny.farmerAddress)
                })

                if (!farmer || farmer.verificationStatus !== 'verified') {
                    if (!DISABLE_FARMER_VERIFICATION) {
                        return sendError(res, 403, 'Farmer must be verified before registering grove ownership')
                    }
                }

                // Check if grove name is already registered
                const existingGrove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.groveName, bodyAny.groveName)
                })

                if (existingGrove) {
                    return sendError(res, 409, 'Grove name is already registered. Please try another name.')
                }

                const groveData = {
                    groveName: bodyAny.groveName,
                    farmerAddress: bodyAny.farmerAddress,
                    location: 'TBD',
                    treeCount: 0,
                    coffeeVariety: 'TBD',
                    verificationStatus: 'verified',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }

                await db.insert(coffeeGroves).values(groveData)

                return sendResponse(res, 201, {
                    success: true,
                    message: 'Grove ownership registered successfully (verifier flow)',
                    data: {
                        groveName: bodyAny.groveName,
                        farmerAddress: bodyAny.farmerAddress,
                        ownershipProofHash: bodyAny.ownershipProofHash,
                        verifierAddress: bodyAny.verifierAddress,
                        registrationDate: new Date().toISOString()
                    }
                })
            }

            // Flow 2: farmer-submitted grove registration from UI
            if (bodyAny.groveName && bodyAny.farmerAddress) {
                // Validate farmer address
                if (!validateAddress(bodyAny.farmerAddress)) {
                    return sendError(res, 400, 'Invalid farmer address format')
                }

                // Check if farmer is verified (allow demo bypass)
                const farmer = await db.query.farmerVerifications.findFirst({
                    where: eq(farmerVerifications.farmerAddress, bodyAny.farmerAddress)
                })
                const userSetting = await db.query.userSettings.findFirst({ where: eq(userSettings.account, bodyAny.farmerAddress) }).catch(() => null)

                if (!farmer && !(userSetting && userSetting.demoBypass)) {
                    // If global flag to disable farmer verification is set, allow registration
                    if (!demoBypass && !DISABLE_FARMER_VERIFICATION) {
                        return sendError(res, 403, 'Farmer must be verified before registering grove ownership')
                    }
                }

                // Prevent duplicate grove names
                const existing = await db.query.coffeeGroves.findFirst({ where: eq(coffeeGroves.groveName, bodyAny.groveName) })
                if (existing) return sendError(res, 409, 'Grove name is already registered. Please try another name.')

                const groveRecord: any = {
                    groveName: bodyAny.groveName,
                    farmerAddress: bodyAny.farmerAddress,
                    location: bodyAny.location || 'Unknown',
                    coordinatesLat: bodyAny.coordinates ? Number(bodyAny.coordinates.lat) : null,
                    coordinatesLng: bodyAny.coordinates ? Number(bodyAny.coordinates.lng) : null,
                    treeCount: Number(bodyAny.treeCount) || 0,
                    coffeeVariety: bodyAny.coffeeVariety || 'Unknown',
                    expectedYieldPerTree: Number(bodyAny.expectedYieldPerTree) || null,
                    verificationStatus: (DISABLE_FARMER_VERIFICATION || (farmer && farmer.verificationStatus === 'verified') || (userSetting && userSetting.demoBypass) || demoBypass) ? 'verified' : 'pending',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }

                // Insert grove into database first
                const insertResult = await db.insert(coffeeGroves).values(groveRecord).returning()
                const insertedGrove = insertResult[0]

                console.log(`✅ Grove registered in database: ${insertedGrove.groveName} (ID: ${insertedGrove.id})`)

                // Step 2: Tokenize the grove on Hedera (if configured)
                let tokenizationResult = null
                if (groveTokenizationService.isAvailable() && insertedGrove.treeCount > 0) {
                    console.log(`\n🚀 Initiating grove tokenization on Hedera...`)
                    
                    tokenizationResult = await groveTokenizationService.tokenizeGrove({
                        groveId: insertedGrove.id,
                        groveName: insertedGrove.groveName,
                        treeCount: insertedGrove.treeCount,
                        tokensPerTree: 10, // Default: 10 tokens per tree
                        farmerAddress: insertedGrove.farmerAddress // Pass farmer address for auto-transfer
                    })

                    if (tokenizationResult.success) {
                        console.log(`✅ Grove tokenized successfully on Hedera`)
                    } else {
                        console.warn(`⚠️  Grove tokenization failed: ${tokenizationResult.error}`)
                        console.warn(`   Grove registered in database but not tokenized on-chain`)
                    }
                } else {
                    console.log(`ℹ️  Skipping tokenization (contract not configured or no trees)`)
                }

                return sendResponse(res, 201, {
                    success: true,
                    message: 'Grove registered successfully',
                    data: {
                        groveId: insertedGrove.id,
                        groveName: insertedGrove.groveName,
                        farmerAddress: insertedGrove.farmerAddress,
                        registrationDate: new Date().toISOString(),
                        tokenization: tokenizationResult ? {
                            success: tokenizationResult.success,
                            tokenAddress: tokenizationResult.tokenAddress,
                            totalTokensIssued: tokenizationResult.totalTokensIssued,
                            error: tokenizationResult.error
                        } : {
                            success: false,
                            message: 'Tokenization not configured'
                        }
                    }
                })
            }

            return sendError(res, 400, 'Missing required fields for grove registration')
            
        } catch (error) {
            console.error('Error registering grove ownership:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get all pending verifications (for verifiers)
     * GET /api/farmer-verification/pending
     */
    /**
     * Upload file handler (placeholder for document uploads)
     * POST /api/farmer-verification/upload
     */
    async uploadFile(req: IncomingMessage, res: ServerResponse) {
        try {
            // This is a placeholder implementation
            // In a real implementation, you would:
            // 1. Parse multipart/form-data
            // 2. Validate file types and sizes
            // 3. Upload to IPFS or cloud storage
            // 4. Return the file hash/URL

            sendResponse(res, 501, {
                success: false,
                error: 'File upload not implemented. Please use IPFS directly and provide the hash.'
            })
        } catch (error) {
            console.error('Error uploading file:', error)
            sendError(res, 500, 'Internal server error')
        }
    }

    async getPendingVerifications(req: IncomingMessage, res: ServerResponse) {
        try {
            const pendingFarmers = await db.query.farmerVerifications.findMany({
                where: eq(farmerVerifications.verificationStatus, 'pending')
            })
            // If global bypass is enabled, return an empty pending list (nothing to verify)
            if (DISABLE_FARMER_VERIFICATION) {
                return sendResponse(res, 200, { success: true, data: [] })
            }

            const formattedData = pendingFarmers.map(farmer => ({
                farmerAddress: farmer.farmerAddress,
                documentsHash: farmer.documentsHash,
                submissionDate: new Date(farmer.createdAt!).toISOString()
            }))

            sendResponse(res, 200, {
                success: true,
                data: formattedData
            })
        } catch (error) {
            console.error('Error getting pending verifications:', error)
            sendError(res, 500, 'Internal server error')
        }
    }

} // end class FarmerVerificationAPI

// Route handler
export function createFarmerVerificationServer(port: number = 3001) {
    const api = new FarmerVerificationAPI()
    
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
            if (pathname === '/api/farmer-verification/submit-documents' && method === 'POST') {
                await api.submitDocuments(req, res)
            } else if (pathname === '/api/farmer-verification/verify' && method === 'POST') {
                await api.verifyFarmer(req, res)
            } else if (pathname.startsWith('/api/farmer-verification/status/') && method === 'GET') {
                const farmerAddress = pathname.split('/').pop() || ''
                await api.getVerificationStatus(req, res, farmerAddress)
            } else if (pathname === '/api/farmer-verification/register-grove' && method === 'POST') {
                await api.registerGroveOwnership(req, res)
            } else if (pathname === '/api/farmer-verification/pending' && method === 'GET') {
                await api.getPendingVerifications(req, res)
            } else if (pathname === '/api/farmer-verification/upload' && method === 'POST') {
                await api.uploadFile(req, res)
            } else if (pathname === '/health' && method === 'GET') {
                sendResponse(res, 200, { success: true, message: 'Farmer Verification API is running' })
            } else {
                sendError(res, 404, 'Endpoint not found')
            }
        } catch (error) {
            console.error('Server error:', error)
            sendError(res, 500, 'Internal server error')
        }
    })
    
    server.listen(port, () => {
        console.log(`Farmer Verification API server running on port ${port}`)
        console.log(`Health check: http://localhost:${port}/health`)
        console.log('Available endpoints:')
        console.log('  POST /api/farmer-verification/submit-documents')
        console.log('  POST /api/farmer-verification/verify')
        console.log('  GET  /api/farmer-verification/status/:farmerAddress')
        console.log('  POST /api/farmer-verification/register-grove')
        console.log('  GET  /api/farmer-verification/pending')
        console.log('  POST /api/farmer-verification/upload')
    })
    
    return server
}

// Export for use in other modules
export { FarmerVerificationAPI }