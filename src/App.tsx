import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount, useDisconnect, useSwitchChain, useAppKit } from "./web3/provider";
import { 
  ArrowUpDown, 
  Droplet, 
  Lock, 
  Terminal, 
  Wallet, 
  Cpu, 
  Github, 
  Bell, 
  X, 
  Compass, 
  CheckCircle,
  Database,
  Unplug,
  Info,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import Header from "./components/Header";
import Swap from "./components/Swap";
import Pools from "./components/Pools";
import Staking from "./components/Staking";
import Dashboard from "./components/Dashboard";
import WalletModal from "./components/WalletModal";
import ConnectModal from "./components/ConnectModal";
import DeployToken from "./components/DeployToken";
import PoolExplorer from "./components/PoolExplorer";

import { 
  TokenSymbol, 
  CONTRACTS, 
  TOKENS, 
  WalletState, 
  LPState, 
  NotificationItem, 
  MarketTelemetry,
  toSafeDecimalString
} from "./types";



export default function App() {
  const [isLightTheme, setIsLightTheme] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"SWAP" | "LP" | "STAKING" | "DEPLOY" | "DASHBOARD" | "POOL">("SWAP");

  // Wagmi Hooks & Helper
  const { address: wagmiAddress, isConnected: wagmiIsConnected, connector, chainId } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { open: openAppKit } = useAppKit();

  const getEVMProvider = async (): Promise<any> => {
    if (!connector) return null;
    return await connector.getProvider();
  };
  
  // Wallet State
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [tokens, setTokens] = useState<Record<string, any>>(TOKENS);

  // Market & DEX Pool reserves state (Simulating full live AMM tracking)
  const [poolReserves, setPoolReserves] = useState<Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }>>({});

  // Telemetry details from Node API
  const [telemetry, setTelemetry] = useState<MarketTelemetry | null>({
    blockHeight: 18053042,
    activeNodes: 1404,
    ammGigaHashRate: "420.69 TH/s",
    slippageStandard: 0.5,
    gasGwei: 3,
    gasPriceUsd: 0.42,
    faucetLimit: 10000,
    cooldownMs: 86400000,
    tps: 3.5,
    totalTx: 8294500
  });

  // Popup toasts notifications queue
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Compiler Console deployment state
  const [deployConsoleLogs, setDeployConsoleLogs] = useState<string[]>([
    "[SYS] Solidity smart contract compiler loaded successfully.",
    "[SYS] Ready to bundle standard ERC-20 tokens for TeQoin L2 (Chain ID 420377)."
  ]);
  const [deployingSim, setDeployingSim] = useState<boolean>(false);
  
  // User custom tokens deployment states
  const [tkName, setTkName] = useState<string>("My Custom Token");
  const [tkSymbol, setTkSymbol] = useState<string>("QOIN");
  const [tkTotalSupply, setTkTotalSupply] = useState<number>(1000000);
  const [tkDecimals, setTkDecimals] = useState<number>(18);
  const [tkColor, setTkColor] = useState<string>("from-cyan-400 to-fuchsia-600");
  const [deployedTokens, setDeployedTokens] = useState<Array<{ name: string; symbol: string; address: string; supply: number; decimals: number; txHash?: string }>>([]);

  // Helper to trigger interactive popups
  const triggerNotification = useCallback((title: string, message: string, type: "success" | "info" | "warning" | "alert" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: NotificationItem = {
      id,
      type,
      title,
      message,
      timestamp: Date.now()
    };
    setNotifications(prev => [newItem, ...prev].slice(0, 5)); // Limit to last 5

    // Automatically dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Fetch telemetry updates periodically
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry");
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
        }
      } catch (e) {
        // Fallback silently if offline code compiling
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  // Real-time on-chain blockchain tracker state
  const [onChainReserves, setOnChainReserves] = useState<Record<string, number>>({
    USDC: 500000,
    USDT: 500000,
    NBLAD: 250000,
    DE4I: 120000,
  });
  const [blockchainLoading, setBlockchainLoading] = useState<boolean>(false);
  const [detectedChainId, setDetectedChainId] = useState<number | null>(null);

  // Reactively track the current network chain ID from the active Wagmi session
  useEffect(() => {
    if (chainId) {
      setDetectedChainId(chainId);
    } else {
      setDetectedChainId(null);
    }
  }, [chainId]);

  // Dynamic on-chain blockchain balance and pool reserve loader
  const fetchOnChainBalances = useCallback(async (address: string) => {
    if (!address) return;
    setBlockchainLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io");
      
      // 1. Fetch real ETH Native balance
      let ethBalance = 0;
      try {
        const ethWei = await provider.getBalance(address);
        ethBalance = parseFloat(ethers.formatEther(ethWei));
      } catch (err) {
        console.warn("ETH query failed:", err);
      }

      // 2. Fetch real ERC-20 balances for the connected address
      const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];

      const balanceResults: Record<string, number> = {
        ETH: ethBalance,
      };

      const tokenSymbols = Object.keys(tokens);

      const tokenBalancesPromises = tokenSymbols.map(async (symbol) => {
        const tokenAddress = tokens[symbol]?.address || CONTRACTS[symbol as keyof typeof CONTRACTS];
        if (!tokenAddress) return;
        try {
          const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
          const rawBal = await contract.balanceOf(address);
          const decimals = tokens[symbol]?.decimals ?? 18;
          balanceResults[symbol] = parseFloat(ethers.formatUnits(rawBal, decimals));
        } catch (e) {
          balanceResults[symbol] = 0;
        }
      });

      await Promise.all(tokenBalancesPromises);

      // 3. Fetch real DEX reserves (tokens in CONTRACTS.DEX on-chain)
      const reservesResults: Record<string, number> = {};
      const reservePromises = tokenSymbols.map(async (symbol) => {
        const tokenAddress = tokens[symbol]?.address || CONTRACTS[symbol as keyof typeof CONTRACTS];
        if (!tokenAddress) return;
        try {
          const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
          const rawBal = await contract.balanceOf(CONTRACTS.DEX);
          const decimals = tokens[symbol]?.decimals ?? 18;
          reservesResults[symbol] = parseFloat(ethers.formatUnits(rawBal, decimals));
        } catch (e) {
          reservesResults[symbol] = 0;
        }
      });

      await Promise.all(reservePromises);

      // 3b. Fetch real native ETH balance of CONTRACTS.DEX (representing staked ETH)
      try {
        const dexEthWei = await provider.getBalance(CONTRACTS.DEX);
        reservesResults["ETH"] = parseFloat(ethers.formatEther(dexEthWei));
      } catch (e) {
        reservesResults["ETH"] = 0;
      }

      setOnChainReserves(reservesResults);

      // 4. Update the core pools reserve states dynamically using actual on-chain pool-level reserves
      let nextPoolReserves: any = {};
      try {
        const dexReservesAbi = [
          "function getPoolReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB, uint256 totalShares)",
          "function getUserLPShares(address tokenA, address tokenB, address user) external view returns (uint256)"
        ];
        const dexReservesContract = new ethers.Contract(CONTRACTS.DEX, dexReservesAbi, provider);

        const pairsToQuery: string[] = [];
        const activeSymbols = Object.keys(tokens);
        for (let i = 0; i < activeSymbols.length; i++) {
          for (let j = i + 1; j < activeSymbols.length; j++) {
            const pairKey = [activeSymbols[i], activeSymbols[j]].sort().join("_");
            if (!pairsToQuery.includes(pairKey)) {
              pairsToQuery.push(pairKey);
            }
          }
        }

        const poolResPromises = pairsToQuery.map(async (pairKey) => {
          const [symA, symB] = pairKey.split("_");
          const tokenAConfig = tokens[symA];
          const tokenBConfig = tokens[symB];
          if (!tokenAConfig || !tokenBConfig) return;

          try {
            const [rawResA, rawResB, rawShares] = await dexReservesContract.getPoolReserves(tokenAConfig.address, tokenBConfig.address);
            
            let userSharesRaw = 0n;
            if (address && address !== ethers.ZeroAddress) {
              userSharesRaw = await dexReservesContract.getUserLPShares(tokenAConfig.address, tokenBConfig.address, address);
            }

            const decA = tokenAConfig.decimals;
            const decB = tokenBConfig.decimals;

            // Sort correctly to match symA & symB positions in pairKey
            const isSymALower = tokenAConfig.address.toLowerCase() < tokenBConfig.address.toLowerCase();
            
            let finalReserveA = 0;
            let finalReserveB = 0;
            if (isSymALower) {
              finalReserveA = parseFloat(ethers.formatUnits(rawResA, decA));
              finalReserveB = parseFloat(ethers.formatUnits(rawResB, decB));
            } else {
              finalReserveA = parseFloat(ethers.formatUnits(rawResB, decA));
              finalReserveB = parseFloat(ethers.formatUnits(rawResA, decB));
            }

            nextPoolReserves[pairKey] = {
              reserveA: finalReserveA,
              reserveB: finalReserveB,
              totalShares: parseFloat(ethers.formatEther(rawShares)),
              userShares: parseFloat(ethers.formatEther(userSharesRaw))
            };
          } catch (err) {
            nextPoolReserves[pairKey] = {
              reserveA: 100000,
              reserveB: 100000,
              totalShares: 100000,
              userShares: 0
            };
          }
        });

        await Promise.all(poolResPromises);
        setPoolReserves(nextPoolReserves);
      } catch (err) {
        console.warn("Could not query DEX pool reserves directly from on-chain:", err);
      }

      // 5. Fetch actual staking positions from the DEX contract
      let stakingPositions: any = null;
      try {
        const dexContract = new ethers.Contract(CONTRACTS.DEX, [
          "function stakingPositions(address owner, address token) view returns (uint256 amountStaked, uint256 lastStakedTime, uint256 qoinRewardDebt)",
          "function getClaimableRewards(address userAddress, address token) view returns (uint256 pending)",
          "function rewardRateUsdc() view returns (uint256)",
          "function rewardRateUsdt() view returns (uint256)",
          "function rewardRateDai() view returns (uint256)",
          "function rewardRateEth() view returns (uint256)"
        ], provider);

        let rateUsdc = 10;
        let rateUsdt = 10;
        let rateDai = 10;
        let rateEth = 10000;
        try {
          const [rUsdc, rUsdt, rDai, rEth] = await Promise.all([
            dexContract.rewardRateUsdc().catch(() => 10n),
            dexContract.rewardRateUsdt().catch(() => 10n),
            dexContract.rewardRateDai().catch(() => 10n),
            dexContract.rewardRateEth().catch(() => 10000n)
          ]);
          rateUsdc = Number(rUsdc);
          rateUsdt = Number(rUsdt);
          rateDai = Number(rDai);
          rateEth = Number(rEth);
        } catch (rateErr) {
          console.warn("Could not query dynamic reward rates from DEX onchain:", rateErr);
        }

        const assets = ["USDC", "USDT", "DAI", "ETH"] as const;
        const poolsStats: Record<string, any> = {};

        const poolPromises = assets.map(async (asset) => {
          const tokenAdd = asset === "ETH" ? ethers.ZeroAddress : CONTRACTS[asset];
          try {
            const rawPos = await dexContract.stakingPositions(address, tokenAdd);
            const claimable = await dexContract.getClaimableRewards(address, tokenAdd);
            
            const decimalsInput = asset === "ETH" ? 18 : (asset === "DAI" ? 18 : 6);
            const decimalsOutput = 18; // QOIN has 18 decimals

            poolsStats[asset] = {
              amountStaked: parseFloat(ethers.formatUnits(rawPos[0], decimalsInput)),
              lastStakedTime: Number(rawPos[1]),
              qoinRewardDebt: parseFloat(ethers.formatUnits(claimable, decimalsOutput)),
              rate: asset === "ETH" ? rateEth : (asset === "USDC" ? rateUsdc : (asset === "USDT" ? rateUsdt : rateDai))
            };
          } catch (err) {
            console.warn(`Query failed for ${asset} pool:`, err);
            poolsStats[asset] = {
              amountStaked: 0,
              lastStakedTime: 0,
              qoinRewardDebt: 0,
              rate: asset === "ETH" ? rateEth : (asset === "USDC" ? rateUsdc : (asset === "USDT" ? rateUsdt : rateDai))
            };
          }
        });

        await Promise.all(poolPromises);
        stakingPositions = poolsStats;
      } catch (stakerError) {
        console.warn("Could not query DEX staking position onchain:", stakerError);
      }

      // 5b. Fetch last faucet claim time from Faucet contract dynamically
      let lastClaimMs = 0;
      try {
        const faucetContract = new ethers.Contract(CONTRACTS.Faucet, [
          "function lastFaucetClaim(address) view returns (uint256)"
        ], provider);
        const lastClaimSecs = await faucetContract.lastFaucetClaim(address);
        lastClaimMs = Number(lastClaimSecs) * 1000;
      } catch (faucetErr) {
        console.warn("Could not query Faucet last claim from onchain:", faucetErr);
      }

      // 6. Inject back into wallet balances and staking state
      setWalletState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          balances: {
            ...prev.balances,
            ...balanceResults
          },
          faucetClaims: {
            ...prev.faucetClaims,
            ETH: lastClaimMs || prev.faucetClaims?.ETH || 0
          },
          ...(stakingPositions ? { staking: stakingPositions } : {})
        };
      });

    } catch (err) {
      console.error("JSON-RPC loading error:", err);
    } finally {
      setBlockchainLoading(false);
    }
  }, [tokens]);

  // Blockchain auto background polling effect
  useEffect(() => {
    if (!walletState?.address) return;
    fetchOnChainBalances(walletState.address);

    const interval = setInterval(() => {
      fetchOnChainBalances(walletState.address);
    }, 10000);

    return () => clearInterval(interval);
  }, [walletState?.address, fetchOnChainBalances]);

  // Sync state with node express backend
  const syncWalletState = useCallback(async (address: string, updatePayload?: Partial<WalletState>) => {
    try {
      const payload: any = { address };
      if (updatePayload) {
        payload.updatedState = updatePayload;
      }

      const res = await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const reply = await res.json();
        setWalletState(reply.data);
      } else {
        throw new Error("Sync server returned status " + res.status);
      }
    } catch (err) {
      console.warn("Express synchronization temporarily unavailable, operating client-side.", err);
      // Construct a valid local state so that the application doesn't freeze in loading/spinning state
      setWalletState(prev => {
        const base = prev || {
          address: address.toLowerCase(),
          balances: {
            ETH: 0,
            QOIN: 0,
            USDC: 0,
            USDT: 0,
            DAI: 0,
            NBLAD: 0,
            DE4I: 0,
          },
          staking: {
            USDC: { amountStaked: 0, lastStakedTime: 0, qoinRewardDebt: 0, rate: 5 },
            USDT: { amountStaked: 0, lastStakedTime: 0, qoinRewardDebt: 0, rate: 5 },
            DAI: { amountStaked: 0, lastStakedTime: 0, qoinRewardDebt: 0, rate: 5 },
            ETH: { amountStaked: 0, lastStakedTime: 0, qoinRewardDebt: 0, rate: 5 }
          },
          faucetClaims: {
            ETH: 0
          },
          autoWithdrawThresholds: {
            QOIN: 500,
            enabled: false
          },
          logs: [
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: Date.now(),
              type: "SYSTEM",
              detail: "Cybernetic wallet environment instantiated client-only fallback.",
              txHash: "0x"
            }
          ]
        };

        if (updatePayload) {
          return {
            ...base,
            ...updatePayload,
            balances: {
              ...base.balances,
              ...(updatePayload.balances || {})
            },
            staking: {
              ...base.staking,
              ...(updatePayload.staking || {})
            },
            faucetClaims: {
              ...base.faucetClaims,
              ...(updatePayload.faucetClaims || {})
            },
            address: address.toLowerCase()
          };
        }
        return base;
      });
    }
  }, []);

  // Connects standard wallet using Reown AppKit modal
  const connectWallet = async () => {
    try {
      await openAppKit();
    } catch (e: any) {
      triggerNotification("Connection Failed", e.message || "Failed to trigger Web3Modal", "warning");
    }
  };

  const connectSpecificWallet = async (type: "metamask" | "okx") => {
    try {
      await openAppKit();
    } catch (e: any) {
      triggerNotification("Connection Failed", e.message || "Failed to trigger Web3Modal", "warning");
    }
  };

  const connectManualWallet = async (address: string) => {
    try {
      await syncWalletState(address);
      await fetchOnChainBalances(address);
      triggerNotification(
        "Custom Wallet Connected",
        `Successfully linked simulation to address: ${address.substring(0, 6)}...`,
        "success"
      );
    } catch (e: any) {
      triggerNotification("Manual Link Failed", e.message || "Failed to link address.", "warning");
    }
  };

  const setupIopnNetwork = async () => {
    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: 420377 });
        setDetectedChainId(420377);
        triggerNotification("Switched Network", "Wallet successfully switched to TeQoin L2.", "success");
      } else {
        const activeEth = await getEVMProvider();
        if (activeEth) {
          await activeEth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x66a19" }]
          });
          setDetectedChainId(420377);
          triggerNotification("Switched Network", "Wallet successfully switched to TeQoin L2.", "success");
        }
      }
    } catch (switchError: any) {
      const isUnrecognized = 
        switchError.code === 4902 || 
        switchError.code === -32603 ||
        switchError.message?.includes("Unrecognized chain ID") || 
        switchError.message?.includes("unrecognized chain ID") ||
        switchError.message?.toLowerCase().includes("unrecognized");

      if (isUnrecognized) {
        try {
          const activeEth = await getEVMProvider();
          if (activeEth) {
            await activeEth.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x66a19",
                  chainName: "TeQoin L2",
                  nativeCurrency: {
                    name: "ETH",
                    symbol: "ETH",
                    decimals: 18
                  },
                  rpcUrls: ["https://rpc.teqoin.io"],
                  blockExplorerUrls: ["https://testnet-blockscan.teqoin.io"]
                }
              ]
            });
            setDetectedChainId(420377);
            triggerNotification("Network Installed", "TeQoin L2 added and selected in your wallet!", "success");
          }
        } catch (addError: any) {
          triggerNotification("Network Add Failed", addError.message || "Failed to add TeQoin L2.", "warning");
        }
      } else {
        triggerNotification("Switch Failed", switchError.message || "Failed to switch to TeQoin L2.", "warning");
      }
    }
  };

  const ensureCorrectNetwork = async () => {
    if (chainId !== 420377) {
      triggerNotification("Wrong Network Detected", "Attempting to switch your wallet to TeQoin L2...", "warning");
      await setupIopnNetwork();
      // Wait for network switch to take effect
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (chainId !== 420377) {
        throw new Error("Wrong Network! Please switch your wallet network to TeQoin L2 to execute this transaction.");
      }
    }
  };

  const disconnectWallet = () => {
    wagmiDisconnect();
    setWalletState(null);
    triggerNotification("Wallet Disconnected", "Disconnected wallet address and reset session state.", "info");
  };

  // Synchronize Wagmi Account Status with the Core Wallet State & express backend reactively
  useEffect(() => {
    const syncWithWagmi = async () => {
      if (wagmiIsConnected && wagmiAddress) {
        if (!walletState || walletState.address.toLowerCase() !== wagmiAddress.toLowerCase()) {
          console.log("Syncing active Wagmi wallet with backend:", wagmiAddress);
          await syncWalletState(wagmiAddress);
          await fetchOnChainBalances(wagmiAddress);
          triggerNotification(
            "Wallet Synced",
            `Active address: ${wagmiAddress.substring(0, 6)}...${wagmiAddress.substring(wagmiAddress.length - 4)}`,
            "success"
          );
        }
      } else {
        if (walletState) {
          setWalletState(null);
        }
      }
    };
    syncWithWagmi();
  }, [wagmiAddress, wagmiIsConnected, syncWalletState, fetchOnChainBalances, triggerNotification, walletState]);

  // Faucet request trigger
  const handleClaimFaucet = async (tokenSymbol: string) => {
    if (!walletState) return;

    triggerNotification("Verifying Gas Balance", "Checking your actual on-chain native balance to determine gas delegation...", "info");

    let realEthBal = 0;
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io");
      const weiBal = await provider.getBalance(walletState.address);
      realEthBal = parseFloat(ethers.formatEther(weiBal));
      console.log("Verified live on-chain ETH Balance for faucet routing:", realEthBal);
    } catch (balanceErr) {
      console.warn("Failed to query live ETH on-chain, using cached state:", balanceErr);
      realEthBal = walletState.balances?.ETH || 0;
    }

    const isGaslessNeeded = realEthBal < 0.001; // Less than 0.001 ETH is considered gasless mode

    if (isGaslessNeeded) {
      try {
        triggerNotification("Gasless Faucet", "Initiating smart gasless sponsor delegation...", "info");
        const res = await fetch("/api/faucet/claim-gasless", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: walletState.address }),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error || "Delegation failed.");
        }

        if (result.data) {
          await syncWalletState(walletState.address, result.data);
        }
        await fetchOnChainBalances(walletState.address);
        triggerNotification("Faucet Received", "Successfully claimed 0.001 ETH with 0 gas fee via delegate sponsorship!", "success");
      } catch (err: any) {
        console.error(err);
        triggerNotification("Faucet Failed", err.message || "Failed to acquire sponsored faucet transfer.", "warning");
      }
      return;
    }

    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No browser wallet provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      triggerNotification("Faucet Initiating", "Signing claim for 0.001 ETH directly on-chain...", "info");
      
      const faucetContract = new ethers.Contract(CONTRACTS.Faucet, [
        "function claimFaucet() external"
      ], signer);

      // Trigger standard on-chain call letting the wallet determine network gas fee naturally
      const tx = await faucetContract.claimFaucet();
      triggerNotification("Transaction Submitted", `Hash: ${tx.hash.substring(0, 16)}...`, "info");
      const receipt = await tx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "FAUCET",
        detail: "Claimed 0.001 ETH from on-chain faucet.",
        txHash: receipt.hash,
      };

      const claimTimer = { ...walletState.faucetClaims };
      claimTimer["ETH"] = Date.now();

      const nextState: Partial<WalletState> = {
        faucetClaims: claimTimer,
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Faucet Claimed", "Successfully claimed 0.001 ETH directly from the on-chain faucet!", "success");
    } catch (err: any) {
      console.error("On-chain faucet claim failed:", err);
      
      const errMsg = (err.message || "").toLowerCase() + " " + (err.reason || "").toLowerCase() + " " + (err.data || "").toLowerCase();
      if (
        errMsg.includes("cooldown active") || 
        errMsg.includes("cooldown") || 
        (errMsg.includes("reverted") && errMsg.includes("24h"))
      ) {
        triggerNotification(
          "Faucet Cooldown Active", 
          "On-chain claim cooldown is active. Displaying remaining 24-hour countdown time...", 
          "warning"
        );
        // Force sync with the chain to discover the real last Claim time to feed the countdown timeline
        await fetchOnChainBalances(walletState.address);
      } else {
        triggerNotification("Faucet Failed", err.reason || err.message || "Failed to call on-chain faucet.", "warning");
      }
    }
  };

  // Wrap and Unwrap Native ETH on-chain
  const handleWrapETH = async (amount: number) => {
    if (!walletState) return;
    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      triggerNotification("Wrapping ETH", `Depositing ${amount} ETH to receive ${amount} WETH...`, "info");

      const wethContract = new ethers.Contract(CONTRACTS.WETH, [
        "function deposit() public payable"
      ], signer);

      const tx = await wethContract.deposit({ value: ethers.parseEther(amount.toString()) });
      triggerNotification("Tx Broadcasted", `Waiting for block validation: ${tx.hash.substring(0, 16)}...`, "info");
      await tx.wait();

      await fetchOnChainBalances(walletState.address);
      triggerNotification("Wrap Success", `Successfully wrapped ${amount} ETH into WETH 1:1!`, "success");
    } catch (err: any) {
      console.error("Wrap failed:", err);
      triggerNotification("Wrap Failed", err.message || "Failed to wrap ETH.", "warning");
    }
  };

  const handleUnwrapETH = async (amount: number) => {
    if (!walletState) return;
    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      triggerNotification("Unwrapping WETH", `Withdrawing ${amount} WETH to receive ${amount} ETH...`, "info");

      const wethContract = new ethers.Contract(CONTRACTS.WETH, [
        "function withdraw(uint256 amount) external"
      ], signer);

      const tx = await wethContract.withdraw(ethers.parseEther(amount.toString()));
      triggerNotification("Tx Broadcasted", `Waiting for block validation: ${tx.hash.substring(0, 16)}...`, "info");
      await tx.wait();

      await fetchOnChainBalances(walletState.address);
      triggerNotification("Unwrap Success", `Successfully unwrapped ${amount} WETH to ETH 1:1!`, "success");
    } catch (err: any) {
      console.error("Unwrap failed:", err);
      triggerNotification("Unwrap Failed", err.message || "Failed to unwrap WETH.", "warning");
    }
  };

  // AMM Swaps
  const handleSwap = async (tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountIn: number, expectedOut: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK SWAP TRANSACTION
    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      const tokenInConfig = tokens[tokenIn];
      const tokenOutConfig = tokens[tokenOut];
      if (!tokenInConfig || !tokenOutConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawAmountIn = ethers.parseUnits(toSafeDecimalString(amountIn, tokenInConfig.decimals), tokenInConfig.decimals);

      // Standard ERC-20 approval check
      const tokenInContract = new ethers.Contract(tokenInConfig.address, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ], signer);

      const currentAllowance = await tokenInContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentAllowance < rawAmountIn) {
        triggerNotification("Approval Required", `Confirm allowance limit for ${tokenIn} to authorize trade transaction...`, "info");
        const approveTx = await tokenInContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveTx.wait();
        triggerNotification("Approval Mined", `${tokenIn} spend allowance successfully authorized.`, "success");
      }

      // Swap execution
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256)"
      ], signer);

      triggerNotification("Swap Pending", `Broadcasting swap of ${amountIn} ${tokenIn} for ${tokenOut}...`, "info");
      const swapTx = await dexContract.swap(tokenInConfig.address, tokenOutConfig.address, rawAmountIn);

      triggerNotification("Swap Broadcasted", `Tx Hash: ${swapTx.hash.substring(0, 16)}... awaiting validation`, "info");
      const receipt = await swapTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "SWAP",
        detail: `Exchanged ${amountIn.toLocaleString()} ${tokenIn} for ${tokenOut} on-chain.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Swap Success", `Exchanged ${amountIn} ${tokenIn} for ${tokenOut} successfully!`, "success");
    } catch (err: any) {
      console.error("On-chain swap transaction faulted:", err);
      triggerNotification("Swap Failed", err.message || "Failed to finalize exchange on-chain.", "warning");
    }
  };

  // LP Pool additions
  const handleAddLiquidity = async (tokenA: TokenSymbol, tokenB: TokenSymbol, valA: number, valB: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK TRANSACTION
    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      const tokenAConfig = tokens[tokenA];
      const tokenBConfig = tokens[tokenB];
      if (!tokenAConfig || !tokenBConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawAmountA = ethers.parseUnits(toSafeDecimalString(valA, tokenAConfig.decimals), tokenAConfig.decimals);
      const rawAmountB = ethers.parseUnits(toSafeDecimalString(valB, tokenBConfig.decimals), tokenBConfig.decimals);

      // Standard ERC-20 approval checks
      const erc20Abi = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];

      // 1. Approve tokenA if required
      const tokenAContract = new ethers.Contract(tokenAConfig.address, erc20Abi, signer);
      const currentAAllowance = await tokenAContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentAAllowance < rawAmountA) {
        triggerNotification("Approval Required", `Confirm spend allowance to authorize ${tokenA} pool locking...`, "info");
        const approveATx = await tokenAContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveATx.wait();
        triggerNotification("Approval Mined", `${tokenA} spend limit authorized.`, "success");
      }

      // 2. Approve tokenB if required
      const tokenBContract = new ethers.Contract(tokenBConfig.address, erc20Abi, signer);
      const currentBAllowance = await tokenBContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentBAllowance < rawAmountB) {
        triggerNotification("Approval Required", `Confirm spend allowance to authorize ${tokenB} pool locking...`, "info");
        const approveBTx = await tokenBContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveBTx.wait();
        triggerNotification("Approval Mined", `${tokenB} spend limit authorized.`, "success");
      }

      // 3. Invoke addLiquidity
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
      ], signer);

      triggerNotification("Injection Pending", `Broadcasting addLiquidity for ${valA} ${tokenA} + ${valB} ${tokenB}...`, "info");
      const addLpTx = await dexContract.addLiquidity(tokenAConfig.address, tokenBConfig.address, rawAmountA, rawAmountB);

      triggerNotification("Injection Broadcasted", `Tx Hash: ${addLpTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await addLpTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "LP",
        detail: `Injected liquidity on-chain: ${valA.toLocaleString()} ${tokenA} + ${valB.toLocaleString()} ${tokenB}.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Liquidity Injected", `Successfully locked assets on-chain!`, "success");
    } catch (err: any) {
      console.error("On-chain select LP addition faulted:", err);
      triggerNotification("Addition Failed", err.message || "Failed to finalize liquidity addition on-chain.", "warning");
    }
  };

  // LP Pool withdrawals
  const handleRemoveLiquidity = async (tokenA: TokenSymbol, tokenB: TokenSymbol, sharesToBurn: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK TRANSACTION
    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      const tokenAConfig = tokens[tokenA];
      const tokenBConfig = tokens[tokenB];
      if (!tokenAConfig || !tokenBConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawShares = ethers.parseEther(sharesToBurn.toString()); // LP shares are 18 decimals in Solidity

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function removeLiquidity(address tokenA, address tokenB, uint256 shares) external returns (uint256, uint256)"
      ], signer);

      triggerNotification("Redemption Pending", `Broadcasting removeLiquidity for ${sharesToBurn.toFixed(4)} LP shares...`, "info");
      const removeLpTx = await dexContract.removeLiquidity(tokenAConfig.address, tokenBConfig.address, rawShares);

      triggerNotification("Redemption Broadcasted", `Tx Hash: ${removeLpTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await removeLpTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "LP",
        detail: `Burned ${sharesToBurn.toFixed(4)} LP shares onchain to retract pooling assets.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Liquidity Redeemed", "Successfully reclaimed underlying tokens into your wallet!", "success");
    } catch (err: any) {
      console.error("On-chain LP burn transaction faulted:", err);
      triggerNotification("Redemption Failed", err.message || "Failed to burn pool LP tokens on-chain.", "warning");
    }
  };

  // Staking lockup
  const handleStake = async (token: string, amount: number) => {
    if (!walletState) return;

    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");

      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      const tokenUpper = token.toUpperCase() as "USDC" | "USDT" | "DAI" | "ETH";
      const isEth = tokenUpper === "ETH";

      const tokenAddress = isEth ? ethers.ZeroAddress : CONTRACTS[tokenUpper];
      const dec = tokenUpper === "ETH" ? 18 : (tokenUpper === "DAI" ? 18 : 6);
      const rawAmount = ethers.parseUnits(toSafeDecimalString(amount, dec), dec);

      if (!isEth) {
        // Handle ERC20 approval and stake
        const erc20Contract = new ethers.Contract(tokenAddress, [
          "function approve(address spender, uint256 amount) returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function balanceOf(address account) view returns (uint256)"
        ], signer);

        const currentBalance = await erc20Contract.balanceOf(walletState.address);
        if (currentBalance < rawAmount) {
          throw new Error(`Insufficient ${tokenUpper} Balance! You have ${parseFloat(ethers.formatUnits(currentBalance, dec)).toLocaleString()} ${tokenUpper}.`);
        }

        // Check allowance & approve if necessary
        const currentAllowance = await erc20Contract.allowance(walletState.address, CONTRACTS.DEX);
        if (currentAllowance < rawAmount) {
          triggerNotification("Approval Required", `Approving DEX to stake your ${tokenUpper}...`, "info");
          const approveTx = await erc20Contract.approve(CONTRACTS.DEX, ethers.MaxUint256);
          await approveTx.wait();
          triggerNotification("Approval Confirmed", "Allowance successfully approved on-chain! Confirm Staking transaction in your wallet now.", "success");
        }
      }

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function stake(address token, uint256 amount) external payable"
      ], signer);

      triggerNotification("Staking Initiated", `Staking ${amount.toLocaleString()} ${tokenUpper} into Yield Pool...`, "info");
      
      let stakeTx;
      if (isEth) {
        stakeTx = await dexContract.stake(ethers.ZeroAddress, 0, { value: rawAmount });
      } else {
        stakeTx = await dexContract.stake(tokenAddress, rawAmount);
      }
      
      triggerNotification("Staking Broadcasted", `Tx Hash: ${stakeTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await stakeTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "STAKE",
        detail: `Locked ${amount.toLocaleString()} ${tokenUpper} on-chain in Yield Pool.`,
        txHash: receipt.hash
      };

      // Poll/pull the latest balances from L2 nodes instantly
      await fetchOnChainBalances(walletState.address);
      
      // Save logs back to sync DB as well
      await syncWalletState(walletState.address, {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      });

      triggerNotification("Staking Confirmed", `Success! Locked ${amount} ${tokenUpper} on-chain.`, "success");
    } catch (err: any) {
      console.error("Stake failed:", err);
      triggerNotification("Staking Failed", err.message || "Failed to commit tokens to contract pool.", "warning");
    }
  };

  // Staking withdraw-unstake
  const handleUnstake = async (token: string, amount: number) => {
    if (!walletState) return;

    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");

      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      const tokenUpper = token.toUpperCase() as "USDC" | "USDT" | "DAI" | "ETH";
      const isEth = tokenUpper === "ETH";
      const tokenAddress = isEth ? ethers.ZeroAddress : CONTRACTS[tokenUpper];

      const dec = tokenUpper === "ETH" ? 18 : (tokenUpper === "DAI" ? 18 : 6);
      const rawAmount = ethers.parseUnits(toSafeDecimalString(amount, dec), dec);

      const activeStakedBal = walletState.staking[tokenUpper]?.amountStaked || 0;
      if (amount > activeStakedBal) {
        throw new Error(`Cannot unstake more than currently staked! Staked balance: ${activeStakedBal} ${tokenUpper}.`);
      }

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function unstake(address token, uint256 amount) external"
      ], signer);

      triggerNotification("Unstaking Pending", `Unstaking ${amount.toLocaleString()} ${tokenUpper} from Yield Pool...`, "info");
      const unstakeTx = await dexContract.unstake(tokenAddress, rawAmount);

      triggerNotification("Unstake Broadcasted", `Tx Hash: ${unstakeTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await unstakeTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "UNSTAKE",
        detail: `Withdrew ${amount.toLocaleString()} ${tokenUpper} from Yield Pool.`,
        txHash: receipt.hash
      };

      await fetchOnChainBalances(walletState.address);

      await syncWalletState(walletState.address, {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      });

      triggerNotification("Unstake Succeeded", `Successfully unstaked ${amount} ${tokenUpper} on-chain!`, "success");
    } catch (err: any) {
      console.error("Unstake failed:", err);
      triggerNotification("Unstake Failed", err.message || "Failed to retrieve tokens from contract pool.", "warning");
    }
  };

  // Claim earnings trigger
  const handleClaimRewards = async () => {
    if (!walletState) return;

    try {
      const activeEth = await getEVMProvider();
      if (!activeEth) throw new Error("No ethereum provider found");

      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(activeEth);
      const signer = await browserProvider.getSigner();

      triggerNotification("Harvesting Rewards", "Claiming accumulated QOIN rewards on-chain...", "info");

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function harvestRewards(address userAddress, address token) public"
      ], signer);

      // Harvest from all 4 pools
      const assets = ["USDC", "USDT", "DAI", "ETH"] as const;
      let txHash = "";

      for (const asset of assets) {
        const pool = walletState.staking[asset];
        if (pool && (pool.amountStaked > 0 || pool.qoinRewardDebt > 0)) {
          const tokenAddress = asset === "ETH" ? ethers.ZeroAddress : CONTRACTS[asset];
          triggerNotification("Harvesting", `Harvesting QOIN rewards from ${asset} pool...`, "info");
          const claimTx = await dexContract.harvestRewards(walletState.address, tokenAddress);
          txHash = claimTx.hash;
          await claimTx.wait();
        }
      }

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "CLAIM",
        detail: "Harvested accumulated QOIN rewards from all pools on-chain.",
        txHash: txHash || "0x0"
      };

      await fetchOnChainBalances(walletState.address);

      await syncWalletState(walletState.address, {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      });

      triggerNotification("Harvest Confirmed", "Successfully harvested all premium yields directly into your wallet!", "success");
    } catch (err: any) {
      console.error("Harvest failed:", err);
      triggerNotification("Harvest Failed", err.message || "Failed to harvest staking rewards.", "warning");
    }
  };

  // Auto withdraw parameters configuration
  const handleUpdateAutoWithdraw = async (qoinLimit: number, extraLimit: number, enabled: boolean) => {
    if (!walletState) return;

    const config = {
      QOIN: qoinLimit,
      enabled
    };

    const nextState: Partial<WalletState> = {
      autoWithdrawThresholds: config
    };

    await syncWalletState(walletState.address, nextState);
    triggerNotification(
      "Auto Harvester Synced",
      `Automatic dispatch threshold updated. (Enabled: ${enabled ? "YES" : "NO"})`,
      "success"
    );
  };

  // Handle MasterChef dynamic rewards rates update on-chain
  const handleUpdateRewardRates = async (nblad: number, de4i: number, usdc: number, usdt: number) => {
    if (!walletState) return;
    try {
       const activeEth = await getEVMProvider();
       if (!activeEth) throw new Error("No Web3 provider found");
      await ensureCorrectNetwork();
      const provider = new ethers.BrowserProvider(activeEth);
      const signer = await provider.getSigner();

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function setRewardRates(uint256 _nblad, uint256 _de4i, uint255 _usdc, uint255 _usdt) external"
      ], signer);

      triggerNotification("Broadcasting Rates", "Submitting setRewardRates transaction to TeQoin L2...", "info");
      
      const tx = await dexContract.setRewardRates(nblad, de4i, usdc, usdt);
      
      triggerNotification("Tx Broadcasted", "Awaiting confirmation block...", "info");
      const receipt = await tx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "SYSTEM",
        detail: `Regulated Pool Reward Rates: QOIN[NBLAD:${nblad}, DE4I:${de4i}, USDC:${usdc}, USDT:${usdt}]`,
        txHash: receipt.hash,
      };

      await syncWalletState(walletState.address, {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      });
      await fetchOnChainBalances(walletState.address);

      triggerNotification("Rates Regulated", "On-chain reward distribution rates configured successfully!", "success");
    } catch (err: any) {
      console.error("Failed to regulate reward rates on-chain:", err);
      triggerNotification("Execution Failure", err.message || "Set Reward Rates transaction defaulted.", "warning");
    }
  };

  const handleClearLogs = async () => {
    if (!walletState) return;
    const nextState: Partial<WalletState> = {
      logs: []
    };
    await syncWalletState(walletState.address, nextState);
    triggerNotification("Logs Cleared", "Terminal actions journal sanitized.", "info");
  };

  // Load saved tokens from localStorage whenever the wallet address changes
  useEffect(() => {
    if (walletState && walletState.address) {
      const addressKey = walletState.address.toLowerCase();
      const storageKey = `teqoin_saved_tokens_${addressKey}`;
      const savedStr = localStorage.getItem(storageKey);
      
      const mergedTokens = { ...TOKENS };
      if (savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          Object.assign(mergedTokens, parsed);
          console.log("Successfully loaded and merged custom tokens for connected address:", addressKey, parsed);
        } catch (e) {
          console.error("Failed to parse saved tokens:", e);
        }
      }
      setTokens(mergedTokens);
    } else {
      // Revert to initial TOKENS when no wallet is connected
      setTokens(TOKENS);
    }
  }, [walletState?.address]);

  // Handle saving imported custom L2 tokens persistently per wallet address
  const handleSaveToken = useCallback((newToken: { symbol: string; name: string; address: string; decimals: number; color: string }) => {
    if (!walletState || !walletState.address) {
      triggerNotification("Connection Required", "Please connect your wallet first.", "warning");
      return;
    }
    const tokenSymbol = newToken.symbol.trim().toUpperCase();
    const tokenInfo = {
      ...newToken,
      symbol: tokenSymbol,
      iconName: "Coins"
    };

    // Update the tokens state
    setTokens(prev => ({
      ...prev,
      [tokenSymbol]: tokenInfo
    }));

    // Save to local storage for the specific wallet address
    const key = `teqoin_saved_tokens_${walletState.address.toLowerCase()}`;
    const existingStr = localStorage.getItem(key);
    let existing: Record<string, any> = {};
    if (existingStr) {
      try {
        existing = JSON.parse(existingStr);
      } catch (e) {}
    }
    existing[tokenSymbol] = tokenInfo;
    localStorage.setItem(key, JSON.stringify(existing));

    // Update walletState balances with 0 by default so it shows up in their list
    if (!walletState.balances[tokenSymbol]) {
      const nextBalances = {
        ...walletState.balances,
        [tokenSymbol]: 0
      };
      
      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "SYSTEM",
        detail: `Successfully registered custom L2 token ${tokenSymbol} (${newToken.name}) to wallet watcher list.`,
        txHash: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("")
      };

      const nextState: Partial<WalletState> = {
        balances: nextBalances,
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      // Update both UI state and backend DB
      syncWalletState(walletState.address, nextState);
    }

    triggerNotification("Custom Token Tracked", `Successfully registered custom ERC-20 token ${tokenSymbol} to onchain balances dashboard!`, "success");
    // Trigger on-chain balance fetch immediately to load their actual balance on this custom contract
    fetchOnChainBalances(walletState.address);
  }, [walletState, syncWalletState, fetchOnChainBalances, triggerNotification]);

  // Helper formula to compute pending reward rates
  const getAccruedStakingRewards = (state: WalletState) => {
    const totalClaimable = (state.staking?.USDC?.qoinRewardDebt ?? 0) +
                           (state.staking?.USDT?.qoinRewardDebt ?? 0) +
                           (state.staking?.DAI?.qoinRewardDebt ?? 0) +
                           (state.staking?.ETH?.qoinRewardDebt ?? 0);
    return {
      qoin: totalClaimable
    };
  };

  const getSortedPairKey = (tA: TokenSymbol, tB: TokenSymbol) => {
    const sorted = [tA, tB].sort();
    return `${sorted[0]}_${sorted[1]}`;
  };

  // Simulate compilation and deployment of a custom ERC-20 token in standard web3 console
  const runContractDeploymentSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tkName.trim() || !tkSymbol.trim()) {
      triggerNotification("Deployment Input Error", "Token Name and Symbol are required.", "warning");
      return;
    }
    if (tkTotalSupply <= 0) {
      triggerNotification("Deployment Input Error", "Total Supply must be a positive number.", "warning");
      return;
    }
    if (!walletState) {
      triggerNotification("Wallet Connection Required", "Please connect your browser wallet first to authorize the deployment transaction.", "warning");
      return;
    }

    const symbolUpper = tkSymbol.trim().toUpperCase();
    const nameTrimmed = tkName.trim();

    setDeployingSim(true);
    setDeployConsoleLogs(prev => [
      ...prev,
      `[COMPILING] Initializing Solidity Compiler solc v0.8.20+commit.a1b2c3d4...`,
      `[COMPILING] Loading Template: OpenZeppelin ERC20 standard token ruleset`,
      `[COMPILING] Injected token configuration: Name="${nameTrimmed}", Symbol="${symbolUpper}", Decimals=${tkDecimals}`,
      `[COMPILING] Initial supply minted to architect: ${tkTotalSupply.toLocaleString()} units`,
      `[COMPILING] Optimizing parameters: 200 compilation runs, EVM gas constraints verified.`
    ]);

    setTimeout(() => {
      setDeployConsoleLogs(prev => [
        ...prev,
        `[BUILD_OK] Solidity compiles cleanly! Bytecode size: 9.24 KB. Ready to broadcast.`,
        `[DEPLOYING] Connected browser wallet (${walletState.address.substring(0, 10)}...) signing and authorizing deploy payload on TeQoin L2 (EVM ID 420377)...`,
        `[DEPLOYING] Broadcasting transaction to gateway node at https://rpc.teqoin.io...`,
        `[DEPLOYING] Waiting for block mining lease confirmation...`
      ]);

      setTimeout(() => {
        const tokenAddr = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
        const deployTxHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");

        setDeployConsoleLogs(prev => [
          ...prev,
          `[SUCCESS] Block #${Math.floor(18053100 + Math.random() * 100)} mined with 0 gas latency on TeQoin L2!`,
          `[SUCCESS] Tx Hash: ${deployTxHash}`,
          `[SUCCESS] Token Contract Address: ${tokenAddr}`,
          `[SUCCESS] Total Supply of ${tkTotalSupply.toLocaleString()} ${symbolUpper} credited to architect wallet: ${walletState?.address || "your connected client"}`,
          `[INFO] Verified token contract bytecode safely matches ABI interface specifications.`,
          `[INFO] Registered automatic swap pairing router: ${symbolUpper} / USDT pool initialized.`
        ]);

        // Add to tokens dictionary
        setTokens(prev => ({
          ...prev,
          [symbolUpper]: {
            symbol: symbolUpper,
            name: nameTrimmed,
            address: tokenAddr,
            decimals: tkDecimals,
            color: tkColor,
            iconName: "Gift"
          }
        }));

        // Add to user deployed state list
        const newTokenObj = {
          name: nameTrimmed,
          symbol: symbolUpper,
          address: tokenAddr,
          supply: tkTotalSupply,
          decimals: tkDecimals,
          txHash: deployTxHash
        };
        setDeployedTokens(prev => [newTokenObj, ...prev]);

        // Credit user's wallet state
        if (walletState) {
          const nextBalances = {
            ...walletState.balances,
            [symbolUpper]: tkTotalSupply
          };

          const pushLog = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
            type: "DEPLOY",
            detail: `Deployed token contract ${symbolUpper} (${nameTrimmed}) on TeQoin L2. Recieved full supply of ${tkTotalSupply.toLocaleString()} tokens in wallet.`,
            txHash: deployTxHash
          };

          const nextState: Partial<WalletState> = {
            balances: nextBalances,
            logs: [pushLog, ...walletState.logs].slice(0, 40)
          };

          // Initialize custom swap pool with USDT so the user can exchange it immediately on SWAP/LP tabs!
          setPoolReserves(prev => {
            const pairKey = ["USDT", symbolUpper].sort().join("_");
            return {
              ...prev,
              [pairKey]: {
                reserveA: 50000,           // Pre-fund 50,000 USDT to let them sell their custom token
                reserveB: tkTotalSupply * 0.1, // Pool standard 10% of total supply (or at least 25k)
                totalShares: 100000,
                userShares: 0
              }
            };
          });

          // Sync payload
          syncWalletState(walletState.address, nextState);
        }

        setDeployingSim(false);
        triggerNotification(
          "Token Deployed Successfully",
          `Your standard ERC-20 Token (${symbolUpper}) is now fully active inside our AMM and Wallet!`,
          "success"
        );
      }, 2500);

    }, 2000);
  };

  // Update body theme wrapper to apply CSS layers easily
  useEffect(() => {
    const doc = document.documentElement;
    if (isLightTheme) {
      doc.classList.add("light");
    } else {
      doc.classList.remove("light");
    }
  }, [isLightTheme]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      isLightTheme 
        ? "bg-zinc-50 text-zinc-900" 
        : "bg-[#050505] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200"
    }`}>
      
      {/* GLOBAL GLOW BACKDROPS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-[30%] right-10 w-[600px] h-[600px] bg-gradient-to-br from-fuchsia-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      
      {/* HEADER COMPONENT */}
      <Header
        isLightTheme={isLightTheme}
        setIsLightTheme={setIsLightTheme}
        walletState={walletState}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
        telemetry={telemetry}
        detectedChainId={detectedChainId}
        setupIopnNetwork={setupIopnNetwork}
        onShowWalletModal={() => setIsWalletModalOpen(true)}
      />

      {/* WRONG NETWORK ALERT BAR */}
      {walletState && detectedChainId !== null && detectedChainId !== 420377 && (
        <div className="bg-gradient-to-r from-amber-600/25 via-amber-500/25 to-amber-600/25 border-b border-amber-500/30 py-3 px-4 text-center select-none backdrop-blur animate-fade-in relative z-40">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 text-xs">
            <span className="font-mono text-amber-400 font-extrabold flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block mr-1" />
              Wrong Network Detected: Wallet is on Chain #{detectedChainId} instead of TeQoin L2
            </span>
            <button
              onClick={setupIopnNetwork}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-black font-mono font-black uppercase text-[10px] tracking-wider rounded transition-all shadow-[0_0_12px_rgba(245,158,11,0.5)] cursor-pointer"
            >
              <Cpu className="h-3 w-3 animate-pulse" /> Switch Network to TeQoin L2
            </button>
          </div>
        </div>
      )}

      {/* SELECTION TABS RAIL */}
      <nav className={`border-b ${isLightTheme ? "border-zinc-200 bg-white" : "border-cyan-500/20 bg-slate-900/10"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1.5 overflow-x-auto py-3 no-scrollbar">
            {[
              { id: "SWAP", label: "Swap Engine", icon: ArrowUpDown },
              { id: "LP", label: "Liquidity matrix", icon: Droplet },
              { id: "STAKING", label: "Staking & Faucet", icon: Lock },
              { id: "POOL", label: "POOL", icon: Compass },
              { id: "DEPLOY", label: "Deploy Token", icon: Layers },
              { id: "DASHBOARD", label: "DASHBOARD", icon: Terminal }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider font-extrabold border transition-all duration-300 whitespace-nowrap select-none ${
                    activeTab === tab.id
                      ? isLightTheme
                        ? "bg-white border-zinc-300 text-zinc-950 shadow-xs"
                        : "bg-cyan-500/10 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : isLightTheme
                        ? "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                        : "bg-transparent border-transparent text-slate-500 hover:border-cyan-500/20 hover:text-slate-350"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* INTERACTIVE WRAPPERS */}
        <div className="animate-fade-in space-y-8">

            {activeTab === "SWAP" && (
              <div className="max-w-xl mx-auto">
                <Swap
                  isLightTheme={isLightTheme}
                  walletState={walletState}
                  onSwap={handleSwap}
                  onWrap={handleWrapETH}
                  onUnwrap={handleUnwrapETH}
                  poolReserves={poolReserves}
                  tokens={tokens}
                  connectWallet={connectWallet}
                />
              </div>
            )}

            {activeTab === "LP" && (
              <div className="max-w-2xl mx-auto">
                <Pools
                  isLightTheme={isLightTheme}
                  walletState={walletState}
                  onAddLiquidity={handleAddLiquidity}
                  onRemoveLiquidity={handleRemoveLiquidity}
                  poolReserves={poolReserves}
                  tokens={tokens}
                  triggerNotification={triggerNotification}
                  connectWallet={connectWallet}
                />
              </div>
            )}

            {activeTab === "STAKING" && (
              <Staking
                isLightTheme={isLightTheme}
                walletState={walletState}
                onStake={handleStake}
                onUnstake={handleUnstake}
                onClaimRewards={handleClaimRewards}
                onClaimFaucet={handleClaimFaucet}
                onUpdateAutoWithdraw={handleUpdateAutoWithdraw}
                triggerNotification={triggerNotification}
                connectWallet={connectWallet}
              />
            )}

            {activeTab === "POOL" && (
              <PoolExplorer
                isLightTheme={isLightTheme}
                poolReserves={poolReserves}
                tokens={tokens}
                onChainReserves={onChainReserves}
                onSwitchTab={(tabId) => setActiveTab(tabId)}
              />
            )}

            {activeTab === "DEPLOY" && (
              <DeployToken
                isLightTheme={isLightTheme}
                walletState={walletState}
                triggerNotification={triggerNotification}
                tokens={tokens}
                setTokens={setTokens}
                setPoolReserves={setPoolReserves}
                syncWalletState={syncWalletState}
                deployedTokens={deployedTokens}
                setDeployedTokens={setDeployedTokens}
                getEVMProvider={getEVMProvider}
                ensureCorrectNetwork={ensureCorrectNetwork}
              />
            )}

            {activeTab === "DASHBOARD" && (
              <Dashboard
                isLightTheme={isLightTheme}
                walletState={walletState}
                telemetry={telemetry}
                onClearLogs={handleClearLogs}
                triggerSync={() => walletState && syncWalletState(walletState.address)}
                poolReserves={poolReserves}
                tokens={tokens}
                connectWallet={connectWallet}
                onSaveToken={handleSaveToken}
              />
            )}

          </div>

      </main>

      {/* WALLET ADDRESS COPY MODAL */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        walletState={walletState}
        isLightTheme={isLightTheme}
        disconnectWallet={disconnectWallet}
      />

      {/* CONNECT WALLET MODE SELECTION MODAL */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        isLightTheme={isLightTheme}
        connectWalletType={connectSpecificWallet}
        connectManualAddress={connectManualWallet}
      />

      {/* FLOAT PUSH NOTIFICATION DRAWER POPUPS */}
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full space-y-3 pointer-events-none">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="p-4 rounded-xl border bg-zinc-950/90 border-cyan-500/30 text-zinc-100 shadow-[0_4px_25px_rgba(6,182,212,0.2)] pointer-events-auto animate-slide-in relative overflow-hidden"
          >
            {/* Glowing left edge indicator */}
            <div className={`absolute top-0 left-0 w-1 h-full ${
              notif.type === "success" 
                ? "bg-emerald-400" 
                : notif.type === "warning" 
                ? "bg-rose-400" 
                : "bg-cyan-400"
            }`} />

            <div className="flex gap-3 pl-1">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  {notif.title}
                </p>
                <p className="text-[10px] text-zinc-400 leading-normal pl-1">{notif.message}</p>
              </div>

              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 self-start"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
