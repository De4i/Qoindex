import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
  
  const NBLAD = "0x049f8891fb426C753CB082C9C0B4561175515d4E";
  const DE4I = "0xF7898A9c8E62B4008313e5F838Db403D7bce6f45";
  const deployer = "0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213";

  // Let's check if there's a mint or faucet function we can call on NBLAD
  const testAbis = [
    "function mint(address to, uint256 amount) external",
    "function faucet(uint256 amount) external",
    "function claim() external",
    "function owner() view returns (address)",
  ];

  for (const tokenAddress of [NBLAD, DE4I]) {
    console.log(`\nTesting address: ${tokenAddress}`);
    const code = await provider.getCode(tokenAddress);
    console.log(`Code length: ${code.length}`);
    
    // Check if we can query the owner
    const tokenContract = new ethers.Contract(tokenAddress, testAbis, provider);
    try {
      const ownerAddress = await tokenContract.owner();
      console.log(`Owner: ${ownerAddress}`);
    } catch (e: any) {
      console.log(`No owner() function: ${e.message.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);
