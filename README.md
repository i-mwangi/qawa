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

Chai Platform is a decentralized coffee tree tokenization platform built on the Hedera network. It enables farmers to tokenize their coffee groves and allows investors to purchase tokens representing ownership in coffee production, creating a transparent and efficient marketplace for sustainable coffee investment.

## 🌱 Project Overview

The Chai Platform connects coffee farmers with investors through blockchain technology, enabling:

- **Farmers** to register their groves and tokenize their coffee trees
- **Investors** to purchase tokens representing ownership in coffee production
- **Transparent revenue distribution** from coffee sales to token holders
- **Earnings withdrawal** allowing investors to withdraw their earnings as USDC directly to their wallet
- **Real-time monitoring** of tree health and environmental conditions
- **Secure wallet integration** for all platform interactions
- **Lending system** that allows investors to either provide liquidity to earn interest or take out loans using their coffee tree tokens as collateral

## 🌐 Live Platform

**Access the platform:** [https://qawa-platform-frontend.onrender.com/](https://qawa-platform-frontend.onrender.com/)

Features available:
- ✅ Connect HashPack wallet (Hedera Testnet)
- ✅ Register and tokenize coffee groves
- ✅ Browse and invest in tokenized groves
- ✅ Track earnings and withdraw USDC
- ✅ Provide liquidity or take out loans
- ✅ Real-time revenue distribution
- ✅ Secondary marketplace trading

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



### Starting the Development Environment

 Backend API Server**

node start-server.mjs
 Server running on http://localhost:3001
```

 Frontend Development Server**

pnpm run frontend:vite
```
➜  Local:   http://localhost:3000/



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
## 💰 Lending System for Investors

The platform includes a comprehensive lending system that allows investors to either provide liquidity to earn interest or take out loans using their coffee tree tokens as collateral.

### Earnings & Withdrawals

Investors can track and withdraw their earnings:
- **View Balance:** See total earned, total withdrawn, and available balance
- **Withdraw Earnings:** Transfer available balance as USDC directly to your wallet
- **Transaction History:** View complete withdrawal history with HashScan links
- **Token Association:** Automatic guidance for USDC token association if needed

### Lending Pools

Investors can provide liquidity to lending pools and earn passive income through Annual Percentage Yield (APY):

- **USDC Pool**: Currently offering 8.5% APY

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

### Architecture

- **Frontend:** Static files served from `frontend/dist/`
- **API:** Single serverless function at `api/index.ts`
- **Build:** Vite for frontend, tsup for backend
- **Database:** SQLite (local) / Turso (production)


## Monitoring & Analytics

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

