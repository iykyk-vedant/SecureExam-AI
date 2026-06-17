const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Hardhat ABI path after compilation
const ABI_PATH = path.join(__dirname, "../artifacts/contracts/SecureExamCredential.sol/SecureExamCredential.json");

let provider;
let wallet;
let contract;

/**
 * Initializes the blockchain service.
 */
function init() {
  if (!process.env.POLYGON_AMOY_RPC_URL || !process.env.PRIVATE_KEY || !process.env.SMART_CONTRACT_ADDRESS) {
    console.warn("Blockchain Service: Missing environment variables (POLYGON_AMOY_RPC_URL, PRIVATE_KEY, or SMART_CONTRACT_ADDRESS). Running in offline mode.");
    return false;
  }

  try {
    if (!fs.existsSync(ABI_PATH)) {
      console.warn("Blockchain Service: Smart Contract ABI not found. Please compile the contract first using hardhat.");
      return false;
    }

    const contractJson = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
    const abi = contractJson.abi;

    provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contract = new ethers.Contract(process.env.SMART_CONTRACT_ADDRESS, abi, wallet);

    console.log("Blockchain Service initialized successfully.");
    return true;
  } catch (error) {
    console.error("Blockchain Service failed to initialize:", error);
    return false;
  }
}

/**
 * Mints a credential to the blockchain.
 * @param {string} studentUid
 * @param {string} examId 
 * @param {string} certificateHash 
 */
async function mintCredential(studentUid, examId, certificateHash) {
  if (!contract) {
    throw new Error("Blockchain Service is not initialized. Cannot mint credential.");
  }

  try {
    const tx = await contract.mintCredential(studentUid, examId, certificateHash);
    console.log(`Minting credential for student ${studentUid}... Transaction Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Credential minted successfully in block ${receipt.blockNumber}`);
    return tx.hash;
  } catch (error) {
    console.error("Failed to mint credential:", error);
    throw error;
  }
}

/**
 * Verifies if a given credential hash exists on the blockchain.
 */
async function verifyCredential(certificateHash) {
  if (!contract) {
    throw new Error("Blockchain Service is not initialized. Cannot verify credential.");
  }

  try {
    const [isValid, examId] = await contract.verifyCredential(certificateHash);
    return { isValid, examId };
  } catch (error) {
    console.error("Failed to verify credential:", error);
    throw error;
  }
}

module.exports = {
  init,
  mintCredential,
  verifyCredential
};
