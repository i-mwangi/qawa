import { db } from '../../db/index.js';
import { fundingRequests, fundingRequestDocuments, coffeeGroves, platformFees } from '../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { fundingPoolService } from './funding-pool-service.js';
import { HederaPaymentService } from '../api/hedera-payment-service.js';

/**
 * Funding Request Service
 * Handles the lifecycle of funding requests from creation to disbursement
 */

export interface CreateRequestParams {
    groveId: number;
    farmerAddress: string;
    milestoneType: 'upfront' | 'maintenance' | 'harvest';
    amount: number;
    purpose: string;
}

export interface FundingRequest {
    id: number;
    groveId: number;
    farmerAddress: string;
    milestoneType: string;
    amountRequested: number;
    amountApproved: number | null;
    purpose: string;
    status: string;
    reviewedBy: string | null;
    reviewedAt: number | null;
    rejectionReason: string | null;
    adminNotes: string | null;
    transactionId: string | null;
    disbursedAt: number | null;
    platformFee: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface FundingRequestWithDetails extends FundingRequest {
    groveName?: string;
    farmerName?: string;
    documents?: Array<{
        id: number;
        fileName: string;
        fileType: string;
        fileSize: number;
        mimeType: string;
        uploadedAt: number;
    }>;
}

export class FundingRequestService {
    /**
     * Create a new funding request
     */
    async createRequest(params: CreateRequestParams): Promise<{ success: boolean; requestId?: number; error?: string }> {
        try {
            const { groveId, farmerAddress, milestoneType, amount, purpose } = params;

            // Validate inputs
            if (amount <= 0) {
                return { success: false, error: 'Amount must be greater than zero' };
            }

            if (!purpose || purpose.trim().length < 10) {
                return { success: false, error: 'Purpose must be at least 10 characters' };
            }

            // Validate grove exists and farmer owns it
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, groveId)
            });

            if (!grove) {
                return { success: false, error: 'Grove not found' };
            }

            if (grove.farmerAddress !== farmerAddress) {
                return { success: false, error: 'You do not own this grove' };
            }

            // Validate milestone amount availability
            const validation = await fundingPoolService.validateMilestoneAmount(
                groveId,
                milestoneType,
                amount
            );

            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Check for existing pending request for same milestone
            const existingRequest = await db.query.fundingRequests.findFirst({
                where: and(
                    eq(fundingRequests.groveId, groveId),
                    eq(fundingRequests.milestoneType, milestoneType),
                    eq(fundingRequests.status, 'pending')
                )
            });

            if (existingRequest) {
                return {
                    success: false,
                    error: `You already have a pending ${milestoneType} request for this grove`
                };
            }

            // Create request
            const now = Date.now();
            const result = await db.insert(fundingRequests).values({
                groveId,
                farmerAddress,
                milestoneType,
                amountRequested: amount,
                amountApproved: null,
                purpose: purpose.trim(),
                status: 'pending',
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
                adminNotes: null,
                transactionId: null,
                disbursedAt: null,
                platformFee: null,
                createdAt: now,
                updatedAt: now
            });

            const requestId = Number(result.lastInsertRowid);

            console.log(`[FundingRequest] Created request ${requestId} for grove ${groveId}: ${amount} cents from ${milestoneType}`);

            return { success: true, requestId };
        } catch (error: any) {
            console.error('[FundingRequest] Error creating request:', error);
            return { success: false, error: error.message || 'Failed to create request' };
        }
    }

    /**
     * Get all requests for a farmer
     */
    async getFarmerRequests(farmerAddress: string): Promise<FundingRequestWithDetails[]> {
        try {
            const requests = await db.query.fundingRequests.findMany({
                where: eq(fundingRequests.farmerAddress, farmerAddress),
                orderBy: [desc(fundingRequests.createdAt)]
            });

            // Enrich with grove names
            const enrichedRequests: FundingRequestWithDetails[] = [];
            for (const request of requests) {
                const grove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.id, request.groveId)
                });

                enrichedRequests.push({
                    ...request,
                    groveName: grove?.groveName || 'Unknown Grove'
                });
            }

            return enrichedRequests;
        } catch (error: any) {
            console.error('[FundingRequest] Error getting farmer requests:', error);
            return [];
        }
    }

    /**
     * Get all pending requests (for admin)
     */
    async getPendingRequests(): Promise<FundingRequestWithDetails[]> {
        try {
            const requests = await db.query.fundingRequests.findMany({
                where: eq(fundingRequests.status, 'pending'),
                orderBy: [fundingRequests.createdAt] // Oldest first for admin queue
            });

            // Enrich with grove and farmer details
            const enrichedRequests: FundingRequestWithDetails[] = [];
            for (const request of requests) {
                const grove = await db.query.coffeeGroves.findFirst({
                    where: eq(coffeeGroves.id, request.groveId)
                });

                enrichedRequests.push({
                    ...request,
                    groveName: grove?.groveName || 'Unknown Grove',
                    farmerName: request.farmerAddress
                });
            }

            return enrichedRequests;
        } catch (error: any) {
            console.error('[FundingRequest] Error getting pending requests:', error);
            return [];
        }
    }

    /**
     * Get request by ID with full details
     */
    async getRequestById(requestId: number): Promise<FundingRequestWithDetails | null> {
        try {
            const request = await db.query.fundingRequests.findFirst({
                where: eq(fundingRequests.id, requestId)
            });

            if (!request) {
                return null;
            }

            // Get grove details
            const grove = await db.query.coffeeGroves.findFirst({
                where: eq(coffeeGroves.id, request.groveId)
            });

            // Get documents
            const documents = await db.query.fundingRequestDocuments.findMany({
                where: eq(fundingRequestDocuments.requestId, requestId)
            });

            return {
                ...request,
                groveName: grove?.groveName || 'Unknown Grove',
                documents: documents.map(doc => ({
                    id: doc.id,
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    fileSize: doc.fileSize,
                    mimeType: doc.mimeType,
                    uploadedAt: doc.uploadedAt
                }))
            };
        } catch (error: any) {
            console.error('[FundingRequest] Error getting request by ID:', error);
            return null;
        }
    }

    /**
     * Cancel a pending request
     */
    async cancelRequest(requestId: number, farmerAddress: string): Promise<{ success: boolean; error?: string }> {
        try {
            const request = await db.query.fundingRequests.findFirst({
                where: eq(fundingRequests.id, requestId)
            });

            if (!request) {
                return { success: false, error: 'Request not found' };
            }

            if (request.farmerAddress !== farmerAddress) {
                return { success: false, error: 'You do not own this request' };
            }

            if (request.status !== 'pending') {
                return { success: false, error: 'Only pending requests can be cancelled' };
            }

            // Update status to cancelled
            await db.update(fundingRequests)
                .set({
                    status: 'cancelled',
                    updatedAt: Date.now()
                })
                .where(eq(fundingRequests.id, requestId));

            console.log(`[FundingRequest] Cancelled request ${requestId}`);

            return { success: true };
        } catch (error: any) {
            console.error('[FundingRequest] Error cancelling request:', error);
            return { success: false, error: error.message || 'Failed to cancel request' };
        }
    }

    /**
     * Admin: Approve a funding request
     */
    async approveRequest(
        requestId: number,
        adminAddress: string,
        notes?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const request = await db.query.fundingRequests.findFirst({
                where: eq(fundingRequests.id, requestId)
            });

            if (!request) {
                return { success: false, error: 'Request not found' };
            }

            if (request.status !== 'pending') {
                return { success: false, error: 'Only pending requests can be approved' };
            }

            // Validate funds are still available
            const validation = await fundingPoolService.validateMilestoneAmount(
                request.groveId,
                request.milestoneType as 'upfront' | 'maintenance' | 'harvest',
                request.amountRequested
            );

            if (!validation.valid) {
                return { success: false, error: `Insufficient funds: ${validation.error}` };
            }

            // Update request status to approved
            const now = Date.now();
            await db.update(fundingRequests)
                .set({
                    status: 'approved',
                    reviewedBy: adminAddress,
                    reviewedAt: now,
                    amountApproved: request.amountRequested,
                    adminNotes: notes || null,
                    updatedAt: now
                })
                .where(eq(fundingRequests.id, requestId));

            console.log(`[FundingRequest] Admin ${adminAddress} approved request ${requestId}`);

            return { success: true };
        } catch (error: any) {
            console.error('[FundingRequest] Error approving request:', error);
            return { success: false, error: error.message || 'Failed to approve request' };
        }
    }

    /**
     * Admin: Reject a funding request
     */
    async rejectRequest(
        requestId: number,
        adminAddress: string,
        reason: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (!reason || reason.trim().length < 10) {
                return { success: false, error: 'Rejection reason must be at least 10 characters' };
            }

            const request = await db.query.fundingRequests.findFirst({
                where: eq(fundingRequests.id, requestId)
            });

            if (!request) {
                return { success: false, error: 'Request not found' };
            }

            if (request.status !== 'pending') {
                return { success: false, error: 'Only pending requests can be rejected' };
            }

            // Update request status to rejected
            const now = Date.now();
            await db.update(fundingRequests)
                .set({
                    status: 'rejected',
                    reviewedBy: adminAddress,
                    reviewedAt: now,
                    rejectionReason: reason.trim(),
                    updatedAt: now
                })
                .where(eq(fundingRequests.id, requestId));

            console.log(`[FundingRequest] Admin ${adminAddress} rejected request ${requestId}: ${reason}`);

            return { success: true };
        } catch (error: any) {
            console.error('[FundingRequest] Error rejecting request:', error);
            return { success: false, error: error.message || 'Failed to reject request' };
        }
    }

    /**
     * Disburse funds after approval
     * Transfers USDC from treasury to farmer, deducts 3% platform fee
     */
    async disburseFunds(requestId: number): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        try {
            const request = await db.query.fundingRequests.findFirst({
                where: eq(fundingRequests.id, requestId)
            });

            if (!request) {
                return { success: false, error: 'Request not found' };
            }

            if (request.status !== 'approved') {
                return { success: false, error: 'Only approved requests can be disbursed' };
            }

            if (request.disbursedAt) {
                return { success: false, error: 'Request already disbursed' };
            }

            const approvedAmount = request.amountApproved || request.amountRequested;

            // Calculate platform fee (3%)
            const platformFee = Math.floor(approvedAmount * 0.03);
            const farmerAmount = approvedAmount - platformFee;

            console.log(`[FundingRequest] Disbursing request ${requestId}:`);
            console.log(`   Total: ${approvedAmount} cents`);
            console.log(`   Platform fee (3%): ${platformFee} cents`);
            console.log(`   Farmer receives: ${farmerAmount} cents`);

            // Transfer USDC to farmer
            const paymentService = new HederaPaymentService();
            const paymentResult = await paymentService.transferFromTreasury(
                request.farmerAddress,
                farmerAmount,
                `Funding: ${request.milestoneType} - Grove ${request.groveId}`
            );

            if (!paymentResult.success) {
                console.error(`[FundingRequest] Payment failed:`, paymentResult.error);
                return {
                    success: false,
                    error: paymentResult.error || 'Payment transfer failed'
                };
            }

            // Update request with disbursement details
            const now = Date.now();
            await db.update(fundingRequests)
                .set({
                    status: 'disbursed',
                    transactionId: paymentResult.transactionId || null,
                    disbursedAt: now,
                    platformFee,
                    updatedAt: now
                })
                .where(eq(fundingRequests.id, requestId));

            // Record platform fee
            await db.insert(platformFees).values({
                requestId,
                groveId: request.groveId,
                feeAmount: platformFee,
                feePercentage: 3.0,
                collectedAt: now
            });

            // Update funding pool
            await fundingPoolService.recordDisbursement(
                request.groveId,
                request.milestoneType as 'upfront' | 'maintenance' | 'harvest',
                approvedAmount,
                platformFee
            );

            console.log(`[FundingRequest] Disbursement complete for request ${requestId}`);
            console.log(`   Transaction: ${paymentResult.transactionId}`);

            return {
                success: true,
                transactionId: paymentResult.transactionId
            };
        } catch (error: any) {
            console.error('[FundingRequest] Error disbursing funds:', error);
            return {
                success: false,
                error: error.message || 'Failed to disburse funds'
            };
        }
    }
}

// Export singleton instance
export const fundingRequestService = new FundingRequestService();
