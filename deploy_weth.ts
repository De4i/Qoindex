import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const solc = require("solc");

async function main() {
  console.log("Starting WETH deployment script...");
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

  const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io");
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Deploying contract with wallet address:", wallet.address);

  const sourcePath = path.join(process.cwd(), "contracts", "TestERC20.sol");
  const sourceCode = fs.readFileSync(sourcePath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "TestERC20.sol": { content: sourceCode } },
    settings: {
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      optimizer: { enabled: true, runs: 200 }
    }
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  const contractArtifact = compiled.contracts["TestERC20.sol"]["TestERC20"];
  const abi = contractArtifact.abi;
  const bytecode = contractArtifact.evm.bytecode.object;

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log("Broadcasting deployment transaction on TeQoin L2...");
  const contract = await factory.deploy("Wrapped Ether", "WETH", 0n, { gasLimit: 3000000 });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("WETH deployed success at address:", address);

  // Update src/types.ts
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  let typesContent = fs.readFileSync(typesPath, "utf8");
  typesContent = typesContent.replace(/0x000000000000000000000000000000000000WETH/g, address);
  fs.writeFileSync(typesPath, typesContent);
  console.log("src/types.ts configured with real WETH address:", address);
}

main().catch(console.error);
