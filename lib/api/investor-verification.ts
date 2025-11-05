
import { IncomingMessage, ServerResponse } from 'http'
import { db } from '../db'
import { investorVerifications, investorVerificationHistory } from '../db/schema'

// Local eq helper to avoid depending on external type declarations in some dev setups
function eq(a: any, b: any): any {
    return { left: a, right: b }
}

// KYC removal: investor verification is disabled by default in this build.
// To re-enable, restore the original env-driven toggle.
const DISABLE_INVESTOR_KYC = true

// Types for API requests and responses
interface SubmitDocumentsRequest {
    investorAddress: string
    documents: {
        identityDocument: string
        proofOfAddress: string
        financialStatement?: string
        accreditationProof?: string
    }
    verificationType: 'basic' | 'accredited'
}

interface ProcessVerificationRequest {
    verificationId: string
    action: 'approve' | 'reject'
    rejectionReason?: string
    verifierAddress: string
    verificationType?: 'basic' | 'accredited'
}

interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

interface VerificationEvent {
    verificationId: number
    previousStatus: string | null
    newStatus: string
    actionType: 'submit' | 'approve' | 'reject' | 'expire' | 'renew'
    verifierAddress?: string
    reason?: string
}

interface AccessLevel {
    level: 'none' | 'limited' | 'full'
    maxInvestmentAmount?: number
    allowedFeatures: string[]
    restrictions: string[]
}

interface ValidationResult {
    isValid: boolean
    errors: string[]
}

// Enhanced request interface
interface EnhancedRequest extends IncomingMessage {
    body?: any
    params?: { [key: string]: string }
    query?: { [key: string]: string | string[] | undefined }
}

// Utility functions
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

function validateDocumentHash(hash: string): boolean {
    // Validate IPFS hash format or other document hash formats
    // IPFS v0 hash (Qm...) or v1 hash (baf...) or SHA256 hex hash
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(hash) || 
           /^baf[a-z2-7]{56,}$/.test(hash) || 
           /^[a-fA-F0-9]{64}$/.test(hash)
}

// API Service Class
export class InvestorVerificationAPI {
    
    /**
     * Submit investor verification documents
     * POST /api/investor-verification/submit-documents
     */
    async submitDocuments(req: EnhancedRequest, res: ServerResponse): Promise<void> {
        try {
            const body: SubmitDocumentsRequest = req.body
            
            // Validate required fields
            if (!body.investorAddress) {
                return sendError(res, 400, 'Missing required field: investorAddress')
            }

            // If KYC is disabled via env toggle, skip requiring documents
            if (!DISABLE_INVESTOR_KYC && (!body.documents || !body.verificationType)) {
                return sendError(res, 400, 'Missing required fields: documents, verificationType')
            }
            
            // Validate investor address format
            if (!validateAddress(body.investorAddress)) {
                return sendError(res, 400, 'Invalid investor address format')
            }
            
            // Validate verification type and documents unless KYC is disabled
            if (!DISABLE_INVESTOR_KYC) {
                if (!['basic', 'accredited'].includes(body.verificationType)) {
                    return sendError(res, 400, 'Invalid verification type. Must be "basic" or "accredited"')
                }

                const validationResult = this.validateDocuments(body.documents, body.verificationType)
                if (!validationResult.isValid) {
                    return sendError(res, 400, `Document validation failed: ${validationResult.errors.join(', ')}`)
                }
            }
            
            // Check if investor already has a verified submission
            const existingInvestor = await db.query.investorVerifications.findFirst({
                where: eq(investorVerifications.investorAddress, body.investorAddress)
            })
            
            if (existingInvestor && existingInvestor.verificationStatus === 'verified') {
                return sendError(res, 409, 'Investor is already verified')
            }
            
            const currentTime = Date.now()
            
            // Prepare investor data
            // Prepare investor data. If KYC is disabled, auto-verify and grant access.
            const investorData: any = {
                investorAddress: body.investorAddress,
                verificationStatus: DISABLE_INVESTOR_KYC ? 'verified' : 'pending',
                verificationType: body.verificationType || (DISABLE_INVESTOR_KYC ? 'basic' : undefined),
                documentsHash: DISABLE_INVESTOR_KYC ? null : JSON.stringify(body.documents),
                identityDocumentHash: DISABLE_INVESTOR_KYC ? null : (body.documents?.identityDocument ?? null),
                proofOfAddressHash: DISABLE_INVESTOR_KYC ? null : (body.documents?.proofOfAddress ?? null),
                financialStatementHash: DISABLE_INVESTOR_KYC ? null : (body.documents?.financialStatement || null),
                accreditationProofHash: DISABLE_INVESTOR_KYC ? null : (body.documents?.accreditationProof || null),
                accessLevel: DISABLE_INVESTOR_KYC ? 'full' : 'none',
                createdAt: currentTime,
                updatedAt: currentTime,
                verificationDate: DISABLE_INVESTOR_KYC ? currentTime : null,
                expiryDate: DISABLE_INVESTOR_KYC ? null : null,
                verifierAddress: DISABLE_INVESTOR_KYC ? null : null,
                rejectionReason: null
            }
            
            let verificationId: number
            
            if (existingInvestor) {
                // Update existing record
                await db.update(investorVerifications)
                    .set({
                        verificationStatus: 'pending',
                        verificationType: body.verificationType,
                        documentsHash: investorData.documentsHash,
                        identityDocumentHash: investorData.identityDocumentHash,
                        proofOfAddressHash: investorData.proofOfAddressHash,
                        financialStatementHash: investorData.financialStatementHash,
                        accreditationProofHash: investorData.accreditationProofHash,
                        rejectionReason: null,
                        verifierAddress: null,
                        verificationDate: null,
                        expiryDate: null,
                        accessLevel: 'none',
                        updatedAt: currentTime
                    })
                    .where(eq(investorVerifications.investorAddress, body.investorAddress))
                
                verificationId = existingInvestor.id
            } else {
                // Insert new record
                const result = await db.insert(investorVerifications).values(investorData).returning({ id: investorVerifications.id })
                verificationId = result[0].id
            }
            
            // Log verification event. If auto-verified, tag action as 'auto-approve'
            await this.logVerificationEvent({
                verificationId,
                previousStatus: existingInvestor?.verificationStatus || null,
                newStatus: investorData.verificationStatus,
                actionType: DISABLE_INVESTOR_KYC ? 'approve' : 'submit',
                verifierAddress: DISABLE_INVESTOR_KYC ? 'system' : body.investorAddress,
                reason: DISABLE_INVESTOR_KYC ? 'KYC disabled: auto-approved' : undefined
            })
            
            sendResponse(res, 200, {
                success: true,
                message: 'Documents submitted successfully',
                data: {
                    verificationId: verificationId.toString(),
                    investorAddress: body.investorAddress,
                    status: investorData.verificationStatus,
                    submittedAt: currentTime,
                    estimatedProcessingTime: '3-5 business days'
                }
            })
            
        } catch (error) {
            console.error('Error submitting documents:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get investor verification status
     * GET /api/investor-verification/status/:investorAddress
     */
    async getVerificationStatus(req: EnhancedRequest, res: ServerResponse, investorAddress: string): Promise<void> {
        try {
            // Validate investor address
            if (!validateAddress(investorAddress)) {
                return sendError(res, 400, 'Invalid investor address format')
            }

            // If KYC is disabled globally, return verified for any investor
            if (DISABLE_INVESTOR_KYC) {
                return sendResponse(res, 200, {
                    success: true,
                    data: {
                        investorAddress,
                        status: 'verified',
                        verificationType: 'basic',
                        verificationDate: Date.now(),
                        expiryDate: null,
                        rejectionReason: null,
                        documentsRequired: [],
                        accessLevel: 'full',
                        maxInvestmentAmount: null,
                        allowedFeatures: ['invest_unlimited','access_private_offerings','marketplace_trading','revenue_distributions'],
                        restrictions: []
                    }
                })
            }
            
            const investor = await db.query.investorVerifications.findFirst({
                where: eq(investorVerifications.investorAddress, investorAddress)
            })
            
            if (!investor) {
                // Return unverified status for non-existent investors
                return sendResponse(res, 200, {
                    success: true,
                    data: {
                        investorAddress,
                        status: 'unverified',
                        accessLevel: 'none',
                        documentsRequired: ['identityDocument', 'proofOfAddress']
                    }
                })
            }
            
            // Check if verification has expired
            const currentTime = Date.now()
            let currentStatus = investor.verificationStatus
            if (investor.expiryDate && currentTime > investor.expiryDate && currentStatus === 'verified') {
                currentStatus = 'expired'
                // Update status in database
                await db.update(investorVerifications)
                    .set({ 
                        verificationStatus: 'expired',
                        accessLevel: 'none',
                        updatedAt: currentTime
                    })
                    .where(eq(investorVerifications.id, investor.id))
                
                // Log expiry event
                await this.logVerificationEvent({
                    verificationId: investor.id,
                    previousStatus: 'verified',
                    newStatus: 'expired',
                    actionType: 'expire'
                })
            }
            
            const accessLevel = this.calculateAccessLevel(currentStatus || 'unverified', investor.verificationType ?? undefined)
            
            const responseData: any = {
                investorAddress: investor.investorAddress,
                status: currentStatus,
                verificationType: investor.verificationType,
                verificationDate: investor.verificationDate,
                expiryDate: investor.expiryDate,
                rejectionReason: investor.rejectionReason,
                documentsRequired: this.getRequiredDocuments(currentStatus || 'unverified', investor.verificationType),
                accessLevel: accessLevel.level,
                maxInvestmentAmount: accessLevel.maxInvestmentAmount,
                allowedFeatures: accessLevel.allowedFeatures,
                restrictions: accessLevel.restrictions
            }
            
            // Add estimated processing time for pending status (Requirement 2.5)
            if (currentStatus === 'pending') {
                responseData.estimatedProcessingTime = '3-5 business days'
            }
            
            sendResponse(res, 200, {
                success: true,
                data: responseData
            })
            
        } catch (error) {
            console.error('Error getting verification status:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get all pending verifications (for admin review)
     * GET /api/investor-verification/pending
     */
    async getPendingVerifications(req: EnhancedRequest, res: ServerResponse): Promise<void> {
        try {
            // Check for admin authorization
            const authResult = this.checkAdminAuthorization(req)
            if (!authResult.isAuthorized) {
                return sendError(res, 401, authResult.error || 'Unauthorized access to admin endpoint')
            }
            
            const pendingInvestors = await db.query.investorVerifications.findMany({
                where: eq(investorVerifications.verificationStatus, 'pending')
            })
            
            const formattedData = pendingInvestors.map((investor: any) => ({
                verificationId: investor.id.toString(),
                investorAddress: investor.investorAddress,
                verificationType: investor.verificationType,
                submittedAt: investor.createdAt,
                documents: this.getSubmittedDocuments(investor),
                priority: investor.verificationType === 'accredited' ? 'high' : 'normal'
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
    
    /**
     * Process verification (approve or reject)
     * POST /api/investor-verification/process
     */
    async processVerification(req: EnhancedRequest, res: ServerResponse): Promise<void> {
        try {
            // Check for admin authorization
            const authResult = this.checkAdminAuthorization(req)
            if (!authResult.isAuthorized) {
                return sendError(res, 401, authResult.error || 'Unauthorized access to admin endpoint')
            }
            
            const body: ProcessVerificationRequest = req.body
            
            // Validate required fields
            if (!body.verificationId || !body.action || !body.verifierAddress) {
                return sendError(res, 400, 'Missing required fields: verificationId, action, verifierAddress')
            }
            
            // Validate action
            if (!['approve', 'reject'].includes(body.action)) {
                return sendError(res, 400, 'Invalid action. Must be "approve" or "reject"')
            }
            
            // Validate addresses
            if (!validateAddress(body.verifierAddress)) {
                return sendError(res, 400, 'Invalid verifier address format')
            }
            
            // If rejecting, require rejection reason
            if (body.action === 'reject' && !body.rejectionReason) {
                return sendError(res, 400, 'Rejection reason is required when rejecting an investor')
            }
            
            // Find the verification record
            const investor = await db.query.investorVerifications.findFirst({
                where: eq(investorVerifications.id, parseInt(body.verificationId))
            })
            
            if (!investor) {
                return sendError(res, 404, 'Verification record not found')
            }
            
            if (investor.verificationStatus === 'verified') {
                return sendError(res, 409, 'Investor is already verified')
            }
            
            const currentTime = Date.now()
            const isApproved = body.action === 'approve'
            
            // Calculate expiry date (2 years from now for verified investors)
            const expiryDate = isApproved ? currentTime + (2 * 365 * 24 * 60 * 60 * 1000) : null
            
            // Determine final verification type
            const finalVerificationType = body.verificationType || investor.verificationType || undefined
            
            // Calculate access level
            const accessLevel = this.calculateAccessLevel(
                isApproved ? 'verified' : 'rejected',
                finalVerificationType
            )
            
            // Update investor verification status
            const updateData = {
                verificationStatus: isApproved ? 'verified' as const : 'rejected' as const,
                verificationType: finalVerificationType,
                verifierAddress: body.verifierAddress,
                verificationDate: isApproved ? currentTime : null,
                expiryDate,
                rejectionReason: isApproved ? null : body.rejectionReason,
                accessLevel: accessLevel.level,
                updatedAt: currentTime
            }
            
            await db.update(investorVerifications)
                .set(updateData)
                .where(eq(investorVerifications.id, investor.id))
            
            // Log verification event with admin details
            await this.logVerificationEvent({
                verificationId: investor.id,
                previousStatus: investor.verificationStatus,
                newStatus: updateData.verificationStatus,
                actionType: isApproved ? 'approve' : 'reject',
                verifierAddress: body.verifierAddress,
                reason: body.rejectionReason
            })
            
            // Additional admin action logging
            console.log(`Admin action: ${body.action} verification ${body.verificationId} by ${body.verifierAddress} at ${new Date().toISOString()}`)
            
            sendResponse(res, 200, {
                success: true,
                message: `Investor ${isApproved ? 'verified' : 'rejected'} successfully`,
                data: {
                    verificationId: body.verificationId,
                    investorAddress: investor.investorAddress,
                    status: updateData.verificationStatus,
                    verificationType: updateData.verificationType,
                    verifierAddress: body.verifierAddress,
                    verificationDate: updateData.verificationDate,
                    expiryDate: updateData.expiryDate,
                    rejectionReason: updateData.rejectionReason,
                    accessLevel: accessLevel.level
                }
            })
            
        } catch (error) {
            console.error('Error processing verification:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    /**
     * Get verification metrics (for admin dashboard)
     * GET /api/investor-verification/metrics
     */
    async getVerificationMetrics(req: EnhancedRequest, res: ServerResponse): Promise<void> {
        try {
            // Check for admin authorization
            const authResult = this.checkAdminAuthorization(req)
            if (!authResult.isAuthorized) {
                return sendError(res, 401, authResult.error || 'Unauthorized access to admin endpoint')
            }
            
            // Get all verification records
            const allVerifications = await db.query.investorVerifications.findMany()
            
            // Calculate statistics
            const stats = {
                total: allVerifications.length,
                unverified: 0,
                pending: 0,
                verified: 0,
                rejected: 0,
                expired: 0,
                basic: 0,
                accredited: 0
            }
            
            const currentTime = Date.now()
            let totalProcessingTime = 0
            let processedCount = 0
            
            allVerifications.forEach((verification: any) => {
                // Check for expired verifications
                let status = verification.verificationStatus
                if (verification.expiryDate && currentTime > verification.expiryDate && status === 'verified') {
                    status = 'expired'
                }
                
                // Count by status
                switch (status) {
                    case 'unverified':
                        stats.unverified++
                        break
                    case 'pending':
                        stats.pending++
                        break
                    case 'verified':
                        stats.verified++
                        break
                    case 'rejected':
                        stats.rejected++
                        break
                    case 'expired':
                        stats.expired++
                        break
                }
                
                // Count by type
                if (verification.verificationType === 'basic') {
                    stats.basic++
                } else if (verification.verificationType === 'accredited') {
                    stats.accredited++
                }
                
                // Calculate processing time for completed verifications
                if (verification.verificationDate && verification.createdAt) {
                    totalProcessingTime += verification.verificationDate - verification.createdAt
                    processedCount++
                }
            })
            
            const averageProcessingTime = processedCount > 0 ? totalProcessingTime / processedCount : 0
            const approvalRate = (stats.verified / Math.max(stats.verified + stats.rejected, 1)) * 100
            
            // Get recent activity (last 30 days)
            const thirtyDaysAgo = currentTime - (30 * 24 * 60 * 60 * 1000)
            const recentVerifications = allVerifications.filter((v: any) => 
                v.createdAt && v.createdAt > thirtyDaysAgo
            )
            
            sendResponse(res, 200, {
                success: true,
                data: {
                    statistics: stats,
                    processingMetrics: {
                        averageProcessingTimeMs: Math.round(averageProcessingTime),
                        averageProcessingTimeDays: Math.round(averageProcessingTime / (24 * 60 * 60 * 1000) * 10) / 10,
                        approvalRate: Math.round(approvalRate * 10) / 10,
                        totalProcessed: processedCount
                    },
                    recentActivity: {
                        last30Days: recentVerifications.length,
                        pendingReview: stats.pending,
                        expiringVerifications: allVerifications.filter((v: any) => 
                            v.expiryDate && 
                            v.expiryDate > currentTime && 
                            v.expiryDate < currentTime + (30 * 24 * 60 * 60 * 1000)
                        ).length
                    }
                }
            })
            
        } catch (error) {
            console.error('Error getting verification metrics:', error)
            sendError(res, 500, 'Internal server error')
        }
    }
    
    // Private helper methods
    
    /**
     * Check admin authorization for admin-only endpoints
     */
    private checkAdminAuthorization(req: EnhancedRequest): { isAuthorized: boolean; error?: string } {
        // Check for Authorization header
        const authHeader = req.headers.authorization
        if (!authHeader) {
            return { isAuthorized: false, error: 'Missing Authorization header' }
        }
        
        // Extract token from Bearer token format
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
        
        // For now, we'll use a simple admin token check
        // In production, this should be replaced with proper JWT validation or similar
        const adminToken = process.env.ADMIN_TOKEN || 'admin-secret-token'
        
        if (token !== adminToken) {
            return { isAuthorized: false, error: 'Invalid admin token' }
        }
        
        return { isAuthorized: true }
    }
    
    /**
     * Validate submitted documents based on verification type
     */
    private validateDocuments(documents: any, verificationType: string): ValidationResult {
        const errors: string[] = []
        
        // Required documents for all verification types
        if (!documents.identityDocument) {
            errors.push('Identity document is required')
        } else if (!validateDocumentHash(documents.identityDocument)) {
            errors.push('Invalid identity document hash format')
        }
        
        if (!documents.proofOfAddress) {
            errors.push('Proof of address is required')
        } else if (!validateDocumentHash(documents.proofOfAddress)) {
            errors.push('Invalid proof of address hash format')
        }
        
        // Additional requirements for accredited investors
        if (verificationType === 'accredited') {
            if (!documents.financialStatement) {
                errors.push('Financial statement is required for accredited verification')
            } else if (!validateDocumentHash(documents.financialStatement)) {
                errors.push('Invalid financial statement hash format')
            }
            
            if (!documents.accreditationProof) {
                errors.push('Accreditation proof is required for accredited verification')
            } else if (!validateDocumentHash(documents.accreditationProof)) {
                errors.push('Invalid accreditation proof hash format')
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        }
    }
    
    /**
     * Calculate access level based on verification status and type
     */
    private calculateAccessLevel(status: string, verificationType?: string): AccessLevel {
        if (status !== 'verified') {
            return {
                level: 'none',
                allowedFeatures: ['view_public_data'],
                restrictions: ['Cannot invest in coffee trees', 'Cannot access investor portal features']
            }
        }
        
        if (verificationType === 'accredited') {
            return {
                level: 'full',
                allowedFeatures: [
                    'invest_unlimited',
                    'access_private_offerings',
                    'advanced_analytics',
                    'priority_support',
                    'marketplace_trading',
                    'revenue_distributions'
                ],
                restrictions: []
            }
        }
        
        // Basic verification
        return {
            level: 'limited',
            maxInvestmentAmount: 10000, // $10,000 USD equivalent
            allowedFeatures: [
                'invest_limited',
                'basic_analytics',
                'marketplace_trading',
                'revenue_distributions'
            ],
            restrictions: [
                'Investment amount limited to $10,000',
                'No access to private offerings',
                'Limited analytics features'
            ]
        }
    }
    
    /**
     * Log verification events for audit trail
     */
    private async logVerificationEvent(event: VerificationEvent): Promise<void> {
        try {
            await db.insert(investorVerificationHistory).values({
                verificationId: event.verificationId,
                previousStatus: event.previousStatus,
                newStatus: event.newStatus,
                actionType: event.actionType,
                verifierAddress: event.verifierAddress,
                reason: event.reason,
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('Error logging verification event:', error)
            // Don't throw error to avoid breaking the main flow
        }
    }
    
    /**
     * Get required documents based on status and verification type
     */
    private getRequiredDocuments(status: string, verificationType?: string): string[] {
        if (status === 'verified') {
            return []
        }
        
        const required = ['identityDocument', 'proofOfAddress']
        
        if (verificationType === 'accredited') {
            required.push('financialStatement', 'accreditationProof')
        }
        
        return required
    }
    
    /**
     * Get list of submitted documents from verification record
     */
    private getSubmittedDocuments(investor: any): string[] {
        const documents: string[] = []
        
        if (investor.identityDocumentHash) documents.push('identityDocument')
        if (investor.proofOfAddressHash) documents.push('proofOfAddress')
        if (investor.financialStatementHash) documents.push('financialStatement')
        if (investor.accreditationProofHash) documents.push('accreditationProof')
        
        return documents
    }
}