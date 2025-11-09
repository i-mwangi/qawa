/**
 * Manual migration script for credit scoring tables
 * Run this to add credit scoring support to existing database
 */

import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'

async function applyCreditScoringMigration() {
    console.log('Starting credit scoring migration...')
    
    try {
        // 1. Create creditScores table
        console.log('Creating creditScores table...')
        await db.run(sql`
            CREATE TABLE IF NOT EXISTS creditScores (
                account text PRIMARY KEY NOT NULL,
                currentScore integer DEFAULT 500 NOT NULL,
                totalLoans integer DEFAULT 0 NOT NULL,
                onTimePayments integer DEFAULT 0 NOT NULL,
                earlyPayments integer DEFAULT 0 NOT NULL,
                latePayments integer DEFAULT 0 NOT NULL,
                lastUpdated real NOT NULL,
                createdAt real NOT NULL
            )
        `)
        
        await db.run(sql`CREATE INDEX IF NOT EXISTS credit_scores_account_idx ON creditScores (account)`)
        await db.run(sql`CREATE INDEX IF NOT EXISTS credit_scores_score_idx ON creditScores (currentScore)`)
        
        // 2. Add new columns to loans table
        console.log('Adding columns to loans table...')
        try {
            await db.run(sql`ALTER TABLE loans ADD COLUMN deadline real NOT NULL DEFAULT 0`)
        } catch (e) {
            console.log('  deadline column already exists or error:', e.message)
        }
        
        try {
            await db.run(sql`ALTER TABLE loans ADD COLUMN isActive integer DEFAULT 1 NOT NULL`)
        } catch (e) {
            console.log('  isActive column already exists or error:', e.message)
        }
        
        try {
            await db.run(sql`ALTER TABLE loans ADD COLUMN isRepaid integer DEFAULT 0 NOT NULL`)
        } catch (e) {
            console.log('  isRepaid column already exists or error:', e.message)
        }
        
        // 3. Add new columns to loanRepayment table
        console.log('Adding columns to loanRepayment table...')
        try {
            await db.run(sql`ALTER TABLE loanRepayment ADD COLUMN paymentCategory text NOT NULL DEFAULT 'on_time'`)
        } catch (e) {
            console.log('  paymentCategory column already exists or error:', e.message)
        }
        
        try {
            await db.run(sql`ALTER TABLE loanRepayment ADD COLUMN daysEarlyLate real NOT NULL DEFAULT 0`)
        } catch (e) {
            console.log('  daysEarlyLate column already exists or error:', e.message)
        }
        
        try {
            await db.run(sql`ALTER TABLE loanRepayment ADD COLUMN loanDuration real NOT NULL DEFAULT 30`)
        } catch (e) {
            console.log('  loanDuration column already exists or error:', e.message)
        }
        
        try {
            await db.run(sql`ALTER TABLE loanRepayment ADD COLUMN deadline real NOT NULL DEFAULT 0`)
        } catch (e) {
            console.log('  deadline column already exists or error:', e.message)
        }
        
        // 4. Create indexes for new columns
        console.log('Creating indexes...')
        try {
            await db.run(sql`CREATE INDEX IF NOT EXISTS loans_account_idx ON loans (account)`)
            await db.run(sql`CREATE INDEX IF NOT EXISTS loans_is_active_idx ON loans (isActive)`)
            await db.run(sql`CREATE INDEX IF NOT EXISTS loan_repayment_account_idx ON loanRepayment (account)`)
            await db.run(sql`CREATE INDEX IF NOT EXISTS loan_repayment_loan_idx ON loanRepayment (loanId)`)
        } catch (e) {
            console.log('  Index creation error (may already exist):', e.message)
        }
        
        console.log('✅ Credit scoring migration completed successfully!')
        console.log('\nNext steps:')
        console.log('1. Update your lender.indexer.ts file')
        console.log('2. Create API endpoints for credit scores')
        console.log('3. Add frontend components')
        
    } catch (error) {
        console.error('❌ Migration failed:', error)
        throw error
    }
}

applyCreditScoringMigration()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
