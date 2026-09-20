import { defineChain } from "viem";

export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer" } },
});

export const RPC = "https://rpc.xlayer.tech";
export const EXPLORER = "https://www.oklink.com/x-layer";
export const OKX_BACKUP = "https://web3.okx.com/";
