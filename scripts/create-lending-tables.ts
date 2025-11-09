/**
 * Create missing lending and core platform tables in Turso
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

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

console.log('🚀 Creating missing lending and core tables...\n');

const tablesToCreate = [
  // kyc table
  `CREATE TABLE IF NOT EXISTS kyc (
    account TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL,
    FOREIGN KEY (token) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS kyc_account_unique ON kyc(account)`,
  
  // transactions table
  `CREATE TABLE IF NOT EXISTS transactions (
    hash TEXT PRIMARY KEY NOT NULL,
    account TEXT NOT NULL,
    token TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    timestamp REAL NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS transactions_hash_unique ON transactions(hash)`,
  
  // prices table
  `CREATE TABLE IF NOT EXISTS prices (
    id TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL,
    price REAL NOT NULL,
    timestamp REAL NOT NULL,
    FOREIGN KEY (token) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prices_id_unique ON prices(id)`,
  
  // lendingReserves table
  `CREATE TABLE IF NOT EXISTS lendingReserves (
    token TEXT PRIMARY KEY NOT NULL,
    asset TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timestamp REAL NOT NULL,
    FOREIGN KEY (asset) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lendingReserves_token_unique ON lendingReserves(token)`,
  
  // loans table
  `CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY NOT NULL,
    account TEXT NOT NULL,
    collateralAsset TEXT NOT NULL,
    loanAmountUSDC REAL NOT NULL,
    collateralAmount REAL NOT NULL,
    liquidationPrice REAL NOT NULL,
    repaymentAmount REAL NOT NULL,
    timestamp REAL NOT NULL,
    deadline REAL NOT NULL,
    isActive INTEGER DEFAULT 1 NOT NULL,
    isRepaid INTEGER DEFAULT 0 NOT NULL,
    FOREIGN KEY (collateralAsset) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS loans_id_unique ON loans(id)`,
  `CREATE INDEX IF NOT EXISTS loans_account_idx ON loans(account)`,
  `CREATE INDEX IF NOT EXISTS loans_is_active_idx ON loans(isActive)`,
  
  // liquidations table
  `CREATE TABLE IF NOT EXISTS liquidations (
    id TEXT PRIMARY KEY NOT NULL,
    loanId TEXT NOT NULL,
    account TEXT NOT NULL,
    timestamp REAL NOT NULL,
    FOREIGN KEY (loanId) REFERENCES loans(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS liquidations_id_unique ON liquidations(id)`,
  
  // loanRepayment table
  `CREATE TABLE IF NOT EXISTS loanRepayment (
    id TEXT PRIMARY KEY NOT NULL,
    loanId TEXT NOT NULL,
    token TEXT NOT NULL,
    account TEXT NOT NULL,
    timestamp REAL NOT NULL,
    paymentCategory TEXT NOT NULL,
    daysEarlyLate REAL NOT NULL,
    loanDuration REAL NOT NULL,
    deadline REAL NOT NULL,
    FOREIGN KEY (loanId) REFERENCES loans(id),
    FOREIGN KEY (token) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS loanRepayment_id_unique ON loanRepayment(id)`,
  `CREATE INDEX IF NOT EXISTS loan_repayment_account_idx ON loanRepayment(account)`,
  `CREATE INDEX IF NOT EXISTS loan_repayment_loan_idx ON loanRepayment(loanId)`,
  
  // providedLiquidity table
  `CREATE TABLE IF NOT EXISTS providedLiquidity (
    id TEXT PRIMARY KEY NOT NULL,
    asset TEXT NOT NULL,
    amount REAL NOT NULL,
    account TEXT NOT NULL,
    timestamp REAL NOT NULL,
    FOREIGN KEY (asset) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS providedLiquidity_id_unique ON providedLiquidity(id)`,
  
  // withdrawnLiquidity table
  `CREATE TABLE IF NOT EXISTS withdrawnLiquidity (
    id TEXT PRIMARY KEY NOT NULL,
    asset TEXT NOT NULL,
    amount REAL NOT NULL,
    account TEXT NOT NULL,
    timestamp REAL NOT NULL,
    FOREIGN KEY (asset) REFERENCES assets(token)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS withdrawnLiquidity_id_unique ON withdrawnLiquidity(id)`,
  
  // realwordAssetTimeseries table
  `CREATE TABLE IF NOT EXISTS realwordAssetTimeseries (
    id TEXT PRIMARY KEY NOT NULL,
    open REAL NOT NULL,
    close REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    net REAL NOT NULL,
    gross REAL NOT NULL,
    timestamp REAL NOT NULL,
    asset TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS realwordAssetTimeseries_id_unique ON realwordAssetTimeseries(id)`,
  
  // token_holdings table
  `CREATE TABLE IF NOT EXISTS token_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    holderAddress TEXT NOT NULL,
    groveId INTEGER NOT NULL,
    tokenAmount INTEGER NOT NULL,
    purchasePrice INTEGER NOT NULL,
    purchaseDate INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    FOREIGN KEY (groveId) REFERENCES coffee_groves(id)
  )`,
  `CREATE INDEX IF NOT EXISTS token_holdings_holder_address_idx ON token_holdings(holderAddress)`,
  `CREATE INDEX IF NOT EXISTS token_holdings_grove_id_idx ON token_holdings(groveId)`,
  `CREATE INDEX IF NOT EXISTS token_holdings_is_active_idx ON token_holdings(isActive)`,
  
  // revenue_distributions table
  `CREATE TABLE IF NOT EXISTS revenue_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    harvestId INTEGER NOT NULL,
    holderAddress TEXT NOT NULL,
    tokenAmount INTEGER NOT NULL,
    revenueShare INTEGER NOT NULL,
    distributionDate INTEGER NOT NULL,
    transactionHash TEXT,
    FOREIGN KEY (harvestId) REFERENCES harvest_records(id)
  )`,
  
  // market_alerts table
  `CREATE TABLE IF NOT EXISTS market_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    farmerAddress TEXT NOT NULL,
    alertType TEXT NOT NULL,
    variety INTEGER NOT NULL,
    grade INTEGER NOT NULL,
    currentPrice INTEGER NOT NULL,
    previousPrice INTEGER NOT NULL,
    changePercent INTEGER NOT NULL,
    message TEXT NOT NULL,
    sentAt INTEGER NOT NULL,
    channel TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0
  )`
];

async function createTables() {
  try {
    let created = 0;
    let skipped = 0;

    for (const sql of tablesToCreate) {
      try {
        await client.execute(sql);
        if (sql.includes('CREATE TABLE')) {
          const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
          if (match) {
            console.log(`✅ Created/verified: ${match[1]}`);
            created++;
          }
        }
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          skipped++;
        } else {
          console.error(`⚠️  Error:`, error.message.substring(0, 100));
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Created/verified: ${created}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);

    // Verify final state
    const result = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    console.log(`\n✅ Total tables in database: ${result.rows.length}`);
    console.log('\n📋 All tables:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

createTables();
