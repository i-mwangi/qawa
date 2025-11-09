import { db } from "../db/index.js";
import { assets, kyc, lendingReserves, liquidations, loanRepayment, loans, providedLiquidity, transactions, withdrawnLiquidity, creditScores } from "../db/schema/index.js";
import {lenderFireStore } from "../lib/stores.js";
import { generateId } from "../lib/utils.js";
import { indexFirestore } from "./utils.js";
import { determinePaymentCategory, adjustForHarvestSeason } from "../lib/credit-scoring/payment-categorizer.js";
import { calculateCreditScore } from "../lib/credit-scoring/calculator.js";
import { eq, and } from "drizzle-orm";

console.log("Started  LENDER INDEXER")
await indexFirestore({
    contract: 'lender',
    processor: async (key, data) => {
        console.log("Processing key", key)
        console.log("Processing data", data)
        switch (data.type) {
            case "AssetLendingReserveCreated": {
                
                await db.insert(lendingReserves).values({
                    token: data.token,
                    asset: data.asset,
                    name: data.name,
                    symbol: data.name, // TODO: Fix to use symbol
                    timestamp: data.timestamp
                })
                break;
            }
            case "LoanRecorded": {
                // Calculate deadline (30 days from now)
                const loanDuration = 30 * 24 * 60 * 60 * 1000 // 30 days in ms
                const deadline = data.timestamp + loanDuration
                
                await db.insert(loans).values({
                    account: data.borrower,
                    collateralAmount: data.collateralAmountAsset,
                    collateralAsset: data.token,
                    id: generateId("loan"),
                    liquidationPrice: data.liquidationKESPrice,
                    loanAmountUSDC: data.loanAmountKES,
                    repaymentAmount: data.repayAmount,
                    timestamp: data.timestamp,
                    deadline: deadline,
                    isActive: true,
                    isRepaid: false
                })
                
                // Initialize credit score if first loan
                const existingScore = await db.query.creditScores.findFirst({
                    where: eq(creditScores.account, data.borrower)
                })
                
                if (!existingScore) {
                    await db.insert(creditScores).values({
                        account: data.borrower,
                        currentScore: 500,
                        totalLoans: 0,
                        onTimePayments: 0,
                        earlyPayments: 0,
                        latePayments: 0,
                        lastUpdated: data.timestamp,
                        createdAt: data.timestamp
                    })
                }
                
                break;
            }
            case "LoanLiquidated": {
                const borrower = data.borrower
                const existingLoan = await db.query.loans.findFirst({
                    where(fields, operators) {
                        return operators.and(
                            operators.eq(fields.account, borrower),
                            operators.eq(fields.collateralAsset, data.token),
                            operators.eq(fields.isActive, true)
                        )
                    },
                })

                if (existingLoan) {
                    await db.insert(liquidations).values({
                        id: generateId("liquidation"),
                        account: borrower,
                        loanId: existingLoan.id,
                        timestamp: data.timestamp
                    })
                    
                    // Update loan status
                    await db.update(loans)
                        .set({ isActive: false })
                        .where(eq(loans.id, existingLoan.id))
                    
                    // Severe credit score penalty for liquidation
                    await penalizeCreditScoreForLiquidation(borrower, data.timestamp)
                }
                break;
            }
            case "LoanRepaid": {
                const borrower = data.borrower
                const existingLoan = await db.query.loans.findFirst({
                    where(fields, operators) {
                        return operators.and(
                            operators.eq(fields.account, borrower),
                            operators.eq(fields.collateralAsset, data.token),
                            operators.eq(fields.isActive, true)
                        )
                    },
                })

                if (existingLoan) {
                    // Categorize payment timing
                    let paymentCategory = determinePaymentCategory(
                        existingLoan.deadline,
                        data.timestamp,
                        existingLoan.timestamp
                    )
                    
                    // Apply seasonal adjustment for coffee farmers
                    paymentCategory = adjustForHarvestSeason(
                        paymentCategory,
                        data.timestamp
                    )
                    
                    // Record repayment with timing data
                    await db.insert(loanRepayment).values({
                        id: generateId("repayment"),
                        account: borrower,
                        loanId: existingLoan.id,
                        token: data.token,
                        timestamp: data.timestamp,
                        paymentCategory: paymentCategory.category,
                        daysEarlyLate: paymentCategory.days,
                        loanDuration: paymentCategory.loanDuration,
                        deadline: existingLoan.deadline
                    })
                    
                    // Update loan status
                    await db.update(loans)
                        .set({ isActive: false, isRepaid: true })
                        .where(eq(loans.id, existingLoan.id))
                    
                    // Update credit score
                    await updateCreditScore(borrower, paymentCategory, data.timestamp)
                }
                break;
            }
            case "LiquidityProvided": {
                await db.insert(providedLiquidity).values({
                    id: generateId("liquidity"),
                    account: data.user,
                    asset: data.asset,
                    amount: data.amount,
                    timestamp: data.timestamp
                })
                break;
            }
            case "LiquidityWithdrawn": {
                await db.insert(withdrawnLiquidity).values({
                    id: generateId("withdrawal"),
                    account: data.user,
                    asset: data.asset,
                    amount: data.amount,
                    timestamp: data.timestamp
                })
                break;
            }
            default: {
                console.log("Unknown event type", data)
                break
            }
        }
    },
    store: lenderFireStore
})

/**
 * Update credit score after loan repayment
 */
async function updateCreditScore(
    account: string,
    paymentCategory: any,
    timestamp: number
) {
    const currentScore = await db.query.creditScores.findFirst({
        where: eq(creditScores.account, account)
    })
    
    if (!currentScore) {
        console.error(`No credit score found for account ${account}`)
        return
    }
    
    // Update counters
    const newTotalLoans = currentScore.totalLoans + 1
    let newOnTimePayments = currentScore.onTimePayments
    let newEarlyPayments = currentScore.earlyPayments
    let newLatePayments = currentScore.latePayments
    
    if (paymentCategory.category === 'early') newEarlyPayments++
    else if (paymentCategory.category === 'on_time') newOnTimePayments++
    else newLatePayments++
    
    // Get all payment history for dynamic scoring
    const paymentHistory = await db.query.loanRepayment.findMany({
        where: eq(loanRepayment.account, account)
    })
    
    const paymentDetails = paymentHistory.map(p => ({
        category: p.paymentCategory as 'early' | 'on_time' | 'late',
        days: p.daysEarlyLate,
        loanDuration: p.loanDuration
    }))
    
    // Add current payment
    paymentDetails.push({
        category: paymentCategory.category,
        days: paymentCategory.days,
        loanDuration: paymentCategory.loanDuration
    })
    
    // Calculate new score
    const newScore = calculateCreditScore(
        newTotalLoans,
        newOnTimePayments,
        newEarlyPayments,
        newLatePayments,
        paymentDetails
    )
    
    // Update database
    await db.update(creditScores)
        .set({
            currentScore: newScore,
            totalLoans: newTotalLoans,
            onTimePayments: newOnTimePayments,
            earlyPayments: newEarlyPayments,
            latePayments: newLatePayments,
            lastUpdated: timestamp
        })
        .where(eq(creditScores.account, account))
    
    console.log(`✅ Credit score updated for ${account}: ${newScore} (${paymentCategory.category})`)
}

/**
 * Penalize credit score for liquidation
 */
async function penalizeCreditScoreForLiquidation(
    account: string,
    timestamp: number
) {
    const currentScore = await db.query.creditScores.findFirst({
        where: eq(creditScores.account, account)
    })
    
    if (!currentScore) return
    
    // Severe penalty: -150 points
    const newScore = Math.max(300, currentScore.currentScore - 150)
    
    await db.update(creditScores)
        .set({
            currentScore: newScore,
            latePayments: currentScore.latePayments + 1,
            lastUpdated: timestamp
        })
        .where(eq(creditScores.account, account))
    
    console.log(`⚠️  Credit score penalized for liquidation ${account}: ${newScore}`)
}

console.log("ENDED LENDER INDEXER")