# QoinDEX ⚡

QoinDEX is a high-fidelity, cyberpunk-inspired AMM Decentralized Exchange (DEX) functioning natively on the **TeQoin Layer-2 network** (EVM Chain ID: `420377`). 

Designed for ultra-low latency transaction clearing, QoinDEX allows users to seamlessly perform token swaps, supply liquid pool reserves (Constant Product AMM), earn passive yields via decentralized staking contracts, deploy custom ERC-20 tokens, and tap into automatic gasless testnet faucets.

---

## 🎨 Architecture & Major Capabilities

- **State Sync Engine**: All liquidity pools, token balances, block heights, and network telemetry are retrieved in real-time from the on-chain TeQoin L2 RPC nodes.
- **Gasless Smart Faucet**: A dual-delegation gasless faucet that enables newly initialized web3 wallets to claim claimable L2 testnet assets without needing real gas beforehand. The backend acts as a gas relayer to sponsor the contract execution using the sponsor private key.
- **Durable Persistence**: Built with a persistent JSON-based wallet telemetry server to log historically executed swaps, mints, and transactions securely on a per-address boundary.
- **Modular Design**: Composed of modern React 18 frontend modules styled with high-contrast custom Tailwind CSS, paired with a reliable Express server backend compiling, caching, and validating on-chain state.

---

## 🔒 Security & Safe Credentials Handling (No Key Leaks)

The codebase has been meticulously audited to ensure **no hardcoded private keys are left inside scripts**. 
All automated test scripts, compilation scripts, utility relayers, and backend deployment routers reference standard Environment Variables or a local `pk.txt` file which is completely git-ignored.

This means you can **safely push this repository to GitHub** and connect it directly to **Vercel / Render / Heroku** without any risk of credential exposure!

### Supported Environment Variables for Relaying Gas:
Configure these variables inside your Vercel/Render hosting dashboard environment dashboard to enable the sponsored gasless faucet:

```env
# Sponsoring faucet gas relay private key
FAUCET_SPONSOR_PRIVATE_KEY=your_private_key_here

# Alternatively, the system also checks secondary fallback names:
# PRIVATE_KEY=your_private_key_here
# DEPLOYER_PRIVATE_KEY=your_private_key_here
```

---

## 🚀 Getting Started

To run QoinDEX locally, follow these simple commands:

### Prerequisites:
- **Node.js** (v18 or higher)
- **NPM**

### 1. File Configuration:
For local testing, create a file named `pk.txt` in the root directory and paste your L2 sponsor account private key (with or without the `0x` prefix):
```bash
echo "YOUR_PRIVATE_KEY" > pk.txt
```
*Note: `pk.txt` is already excluded in `.gitignore` so it will never be printed or pushed to your public GitHub sync.*

### 2. Install dependencies:
```bash
npm install
```

### 3. Run Development Server:
```bash
npm run dev
```
The server will boot, run on-chain contract validations (e.g. automatic validation and hot-deployment of the WETH token wrapper), and expose the interface on:
- Frontend Client: `http://localhost:3000`

### 4. Build for Production:
```bash
npm run build
```
This produces a fully bundled, production-ready static directory inside `dist/` and a compiled backend server script inside `dist/server.cjs` bundled cleanly using `esbuild`.

---

## 🔄 Deploying to Vercel

To deploy QoinDEX on **Vercel**, follow these easy steps:

1. **Host GitHub Repo**: Push this project directory to your personal GitHub repository.
2. **Import to Vercel**: Connect your GitHub account to Vercel, click **Add New Project**, and import this repository.
3. **Configure Environment variables**:
   Under the Environment Variables section in the Vercel project configuration, add your private key:
   - Key: `FAUCET_SPONSOR_PRIVATE_KEY` / `PRIVATE_KEY`
   - Value: paste your TeQoin L2 private key
4. **Deploy**: Click **Deploy**! Vercel will automatically build the client-side single page app.

---

## 🌐 On-Chain Smart Contract Interfaces

The backend and frontend communicate with verified on-chain standard smart contract paradigms:
- **QoinDEX (DEX Main)**: Serves swap operations, LP additions / withdrawals, and staking locks.
- **ERC20 Tokens**: Integrates standard ERC-20 tokens (`USDC`, `USDT`, `DAI`, `NBLAD`, `DE4I`, and the native protocol token `QOIN`).
- **Faucet**: Manages individual cooling periods, user limit approvals, and on-chain claims.
