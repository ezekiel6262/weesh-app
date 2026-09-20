# Weesh

**Own stocks. Use DeFi. Stay in your wallet.**

Consumer app for xStocks on X Layer. Email wallet (Privy). You sign. Uniswap, OKX DEX, Aave, and Spark hold the position. Weesh never takes custody.

```bash
cd apps/weesh
npm install
cp .env.example .env.local
npm run dev
```

http://127.0.0.1:3000

Copy `.env.example` to `.env.local` and fill:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | [dashboard.privy.io](https://dashboard.privy.io) — enable Email, allow your origin |
| `NEXT_PUBLIC_WEESH_TREASURY` | Address that receives the 0.05% fee and drips OKB |
| `WEESH_GAS_KEY` | Private key for that address (server only) |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | OKX DEX aggregator |

Allowed Privy origins must include `http://127.0.0.1:3000` and the production URL.

- **Book** — holdings in dollars. Empty wallet: send USDG on X Layer. Weesh covers gas.
- **Trade** — buy / sell xStocks vs USDG. Uniswap first, OKX DEX if no pool. 0.05% Weesh fee.
- **Earn** — Spark park USDT, Aave on listed stables, Uniswap LP.
- **Settings** — export the email wallet key. Weesh never sees it.

Stocks are not Aave collateral on X Layer. Issuer mint needs Backed KYC; Issue is wrap + print only.
