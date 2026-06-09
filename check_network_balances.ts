import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  let privateKey = "";
  const pkPath = path.join(process.cwd(), "pk.txt");
  if (fs.existsSync(pkPath)) {
    privateKey = fs.readFileSync(pkPath, "utf8").trim();
  }
  if (!privateKey) {
    throw new Error("pk.txt is empty or missing.");
  }
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }
  const userAddress = "0xc94768c80d488fd92842934e5df82f8a9321af52";
  console.log("Checking balances for user wallet address:", userAddress);

  const networks = [
    { name: "TeQoin RPC (rpc.teqoin.io)", url: "https://rpc.teqoin.io" },
    { name: "Iopn Testnet (testnet-rpc.iopn.tech)", url: "https://testnet-rpc.iopn.tech" }
  ];

  for (const net of networks) {
    try {
      console.log(`\nNetwork: ${net.name}`);
      const provider = new ethers.JsonRpcProvider(net.url);
      const balance = await provider.getBalance(userAddress);
      console.log("  Native ETH/OPN Balance (Sponsor):", ethers.formatEther(balance));

      const faucetAddress = "0xE0Bec5f17F62836F911FAE1B0298c337ADD7229D";
      const faucetBalance = await provider.getBalance(faucetAddress);
      console.log("  Faucet Contract Balance:", ethers.formatEther(faucetBalance));

      // let's check some token balances if we can
      const tokensToCheck = [
        { name: "USDT_NEW", address: "0xfcc025a3e170df62de0e25af7ceaf1c89abfe6e9" },
        { name: "USDC_NEW", address: "0xe819eb5be34b20f1fec012c0daf960397a0fb386" },
        { name: "DAI_NEW", address: "0xb96a869c74be2ed561d95a77408505371f287d16" }
      ];

      for (const tok of tokensToCheck) {
        try {
          const contract = new ethers.Contract(tok.address, [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], provider);
          const bal = await contract.balanceOf(userAddress);
          const dec = await contract.decimals();
          console.log(`  Token ${tok.name} (${tok.address}):`, ethers.formatUnits(bal, dec));
        } catch (e) {
          console.log(`  Token ${tok.name} (${tok.address}) query failed:`, e.message);
        }
      }
    } catch (e) {
      console.log(`Failed on network ${net.name}:`, e.message);
    }
  }
}

main().catch(console.error);
