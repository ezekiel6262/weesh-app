export type Venue = "wallet" | "aave" | "spark" | "lp";
export type Kind = "stable" | "equity" | "etf" | "wrapped-crypto";

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  kind: Kind;
  /** Face 1 trade against this quote. */
  tradable: boolean;
  /** Swatch for the letter mark. */
  tint: string;
  /** Display icon. Local paths or issuer-hosted metadata URLs. */
  logo?: string;
  /** Rebase xStock this wrapper holds (ERC-4626 asset). */
  underlying?: `0x${string}`;
  /** Aave underlying — only if listed on X Layer. */
  aave?: { aToken: `0x${string}`; canCollateral: boolean; canBorrow: boolean };
  spark?: boolean;
};

export const USDG: Asset = {
  id: "USDG",
  symbol: "USDG",
  name: "Dollars",
  address: "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8",
  decimals: 6,
  kind: "stable",
  tradable: true,
  tint: "#1F7A4D",
  logo: "/assets/usdg.svg",
  aave: {
    aToken: "0x228765a3C18065C923F23a0CCb6c7cEFB3eA2223",
    canCollateral: false,
    canBorrow: true,
  },
};

export const USDT0: Asset = {
  id: "USDT0",
  symbol: "USDT",
  name: "Tether",
  address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  decimals: 6,
  kind: "stable",
  tradable: true,
  tint: "#26A17B",
  logo: "/assets/usdt.svg",
  aave: {
    aToken: "0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297",
    canCollateral: false,
    canBorrow: true,
  },
  spark: true,
};

export const USDC: Asset = {
  id: "USDC",
  symbol: "USDC",
  name: "USDC",
  address: "0xb6ceceab302e2e4948951ee7843fc24e92933061",
  decimals: 6,
  kind: "stable",
  tradable: true,
  tint: "#2775CA",
  logo: "/assets/usdc.svg",
};

/**
 * Trade the wrapped (non-rebasing) xStocks. Those are the tokens with live
 * Uniswap V3 liquidity vs USDG / USDC. The rebase xStock is `underlying`.
 */
export const STOCKS: Asset[] = [
  {
    id: "NVDA",
    symbol: "NVDA",
    name: "NVIDIA",
    address: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    decimals: 18,
    kind: "equity",
    tradable: true,
    tint: "#76B900",
    underlying: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
  },
  {
    id: "TSLA",
    symbol: "TSLA",
    name: "Tesla",
    address: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
    decimals: 18,
    kind: "equity",
    tradable: true,
    tint: "#E31937",
    underlying: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
  },
  {
    id: "AAPL",
    symbol: "AAPL",
    name: "Apple",
    address: "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f",
    decimals: 18,
    kind: "equity",
    tradable: true,
    tint: "#555555",
    underlying: "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a",
  },
  {
    id: "SPY",
    symbol: "SPY",
    name: "S&P 500",
    address: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    decimals: 18,
    kind: "etf",
    tradable: true,
    tint: "#1B4F8A",
    underlying: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
  },
  {
    id: "QQQ",
    symbol: "QQQ",
    name: "Nasdaq-100",
    address: "0x4c1ae29c159838fc1b224636e28e086eb69101f7",
    decimals: 18,
    kind: "etf",
    tradable: true,
    tint: "#5B4B8A",
    underlying: "0xa753a7395cae905cd615da0b82a53e0560f250af",
  },
  {
    id: "SPCX",
    symbol: "SPCX",
    name: "SpaceX",
    address: "0x8e2eed8b8b5e13ea7bf38e50d7821d2c57309072",
    decimals: 18,
    kind: "equity",
    tradable: true,
    tint: "#111111",
    underlying: "0x68fa48b1c2fe52b3d776e1953e0e782b5044ce28",
  },
];

export const AAVE_CRYPTO: Asset[] = [
  {
    id: "xBTC",
    symbol: "BTC",
    name: "Bitcoin",
    address: "0xb7C00000bcDEeF966b20B3D884B98E64d2b06b4f",
    decimals: 8,
    kind: "wrapped-crypto",
    tradable: false,
    tint: "#F7931A",
    aave: {
      aToken: "0xF5F9d4e9e2AFe7E0b193d291Befb41d61930464e",
      canCollateral: true,
      canBorrow: true,
    },
  },
  {
    id: "xETH",
    symbol: "ETH",
    name: "Ether",
    address: "0xE7B000003A45145decf8a28FC755aD5eC5EA025A",
    decimals: 18,
    kind: "wrapped-crypto",
    tradable: false,
    tint: "#627EEA",
    aave: {
      aToken: "0xe6639ba6c1d79Be6d4c776E4c17504538d1719cD",
      canCollateral: true,
      canBorrow: true,
    },
  },
  {
    id: "xSOL",
    symbol: "SOL",
    name: "Solana",
    address: "0x505000008DE8748DBd4422ff4687a4FC9bEba15b",
    decimals: 9,
    kind: "wrapped-crypto",
    tradable: false,
    tint: "#9945FF",
    aave: {
      aToken: "0x523dCe1b164327818fc5B41278fAe41f6B5753FE",
      canCollateral: true,
      canBorrow: true,
    },
  },
];

export const ASSETS: Asset[] = [USDG, USDT0, USDC, ...STOCKS, ...AAVE_CRYPTO];

export const byAddress = new Map(ASSETS.map((a) => [a.address.toLowerCase(), a]));
export const byId = new Map(ASSETS.map((a) => [a.id, a]));

export const QUOTE = USDG;
export const QUOTES: Asset[] = [USDG, USDC, USDT0];
export const FEE_TIERS = [500, 3000, 10000, 100] as const;

export const UNISWAP = {
  quoter: "0xd1b797d92d87b688193a2b976efc8d577d204343" as const,
  router: "0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca" as const,
  factory: "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804" as const,
  npm: "0x315e413A11AB0df498eF83873012430ca36638Ae" as const,
  wokb: "0xe538905cf8410324e03A5A23C1c177a474D59b2b" as const,
};

export const AAVE = {
  pool: "0xE3F3Caefdd7180F884c01E57f65Df979Af84f116" as const,
  dataProvider: "0x6C505C31714f14e8af2A03633EB2Cdfb4959138F" as const,
};

export const SPARK = {
  vault: "0xc358c90D32375721Cb3924320Fdc2F8B694347Ca" as const,
  asset: USDT0.address,
};

/** Weesh take on swaps. 5 bps = 0.05%. */
export const WEESH_FEE_BPS = 5;
export const SLIPPAGE_BPS = 50;
export const WEESH_TREASURY = (process.env.NEXT_PUBLIC_WEESH_TREASURY ||
  "0x46D5486731fEe2539146883e1B3c80B2c8ac60E3") as `0x${string}`;

export function weeshFeeLabel(): string {
  return `${WEESH_FEE_BPS / 100}%`;
}
