import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
  const faucetSigner = "0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213";

  const USDC = "0xe819eb5be34b20f1fec012c0daf960397a0fb386";
  const USDT = "0xfcc025a3e170df62de0e25af7ceaf1c89abfe6e9";

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const usdc = new ethers.Contract(USDC, erc20Abi, provider);
  const usdt = new ethers.Contract(USDT, erc20Abi, provider);

  const usdcDec = await usdc.decimals();
  const usdtDec = await usdt.decimals();

  console.log(`USDC Decimals: ${usdcDec}`);
  console.log(`USDT Decimals: ${usdtDec}`);

  const usdcBal = await usdc.balanceOf(faucetSigner);
  const usdtBal = await usdt.balanceOf(faucetSigner);

  console.log(`Faucet Signer USDC Balance: ${ethers.formatUnits(usdcBal, usdcDec)}`);
  console.log(`Faucet Signer USDT Balance: ${ethers.formatUnits(usdtBal, usdtDec)}`);
  
  const nativeBal = await provider.getBalance(faucetSigner);
  console.log(`Faucet Signer Native Balance: ${ethers.formatEther(nativeBal)} OPN`);
}

main().catch(console.error);
