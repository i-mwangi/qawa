/**
 * Apply Lending System Migration
 * Creates all necessary tables for the lending/loan system
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('❌ Missing required environment variables:');
    console.error('   TURSO_DATABASE_URL:', TURSO_DATABASE_URL ? '✓' : '✗');
    console.error('   TURSO_AUTH_TOKEN:', TURSO_AUTH_TOKEN ? '✓' : '✗');
    process.exit(1);
}

async function applyMigration() {
    console.log('🚀 Starting Lending System Migration...\n');

    // Create Turso client
    const client = createClient({
        url: TURSO_DATABASE_URL!,
        authToken: TURSO_AUTH_TOKEN!
    });

    try {
        // Read migration file
        const migrationPath = path.join(process.cwd(), 'db/migrations/0011_add_lending_loans.sql');
        console.log('📄 Reading migration file:', migrationPath);
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        
        // Split into individual statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const preview = statement.substring(0, 60).replace(/\n/g, ' ');
            
            try {
                await client.execute(statement);
                successCount++;
                console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
            } catch (error: any) {
                if (error.message?.includes('already exists')) {
                    skipCount++;
                    console.log(`⏭️  [${i + 1}/${statements.length}] ${preview}... (already exists)`);
                } else {
                    errorCount++;
                    console.error(`❌ [${i + 1}/${statements.length}] ${preview}...`);
                    console.error(`   Error: ${error.message}`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log('='.repeat(60));
        console.log(`✅ Successfully executed: ${successCount}`);
        console.log(`⏭️  Skipped (already exists): ${skipCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        // Verify tables were created
        console.log('\n🔍 Verifying tables...\n');
        
        const tables = [
            'loans',
            'loan_collateral',
            'loan_payments',
            'liquidations',
            'loan_health_history',
            'lending_pool_stats'
        ];

        for (const table of tables) {
            try {
                const result = await client.execute(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
                );
                
                if (result.rows.length > 0) {
                    console.log(`✅ Table '${table}' exists`);
                } else {
                    console.log(`❌ Table '${table}' NOT FOUND`);
                }
            } catch (error: any) {
                console.error(`❌ Error checking table '${table}':`, error.message);
            }
        }

        // Check initial pool stats
        console.log('\n📊 Checking lending pool stats...\n');
        
        try {
            const poolStats = await client.execute('SELECT * FROM lending_pool_stats');
            console.log(`Found ${poolStats.rows.length} lending pool(s):`);
            
            for (const pool of poolStats.rows) {
                console.log(`\n  Pool: ${pool.asset_address}`);
                console.log(`  - Total Liquidity: ${pool.total_liquidity}`);
                console.log(`  - Available: ${pool.available_liquidity}`);
                console.log(`  - Total Borrowed: ${pool.total_borrowed}`);
                console.log(`  - Current APY: ${pool.current_apy}%`);
            }
        } catch (error: any) {
            console.error('❌ Error fetching pool stats:', error.message);
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Implement Hedera loan service');
        console.log('   2. Create loan management service');
        console.log('   3. Update API endpoints');
        console.log('   4. Test loan origination flow\n');

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run migration
applyMigration().catch(console.error);
