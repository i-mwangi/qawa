import { db } from '../db'
import { transactionHistory } from '../db/schema'

/**
 * Transaction Recording Service
 * Records all platform transactions to the transaction_history table
 */
export class TransactionRecordingService {
    /**
     * Generate a unique transaction ID
     */
    private generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Record a token purchase transaction
     */
    async recordPurchase(data: {
        buyerAddress: string
        groveId: string
        tokenAmount: number
        usdcAmount: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'purchase',
                fromAddress: data.buyerAddress,
                toAddress: data.groveId,
                amount: data.usdcAmount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    groveId: data.groveId,
                    tokenAmount: data.tokenAmount,
                    usdcAmount: data.usdcAmount
                })
            })
            console.log(`[TransactionRecording] Recorded purchase: ${data.buyerAddress} -> ${data.groveId}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record purchase:', error)
        }
    }

    /**
     * Record a token sale/listing transaction
     */
    async recordSale(data: {
        sellerAddress: string
        buyerAddress: string
        groveId: string
        tokenAmount: number
        usdcAmount: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'sale',
                fromAddress: data.sellerAddress,
                toAddress: data.buyerAddress,
                amount: data.usdcAmount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    groveId: data.groveId,
                    tokenAmount: data.tokenAmount,
                    usdcAmount: data.usdcAmount
                })
            })
            console.log(`[TransactionRecording] Recorded sale: ${data.sellerAddress} -> ${data.buyerAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record sale:', error)
        }
    }

    /**
     * Record a revenue distribution transaction
     */
    async recordDistribution(data: {
        groveId: string
        holderAddress: string
        amount: number
        distributionId: string
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'distribution',
                fromAddress: data.groveId,
                toAddress: data.holderAddress,
                amount: data.amount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    distributionId: data.distributionId,
                    groveId: data.groveId
                })
            })
            console.log(`[TransactionRecording] Recorded distribution: ${data.groveId} -> ${data.holderAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record distribution:', error)
        }
    }

    /**
     * Record a liquidity provision transaction
     */
    async recordLiquidityProvided(data: {
        providerAddress: string
        assetAddress: string
        amount: number
        lpTokensMinted: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'liquidity_provided',
                fromAddress: data.providerAddress,
                toAddress: data.assetAddress,
                amount: data.amount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    assetAddress: data.assetAddress,
                    lpTokensMinted: data.lpTokensMinted
                })
            })
            console.log(`[TransactionRecording] Recorded liquidity provision: ${data.providerAddress} -> ${data.assetAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record liquidity provision:', error)
        }
    }

    /**
     * Record a liquidity withdrawal transaction
     */
    async recordLiquidityWithdrawn(data: {
        providerAddress: string
        assetAddress: string
        lpTokenAmount: number
        usdcReceived: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'liquidity_withdrawn',
                fromAddress: data.assetAddress,
                toAddress: data.providerAddress,
                amount: data.usdcReceived,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    assetAddress: data.assetAddress,
                    lpTokenAmount: data.lpTokenAmount
                })
            })
            console.log(`[TransactionRecording] Recorded liquidity withdrawal: ${data.assetAddress} -> ${data.providerAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record liquidity withdrawal:', error)
        }
    }

    /**
     * Record a loan transaction
     */
    async recordLoan(data: {
        borrowerAddress: string
        assetAddress: string
        loanAmount: number
        collateralAmount: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'loan',
                fromAddress: data.assetAddress,
                toAddress: data.borrowerAddress,
                amount: data.loanAmount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    assetAddress: data.assetAddress,
                    collateralAmount: data.collateralAmount
                })
            })
            console.log(`[TransactionRecording] Recorded loan: ${data.assetAddress} -> ${data.borrowerAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record loan:', error)
        }
    }

    /**
     * Record a loan repayment transaction
     */
    async recordLoanRepayment(data: {
        borrowerAddress: string
        assetAddress: string
        repaymentAmount: number
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'loan_repayment',
                fromAddress: data.borrowerAddress,
                toAddress: data.assetAddress,
                amount: data.repaymentAmount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: 'completed',
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    assetAddress: data.assetAddress
                })
            })
            console.log(`[TransactionRecording] Recorded loan repayment: ${data.borrowerAddress} -> ${data.assetAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record loan repayment:', error)
        }
    }

    /**
     * Record a withdrawal request transaction
     */
    async recordWithdrawal(data: {
        holderAddress: string
        amount: number
        status: 'pending' | 'completed' | 'failed'
        withdrawalId: string
        transactionHash?: string
    }) {
        try {
            await db.insert(transactionHistory).values({
                id: this.generateTransactionId(),
                type: 'withdrawal',
                fromAddress: 'platform',
                toAddress: data.holderAddress,
                amount: data.amount,
                asset: 'USDC',
                transactionHash: data.transactionHash || null,
                status: data.status,
                timestamp: Date.now(),
                metadata: JSON.stringify({
                    withdrawalId: data.withdrawalId
                })
            })
            console.log(`[TransactionRecording] Recorded withdrawal: platform -> ${data.holderAddress}`)
        } catch (error) {
            console.error('[TransactionRecording] Failed to record withdrawal:', error)
        }
    }
}

// Export singleton instance
export const transactionRecorder = new TransactionRecordingService()
