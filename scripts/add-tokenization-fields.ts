/**
 * Add tokenization fields to coffee_groves table
 * Run this to update your Turso database schema
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function addTokenizationFields() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!
    });

    console.log('🔄 Adding tokenization fields to coffee_groves table...');

    try {
        // Add token_symbol column
        await client.execute(`
            ALTER TABLE coffee_groves 
            ADD COLUMN token_symbol TEXT;
        `);
        console.log('✅ Added token_symbol column');
    } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
            console.log('ℹ️  token_symbol column already exists');
        } else {
            console.error('❌ Error adding token_symbol:', error.message);
        }
    }

    try {
        // Add is_tokenized column
        await client.execute(`
            ALTER TABLE coffee_groves 
            ADD COLUMN is_tokenized INTEGER DEFAULT 0;
        `);
        console.log('✅ Added is_tokenized column');
    } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
            console.log('ℹ️  is_tokenized column already exists');
        } else {
            console.error('❌ Error adding is_tokenized:', error.message);
        }
    }

    try {
        // Add tokenized_at column
        await client.execute(`
            ALTER TABLE coffee_groves 
            ADD COLUMN tokenized_at INTEGER;
        `);
        console.log('✅ Added tokenized_at column');
    } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
            console.log('ℹ️  tokenized_at column already exists');
        } else {
            console.error('❌ Error adding tokenized_at:', error.message);
        }
    }

    // Verify the schema
    console.log('\n📋 Verifying schema...');
    const result = await client.execute(`
        PRAGMA table_info(coffee_groves);
    `);

    console.log('\n✅ Current coffee_groves schema:');
    result.rows.forEach((row: any) => {
        console.log(`  - ${row.name} (${row.type})`);
    });

    console.log('\n✅ Migration complete!');
    process.exit(0);
}

addTokenizationFields().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
