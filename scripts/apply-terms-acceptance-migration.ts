import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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
    console.log('🔄 Applying Terms Acceptance Migration...\n');

    const client = createClient({
        url: TURSO_DATABASE_URL!,
        authToken: TURSO_AUTH_TOKEN!,
    });

    try {
        // Read the migration file
        const migrationPath = path.join(process.cwd(), 'db/migrations/0010_add_terms_acceptance.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        // Split by semicolons and filter out empty statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            console.log(`SQL: ${statement.substring(0, 80)}...`);

            try {
                await client.execute(statement);
                console.log(`✅ Statement ${i + 1} executed successfully\n`);
            } catch (error: any) {
                // Check if error is about column already existing
                if (error.message && error.message.includes('duplicate column name')) {
                    console.log(`⚠️  Column already exists, skipping...\n`);
                } else {
                    throw error;
                }
            }
        }

        // Verify the migration
        console.log('🔍 Verifying migration...\n');

        // Check farmers table
        const farmersSchema = await client.execute(`PRAGMA table_info(farmers)`);
        const farmersColumns = farmersSchema.rows.map((row: any) => row.name);
        console.log('Farmers table columns:', farmersColumns);

        const farmersHasTerms = farmersColumns.includes('terms_accepted_at') &&
            farmersColumns.includes('terms_version') &&
            farmersColumns.includes('terms_ip_address');

        if (farmersHasTerms) {
            console.log('✅ Farmers table: Terms acceptance fields added');
        } else {
            console.log('❌ Farmers table: Missing some terms acceptance fields');
        }

        // Check investor_profiles table
        const investorSchema = await client.execute(`PRAGMA table_info(investor_profiles)`);
        const investorColumns = investorSchema.rows.map((row: any) => row.name);
        console.log('\nInvestor Profiles table columns:', investorColumns);

        const investorHasTerms = investorColumns.includes('terms_accepted_at') &&
            investorColumns.includes('terms_version') &&
            investorColumns.includes('terms_ip_address');

        if (investorHasTerms) {
            console.log('✅ Investor Profiles table: Terms acceptance fields added');
        } else {
            console.log('❌ Investor Profiles table: Missing some terms acceptance fields');
        }

        if (farmersHasTerms && investorHasTerms) {
            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log('\n⚠️  Migration completed with warnings');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

applyMigration();
