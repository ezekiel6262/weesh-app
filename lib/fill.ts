import type { Address, PublicClient } from "viem";
import { erc20Abi, swapRouterAbi } from "./abi";
import type { Asset } from "./catalog";
import { UNISWAP, WEESH_TREASURY } from "./catalog";
import { splitWeeshFee } from "./fee";
import { coverGas } from "./gas";
import { routeQuote, type Quote } from "./quote";
import { approveIfNeeded } from "./tx";

export function impliedPx(q: Quote): number {
  const buy = q.tokenIn.kind === "stable";
  const usd = Number(buy ? q.amountIn : q.amountOut) / 1e6;
  const sh = Number(buy ? q.amountOut : q.amountIn) / 10 ** (buy ? q.tokenOut.decimals : q.tokenIn.decimals);
  if (!sh) return 0;
  return usd / sh;
}

export async function executeRoutedSwap(args: {
  client: PublicClient;
  address: Address;
  write: (a: object) => Promise<`0x${string}`>;
  send: (a: { to: `0x${string}`; data: `0x${string}`; value: bigint }) => Promise<`0x${string}`>;
  pay: Asset;
  get: Asset;
  amountIn: bigint;
  slipPct?: number;
  preferOkx?: boolean;
  mode?: string;
  quote?: Quote;
  onStep?: (step: "gas" | "fee" | "approve" | "sign") => void;
}): Promise<{ hash: `0x${string}`; quote: Quote; px: number }> {
  const slip = args.slipPct ?? 0.5;
  args.onStep?.("gas");
  await coverGas(args.client, args.address);
  const { fee, swapIn } = splitWeeshFee(args.amountIn);
  if (fee > BigInt(0) && WEESH_TREASURY) {
    args.onStep?.("fee");
    const feeHash = await args.write({
      address: args.pay.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [WEESH_TREASURY, fee],
    });
    await args.client.waitForTransactionReceipt({ hash: feeHash });
  }
  const q =
    args.quote && args.quote.amountIn === swapIn
      ? args.quote
      : await routeQuote(args.client, args.pay, args.get, swapIn, {
          preferOkx: args.preferOkx,
          slippagePct: String(slip),
          mode: args.mode,
        });
  if (!q) throw new Error("No Uniswap or OKX quote");
  const minOut = (q.amountOut * BigInt(10_000 - Math.round(slip * 100))) / BigInt(10_000);
  let hash: `0x${string}`;
  if (q.venue === "okx") {
    const built = await fetch("/api/okx/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: args.pay.address,
        to: args.get.address,
        amount: swapIn.toString(),
        user: args.address,
        slippage: String(slip),
      }),
    });
    const body = (await built.json()) as {
      error?: string;
      router?: string;
      tx?: { to: `0x${string}`; data: `0x${string}`; value?: string };
    };
    if (!built.ok || !body.tx?.to || !body.tx.data) throw new Error(body.error || "OKX DEX did not return a transaction");
    args.onStep?.("approve");
    await approveIfNeeded(args.client, args.write as never, args.address, args.pay, (body.router || body.tx.to) as Address, swapIn);
    args.onStep?.("sign");
    hash = await args.send({ to: body.tx.to, data: body.tx.data, value: BigInt(body.tx.value || "0") });
  } else {
    args.onStep?.("approve");
    await approveIfNeeded(args.client, args.write as never, args.address, args.pay, UNISWAP.router, swapIn);
    args.onStep?.("sign");
    hash = q.path
      ? await args.write({
          address: UNISWAP.router,
          abi: swapRouterAbi,
          functionName: "exactInput",
          args: [{ path: q.path, recipient: args.address, amountIn: swapIn, amountOutMinimum: minOut }],
        })
      : await args.write({
          address: UNISWAP.router,
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: args.pay.address,
              tokenOut: args.get.address,
              fee: q.fee,
              recipient: args.address,
              amountIn: swapIn,
              amountOutMinimum: minOut,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        });
  }
  await args.client.waitForTransactionReceipt({ hash });
  return { hash, quote: q, px: impliedPx(q) };
}
