import { defineChain, fallback, http } from "viem";

export const RPC_URLS = ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"] as const;

export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [...RPC_URLS] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer" } },
});

export const RPC = RPC_URLS[0];
export function xlayerTransport() {
  return fallback(
    RPC_URLS.map((url) => http(url, { batch: true, retryCount: 2, timeout: 10_000 })),
    { rank: true }
  );
}
export const EXPLORER = "https://www.oklink.com/x-layer";
export const OKX_BACKUP = "https://web3.okx.com/";
