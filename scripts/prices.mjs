import { createPublicClient, http, parseAbi } from "viem";

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech") });
const quoter = "0xd1b797d92d87b688193a2b976efc8d577d204343";
const usd = [
  ["USDG", "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8"],
  ["USDC", "0xb6ceceab302e2e4948951ee7843fc24e92933061"],
  ["USDT", "0x779Ded0c9e1022225f8E0630b35a9b54bE713736"],
];
const stocks = [
  ["NVDA", "0xa8ddb5cd96b5222afe198316e9a57caa642850d5"],
  ["TSLA", "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171"],
  ["AAPL", "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f"],
  ["SPY", "0xe7e553cd128f0011777323a0b44a7b96ea1cb540"],
  ["QQQ", "0x4c1ae29c159838fc1b224636e28e086eb69101f7"],
  ["SPCX", "0x8e2eed8b8b5e13ea7bf38e50d7821d2c57309072"],
];
const abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160, uint32, uint256)",
]);
const unit = 10n ** 18n;
const fees = [500, 3000, 100, 10000];

for (const [sym, addr] of stocks) {
  let best = null;
  for (const [qsym, qaddr] of usd) {
    for (const fee of fees) {
      try {
        const { result } = await client.simulateContract({
          address: quoter,
          abi,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: addr, tokenOut: qaddr, amountIn: unit, fee, sqrtPriceLimitX96: 0n }],
        });
        const px = Number(result[0]) / 1e6;
        if (!best || px > best.px) best = { qsym, fee, px };
      } catch {}
    }
  }
  console.log(sym, best ? `$${best.px.toFixed(2)} via ${best.qsym} fee ${best.fee}` : "NO QUOTE");
}
