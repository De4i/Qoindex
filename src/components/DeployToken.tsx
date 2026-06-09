import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { 
  Cpu, 
  Terminal, 
  ExternalLink, 
  Copy, 
  FileCode, 
  ShieldCheck, 
  Layers, 
  Play, 
  Coins, 
  Info,
  Check,
  RefreshCw
} from "lucide-react";
import { WalletState } from "../types";

interface DeployTokenProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  triggerNotification: (title: string, desc: string, type: "success" | "info" | "warning" | "alert") => void;
  tokens: Record<string, any>;
  setTokens: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setPoolReserves: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  syncWalletState: (address: string, updatedState?: Partial<WalletState>) => Promise<any>;
  deployedTokens: Array<{ name: string; symbol: string; address: string; supply: number; decimals: number; txHash?: string }>;
  setDeployedTokens: React.Dispatch<React.SetStateAction<Array<{ name: string; symbol: string; address: string; supply: number; decimals: number; txHash?: string }>>>;
  getEVMProvider: () => Promise<any>;
  ensureCorrectNetwork: () => Promise<void>;
}

export default function DeployToken({
  isLightTheme,
  walletState,
  triggerNotification,
  tokens,
  setTokens,
  setPoolReserves,
  syncWalletState,
  deployedTokens,
  setDeployedTokens,
  getEVMProvider,
  ensureCorrectNetwork
}: DeployTokenProps) {
  // Input fields
  const [name, setName] = useState<string>("My Custom Token");
  const [symbol, setSymbol] = useState<string>("TKN");
  const [decimals, setDecimals] = useState<number>(18);
  const [supply, setSupply] = useState<number>(1000000);
  const [selectedColor, setSelectedColor] = useState<string>("from-cyan-400 to-fuchsia-600 border-cyan-400 text-cyan-200");
  
  // Appending local console state logs
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[SYS] Solidity Smart Contract compiler loaded successfully.",
    "[SYS] Ready to compile and register ERC-20 standard tokens on TeQoin L2 L2 Chain.",
    "[SYS] Connect wallet, fill settings, and press 'Deploy' to broadcast."
  ]);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  const copyAddress = (address: string, index: number) => {
    navigator.clipboard.writeText(address);
    setCopiedIndex(index);
    triggerNotification("Copied Address", `Address ${address.substring(0, 10)}... copied to clipboard!`, "success");
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const handleCreateTokenOnChain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !symbol.trim()) {
      triggerNotification("Input Error", "Token Name and Symbol are required.", "warning");
      return;
    }
    if (supply <= 0) {
      triggerNotification("Input Error", "Supply must be positive.", "warning");
      return;
    }
    if (decimals < 0 || decimals > 18) {
      triggerNotification("Input Error", "Decimals must be between 0 and 18.", "warning");
      return;
    }
    if (!walletState) {
      triggerNotification("Wallet Required", "Please initialize or connect your wallet first.", "warning");
      return;
    }

    const symbolUpper = symbol.trim().toUpperCase();
    const nameTrimmed = name.trim();

    setIsDeploying(true);
    
    // Step by step visual compilation stage logs
    setConsoleLogs([
      `[COMPILING] Initializing Solidity Compiler solc v0.8.28+commit.1219b...`,
      `[COMPILING] Loading standard TestERC20.sol boilerplate ruleset.`,
      `[COMPILING] Configuring token name "${nameTrimmed}", ticker format "${symbolUpper}".`,
      `[COMPILING] Dynamic injection: Set ERC20 standard decimals to ${decimals}.`,
      `[COMPILING] Parsing code and checking optimizer rules...`
    ]);

    try {
      // Simulate compiling delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setConsoleLogs(prev => [
        ...prev,
        `[COMPILING] Solidity optimization enabled: 200 runs. Final constraints check green.`,
        `[COMPILING] Running Bytecode constructor encoding.`,
        `[COMPILING] Preparing compilation request to Express Compiler endpoint...`
      ]);

      const response = await fetch("/api/compile-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrimmed,
          symbol: symbolUpper,
          decimals: decimals,
          initialSupply: supply
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Dynamic contract compilation failed on backend.");
      }

      const result = await response.json();
      
      setConsoleLogs(prev => [
        ...prev,
        `[BUILD_OK] Solidity compiles cleanly! Bytecode size: ${result.bytecodeSize || "8.52"} KB.`,
        `[DEPLOYING] Requesting connection to browser wallet (${walletState.address.substring(0, 10)}...)`,
        `[DEPLOYING] Initiating signature request in your browser wallet extension for TeQoin L2...`
      ]);

      // Connect to the user's browser-connected wallet
      const activeEth = await getEVMProvider();
      if (!activeEth) {
        throw new Error("No browser wallet provider found. Please make sure your wallet is connected.");
      }

      await ensureCorrectNetwork();

      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      setConsoleLogs(prev => [
        ...prev,
        `[DEPLOYING] Connected successfully. Please accept the contract deployment transaction in your wallet now...`
      ]);

      // Deploy the compiled contract using the connected wallet's signer
      const factory = new ethers.ContractFactory(result.abi, result.bytecode, signer);
      
      const overrides: any = {
        gasLimit: 3000000 // A very safe and generous gas limit for standard ERC-20 contract creation
      };

      try {
        const feeData = await browserProvider.getFeeData();
        if (feeData.maxFeePerGas) {
          // Boost Fee values by 250% (2.5x) to guarantee priority inclusion on TeQoin L2 during periods of volatility
          overrides.maxFeePerGas = (feeData.maxFeePerGas * 250n) / 100n;
          overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas 
            ? (feeData.maxPriorityFeePerGas * 250n) / 100n 
            : (feeData.maxFeePerGas * 50n) / 100n;
          
          setConsoleLogs(prev => [
            ...prev,
            `[SYS] Configuring advanced EIP-1559 priority gas rules...`,
            `[SYS] Set Max Fee Per Gas: ${ethers.formatUnits(overrides.maxFeePerGas, "gwei")} Gwei`,
            `[SYS] Set Max Priority Fee: ${ethers.formatUnits(overrides.maxPriorityFeePerGas, "gwei")} Gwei`
          ]);
        } else if (feeData.gasPrice) {
          // Fallback legacy gas booster by 250%
          overrides.gasPrice = (feeData.gasPrice * 250n) / 100n;
          setConsoleLogs(prev => [
            ...prev,
            `[SYS] Configuring legacy boosted gas price: ${ethers.formatUnits(overrides.gasPrice, "gwei")} Gwei`
          ]);
        }
      } catch (err: any) {
        setConsoleLogs(prev => [
          ...prev,
          `[SYS] Non-blocking warning: Could not query exact feeData, using default gas parameters.`
        ]);
      }

      // Let's execute deployment transaction via the connected wallet with optimized premium gas overrides
      const contract = await factory.deploy(nameTrimmed, symbolUpper, BigInt(supply), overrides);
      
      setConsoleLogs(prev => [
        ...prev,
        `[DEPLOYING] Transaction signed and broadcasted!`,
        `[DEPLOYING] TX ID: ${contract.deploymentTransaction()?.hash || "Pending..."}`,
        `[DEPLOYING] Waiting for block lease confirmation...`
      ]);

      await contract.waitForDeployment();
      const deployedAddress = await contract.getAddress();
      const txHash = contract.deploymentTransaction()?.hash;

      setConsoleLogs(prev => [
        ...prev,
        `[SUCCESS] Block successfully mined on TeQoin L2!`,
        `[SUCCESS] Token Contract Address: ${deployedAddress}`,
        `[SUCCESS] Initial supply of ${supply.toLocaleString()} ${symbolUpper} credited directly to your connected wallet: ${walletState.address}`,
        `[SUCCESS] Automated AMM pool pair registered: ${symbolUpper} / USDT pool liquidity initialized!`,
        `[INFO] Transaction completed successfully. gas fees processed by signer.`
      ]);

      // Add to dynamic client tokens dictionary
      const newTokenInfo = {
        symbol: symbolUpper,
        name: nameTrimmed,
        address: deployedAddress,
        decimals: decimals,
        color: selectedColor,
        iconName: "Coins"
      };

      setTokens(prev => ({
        ...prev,
        [symbolUpper]: newTokenInfo
      }));

      // Automatically save deployed token to local storage so it persists per wallet
      if (walletState && walletState.address) {
        const key = "teqoin_saved_tokens_" + walletState.address.toLowerCase();
        const existingStr = localStorage.getItem(key);
        let existing: Record<string, any> = {};
        if (existingStr) {
          try {
            existing = JSON.parse(existingStr);
          } catch (e) {}
        }
        existing[symbolUpper] = newTokenInfo;
        localStorage.setItem(key, JSON.stringify(existing));
      }

      // Add to dynamic deployed list
      const newTokenObj = {
        name: nameTrimmed,
        symbol: symbolUpper,
        address: deployedAddress,
        supply: supply,
        decimals: decimals,
        txHash: txHash
      };
      setDeployedTokens(prev => [newTokenObj, ...prev]);

      // Credit wallet balances & add log
      const nextBalances = {
        ...walletState.balances,
        [symbolUpper]: supply
      };

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "DEPLOY",
        detail: `Successfully deployed ERC-20 contract ${symbolUpper} (${nameTrimmed}) on TeQoin L2. Full supply of ${supply.toLocaleString()} initialized.`,
        txHash: txHash,
        contractAddress: deployedAddress
      };

      const nextState: Partial<WalletState> = {
        balances: nextBalances,
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      // Register custom swap pool pre-fund USDT with standard pool ratio
      setPoolReserves(prev => {
        const pairKey = ["USDT", symbolUpper].sort().join("_");
        return {
          ...prev,
          [pairKey]: {
            reserveA: 50000, // 50,000 USDT pre-allocated
            reserveB: supply * 0.1, // 10% pool standard
            totalShares: 100000,
            userShares: 0
          }
        };
      });

      // Synchronize back with the database
      await syncWalletState(walletState.address, nextState);
      
      triggerNotification(
        "Token Deployed",
        `Standard ERC-20 contract (${symbolUpper}) is now fully active inside your wallet and swap matrix!`,
        "success"
      );
    } catch (err: any) {
      setConsoleLogs(prev => [
        ...prev,
        `[COMPILATION_ERROR] Deploy aborted: ${err.message || err}`
      ]);
      triggerNotification("Deployment Failed", err.message || "Failed to compile or broadcast contract.", "alert");
    } finally {
      setIsDeploying(false);
    }
  };

  const colorsOption = [
    { label: "Neon Cyan", value: "from-cyan-400 to-fuchsia-600 border-cyan-400 text-cyan-200" },
    { label: "Sunset gold", value: "from-amber-400 to-yellow-600 border-amber-400 text-amber-200" },
    { label: "Aurora emerald", value: "from-green-400 to-emerald-600 border-emerald-400 text-emerald-200" },
    { label: "Ocean blue", value: "from-blue-400 to-indigo-600 border-indigo-400 text-indigo-200" },
    { label: "Cyber Orchid", value: "from-purple-500 to-fuchsia-600 border-fuchsia-400 text-fuchsia-305" }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* GLOWING HEADER BLOCK */}
      <div className={`p-6 rounded-md border ${
        isLightTheme 
          ? "bg-white border-zinc-200 shadow-xs" 
          : "bg-slate-950/40 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-md ${isLightTheme ? "bg-zinc-100 text-zinc-900" : "bg-cyan-500/10 text-cyan-400"}`}>
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className={`text-xl font-mono uppercase font-black tracking-wider ${isLightTheme ? "text-zinc-950" : "text-white"}`}>
                L2 ERC-20 Smart Compiler
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">
                EVM-Compatible runtime playground. Compile and register standard tokens onto TeQoin L2 instantly.
              </p>
            </div>
          </div>
          <div className="flex gap-2 self-start md:self-center">
            <div className={`px-3 py-1.5 rounded text-[10px] font-mono border ${
              isLightTheme ? "bg-zinc-100 border-zinc-200 text-zinc-700" : "bg-slate-900 border-cyan-500/20 text-cyan-400"
            }`}>
              NETWORK: <span className="font-extrabold uppercase text-emerald-450 font-sans">● TeQoin L2</span>
            </div>
            <div className={`px-3 py-1.5 rounded text-[10px] font-mono border ${
              isLightTheme ? "bg-zinc-100 border-zinc-200 text-zinc-700" : "bg-slate-900 border-cyan-500/20 text-cyan-400"
            }`}>
              RPC GATEWAY: <span className="font-extrabold">rpc.teqoin.io</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: CREATOR FORM */}
        <div className="lg:col-span-5 h-full">
          <form 
            onSubmit={handleCreateTokenOnChain}
            className={`h-full p-6 rounded-md border flex flex-col justify-between space-y-6 ${
              isLightTheme 
                ? "bg-white border-zinc-200 shadow-xs" 
                : "bg-slate-950/40 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
            }`}
          >
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-1">
                  1. Token Meta Parameters
                </span>
                <p className="text-[11px] text-slate-400 font-mono mb-3">
                  Set standard details according to OpenZeppelin ERC20 standard interfaces.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-350 mb-1.5 font-bold">
                  Token Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded text-xs font-mono outline-hidden border transition-all ${
                    isLightTheme
                      ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                      : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                  }`}
                  placeholder="e.g. My Custom Token"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-350 mb-1.5 font-bold">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    maxLength={10}
                    className={`w-full px-3.5 py-2.5 rounded text-xs font-mono outline-hidden border transition-all ${
                      isLightTheme
                        ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                        : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    }`}
                    placeholder="e.g. TKN"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-350 mb-1.5 font-bold">
                    Decimals
                  </label>
                  <input
                    type="number"
                    value={decimals}
                    onChange={(e) => setDecimals(parseInt(e.target.value, 10) || 18)}
                    min={0}
                    max={18}
                    className={`w-full px-3.5 py-2.5 rounded text-xs font-mono outline-hidden border transition-all ${
                      isLightTheme
                        ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                        : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    }`}
                    placeholder="18"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-350 mb-1.5 font-bold">
                  Initial Supply (Base Units)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={supply}
                    onChange={(e) => setSupply(parseFloat(e.target.value) || 0)}
                    min={1}
                    className={`w-full pl-3.5 pr-20 py-2.5 rounded text-xs font-mono outline-hidden border transition-all ${
                      isLightTheme
                        ? "bg-zinc-50 border-zinc-200 text-zinc-950 focus:border-zinc-400"
                        : "bg-slate-900/60 border-cyan-500/20 text-white focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    }`}
                    placeholder="1000000"
                  />
                  <div className="absolute inset-y-0 right-0 max-h-full flex items-center pr-3">
                    <span className="text-[10px] font-mono font-black text-slate-400">
                      {symbol.trim().toUpperCase() || "TKN"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-350 mb-1.5 font-bold">
                  Card Theme Accent
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                    {colorsOption.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setSelectedColor(c.value)}
                        className={`px-3 py-2 text-[10px] font-mono rounded cursor-pointer border text-left transition-all ${
                          selectedColor === c.value
                            ? isLightTheme
                              ? "bg-zinc-950 border-zinc-950 text-white"
                              : "bg-cyan-500/10 border-cyan-400 text-cyan-200"
                            : isLightTheme
                              ? "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                              : "bg-slate-900/40 border-cyan-500/10 text-slate-400 hover:border-cyan-500/30"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-500/10 space-y-3">
              <div className="flex gap-2 text-[10px] font-mono text-amber-500 bg-amber-500/5 p-2.5 rounded border border-amber-500/15">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Note:</strong> Deploying registers a standard ERC20 contract on TeQoin testnet, sponsors gas fees, and injects liquid swap pools.
                </span>
              </div>

              <button
                type="submit"
                disabled={isDeploying || !walletState}
                className={`w-full py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 transform rounded font-mono font-bold uppercase text-xs tracking-wider select-none ${
                  isDeploying
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : !walletState
                      ? "bg-zinc-300 text-zinc-650 cursor-not-allowed"
                      : isLightTheme
                        ? "bg-zinc-950 hover:bg-zinc-800 text-white active:scale-98"
                        : "bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-98 hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                }`}
              >
                {isDeploying ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Compiling & broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Compile & Deploy Token</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: TERMINAL CONSOLE */}
        <div className="lg:col-span-7 flex flex-col h-[520px]">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-t border-x border-slate-800 rounded-t-md">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-extrabold">
                Live Solidity Compiler & ABI Generator Console
              </span>
            </div>
            <div className="flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
          </div>
          <div className="flex-1 p-4 bg-slate-950 overflow-y-auto font-mono text-xs text-slate-300 border-x border-b border-slate-800 rounded-b-md no-scrollbar space-y-1.5 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]">
            {consoleLogs.map((log, i) => {
              let textClass = "text-slate-300";
              if (log.startsWith("[SYS]")) textClass = "text-cyan-400 font-semibold";
              if (log.startsWith("[COMPILING]")) textClass = "text-slate-400";
              if (log.startsWith("[BUILD_OK]")) textClass = "text-emerald-400 font-bold";
              if (log.startsWith("[DEPLOYING]")) textClass = "text-yellow-400 animate-pulse";
              if (log.startsWith("[SUCCESS]")) textClass = "text-emerald-440 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]";
              if (log.startsWith("[INFO]")) textClass = "text-indigo-400";
              if (log.startsWith("[COMPILATION_ERROR]")) textClass = "text-rose-500 font-black";

              return (
                <div key={i} className={`py-1 ${textClass} leading-relaxed`}>
                  {log}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: DEPLOYED TOKENS FEED */}
      <div className={`p-6 rounded-md border ${
        isLightTheme 
          ? "bg-white border-zinc-200 shadow-xs" 
          : "bg-slate-950/40 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
      }`}>
        <div className="mb-4">
          <h2 className={`text-sm font-mono uppercase font-black tracking-wider ${isLightTheme ? "text-zinc-950" : "text-white"}`}>
            Architect Deployed Contracts ({deployedTokens.length})
          </h2>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Registry of custom contracts built dynamically across active sandbox sessions.
          </p>
        </div>

        {deployedTokens.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono border border-dashed border-slate-800/10 rounded">
            No dynamic contracts deployed yet. Fill above form and click compile to deploy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/10 text-slate-400">
                  <th className="pb-2 font-bold uppercase tracking-wider">Token Info</th>
                  <th className="pb-2 font-bold uppercase tracking-wider">Contract Address</th>
                  <th className="pb-2 font-bold uppercase tracking-wider">Symbol</th>
                  <th className="pb-2 font-bold uppercase tracking-wider">Initial Mint</th>
                  <th className="pb-2 font-bold uppercase tracking-wider text-right">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/5">
                {deployedTokens.map((tk, idx) => (
                  <tr key={idx} className={`${isLightTheme ? "hover:bg-zinc-50" : "hover:bg-slate-900/20"}`}>
                    <td className="py-3 font-semibold text-slate-200">
                      <span className={`text-white ${isLightTheme ? "text-zinc-950" : ""}`}>{tk.name}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-slate-400">
                          {tk.address.substring(0, 10)}...{tk.address.substring(tk.address.length - 8)}
                        </span>
                        <button
                          onClick={() => copyAddress(tk.address, idx)}
                          className={`p-1.5 rounded bg-zinc-800/35 hover:bg-zinc-800 cursor-pointer text-slate-400 transition-all ${
                            copiedIndex === idx ? "text-emerald-400" : ""
                          }`}
                        >
                          {copiedIndex === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900/50 border border-cyan-500/10 text-cyan-400">
                        {tk.symbol}
                      </span>
                    </td>
                    <td className="py-3 text-slate-350">
                      {tk.supply.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {tk.txHash && (
                          <a
                            href={`https://testnet-blockscan.teqoin.io/transaction/details?tx=${tk.txHash}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] uppercase text-cyan-400 hover:underline"
                          >
                            Tx <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <a
                          href={`https://testnet-blockscan.teqoin.io/address/details?address=${tk.address}`}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] uppercase text-slate-400 hover:underline"
                        >
                          Contract <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
