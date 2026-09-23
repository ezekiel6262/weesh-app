export type AgentField = {
  key: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
};

export type ListedAgent = {
  id: string;
  agentId: string;
  name: string;
  serviceName: string;
  /** What this listing actually does. */
  does: string;
  /** What it will not do, so a report is never mistaken for a deposit. */
  doesNot: string;
  picture: string;
  rating: string;
  listedFee: string;
  endpoint: string;
  method: "GET" | "POST";
  fields: AgentField[];
};

export type StrategyJob = {
  id: string;
  title: string;
  blurb: string;
  yourself: { href: string; label: string; detail: string };
  agentIds: string[];
};

const STERLING_PICTURE =
  "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/f9a3dd38-4449-442e-935d-2c252d08ca10.png";

export const LISTED_AGENTS: ListedAgent[] = [
  {
    id: "sterling-yield",
    agentId: "11675",
    name: "Sterling",
    serviceName: "Stablecoin Yield Ranker",
    does: "Ranks on-chain stablecoin yield on X Layer, including Aave, for a dollar amount you choose.",
    doesNot: "Does not deposit. You still park or lend yourself if you want the position.",
    picture: STERLING_PICTURE,
    rating: "100",
    listedFee: "Listed free",
    endpoint: "https://sterling-asp.onrender.com/v1/stable-yield",
    method: "POST",
    fields: [
      { key: "stablecoin", label: "Dollar", placeholder: "USDG", defaultValue: "USDG" },
      { key: "amount", label: "Amount (USD)", placeholder: "100", defaultValue: "100" },
    ],
  },
  {
    id: "sterling-dividend",
    agentId: "11675",
    name: "Sterling",
    serviceName: "Dividend and ex-date",
    does: "Looks up dividend-equivalent yield and ex-date windows for a tokenized stock.",
    doesNot: "Does not buy the stock. The service itself says a demo may return sample data.",
    picture: STERLING_PICTURE,
    rating: "100",
    listedFee: "Listed free",
    endpoint: "https://sterling-asp.onrender.com/v1/dividend",
    method: "POST",
    fields: [{ key: "asset", label: "xStock", placeholder: "NVDAx", defaultValue: "NVDAx" }],
  },
  {
    id: "barker-pools",
    agentId: "2012",
    name: "Barker Yield Agent",
    serviceName: "Executable pools",
    does: "Lists stablecoin vaults Barker can quote for a deposit. You pay their listed call price.",
    doesNot: "This is not the Spark park button. Read the answer before you move money.",
    picture:
      "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/06ab4c68-55be-40bb-85c9-7d9b29f0a8c9.png",
    rating: "100",
    listedFee: "About 0.01 USDT per call",
    endpoint: "https://mcp.barker.money/barker_executable_pools",
    method: "GET",
    fields: [],
  },
  {
    id: "chaconne-verify",
    agentId: "13803",
    name: "Chaconne Verify",
    serviceName: "StockProof trade check",
    does: "Checks a tokenized-stock buy on X Layer: identity, reference price, and price impact.",
    doesNot: "Does not buy the stock, and it is not investment advice.",
    picture:
      "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/27e97c61-f05a-4bae-9d9a-8f7f38ee2aee.png",
    rating: "No rating yet",
    listedFee: "Listed free",
    endpoint: "https://verify.chaconne.xyz/a2mcp/verify",
    method: "POST",
    fields: [
      { key: "symbol", label: "Stock", placeholder: "NVDA", defaultValue: "NVDA" },
      { key: "amountUsd", label: "Spend (USD)", placeholder: "100", defaultValue: "100" },
    ],
  },
  {
    id: "usdg-loop",
    agentId: "13780",
    name: "USDG Loop",
    serviceName: "Loop snapshot",
    does: "Shows a leveraged PT-USDG loop that uses Aave and Pendle on X Layer.",
    doesNot: "Weesh will not open this loop. Leverage can lose more than a simple lend.",
    picture:
      "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/0c52e814-620e-41bc-8186-48257a0c701b.png",
    rating: "No rating yet",
    listedFee: "Listed free",
    endpoint: "https://www.onchainearn.online/v1/loop/snapshot",
    method: "GET",
    fields: [
      { key: "principal", label: "Principal (USDG)", placeholder: "1000", defaultValue: "1000" },
      { key: "leverage", label: "Leverage", placeholder: "2", defaultValue: "2" },
    ],
  },
];

export const STRATEGY_JOBS: StrategyJob[] = [
  {
    id: "park",
    title: "Park idle dollars",
    blurb: "USDT into Spark Savings. You sign. Spark holds the vault shares.",
    yourself: {
      href: "/earn#spark",
      label: "Park on Earn",
      detail: "One approval, one deposit. Weesh never holds the USDT.",
    },
    agentIds: ["sterling-yield", "barker-pools"],
  },
  {
    id: "lend",
    title: "Lend dollars",
    blurb: "Supply USDG or USDT on Aave. You can borrow only what Aave lists.",
    yourself: {
      href: "/earn#aave",
      label: "Lend on Earn",
      detail: "Stocks are not Aave collateral on X Layer. The button will not pretend they are.",
    },
    agentIds: ["sterling-yield"],
  },
  {
    id: "mix",
    title: "Buy a stock mix",
    blurb: "Split a dollar amount across xStocks. Each buy is its own signature.",
    yourself: {
      href: "/trade",
      label: "Open Trade",
      detail: "The mix below turns weights into a spend per name, then Trade quotes it.",
    },
    agentIds: ["chaconne-verify", "sterling-dividend"],
  },
  {
    id: "lp",
    title: "Provide liquidity",
    blurb: "Full-range stock / dollar liquidity on Uniswap. You keep the position.",
    yourself: {
      href: "/earn#lp",
      label: "Add liquidity",
      detail: "No listed OKX AI agent manages an X Layer xStock pool. Weesh does this one.",
    },
    agentIds: [],
  },
  {
    id: "loop",
    title: "Leveraged USDG loop",
    blurb: "A leveraged stablecoin loop. Higher carry, higher chance of a bad unwind.",
    yourself: {
      href: "/earn#aave",
      label: "Plain lend instead",
      detail: "Weesh will not build the leverage for you. Use Aave supply if you want the simple version.",
    },
    agentIds: ["usdg-loop"],
  },
];

export function agentById(id: string): ListedAgent | undefined {
  return LISTED_AGENTS.find((a) => a.id === id);
}

export const AGENTS_CHECKED_AT = "2026-09-23";
