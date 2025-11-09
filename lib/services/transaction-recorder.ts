import { db } from "../../db/index";
import { transactionHistory } from "../../db/schema/index";
import { eq, or, and, desc, gte, lte } from "drizzle-orm";

/**
 * Transaction Recorder Service
 * 
 * Records all financial activities in the transactionHistory table
 * including token purchases, transfers, and revenue distributions.
 */

export interface RecordTokenPurchaseParams {
  buyerAddress: string;
  groveId: number;
  tokenAmount: number;
  paymentAmount: number;
  transactionType: 'primary' | 'secondary';
  sellerAddress?: string; // Required for secondary market
  transactionHash?: string;
}

export interface RecordRevenueDistributionParams {
  recipientAddress: string;
  amount: number;
  harvestId: number;
  groveId: number;
  tokenAmount: number;
  transactionHash?: string;
}

export interface GetTransactionHistoryParams {
  userAddress: string;
  type?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export interface TransactionRecord {
  id: string;
  type: string;
  amount: number;
  asset: string;
  fromAddress: string;
  toAddress: string;
  status: string;
  timestamp: number;
  transactionHash?: string | null;
  blockExplorerUrl?: string | null;
  metadata?: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Record a token purchase transaction
 * 
 * Creates a transactionHistory record for primary or secondary market purchases.
 * For primary market: buyer purchases from grove supply
 * For secondary market: buyer purchases from another investor
 */
export async function recordTokenPurchase(params: RecordTokenPurchaseParams): Promise<void> {
  const {
    buyerAddress,
    groveId,
    tokenAmount,
    paymentAmount,
    transactionType,
    sellerAddress,
    transactionHash
  } = params;

  const timestamp = Date.now();
  const type = transactionType === 'primary' 
    ? 'token_purchase_primary' 
    : 'token_transfer_secondary';

  const metadata = JSON.stringify({
    groveId,
    tokenAmount,
    paymentAmount,
    transactionType
  });

  // For primary market: fromAddress is buyer (they're paying), toAddress is buyer (they're receiving tokens)
  // For secondary market: we create two records (one for seller, one for buyer)
  
  if (transactionType === 'primary') {
    // Primary market purchase - buyer gets tokens from grove
    await db.insert(transactionHistory).values({
      id: generateTransactionId(),
      type,
      amount: paymentAmount,
      asset: `GROVE_${groveId}`,
      fromAddress: buyerAddress,
      toAddress: buyerAddress,
      status: 'completed',
      timestamp,
      transactionHash: transactionHash || null,
      blockExplorerUrl: transactionHash 
        ? `https://hashscan.io/testnet/transaction/${transactionHash}`
        : null,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  } else {
    // Secondary market transfer - create records for both parties
    if (!sellerAddress) {
      throw new Error('sellerAddress is required for secondary market transactions');
    }

    // Record for seller (outgoing tokens)
    await db.insert(transactionHistory).values({
      id: generateTransactionId(),
      type,
      amount: paymentAmount,
      asset: `GROVE_${groveId}`,
      fromAddress: sellerAddress,
      toAddress: buyerAddress,
      status: 'completed',
      timestamp,
      transactionHash: transactionHash || null,
      blockExplorerUrl: transactionHash 
        ? `https://hashscan.io/testnet/transaction/${transactionHash}`
        : null,
      metadata: JSON.stringify({
        ...JSON.parse(metadata),
        role: 'seller'
      }),
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // Record for buyer (incoming tokens)
    await db.insert(transactionHistory).values({
      id: generateTransactionId(),
      type,
      amount: paymentAmount,
      asset: `GROVE_${groveId}`,
      fromAddress: sellerAddress,
      toAddress: buyerAddress,
      status: 'completed',
      timestamp,
      transactionHash: transactionHash || null,
      blockExplorerUrl: transactionHash 
        ? `https://hashscan.io/testnet/transaction/${transactionHash}`
        : null,
      metadata: JSON.stringify({
        ...JSON.parse(metadata),
        role: 'buyer'
      }),
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }
}

/**
 * Record a revenue distribution transaction
 * 
 * Creates a transactionHistory record when harvest revenue is distributed
 * to a token holder.
 */
export async function recordRevenueDistribution(params: RecordRevenueDistributionParams): Promise<void> {
  const {
    recipientAddress,
    amount,
    harvestId,
    groveId,
    tokenAmount,
    transactionHash
  } = params;

  const timestamp = Date.now();

  const metadata = JSON.stringify({
    harvestId,
    groveId,
    tokenAmount,
    distributionType: 'harvest_revenue'
  });

  await db.insert(transactionHistory).values({
    id: generateTransactionId(),
    type: 'revenue_distribution',
    amount,
    asset: 'USDC',
    fromAddress: `GROVE_${groveId}`,
    toAddress: recipientAddress,
    status: 'completed',
    timestamp,
    transactionHash: transactionHash || null,
    blockExplorerUrl: transactionHash 
      ? `https://hashscan.io/testnet/transaction/${transactionHash}`
      : null,
    metadata,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

/**
 * Get transaction history for a user
 * 
 * Queries transactionHistory by fromAddress or toAddress with optional filtering
 * by type and date range. Returns results ordered by timestamp descending.
 */
export async function getTransactionHistory(params: GetTransactionHistoryParams): Promise<TransactionRecord[]> {
  const {
    userAddress,
    type,
    startDate,
    endDate,
    limit = 50
  } = params;

  // Build the where clause
  const conditions: any[] = [
    or(
      eq(transactionHistory.fromAddress, userAddress),
      eq(transactionHistory.toAddress, userAddress)
    )
  ];

  // Add type filter if provided
  if (type) {
    conditions.push(eq(transactionHistory.type, type));
  }

  // Add date range filters if provided
  if (startDate) {
    conditions.push(gte(transactionHistory.timestamp, startDate));
  }

  if (endDate) {
    conditions.push(lte(transactionHistory.timestamp, endDate));
  }

  // Execute query
  const results = await db
    .select()
    .from(transactionHistory)
    .where(and(...conditions))
    .orderBy(desc(transactionHistory.timestamp))
    .limit(limit)
    .execute();

  return results as TransactionRecord[];
}

/**
 * Record farmer revenue from harvest
 * 
 * Creates a transactionHistory record when a farmer receives their share
 * of harvest revenue.
 */
export async function recordFarmerRevenue(params: {
  farmerAddress: string;
  amount: number;
  harvestId: number;
  groveId: number;
  transactionHash?: string;
}): Promise<void> {
  const {
    farmerAddress,
    amount,
    harvestId,
    groveId,
    transactionHash
  } = params;

  const timestamp = Date.now();

  const metadata = JSON.stringify({
    harvestId,
    groveId,
    revenueType: 'farmer_share'
  });

  await db.insert(transactionHistory).values({
    id: generateTransactionId(),
    type: 'farmer_revenue',
    amount,
    asset: 'USDC',
    fromAddress: `GROVE_${groveId}`,
    toAddress: farmerAddress,
    status: 'completed',
    timestamp,
    transactionHash: transactionHash || null,
    blockExplorerUrl: transactionHash 
      ? `https://hashscan.io/testnet/transaction/${transactionHash}`
      : null,
    metadata,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}
