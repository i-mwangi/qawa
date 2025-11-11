import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

async function runMigration() {
  console.log('Running migration with Turso...\n');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }
  
  console.log('URL:', url);
  console.log('Token exists:', !!token);
  
  try {
    const client = createClient({
      url,
      authToken: token
    });
    
    const db = drizzle(client);
    
    console.log('\nApplying migrations from ./db/migrations...');
    await migrate(db, { migrationsFolder: './db/migrations' });
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
