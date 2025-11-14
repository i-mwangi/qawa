/**
 * Apply Milestone-Based Funding System Migrations
 * 
 * This script applies the database migrations for the funding request system:
 * - grove_funding_pools
 * - funding_requests
 * - funding_request_documents
 * - platform_fees
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigrations() {
    console.log('🚀 Starting Milestone-Based Funding System migrations...\n');

    // Create Turso client
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL || '',
        authToken: process.env.TURSO_AUTH_TOKEN || ''
    });

    const migrations = [
        '0006_add_grove_funding_pools.sql',
        '0007_add_funding_requests.sql',
        '0008_add_funding_request_documents.sql',
        '0009_add_platform_fees.sql'
    ];

    try {
        for (const migrationFile of migrations) {
            console.log(`📄 Applying migration: ${migrationFile}`);
            
            const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
            const sql = fs.readFileSync(migrationPath, 'utf-8');
            
            // Remove comments and split by semicolon
            const cleanedSql = sql
                .split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n');
            
            const statements = cleanedSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            
            for (const statement of statements) {
                try {
                    await client.execute(statement);
                } catch (err: any) {
                    // Ignore "already exists" errors
                    if (!err.message.includes('already exists')) {
                        throw err;
                    }
                }
            }
            
            console.log(`✅ Applied: ${migrationFile}\n`);
        }

        console.log('🎉 All migrations applied successfully!');
        console.log('\nNew tables created:');
        console.log('  - grove_funding_pools');
        console.log('  - funding_requests');
        console.log('  - funding_request_documents');
        console.log('  - platform_fees');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

// Run migrations
applyMigrations()
    .then(() => {
        console.log('\n✨ Migration process completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration process failed:', error);
        process.exit(1);
    });
