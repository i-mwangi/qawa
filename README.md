# Chai Platform - Coffee Tree Tokenization Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hedera](https://img.shields.io/badge/Hedera-Testnet-blue)](https://hedera.com)
[![WalletConnect](https://img.shields.io/badge/WalletConnect-v2.0-blue)](https://walletconnect.com)


---

## 📋 Table of Contents
- [Project Overview](#-project-overview)
- [Hedera Integration](#-hedera-integration-detailed)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture-diagram)
- [Deployed Hedera IDs](#-deployed-hedera-ids)
- [Setup Instructions](#-setup-instructions)
- [Security & Credentials](#-security--credentials)

---

Chai Platform is a decentralized coffee tree tokenization platform built on the Hedera network. It enables farmers to tokenize their coffee groves and allows investors to purchase tokens representing ownership in coffee production, creating a transparent and efficient marketplace for sustainable coffee investment.

## 🌱 Project Overview

The Chai Platform connects coffee farmers with investors through blockchain technology, enabling:

- **Farmers** to register their groves and tokenize their coffee trees
- **Investors** to purchase tokens representing ownership in coffee production
- **Transparent revenue distribution** from coffee sales to token holders
- **Real-time monitoring** of tree health and environmental conditions
- **Secure wallet integration** for all platform interactions
- **Lending system** that allows investors to either provide liquidity to earn interest or take out loans using their coffee tree tokens as collateral

## 🔗 Hedera Integration (Detailed)

### Hedera Token Service (HTS)

**Why HTS:** We chose Hedera Token Service for tokenizing coffee groves because its native token functionality provides **$0.0001 predictable fees** for token creation and transfers, which is critical for our target market of small-scale farmers in East Africa who operate on razor-thin margins. Traditional blockchain token deployments (e.g., ERC-20 on Ethereum) cost $50-200 per deployment, making them economically unfeasible for farmers earning $2-5 per day.

**Transaction Types:**
- `TokenCreateTransaction` - Creating grove NFTs and fungible USDC tokens
- `TokenMintTransaction` - Minting grove ownership tokens
- `TokenAssociateTransaction` - Associating tokens with investor accounts
- `TokenTransferTransaction` - Transferring tokens between farmers and investors
- `TokenBurnTransaction` - Burning tokens during liquidation events

**Economic Justification:** With HTS, we can tokenize a coffee grove for **$0.0001** vs. $50+ on Ethereum. For 500 farmers, this saves **$25,000** in deployment costs alone. The predictable fee structure allows us to offer transparent pricing to farmers, ensuring they know exactly what tokenization will cost before committing.

### Smart Contract Service

**Why Smart Contracts:** We use Hedera's Smart Contract Service (EVM-compatible Solidity contracts) for automated lending pools, revenue distribution, and marketplace escrow because the **3-5 second finality** ensures farmers receive loan disbursements instantly, not hours later. This is crucial for time-sensitive agricultural needs like purchasing fertilizer before planting season.

**Transaction Types:**
- `ContractCreateTransaction` - Deploying lending pool and marketplace contracts
- `ContractExecuteTransaction` - Executing loan disbursements, revenue distributions, and token trades
- `ContractCallQuery` - Querying loan health factors and token prices

**Economic Justification:** Smart contract execution costs **$0.001-0.01** per transaction on Hedera vs. $5-50 on Ethereum. For our projected 10,000 monthly transactions, this represents **$49,900/month in savings**, making the platform financially sustainable without requiring high fees from users.

### Hedera Consensus Service (HCS) - Planned

**Why HCS:** We plan to integrate HCS for immutable logging of harvest reports and revenue distributions because the **$0.0001 per message** cost makes it economically viable to create an auditable trail of every coffee harvest. This transparency is essential for building investor trust and meeting fair-trade certification requirements.

**Planned Transaction Types:**
- `TopicCreateTransaction` - Creating audit log topics
- `TopicMessageSubmitTransaction` - Recording harvest events and payments

**Economic Justification:** Recording 1,000 harvest events per month costs **$0.10** on Hedera vs. $1,000+ on Ethereum, enabling complete supply chain transparency without prohibitive costs.

### ABFT Consensus & Finality

**Why Hedera's Consensus:** The **asynchronous Byzantine Fault Tolerant (ABFT)** consensus provides mathematical certainty of transaction finality in 3-5 seconds. For farmers receiving loan disbursements, this means they can immediately use funds without waiting for block confirmations, unlike Bitcoin (60+ minutes) or Ethereum (6-12 minutes).

**Impact:** Instant finality enables same-day lending, which is critical for agricultural financing where timing determines crop success.

### Carbon Negative Network

**Why Sustainability Matters:** Our target users are sustainable coffee farmers. Using a **carbon-negative blockchain** (Hedera) aligns with their values and allows us to market the platform as environmentally responsible, unlike energy-intensive proof-of-work chains.

**Impact:** This alignment with farmer values increases adoption rates and supports our mission of sustainable agriculture financing.

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + Vanilla JS)                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐     │
│  │ Dashboard  │  │ Wallet Modal │  │ Grove Tracker (Mapbox)  │     │
│  └────────────┘  └──────────────┘  └─────────────────────────┘     │
│         │                │                      │                    │
│         └────────────────┴──────────────────────┘                    │
│                          │                                           │
│                   [HTTP/WebSocket]                                   │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│              BACKEND API (Node.js + Express)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │ Lending API  │  │ Grove API    │  │ Revenue Distribution │      │
│  └──────────────┘  └──────────────┘  └──────────────────────┘      │
│         │                │                      │                    │
│         └────────────────┴──────────────────────┘                    │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│   DATABASE   │  │  HEDERA NETWORK  │  │   EXTERNAL   │
│   (SQLite)   │  │    (Testnet)     │  │   SERVICES   │
├──────────────┤  ├──────────────────┤  ├──────────────┤
│ • Groves     │  │ • HTS Tokens     │  │ • Mapbox API │
│ • Harvests   │  │ • Smart Contracts│  │ • Price Feed │
│ • Users      │  │ • Transactions   │  │ • IoT Sensors│
│ • Loans      │  │ • Mirror Nodes   │  │              │
└──────────────┘  └──────────────────┘  └──────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ HEDERA SERVICES │
                  ├─────────────────┤
                  │ • HTS (Tokens)  │
                  │ • Smart Contracts│
                  │ • Consensus     │
                  │ • Mirror Nodes  │
                  └─────────────────┘

DATA FLOW:
1. User connects wallet → Frontend → Hedera Network (Account verification)
2. User tokenizes grove → Backend API → Smart Contract → HTS Token Creation
3. Investor buys tokens → Frontend → Smart Contract → HTS Token Transfer
4. Harvest reported → Backend API → Database + Smart Contract → Revenue Distribution
5. Loan requested → Backend API → Smart Contract → USDC Transfer (HTS)
```

---

## 📍 Deployed Hedera IDs

All contracts and tokens are deployed on **Hedera Testnet**:

### Smart Contracts
| Contract | Testnet ID | Purpose |
|----------|-----------|---------|
| **Issuer Contract** | `0.0.7116112` | Grove tokenization orchestration |
| **Price Oracle** | `0.0.7116062` | Coffee price feeds |
| **Revenue Reserve** | `0.0.7116403` | Revenue distribution to token holders |
| **Marketplace** | `0.0.7116410` | Secondary market for grove tokens |

### HTS Tokens
| Token | Testnet ID | Type | Purpose |
|-------|-----------|------|---------|
| **Platform USDC** | `0.0.7144320` | Fungible | Stablecoin for loans and payments |
| **Grove NFTs** | Dynamic | NFT | Individual coffee grove ownership |

### Platform Accounts
| Account | Testnet ID | Purpose |
|---------|-----------|---------|
| **Operator Account** | `0.0.5792828` | Platform operations and contract deployment |
| **Admin Account** | `0.0.6967933` | Administrative functions |

### Mirror Node Queries
- **REST API:** `https://testnet.mirrornode.hedera.com`
- **Used for:** Transaction history, token balances, contract state queries

---

## 🚀 Quick Start

### Try the Live Demo

**No installation required!** Visit the deployed application:

👉 **(https://chai-platform-three.vercel.app/)**

Features available in the live demo:
- ✅ View 42 mapped coffee groves
- ✅ Connect HashPack wallet (Testnet)
- ✅ Browse investment opportunities
- ✅ Real-time grove tracking with satellite imagery
- ✅ Interactive dashboard with market data

### Local Development Setup

### Prerequisites

- **Node.js 18+** or 20+
- **pnpm** package manager (`npm install -g pnpm`)
- **Hedera Testnet account** (get free HBAR from [portal.hedera.com](https://portal.hedera.com))
- **WalletConnect Project ID** (get from [cloud.reown.com](https://cloud.reown.com))
- **HashPack Wallet** (recommended) - [Download here](https://www.hashpack.app/)

### Installation

```bash
# Clone the repository
git clone https://github.com/i-mwangi/chai.git
cd chai

# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Hedera Configuration
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_OPERATOR_KEY=YOUR_PRIVATE_KEY

# WalletConnect Configuration
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
VITE_HEDERA_NETWORK=testnet
VITE_DEBUG=true

# Database (SQLite for development)
DATABASE_URL=file:./local-store/sqlite/sqlite.db

# API Ports
API_PORT=3001
FRONTEND_PORT=3000
```

### Starting the Development Environment

The platform requires **TWO separate terminals** running simultaneously:

#### **Terminal 1: Backend API Server**

```bash
# Start the backend API server
node start-server.mjs
```

This starts:
- ✅ Backend API on port **3001**
- ✅ Database connection (SQLite)
- ✅ Event indexers
- ✅ Price providers
- ✅ All API endpoints

**Expected output:**
```
🚀 Starting Coffee Tree Platform Server...
✅ Database migrations completed
✅ Database health check passed
🌐 Server running on http://localhost:3001
```

#### **Terminal 2: Frontend Development Server**

```bash
# Start the Vite development server
pnpm run frontend:vite
```

This starts:
- ✅ Vite dev server on port **3000**
- ✅ Hot module replacement (HMR)
- ✅ Fast refresh for development
- ✅ Serves frontend files

**Expected output:**
```
VITE v6.4.0  ready in XXX ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

#### **Access the Application**

Open your browser and visit: **http://localhost:3000**

---

### Alternative: Quick Start with Mock Data

If you want to test without setting up the full backend:

```bash
# Terminal 1: Mock API (simpler, no database needed)
pnpm run api:mock

# Terminal 2: Frontend
pnpm run frontend:vite
```

This uses mock data stored in `frontend/mock-data.json` - perfect for frontend development!

---

### Development Workflow Summary

| What You're Doing | Terminal 1 | Terminal 2 |
|-------------------|------------|------------|
| **Full Development** | `node start-server.mjs` | `pnpm run frontend:vite` |
| **Frontend Only** | `pnpm run api:mock` | `pnpm run frontend:vite` |
| **Quick Test** | `pnpm run dev` | *(automatic)* |

### First-Time Setup Checklist

Follow these steps in order:

#### 1. **Get Hedera Testnet Account**
   - Visit [portal.hedera.com](https://portal.hedera.com)
   - Create a testnet account (free)
   - You'll receive **10,000 tℏ** automatically
   - Copy your **Account ID** (format: `0.0.XXXXXXX`)
   - Copy your **Private Key** (starts with `302e...`)

#### 2. **Get WalletConnect Project ID**
   - Visit [cloud.reown.com](https://cloud.reown.com)
   - Create a free account
   - Create a new project
   - Copy your **Project ID**

#### 3. **Configure Environment Variables**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and add your credentials
   ```
   
   **Required variables:**
   ```env
   HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
   HEDERA_OPERATOR_KEY=YOUR_PRIVATE_KEY
   VITE_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID
   ```

#### 4. **Install HashPack Wallet**
   - Install [HashPack](https://www.hashpack.app/) browser extension
   - Create or import your Hedera account
   - **Important:** Switch to **Testnet** network in settings

#### 5. **Initialize Database**
   ```bash
   # Run database migrations
   pnpm run migrate
   ```

#### 6. **Start Development Servers**
   
   **Terminal 1:**
   ```bash
   node start-server.mjs
   ```
   
   **Terminal 2:**
   ```bash
   pnpm run frontend:vite
   ```

#### 7. **Open Application**
   - Visit **http://localhost:3000**
   - Click "Connect Wallet"
   - Select HashPack and approve connection
   - You're ready to go! 🎉

### Data Persistence

The mock API server automatically persists data to:
```
frontend/mock-data.json
```

This means:
- ✅ Registered groves persist across page refreshes
- ✅ Harvest reports are saved
- ✅ Data survives server restarts
- ✅ No database setup required for development

### Common Setup Issues & Solutions

#### ❌ Port Already in Use (EADDRINUSE)

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**

**Windows PowerShell:**
```powershell
# Kill process on port 3000
$process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($process) { Stop-Process -Id $process -Force }

# Kill process on port 3001
$process = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($process) { Stop-Process -Id $process -Force }
```

**macOS/Linux:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

---

#### ❌ Database Migration Errors

**Problem:** `Error: no such table: coffee_groves`

**Solution:**
```bash
# Run migrations
pnpm run migrate

# If that fails, reset database
rm -rf local-store/sqlite/sqlite.db
pnpm run migrate
```

---

#### ❌ Module Not Found Errors

**Problem:** `Cannot find module '@hashgraph/sdk'`

**Solution:**
```bash
# Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

#### ❌ Wallet Connection Fails

**Problem:** Wallet won't connect or shows error

**Solutions:**
1. **Check HashPack is on Testnet:**
   - Open HashPack → Settings → Network → Select "Testnet"

2. **Verify WalletConnect Project ID:**
   - Check `.env` has `VITE_WALLETCONNECT_PROJECT_ID`
   - Restart Vite server after changing `.env`

3. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

#### ❌ API Endpoints Return 404

**Problem:** Frontend can't reach backend API

**Solution:**
1. **Verify backend is running:**
   ```bash
   # Should see "Server running on http://localhost:3001"
   node start-server.mjs
   ```

2. **Check API URL in browser console:**
   - Open DevTools (F12)
   - Look for API calls - should go to `http://localhost:3001/api/*`

3. **Verify `.env` configuration:**
   ```env
   API_PORT=3001
   ```

---

#### ❌ Build Fails on Windows

**Problem:** `'pnpm' is not recognized as an internal or external command`

**Solution:**
```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

---


## 📁 Project Structure

```
chai-platform/
├── abi/                 # Smart contract ABIs
├── api/                 # Backend API services
├── contracts/           # Solidity smart contracts
├── db/                  # Database schema and migrations
├── events/              # Event processing services
├── frontend/            # Frontend application
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript modules
│   ├── wallet/          # Wallet integration
│   ├── index.html       # Landing page
│   └── app.html         # Main application
├── lib/                 # Shared libraries
├── providers/           # Data providers
├── tests/               # Test suites
└── types/               # TypeScript definitions
```

## 🔐 Wallet Integration

The platform uses **Hedera Wallet Connect v2.0** for secure wallet integration, supporting:

### Supported Wallets
- **HashPack** (Browser Extension)
- **Blade** (Browser Extension)
- **Kabila** (Browser Extension)
- **Mobile Wallets** (via QR Code)

### Integration Details

Wallet integration is located in `frontend/wallet/` and includes:

- `config.js` - WalletConnect configuration
- `connector.js` - DAppConnector wrapper
- `manager.js` - High-level wallet API
- `modal.js` - Connection UI components
- `state.js` - Connection state management

### Usage Example

```
// Connect wallet
await walletManager.connect();

// Check connection
if (walletManager.isWalletConnected()) {
  const accountId = walletManager.getAccountId();
}

// Send transaction
const result = await walletManager.sendTransaction(
  '0.0.12345',  // recipient
  '10'          // amount in HBAR
);

// Listen to events
window.addEventListener('wallet-connected', (event) => {
  console.log('Connected:', event.detail.accountId);
});
```

### WalletConnect Project ID

The platform uses WalletConnect for wallet integration. You need to:

1. Visit [https://cloud.reown.com](https://cloud.reown.com)
2. Create a new project
3. Copy your Project ID
4. Add it to your `.env` file:

``env
VITE_WALLETCONNECT_PROJECT_ID=your-project-id-here
```

## 💰 Lending System for Investors

The platform includes a comprehensive lending system that allows investors to either provide liquidity to earn interest or take out loans using their coffee tree tokens as collateral.

### Lending Pools

Investors can provide liquidity to lending pools and earn passive income through Annual Percentage Yield (APY):

- **USDC Pool**: Currently offering 8.5% APY
- **KES Pool**: Currently offering 12.0% APY

#### Providing Liquidity

1. Navigate to the "Lending & Liquidity" section in the investor portal
2. Select a lending pool (USDC or KES)
3. Enter the amount you wish to deposit
4. Review the estimated returns and LP tokens to receive
5. Confirm the transaction to deposit funds
6. Receive LP (Liquidity Provider) tokens proportional to your contribution

Benefits:
- Earn passive income through APY
- LP tokens can be withdrawn at any time with accrued rewards
- Support the lending ecosystem for other investors

#### Withdrawing Liquidity

1. Navigate to your liquidity positions in the lending section
2. Select the pool from which you want to withdraw
3. Enter the amount of LP tokens to burn
4. Review the USDC and rewards you'll receive
5. Confirm the transaction to withdraw funds

### Taking Out Loans

Investors can borrow USDC by locking their coffee tree tokens as collateral:

#### Loan Terms
- **Collateralization Ratio**: 125% (must lock $1.25 worth of tokens for every $1 borrowed)
- **Liquidation Threshold**: 90% (if token value drops to 90% of original, collateral may be liquidated)
- **Interest Rate**: 10% (repay 110% of borrowed amount)
- **Loan Duration**: 180 days

#### Process
1. Navigate to the "Loans" section in the lending area
2. System calculates maximum loan amount based on portfolio value
3. Click "Take Out Loan" button
4. Enter desired loan amount (up to maximum)
5. Review loan terms including collateral requirements and liquidation price
6. Confirm the transaction to receive USDC in wallet

#### Loan Management
- Real-time monitoring of loan health with visual indicators
- Automatic warnings for low health factors (below 1.2)
- Loans can be repaid at any time to unlock collateral
- Clear display of all loan terms and conditions

#### Repaying Loans
1. Navigate to your active loan in the lending section
2. Click "Repay Loan" button
3. Review repayment details including total amount and collateral to unlock
4. Confirm the transaction to repay the loan

### Risk Management
- Health factor monitoring with color-coded indicators (Healthy > 1.5, Monitor 1.2-1.5, At Risk < 1.2)
- Automatic notifications when health factor drops below safe levels
- Liquidation protection with 90% threshold
- Transparent pricing and terms displayed before confirming transactions

## 🗄️ Database

The platform supports multiple database backends:

### Local Development (SQLite)
```env
DATABASE_URL=file:./local-store/sqlite/sqlite.db
```

### Production (Turso - LibSQL)
```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Database Schema

Key tables include:
- `coffee_groves` - Registered coffee groves
- `harvest_records` - Harvest data and revenue
- `token_holdings` - Investor token ownership
- `farmer_verifications` - Farmer verification status
- `investor_verifications` - Investor verification status
- `transaction_history` - Financial transaction records
- `iot_sensor_data` - Environmental monitoring data

### Migrations

```bash
# Generate new migration
pnpm run generate

# Run migrations
pnpm run migrate

# View migration status
pnpm run migration:show
```

## ☁️ Turso Deployment

For production deployment, the platform uses Turso (SQLite-compatible edge database):

### Setup

1. Install Turso CLI:
   ```bash
   irm get.turso.tech/install.ps1 | iex
   ```

2. Create account and database:
   ```bash
   turso auth signup
   turso db create chai-platform
   ```

3. Get credentials:
   ```bash
   turso db show chai-platform --url
   turso db tokens create chai-platform
   ```

4. Update `.env`:
   ```env
   TURSO_DATABASE_URL=libsql://chai-platform-yourname.turso.io
   TURSO_AUTH_TOKEN=your-token-here
   ```

## 🏗️ Smart Contracts

Smart contracts are written in Solidity and deployed on Hedera using the Hedera Token Service (HTS).

### Core Contracts

- `CoffeeTreeIssuer.sol` - Grove registration and tokenization orchestration
- `CoffeeTreeManager.sol` - Token management and grove metadata (uses two-phase deployment)
- `CoffeeTreeMarketplace.sol` - Token trading marketplace
- `CoffeeRevenueReserve.sol` - Revenue distribution to token holders
- `PriceOracle.sol` - Coffee price feeds
- `FarmerVerification.sol` - Farmer identity verification

### Three-Step Tokenization Process

To avoid `CONTRACT_REVERT_EXECUTED` errors on Hedera due to gas limits, the platform now uses a **three-step tokenization process**:

**Step 1**: Create token and contracts (`createGroveTokenAndContracts`) - Deploys contracts without token creation
**Step 2**: Initialize HTS token (`initializeGroveToken`) - Creates the HTS token in a separate transaction  
**Step 3**: Mint initial supply (`mintGroveTokens`) - Mints the initial token supply

This approach splits the gas-intensive operations across multiple transactions, ensuring reliable deployment and tokenization.

### Deployment

```bash
# Deploy CoffeeTreeManager with two-phase pattern
npx tsx deploy.ts CoffeeTreeManager

# Deploy other contracts (single-phase)
npx tsx deploy.ts CoffeeTreeIssuer
npx tsx deploy.ts CoffeeTreeMarketplace
npx tsx deploy.ts FarmerVerification
```

Contract addresses are configured in `.env`:
```env
ISSUER_CONTRACT_ID=0.0.xxxxx
GROVE_MANAGER_CONTRACT_ID=0.0.yyyyy
MARKETPLACE_CONTRACT_ID=0.0.zzzzz
```

### Documentation

- [Contracts README](./contracts/README.md) - Detailed contract documentation
- [Migration Guide](./contracts/MIGRATION_GUIDE.md) - Migrating to two-phase pattern
- [Gas Optimization](./contracts/GAS_OPTIMIZATION.md) - Gas usage and optimization
- [Deployment Guide](./DEPLOYMENT.md) - Full deployment instructions

## 🌐 Vercel Deployment

The platform is deployed on Vercel with serverless architecture:

**Live Demo:** https://chai-project-git-main-henrys-projects-d4d95c28.vercel.app/

### Architecture

- **Frontend:** Static files served from `frontend/dist/`
- **API:** Single serverless function at `api/index.ts`
- **Build:** Vite for frontend, tsup for backend
- **Database:** SQLite (local) / Turso (production)

### Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

| Name | Value | Required |
|------|-------|----------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Your WalletConnect project ID | ✅ Yes |
| `VITE_HEDERA_NETWORK` | `testnet` or `mainnet` | ✅ Yes |
| `VITE_DEBUG` | `false` for production | ⚠️ Optional |
| `TURSO_DATABASE_URL` | Your Turso database URL | ⚠️ Optional |
| `TURSO_AUTH_TOKEN` | Your Turso auth token | ⚠️ Optional |

**Important:** `VITE_*` variables must be set before deployment as they're injected at build time.

### Deployment Steps

1. **Push to GitHub:**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Or use Vercel CLI:**
   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Deploy
   vercel --prod
   ```

### Vercel Configuration

The `vercel.json` file configures:
- Build command: `pnpm run build && pnpm run frontend:build`
- Output directory: `frontend/dist`
- API routes: All `/api/*` requests route to `api/index.ts`
- Serverless function timeout: 60 seconds

### Troubleshooting Deployment

**Issue:** Wallet connection not working
- **Solution:** Ensure `VITE_WALLETCONNECT_PROJECT_ID` is set in Vercel environment variables

**Issue:** API endpoints returning 404
- **Solution:** Check that `api/index.ts` exists and `vercel.json` rewrites are configured

**Issue:** Build fails with "function limit exceeded"
- **Solution:** All API files are in `lib/api/`, only `api/index.ts` is deployed as a function

**Issue:** Environment variables undefined
- **Solution:** Redeploy after adding variables (they're injected at build time)

## 🧪 Testing

### Unit Tests
```bash
pnpm run test
```

### End-to-End Tests
```bash
pnpm run test:e2e
```

### Load Testing
```bash
pnpm run test:e2e:load
```

## 🛠️ Development Scripts

| Script | Description |
|--------|-------------|
| **Development** | |
| `pnpm run dev` | Start mock API (3002) + frontend server (3000) |
| `pnpm run dev:vite` | Start mock API (3002) + Vite dev server (3000) |
| `pnpm run dev:full` | Start real API + indexers + providers + frontend |
| **Servers** | |
| `pnpm run api:mock` | Mock API server only (port 3002) |
| `pnpm run api` | Real backend API server (port 3001) |
| `pnpm run frontend` | Frontend server only (port 3000) |
| **Build & Deploy** | |
| `pnpm run frontend:build` | Build frontend for production |
| `pnpm run frontend:preview` | Preview production build |
| `pnpm run deploy` | Deploy smart contracts to Hedera |
| **Database** | |
| `pnpm run migrate` | Run database migrations |
| `pnpm run generate` | Generate new migration |
| `pnpm run migration:show` | View migration status |
| `pnpm run studio` | Open Drizzle Studio (database GUI) |
| **Testing** | |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:e2e:load` | Run load tests |

### Common Development Workflows

**Quick frontend development:**
```bash
pnpm run dev:vite  # Fast hot-reload
```

**Testing with mock data:**
```bash
pnpm run dev  # Persistent mock data
```

**Full integration testing:**
```bash
pnpm run dev:full  # Real contracts + backend
```

## 📊 Monitoring & Analytics

The platform includes built-in analytics for:
- Coffee price tracking
- Revenue distribution monitoring
- User activity tracking
- Environmental sensor data visualization

## 🔒 Security

### Wallet Security
- All transactions require explicit user approval
- Private keys never leave the user's wallet
- Session persistence uses secure storage

### Data Security
- Database encryption at rest
- TLS encryption for all communications
- Regular security audits

### Access Control
- Role-based access control (Farmer/Investor/Admin)
- KYC verification for investors
- Farmer verification process

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hedera Hashgraph](https://hedera.com) - Distributed consensus platform
- [WalletConnect](https://walletconnect.com) - Wallet integration protocol
- [Turso](https://turso.tech) - Edge database provider
- [Vercel](https://vercel.com) - Deployment platform

## 🔒 Security & Credentials

### ⚠️ Important Security Notes

**NO PRIVATE KEYS IN REPOSITORY:**
- ✅ All sensitive credentials are in `.env` (gitignored)
- ✅ `.env.example` provided with structure only
- ✅ No private keys, secrets, or credentials committed to Git
- ✅ Test credentials provided separately in DoraHacks submission

### Environment Configuration

**Example `.env.example` structure:**
```env
# Hedera Configuration
HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_OPERATOR_KEY=YOUR_PRIVATE_KEY_HERE

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Network
HEDERA_NETWORK=testnet
```

**For Judges:** Test account credentials (Account ID + Private Key) are provided in the **DoraHacks submission notes** for secure access.

### How Judges Can Test

1. **Use Provided Credentials:** Import the test account into HashPack wallet
2. **Or Create Your Own:** Visit [portal.hedera.com](https://portal.hedera.com) for free testnet account
3. **Configure `.env`:** Copy `.env.example` to `.env` and add credentials
4. **Run Locally:** Follow setup instructions below

---

## 🎯 Demo Account for Judges

A testnet account is provided for testing and evaluation:

```
Account ID: 0.0.5792828
Private Key: Available in submission materials
Network: Hedera Testnet
```

### How to Test

1. **Install HashPack Wallet:**
   - Download from [hashpack.app](https://www.hashpack.app/)
   - Switch to Testnet mode in settings

2. **Import Demo Account:**
   - Use the private key provided in submission
   - Or create your own testnet account at [portal.hedera.com](https://portal.hedera.com)

3. **Visit Live Demo:**
   - Go to https://chai-project-git-main-henrys-projects-d4d95c28.vercel.app/
   - Click "Connect Wallet"
   - Select HashPack and approve connection

4. **Explore Features:**
   - View 42 mapped coffee groves across Ethiopia & Uganda
   - Browse investment opportunities
   - Test wallet connection and transactions
   - View smart contract interactions

### Deployed Smart Contracts

| Contract | Testnet Address |
|----------|----------------|
| Issuer Contract | `0.0.7116112` |
| Price Oracle | `0.0.7116062` |
| Revenue Reserve | `0.0.7116403` |
| Marketplace | `0.0.7116410` |
| Platform USDC | `0.0.7144320` |


