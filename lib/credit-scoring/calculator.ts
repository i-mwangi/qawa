/**
 * Credit Scoring Calculator
 * Adapted from HedFunds for Coffee Lending Pool
 * 
 * This module calculates credit scores based on payment history,
 * rewarding early and on-time payments while penalizing late payments.
 */

export interface PaymentDetail {
    category: 'early' | 'on_time' | 'late'
    days: number
    loanDuration: number
}

export interface CreditScoreResult {
    score: number
    tier: 'excellent' | 'good' | 'fair' | 'poor'
    maxLoanAmount: number
}

/**
 * Calculate credit score based on payment history
 * 
 * @param totalLoans - Total number of loans taken
 * @param onTimePayments - Number of on-time payments
 * @param earlyPayments - Number of early payments
 * @param latePayments - Number of late payments
 * @param paymentDetails - Detailed payment history for dynamic scoring
 * @returns Credit score (300-850)
 */
export function calculateCreditScore(
    totalLoans: number,
    onTimePayments: number,
    earlyPayments: number,
    latePayments: number,
    paymentDetails: PaymentDetail[] = []
): number {
    const baseScore = 500
    
    // New borrowers start at base score
    if (totalLoans === 0) return baseScore
    
    let score = baseScore
    
    // Experience bonus (up to +50 points for having more loans)
    if (totalLoans >= 10) {
        score += 50
    } else if (totalLoans >= 5) {
        score += 25
    } else if (totalLoans >= 2) {
        score += 10
    }
    
    // Dynamic scoring based on payment timing
    if (paymentDetails.length > 0) {
        score += calculateDynamicScore(paymentDetails)
    } else {
        // Fallback to percentage-based calculation
        const onTimePercentage = (onTimePayments / totalLoans) * 100
        const earlyPercentage = (earlyPayments / totalLoans) * 100
        const latePercentage = (latePayments / totalLoans) * 100
        
        score += (onTimePercentage * 2)
        score += (earlyPercentage * 1)
        score -= (latePercentage * 3)
    }
    
    // Ensure score is within bounds (300-850)
    score = Math.max(300, Math.min(850, score))
    return Math.round(score)
}

/**
 * Calculate dynamic score based on detailed payment history
 */
function calculateDynamicScore(paymentDetails: PaymentDetail[]): number {
    let totalScore = 0
    
    for (const payment of paymentDetails) {
        const { category, days, loanDuration } = payment
        
        switch (category) {
            case 'early':
                totalScore += calculateEarlyScore(days, loanDuration)
                break
            case 'on_time':
                totalScore += calculateOnTimeScore(days, loanDuration)
                break
            case 'late':
                totalScore += calculateLateScore(days)
                break
        }
    }
    
    return totalScore
}

/**
 * Calculate score for early payment
 * Earlier payments relative to loan duration get higher scores
 */
function calculateEarlyScore(daysEarly: number, loanDuration: number): number {
    const earlyThreshold25 = loanDuration * 0.25 // First 25% of loan duration
    const earlyThreshold50 = loanDuration * 0.50 // First 50% of loan duration
    
    if (daysEarly >= earlyThreshold25) {
        return 100 // Very early - within first 25% of loan duration
    } else if (daysEarly >= earlyThreshold50) {
        return 75 // Early - within first 50% of loan duration
    } else {
        return 50 // Less early but still early
    }
}

/**
 * Calculate score for on-time payment
 * Payments closer to the start of the loan period get higher scores
 */
function calculateOnTimeScore(daysBeforeDeadline: number, loanDuration: number): number {
    const onTimeThreshold75 = loanDuration * 0.75 // First 75% of loan duration
    
    if (daysBeforeDeadline >= onTimeThreshold75) {
        return 50 // On-time - within first 75% of loan duration
    } else if (daysBeforeDeadline > 5) {
        return 35 // More than 5 days before deadline
    } else if (daysBeforeDeadline >= 1 && daysBeforeDeadline <= 5) {
        return 15 // 1-5 days before deadline
    } else {
        return 0 // On deadline day (same day)
    }
}

/**
 * Calculate score for late payment (negative points)
 * Later payments get increasingly severe penalties
 */
function calculateLateScore(daysLate: number): number {
    if (daysLate === 1) {
        return -5 // 1 day late
    } else if (daysLate >= 2 && daysLate <= 5) {
        return -30 // 2-5 days late
    } else {
        return -50 // More than 5 days late
    }
}

/**
 * Get credit tier and max loan amount based on score
 * 
 * @param score - Credit score (300-850)
 * @returns Credit tier information
 */
export function getCreditTier(score: number): CreditScoreResult {
    if (score >= 750) {
        return {
            score,
            tier: 'excellent',
            maxLoanAmount: 10000 // $10,000 USDC
        }
    } else if (score >= 650) {
        return {
            score,
            tier: 'good',
            maxLoanAmount: 5000 // $5,000 USDC
        }
    } else if (score >= 550) {
        return {
            score,
            tier: 'fair',
            maxLoanAmount: 2000 // $2,000 USDC
        }
    } else {
        return {
            score,
            tier: 'poor',
            maxLoanAmount: 500 // $500 USDC
        }
    }
}

/**
 * Get color class for credit score display
 */
export function getCreditScoreColor(score: number): string {
    if (score >= 750) return 'text-green-600'
    if (score >= 650) return 'text-blue-600'
    if (score >= 550) return 'text-yellow-600'
    return 'text-red-600'
}

/**
 * Get background color class for credit score display
 */
export function getCreditScoreBgColor(score: number): string {
    if (score >= 750) return 'bg-green-500'
    if (score >= 650) return 'bg-blue-500'
    if (score >= 550) return 'bg-yellow-500'
    return 'bg-red-500'
}

/**
 * Get label for credit score tier
 */
export function getCreditScoreLabel(score: number): string {
    if (score >= 750) return 'Excellent'
    if (score >= 650) return 'Good'
    if (score >= 550) return 'Fair'
    return 'Poor'
}

/**
 * Calculate progress percentage for visual display
 */
export function getCreditScoreProgress(score: number): number {
    return Math.min((score / 850) * 100, 100)
}
