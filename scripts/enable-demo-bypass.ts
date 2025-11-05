import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { db } from '../db'
import { userSettings } from '../db/schema'

// This script sets demoBypass = 1 for a provided account (EVM or Hedera ID)
// Usage: pnpm tsx scripts/enable-demo-bypass.ts <accountId>

async function main() {
  const account = process.argv[2]
  if (!account) {
    console.error('Usage: pnpm tsx scripts/enable-demo-bypass.ts <account>')
    process.exit(1)
  }

  // The project uses drizzle + sqlite in db/index.ts; we'll call the exported db API
  try {
    const existing = await db.query.userSettings.findFirst({ where: (userSettings.account as any).eq(account) })
    if (existing) {
      await db.update(userSettings).set({ demoBypass: 1 }).where((userSettings.account as any).eq(account))
      console.log(`Updated demoBypass=1 for ${account}`)
    } else {
      await db.insert(userSettings).values({ account, demoBypass: 1 })
      console.log(`Inserted demoBypass=1 for ${account}`)
    }
    process.exit(0)
  } catch (e) {
    console.error('Error:', e)
    process.exit(2)
  }
}

main()
