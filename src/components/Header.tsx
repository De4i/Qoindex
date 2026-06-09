import React from "react";
import { 
  Compass, 
  Wallet, 
  Sun, 
  Moon, 
  Activity, 
  Cpu, 
  Database,
  Unplug,
  RefreshCw
} from "lucide-react";
import { WalletState, MarketTelemetry } from "../types";

interface HeaderProps {
  isLightTheme: boolean;
  setIsLightTheme: (val: boolean) => void;
  walletState: WalletState | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  telemetry: MarketTelemetry | null;
  detectedChainId: number | null;
  setupIopnNetwork: () => Promise<void>;
  onShowWalletModal?: () => void;
}

export default function Header({
  isLightTheme,
  setIsLightTheme,
  walletState,
  connectWallet,
  disconnectWallet,
  telemetry,
  detectedChainId,
  setupIopnNetwork,
  onShowWalletModal,
}: HeaderProps) {
  const shortAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className={`border-b ${
      isLightTheme 
        ? "bg-white border-zinc-200 text-zinc-900" 
        : "bg-[#050505] border-cyan-500/30 text-slate-200"
    } sticky top-0 z-50 backdrop-blur-md`}>
      {/* Glow highlight line */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-amber-500 shadow-[0_1px_10px_rgba(6,182,212,0.5)]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 opacity-75 blur animate-pulse" />
              <div className="relative w-11 h-11 bg-zinc-950 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)]">
                {/* Styled coin with dynamic intersecting lines for QoinDEX */}
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="qoinGold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FBBF24" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Outer mechanical block ring */}
                  <circle cx="16" cy="16" r="14" stroke="url(#qoinGold)" strokeWidth="1.5" strokeDasharray="4 2" className="opacity-70" />
                  
                  {/* Outer solid orbit track */}
                  <circle cx="16" cy="16" r="11" stroke="url(#qoinGold)" strokeWidth="1" className="opacity-40" />
                  
                  {/* Inner dynamic coin body */}
                  <circle cx="16" cy="16" r="8" fill="#09090b" stroke="url(#qoinGold)" strokeWidth="2" />
                  
                  {/* Micro Swap curves representing liquid transactions inside the Q coin */}
                  <path d="M12 14.5L14 12.5M12 14.5L14 16.5M12 14.5H19" stroke="url(#qoinGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 17.5L18 19.5M20 17.5L18 15.5M20 17.5H13" stroke="url(#qoinGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  
                  {/* Stylized Q dynamic lightning tail swipe */}
                  <path d="M21 21.5L27 27.5" stroke="url(#qoinGold)" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
                  <circle cx="27" cy="27" r="1.5" fill="#FBBF24" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className={`text-[21px] font-black tracking-tight uppercase ${
                  isLightTheme 
                    ? "text-slate-900" 
                    : "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 font-sans"
                }`}>
                  QoinDEX
                </span>
                <span className="text-[10px] font-mono text-amber-500 font-black tracking-widest bg-amber-500/10 border border-amber-500/20 px-1 rounded">
                  V3
                </span>
              </div>
              <p className="text-[9px] font-mono tracking-wider text-amber-500 font-extrabold uppercase">
                TEQOIN L2 protocol
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-3 md:space-x-4">
            
            {/* Live Telemetry Display */}
            {telemetry && (
              <div className={`hidden lg:flex items-center space-x-4 pr-4 border-r ${
                isLightTheme ? "border-zinc-200" : "border-zinc-850"
              }`}>
                <div className="text-right">
                  <div className="flex items-center justify-end text-[10px] font-mono text-cyan-500">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 mr-1.5 animate-ping" />
                    Block #{telemetry.blockHeight}
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">Sync Rate: 99.82%</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-amber-500 flex items-center justify-end">
                    <Activity className="h-3 w-3 mr-1" />
                    {telemetry.gasGwei} Gwei
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">Gas Lock: Safe</p>
                </div>
              </div>
            )}

            {/* Dark & Light Toggle */}
            <button
              id="theme-toggle"
              onClick={() => setIsLightTheme(!isLightTheme)}
              className={`p-2.5 rounded-lg border transition-all duration-300 ${
                isLightTheme 
                  ? "bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-400" 
                  : "bg-slate-900 border-cyan-500/20 text-cyan-400 hover:bg-slate-850 hover:border-cyan-400/50"
              }`}
              title="Toggle Cyber Theme"
            >
              {isLightTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Wallet Integration Segment */}
            {walletState ? (
              <div className="flex items-center space-x-2">
                {detectedChainId !== null && detectedChainId !== 420377 && (
                  <button
                    onClick={setupIopnNetwork}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-black uppercase text-[10px] tracking-wider rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                    title="Switch wallet network to TeQoin L2"
                  >
                    <Cpu className="h-3.5 w-3.5 text-black" />
                    <span>Wrong Network</span>
                  </button>
                )}

                <button
                  id="wallet-copy-trigger"
                  onClick={onShowWalletModal}
                  className={`flex flex-col items-end px-2.5 py-1 border rounded font-mono transition-all cursor-pointer text-right group ${
                    isLightTheme 
                      ? "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900" 
                      : "bg-black/40 hover:bg-[#00101d]/25 border border-amber-500/30 hover:border-amber-400 text-amber-300"
                  }`}
                  title="Click to view details & copy address"
                >
                  <span className={`text-[9px] sm:text-[10px] uppercase group-hover:text-amber-500 flex items-center font-bold tracking-tight transition-colors ${
                    isLightTheme ? "text-amber-800" : "text-zinc-550"
                  }`}>
                    <Database className="h-2 w-2 mr-1 text-amber-500 group-hover:animate-bounce" />
                    TeQoin L2
                  </span>
                  <span className={`text-[10px] sm:text-xs font-bold font-mono group-hover:text-amber-600 ${
                    isLightTheme ? "text-amber-900" : "text-amber-300"
                  }`}>
                    {shortAddress(walletState.address)}
                  </span>
                </button>

                <button
                  id="wallet-disconnect"
                  onClick={disconnectWallet}
                  className={`px-3 py-2 border rounded-sm text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    isLightTheme 
                      ? "bg-slate-100 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-slate-700"
                      : "bg-zinc-900 border-white/5 hover:border-rose-500/40 text-slate-300 hover:text-rose-400"
                  }`}
                  title="Disconnect Wallet"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Disconnect</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  id="web3-connect"
                  onClick={connectWallet}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black uppercase text-[10px] tracking-widest rounded-sm shadow-[2.5px_2.5px_0px_rgba(217,70,239,0.30)] active:translate-y-0.5 hover:scale-[1.01] transition-all cursor-pointer"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
