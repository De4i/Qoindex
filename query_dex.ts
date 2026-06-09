import { ethers } from "ethers";

async function main() {
  const providers = [
    { name: "TeQoin RPC", url: "https://rpc.teqoin.io" },
    { name: "Iopn Testnet RPC", url: "https://testnet-rpc.iopn.tech" }
  ];
  
  const DEX = "0x7F547f1CF2EFb8e45583D3A50f9a31E2656A3883";
  const dexContractAbi = [
    "function QOIN() view returns (address)",
    "function USDC() view returns (address)",
    "function USDT() view returns (address)",
    "function NBLAD() view returns (address)",
    "function DE4I() view returns (address)"
  ];

  for (const prov of providers) {
    try {
      console.log(`Querying ${prov.name} : ${prov.url}...`);
      const provider = new ethers.JsonRpcProvider(prov.url);
      // check code
      const code = await provider.getCode(DEX);
      console.log(`DEX Code length: ${code.length}`);
      if (code.length > 2) {
        const dexContract = new ethers.Contract(DEX, dexContractAbi, provider);
        const qoin = await dexContract.QOIN();
        console.log(`Success on ${prov.name}! QOIN limit: ${qoin}`);
      }
    } catch (err) {
      console.log(`Failed on ${prov.name}:`, err.message);
    }
  }
}

main().catch(console.error);
