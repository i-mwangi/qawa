/**
 * Type definitions for Earnings & Distribution System
 */

// Farmer Types
export type FarmerDistributionStatus = 'pending' | 'distributed' | 'withdrawn';

export interface FarmerGroveEarning {
    id: number;
    farmerAddress: string;
    groveId: number;
    harvestId: number;
    grossRevenue: number;
    farmerShare: number;
    distributionStatus: FarmerDistributionStatus;
    distributedAt?: number;
    withdrawnAt?: number;
    distributionTxHash?: string;
    withdrawalTxHash?: string;
    createdAt: number;
    updatedAt: number;
}

export interface FarmerGroveBalance {
    id: number;
    farmerAddress: string;
    groveId: number;
    thisMonthDistributed: number;
    availableBalance: number;
    pendingDistribution: number;
    totalWithdrawn: number;
    totalEarned: number;
    lastWithdrawalAt?: number;
    lastCalculatedAt: number;
    updatedAt: number;
}

// Investor Types
export type InvestorAcquisitionType = 'primary' | 'secondary';
export type InvestorEarningType = 'primary_market' | 'secondary_market' | 'lp_interest';
export type InvestorEarningStatus = 'unclaimed' | 'claimed';

export interface InvestorTokenHolding {
    id: number;
    investorAddress: string;
    groveId: number;
    tokenAmount: number;
    acquisitionType: InvestorAcquisitionType;
    purchasePrice: number;
    purchaseDate: number;
    previousOwner?: string;
    transferTxHash?: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface InvestorEarning {
    id: number;
    investorAddress: string;
    earningType: InvestorEarningType;
    sourceId: number;
    groveId?: number;
    holdingId?: number;
    tokenAmount?: number;
    earningAmount: number;
    status: InvestorEarningStatus;
    claimedAt?: number;
    claimTxHash?: string;
    distributedAt?: number;
    distributionTxHash?: string;
    createdAt: number;
    updatedAt: number;
}

export interface InvestorBalance {
    investorAddress: string;
    totalEarningsAllTime: number;
    totalEarningsThisMonth: number;
    unclaimedPrimaryMarket: number;
    unclaimedSecondaryMarket: number;
    unclaimedLpInterest: number;
    totalUnclaimed: number;
    totalClaimed: number;
    lastClaimAt?: number;
    lastCalculatedAt: number;
    updatedAt: number;
}

// LP Token Types
export type LpInterestStatus = 'accrued' | 'withdrawn' | 'claimed';

export interface LpTokenInterest {
    id: number;
    providerAddress: string;
    lpTokenAddress: string;
    assetAddress: string;
    principalAmount: number;
    interestEarned: number;
    interestRate: number;
    periodStart: number;
    periodEnd: number;
    status: LpInterestStatus;
    claimedAt?: number;
    claimTxHash?: string;
    createdAt: number;
    updatedAt: number;
}

// Claim Types
export type ClaimStatus = 'pending' | 'completed' | 'failed';

export interface InvestorClaim {
    id: string;
    investorAddress: string;
    claimAmount: number;
    earningIds: string; // JSON array
    status: ClaimStatus;
    transactionHash?: string;
    blockExplorerUrl?: string;
    errorMessage?: string;
    gasFeeAmount?: number;
    requestedAt: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

// Secondary Market Types
export type TransferStatus = 'pending' | 'completed' | 'failed';

export interface SecondaryMarketTransfer {
    id: number;
    groveId: number;
    fromAddress: string;
    toAddress: string;
    tokenAmount: number;
    transferPrice: number;
    transactionHash?: string;
    status: TransferStatus;
    transferDate: number;
    createdAt: number;
}

// Dashboard View Types
export interface FarmerDashboardData {
    groveId: number;
    groveName: string;
    thisMonthDistributed: number;
    availableBalance: number;
    pendingDistribution: number;
    totalWithdrawn: number;
    totalEarned: number;
}

export interface InvestorDashboardData {
    totalEarningsAllTime: number;
    totalEarningsThisMonth: number;
    totalClaimed: number;
    unclaimedBreakdown: {
        primaryMarket: number;
        secondaryMarket: number;
        lpInterest: number;
        total: number;
    };
    holdings: Array<{
        groveId: number;
        groveName: string;
        tokenAmount: number;
        acquisitionType: InvestorAcquisitionType;
        unclaimedEarnings: number;
    }>;
}

// API Request/Response Types
export interface WithdrawRequest {
    farmerAddress: string;
    groveId: number;
    amount: number;
}

export interface ClaimRequest {
    investorAddress: string;
    earningIds: number[];
    amount: number;
}

export interface DistributionResult {
    harvestId: number;
    farmerEarningsCreated: number;
    investorEarningsCreated: number;
    totalDistributed: number;
    distributedAt: number;
}
