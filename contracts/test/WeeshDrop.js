const { expect } = require("chai");
const hre = require("hardhat");
const { network } = hre;
const { getAddress, keccak256, toBytes } = require("viem");

describe("WeeshDrop", function () {
  async function setup() {
    const token = await hre.viem.deployContract("MockToken");
    const drop = await hre.viem.deployContract("WeeshDrop");
    const [sender, a, b, c] = await hre.viem.getWalletClients();
    const pub = await hre.viem.getPublicClient();
    const unit = 10n ** 18n;
    await token.write.mint([sender.account.address, 1000n * unit]);
    await token.write.approve([drop.address, 1000n * unit], { account: sender.account });
    return { token, drop, sender, a, b, c, pub, unit };
  }

  it("pays addresses now and holds a claim until the secret is shown", async function () {
    const { token, drop, sender, a, b, unit } = await setup();
    const secret = keccak256(toBytes("slot-secret"));
    const hash = keccak256(secret);
    await drop.write.create(
      [
        token.address,
        "Ada class",
        0n,
        [a.account.address, getAddress("0x0000000000000000000000000000000000000000"), b.account.address],
        [unit, 2n * unit, unit],
        ["0x0000000000000000000000000000000000000000000000000000000000000000", hash, "0x0000000000000000000000000000000000000000000000000000000000000000"],
      ],
      { account: sender.account }
    );
    expect(await token.read.balanceOf([a.account.address])).to.equal(unit);
    expect(await token.read.balanceOf([b.account.address])).to.equal(unit);
    expect(await token.read.balanceOf([drop.address])).to.equal(2n * unit);

    const claimer = (await hre.viem.getWalletClients())[3];
    await drop.write.claim([1n, 1n, secret], { account: claimer.account });
    expect(await token.read.balanceOf([claimer.account.address])).to.equal(2n * unit);
    await expect(drop.write.claim([1n, 1n, secret], { account: claimer.account })).to.be.rejected;
  });

  it("returns unclaimed stock to the sender after the window", async function () {
    const { token, drop, sender, unit } = await setup();
    const secret = keccak256(toBytes("later"));
    const later = BigInt(Math.floor(Date.now() / 1000) + 3 * 24 * 3600);
    await drop.write.create(
      [
        token.address,
        "Hold",
        later,
        ["0x0000000000000000000000000000000000000000"],
        [5n * unit],
        [keccak256(secret)],
      ],
      { account: sender.account }
    );
    await expect(drop.write.reclaim([1n], { account: sender.account })).to.be.rejected;
    await network.provider.send("evm_increaseTime", [4 * 24 * 3600]);
    await network.provider.send("evm_mine");
    await drop.write.reclaim([1n], { account: sender.account });
    expect(await token.read.balanceOf([drop.address])).to.equal(0n);
  });

  it("repeats a send from the sender allowance when poked", async function () {
    const { token, drop, sender, a, b, unit } = await setup();
    const until = BigInt(Math.floor(Date.now() / 1000) + 40 * 24 * 3600);
    await drop.write.startPlan([token.address, 7n * 24n * 3600n, until, unit, [a.account.address, b.account.address]], {
      account: sender.account,
    });
    expect(await token.read.balanceOf([a.account.address])).to.equal(unit);
    expect(await token.read.balanceOf([b.account.address])).to.equal(unit);
    await expect(drop.write.poke([1n])).to.be.rejected;
    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");
    await drop.write.poke([1n]);
    expect(await token.read.balanceOf([a.account.address])).to.equal(2n * unit);
    await drop.write.cancelPlan([1n], { account: sender.account });
    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");
    await expect(drop.write.poke([1n])).to.be.rejected;
  });
});
