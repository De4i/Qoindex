import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Web3ContextType {
  address: string | null;
  isConnected: boolean;
  connector: any;
  chainId: number | null;
  disconnect: () => void;
  switchChainAsync: (options: { chainId: number }) => Promise<void>;
  open: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType>({
  address: null,
  isConnected: false,
  connector: null,
  chainId: null,
  disconnect: () => {},
  switchChainAsync: async () => {},
  open: async () => {},
});

export function Web3ContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const getEthereum = () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  };

  const syncState = async () => {
    const ethereum = getEthereum();
    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress(null);
        }

        const networkHex = await ethereum.request({ method: "eth_chainId" });
        if (networkHex) {
          setChainId(parseInt(newChainIdCleanup(networkHex), 16));
        }
      } catch (e) {
        console.warn("Failed to sync Ethereum state:", e);
      }
    }
  };

  const newChainIdCleanup = (hex: string) => {
    if (hex.startsWith("0x")) return hex;
    return "0x" + parseInt(hex).toString(16);
  };

  useEffect(() => {
    syncState();

    const ethereum = getEthereum();
    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress(null);
        }
      };

      const handleChainChanged = (newChainIdHex: string) => {
        setChainId(parseInt(newChainIdHex, 16));
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const disconnect = () => {
    setAddress(null);
  };

  const switchChainAsync = async (options: { chainId: number }) => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("No crypto wallet detected.");
    }
    const hexChainId = "0x" + options.chainId.toString(16);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: "TeQoin L2",
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://rpc.teqoin.io"],
              blockExplorerUrls: ["https://testnet-blockscan.teqoin.io"],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  };

  const open = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("No crypto wallet found! Please install MetaMask or OKX Wallet.");
    }
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (e: any) {
      throw new Error(e.message || "User rejected connection");
    }
  };

  const isConnected = !!address;
  const connector = {
    getProvider: async () => getEthereum(),
  };

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected,
        connector,
        chainId,
        disconnect,
        switchChainAsync,
        open,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(Web3Context);
  return {
    address: ctx.address,
    isConnected: ctx.isConnected,
    connector: ctx.connector,
    chainId: ctx.chainId,
  };
}

export function useDisconnect() {
  const ctx = useContext(Web3Context);
  return { disconnect: ctx.disconnect };
}

export function useSwitchChain() {
  const ctx = useContext(Web3Context);
  return { switchChainAsync: ctx.switchChainAsync };
}

export function useAppKit() {
  const ctx = useContext(Web3Context);
  return { open: ctx.open };
}

export function Web3Provider({ children }: { children: ReactNode }) {
  return <Web3ContextProvider>{children}</Web3ContextProvider>;
}
