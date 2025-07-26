const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("TheFountainModule", (m) => {
  // Project wallet address (same as Chroma contract)
  const projectWallet = "0xb21aa01dbe539fe8ec1dac58ad0b9fb4f81b1c7a";
  
  const theFountain = m.contract("TheFountain", [projectWallet]);

  return { theFountain };
});