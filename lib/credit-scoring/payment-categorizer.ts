/**
 * Payment Timing Categorization
 * Determines if payment was early, on-time, or late
 * 
 * This module categorizes loan repayments based on timing relative to the deadline,
 * with special adjustments for coffee harvest seasons.
 */

export interface PaymentCategory {
    category: 'early' | 'on_time' | 'late'
    days: number
    loanDuration: number
}

/**
 * Determine payment category based on timing
 * 
 * @param deadline - Loan deadline timestamp (milliseconds)
 * @param repaidAt - Actual repayment timestamp (milliseconds)
 * @param loanStartTime - When loan was taken (milliseconds)
 * @returns Payment category with timing details
 */
export function determinePaymentCategory(
    deadline: number,
    repaidAt: number,
    loanStartTime: number
): PaymentCategory {
    const deadlineTime = deadline
    const repaymentTime = repaidAt
    
    // Calculate difference in days
    const daysDifference = (repaymentTime - deadlineTime) / (24 * 60 * 60 * 1000)
    
    // Calculate loan duration in days
    const loanDuration = (deadlineTime - loanStartTime) / (24 * 60 * 60 * 1000)
    
    if (daysDifference <= -1) {
        // Paid at least 1 day early
        return {
            category: 'early',
            days: Math.abs(daysDifference),
            loanDuration: Math.max(1, loanDuration)
        }
    } else if (daysDifference >= 1) {
        // Paid at least 1 day late
        return {
            category: 'late',
            days: daysDifference,
            loanDuration: Math.max(1, loanDuration)
        }
    } else {
        // Paid within 1 day of deadline (on-time)
        return {
            category: 'on_time',
            days: Math.abs(daysDifference),
            loanDuration: Math.max(1, loanDuration)
        }
    }
}

/**
 * COFFEE-SPECIFIC TWEAK: Seasonal Adjustment
 * Coffee harvest seasons affect repayment ability
 * Adjust scoring to be more lenient during off-season
 * 
 * @param paymentCategory - Original payment category
 * @param repaidAt - Repayment timestamp
 * @returns Adjusted payment category
 */
export function adjustForHarvestSeason(
    paymentCategory: PaymentCategory,
    repaidAt: number
): PaymentCategory {
    const repaymentDate = new Date(repaidAt)
    const month = repaymentDate.getMonth() // 0-11
    
    // Coffee harvest seasons (adjust based on your region):
    // Main harvest: October-December (months 9-11)
    // Off-season: January-September (months 0-8)
    
    const isOffSeason = month >= 0 && month <= 8
    
    if (isOffSeason && paymentCategory.category === 'late') {
        // Reduce penalty for late payments during off-season
        if (paymentCategory.days <= 7) {
            // 1-7 days late during off-season = treat as on-time
            return {
                ...paymentCategory,
                category: 'on_time'
            }
        } else if (paymentCategory.days <= 14) {
            // 8-14 days late = reduce penalty by 50%
            return {
                ...paymentCategory,
                days: paymentCategory.days * 0.5
            }
        }
    }
    
    return paymentCategory
}

/**
 * Get seasonal collateral ratio
 * During harvest season, trees are more valuable
 * 
 * @param currentMonth - Current month (0-11)
 * @returns Collateralization ratio percentage
 */
export function getSeasonalCollateralRatio(currentMonth: number): number {
    const MAIN_HARVEST_MONTHS = [9, 10, 11] // Oct-Dec
    
    if (MAIN_HARVEST_MONTHS.includes(currentMonth)) {
        // During harvest, trees are more valuable
        return 110 // 110% collateralization
    } else {
        // Off-season, require more collateral
        return 125 // 125% collateralization
    }
}

/**
 * Check if current date is in harvest season
 * 
 * @param timestamp - Timestamp to check (milliseconds)
 * @returns True if in harvest season
 */
export function isHarvestSeason(timestamp: number = Date.now()): boolean {
    const month = new Date(timestamp).getMonth()
    const MAIN_HARVEST_MONTHS = [9, 10, 11] // Oct-Dec
    return MAIN_HARVEST_MONTHS.includes(month)
}

/**
 * Get recommended loan duration based on season
 * 
 * @param timestamp - Current timestamp (milliseconds)
 * @returns Recommended loan duration in days
 */
export function getRecommendedLoanDuration(timestamp: number = Date.now()): number {
    const month = new Date(timestamp).getMonth()
    
    // If close to harvest season, recommend shorter duration
    if (month >= 7 && month <= 9) {
        // July-September: Harvest approaching
        return 60 // 2 months
    } else if (month >= 10 && month <= 12) {
        // October-December: During harvest
        return 30 // 1 month
    } else {
        // Off-season: Longer duration acceptable
        return 90 // 3 months
    }
}
