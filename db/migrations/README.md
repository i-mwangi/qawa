# Database Migrations

This directory contains SQL migration files for the Coffee Chain platform database.

## Migration Files

### 0005_add_investor_withdrawals.sql

**Created:** 2025-11-09  
**Status:** ✅ Applied to production (Turso)

**Description:**  
Adds investor withdrawal functionality and payment tracking to the platform.

**Changes:**
- Creates `investor_withdrawals` table for tracking investor earnings withdrawals
- Adds payment tracking fields to `revenue_distributions` table:
  - `payment_status` - Status of USDC payment ('pending' | 'completed' | 'failed')
  - `transaction_id` - Hedera transaction ID
  - `paid_at` - Timestamp when payment was completed
- Creates indexes for efficient querying:
  - `investor_withdrawals_investor_idx` - Query by investor address
  - `investor_withdrawals_status_idx` - Query by withdrawal status
  - `investor_withdrawals_requested_idx` - Query by request time
  - `revenue_distributions_payment_status_idx` - Query by payment status

**Schema:**

```sql
-- Investor Withdrawals Table
CREATE TABLE investor_withdrawals (
    id TEXT PRIMARY KEY NOT NULL,
    investor_address TEXT NOT NULL,
    amount INTEGER NOT NULL,              -- Amount in cents
    status TEXT NOT NULL,                 -- 'pending' | 'completed' | 'failed'
    transaction_hash TEXT,
    transaction_id TEXT,
    block_explorer_url TEXT,
    error_message TEXT,
    requested_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Payment Tracking Fields (added to revenue_distributions)
ALTER TABLE revenue_distributions ADD COLUMN payment_status TEXT;
ALTER TABLE revenue_distributions ADD COLUMN transaction_id TEXT;
ALTER TABLE revenue_distributions ADD COLUMN paid_at INTEGER;
```

## Applying Migrations

### Production (Turso)

```bash
# Apply the investor withdrawals migration
npx tsx scripts/apply-investor-withdrawals-migration.ts

# Validate the schema
npx tsx scripts/validate-investor-withdrawal-schema.ts

# Check table structures
npx tsx scripts/check-investor-withdrawals-table.ts
npx tsx scripts/check-revenue-distributions-table.ts
```

### Local Development (SQLite)

```bash
# Test migration on local database
npx tsx scripts/test-local-migration.ts
```

**Note:** Local SQLite testing requires `better-sqlite3` native bindings. If unavailable, test on Turso instead.

## Validation Scripts

### validate-investor-withdrawal-schema.ts
Comprehensive validation that checks:
- Table existence
- All required columns
- All required indexes
- Database operations (INSERT, SELECT, UPDATE, DELETE)

### check-investor-withdrawals-table.ts
Quick check of the investor_withdrawals table structure and row count.

### check-revenue-distributions-table.ts
Quick check of the revenue_distributions table structure and payment tracking fields.

## Migration Status

| Migration | Status | Applied Date | Notes |
|-----------|--------|--------------|-------|
| 0005_add_investor_withdrawals.sql | ✅ Applied | 2025-11-09 | Production ready |

## Rollback Plan

If issues arise with the investor withdrawals feature:

1. The migration is **additive only** - it doesn't modify existing data
2. Payment tracking fields in `revenue_distributions` can be left NULL
3. The `investor_withdrawals` table can be dropped if needed:

```sql
DROP TABLE IF EXISTS investor_withdrawals;
ALTER TABLE revenue_distributions DROP COLUMN payment_status;
ALTER TABLE revenue_distributions DROP COLUMN transaction_id;
ALTER TABLE revenue_distributions DROP COLUMN paid_at;
```

**Note:** SQLite doesn't support `DROP COLUMN` directly. To remove columns, you would need to:
1. Create a new table without those columns
2. Copy data from old table to new table
3. Drop old table and rename new table

## Related Files

- **Schema Definition:** `db/schema/index.ts`
- **Services:**
  - `lib/services/investor-withdrawal-service.ts`
  - `lib/api/hedera-payment-service.ts`
  - `lib/services/revenue-distribution-service.ts`
- **API Endpoints:** `api/index.ts`
  - `GET /investor/balance/:address`
  - `POST /investor/withdraw`
  - `GET /investor/withdrawals/:address`

## Testing

After applying the migration, verify functionality:

1. **Balance Calculation:**
   ```bash
   curl http://localhost:3000/investor/balance/0.0.1234567
   ```

2. **Withdrawal Processing:**
   ```bash
   curl -X POST http://localhost:3000/investor/withdraw \
     -H "Content-Type: application/json" \
     -d '{"investorAddress":"0.0.1234567","amount":100.00}'
   ```

3. **Withdrawal History:**
   ```bash
   curl http://localhost:3000/investor/withdrawals/0.0.1234567
   ```

## Environment Variables

Required for investor withdrawal functionality:

```env
# Hedera Configuration
HEDERA_OPERATOR_ID=0.0.5792828
HEDERA_OPERATOR_KEY=your_private_key
HEDERA_USDC_TOKEN_ID=0.0.7144320

# Database Configuration
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_auth_token
```

## Support

For issues or questions about this migration:
1. Check validation script output
2. Review error logs in the console
3. Verify environment variables are set correctly
4. Ensure Hedera operator account has sufficient USDC balance
