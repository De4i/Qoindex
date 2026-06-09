import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
  
  // Load Private Key from environment or pk.txt safely
  let privateKey = process.env.FAUCET_SPONSOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
  if (!privateKey) {
    const pkPath = path.join(process.cwd(), "pk.txt");
    if (fs.existsSync(pkPath)) {
      privateKey = fs.readFileSync(pkPath, "utf8").trim();
    }
  }
  if (!privateKey) {
    throw new Error("Private key is missing in environment variables and pk.txt.");
  }
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet Address: ${wallet.address}`);

  const NBLAD = "0x049f8891fb426C753CB082C9C0B4561175515d4E";
  const DE4I = "0xF7898A9c8E62B4008313e5F838Db403D7bce6f45";
  const newDEX = "0x73fFFEd379B5e4aCeC9FF5b6400381662e6Dd79D";

  const tokenAbi = [
    "function mint(address to, uint256 amount) external",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ];

  const nblad = new ethers.Contract(NBLAD, tokenAbi, wallet);
  const de4i = new ethers.Contract(DE4I, tokenAbi, wallet);

  console.log("Attempting to mint NBLAD to new DEX...");
  try {
    const tx = await nblad.mint(newDEX, ethers.parseUnits("1000000", 18));
    console.log("Mint tx broadcasted:", tx.hash);
    await tx.wait();
    console.log("Mint SUCCESS!");
  } catch (err: any) {
    console.log("Mint failed:", err.message);
  }

  console.log("\nAttempting to mint DE4I to new DEX...");
  try {
    const tx = await de4i.mint(newDEX, ethers.parseUnits("1000000", 18));
    console.log("Mint tx broadcasted:", tx.hash);
    await tx.wait();
    console.log("Mint SUCCESS!");
  } catch (err: any) {
    console.log("Mint failed:", err.message);
  }

  console.log("\nVerifying balances on new DEX...");
  try {
    console.log("NBLAD Balance:", ethers.formatUnits(await nblad.balanceOf(newDEX), 18));
    console.log("DE4I Balance:", ethers.formatUnits(await de4i.balanceOf(newDEX), 18));
  } catch (err: any) {
    console.log("Balance query failed:", err.message);
  }
}

main().catch(console.error);
