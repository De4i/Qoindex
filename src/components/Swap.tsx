import React, { useState, useEffect } from "react";
import { 
  ArrowUpDown, 
  Settings, 
  Info, 
  RefreshCw, 
  TrendingUp, 
  HelpCircle,
  TrendingDown
} from "lucide-react";
import { TokenSymbol, WalletState, formatAmount } from "../types";

interface SwapProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  onSwap: (tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountIn: number, expectedOut: number) => void;
  onWrap?: (amount: number) => void;
  onUnwrap?: (amount: number) => void;
  poolReserves: Record<string, { reserveA: number; reserveB: number }>;
  tokens: Record<string, any>;
  connectWallet?: () => void;
}

export default function Swap({
  isLightTheme,
  walletState,
  onSwap,
  onWrap,
  onUnwrap,
  poolReserves,
  tokens,
  connectWallet,
}: SwapProps) {
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("USDC");
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("NBLAD");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Wrap/Unwrap modes
  const [wrapMode, setWrapMode] = useState<boolean>(false);
  const [wrapAction, setWrapAction] = useState<"WRAP" | "UNWRAP">("WRAP");
  const [wrapAmount, setWrapAmount] = useState<string>("");
  
  // Calculated stats
  const [rate, setRate] = useState<number>(0);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [fee, setFee] = useState<number>(0);
  const [errorText, setErrorText] = useState<string>("");

  // Get active pool key and reserve data
  const getPoolInfo = (tIn: TokenSymbol, tOut: TokenSymbol) => {
    const keysInOrder = [tIn, tOut].sort();
    const poolKey = `${keysInOrder[0]}_${keysInOrder[1]}`;
    const reserves = poolReserves[poolKey] || { reserveA: 100000, reserveB: 100000 };
    
    const isTokenA = tIn === keysInOrder[0];
    return {
      reserveIn: isTokenA ? reserves.reserveA : reserves.reserveB,
      reserveOut: isTokenA ? reserves.reserveB : reserves.reserveA,
      exist: !!poolReserves[poolKey]
    };
  };

  // Perform swap math on input change
  useEffect(() => {
    const parsedAmount = parseFloat(amountIn);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountOut("");
      setPriceImpact(0);
      setRate(0);
      setFee(0);
      setErrorText("");
      return;
    }

    // Check balances
    const userBalance = walletState?.balances[tokenIn] || 0;
    if (parsedAmount > userBalance) {
      setErrorText("Insufficient balance in cyber account");
    } else {
      setErrorText("");
    }

    const { reserveIn, reserveOut } = getPoolInfo(tokenIn, tokenOut);
    
    const isStableSwap = (tokenIn === "USDC" && tokenOut === "USDT") || (tokenIn === "USDT" && tokenOut === "USDC");
    
    if (isStableSwap) {
      const dy = parsedAmount;
      setAmountOut(parseFloat(dy.toFixed(6)).toString());
      setRate(1.0);
      setFee(0);
      setPriceImpact(0);
    } else {
      // Swap math dy = (reserveOut * dx * 0.997) / (reserveIn + dx * 0.997)
      const amountInWithFee = parsedAmount * 0.997;
      const dy = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
      
      setAmountOut(parseFloat(dy.toFixed(6)).toString());
      
      // Traditional exchange rate: dy / dx
      const currentRate = dy / parsedAmount;
      setRate(currentRate);

      // Price details
      setFee(parsedAmount * 0.003); // 0.3% fee

      // Price Impact = 1 - (dy / dx) / (reserveOut / reserveIn)
      const marketSpotPrice = reserveOut / reserveIn;
      const actualPricePaid = dy / parsedAmount;
      const impact = (1 - (actualPricePaid / marketSpotPrice)) * 100;
      setPriceImpact(Math.max(0, impact));
    }

  }, [amountIn, tokenIn, tokenOut, poolReserves, walletState]);

  const handleSwitchTokens = () => {
    const prevIn = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(prevIn);
    setAmountIn(amountOut);
  };

  const handleSetMax = () => {
    if (!walletState) return;
    const balance = walletState.balances[tokenIn] || 0;
    setAmountIn(balance.toString());
  };

  const handleSwapExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletState) return;
    
    const parsedIn = parseFloat(amountIn);
    const parsedOut = parseFloat(amountOut);

    if (isNaN(parsedIn) || parsedIn <= 0) return;
    if (parsedIn > (walletState.balances[tokenIn] || 0)) return;

    onSwap(tokenIn, tokenOut, parsedIn, parsedOut);
    setAmountIn("");
    setAmountOut("");
  };

  const handleWrapExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletState) return;

    const parsedAmt = parseFloat(wrapAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) return;

    if (wrapAction === "WRAP") {
      const nativeEthBal = walletState.balances["ETH"] || 0;
      if (parsedAmt > nativeEthBal) {
        alert("Insufficient native ETH gas balance.");
        return;
      }
      if (onWrap) onWrap(parsedAmt);
    } else {
      const wethBal = walletState.balances["WETH"] || 0;
      if (parsedAmt > wethBal) {
        alert("Insufficient Wrapped ETH (WETH) balance.");
        return;
      }
      if (onUnwrap) onUnwrap(parsedAmt);
    }
    setWrapAmount("");
  };

  const userBalanceIn = walletState?.balances[tokenIn] || 0;
  const userBalanceOut = walletState?.balances[tokenOut] || 0;

  return (
    <div className={`p-6 border rounded-xl relative overflow-hidden transition-all duration-300 ${
      isLightTheme 
        ? "bg-white border-zinc-200" 
        : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
    }`}>
      
      {/* Decorative matrix crosshairs */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/40"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/40"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/40"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/40"></div>

      {/* Header section of widget */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-sans font-bold tracking-tight uppercase flex items-center gap-1.5 text-cyan-400">
            <ArrowUpDown className="h-4 w-4 animate-bounce text-cyan-400" />
            Core Swap Module
          </h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Liquidity Pool Ratio Protocol
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded border transition-all text-zinc-500 hover:text-cyan-400 ${
              isLightTheme ? "border-zinc-200 hover:bg-zinc-100" : "border-zinc-800 hover:bg-zinc-900"
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Slippage Adjustment Console */}
      {showSettings && (
        <div className={`p-3 border rounded-xl mb-4 font-mono text-xs ${
          isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
        }`}>
          <p className="text-zinc-500 mb-2 uppercase text-[9px] tracking-wider">Configure Slippage Tolerance</p>
          <div className="grid grid-cols-4 gap-2">
            {[0.1, 0.5, 1.0, 3.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className={`py-1 rounded border text-center font-mono cursor-pointer ${
                  slippage === val
                    ? "border-cyan-400 text-cyan-400 bg-cyan-950/20"
                    : "border-zinc-850 text-slate-400 hover:border-zinc-700"
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-mode selector */}
      <div className="flex p-1 rounded-sm border border-cyan-500/10 bg-black/40 mb-5 text-xs font-mono">
        <button
          type="button"
          onClick={() => setWrapMode(false)}
          className={`flex-1 py-1.5 text-center font-bold uppercase transition-all rounded-sm cursor-pointer ${
            !wrapMode 
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
              : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          SWAP
        </button>
        <button
          type="button"
          onClick={() => setWrapMode(true)}
          className={`flex-1 py-1.5 text-center font-bold uppercase transition-all rounded-sm cursor-pointer ${
            wrapMode 
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
              : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          Wrap / Unwrap ETH
        </button>
      </div>

      {wrapMode ? (
        <form onSubmit={handleWrapExecute} className="space-y-4">
          {/* Action toggle (WRAP or UNWRAP) */}
          <div className="flex p-1 rounded-sm border border-cyan-500/10 bg-black/40 font-mono text-xs">
            <button
              type="button"
              onClick={() => setWrapAction("WRAP")}
              className={`flex-1 py-1.5 text-center font-bold transition-all rounded-sm cursor-pointer ${
                wrapAction === "WRAP"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-zinc-500"
              }`}
            >
              Wrap (ETH → WETH)
            </button>
            <button
              type="button"
              onClick={() => setWrapAction("UNWRAP")}
              className={`flex-1 py-1.5 text-center font-bold transition-all rounded-sm cursor-pointer ${
                wrapAction === "UNWRAP"
                  ? "bg-fuchsia-500/20 text-fuchsia-400"
                  : "text-zinc-500"
              }`}
            >
              Unwrap (WETH → ETH)
            </button>
          </div>

          {/* Amount input block */}
          <div className={`p-4 rounded-xl border relative ${
            isLightTheme ? "bg-white border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs text-slate-500">
              <span>Amount to {wrapAction === "WRAP" ? "deposit" : "withdraw"}</span>
              {walletState && (
                <span
                  onClick={() => {
                    const balance = walletState.balances[wrapAction === "WRAP" ? "ETH" : "WETH"] || 0;
                    setWrapAmount(balance.toString());
                  }}
                  className="text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center pr-1"
                >
                  Balance: {formatAmount(walletState.balances[wrapAction === "WRAP" ? "ETH" : "WETH"] || 0, 4)} {wrapAction === "WRAP" ? "ETH" : "WETH"}
                  <span className="ml-1 text-[9px] px-1 bg-cyan-950 text-cyan-300 rounded font-bold">MAX</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.0"
                value={wrapAmount}
                onChange={(e) => setWrapAmount(e.target.value)}
                className={`bg-transparent text-xl font-bold font-mono outline-none w-full border-none focus:ring-0 p-0 ${
                  isLightTheme ? "text-zinc-850" : "text-white"
                }`}
                style={{ caretColor: "#06b6d4" }}
              />
              <span className="text-sm font-black text-cyan-400 font-mono select-none">
                {wrapAction === "WRAP" ? "ETH" : "WETH"}
              </span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 p-2 uppercase leading-relaxed">
            {wrapAction === "WRAP" 
              ? "Deposits native ETH gas tokens directly into the ERC20-compatible WETH contract. This allows you to add liquidity in pools or perform complex AMM swaps." 
              : "Burns WETH tokens to withdraw native ETH directly back into your web3 account. It maintains an absolute 1:1 wrap peg ratio."
            }
          </div>

          {/* Action button */}
          {walletState ? (
            <button
              type="submit"
              disabled={!wrapAmount || parseFloat(wrapAmount) <= 0}
              className={`w-full py-4 rounded-sm font-sans font-black tracking-widest uppercase transition-all duration-300 relative cursor-pointer ${
                !wrapAmount || parseFloat(wrapAmount) <= 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : wrapAction === "WRAP"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5"
                  : "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(240,73,214,0.3)] active:translate-y-0.5"
              }`}
            >
              {wrapAction === "WRAP" ? "WRAP ETH" : "UNWRAP WETH"}
            </button>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="w-full py-4 rounded-sm bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black uppercase tracking-widest text-xs hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] duration-300 cursor-pointer flex items-center justify-center animate-pulse"
            >
              Connect Wallet
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={handleSwapExecute} className="space-y-4">
          
          {/* Token Input Block */}
          <div className={`p-4 rounded-xl border relative ${
            isLightTheme ? "bg-white border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider">Pay From Wallet</span>
              {walletState && (
                <span 
                  onClick={handleSetMax}
                  className="text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center pr-1"
                  title="Use full balance"
                >
                  Balance: {formatAmount(userBalanceIn, 4)}
                  <span className="ml-1 text-[9px] px-1 bg-cyan-950 text-cyan-300 rounded font-bold">MAX</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className={`bg-transparent text-xl font-bold font-mono outline-none w-full border-none focus:ring-0 p-0 ${
                  isLightTheme ? "text-zinc-900" : "text-white"
                }`}
                style={{ caretColor: "#06b6d4" }}
                required
              />

              <select
                value={tokenIn}
                onChange={(e) => {
                  const selected = e.target.value as TokenSymbol;
                  setTokenIn(selected);
                  if (selected === tokenOut) {
                    setTokenOut(tokenIn);
                  }
                }}
                className={`font-mono text-sm font-bold border rounded-lg px-2 py-1.5 focus:outline-none ${
                  isLightTheme 
                    ? "bg-zinc-100 border-zinc-300 text-zinc-800" 
                    : "bg-slate-900 border-white/10 text-white"
                }`}
              >
                {Object.keys(tokens).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Switch Anchor */}
          <div className="flex justify-center -my-2.5 relative z-10">
            <button
              type="button"
              onClick={handleSwitchTokens}
              className={`p-2 rounded-full border shadow-md transition-all duration-300 transform hover:scale-110 active:rotate-180 hover:shadow-cyan-400/20 cursor-pointer ${
                isLightTheme 
                  ? "bg-white border-zinc-200 text-zinc-805 hover:bg-zinc-100" 
                  : "bg-[#050505] border-cyan-500/30 text-cyan-400 hover:bg-slate-900"
              }`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          {/* Token Output Block */}
          <div className={`p-4 rounded-xl border relative ${
            isLightTheme ? "bg-white border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider">Claim To Receive</span>
              {walletState && (
                <span className="text-slate-500">
                  Balance: {formatAmount(userBalanceOut, 4)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="0.0"
                value={amountOut}
                readOnly
                className={`bg-transparent text-xl font-bold font-mono outline-none w-full border-none focus:ring-0 p-0 ${
                  isLightTheme ? "text-zinc-800" : "text-slate-350"
                }`}
              />

              <select
                value={tokenOut}
                onChange={(e) => {
                  const selected = e.target.value as TokenSymbol;
                  setTokenOut(selected);
                  if (selected === tokenIn) {
                    setTokenIn(tokenOut);
                  }
                }}
                className={`font-mono text-sm font-bold border rounded-lg px-2 py-1.5 focus:outline-none ${
                  isLightTheme 
                    ? "bg-zinc-100 border-zinc-300 text-zinc-800" 
                    : "bg-slate-900 border-white/10 text-white"
                }`}
              >
                {Object.keys(tokens).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate, Fee, Slippage info list */}
          {rate > 0 && (
            <div className={`p-3.5 border rounded-xl font-mono text-xs space-y-2 ${
              isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-cyan-400/5 rounded border border-cyan-400/10"
            }`}>
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  Exchange Rate:
                </span>
                <span className="text-cyan-400 font-bold">
                  1 {tokenIn} = {formatAmount(rate, 5)} {tokenOut}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  Liquidity Provider Fee:
                  <HelpCircle className="h-3 w-3 text-slate-600" />
                </span>
                <span className="text-slate-200">
                  {formatAmount(fee, 6)} {tokenIn}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1 font-mono">Price Impact:</span>
                <span className={`font-bold flex items-center gap-1 ${
                  priceImpact > 5 
                    ? "text-rose-450 font-black" 
                    : priceImpact > 1 
                    ? "text-amber-400" 
                    : "text-cyan-400"
                }`}>
                  {priceImpact > 1 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {formatAmount(priceImpact, 2)}%
                </span>
              </div>

              <div className="flex justify-between text-slate-450 border-t border-white/5 pt-2 text-[10px]">
                <span>Guaranteed Minimum Out:</span>
                <span className="text-slate-200">
                  {formatAmount(parseFloat(amountOut) * (1 - slippage / 100), 5)} {tokenOut}
                </span>
              </div>
            </div>
          )}

          {/* Warning messages */}
          {errorText && (
            <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-300 rounded-lg text-xs font-mono">
              ⚠ {errorText}
            </div>
          )}

          {/* Actions Button */}
          {walletState ? (
            <button
              type="submit"
              disabled={!!errorText || !amountIn || parseFloat(amountIn) <= 0}
              className={`w-full py-4 rounded-sm font-sans font-black tracking-widest uppercase transition-all duration-300 relative cursor-pointer ${
                !!errorText || !amountIn || parseFloat(amountIn) <= 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5"
              }`}
            >
              {!!errorText ? "Swap Protocol Blocked" : "Confirm Swap"}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={connectWallet}
                className="w-full py-4 rounded-sm bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black uppercase tracking-widest text-xs hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Connect Wallet
              </button>
            </div>
          )}

        </form>
      )}
    </div>
  );
}
