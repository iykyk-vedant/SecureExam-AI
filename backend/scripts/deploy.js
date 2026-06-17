const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Compile if needed (Hardhat does this automatically usually, but good to ensure)
  const SecureExamCredential = await hre.ethers.getContractFactory("SecureExamCredential");
  
  console.log("Deploying SecureExamCredential...");
  const credentialContract = await SecureExamCredential.deploy();

  await credentialContract.waitForDeployment();

  const address = await credentialContract.getAddress();
  console.log(`SecureExamCredential deployed to: ${address}`);
  console.log("Save this address to your backend .env file as SMART_CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
