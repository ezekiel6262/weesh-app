import { maxUint256, type Address, type PublicClient } from "viem";
import { erc20Abi } from "./abi";
import { EXPLORER } from "./chain";
import type { Asset } from "./catalog";

export function bumpBook() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("weesh-book"));
}

export function txUrl(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}

export function addrUrl(address: string) {
  return `${EXPLORER}/address/${address}`;
}

export async function approveIfNeeded(
  client: PublicClient,
  write: (args: {
    address: Address;
    abi: typeof erc20Abi;
    functionName: "approve";
    args: [Address, bigint];
  }) => Promise<`0x${string}`>,
  owner: Address,
  token: Asset,
  spender: Address,
  amount: bigint
) {
  const allowance = (await client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
  if (allowance >= amount) return null;
  const hash = await write({
    address: token.address,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}
