import type { Address } from "viem";
import { ASSETS, byAddress, type Asset } from "./catalog";

export const PORTFOLIO_REGISTRY = (process.env.NEXT_PUBLIC_WEESH_PORTFOLIO_REGISTRY ||
  "0x0f66d0e9d1ca11955cc97a935a1e1ced95523e7d") as Address;

export type PortfolioVisibility = "public" | "unlisted" | "private";

export type Portfolio = {
  id: string;
  creator: Address;
  createdAt: number;
  visibility: PortfolioVisibility;
  showHoldings: boolean;
  name: string;
  thesis: string;
  assets: Address[];
  weights: number[];
  followers?: number;
};

export type PortfolioComment = { author: Address; createdAt: number; body: string };

export const portfolioRegistryAbi = [
  { type: "function", name: "nextPortfolioId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "followerCount", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "following", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }, { name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "commentCount", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "portfolio", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple", components: [
        { name: "creator", type: "address" }, { name: "createdAt", type: "uint64" },
        { name: "visibility", type: "uint8" }, { name: "showHoldings", type: "bool" },
        { name: "name", type: "string" }, { name: "thesis", type: "string" },
        { name: "assets", type: "address[]" }, { name: "weights", type: "uint16[]" },
      ],
    }],
  },
  {
    type: "function", name: "commentAt", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ type: "tuple", components: [{ name: "author", type: "address" }, { name: "createdAt", type: "uint64" }, { name: "body", type: "string" }] }],
  },
  {
    type: "function", name: "create", stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" }, { name: "thesis", type: "string" },
      { name: "assets", type: "address[]" }, { name: "weights", type: "uint16[]" },
      { name: "visibility", type: "uint8" }, { name: "showHoldings", type: "bool" },
    ], outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "follow", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "unfollow", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "comment", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "body", type: "string" }], outputs: [] },
] as const;

const PRIVATE_KEY = "weesh-private-portfolios-v1";

export function assetFor(address: Address): Asset | undefined {
  return byAddress.get(address.toLowerCase()) ?? ASSETS.find((a) => a.address.toLowerCase() === address.toLowerCase());
}

export function readPrivatePortfolios(): Portfolio[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PRIVATE_KEY) || "[]") as Portfolio[]; } catch { return []; }
}

export function savePrivatePortfolio(portfolio: Portfolio) {
  const rows = readPrivatePortfolios();
  localStorage.setItem(PRIVATE_KEY, JSON.stringify([portfolio, ...rows].slice(0, 30)));
}

export function shortCreator(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
