const hre = require("hardhat");

async function main() {
  const [wallet] = await hre.viem.getWalletClients();
  const registry = await hre.viem.deployContract("WeeshPortfolioRegistry");
  console.log("deployer", wallet.account.address);
  console.log("WeeshPortfolioRegistry", registry.address);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
