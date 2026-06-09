import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.teqoin.io");
  const txHash = "0xf71dd07aab872fc3ac5a6aa96600a64b947adc6e75e0464776e4f225df62eac1";
  
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log("Transaction not found on https://rpc.teqoin.io");
      return;
    }
    console.log("TX details:");
    console.log("To:", tx.to);
    console.log("From:", tx.from);
    console.log("Value:", tx.value ? ethers.formatEther(tx.value) : "0");
    
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log("Receipt status:", receipt?.status);
    console.log("Receipt logs count:", receipt?.logs.length);
    if (receipt?.logs) {
      receipt.logs.forEach((log, index) => {
        console.log(`Log ${index}: address=${log.address}, topics=${JSON.stringify(log.topics)}, data=${log.data}`);
      });
    }
  } catch (err) {
    console.error("Failed to query TX:", err);
  }
}

main().catch(console.error);
