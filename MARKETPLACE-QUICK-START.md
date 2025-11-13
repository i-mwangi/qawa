# Marketplace Quick Start 🚀

Get your peer-to-peer marketplace running in 5 minutes!

## Prerequisites

- [ ] Node.js installed
- [ ] Hedera testnet account
- [ ] USDC token configured
- [ ] At least one tokenized grove

## Quick Setup

### 1. Compile Contracts (1 min)

```bash
npx hardhat compile
```

### 2. Deploy Marketplace (2 min)

```bash
npx tsx scripts/deploy-marketplace.ts
```

Copy the contract ID from output and verify it's in your `.env`:

```env
MARKETPLACE_CONTRACT_ID=0.0.XXXXXXX
```

### 3. Test Integration (1 min)

```bash
npx tsx scripts/test-marketplace.ts
```

Should see: ✅ All marketplace tests passed!

### 4. Start Dev Server (1 min)

```bash
npm run dev
```

Open: http://localhost:3000

### 5. Test in Browser (2 min)

1. Connect wallet
2. Go to "Marketplace" section
3. See mock listings
4. Try creating a listing (will need token association)

## That's It! 🎉

Your marketplace is wired and ready.

## Next Steps

### For Full Functionality:

1. **Associate Tokens:**
   - Marketplace needs USDC association
   - Marketplace needs grove token associations

2. **Create Real Listings:**
   - Go to Portfolio
   - Click "List for Sale" on a grove
   - Fill in details and confirm

3. **Test Purchases:**
   - Browse marketplace
   - Click "Buy Tokens"
   - Confirm purchase

## Quick Commands

```bash
# Deploy
npx tsx scripts/deploy-marketplace.ts

# Test
npx tsx scripts/test-marketplace.ts

# Start dev
npm run dev

# Compile contracts
npx hardhat compile
```

## Quick Links

- **Setup Guide:** `docs/MARKETPLACE-SETUP-GUIDE.md`
- **Full Docs:** `docs/MARKETPLACE-IMPLEMENTATION.md`
- **Completion Report:** `docs/MARKETPLACE-WIRING-COMPLETE.md`

## Troubleshooting

**"Contract not configured"**
→ Run deploy script and check .env

**"TOKEN_NOT_ASSOCIATED"**
→ Associate token in HashPack wallet

**"Mock data showing"**
→ Normal until contract is fully configured

## Support

Check the docs folder for detailed guides!

---

**Ready to trade!** 🌳☕💰
