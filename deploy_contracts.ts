import solc from "solc";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  console.log("=== STARTING QOINDEX DEPLOYMENT ON TEQOIN L2 ===");

  // 1. Setup provider and wallet safely from env or pk.txt
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
  
  // Connect to TeQoin L2 Network
  const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io", undefined, {
    staticNetwork: true
  });
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Account Wallet Address: ${wallet.address}`);

  // 2. Read Solidity source codes
  const dexPath = path.join(process.cwd(), "contracts", "QoinDEX.sol");
  const erc20Path = path.join(process.cwd(), "contracts", "TestERC20.sol");
  
  if (!fs.existsSync(dexPath) || !fs.existsSync(erc20Path)) {
    console.error("Solidity source code files are missing!");
    process.exit(1);
  }

  const dexSource = fs.readFileSync(dexPath, "utf8");
  const erc20Source = fs.readFileSync(erc20Path, "utf8");

  // 3. Compile sources
  console.log("Compiling smart contracts using solc compiler...");
  const input = {
    language: "Solidity",
    sources: {
      "QoinDEX.sol": { content: dexSource },
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
      console.error("Compilation failed due to Solidity compiler errors.");
      process.exit(1);
    }
  }

  const dexArtifact = compiled.contracts["QoinDEX.sol"]["QoinDEX"];
  const erc20Artifact = compiled.contracts["TestERC20.sol"]["TestERC20"];
  
  console.log("Solidity contracts compiled successfully.");

  // 2. Setup ERC20 ContractFactory
  const erc20Factory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.evm.bytecode.object, wallet);

  // Use user's existing token contracts instead of deploying new ones
  const USDC = "0xe819eb5be34b20f1fec012c0daf960397a0fb386";
  const USDT = "0xfcc025a3e170df62de0e25af7ceaf1c89abfe6e9";
  const DAI = "0xb96a869c74be2ed561d95a77408505371f287d16";
  console.log(`Using existing USDC at: ${USDC}`);
  console.log(`Using existing USDT at: ${USDT}`);
  console.log(`Using existing DAI at: ${DAI}`);

  // Deploy NBLAD Reward Token
  console.log("Deploying NBLAD Reward Token...");
  const nbladContract = await erc20Factory.deploy("Nebula Blade", "NBLAD", 1000000000n, { gasLimit: 3000000 }); // 1 Billion
  await nbladContract.waitForDeployment();
  const NBLAD = await nbladContract.getAddress();
  console.log(`NBLAD deployed_at: ${NBLAD}`);

  // Deploy DE4I Reward Token
  console.log("Deploying DE4I Reward Token...");
  const de4iContract = await erc20Factory.deploy("Deity Quantum", "DE4I", 1000000000n, { gasLimit: 3000000 }); // 1 Billion
  await de4iContract.waitForDeployment();
  const DE4I = await de4iContract.getAddress();
  console.log(`DE4I deployed at: ${DE4I}`);

  // Deploy QOIN Utility Token
  console.log("Deploying QOIN Utility Token (for Faucet and Staking)...");
  const qoinContract = await erc20Factory.deploy("TeQoin Token", "QOIN", 1000000000n, { gasLimit: 3000000 }); // 1 Billion
  await qoinContract.waitForDeployment();
  const QOIN = await qoinContract.getAddress();
  console.log(`QOIN deployed at: ${QOIN}`);

  // Deploy QoinDEX Contract
  console.log("Deploying QoinDEX core exchange and staking smart contract...");
  const dexFactory = new ethers.ContractFactory(dexArtifact.abi, dexArtifact.evm.bytecode.object, wallet);
  const dexContract = await dexFactory.deploy(USDC, USDT, DAI, NBLAD, DE4I, QOIN, { gasLimit: 5000000 });
  await dexContract.waitForDeployment();
  const DEX = await dexContract.getAddress();
  console.log(`QoinDEX deployed at: ${DEX}`);

  // Create and Save addresses mapping early
  const deployedObj = {
    DEX,
    USDC,
    USDT,
    DAI,
    NBLAD,
    DE4I,
    QOIN,
    deployedTimestamp: Date.now(),
    deployedBy: wallet.address,
    txHash: dexContract.deploymentTransaction()?.hash
  };

  const jsonPath = path.join(process.cwd(), "deployed_addresses.json");
  fs.writeFileSync(jsonPath, JSON.stringify(deployedObj, null, 2), "utf8");
  console.log(`Saved coordinates early into ${jsonPath}`);

  // Sync src/types.ts immediately
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, "utf8");
    typesContent = typesContent
      .replace(/DEX:\s*"0x[0-9a-fA-F]+"/g, `DEX: "${DEX}"`)
      .replace(/Masterchef:\s*"0x[0-9a-fA-F]+"/g, `Masterchef: "${DEX}"`)
      .replace(/Faucet:\s*"0x[0-9a-fA-F]+"/g, `Faucet: "${DEX}"`)
      .replace(/Pair:\s*"0x[0-9a-fA-F]+"/g, `Pair: "${DEX}"`)
      .replace(/USDC:\s*"0x[0-9a-fA-F]+"/g, `USDC: "${USDC}"`)
      .replace(/USDT:\s*"0x[0-9a-fA-F]+"/g, `USDT: "${USDT}"`)
      .replace(/DAI:\s*"0x[0-9a-fA-F]+"/g, `DAI: "${DAI}"`)
      .replace(/NBLAD:\s*"0x[0-9a-fA-F]+"/g, `NBLAD: "${NBLAD}"`)
      .replace(/DE4I:\s*"0x[0-9a-fA-F]+"/g, `DE4I: "${DE4I}"`)
      .replace(/QOIN:\s*"0x[0-9a-fA-F]+"/g, `QOIN: "${QOIN}"`);
    fs.writeFileSync(typesPath, typesContent, "utf8");
    console.log("Successfully updated src/types.ts with custom TeQoin L2 coordinates.");
  }

  // 4. Fund QoinDEX
  console.log("Funding QoinDEX with rewards and faucet liquidity pools...");
  const fundAmt = ethers.parseUnits("50000000", 18); // 50,000,000
  const faucetFundAmt = ethers.parseUnits("100000000", 18); // 100,000,000

  // Standard token interfaces for transfers
  const erc20AbiSimple = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ];
  
  const usdcInstance = new ethers.Contract(USDC, erc20AbiSimple, wallet);
  const usdtInstance = new ethers.Contract(USDT, erc20AbiSimple, wallet);
  const nbladInstance = new ethers.Contract(NBLAD, erc20AbiSimple, wallet);
  const de4iInstance = new ethers.Contract(DE4I, erc20AbiSimple, wallet);
  const qoinInstance = new ethers.Contract(QOIN, erc20AbiSimple, wallet);

  // Fund rewards to DEX
  try {
    await (await nbladInstance.transfer(DEX, fundAmt, { gasLimit: 200000 })).wait();
    console.log("Funded 50M NBLAD rewards to DEX success!");
  } catch (err: any) {
    console.warn("Skipping NBLAD rewards funding:", err.message || err);
  }

  try {
    await (await de4iInstance.transfer(DEX, fundAmt, { gasLimit: 200000 })).wait();
    console.log("Funded 50M DE4I rewards to DEX success!");
  } catch (err: any) {
    console.warn("Skipping DE4I rewards funding:", err.message || err);
  }

  try {
    const usdcFundAmt = ethers.parseUnits("50000000", 6); // existing USDC has 6 decimals
    await (await usdcInstance.transfer(DEX, usdcFundAmt, { gasLimit: 200000 })).wait();
    console.log("Funded 50M USDC rewards to DEX success!");
  } catch (err: any) {
    console.warn("Skipping USDC rewards funding (deployer lacks balance of existing USDC token):", err.message || err);
  }

  try {
    const usdtFundAmt = ethers.parseUnits("50000000", 6); // existing USDT has 6 decimals
    await (await usdtInstance.transfer(DEX, usdtFundAmt, { gasLimit: 200000 })).wait();
    console.log("Funded 50M USDT rewards to DEX success!");
  } catch (err: any) {
    console.warn("Skipping USDT rewards funding (deployer lacks balance of existing USDT token):", err.message || err);
  }

  // Fund faucet pool (newly created QOIN - funded 100%)
  try {
    await (await qoinInstance.transfer(DEX, faucetFundAmt, { gasLimit: 200000 })).wait();
    console.log("Funded 100M QOIN faucet allocations to DEX success!");
  } catch (err: any) {
    console.warn("Failed to fund QOIN faucet allocations:", err.message || err);
  }

  // 5. Build standard LP Pools
  console.log("Injecting primary pools liquidities...");
  const dexWithLiq = new ethers.Contract(DEX, [
    "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
  ], wallet);

  // A. Add 1:1 Stable USDC-USDT LP
  try {
    const usdcLiqAmt = ethers.parseUnits("5000000", 6); // existing USDC has 6 decimals
    const usdtLiqAmt = ethers.parseUnits("5000000", 6); // existing USDT has 6 decimals
    await (await usdcInstance.approve(DEX, usdcLiqAmt, { gasLimit: 158000 })).wait();
    await (await usdtInstance.approve(DEX, usdtLiqAmt, { gasLimit: 158000 })).wait();
    
    console.log("Creating USDC-USDT LP Stable Pool...");
    const txUsdcUsdt = await dexWithLiq.addLiquidity(USDC, USDT, usdcLiqAmt, usdtLiqAmt, { gasLimit: 1000000 });
    await txUsdcUsdt.wait();
    console.log("USDC-USDT LP Pool added!");
  } catch (err: any) {
    console.warn("Could not create USDC-USDT LP Stable Pool (existing tokens):", err.message || err);
  }

  // B. Add QOIN-USDC LP Pool
  try {
    const qoinLiqAmt = ethers.parseUnits("500000", 18);
    const usdcLiqAmtForQ = ethers.parseUnits("100000", 6); // existing USDC has 6 decimals
    await (await qoinInstance.approve(DEX, qoinLiqAmt, { gasLimit: 158000 })).wait();
    await (await usdcInstance.approve(DEX, usdcLiqAmtForQ, { gasLimit: 158000 })).wait();

    console.log("Creating QOIN-USDC LP Pool...");
    const txQoinUsdc = await dexWithLiq.addLiquidity(QOIN, USDC, qoinLiqAmt, usdcLiqAmtForQ, { gasLimit: 1000000 });
    await txQoinUsdc.wait();
    console.log("QOIN-USDC LP Pool added!");
  } catch (err: any) {
    console.warn("Could not create QOIN-USDC LP Pool (existing tokens):", err.message || err);
  }

  // C. Add QOIN-USDT LP Pool
  try {
    const qoinLiqAmt = ethers.parseUnits("500000", 18);
    const usdtLiqAmtForQ = ethers.parseUnits("100000", 6); // existing USDT has 6 decimals
    await (await qoinInstance.approve(DEX, qoinLiqAmt, { gasLimit: 158000 })).wait();
    await (await usdtInstance.approve(DEX, usdtLiqAmtForQ, { gasLimit: 158000 })).wait();

    console.log("Creating QOIN-USDT LP Pool...");
    const txQoinUsdt = await dexWithLiq.addLiquidity(QOIN, USDT, qoinLiqAmt, usdtLiqAmtForQ, { gasLimit: 1000000 });
    await txQoinUsdt.wait();
    console.log("QOIN-USDT LP Pool added!");
  } catch (err: any) {
    console.warn("Could not create QOIN-USDT LP Pool (existing tokens):", err.message || err);
  }

  // D. Add NBLAD-USDC LP Pool
  try {
    const nbladLiqAmt = ethers.parseUnits("400000", 18);
    const usdcLiqAmtForN = ethers.parseUnits("80000", 6); // existing USDC has 6 decimals
    await (await nbladInstance.approve(DEX, nbladLiqAmt, { gasLimit: 158000 })).wait();
    await (await usdcInstance.approve(DEX, usdcLiqAmtForN, { gasLimit: 158000 })).wait();

    console.log("Creating NBLAD-USDC LP Pool...");
    const txNbladUsdc = await dexWithLiq.addLiquidity(NBLAD, USDC, nbladLiqAmt, usdcLiqAmtForN, { gasLimit: 1000000 });
    await txNbladUsdc.wait();
    console.log("NBLAD-USDC LP Pool added!");
  } catch (err: any) {
    console.warn("Could not create NBLAD-USDC LP Pool (existing tokens):", err.message || err);
  }

  // E. Add DE4I-USDT LP Pool
  try {
    const de4iLiqAmt = ethers.parseUnits("400000", 18);
    const usdtLiqAmtForD = ethers.parseUnits("60000", 6); // existing USDT has 6 decimals
    await (await de4iInstance.approve(DEX, de4iLiqAmt, { gasLimit: 158000 })).wait();
    await (await usdtInstance.approve(DEX, usdtLiqAmtForD, { gasLimit: 158000 })).wait();

    console.log("Creating DE4I-USDT LP Pool...");
    const txDe4iUsdt = await dexWithLiq.addLiquidity(DE4I, USDT, de4iLiqAmt, usdtLiqAmtForD, { gasLimit: 1000000 });
    await txDe4iUsdt.wait();
    console.log("DE4I-USDT LP Pool added!");
  } catch (err: any) {
    console.warn("Could not create DE4I-USDT LP Pool (existing tokens):", err.message || err);
  }

  console.log("=== COMPLETED DEX DEPLOYMENT SUCCESS ===");
}

main().catch((err) => {
  console.error("Upgrade process encountered a critical failure:", err);
  process.exit(1);
});
