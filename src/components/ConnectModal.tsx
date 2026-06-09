import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Globe } from "lucide-react";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLightTheme: boolean;
  connectWalletType: (type: "metamask" | "okx") => Promise<void>;
  connectManualAddress?: (address: string) => Promise<void>;
}

export default function ConnectModal({
  isOpen,
  onClose,
  isLightTheme,
  connectWalletType,
  connectManualAddress,
}: ConnectModalProps) {
  const [manualAddress, setManualAddress] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddress = manualAddress.trim();
    if (!cleanAddress.startsWith("0x") || cleanAddress.length !== 42) {
      setErrorMsg("Invalid format! Address must start with 0x and be 42 characters long.");
      return;
    }
    setErrorMsg("");
    onClose();
    if (connectManualAddress) {
      await connectManualAddress(cleanAddress);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setManualAddress("");
      setErrorMsg("");
    }
  }, [isOpen]);

  
  // Custom SVG Icons for MetaMask and OKX Wallet for professional appearance
  const MetaMaskLogo = () => (
    <svg className="w-8 h-8 mr-1 shrink-0" viewBox="0 0 320 292" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M312.9 6.2L182.2 68.4L159.2 12.8L312.9 6.2Z" fill="#E2761B"/>
      <path d="M7.10001 6.2L137.8 68.4L160.8 12.8L7.10001 6.2Z" fill="#E2761B"/>
      <path d="M266.3 194.2L297.8 140.2L282.8 108.7L266.3 194.2Z" fill="#E2761B"/>
      <path d="M53.7 194.2L22.2 140.2L37.2 108.7L53.7 194.2Z" fill="#E2761B"/>
      <path d="M123.6 154.2L159.2 92.5L194.8 154.2H123.6Z" fill="#E2761B"/>
      <path d="M266.3 194.2L221.8 245.9L208.5 220.7L266.3 194.2Z" fill="#E2761B"/>
      <path d="M53.7 194.2L98.2 245.9L111.5 220.7L53.7 194.2Z" fill="#E2761B"/>
      <path d="M111.5 220.7L123.6 154.2H194.8L208.5 220.7H111.5Z" fill="#E4761B"/>
      <path d="M111.5 220.7L98.2 245.9L159.2 285.8L208.5 220.7H111.5Z" fill="#F6851B"/>
    </svg>
  );

  const OKXLogo = () => (
    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center font-black text-[11px] text-white tracking-tighter border border-white/20 mr-1 shrink-0">
      OKX
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Uniswap-style Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={`relative w-full max-w-sm overflow-hidden rounded-3xl border shadow-[0_0_40px_rgba(6,182,212,0.2)] font-sans ${
              isLightTheme 
                ? "bg-white border-zinc-200 text-zinc-900" 
                : "bg-zinc-950 border-white/10 text-slate-100"
            }`}
          >
            {/* Minimal line top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-fuchsia-600" />

            {/* Header */}
            <div className="p-5 flex items-center justify-between border-b border-white/5">
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Select a Wallet
              </h2>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-all ${
                  isLightTheme 
                    ? "hover:bg-zinc-100 text-zinc-500" 
                    : "hover:bg-white/5 text-slate-400"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Wallet Options */}
            <div className="p-5 space-y-3">
              
              {/* Option 1: MetaMask */}
              <button
                onClick={async () => {
                  onClose();
                  await connectWalletType("metamask");
                }}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group cursor-pointer ${
                  isLightTheme 
                    ? "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-orange-500/50" 
                    : "bg-white/[0.02] border-white/5 hover:border-orange-500/40 hover:bg-orange-500/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <MetaMaskLogo />
                  <div>
                    <span className="font-bold text-xs block">MetaMask</span>
                    <span className="text-[10px] text-zinc-500 block">Connect using MetaMask Wallet</span>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-orange-400 opacity-60 group-hover:opacity-100 transition-opacity">
                  Active
                </div>
              </button>

              {/* Option 2: OKX Wallet */}
              <button
                onClick={async () => {
                  onClose();
                  await connectWalletType("okx");
                }}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group cursor-pointer ${
                  isLightTheme 
                    ? "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-cyan-500/50" 
                    : "bg-white/[0.02] border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <OKXLogo />
                  <div>
                    <span className="font-bold text-xs block">OKX Wallet</span>
                    <span className="text-[10px] text-zinc-500 block">Connect using OKX Web3 Wallet</span>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity">
                  Active
                </div>
              </button>

              {/* Separator Accent */}
              <div className="relative my-4 flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isLightTheme ? "border-zinc-200" : "border-white/5"}`} />
                </div>
                <span className={`relative px-3 text-[9px] uppercase font-bold tracking-widest ${isLightTheme ? "bg-white text-zinc-400" : "bg-zinc-950 text-zinc-500"}`}>
                  ATAU CONNECT SECARA MANUAL
                </span>
              </div>

              {/* Option 3: Manual EVM Address Form */}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => {
                      setManualAddress(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="Masukkan custom address (0x...)"
                    className={`w-full px-4 py-3 rounded-xl border text-xs font-mono outline-none transition-all ${
                      isLightTheme
                        ? "bg-zinc-50 border-zinc-200 focus:border-cyan-500 text-zinc-900 placeholder-zinc-400"
                        : "bg-white/[0.02] border-white/5 focus:border-cyan-500/30 text-slate-100 placeholder-zinc-500"
                    }`}
                  />
                </div>
                {errorMsg && (
                  <p className="text-[9px] text-rose-500 font-semibold px-1">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-[10px] uppercase tracking-wider hover:opacity-95 transition-opacity cursor-pointer"
                >
                  Hubungkan Custom Address
                </button>
              </form>

              <div className="pt-3 text-[9px] text-center text-zinc-500 uppercase tracking-widest font-mono flex items-center justify-center gap-1">
                <Globe className="h-3 w-3 text-cyan-500" />
                <span>Compatible with TeQoin L2 Protocol</span>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
