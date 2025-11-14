import { db } from '../db/index.js';

async function applyMigration() {
    console.log('🔄 Applying Terms Acceptance Migration...\n');

    try {
        // Add fields to farmers table
        console.log('Adding fields to farmers table...');
        try {
            await db.run('ALTER TABLE farmers ADD COLUMN terms_accepted_at INTEGER');
            console.log('✅ Added terms_accepted_at to farmers');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_accepted_at already exists in farmers');
            } else throw e;
        }

        try {
            await db.run('ALTER TABLE farmers ADD COLUMN terms_version TEXT');
            console.log('✅ Added terms_version to farmers');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_version already exists in farmers');
            } else throw e;
        }

        try {
            await db.run('ALTER TABLE farmers ADD COLUMN terms_ip_address TEXT');
            console.log('✅ Added terms_ip_address to farmers');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_ip_address already exists in farmers');
            } else throw e;
        }

        // Add fields to investor_profiles table
        console.log('\nAdding fields to investor_profiles table...');
        try {
            await db.run('ALTER TABLE investor_profiles ADD COLUMN terms_accepted_at INTEGER');
            console.log('✅ Added terms_accepted_at to investor_profiles');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_accepted_at already exists in investor_profiles');
            } else throw e;
        }

        try {
            await db.run('ALTER TABLE investor_profiles ADD COLUMN terms_version TEXT');
            console.log('✅ Added terms_version to investor_profiles');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_version already exists in investor_profiles');
            } else throw e;
        }

        try {
            await db.run('ALTER TABLE investor_profiles ADD COLUMN terms_ip_address TEXT');
            console.log('✅ Added terms_ip_address to investor_profiles');
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                console.log('⚠️  terms_ip_address already exists in investor_profiles');
            } else throw e;
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyMigration();
