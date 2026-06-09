import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Coins, 
  Gift, 
  Droplet, 
  Gauge, 
  Clock, 
  Sliders, 
  TrendingUp,
  Cpu,
  Info,
  Hourglass,
  Unlock,
  CheckCircle
} from "lucide-react";
import { WalletState, formatAmount, CONTRACTS } from "../types";

interface StakingProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  onStake: (token: string, amount: number) => void;
  onUnstake: (token: string, amount: number) => void;
  onClaimRewards: () => void;
  onClaimFaucet: (token: string) => void;
  onUpdateAutoWithdraw: (nbladLimit: number, de4iLimit: number, enabled: boolean) => void;
  triggerNotification: (title: string, desc: string, type: "success" | "info" | "warning") => void;
  connectWallet?: () => void;
}

const STAKE_ASSETS = ["USDC", "USDT", "DAI", "ETH"] as const;
type StakeAsset = typeof STAKE_ASSETS[number];

const STAKE_ASSET_INFOS: Record<StakeAsset, { name: string; color: string; decimals: number; iconColor: string; description: string }> = {
  USDC: { name: "USD Coin", color: "text-indigo-400", decimals: 6, iconColor: "bg-indigo-505/10 text-indigo-400", description: "Earn QOIN rewards by staking high liquidity USDC" },
  USDT: { name: "Tether USD", color: "text-emerald-450", decimals: 6, iconColor: "bg-emerald-500/10 text-emerald-450", description: "Earn QOIN rewards by staking multi-chain collateralized USDT" },
  DAI: { name: "Dai Stablecoin", color: "text-yellow-500", decimals: 18, iconColor: "bg-yellow-505/10 text-yellow-500", description: "Earn QOIN rewards by staking decentralized DAI stable tokens" },
  ETH: { name: "Ethereum Coin", color: "text-cyan-400", decimals: 18, iconColor: "bg-cyan-500/10 text-cyan-400", description: "Earn high yield QOIN rewards by staking native ETH L2 coins" },
};

export default function Staking({
  isLightTheme,
  walletState,
  onStake,
  onUnstake,
  onClaimRewards,
  onClaimFaucet,
  onUpdateAutoWithdraw,
  triggerNotification,
  connectWallet,
}: StakingProps) {
  const [activeTab, setActiveTab] = useState<"STAKE" | "UNSTAKE" | "CONFIG">("STAKE");
  const [selectedAsset, setSelectedAsset] = useState<StakeAsset>("USDC");
  const [amount, setAmount] = useState<string>("");

  // Faucet timer countdown (claims ETH now)
  const [faucetCooldownLeft, setFaucetCooldownLeft] = useState<number>(0);

  // Auto-withdraw thresholds
  const [qoinThreshold, setQoinThreshold] = useState<string>("500");
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState<boolean>(false);

  // Real-time ticking rewards per asset
  const [realtimeRewards, setRealtimeRewards] = useState<Record<StakeAsset, number>>({
    USDC: 0,
    USDT: 0,
    DAI: 0,
    ETH: 0,
  });

  // Calculate real-time yields tick by tick
  useEffect(() => {
    if (!walletState?.staking) {
      setRealtimeRewards({ USDC: 0, USDT: 0, DAI: 0, ETH: 0 });
      return;
    }

    const interval = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const data = walletState.staking;

      const claimableFromPool = (asset: StakeAsset) => {
        const pool = data[asset];
        if (!pool) return 0;
        let pending = pool.qoinRewardDebt || 0;
        if (pool.amountStaked > 0 && pool.lastStakedTime > 0) {
          const elapsed = Math.max(0, nowSec - pool.lastStakedTime);
          
          if (asset === "ETH") {
            // For ETH: rate represents QOIN rewards per hour per 1 ETH staked
            pending += (pool.amountStaked * (pool.rate || 10000) * elapsed) / 3600;
          } else {
            // For ERC20: rate represents QOIN rewards per hour per 1000 tokens staked
            pending += (pool.amountStaked * (pool.rate || 10) * elapsed) / (3600 * 1000);
          }
        }
        return pending;
      };

      const calculated = {
        USDC: claimableFromPool("USDC"),
        USDT: claimableFromPool("USDT"),
        DAI: claimableFromPool("DAI"),
        ETH: claimableFromPool("ETH"),
      };

      setRealtimeRewards(calculated);

      // Auto-dispatch check for convenience
      const totalAccrued = calculated.USDC + calculated.USDT + calculated.DAI + calculated.ETH;
      if (walletState.autoWithdrawThresholds?.enabled) {
        const thresholdLimit = walletState.autoWithdrawThresholds.QOIN || 500;
        if (totalAccrued >= thresholdLimit) {
          triggerNotification(
            "Auto Dispatch Triggered",
            `Automatic harvest dispatched! Cumulative QOIN rewards (${formatAmount(totalAccrued, 4)}) exceeded threshold.`,
            "success"
          );
          onClaimRewards();
        }
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [walletState, onClaimRewards, triggerNotification]);

  // Faucet timer countdown tracking (ETH faucet cooldown: 24h)
  useEffect(() => {
    if (!walletState) return;
    const interval = setInterval(() => {
      const lastClaim = walletState.faucetClaims?.ETH || 0;
      const now = Date.now();
      const left = Math.max(0, (lastClaim + 86400000) - now);
      setFaucetCooldownLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [walletState]);

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      triggerNotification("Invalid Amount", "Please input a positive numeric value to proceed.", "warning");
      return;
    }

    if (activeTab === "STAKE") {
      const bal = walletState?.balances[selectedAsset] || 0;
      if (val > bal) {
        triggerNotification(
          `Insufficient ${selectedAsset} Balance`,
          `Your wallet only holds ${formatAmount(bal, 4)} ${selectedAsset}. Claim faucet or swap other assets to get more ${selectedAsset}!`,
          "warning"
        );
        return;
      }
      onStake(selectedAsset, val);
    } else {
      const stakedBal = walletState?.staking[selectedAsset]?.amountStaked || 0;
      if (val > stakedBal) {
        triggerNotification(
          "Exceeds Staked Balance",
          `Cannot unstake more than currently pooled. Maximum unlocked limit: ${formatAmount(stakedBal, 4)} ${selectedAsset}`,
          "warning"
        );
        return;
      }
      onUnstake(selectedAsset, val);
    }
    setAmount("");
  };

  const formattedTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Ready";
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUpdateConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const thresh = parseFloat(qoinThreshold);
    onUpdateAutoWithdraw(thresh, 0, autoWithdrawEnabled);
  };

  const activeWalletBal = walletState?.balances[selectedAsset] || 0;
  const activeStakedBal = walletState?.staking[selectedAsset]?.amountStaked || 0;

  const totalRewards = STAKE_ASSETS.reduce((acc, asset) => acc + (realtimeRewards[asset] || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* 24-HOUR NATIVE ETH FAUCET MODULE */}
      <div className={`p-6 border rounded-xl relative overflow-hidden transition-all duration-300 ${
        isLightTheme 
          ? "bg-white border-zinc-200" 
          : "bg-slate-900/50 border-fuchsia-500/20 shadow-[0_0_20px_rgba(217,70,239,0.05)] backdrop-blur-xl"
      }`}>
        <div className="absolute top-0 right-0 p-1 text-[8px] font-mono text-slate-500 tracking-wider">ETH_FAUCET_v5</div>
        
        <div className="flex flex-col sm:flex-row items-baseline justify-between mb-4">
          <div>
            <h3 className="text-sm font-sans font-black uppercase text-amber-500 flex items-center gap-1.5 animate-pulse">
              <Droplet className="h-4 w-4 text-amber-500" />
              L2 Native ETH Faucet
            </h3>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Reclaim Native ETH coins every 24 hours</p>
          </div>
          <p className="text-xs font-mono text-slate-400">Claims Limit: <span className="text-amber-500 font-bold">0.001 ETH / Claim</span></p>
        </div>

        <div className="max-w-xl">
          <div className="p-4 bg-black/40 border border-white/5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-mono font-extrabold text-xs text-zinc-200 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-400" /> Smart Gas Dispenser
              </p>
              <div className="text-[10px] font-mono mt-1 text-slate-400 lowercase leading-relaxed">
                {walletState?.balances?.ETH && walletState.balances.ETH < 0.0003 ? (
                  <p>
                    <span className="text-cyan-400 font-bold uppercase">🤖 GASLESS MODE ROUTED:</span> wallet has 0 ETH. Clicking trigger sends a delegate claim on-chain funded by our backend sponsor for 100% free!
                  </p>
                ) : (
                  <p>
                    <span className="text-amber-400 font-bold uppercase">⚡ ON-CHAIN MODE ROUTED:</span> wallet has native gas. Transaction will be signed and estimated on-chain directly through your browser wallet.
                  </p>
                )}
              </div>
              <p className="text-[10px] font-mono mt-2.5 text-slate-500 uppercase flex items-center gap-1">
                <Clock className="h-3 w-3" /> Cooldown: {faucetCooldownLeft > 0 ? formattedTimeRemaining(faucetCooldownLeft) : "INACTIVE"}
              </p>
            </div>
            <button
              onClick={() => {
                if (!walletState) {
                  connectWallet?.();
                } else {
                  onClaimFaucet("ETH");
                }
              }}
              disabled={walletState ? faucetCooldownLeft > 0 : false}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-sm font-sans text-xs font-black uppercase transition-all tracking-wide cursor-pointer flex-shrink-0 ${
                walletState && faucetCooldownLeft > 0
                  ? "bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed"
                  : "bg-amber-500 text-black hover:scale-[1.02] shadow-[0_0_15px_rgba(245,158,11,0.25)]"
              }`}
            >
              {faucetCooldownLeft > 0 ? "Locked" : !walletState ? "Connect Wallet" : (walletState?.balances?.ETH && walletState.balances.ETH < 0.0003 ? "Sponsor Me" : "Claim Faucet")}
            </button>
          </div>
        </div>



        <div className="mt-4 p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="relative flex h-2 w-2 mt-1 sm:mt-0 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <p className="text-[10.5px] font-mono text-slate-300 leading-relaxed">
              <span className="text-amber-500 font-bold">SMART FAUCET COORDINATES:</span> Faucet claims are handled entirely by our transparent smart contract at <strong className="text-amber-400 hover:underline select-all font-bold">{CONTRACTS.Faucet}</strong>. Secure gasless routing utilizes standard ENV private keys on the backend without any client file leaks!
            </p>
          </div>
        </div>
      </div>

      {/* CORE STAKING ACTION HUB & MONITORING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Real-time Staking Stats Column */}
        <div className={`p-6 border rounded-xl lg:col-span-2 relative transition-all duration-300 ${
          isLightTheme 
            ? "bg-white border-zinc-200" 
            : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
        }`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-500 opacity-60"></div>

          <div className="flex justify-between items-baseline mb-6 pt-2">
            <div>
              <h3 className="text-sm font-sans font-black uppercase text-amber-500 flex items-center gap-1.5 animate-pulse">
                <Gauge className="h-4 w-4 text-amber-500" />
                Multi-Asset Yield Farming
              </h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Stake USDC, USDT, DAI, and ETH to earn native QOIN reward tokens stably on-chain</p>
            </div>
            <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-mono text-amber-400 font-bold uppercase">
              REWARDS TOKEN: QOIN
            </div>
          </div>

          {/* Locked Assets grid details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-black/40 border border-zinc-900 font-mono">
              <p className="text-[8px] text-zinc-550 uppercase font-black">Yield Pool Selected</p>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {formatAmount(activeStakedBal, 4)}{" "}
                <span className="text-xs text-slate-500">{selectedAsset} Staked</span>
              </p>
              <p className="text-[8px] mt-1 text-slate-500 uppercase">
                Status: <span className="text-emerald-500">ACTIVE & EARNING QOIN</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-zinc-900 font-mono flex items-center justify-between">
              <div>
                <p className="text-[8px] text-zinc-550 uppercase font-black block">Yield Performance</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-emerald-450">Multi-yield Pools</span>
                  <span className="text-[9px] py-0.5 px-1.5 rounded-full bg-emerald-500/10 text-emerald-450 font-bold">100% On-chain</span>
                </div>
                <p className="text-[8.5px] text-slate-500 mt-1 uppercase font-bold">Staking yields on-chain rewards instantly</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/15" />
            </div>
          </div>

          {/* REAL-TIME REWARDS EARNED DASHBOARD */}
          <div className="p-4 bg-black/40 border border-white/5 rounded-lg space-y-4">
            <div className="flex justify-between items-baseline border-b border-cyan-500/10 pb-2.5">
              <span className="text-xs font-sans font-black uppercase text-zinc-300 flex items-center gap-1.5"><Gift className="h-4 w-4 text-amber-500" /> Real-time Accrued QOIN Earnings</span>
              <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-amber-505 animate-pulse" /> Live blocks ticking</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {STAKE_ASSETS.map(asset => {
                const pool = walletState?.staking?.[asset];
                const poolStaked = pool?.amountStaked || 0;
                const hourlyRate = pool?.rate || (asset === "ETH" ? 10000 : 10);
                
                // Calculates daily yield representation
                const mult = asset === "ETH" ? 1 : 1000;
                const estDailyGains = ((poolStaked * hourlyRate * 24) / mult);

                return (
                  <div 
                    key={asset} 
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-300 ${
                      selectedAsset === asset 
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:border-zinc-700"
                    }`}
                  >
                    <p className={`text-[8.4px] font-mono uppercase font-black ${STAKE_ASSET_INFOS[asset].color}`}>{asset} Pool</p>
                    <p className="text-lg font-mono font-black text-white mt-1">
                      {formatAmount(realtimeRewards[asset], 6)} <span className="text-[9px] text-amber-500 font-bold">QOIN</span>
                    </p>
                    <p className="text-[8px] font-mono text-slate-500 mt-0.5">Staked: {formatAmount(poolStaked, 4)}</p>
                    <p className="text-[8px] font-mono text-slate-500 mt-0.5">+{formatAmount(estDailyGains, 3)} QOIN /day</p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClaimRewards}
              disabled={!walletState || totalRewards <= 0}
              className={`w-full py-4 rounded-sm font-sans font-black text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                !walletState || totalRewards <= 0
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-amber-500 via-fuchsia-600 to-cyan-500 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.3)] active:translate-y-0.5"
              }`}
            >
              Harvest All QOIN Rewards (Real-Time Batch)
            </button>
          </div>

        </div>

        {/* Stake lock interaction */}
        <div className={`p-6 border rounded-xl relative transition-all duration-300 flex flex-col justify-between ${
          isLightTheme 
            ? "bg-white border-zinc-200" 
            : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
        }`}>
          <div>
            <div className="flex bg-black/40 border border-white/5 p-1 rounded-sm mb-4">
              {["STAKE", "UNSTAKE", "CONFIG"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as "STAKE" | "UNSTAKE" | "CONFIG")}
                  className={`cursor-pointer w-full text-center py-2 rounded-sm text-[9px] font-mono font-black uppercase transition-all tracking-wider ${
                    activeTab === tab
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-extrabold"
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab !== "CONFIG" && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                
                {/* Active Token Information */}
                <div>
                  <label className="text-[8px] font-bold uppercase text-slate-500 block mb-1">Select Staking Asset Pool</label>
                  <div className="grid grid-cols-4 gap-2">
                    {STAKE_ASSETS.map(asset => (
                      <button
                        type="button"
                        key={asset}
                        onClick={() => {
                          setSelectedAsset(asset);
                          setAmount("");
                        }}
                        className={`py-1.5 rounded-md font-mono text-xs font-black border transition-all ${
                          selectedAsset === asset
                            ? "bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                            : "bg-black/40 border-white/5 text-slate-400 hover:border-zinc-700"
                        }`}
                      >
                        {asset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 font-mono p-3 border border-zinc-950/60 bg-black/40 rounded-lg text-center">
                  <label className="text-[8px] font-bold uppercase text-slate-500 block">Reward asset</label>
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">TeQoin Token (QOIN)</span>
                </div>

                {/* Amount lock-in */}
                <div className={`p-3.5 rounded border ${
                   isLightTheme ? "bg-white border-zinc-200" : "bg-black/40 border border-white/5"
                }`}>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1">
                    <span>
                      {activeTab === "STAKE" ? "Max lockable:" : "Lock active limit:"}
                    </span>
                    <span 
                      onClick={() => {
                        const maxVal = activeTab === "STAKE" ? activeWalletBal : activeStakedBal;
                        setAmount(maxVal.toString());
                      }}
                      className="text-amber-400 cursor-pointer hover:font-bold underline text-[9px]"
                    >
                      {activeTab === "STAKE"
                        ? `${formatAmount(activeWalletBal, 4)}`
                        : `${formatAmount(activeStakedBal, 4)}`
                      } {selectedAsset}
                    </span>
                  </div>

                  <input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full bg-transparent border-none text-xl outline-none font-bold font-mono py-1 ${
                      isLightTheme ? "text-zinc-900" : "text-slate-100"
                    }`}
                    style={{ caretColor: "#f59e0b" }}
                    step="any"
                    required
                  />
                </div>

                {walletState ? (
                  <button
                    type="submit"
                    className="w-full py-4 rounded-sm font-sans font-black text-xs uppercase text-black bg-gradient-to-r from-amber-500 via-fuchsia-600 to-cyan-500 tracking-widest hover:scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.3)] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {activeTab === "STAKE" ? <Coins className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {activeTab === "STAKE" ? `Stake ${selectedAsset}` : `Unstake ${selectedAsset}`}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={connectWallet}
                      className="w-full py-4 rounded-sm bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-sans font-black text-xs uppercase tracking-widest hover:scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.3)] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}

              </form>
            )}

            {activeTab === "CONFIG" && (
              <form onSubmit={handleUpdateConfig} className="space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2.5">
                  <span className="text-[10px] font-mono text-amber-500 uppercase font-black">Enable Harvest Automatons</span>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto-thresh"
                      checked={autoWithdrawEnabled}
                      onChange={(e) => setAutoWithdrawEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="auto-thresh"
                      className="relative w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-white cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="text-slate-500 text-[9px] uppercase block mb-1">Rewards Auto-Claim Threshold (Qty)</label>
                    <input
                      type="number"
                      value={qoinThreshold}
                      onChange={(e) => setQoinThreshold(e.target.value)}
                      className={`w-full border px-3 py-2 rounded-lg font-bold outline-none font-mono text-xs ${
                        isLightTheme ? "bg-white border-zinc-200 text-zinc-900" : "bg-black/40 border border-white/5 text-slate-200"
                      }`}
                      placeholder="500 Rewards"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-sm border border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-sans text-xs font-black uppercase transition-all tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" /> Save Auto Harvester Set
                </button>
              </form>
            )}
          </div>

          <div className="text-[9px] font-mono text-slate-500 justify-end border-t border-cyan-500/10 pt-3 mt-4 leading-relaxed font-bold">
            * Yield formulas are 100% automated on-chain. Staking performs real transactions on the TeQoin L2 Blockchain.
          </div>
        </div>

      </div>

    </div>
  );
}
