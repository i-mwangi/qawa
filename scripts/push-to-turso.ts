/**
 * Push database schema to Turso
 * This script uses drizzle-kit push to sync the schema directly to Turso
 */
import 'dotenv/config';
import { execSync } from 'child_process';

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  console.error('❌ TURSO_DATABASE_URL or DATABASE_URL is required');
  process.exit(1);
}

console.log('🚀 Pushing schema to Turso...');
console.log('📍 Database:', tursoUrl.replace(/:[^:]*@/, ':***@')); // Hide token in URL

try {
  // Use drizzle-kit push to sync schema to Turso
  execSync('npx drizzle-kit push', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: tursoUrl,
      TURSO_DATABASE_URL: tursoUrl,
      TURSO_AUTH_TOKEN: tursoToken
    }
  });
  
  console.log('✅ Schema pushed to Turso successfully!');
} catch (error) {
  console.error('❌ Failed to push schema:', error);
  process.exit(1);
}
