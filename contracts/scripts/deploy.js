const hre = require("hardhat");

async function main() {
  const [wallet] = await hre.viem.getWalletClients();
  const pub = await hre.viem.getPublicClient();
  const bal = await pub.getBalance({ address: wallet.account.address });
  console.log("deployer", wallet.account.address);
  console.log("okb", bal.toString());
  const price = await pub.getGasPrice();
  console.log("gasPrice", price.toString());
  if (bal < price * 2_000_000n) throw new Error("Deployer needs a little more OKB");
  const drop = await hre.viem.deployContract("WeeshDrop");
  console.log("WeeshDrop", drop.address);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});