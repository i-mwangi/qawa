/**
 * Sync schema to Turso by creating all missing tables
 * Uses drizzle-kit push with proper error handling
 */
import 'dotenv/config';
import { execSync } from 'child_process';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  process.exit(1);
}

console.log('🚀 Syncing schema to Turso using drizzle-kit push...\n');
console.log('📍 Database:', tursoUrl);
console.log('🔑 Token exists:', !!tursoToken);
console.log();

try {
  // Use drizzle-kit push with --force to skip confirmation
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Ensure Turso credentials are set
      TURSO_DATABASE_URL: tursoUrl,
      TURSO_AUTH_TOKEN: tursoToken
    }
  });
  
  console.log('\n✅ Schema synced to Turso successfully!');
} catch (error: any) {
  console.error('\n❌ Failed to sync schema');
  console.error('Error:', error.message);
  
  console.log('\n💡 Troubleshooting tips:');
  console.log('1. Verify your Turso credentials are correct');
  console.log('2. Check if your Turso database is accessible');
  console.log('3. Try regenerating your Turso auth token');
  console.log('4. Run: npx tsx scripts/test-turso-connection.ts');
  
  process.exit(1);
}
