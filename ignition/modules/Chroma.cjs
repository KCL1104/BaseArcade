const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChromaModule", (m) => {
  // Project wallet address from environment
  const projectWallet = process.env.VITE_WALLET_ADDRESS || "0xb21aa01dbe539fe8ec1dac58ad0b9fb4f81b1c7a";
  
  // Deploy Chroma contract
  const chroma = m.contract("Chroma", [projectWallet]);
  
  return { chroma };
});