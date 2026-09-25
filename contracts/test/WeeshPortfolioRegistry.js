const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");

describe("WeeshPortfolioRegistry", function () {
  async function fixture() {
    const [owner, follower] = await hre.viem.getWalletClients();
    const registry = await hre.viem.deployContract("WeeshPortfolioRegistry");
    return { owner, follower, registry };
  }

  it("creates, follows and comments without custody", async function () {
    const { follower, registry } = await loadFixture(fixture);
    const assets = ["0xa8ddb5cd96b5222afe198316e9a57caa642850d5", "0xe7e553cd128f0011777323a0b44a7b96ea1cb540"];
    await registry.write.create(["AI plus index", "A barbell strategy", assets, [6000, 4000], 0, true]);
    const p = await registry.read.portfolio([1n]);
    expect(p.name).to.equal("AI plus index");
    expect(p.weights).to.deep.equal([6000, 4000]);

    const asFollower = await hre.viem.getContractAt("WeeshPortfolioRegistry", registry.address, { client: { wallet: follower } });
    await asFollower.write.follow([1n]);
    await asFollower.write.comment([1n, "Clear thesis. I replicated this with a smaller amount."]);
    expect(await registry.read.followerCount([1n])).to.equal(1n);
    expect(await registry.read.commentCount([1n])).to.equal(1n);
  });

  it("rejects weights that do not total 100%", async function () {
    const { registry } = await loadFixture(fixture);
    await expect(registry.write.create(["Bad", "", ["0xa8ddb5cd96b5222afe198316e9a57caa642850d5"], [9999], 0, false])).to.be.rejected;
  });
});
