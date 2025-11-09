/**
 * Add tokensSold field to coffee_groves table
 * This migration adds the tokensSold field and creates necessary indexes
 * Run this to update your Turso database schema
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function addTokensSoldField() {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
        console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
        process.exit(1);
    }

    const client = createClient({
        url: tursoUrl,
        authToken: tursoToken
    });

    console.log('🔄 Adding tokensSold field to coffee_groves table...');
    console.log('📍 Database:', tursoUrl);
    console.log();

    try {
        // Add tokens_sold column with default value 0
        await client.execute(`
            ALTER TABLE coffee_groves 
            ADD COLUMN tokens_sold INTEGER DEFAULT 0 NOT NULL;
        `);
        console.log('✅ Added tokens_sold column with default value 0');
    } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
            console.log('ℹ️  tokens_sold column already exists');
        } else {
            console.error('❌ Error adding tokens_sold:', error.message);
            throw error;
        }
    }

    try {
        // Set default value 0 for any existing groves that might have NULL
        await client.execute(`
            UPDATE coffee_groves 
            SET tokens_sold = 0 
            WHERE tokens_sold IS NULL;
        `);
        console.log('✅ Set default value 0 for existing groves');
    } catch (error: any) {
        console.error('❌ Error updating existing groves:', error.message);
        // Don't throw - this is not critical if column was just created
    }

    try {
        // Create index on tokens_sold for performance
        await client.execute(`
            CREATE INDEX IF NOT EXISTS coffee_groves_tokens_sold_idx 
            ON coffee_groves(tokens_sold);
        `);
        console.log('✅ Created index on tokens_sold');
    } catch (error: any) {
        console.error('❌ Error creating tokens_sold index:', error.message);
        // Don't throw - index might already exist
    }

    // Verify existing indexes on token_holdings table
    console.log('\n🔍 Verifying token_holdings indexes...');
    
    try {
        // Check if holder_address index exists
        const holderIndexResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' 
            AND tbl_name='token_holdings' 
            AND name='token_holdings_holder_address_idx';
        `);
        
        if (holderIndexResult.rows.length === 0) {
            await client.execute(`
                CREATE INDEX token_holdings_holder_address_idx 
                ON token_holdings(holder_address);
            `);
            console.log('✅ Created index on token_holdings.holder_address');
        } else {
            console.log('ℹ️  Index on token_holdings.holder_address already exists');
        }
    } catch (error: any) {
        console.error('❌ Error with holder_address index:', error.message);
    }

    try {
        // Check if grove_id index exists
        const groveIndexResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' 
            AND tbl_name='token_holdings' 
            AND name='token_holdings_grove_id_idx';
        `);
        
        if (groveIndexResult.rows.length === 0) {
            await client.execute(`
                CREATE INDEX token_holdings_grove_id_idx 
                ON token_holdings(grove_id);
            `);
            console.log('✅ Created index on token_holdings.grove_id');
        } else {
            console.log('ℹ️  Index on token_holdings.grove_id already exists');
        }
    } catch (error: any) {
        console.error('❌ Error with grove_id index:', error.message);
    }

    // Verify the schema
    console.log('\n📋 Verifying coffee_groves schema...');
    const result = await client.execute(`
        PRAGMA table_info(coffee_groves);
    `);

    const tokensSoldColumn = result.rows.find((row: any) => row.name === 'tokens_sold');
    if (tokensSoldColumn) {
        console.log('✅ tokens_sold column verified:');
        console.log(`   Type: ${tokensSoldColumn.type}`);
        console.log(`   Default: ${tokensSoldColumn.dflt_value}`);
        console.log(`   Not Null: ${tokensSoldColumn.notnull === 1 ? 'Yes' : 'No'}`);
    } else {
        console.error('❌ tokens_sold column not found in schema!');
        process.exit(1);
    }

    // Verify indexes
    console.log('\n📋 Verifying indexes...');
    const indexResult = await client.execute(`
        SELECT name, tbl_name 
        FROM sqlite_master 
        WHERE type='index' 
        AND (
            name LIKE '%tokens_sold%' 
            OR (tbl_name='token_holdings' AND (name LIKE '%holder_address%' OR name LIKE '%grove_id%'))
        )
        ORDER BY tbl_name, name;
    `);

    console.log('✅ Current indexes:');
    indexResult.rows.forEach((row: any) => {
        console.log(`   - ${row.tbl_name}.${row.name}`);
    });

    console.log('\n✅ Migration complete!');
    console.log('\n📊 Summary:');
    console.log('   - Added tokens_sold field to coffee_groves table');
    console.log('   - Set default value 0 for existing groves');
    console.log('   - Created/verified performance indexes');
    
    process.exit(0);
}

addTokensSoldField().catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
});
