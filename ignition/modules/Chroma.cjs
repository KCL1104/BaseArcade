const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChromaModule", (m) => {
  // Project wallet address from environment
  // Use the deployer address from Hardhat's accounts configuration
// This will be automatically set by Hardhat during deployment
const projectWallet = "0xb21aa01dbe539fe8ec1dac58ad0b9fb4f81b1c7a"; // Fallback address
  
  // Deploy Chroma contract
  const chroma = m.contract("Chroma", [projectWallet]);
  
  return { chroma };
});