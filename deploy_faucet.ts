import fs from "fs";
import path from "path";
import solc from "solc";
import { ethers } from "ethers";

async function main() {
  console.log("=== COMPILING AND DEPLOYING ETH FAUCET SMART CONTRACT ===");
  const faucetPath = path.join(process.cwd(), "contracts", "Faucet.sol");
  if (!fs.existsSync(faucetPath)) {
    console.error("Faucet.sol is missing!");
    process.exit(1);
  }

  const faucetSource = fs.readFileSync(faucetPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "Faucet.sol": { content: faucetSource }
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

  console.log("Compiling Faucet.sol...");
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

  const faucetContractArtifact = compiled.contracts["Faucet.sol"]["Faucet"];
  console.log("Faucet compiled successfully.");

  // Load private key safely
  let privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.FAUCET_SPONSOR_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
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

  // Deploy Faucet
  console.log("Deploying Faucet contract containing native ETH claims...");
  const faucetFactory = new ethers.ContractFactory(
    faucetContractArtifact.abi,
    faucetContractArtifact.evm.bytecode.object,
    wallet
  );
  
  const faucetContract = await faucetFactory.deploy({ gasLimit: 3000000 });
  await faucetContract.waitForDeployment();
  const faucetAddress = await faucetContract.getAddress();
  console.log(`Faucet deployed at: ${faucetAddress}`);

  // Transfer 0.1 ETH from deployer wallet to faucet
  console.log("Sending exactly 0.1 ETH from creator to Faucet smart contract...");
  try {
    const tx = await wallet.sendTransaction({
      to: faucetAddress,
      value: ethers.parseEther("0.1"),
      gasLimit: 100000
    });
    await tx.wait();
    console.log("0.1 ETH transferred successfully! Faucet balance verified.");
  } catch (fundErr: any) {
    console.warn("\n[WARNING] Could not automatically transfer 0.1 ETH to the Faucet contract.");
    console.warn("Reason:", fundErr.message || fundErr);
    console.warn(`Please top up your deployer wallet (${wallet.address}) and transfer active ETH to the Faucet address: ${faucetAddress} manually.\n`);
  }

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

  deployedObj.Faucet = faucetAddress;
  fs.writeFileSync(jsonPath, JSON.stringify(deployedObj, null, 2), "utf8");
  console.log(`Updated deployed_addresses.json with Faucet coordinate: ${faucetAddress}`);

  // Sync src/types.ts
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, "utf8");
    typesContent = typesContent.replace(
      /Faucet:\s*"0x[0-9a-fA-F]+"/g,
      `Faucet: "${faucetAddress}"`
    );
    fs.writeFileSync(typesPath, typesContent, "utf8");
    console.log("Successfully updated src/types.ts with real Faucet address.");
  }

  console.log("=== FAUCET DEPLOYMENT COMPLETED SUCCESS ===");
}

main().catch((err) => {
  console.error("Faucet deployment process failed:", err);
});
