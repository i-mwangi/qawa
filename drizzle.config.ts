import "dotenv/config"
import { defineConfig } from 'drizzle-kit';

const DB_URL = process.env.DB_URL!
const NETWORK = process.env.NETWORK

export default defineConfig({
  out: './db/migrations',
  schema: './db/schema/index.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: "./local-store/sqlite/sqlite.db"
  },
});