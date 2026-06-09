import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  LogOut,
  Compass
} from "lucide-react";
import { WalletState } from "../types";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletState: WalletState | null;
  isLightTheme: boolean;
  disconnectWallet?: () => void;
}

export default function WalletModal({
  isOpen,
  onClose,
  walletState,
  isLightTheme,
  disconnectWallet
}: WalletModalProps) {
  const [copied, setCopied] = useState(false);

  if (!walletState) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletState.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const formattedAddress = walletState.address;
  const shortAddress = `${formattedAddress.substring(0, 6)}...${formattedAddress.substring(formattedAddress.length - 4)}`;
  const blockExplorerLink = `https://testnet-blockscan.teqoin.io/address/details?address=${formattedAddress}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="uniswap-wallet-root" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          
          {/* Backdrop Overlay */}
          <motion.div
            id="modal-backdrop-uniswap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Uniswap Style Account Panel */}
          <motion.div
            id="uniswap-account-modal"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl font-mono ${
              isLightTheme 
                ? "bg-white border-slate-200 text-slate-900" 
                : "bg-zinc-950 border-white/10 text-slate-100"
            }`}
          >
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isLightTheme ? "border-slate-100" : "border-white/5"}`}>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Account info</span>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-all ${
                  isLightTheme 
                    ? "hover:bg-slate-100 text-slate-500" 
                    : "hover:bg-zinc-900 text-slate-400"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              {/* Account Address Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black">Connected Wallet</span>
                  <p className="text-lg font-bold tracking-tight mt-0.5">{shortAddress}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                    isLightTheme 
                      ? "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800" 
                      : "bg-zinc-900 border-white/5 hover:border-white/10 text-slate-200"
                  }`}
                  title="Copy Full Address"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Minimal Balance Displays like Uniswap */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 uppercase font-black">Holdings</span>
                <div className={`p-3.5 rounded-xl border space-y-2 ${
                  isLightTheme ? "bg-slate-50 border-slate-200" : "bg-black/35 border-white/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">ETH</span>
                    <span className="text-xs font-bold font-mono">
                      {typeof walletState.balances?.ETH === "number" ? walletState.balances.ETH.toFixed(4) : "0.0000"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-white/5 pt-2">
                    <span className="text-xs font-bold">QOIN</span>
                    <span className="text-xs font-bold font-mono text-cyan-400">
                      {typeof walletState.balances?.QOIN === "number" ? walletState.balances.QOIN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explorer link */}
              <div className="flex items-center justify-start">
                <a
                  href={blockExplorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-cyan-400 transition-colors uppercase font-mono"
                >
                  <Compass className="h-3 w-3" />
                  <span>View on Explorer</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              {/* Uniswap direct RED Disconnect Button */}
              {disconnectWallet && (
                <button
                  onClick={() => {
                    onClose();
                    disconnectWallet();
                  }}
                  className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs uppercase font-black rounded-xl tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Disconnect Wallet</span>
                </button>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
