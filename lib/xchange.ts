const BASE = "https://api.xstocks.fi/api/v2";

export function xchangeConfigured(): boolean {
  return Boolean(process.env.XSTOCKS_API_KEY);
}

async function xget(path: string, init?: RequestInit) {
  const key = process.env.XSTOCKS_API_KEY;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(key ? { "X-API-KEY": key } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export async function issuerPrint(xSymbol: string): Promise<number | null> {
  const { ok, body } = await xget(`/public/assets/${encodeURIComponent(xSymbol)}/price-data`);
  const q = (body as { quote?: number } | null)?.quote;
  return ok && typeof q === "number" && q > 0 ? q : null;
}

export async function xchangeAsset(identifier: string) {
  return xget(`/trades/xchange/assets/${encodeURIComponent(identifier)}`);
}

export async function xchangeRfq(params: {
  identifier: string;
  side: "Buy" | "Sell";
  quantity: string;
  network: string;
  paymentWallet: string;
  receivingWallet: string;
}) {
  return xget("/trades/xchange/rfq", {
    method: "POST",
    body: JSON.stringify({
      identifier: params.identifier,
      side: params.side,
      quantity: params.quantity,
      network: params.network,
      paymentWalletIdentifier: params.paymentWallet,
      receivingWalletIdentifier: params.receivingWallet,
    }),
  });
}

export const ATOMIC_SWAP_ABI = [
  {
    type: "function",
    name: "executeSwap",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "swap",
        type: "tuple",
        components: [
          { name: "quoteId", type: "bytes32" },
          { name: "expiration", type: "uint256" },
          {
            name: "incomingTransfer",
            type: "tuple",
            components: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          {
            name: "outgoingTransfer",
            type: "tuple",
            components: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
        ],
      },
      { name: "signature", type: "bytes" },
      {
        name: "permit",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
] as const;
