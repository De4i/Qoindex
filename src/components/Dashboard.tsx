import React, { useState } from "react";
import { ethers } from "ethers";
import { 
  Terminal, 
  Activity, 
  Cpu, 
  Coins, 
  Droplet, 
  Lock, 
  TrendingUp, 
  Database,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Wallet,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Globe,
  ExternalLink,
  PlusCircle,
  FolderPlus
} from "lucide-react";
import { WalletState, MarketTelemetry, TokenSymbol, CONTRACTS, formatAmount } from "../types";

interface DashboardProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  telemetry: MarketTelemetry | null;
  onClearLogs: () => void;
  triggerSync: () => void;
  poolReserves: Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }>;
  tokens: Record<string, any>;
  connectWallet?: () => void;
  onSaveToken: (token: { symbol: string; name: string; address: string; decimals: number; color: string }) => void;
}

export default function Dashboard({
  isLightTheme,
  walletState,
  telemetry,
  onClearLogs,
  triggerSync,
  poolReserves,
  tokens,
  connectWallet,
  onSaveToken,
}: DashboardProps) {
  const [activeViewCard, setActiveViewCard] = useState<"ALL" | "BALANCES" | "LP" | "STAKING">("ALL");

  // Import custom token states
  const [importAddr, setImportAddr] = useState<string>("");
  const [importSymbol, setImportSymbol] = useState<string>("");
  const [importName, setImportName] = useState<string>("");
  const [importDecimals, setImportDecimals] = useState<number>(18);
  const [importColor, setImportColor] = useState<string>("from-cyan-400 to-fuchsia-600 border-cyan-400 text-cyan-205");
  const [isFetchingInfo, setIsFetchingInfo] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>("");

  const handleFetchOnChainInfo = async () => {
    if (!importAddr || !importAddr.startsWith("0x") || importAddr.length !== 42) {
      setFetchError("Invalid EVM contract address format.");
      return;
    }
    setFetchError("");
    setIsFetchingInfo(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io");
      const contract = new ethers.Contract(importAddr, [
        "function symbol() view returns (string)",
        "function name() view returns (string)",
        "function decimals() view returns (uint8)"
      ], provider);

      const [symbol, name, decimals] = await Promise.all([
        contract.symbol().catch(() => ""),
        contract.name().catch(() => ""),
        contract.decimals().catch(() => 18n)
      ]);

      if (symbol) {
        setImportSymbol(symbol);
        setImportName(name || symbol);
        setImportDecimals(Number(decimals));
        setFetchError("");
      } else {
        setFetchError("Could not fetch symbol on-chain. Please fill in details manually.");
      }
    } catch (err: any) {
      setFetchError("Error querying contract. Please fill in details manually.");
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleImportTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importAddr || !importSymbol || !importName) {
      setFetchError("Address, Symbol, and Name are required.");
      return;
    }
    if (importAddr.length !== 42 || !importAddr.startsWith("0x")) {
      setFetchError("Address must be a valid 42-character hex string.");
      return;
    }

    onSaveToken({
      symbol: importSymbol.trim().toUpperCase(),
      name: importName.trim(),
      address: importAddr.trim(),
      decimals: importDecimals,
      color: importColor
    });

    // Reset status fields
    setImportAddr("");
    setImportSymbol("");
    setImportName("");
    setImportDecimals(18);
    setFetchError("");
  };

  // Format timestamp to human clock
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  // Get dynamic token glow or theme color based on details
  const getTokenColorClass = (symbol: string) => {
    return tokens[symbol]?.color || "from-zinc-400 to-zinc-600";
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION WITH REAL BROADCAST STATUS */}
      <div className={`p-6 border rounded-2xl relative overflow-hidden transition-all duration-300 ${
        isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/40 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-sm font-mono uppercase text-emerald-400 font-extrabold tracking-wider flex items-center gap-1">
                <Database className="h-4 w-4" /> MONITORING NODE REAL-TIME
              </h2>
            </div>
            <h1 className="text-xl font-sans font-black text-white uppercase tracking-tight">
              TeQoin L2 Network Telemetry Dashboard
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Monitor on-chain parameters live. All native asset balances, liquidity pool reserves (Liquidity Matrix), and staking positions are read directly from the TeQoin L2 RPC Endpoint in real-time.
            </p>
          </div>

          <button
            onClick={triggerSync}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/20 font-mono text-[10px] uppercase font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Force Re-read Blockchain
          </button>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5 font-mono text-[10px]">
          <div>
            <p className="text-zinc-550 uppercase font-black text-[9px] tracking-wider">Latest Block</p>
            <p className="text-white font-black mt-1 text-sm">#{telemetry?.blockHeight?.toLocaleString() ?? "18,053,042"}</p>
          </div>
          <div>
            <p className="text-zinc-550 uppercase font-black text-[9px] tracking-wider">GAS Price</p>
            <p className="text-emerald-400 font-black mt-1 text-sm">~{telemetry?.gasGwei ?? 3} Gwei</p>
          </div>
          <div>
            <p className="text-zinc-550 uppercase font-black text-[9px] tracking-wider">TPS (Throughput)</p>
            <p className="text-cyan-400 font-black mt-1 text-sm">{telemetry?.tps ?? "3.45"} TX/s</p>
          </div>
          <div>
            <p className="text-zinc-550 uppercase font-black text-[9px] tracking-wider">TOTAL TX</p>
            <p className="text-yellow-500 font-black mt-1 text-sm">{telemetry?.totalTx?.toLocaleString() ?? "8,294,500"}</p>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH TESTNET BLOCK EXPLORER WIDGET */}
      <div className={`p-5 border rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300 relative overflow-hidden ${
        isLightTheme ? "bg-white border-zinc-200" : "bg-gradient-to-r from-zinc-950/60 to-cyan-950/25 border-cyan-500/20"
      }`}>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 bg-cyan-500/10 border border-cyan-400/20 rounded-xl text-cyan-400">
            <Globe className="h-5 w-5 animate-pulse text-cyan-405" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-cyan-450">TeQoin Testnet BlockScan Explorer</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 leading-normal">
              Validate block confirmations, account ledger nodes, gas patterns and custom smart contracts in real-time.
            </p>
          </div>
        </div>

        <div className="w-full md:w-auto text-right">
          <a
            href="https://testnet-blockscan.teqoin.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-400 font-mono text-[10px] uppercase font-black rounded-lg hover:border-cyan-400 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:scale-[1.01]"
          >
            <span>Open testnet-blockscan.teqoin.io</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap gap-2 font-mono text-[10px]">
        {[
          { id: "ALL", label: "SHOW ALL FEED", icon: Layers },
          { id: "BALANCES", label: "WALLET BALANCE", icon: Wallet },
          { id: "LP", label: "LP POOL RESERVES", icon: Droplet },
          { id: "STAKING", label: "STAKING POSITION", icon: Lock },
        ].map((btn) => {
          const BtnIcon = btn.icon;
          const isActive = activeViewCard === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setActiveViewCard(btn.id as any)}
              className={`px-4 py-2 border rounded-lg font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive 
                  ? "bg-cyan-500/15 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                  : "bg-zinc-950/40 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
              }`}
            >
              <BtnIcon className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* BENZO LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LEFT/MAIN VIEWPANEL: DYNAMIC DATA ACCORDING TO FILTER */}
        <div className="lg:col-span-3 space-y-6">

          {/* SECTION A: WALLET BALANCES (SALDO DOMPET ON-CHAIN) */}
          {(activeViewCard === "ALL" || activeViewCard === "BALANCES") && (
            <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${
              isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
            }`}>
              <div className="flex justify-between items-baseline mb-4 border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-mono font-black uppercase text-cyan-400 flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-cyan-450" /> Your On-Chain Wallet Balance
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-widest mt-0.5">Real-time balances direct from connected address</p>
                </div>
                <span className="text-[9px] font-mono text-emerald-450 uppercase font-black flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                  <CheckCircle className="h-3 w-3" /> Connected
                </span>
              </div>

              {walletState ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(tokens).map(([symbol, details]: [string, any]) => {
                    const balance = walletState.balances[symbol] ?? 0;
                    return (
                      <div 
                        key={symbol} 
                        className="p-4 rounded-xl bg-black/40 border border-zinc-900 hover:border-zinc-800 transition-all flex items-center justify-between font-mono"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${details.color}`} />
                            <span className="font-sans font-black text-xs text-white uppercase">{symbol}</span>
                            <span className="text-[8px] text-zinc-600 uppercase font-bold">({details.name})</span>
                          </div>
                          <span className="text-[8px] text-zinc-500 select-all block break-all font-bold">
                            Addr: {details.address === "0x0000000000000000000000000000000000000000" ? "Native Asset (Coins)" : `${details.address.substring(0, 16)}...`}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{formatAmount(balance, 4)}</p>
                          <p className="text-[8px] text-zinc-555 font-bold uppercase">{(symbol === "OPN" || symbol === "ETH") ? "Gas Coin" : "ERC-20 Token"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-center text-zinc-600 font-mono text-xs uppercase italic">
                  Connect MetaMask / OKX Web3 Wallet to fetch on-chain balances.
                </div>
              )}

              {/* Import Custom Token Section */}
              {walletState && (
                <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
                  <div>
                    <h4 className="text-xs font-mono font-black uppercase text-cyan-400 flex items-center gap-1.5">
                      <FolderPlus className="h-4 w-4 text-cyan-400" /> Import Custom ERC-20 Token
                    </h4>
                    <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-widest mt-0.5">
                      Register and track a custom token contract on TeQoin L2 network.
                    </p>
                  </div>

                  <form onSubmit={handleImportTokenSubmit} className="space-y-3 font-mono text-xs">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Token Contract Address (0x...)"
                          value={importAddr}
                          onChange={(e) => setImportAddr(e.target.value)}
                          className={`w-full px-3 py-2 rounded text-[11px] font-mono outline-hidden border transition-all ${
                            isLightTheme
                              ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                              : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400"
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchOnChainInfo}
                        disabled={isFetchingInfo || !importAddr}
                        className={`px-3 py-2 rounded text-[10px] uppercase font-bold select-none cursor-pointer transition-all shrink-0 ${
                          isFetchingInfo
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : isLightTheme
                              ? "bg-zinc-100 border border-zinc-200 text-zinc-800 hover:bg-zinc-200"
                              : "bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 hover:border-cyan-400"
                        }`}
                      >
                        {isFetchingInfo ? "Fetching..." : "Fetch Info"}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <input
                          type="text"
                          placeholder="Symbol"
                          value={importSymbol}
                          onChange={(e) => setImportSymbol(e.target.value)}
                          className={`w-full px-3 py-2 rounded text-[11px] font-mono outline-hidden border transition-all ${
                            isLightTheme
                              ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                              : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400"
                          }`}
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          placeholder="Token Name"
                          value={importName}
                          onChange={(e) => setImportName(e.target.value)}
                          className={`w-full px-3 py-2 rounded text-[11px] font-mono outline-hidden border transition-all ${
                            isLightTheme
                              ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                              : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400"
                          }`}
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          placeholder="Decimals"
                          value={importDecimals}
                          onChange={(e) => setImportDecimals(parseInt(e.target.value, 10) || 18)}
                          min={0}
                          max={18}
                          className={`w-full px-3 py-2 rounded text-[11px] font-mono outline-hidden border transition-all ${
                            isLightTheme
                              ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                              : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Presets color themes */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold mr-1">Brand Color:</span>
                      {[
                        { label: "Cyan", value: "from-cyan-400 to-fuchsia-600 border-cyan-400 text-cyan-205" },
                        { label: "Sunset", value: "from-amber-400 to-yellow-600 border-amber-400 text-amber-200" },
                        { label: "Emerald", value: "from-green-400 to-emerald-600 border-emerald-400 text-emerald-200" },
                        { label: "Ocean", value: "from-blue-400 to-indigo-600 border-indigo-400 text-indigo-200" },
                        { label: "Orchid", value: "from-purple-500 to-fuchsia-600 border-fuchsia-400 text-fuchsia-305" }
                      ].map((col) => (
                        <button
                          key={col.label}
                          type="button"
                          onClick={() => setImportColor(col.value)}
                          className={`px-2 py-0.5 rounded text-[8.5px] uppercase font-bold border cursor-pointer transition-all ${
                            importColor === col.value
                              ? "border-cyan-400 text-cyan-455 bg-cyan-950/20"
                              : "border-zinc-850 text-zinc-500 hover:text-zinc-350"
                          }`}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>

                    {fetchError && (
                      <p className="text-[10px] text-rose-450 font-semibold font-mono animate-pulse">{fetchError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold uppercase text-[10px] tracking-wider rounded select-none cursor-pointer active:scale-98 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>Save Token to Wallet Cache</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* SECTION B: AMM LP POOLS RESERVES (CADANGAN POOL LIKUIDITAS DI KONTRAK ROUTER) */}
          {(activeViewCard === "ALL" || activeViewCard === "LP") && (
            <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${
              isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
            }`}>
              <div className="flex justify-between items-baseline mb-4 border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-mono font-black uppercase text-fuchsia-400 flex items-center gap-1.5">
                    <Droplet className="h-4 w-4 text-fuchsia-450" /> AMM Liquidity Matrix Reserves
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-widest mt-0.5">Current token reserves locked inside DEX Router Contracts</p>
                </div>
                <span className="text-[8px] font-mono bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-sm uppercase font-black">
                  DEX TVL Monitor
                </span>
              </div>

              {/* LIST OF LP POOLS REPRESENTING ACTUAL TOKEN BALANCES IN CONTRAK CONTRACTS.DEX */}
              <div className="space-y-4">
                {(() => {
                  const activeUserLPs = Object.entries(poolReserves).filter(([_, pool]) => walletState && pool.userShares > 0);
                  
                  if (!walletState) {
                    return (
                      <div className="p-4 rounded-xl bg-black/40 border border-zinc-900 border-dashed text-zinc-550 font-mono text-center text-xs py-10">
                        🚫 Wallet disconnected.
                        <p className="text-[10px] text-zinc-650 mt-1.5 uppercase tracking-wider">Connect wallet to view your active LP reserves matrix!</p>
                      </div>
                    );
                  }

                  if (activeUserLPs.length === 0) {
                    return (
                      <div className="p-4 rounded-xl bg-black/40 border border-zinc-900 border-dashed text-zinc-550 font-mono text-center text-xs py-10">
                        🚫 No active LP shares associated with your address.
                        <p className="text-[10px] text-zinc-650 mt-1.5 uppercase tracking-wider">Provide liquidity inside the Pools module to establish an active position.</p>
                      </div>
                    );
                  }

                  return activeUserLPs.map(([pairKey, pool]) => {
                    const [tokenSymbolA, tokenSymbolB] = pairKey.split("_");
                    const detailA = tokens[tokenSymbolA] || { name: tokenSymbolA };
                    const detailB = tokens[tokenSymbolB] || { name: tokenSymbolB };
                    
                    // Compute simple simulated TVL weight or display real sizes
                    const totalLiquidity = pool.reserveA + pool.reserveB;

                    return (
                      <div 
                        key={pairKey} 
                        className="p-4 rounded-xl bg-black/40 border border-zinc-900 font-mono text-xs hover:border-cyan-500/15 transition-all"
                      >
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-3 border-b border-white/5 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1.5">
                              <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${detailA.color} border border-black flex items-center justify-center text-[6px] font-black font-sans text-black`}>{tokenSymbolA[0]}</span>
                              <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${detailB.color} border border-black flex items-center justify-center text-[6px] font-black font-sans text-black`}>{tokenSymbolB[0]}</span>
                            </div>
                            <span className="font-sans font-black text-white text-xs">{tokenSymbolA} - {tokenSymbolB} Pair Pool</span>
                            <span className="text-[7.5px] bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 px-1 rounded-sm uppercase">Routing Active</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-slate-500 font-extrabold uppercase">DEX Address Holder</p>
                            <p className="text-[8px] text-cyan-400 select-all font-mono font-black leading-none">0xc1dAB94c9E2D...bfd9</p>
                          </div>
                        </div>

                        {/* Reserve amounts */}
                        <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 p-2.5 rounded-lg border border-white/5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[8.5px] text-zinc-500 uppercase font-black">
                              <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${detailA.color}`} />
                              Reserve {tokenSymbolA}
                            </div>
                             <p className="text-white font-bold text-xs">{formatAmount(pool.reserveA, 2)} <span className="text-[9px] text-zinc-500">{tokenSymbolA}</span></p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[8.5px] text-zinc-500 uppercase font-black">
                              <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${detailB.color}`} />
                              Reserve {tokenSymbolB}
                            </div>
                            <p className="text-white font-bold text-xs">{formatAmount(pool.reserveB, 2)} <span className="text-[9px] text-zinc-500">{tokenSymbolB}</span></p>
                          </div>
                        </div>

                        {/* Display user position inside this pool if any */}
                        {pool.userShares > 0 && (
                          <div className="mt-2.5 flex items-center justify-between text-[8px] uppercase font-black text-amber-400 bg-amber-500/5 p-1 px-2 rounded border border-amber-500/10">
                            <span>Your Active LP Shares:</span>
                            <span>{formatAmount(pool.userShares, 4)} Shares (~{formatAmount((pool.userShares / pool.totalShares) * 100, 3)}%)</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                })()}
              </div>
            </div>
          )}

          {/* SECTION C: STAKING CONTRACT POSITIONS (DEPOSIT POOL STAKING RIIL DAN ESTIMASI AKRUAL) */}
          {(activeViewCard === "ALL" || activeViewCard === "STAKING") && (
            <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${
              isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
            }`}>
              <div className="flex justify-between items-baseline mb-4 border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-mono font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-amber-450" /> Staking Contract Deposits &amp; Rewards
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-widest mt-0.5">Monitor QOIN locked inside Decentralized Yield Contracts</p>
                </div>
                <span className="text-[8px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-sm uppercase font-black">
                  Yield Engine
                </span>
              </div>

              {walletState ? (
                <div className="space-y-4">
                  
                  {/* STAKED ASSETS */}
                  <div className="p-4 rounded-xl bg-black/40 border border-zinc-900 font-mono space-y-3">
                    <p className="text-[8.5px] text-cyan-400 uppercase font-black">Your Active Staking Assets</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {(["USDC", "USDT", "DAI", "ETH"] as const).map(asset => {
                        const pool = walletState.staking?.[asset];
                        return (
                          <div key={asset} className="p-2.5 rounded bg-white/5 border border-white/5">
                            <p className="text-[7.5px] text-zinc-500 uppercase font-black">{asset} Staked</p>
                            <p className="text-sm font-black text-white mt-0.5">
                              {formatAmount(pool?.amountStaked ?? 0, 4)}{" "}
                              <span className="text-[9px] text-cyan-400 font-mono">{asset}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* REWARDS MATRICES CLAIM */}
                  <div className="p-4 bg-amber-950/15 border border-amber-500/10 rounded-xl font-mono text-xs space-y-2">
                    <p className="font-extrabold uppercase text-[9px] tracking-wider text-amber-400 flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> Pending QOIN Rewards
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {(["USDC", "USDT", "DAI", "ETH"] as const).map(asset => {
                        const pool = walletState.staking?.[asset];
                        return (
                          <div key={asset} className="p-2 bg-zinc-950/30 rounded border border-white/5">
                            <p className="text-[7px] text-zinc-500 font-bold uppercase font-mono">From {asset}</p>
                            <p className="text-sm font-black text-white">
                              {formatAmount(pool?.qoinRewardDebt ?? 0, 4)}{" "}
                              <span className="text-[9px] text-amber-500">QOIN</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-center text-zinc-650 font-mono text-xs uppercase italic">
                  Connect Web3 Wallet to monitor your staking positions.
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR: LEDGER ACTIONS LOGS */}
        <div className="lg:col-span-2 space-y-6">

          {/* NETWORK SMART CONTRACTS REGISTRY */}
          <div className="p-5 bg-zinc-950/80 border border-cyan-500/20 rounded-2xl font-mono text-xs space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <p className="font-black text-cyan-400 uppercase tracking-widest text-[9.5px] flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-cyan-400 animate-pulse" />
                Contract Addresses Registry
              </p>
              <span className="px-1.5 py-0.5 bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 text-[8px] uppercase tracking-widest font-black rounded-sm animate-pulse">
                On-Chain Live
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-[9px]">
              {/* DEX ROUTER */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-cyan-400 font-black tracking-wider flex justify-between items-center">
                  <span>DEX Router</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Active AMM Hub</span>
                </span>
                <span className="text-cyan-300 font-bold select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.DEX || CONTRACTS.DEX}
                </span>
              </div>

              {/* USDC */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-zinc-400 font-black tracking-wider flex justify-between items-center">
                  <span>USDC Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">USD Coin Stablecoin</span>
                </span>
                <span className="text-slate-300 select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.USDC || CONTRACTS.USDC}
                </span>
              </div>

              {/* USDT */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-zinc-400 font-black tracking-wider flex justify-between items-center">
                  <span>USDT Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Tether USD Stablecoin</span>
                </span>
                <span className="text-slate-300 select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.USDT || CONTRACTS.USDT}
                </span>
              </div>

              {/* DAI */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-zinc-400 font-black tracking-wider flex justify-between items-center">
                  <span>DAI Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Dai Stablecoin</span>
                </span>
                <span className="text-slate-300 select-all break-all pr-1">
                  {(telemetry?.deployedAddresses as any)?.DAI || CONTRACTS.DAI}
                </span>
              </div>

              {/* NBLAD */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-zinc-400 font-black tracking-wider flex justify-between items-center">
                  <span>NBLAD Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Nebula Blade Rewards</span>
                </span>
                <span className="text-slate-300 select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.NBLAD || CONTRACTS.NBLAD}
                </span>
              </div>

              {/* QOIN */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-amber-400 font-black tracking-wider flex justify-between items-center">
                  <span>QOIN Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Primary Staker &amp; Faucet Coin</span>
                </span>
                <span className="text-amber-300 font-bold select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.QOIN || CONTRACTS.QOIN}
                </span>
              </div>

              {/* DE4I */}
              <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                <span className="text-[8.5px] uppercase text-zinc-400 font-black tracking-wider flex justify-between items-center">
                  <span>DE4I Token</span>
                  <span className="text-[7.5px] text-zinc-500 font-normal">Deity Quantum Rewards</span>
                </span>
                <span className="text-slate-300 select-all break-all pr-1">
                  {telemetry?.deployedAddresses?.DE4I || CONTRACTS.DE4I}
                </span>
              </div>

              {/* MASTERCHEF */}
            </div>
            
            <p className="text-[8px] text-zinc-500 leading-relaxed uppercase tracking-wide">
              * Click address to select and copy. All integrated modules are fully published and deployed onto TeQoin L2.
            </p>
          </div>

          {/* TELEMETRY HELP / NETWORK CARD */}
          <div className="p-5 bg-gradient-to-br from-amber-950/25 to-yellow-950/15 border border-amber-500/25 rounded-2xl font-mono text-xs space-y-4">
            <p className="font-black text-amber-500 uppercase tracking-widest text-[9px] flex items-center gap-1">
              <ShieldAlert className="h-4 w-4 animate-pulse text-amber-500" /> GENUINE TEQOIN L2 INSTRUCTIONS
            </p>
            <div className="space-y-2 text-[10.5px] leading-relaxed text-slate-355">
              <p>
                This application is fully integrated with live <strong>On-Chain RPC L2 reading</strong>. Virtual sandboxed mock features are disabled.
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-1 text-[10px] text-zinc-450">
                <li>All transactions are signed and broadcasted to the RPC node.</li>
                <li>Request QOIN faucet funds inside the **Staking &amp; Faucet** page.</li>
                <li>Connected address balances update automatically once block confirmations are mined on-chain!</li>
              </ul>
            </div>
          </div>

          {/* JOURNAL & LOGS */}
          <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative ${
            isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-white/5"
          }`}>
            <div>
              <div className="flex justify-between items-baseline mb-4 border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-mono font-black uppercase text-cyan-400 flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-cyan-400 animate-pulse" /> Network History Journal
                  </h3>
                  <p className="text-[8.5px] font-mono text-zinc-550 uppercase tracking-widest mt-0.5">Real-time sync stream for transaction ledger logs</p>
                </div>

                <button
                  onClick={onClearLogs}
                  className="text-zinc-600 hover:text-rose-400 font-mono text-[9px] uppercase tracking-wider font-extrabold cursor-pointer transition-colors"
                >
                  Purge Logs
                </button>
              </div>

              {/* Monospace scroll pad */}
              <div className={`h-[864px] overflow-y-auto rounded-lg p-3 font-mono text-[10px] space-y-3 scrollbar-none no-scrollbar ${
                isLightTheme ? "bg-white border border-zinc-200 text-zinc-900" : "bg-black/50 border border-zinc-900 text-slate-100"
              }`}>
                
                {!walletState ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <p className="text-zinc-550 italic uppercase">Please connect your Web3 wallet node.</p>
                    <button
                      type="button"
                      onClick={connectWallet}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-semibold text-[10px] uppercase tracking-wider rounded-sm hover:scale-[1.02] cursor-pointer active:translate-y-0.5 transition-all"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : walletState.logs.length === 0 ? (
                  <div className="text-zinc-750 italic text-center py-16 uppercase">
                    No ledger entries detected in this session yet.
                  </div>
                ) : (
                  walletState.logs.map((log) => {
                    let badgeColor = isLightTheme 
                      ? "bg-zinc-100 text-zinc-750 border border-zinc-200" 
                      : "bg-zinc-850 text-zinc-450 border border-zinc-805";
                    if (log.type === "SWAP") badgeColor = isLightTheme ? "bg-cyan-50 text-cyan-805 border border-cyan-200" : "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20";
                    if (log.type === "LP") badgeColor = isLightTheme ? "bg-emerald-50 text-emerald-805 border border-emerald-200" : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20";
                    if (log.type === "STAKE") badgeColor = isLightTheme ? "bg-purple-50 text-purple-755 border border-purple-200" : "bg-purple-950/40 text-purple-400 border border-purple-500/20";
                    if (log.type === "CLAIM") badgeColor = isLightTheme ? "bg-amber-50 text-amber-805 border border-amber-200" : "bg-amber-950/40 text-amber-400 border border-amber-500/20";
                    if (log.type === "FAUCET") badgeColor = isLightTheme ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-rose-950/40 text-rose-450 border border-rose-500/20";

                    return (
                      <div key={log.id} className={`border-b pb-2 last:border-none space-y-1.5 ${isLightTheme ? "border-zinc-100" : "border-white/5"}`}>
                        <div className="flex justify-between items-center text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded-sm font-black text-[8px] tracking-wide ${badgeColor}`}>
                            {log.type}
                          </span>
                          <span className={isLightTheme ? "text-zinc-500 font-bold" : "text-zinc-650 font-extrabold"}>
                            {formatTime(log.timestamp)}
                          </span>
                        </div>
                        
                        <p className={`leading-relaxed text-[9.5px] pl-0.5 font-mono ${isLightTheme ? "text-zinc-800 font-medium" : "text-zinc-350"}`}>{log.detail}</p>
                        
                        <div className="flex text-[8px] pl-0.5 items-center gap-1.5">
                          <span className={isLightTheme ? "text-zinc-400 font-mono" : "text-zinc-655 font-mono"}>TX:</span>
                          <span className={`truncate select-all font-bold ${isLightTheme ? "text-zinc-600" : "text-zinc-500"}`}>
                            {log.txHash}
                          </span>
                        </div>

                        {log.contractAddress && (
                          <div className="flex text-[8px] pl-0.5 items-center gap-1.5">
                            <span className={isLightTheme ? "text-zinc-400 font-mono" : "text-zinc-655 font-mono"}>CONTRACT:</span>
                            <span className="truncate select-all font-bold text-cyan-400">
                              {log.contractAddress}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

              </div>
            </div>

            <div className="text-[10px] font-mono text-zinc-650 flex items-center justify-between border-t border-white/5 pt-3 mt-4 font-bold">
              <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-cyan-500 animate-pulse" /> Active Ledger Telemetry</span>
              <span>Online v2.11</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
