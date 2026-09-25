type ErrorContext = {
  action?: string;
  asset?: string;
  available?: string;
};

function errorText(error: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" ").toLowerCase();
}

/** Convert wallet, RPC, and protocol internals into an actionable user message. */
export function friendlyError(error: unknown, context: ErrorContext = {}): string {
  const original = error instanceof Error ? error.message : String(error || "");
  const text = errorText(error);
  const asset = context.asset || "funds";
  const available = context.available ? ` You currently have ${context.available} ${asset}.` : "";

  if (/user rejected|user denied|request rejected|rejected the request|code 4001|cancelled/.test(text)) {
    return "You cancelled the request in your wallet. Nothing was changed.";
  }
  if (/transfer amount exceeds balance|exceeds balance|insufficient balance|amount.*balance/.test(text)) {
    return `Not enough ${asset} for this ${context.action || "transaction"}.${available}`;
  }
  if (/insufficient funds.*gas|intrinsic transaction cost|gas required exceeds/.test(text)) {
    return "There is not enough OKB for network gas. Weesh will try to refill the wallet; wait a moment and try again.";
  }
  if (/allowance|transfer amount exceeds allowance/.test(text)) {
    return `The ${asset} approval was not completed. Approve the requested amount in your wallet, then try again.`;
  }
  if (/slippage|too little received|amountoutminimum|price moved/.test(text)) {
    return "The market price moved beyond your slippage limit. Refresh the quote and try again.";
  }
  if (/no uniswap|no quote|did not return a quote|insufficient liquidity/.test(text)) {
    return "No executable route is available for this amount right now. Try a smaller amount or another asset.";
  }
  if (/network|failed to fetch|timeout|timed out|rpc|http request/.test(text)) {
    return "X Layer could not be reached. Check your connection and try again in a moment.";
  }
  if (/execution reverted|contract function.*reverted|revert/.test(text)) {
    return `The protocol rejected this ${context.action || "transaction"}. Check the amount and available balance, then try again.`;
  }
  if (/nonce|replacement transaction|already known/.test(text)) {
    return "Your wallet has another transaction pending. Wait for it to finish, then try again.";
  }
  const looksInternal = /contract call|docs:|details:|version:|request arguments|0x[a-f0-9]{8,}|viem|rpc/.test(text);
  if (original && original.length <= 220 && !looksInternal) return original;
  return `This ${context.action || "transaction"} could not be completed. Nothing was moved. Please try again.`;
}
