import { createHmac } from "node:crypto";

const BASE = "https://web3.okx.com";
export const OKX_ROUTER = "0x31d7BCA06a0143ABc7c93418792Aae8AA69183b0" as const;
export const XLAYER = "196";

export function okxConfigured(): boolean {
  return Boolean(process.env.OKX_API_KEY && process.env.OKX_SECRET_KEY && process.env.OKX_PASSPHRASE);
}

function headers(method: string, path: string, query = "") {
  const key = process.env.OKX_API_KEY;
  const secret = process.env.OKX_SECRET_KEY;
  const pass = process.env.OKX_PASSPHRASE;
  const project = process.env.OKX_PROJECT_ID;
  if (!key || !secret || !pass) throw new Error("OKX DEX is not configured");
  const timestamp = new Date().toISOString();
  const sign = createHmac("sha256", secret)
    .update(timestamp + method + path + query)
    .digest("base64");
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": key,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": pass,
  };
  if (project) h["OK-ACCESS-PROJECT"] = project;
  return h;
}

async function okxGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = "?" + new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs}`, {
    headers: headers("GET", path, qs),
    cache: "no-store",
  });
  const body = (await res.json()) as { code?: string; msg?: string; data?: T };
  if (!res.ok || (body.code && body.code !== "0")) {
    throw new Error(body.msg || `OKX DEX ${res.status}`);
  }
  return body.data as T;
}

export type OkxQuoteRow = {
  chainId?: string;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  estimateGasFee?: string;
  tradeFee?: string;
  priceImpactPercentage?: string;
  dexRouterList?: {
    router?: string;
    routerPercent?: string;
    dexProtocol?: { dexName?: string; percent?: string } | { dexName?: string; percent?: string }[];
    subRouterList?: {
      dexProtocol?: { dexName?: string; percent?: string }[];
    }[];
  }[];
};

export type OkxSwapRow = OkxQuoteRow & {
  router?: string;
  routerResult?: OkxQuoteRow;
  tx?: {
    to?: string;
    data?: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
    minReceiveAmount?: string;
  };
};

export async function okxQuote(
  from: string,
  to: string,
  amount: string,
  slippagePercent = "0.5",
  mode = "dex"
): Promise<OkxQuoteRow> {
  const rows = await okxGet<OkxQuoteRow[]>("/api/v6/dex/aggregator/quote", {
    chainIndex: XLAYER,
    fromTokenAddress: from.toLowerCase(),
    toTokenAddress: to.toLowerCase(),
    amount,
    swapMode: "exactIn",
    slippagePercent,
    mode,
  });
  const row = Array.isArray(rows) ? rows[0] : (rows as unknown as OkxQuoteRow);
  if (!row?.toTokenAmount) throw new Error("OKX DEX returned no quote");
  return row;
}

export async function okxSwap(
  from: string,
  to: string,
  amount: string,
  user: string,
  slippagePercent = "0.5"
): Promise<OkxSwapRow> {
  const rows = await okxGet<OkxSwapRow[]>("/api/v6/dex/aggregator/swap", {
    chainIndex: XLAYER,
    fromTokenAddress: from.toLowerCase(),
    toTokenAddress: to.toLowerCase(),
    amount,
    swapMode: "exactIn",
    slippagePercent,
    userWalletAddress: user.toLowerCase(),
  });
  const row = Array.isArray(rows) ? rows[0] : (rows as unknown as OkxSwapRow);
  const quote = row.routerResult ?? row;
  if (!row?.tx?.data || !row.tx.to) throw new Error("OKX DEX returned no transaction");
  return { ...quote, tx: row.tx, router: row.tx.to };
}

export async function okxAllTokens(): Promise<{ tokenContractAddress?: string; tokenSymbol?: string }[]> {
  const rows = await okxGet<{ tokenContractAddress?: string; tokenSymbol?: string }[]>(
    "/api/v6/dex/aggregator/all-tokens",
    { chainIndex: XLAYER }
  );
  return Array.isArray(rows) ? rows : [];
}

export function dexNames(row: OkxQuoteRow): string {
  const names = new Set<string>();
  const add = (d?: { dexName?: string } | { dexName?: string }[]) => {
    if (!d) return;
    const list = Array.isArray(d) ? d : [d];
    for (const x of list) if (x.dexName) names.add(x.dexName);
  };
  for (const r of row.dexRouterList ?? []) {
    add(r.dexProtocol as { dexName?: string } | { dexName?: string }[] | undefined);
    for (const sub of r.subRouterList ?? []) add(sub.dexProtocol);
  }
  return [...names].join(" + ") || "OKX DEX";
}
