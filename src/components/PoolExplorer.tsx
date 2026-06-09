import React, { useMemo } from "react";
import { 
  Droplets, 
  Coins, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles, 
  Lock, 
  Percent, 
  HelpCircle,
  Globe,
  DollarSign
} from "lucide-react";
import { formatAmount } from "../types";

interface PoolExplorerProps {
  isLightTheme: boolean;
  poolReserves: Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }>;
  tokens: Record<string, any>;
  onChainReserves: Record<string, number>;
  onSwitchTab: (tabId: "SWAP" | "LP" | "STAKING" | "DEPLOY" | "DASHBOARD" | "POOL") => void;
}

// Token pricing mapping for realistic mockup TVL calculation (all standard values)
const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  DAI: 1.0,
  ETH: 3450.0,
  WETH: 3450.0,
  QOIN: 0.15,
  NBLAD: 0.12,
  DE4I: 0.25
};

export default function PoolExplorer({
  isLightTheme,
  poolReserves,
  tokens,
  onChainReserves,
  onSwitchTab,
}: PoolExplorerProps) {

  // Calculate sum of AMM reserves for each token to prevent mixing up staker deposits with AMM reserves
  const tokenAmmReserves = useMemo(() => {
    const reservesSum: Record<string, number> = {};
    Object.entries(poolReserves).forEach(([pairKey, pool]) => {
      const [symbolA, symbolB] = pairKey.split("_");
      reservesSum[symbolA] = (reservesSum[symbolA] || 0) + pool.reserveA;
      reservesSum[symbolB] = (reservesSum[symbolB] || 0) + pool.reserveB;
    });
    return reservesSum;
  }, [poolReserves]);

  // Helper function to get token price
  const getPrice = (symbol: string): number => {
    return TOKEN_PRICES[symbol.toUpperCase()] || 1.0;
  };

  // 1. Calculate LP Pools and their individual TVLs
  const lpPoolsList = useMemo(() => {
    return Object.entries(poolReserves).map(([pairKey, pool]) => {
      const [symbolA, symbolB] = pairKey.split("_");
      const priceA = getPrice(symbolA);
      const priceB = getPrice(symbolB);
      
      const tvlA = pool.reserveA * priceA;
      const tvlB = pool.reserveB * priceB;
      const totalTVL = tvlA + tvlB;

      return {
        pairKey,
        symbolA,
        symbolB,
        reserveA: pool.reserveA,
        reserveB: pool.reserveB,
        totalShares: pool.totalShares,
        userShares: pool.userShares,
        tvl: totalTVL,
        volume24h: totalTVL > 0 ? totalTVL * 0.04 : 0
      };
    }).sort((a, b) => b.tvl - a.tvl);
  }, [poolReserves]);

  // 2. Calculate Staking Pools and their Individual TVLs
  const stakingPoolsList = useMemo(() => {
    const assets = ["USDC", "USDT", "DAI", "ETH"];
    const aprs: Record<string, number> = { USDC: 18.5, USDT: 19.2, DAI: 15.4, ETH: 28.6 };
    
    return assets.map(asset => {
      // Dynamic on-chain absolute calculation
      let globalStaked = 0;
      if (asset === "ETH") {
        globalStaked = onChainReserves["ETH"] || 0;
      } else {
        const totalContractBal = onChainReserves[asset] || 0;
        const ammReserves = tokenAmmReserves[asset] || 0;
        globalStaked = Math.max(0, totalContractBal - ammReserves);
      }

      const price = getPrice(asset);
      const totalTVL = globalStaked * price;

      return {
        asset,
        globalStaked,
        tvl: totalTVL,
        apr: aprs[asset] || 12.0,
        rewardToken: "QOIN"
      };
    }).sort((a, b) => b.tvl - a.tvl);
  }, [onChainReserves, tokenAmmReserves]);

  // 3. Compute protocol totals
  const totalLpTVL = useMemo(() => {
    return lpPoolsList.reduce((sum, item) => sum + item.tvl, 0);
  }, [lpPoolsList]);

  const totalStakingTVL = useMemo(() => {
    return stakingPoolsList.reduce((sum, item) => sum + item.tvl, 0);
  }, [stakingPoolsList]);

  const totalProtocolTVL = totalLpTVL + totalStakingTVL;

  return (
    <div className="space-y-8 font-mono max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* HEADER HERO AREA */}
      <div className={`p-6 md:p-8 rounded-2xl border relative overflow-hidden transition-all duration-300 ${
        isLightTheme 
          ? "bg-white border-zinc-200 shadow-sm" 
          : "bg-slate-950/40 border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.03)]"
      }`}>
        {/* Abstract background vector mesh glow */}
        <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 rounded-full bg-fuchsia-600/5 blur-[120px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-sm uppercase tracking-widest animate-pulse">
                On-Chain Global Reserves
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 rounded-sm uppercase tracking-widest">
                DEX &amp; Staking Matrix
              </span>
            </div>
            <h1 className={`text-2xl md:text-3xl font-black uppercase tracking-wider ${isLightTheme ? "text-zinc-950" : "text-white"}`}>
              QoinDEX Global Pools Explorer
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time audit registry of all Liquidity Pools (DEX AMM) and Yield Staking contracts published across TeQoin Layer-2 network.
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => onSwitchTab("LP")}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLightTheme
                  ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300/60"
                  : "bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 hover:border-cyan-400"
              }`}
            >
              Add Liquidity
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onSwitchTab("STAKING")}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-black font-extrabold text-xs uppercase rounded transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              Stake &amp; Earn
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* METRICS BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
          {/* TOTAL TVL CARD */}
          <div className="p-4 rounded-xl bg-black/40 border border-zinc-900/60 flex flex-col justify-between">
            <span className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-cyan-400" /> TOTAL VALUE LOCKED (TVL)
            </span>
            <div className="mt-2">
              <p className="text-3xl font-black font-sans text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400">
                ${formatAmount(totalProtocolTVL, 2)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase">Cumulative DEX Pools + Staking Yield Reserve balances</p>
            </div>
          </div>

          {/* DEX POOLS GLOBAL TVL */}
          <div className="p-4 rounded-xl bg-black/40 border border-zinc-900/60 flex flex-col justify-between">
            <span className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-fuchsia-450" /> TOTAL AMM LP TVL
            </span>
            <div className="mt-2">
              <p className="text-2xl font-black text-white">
                ${formatAmount(totalLpTVL, 2)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase">Locked in {lpPoolsList.length} liquidity provisioning pairs</p>
            </div>
          </div>

          {/* YIELD STAKING GLOBAL TVL */}
          <div className="p-4 rounded-xl bg-black/40 border border-zinc-900/60 flex flex-col justify-between">
            <span className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-500" /> TOTAL STAKED TVL
            </span>
            <div className="mt-2">
              <p className="text-2xl font-black text-white">
                ${formatAmount(totalStakingTVL, 2)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase">Locked inside decentralized staker yield engines</p>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED TABLES / SEGMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* AMM LIQUIDITY POOLS MATRICES */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${
          isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
        }`}>
          <div className="flex justify-between items-baseline mb-6 border-b border-white/5 pb-2.5">
            <div>
              <h3 className="text-xs font-black uppercase text-fuchsia-400 flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-fuchsia-450" /> AMM Liquidity Pools
              </h3>
              <p className="text-[9px] text-zinc-550 uppercase tracking-widest mt-0.5">Automated Constant Product DEX reserves</p>
            </div>
            <span className="text-[8px] bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-400 px-2 py-0.5 rounded-sm uppercase font-black">
              {lpPoolsList.length} Pools Registered
            </span>
          </div>

          <div className="space-y-4">
            {lpPoolsList.map((pool) => {
              const detailA = tokens[pool.symbolA] || { name: pool.symbolA, color: "from-zinc-400 to-zinc-600 text-white" };
              const detailB = tokens[pool.symbolB] || { name: pool.symbolB, color: "from-zinc-400 to-zinc-600 text-white" };

              return (
                <div 
                  key={pool.pairKey}
                  className="p-4 rounded-xl bg-black/45 border border-zinc-900/85 hover:border-fuchsia-500/20 transition-all font-mono text-xs"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        <span className={`w-4 h-4 rounded-full bg-gradient-to-r ${detailA.color} border border-black flex items-center justify-center text-[7px] font-black pointer-events-none text-black`}>{pool.symbolA[0]}</span>
                        <span className={`w-4 h-4 rounded-full bg-gradient-to-r ${detailB.color} border border-black flex items-center justify-center text-[7px] font-black pointer-events-none text-black`}>{pool.symbolB[0]}</span>
                      </div>
                      <span className="font-bold text-white text-xs">{pool.symbolA} - {pool.symbolB}</span>
                      <span className="text-[8px] bg-zinc-800 text-zinc-400 pr-1.5 pl-1 py-0.5 rounded border border-white/5 font-bold">AMM</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 rounded">
                      <Percent className="h-3 w-3 text-fuchsia-450" />
                      <span className="text-[10px] text-fuchsia-450 font-bold">Trading Fee: 0.3%</span>
                    </div>
                  </div>

                  {/* Pool breakdown matrix */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5 space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase font-black block">Reserves {pool.symbolA}</span>
                      <span className="text-white font-bold">{formatAmount(pool.reserveA, 2)} <span className="text-[8.5px] text-zinc-500">{pool.symbolA}</span></span>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5 space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase font-black block">Reserves {pool.symbolB}</span>
                      <span className="text-white font-bold">{formatAmount(pool.reserveB, 2)} <span className="text-[8.5px] text-zinc-500">{pool.symbolB}</span></span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-zinc-450 uppercase border-t border-white/5 pt-2.5">
                    <div>
                      <span>24h Vol: </span>
                      <span className="text-zinc-300 font-bold">${formatAmount(pool.volume24h, 2)}</span>
                    </div>
                    <div>
                      <span>TVL: </span>
                      <span className="text-cyan-400 font-black">${formatAmount(pool.tvl, 2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DECENRALIZED YIELD STAKING CONTRACTS */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${
          isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
        }`}>
          <div className="flex justify-between items-baseline mb-6 border-b border-white/5 pb-2.5">
            <div>
              <h3 className="text-xs font-black uppercase text-amber-500 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500 animate-pulse" /> Yield Staking Pools
              </h3>
              <p className="text-[9px] text-zinc-550 uppercase tracking-widest mt-0.5">Fixed Yield Smart Reward Contracts</p>
            </div>
            <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-sm uppercase font-black">
              {stakingPoolsList.length} Vaults Live
            </span>
          </div>

          <div className="space-y-4">
            {stakingPoolsList.map((pool) => {
              const detail = tokens[pool.asset] || { name: pool.asset, color: "from-zinc-400 to-zinc-650" };

              return (
                <div 
                  key={pool.asset}
                  className="p-4 rounded-xl bg-black/45 border border-zinc-900/85 hover:border-amber-500/20 transition-all font-mono text-xs"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full bg-gradient-to-r ${detail.color} border border-black flex items-center justify-center text-[8px] font-black text-black`}>{pool.asset[0]}</span>
                      <span className="font-bold text-white text-xs">{pool.asset} Secure Vault</span>
                      <span className="text-[7.5px] bg-amber-500/10 border border-amber-550/20 text-amber-400 px-1 rounded-sm uppercase">Auto-Reward</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Percent className="h-3 w-3 text-cyan-400" />
                      <span className="text-cyan-400 font-black text-xs">APR {pool.apr}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5 space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase font-black block">Total Asset Staked</span>
                      <span className="text-white font-bold">{formatAmount(pool.globalStaked, 4)} <span className="text-[8.5px] text-zinc-500">{pool.asset}</span></span>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5 space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase font-black block">Earning Protocol Asset</span>
                      <span className="text-amber-400 font-extrabold flex items-center gap-1">{pool.rewardToken} Rewards</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-zinc-450 uppercase border-t border-white/5 pt-2.5">
                    <div>
                      <span>Emission Rate: </span>
                      <span className="text-zinc-300 font-bold">Blocks dynamic emission</span>
                    </div>
                    <div>
                      <span>TVL: </span>
                      <span className="text-amber-500 font-black">${formatAmount(pool.tvl, 2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
}
