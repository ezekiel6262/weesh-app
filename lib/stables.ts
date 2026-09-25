import type { Address, PublicClient } from "viem";
import { USDC, USDG, USDT0, type Asset } from "./catalog";
import { splitWeeshFee } from "./fee";
import { executeRoutedSwap } from "./fill";
import { routeQuote } from "./quote";

const STABLES = [USDG, USDT0, USDC];

/** Prepare the stablecoin an action needs, without making the user manage token symbols. */
export async function prepareStable(args: {
  client: PublicClient;
  address: Address;
  write: (a: object) => Promise<`0x${string}`>;
  send: (a: { to: `0x${string}`; data: `0x${string}`; value: bigint }) => Promise<`0x${string}`>;
  target: Asset;
  amount: bigint;
  balances: Record<string, bigint>;
  onStep?: (message: string) => void;
}): Promise<boolean> {
  const current = args.balances[args.target.id] ?? BigInt(0);
  if (current >= args.amount) return false;
  const shortfall = args.amount - current;
  const source = STABLES
    .filter((asset) => asset.id !== args.target.id)
    .sort((a, b) => Number((args.balances[b.id] ?? BigInt(0)) - (args.balances[a.id] ?? BigInt(0))))[0];
  const balance = source ? args.balances[source.id] ?? BigInt(0) : BigInt(0);
  if (!source || balance === BigInt(0)) throw new Error(`Not enough digital dollars for this action.`);

  let input = (shortfall * BigInt(10_100) + BigInt(9_999)) / BigInt(10_000);
  if (input > balance) input = balance;
  args.onStep?.(`Preparing ${args.target.symbol} from ${source.symbol}…`);
  let quote = await routeQuote(args.client, source, args.target, splitWeeshFee(input).swapIn);
  if (!quote) throw new Error(`No ${source.symbol} to ${args.target.symbol} route is available right now.`);
  if (quote.amountOut < shortfall && input < balance) {
    input = (input * shortfall * BigInt(10_020)) / (quote.amountOut * BigInt(10_000)) + BigInt(1);
    if (input > balance) input = balance;
    quote = await routeQuote(args.client, source, args.target, splitWeeshFee(input).swapIn);
  }
  if (!quote || quote.amountOut < shortfall) throw new Error(`Your digital-dollar balance cannot cover this action after conversion.`);
  await executeRoutedSwap({
    client: args.client,
    address: args.address,
    write: args.write,
    send: args.send,
    pay: source,
    get: args.target,
    amountIn: input,
    quote,
    onStep: (step) => args.onStep?.(step === "sign" ? "Confirm the dollar conversion…" : "Preparing dollars…"),
  });
  return true;
}
