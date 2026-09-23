import { isAddress, keccak256, type Address, type Hex } from "viem";
import { STOCKS, type Asset } from "./catalog";

/** WeeshDrop on X Layer. Deployed from the gas tank. */
const DEPLOYED_DROP = "0x76960502d4d84381fab3ec48be229342631fc33f" as Address;
export const WEESH_DROP = (process.env.NEXT_PUBLIC_WEESH_DROP || DEPLOYED_DROP) as Address;
export const DROP_READY = isAddress(WEESH_DROP);

export const dropAbi = [
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "reclaimAfter", type: "uint64" },
      { name: "tos", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "secretHashes", type: "bytes32[]" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "secret", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "startPlan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "interval", type: "uint64" },
      { name: "until", type: "uint64" },
      { name: "amountEach", type: "uint256" },
      { name: "recipients", type: "address[]" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "poke",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelPlan",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dropInfo",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "token", type: "address" },
      { name: "reclaimAfter", type: "uint64" },
      { name: "name", type: "string" },
      { name: "slots", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "slot",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paid", type: "bool" },
      { name: "claimable", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "planInfo",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "token", type: "address" },
      { name: "interval", type: "uint64" },
      { name: "nextAt", type: "uint64" },
      { name: "until", type: "uint64" },
      { name: "amountEach", type: "uint256" },
      { name: "recipients", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "DropCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "slots", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlanStarted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "nextAt", type: "uint64", indexed: false },
      { name: "until", type: "uint64", indexed: false },
    ],
  },
] as const;

export type Recipient = { label: string; to: Address | null };

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export function parseRecipients(text: string): Recipient[] {
  const rows: Recipient[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (isAddress(line)) rows.push({ label: `${line.slice(0, 6)}…${line.slice(-4)}`, to: line });
    else rows.push({ label: line.slice(0, 64), to: null });
  }
  return rows;
}

export function stockById(id: string): Asset | undefined {
  return STOCKS.find((s) => s.id === id);
}

export function newSecret(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function secretHash(secret: Hex): Hex {
  return keccak256(secret);
}

export function claimUrl(origin: string, dropId: string, index: number, secret: Hex) {
  const url = new URL("/send/claim", origin);
  url.searchParams.set("drop", dropId);
  url.searchParams.set("i", String(index));
  url.searchParams.set("k", secret);
  return url.toString();
}

export function zeroAddress(): Address {
  return ZERO;
}

export const SEND_STOCKS = STOCKS;
