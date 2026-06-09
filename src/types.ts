/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TokenSymbol = string;

export interface TokenDetails {
  symbol: TokenSymbol;
  name: string;
  address: string;
  decimals: number;
  color: string; // Tailwind glow classes
  iconName: string;
}

export const CONTRACTS = {
  DEX: "0x613b4f4D2607736803544592879AB15a6e5a0a34",
  USDC: "0xe819eb5be34b20f1fec012c0daf960397a0fb386",
  USDT: "0xfcc025a3e170df62de0e25af7ceaf1c89abfe6e9",
  DAI: "0xb96a869c74be2ed561d95a77408505371f287d16",
  WETH: "0xCcc709e44400054CD41039D96D61c34BBcBFc146",
  NBLAD: "0xC486Fc1Df857916e2121EA53e51CE955d2a42dA7",
  DE4I: "0xad7ed33d463a23388ad69782F8628fdFF79c054D",
  QOIN: "0x46576A8bee6ba1085a5812e161c0EF99189a9d11", // placeholder, will be updated by deploy
  Masterchef: "0x613b4f4D2607736803544592879AB15a6e5a0a34",
  Faucet: "0xE0Bec5f17F62836F911FAE1B0298c337ADD7229D",
  Pair: "0x613b4f4D2607736803544592879AB15a6e5a0a34",
};

export const TOKENS: Record<TokenSymbol, TokenDetails> = {
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xCcc709e44400054CD41039D96D61c34BBcBFc146",
    decimals: 18,
    color: "from-blue-500 to-indigo-600 border-indigo-400 text-indigo-100",
    iconName: "Droplet",
  },
  QOIN: {
    symbol: "QOIN",
    name: "TeQoin Coin",
    address: CONTRACTS.QOIN,
    decimals: 18,
    color: "from-amber-400 to-yellow-600 border-amber-400 text-amber-200",
    iconName: "Coins",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: CONTRACTS.USDC,
    decimals: 6,
    color: "from-blue-400 to-indigo-600 border-indigo-400 text-indigo-200",
    iconName: "DollarSign",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: CONTRACTS.USDT,
    decimals: 6,
    color: "from-green-400 to-emerald-600 border-emerald-400 text-emerald-200",
    iconName: "DollarSign",
  },
  DAI: {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: CONTRACTS.DAI,
    decimals: 18,
    color: "from-yellow-500 to-orange-600 border-orange-400 text-orange-200",
    iconName: "DollarSign",
  },
  NBLAD: {
    symbol: "NBLAD",
    name: "Nebula Blade",
    address: CONTRACTS.NBLAD,
    decimals: 18,
    color: "from-purple-500 to-fuchsia-600 border-fuchsia-400 text-fuchsia-305",
    iconName: "Zap",
  },
  DE4I: {
    symbol: "DE4I",
    name: "Deity Quantum",
    address: CONTRACTS.DE4I,
    decimals: 18,
    color: "from-cyan-400 to-teal-600 border-cyan-400 text-cyan-200",
    iconName: "Cpu",
  },
};

export interface StakingPoolState {
  amountStaked: number;
  lastStakedTime: number;
  qoinRewardDebt: number;
  rate: number; // QOIN rewards per hour per 1000 tokens (or per 1 ETH)
}

export interface StakingPosition {
  USDC: StakingPoolState;
  USDT: StakingPoolState;
  DAI: StakingPoolState;
  ETH: StakingPoolState;
}

export interface WalletState {
  address: string;
  balances: Record<TokenSymbol, number>;
  staking: StakingPosition;
  faucetClaims: {
    ETH: number;
  };
  autoWithdrawThresholds: {
    QOIN: number;
    enabled: boolean;
  };
  logs: Array<{
    id: string;
    timestamp: number;
    type: string; // "SWAP" | "LP" | "STAKE" | "UNSTAKE" | "CLAIM" | "FAUCET" | "SYSTEM"
    detail: string;
    txHash: string;
    contractAddress?: string;
  }>;
}

export interface LPState {
  pair: [TokenSymbol, TokenSymbol];
  reserveA: number;
  reserveB: number;
  userShares: number;
  totalShares: number;
}

export interface NotificationItem {
  id: string;
  type: "success" | "info" | "warning" | "alert";
  title: string;
  message: string;
  timestamp: number;
}

export interface MarketTelemetry {
  blockHeight: number;
  activeNodes: number;
  ammGigaHashRate: string;
  slippageStandard: number;
  gasGwei: number;
  gasPriceUsd: number;
  faucetLimit: number;
  cooldownMs: number;
  tps?: number;
  totalTx?: number;
  deployedAddresses?: {
    DEX: string;
    USDC: string;
    USDT: string;
    DAI?: string;
    NBLAD: string;
    DE4I: string;
    QOIN: string;
    deployedTimestamp: number;
    deployedBy: string;
    txHash: string;
  } | null;
}

export function formatAmount(val: number | undefined | null, maxDecimals: number = 4): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  // Clean up floating point precision issues by rounding to maxDecimals
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(val * factor) / factor;
  
  if (rounded % 1 === 0) {
    return rounded.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  }
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  });
}

export function toSafeDecimalString(amount: number | string | undefined | null, decimals: number): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "0";
  
  let amtStr = typeof amount === "number" ? amount.toFixed(Math.min(20, decimals + 4)) : amount.trim();
  
  if (amtStr.includes("e") || amtStr.includes("E")) {
    try {
      const numValue = typeof amount === "number" ? amount : parseFloat(amount);
      amtStr = numValue.toFixed(decimals);
    } catch (e) {
      // ignore
    }
  }
  
  const parts = amtStr.split(".");
  if (parts.length === 2) {
    const integerPart = parts[0];
    const fractionalPart = parts[1].substring(0, decimals);
    const sanitizedFraction = fractionalPart || "0";
    return `${integerPart}.${sanitizedFraction}`;
  }
  return parts[0];
}
