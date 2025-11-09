import "dotenv/config"
import { defineConfig } from 'drizzle-kit';

const DB_URL = process.env.DB_URL!
const NETWORK = process.env.NETWORK
const USE_TURSO = !!(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL?.startsWith('libsql://'))

console.log('Drizzle Config - USE_TURSO:', USE_TURSO);
console.log('Drizzle Config - TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL);
console.log('Drizzle Config - Token exists:', !!process.env.TURSO_AUTH_TOKEN);

export default defineConfig({
  out: './db/migrations',
  schema: ['./db/schema/index.ts', './db/schema/earnings-distribution.ts'],
  dialect: 'sqlite',
  dbCredentials: USE_TURSO ? {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN
  } : {
    url: "./local-store/sqlite/sqlite.db"
  },
});