/**
 * Loan Management Service
 * Handles loan creation, repayment, and health monitoring
 */

import { db } from '../../db/index.js';
import { lendingLoans, lendingLoanCollateral, lendingLoanPayments, lendingLoanHealthHistory, lendingPoolStats } from '../../db/schema/index.js';
import { eq, and, lt, desc } from 'drizzle-orm';
import { hederaLoanService } from './hedera-loan-service.js';

interface CreateLoanParams {
    borrowerAccount: string;
    assetAddress: string;
    loanAmount: number;
    collateralTokenId: string;
    collateralAmount: number;
    collateralPrice: number;
}

interface Loan {
    id: number;
    loanId: string;
    borrowerAccount: string;
    assetAddress: string;
    loanAmountUsdc: number;
    collateralAmount: number;
    collateralTokenId: string;
    repaymentAmount: number;
    interestRate: number;
    collateralizationRatio: number;
    liquidationThreshold: number;
    liquidationPrice: number | null;
    healthFactor: number;
    status: string;
    takenAt: number;
    dueDate: number;
    repaidAt: number | null;
    liquidatedAt: number | null;
    transactionHash: string | null;
    createdAt: number;
    updatedAt: number;
}

interface RepaymentParams {
    loanId: string;
    borrowerAccount: string;
    paymentAmount: number;
}

export class LoanManagementService {
    // Constants
    private readonly COLLATERALIZATION_RATIO = 1.25; // 125%
    private readonly LIQUIDATION_THRESHOLD = 0.90; // 90%
    private readonly INTEREST_RATE = 0.10; // 10%
    private readonly LOAN_DURATION_DAYS = 180; // 180 days

    constructor() {
        console.log('[LoanManagementService] Initialized');
    }

    /**
     * Create a new loan
     */
    async createLoan(params: CreateLoanParams): Promise<Loan> {
        const {
            borrowerAccount,
            assetAddress,
            loanAmount,
            collateralTokenId,
            collateralAmount,
            collateralPrice
        } = params;

        console.log('[LoanManagementService] Creating loan:');
        console.log(`  Borrower: ${borrowerAccount}`);
        console.log(`  Loan Amount: ${loanAmount} USDC`);
        console.log(`  Collateral: ${collateralAmount} tokens @ $${collateralPrice}`);

        try {
            // Validate collateralization
            const collateralValue = collateralAmount * collateralPrice;
            const requiredCollateral = loanAmount * this.COLLATERALIZATION_RATIO;

            if (collateralValue < requiredCollateral) {
                throw new Error(
                    `Insufficient collateral. Required: $${requiredCollateral.toFixed(2)}, Provided: $${collateralValue.toFixed(2)}`
                );
            }

            // Check pool liquidity
            const poolStats = await db.select()
                .from(lendingPoolStats)
                .where(eq(lendingPoolStats.assetAddress, assetAddress))
                .limit(1);

            if (poolStats.length === 0) {
                throw new Error('Lending pool not found');
            }

            if (poolStats[0].availableLiquidity < loanAmount) {
                throw new Error(
                    `Insufficient pool liquidity. Available: ${poolStats[0].availableLiquidity}, Requested: ${loanAmount}`
                );
            }

            // Originate loan on Hedera
            const hederaResult = await hederaLoanService.originateLoan({
                borrowerAccount,
                loanAmount,
                collateralTokenId,
                collateralAmount
            });

            if (!hederaResult.success) {
                throw new Error(`Hedera loan origination failed: ${hederaResult.error}`);
            }

            // Calculate loan terms
            const repaymentAmount = loanAmount * (1 + this.INTEREST_RATE);
            const liquidationPrice = this.calculateLiquidationPrice(loanAmount, collateralAmount);
            const healthFactor = this.calculateHealthFactor(collateralAmount, collateralPrice, loanAmount);
            const takenAt = Date.now();
            const dueDate = takenAt + (this.LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

            // Insert loan record
            const loanRecord = await db.insert(lendingLoans).values({
                loanId: hederaResult.loanId!,
                borrowerAccount,
                assetAddress,
                loanAmountUsdc: loanAmount,
                collateralAmount,
                collateralTokenId,
                repaymentAmount,
                interestRate: this.INTEREST_RATE,
                collateralizationRatio: this.COLLATERALIZATION_RATIO,
                liquidationThreshold: this.LIQUIDATION_THRESHOLD,
                liquidationPrice,
                healthFactor,
                status: 'active',
                takenAt,
                dueDate,
                transactionHash: hederaResult.transactionId,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }).returning();

            // Insert collateral record
            await db.insert(lendingLoanCollateral).values({
                loanId: hederaResult.loanId!,
                tokenId: collateralTokenId,
                amount: collateralAmount,
                initialPrice: collateralPrice,
                currentPrice: collateralPrice,
                lockedAt: takenAt,
                lockTransactionHash: hederaResult.transactionId,
                createdAt: Date.now()
            });

            // Record initial health
            await this.recordHealthCheck(hederaResult.loanId!, healthFactor, collateralPrice, collateralValue);

            console.log(`  ✅ Loan created: ${hederaResult.loanId}`);

            return loanRecord[0] as Loan;

        } catch (error: any) {
            console.error('[LoanManagementService] Error creating loan:', error);
            throw error;
        }
    }

    /**
     * Get loan by ID
     */
    async getLoan(loanId: string): Promise<Loan | null> {
        try {
            const loans = await db.select()
                .from(lendingLoans)
                .where(eq(lendingLoans.loanId, loanId))
                .limit(1);

            return loans.length > 0 ? (loans[0] as Loan) : null;
        } catch (error) {
            console.error('[LoanManagementService] Error getting loan:', error);
            return null;
        }
    }

    /**
     * Get all loans for a borrower
     */
    async getBorrowerLoans(borrowerAccount: string): Promise<Loan[]> {
        try {
            const loans = await db.select()
                .from(lendingLoans)
                .where(eq(lendingLoans.borrowerAccount, borrowerAccount))
                .orderBy(desc(lendingLoans.takenAt));

            return loans as Loan[];
        } catch (error) {
            console.error('[LoanManagementService] Error getting borrower loans:', error);
            return [];
        }
    }

    /**
     * Get active loans
     */
    async getActiveLoans(): Promise<Loan[]> {
        try {
            const loans = await db.select()
                .from(lendingLoans)
                .where(eq(lendingLoans.status, 'active'))
                .orderBy(desc(lendingLoans.takenAt));

            return loans as Loan[];
        } catch (error) {
            console.error('[LoanManagementService] Error getting active loans:', error);
            return [];
        }
    }

    /**
     * Process loan repayment
     */
    async processRepayment(params: RepaymentParams): Promise<void> {
        const { loanId, borrowerAccount, paymentAmount } = params;

        console.log('[LoanManagementService] Processing repayment:');
        console.log(`  Loan ID: ${loanId}`);
        console.log(`  Payment: ${paymentAmount} USDC`);

        try {
            // Get loan details
            const loan = await this.getLoan(loanId);
            if (!loan) {
                throw new Error('Loan not found');
            }

            if (loan.status !== 'active') {
                throw new Error(`Loan is not active. Status: ${loan.status}`);
            }

            if (loan.borrowerAccount !== borrowerAccount) {
                throw new Error('Borrower account mismatch');
            }

            // Get collateral details
            const collateral = await db.select()
                .from(lendingLoanCollateral)
                .where(eq(lendingLoanCollateral.loanId, loanId))
                .limit(1);

            if (collateral.length === 0) {
                throw new Error('Collateral record not found');
            }

            // Process repayment on Hedera
            const hederaResult = await hederaLoanService.repayLoan({
                loanId,
                borrowerAccount,
                repaymentAmount: paymentAmount,
                collateralTokenId: collateral[0].tokenId,
                collateralAmount: collateral[0].amount
            });

            if (!hederaResult.success) {
                throw new Error(`Hedera repayment failed: ${hederaResult.error}`);
            }

            // Determine payment type
            const isFullRepayment = paymentAmount >= loan.repaymentAmount;
            const paymentType = isFullRepayment ? 'full' : 'partial';
            const remainingBalance = Math.max(0, loan.repaymentAmount - paymentAmount);

            // Record payment
            const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(lendingLoanPayments).values({
                paymentId,
                loanId,
                borrowerAccount,
                paymentAmount,
                paymentType,
                remainingBalance,
                paidAt: Date.now(),
                transactionHash: hederaResult.transactionId,
                createdAt: Date.now()
            });

            // Update loan status if fully repaid
            if (isFullRepayment) {
                await db.update(lendingLoans)
                    .set({
                        status: 'repaid',
                        repaidAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .where(eq(lendingLoans.loanId, loanId));

                // Update collateral record
                await db.update(lendingLoanCollateral)
                    .set({
                        unlockedAt: Date.now(),
                        unlockTransactionHash: hederaResult.transactionId
                    })
                    .where(eq(lendingLoanCollateral.loanId, loanId));

                console.log(`  ✅ Loan fully repaid: ${loanId}`);
            } else {
                console.log(`  ✅ Partial payment recorded. Remaining: ${remainingBalance} USDC`);
            }

        } catch (error: any) {
            console.error('[LoanManagementService] Error processing repayment:', error);
            throw error;
        }
    }

    /**
     * Update loan health factor
     */
    async updateLoanHealth(loanId: string, currentPrice: number): Promise<void> {
        try {
            const loan = await this.getLoan(loanId);
            if (!loan || loan.status !== 'active') {
                return;
            }

            const healthFactor = this.calculateHealthFactor(
                loan.collateralAmount,
                currentPrice,
                loan.loanAmountUsdc
            );

            const collateralValue = loan.collateralAmount * currentPrice;

            // Update loan health factor
            await db.update(lendingLoans)
                .set({
                    healthFactor,
                    updatedAt: Date.now()
                })
                .where(eq(lendingLoans.loanId, loanId));

            // Update collateral current price
            await db.update(lendingLoanCollateral)
                .set({
                    currentPrice
                })
                .where(eq(lendingLoanCollateral.loanId, loanId));

            // Record health check
            await this.recordHealthCheck(loanId, healthFactor, currentPrice, collateralValue);

        } catch (error) {
            console.error('[LoanManagementService] Error updating loan health:', error);
        }
    }

    /**
     * Get loans at risk of liquidation
     */
    async getLoansAtRisk(): Promise<Loan[]> {
        try {
            const loans = await db.select()
                .from(lendingLoans)
                .where(
                    and(
                        eq(lendingLoans.status, 'active'),
                        lt(lendingLoans.healthFactor, 1.1) // Health factor < 1.1 (warning threshold)
                    )
                )
                .orderBy(lendingLoans.healthFactor);

            return loans as Loan[];
        } catch (error) {
            console.error('[LoanManagementService] Error getting loans at risk:', error);
            return [];
        }
    }

    /**
     * Calculate health factor
     * healthFactor = (collateralValue * liquidationThreshold) / loanAmount
     * If < 1.0, loan is at risk of liquidation
     */
    private calculateHealthFactor(
        collateralAmount: number,
        collateralPrice: number,
        loanAmount: number
    ): number {
        const collateralValue = collateralAmount * collateralPrice;
        const healthFactor = (collateralValue * this.LIQUIDATION_THRESHOLD) / loanAmount;
        return Math.round(healthFactor * 100) / 100; // Round to 2 decimals
    }

    /**
     * Calculate liquidation price
     * liquidationPrice = loanAmount / (collateralAmount * liquidationThreshold)
     */
    private calculateLiquidationPrice(loanAmount: number, collateralAmount: number): number {
        const liquidationPrice = loanAmount / (collateralAmount * this.LIQUIDATION_THRESHOLD);
        return Math.round(liquidationPrice * 100) / 100; // Round to 2 decimals
    }

    /**
     * Record health check in history
     */
    private async recordHealthCheck(
        loanId: string,
        healthFactor: number,
        collateralPrice: number,
        collateralValue: number
    ): Promise<void> {
        try {
            await db.insert(lendingLoanHealthHistory).values({
                loanId,
                healthFactor,
                collateralPrice,
                collateralValue,
                checkedAt: Date.now()
            });
        } catch (error) {
            console.error('[LoanManagementService] Error recording health check:', error);
        }
    }
}

// Export singleton instance
export const loanManagementService = new LoanManagementService();
