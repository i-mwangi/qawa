#!/usr/bin/env node
/**
 * Apply Investor Withdrawals Migration
 * 
 * This script applies the migration to add:
 * - investor_withdrawals table
 * - payment tracking fields to revenue_distributions table
 */

import { readFileSync } from 'fs';
import { createClient } from '@libsql/client';
import 'dotenv/config';

const MIGRATION_FILE = './db/migrations/0005_add_investor_withdrawals.sql';

async function applyMigration() {
    console.log('🔄 Applying investor withdrawals migration...\n');
    
    try {
        // Connect to Turso database
        const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
        const tursoToken = process.env.TURSO_AUTH_TOKEN;

        if (!tursoUrl) {
            throw new Error('TURSO_DATABASE_URL or DATABASE_URL is required');
        }

        const client = createClient({
            url: tursoUrl,
            authToken: tursoToken
        });
        
        // Read migration SQL
        const migrationSQL = readFileSync(MIGRATION_FILE, 'utf-8');
        
        console.log('📄 Migration file:', MIGRATION_FILE);
        console.log('🔗 Database:', tursoUrl);
        console.log('\n📝 Executing migration SQL...\n');
        
        // Split SQL into individual statements
        // First remove all comment lines, then split by semicolon
        const cleanedSQL = migrationSQL
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');
        
        const statements = cleanedSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        console.log(`Found ${statements.length} statements to execute\n`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    console.log(`[${i + 1}/${statements.length}] Executing:`, statement.substring(0, 80) + '...');
                    await client.execute(statement);
                    console.log('✅ Executed successfully\n');
                } catch (error: any) {
                    // Ignore "duplicate column" errors for ALTER TABLE ADD COLUMN
                    if (error.message && error.message.includes('duplicate column name')) {
                        console.log('⚠️  Column already exists, skipping\n');
                    } else if (error.message && error.message.includes('already exists')) {
                        console.log('⚠️  Object already exists, skipping\n');
                    } else if (error.message && error.message.includes('no such column')) {
                        console.log('⚠️  Column does not exist (table may need to be created first), skipping\n');
                    } else {
                        console.error('❌ Failed statement:', statement);
                        throw error;
                    }
                }
            }
        }
        
        client.close();
        
        console.log('\n✅ Migration applied successfully!');
        console.log('\n📊 New tables and columns:');
        console.log('  - investor_withdrawals table');
        console.log('  - revenue_distributions.payment_status');
        console.log('  - revenue_distributions.transaction_id');
        console.log('  - revenue_distributions.paid_at');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

applyMigration();
