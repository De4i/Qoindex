import fs from "fs";
import path from "path";
import solc from "solc";
import { ethers } from "ethers";

async function main() {
  console.log("=== COMPILING AND DEPLOYING QOIN TOKEN (10B SUPPLY) ===");
  const erc20Path = path.join(process.cwd(), "contracts", "TestERC20.sol");
  if (!fs.existsSync(erc20Path)) {
    console.error("TestERC20.sol is missing!");
    process.exit(1);
  }

  const erc20Source = fs.readFileSync(erc20Path, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "TestERC20.sol": { content: erc20Source }
    },
    settings: {
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      }
    },
  };

  console.log("Compiling TestERC20.sol...");
  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

  if (compiled.errors) {
    let hasError = false;
    for (const error of compiled.errors) {
      console.log(`[${error.severity.toUpperCase()}] ${error.formattedMessage}`);
      if (error.severity === "error") {
        hasError = true;
      }
    }
    if (hasError) {
      console.error("Compilation failed.");
      process.exit(1);
    }
  }

  const erc20ContractArtifact = compiled.contracts["TestERC20.sol"]["TestERC20"];
  console.log("TestERC20 compiled successfully.");

  // Load private key safely from environment or pk.txt
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
  console.log("Deployer address:", wallet.address);

  // Deploy QOIN (10B supply)
  console.log("Deploying QOIN token with 10,000,000,000 max supply...");
  const qoinFactory = new ethers.ContractFactory(
    erc20ContractArtifact.abi,
    erc20ContractArtifact.evm.bytecode.object,
    wallet
  );
  
  // 10 Billion supply
  const qoinContract = await qoinFactory.deploy("TeQoin Token", "QOIN", 10000000000n, { gasLimit: 3000000 });
  await qoinContract.waitForDeployment();
  const qoinAddress = await qoinContract.getAddress();
  console.log(`QOIN deployed at: ${qoinAddress}`);

  // Save/Update deployed_addresses.json
  const jsonPath = path.join(process.cwd(), "deployed_addresses.json");
  let deployedObj: any = {};
  if (fs.existsSync(jsonPath)) {
    try {
      deployedObj = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (e) {
      deployedObj = {};
    }
  }

  deployedObj.QOIN = qoinAddress;
  fs.writeFileSync(jsonPath, JSON.stringify(deployedObj, null, 2), "utf8");
  console.log(`Updated deployed_addresses.json with QOIN coordinate: ${qoinAddress}`);

  // Sync src/types.ts
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, "utf8");
    typesContent = typesContent.replace(
      /QOIN:\s*"0x[0-9a-fA-F]+"/g,
      `QOIN: "${qoinAddress}"`
    );
    fs.writeFileSync(typesPath, typesContent, "utf8");
    console.log("Successfully updated src/types.ts with real QOIN address.");
  }

  console.log("=== QOIN TOKEN DEPLOYMENT COMPLETED SUCCESS ===");
}

main().catch((err) => {
  console.error("QOIN deployment process failed:", err);
});
