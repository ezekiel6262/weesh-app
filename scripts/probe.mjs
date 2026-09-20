import { createPublicClient, http, parseAbi } from "viem";

const client = createPublicClient({
  transport: http("https://rpc.xlayer.tech"),
});

const factory = "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804";
const quoter = "0xd1b797d92d87b688193a2b976efc8d577d204343";
const usdg = "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8";
const usdt = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
const fees = [100, 500, 3000, 10000];

const tokens = {
  catalogNVDA: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
  catalogTSLA: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
  catalogAAPL: "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a",
  catalogSPY: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
  catalogQQQ: "0xa753a7395cae905cd615da0b82a53e0560f250af",
  catalogSPCX: "0x68fa48b1c2fe52b3d776e1953e0e782b5044ce28",
  wNVDA: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
  wTSLA: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
  wSPCX: "0x8e2eed8b8b5e13ea7bf38e50d7821d2c57309072",
  aavePool: "0xE3F3Caefdd7180F884c01E57f65Df979Af84f116",
  aaveData: "0x6C505C31714f14e8af2A03633EB2Cdfb4959138F",
  spark: "0xc358c90D32375721Cb3924320Fdc2F8B694347Ca",
};

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function asset() view returns (address)",
]);
const factoryAbi = parseAbi([
  "function getPool(address,address,uint24) view returns (address)",
]);
const poolAbi = parseAbi(["function liquidity() view returns (uint128)"]);
const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const erc4626 = parseAbi([
  "function asset() view returns (address)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

function zero(a) {
  return !a || a === "0x0000000000000000000000000000000000000000";
}

async function meta(addr) {
  try {
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({ address: addr, abi: erc20, functionName: "symbol" }),
      client.readContract({ address: addr, abi: erc20, functionName: "name" }),
      client.readContract({ address: addr, abi: erc20, functionName: "decimals" }),
    ]);
    let asset = null;
    try {
      asset = await client.readContract({ address: addr, abi: erc20, functionName: "asset" });
    } catch {}
    return { addr, symbol, name, decimals, asset };
  } catch (e) {
    return { addr, error: e.shortMessage || e.message };
  }
}

async function pools(token) {
  const out = [];
  for (const quote of [usdg, usdt]) {
    for (const fee of fees) {
      try {
        const pool = await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: "getPool",
          args: [token, quote, fee],
        });
        if (zero(pool)) continue;
        let liq = 0n;
        try {
          liq = await client.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" });
        } catch {}
        out.push({ quote: quote === usdg ? "USDG" : "USDT", fee, pool, liq: liq.toString() });
      } catch {}
    }
  }
  return out;
}

async function quote(token, fee, decimals) {
  const amountIn = 10n ** BigInt(decimals);
  try {
    const { result } = await client.simulateContract({
      address: quoter,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: token, tokenOut: usdg, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return Number(result[0]) / 1e6;
  } catch (e) {
    return e.shortMessage || "fail";
  }
}

const rows = [];
for (const [k, addr] of Object.entries(tokens)) {
  if (["aavePool", "aaveData", "spark"].includes(k)) continue;
  const m = await meta(addr);
  const p = m.error ? [] : await pools(addr);
  let px = null;
  if (p.length) {
    const best = p[0];
    px = await quote(addr, best.fee, m.decimals ?? 18);
  }
  rows.push({ id: k, ...m, pools: p, px });
}

console.log(JSON.stringify(rows, null, 2));

for (const k of ["aavePool", "aaveData", "spark"]) {
  const code = await client.getCode({ address: tokens[k] });
  console.log(k, code && code !== "0x" ? `code ${code.length}` : "NO CODE");
}
try {
  const asset = await client.readContract({ address: tokens.spark, abi: erc4626, functionName: "asset" });
  console.log("spark.asset", asset);
} catch (e) {
  console.log("spark.asset fail", e.shortMessage || e.message);
}
