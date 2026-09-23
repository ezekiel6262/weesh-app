const fs = require("fs");
const path = require("path");

function localEnv(name) {
  const file = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(file)) return "";
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(name + "="));
  return line ? line.slice(name.length + 1).trim() : "";
}

const gasKey = localEnv("WEESH_GAS_KEY");

require("@nomicfoundation/hardhat-toolbox-viem");

module.exports = {
  solidity: "0.8.24",
  paths: { sources: "./src", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
  networks: {
    xlayer: {
      url: "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: gasKey ? [gasKey] : [],
    },
  },
};
