import type { Address, PublicClient } from "viem";

export async function coverGas(client: PublicClient, address: Address) {
  try {
    const r = await fetch("/api/gas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const j = (await r.json()) as { hash?: `0x${string}` };
    if (j.hash) await client.waitForTransactionReceipt({ hash: j.hash });
  } catch {
    /* tank may be empty; fall through to the balance check */
  }
  const bal = await client.getBalance({ address });
  if (bal === BigInt(0)) {
    throw new Error("Weesh covers gas. Wait a few seconds and try again.");
  }
}
