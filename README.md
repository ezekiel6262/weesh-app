# Weesh

**Stocks you can actually use.**

Weesh is a non-custodial consumer brokerage for tokenized stocks on X Layer. A user can buy an xStock, hold it in their own wallet, send a fraction to a wallet or private claim link, and put idle stablecoins to work in DeFi.

Live product: [weesh-app.vercel.app](https://weesh-app.vercel.app)

## Why it exists

Most tokenized-stock products stop at trading or portfolio display. Weesh treats a stock token as a programmable onchain asset:

1. Buy an xStock with USDG through Uniswap or OKX DEX routing.
2. See stocks, cash, lending, savings, debt, and LP positions in one dollar-denominated book.
3. Send fractional shares directly to a wallet or create a private claim link.
4. Park or lend idle stablecoins through Spark and Aave.
5. Ask listed OKX AI specialists to analyze a strategy while the user retains signing control.

## Hackathon track

Primary track: **Build a Market**.

Weesh integrates tokenized stocks and real-world assets on X Layer, provides a live market and portfolio experience, and adds an onchain stock-gifting primitive. The secondary OKX AI integration connects users to listed analysis services and supports x402-style paid calls without routing payment through Weesh.

## Working flows

| Flow | What happens |
|---|---|
| Trade | Live quote from Uniswap or OKX DEX, fee preview, user-signed execution |
| Book | Aggregates wallet, Aave, Spark, debt, and Uniswap LP positions |
| Stock gift | Sends shares to wallets or creates private claim links through WeeshDrop |
| Claim | Recipient connects a wallet and claims shares from the X Layer contract |
| Earn | Spark savings, Aave lending/borrowing, and Uniswap V3 liquidity |
| Strategy | Self-directed allocation tools plus listed OKX AI agent calls |

## Verifiable integration

- Network: X Layer mainnet, chain ID `196`
- Stock gift contract: [`0x76960502d4d84381fab3ec48be229342631fc33f`](https://www.oklink.com/x-layer/address/0x76960502d4d84381fab3ec48be229342631fc33f)
- Trading: Uniswap V3 pools with OKX DEX aggregator/RFQ fallback
- Wallet execution: every asset-moving action is signed by the user
- Transaction proof: successful actions link to OKLink from the product

Weesh never takes custody of the wallet, shares, stablecoins, LP NFTs, or agent payments. xStocks are not presented as Aave collateral when they are not listed as such.

## Work completed during the build period

- Consumer brokerage dashboard and live xStock market discovery
- Routed buy/sell execution with fee and slippage disclosure
- Gas-cover workflow for X Layer transactions
- Portfolio aggregation across wallet and DeFi positions
- WeeshDrop contract integration for direct and claim-link stock gifts
- Recurring stock sends to wallet recipients
- Spark, Aave, and Uniswap LP workflows
- OKX AI listed-agent discovery and paid/free service calls
- Mobile navigation and submission-focused UX refinement

The Git history documents these features and subsequent fixes.

## Architecture

```text
User wallet
  ├─ Trade ───── Uniswap V3 / OKX DEX ───── xStocks
  ├─ Send ────── WeeshDrop on X Layer ───── wallet or claim link
  ├─ Earn ────── Spark / Aave / Uniswap ─── protocol positions
  └─ Strategy ── OKX AI listed services ─── analysis / x402 payment

Next.js on Vercel provides the interface and server-side API adapters.
Private keys and asset custody remain outside Weesh.
```

## Local development

```bash
cd apps/weesh
npm install
copy .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

Environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Email and wallet connection |
| `NEXT_PUBLIC_WEESH_TREASURY` | Trade-fee and gas-cover treasury |
| `WEESH_GAS_KEY` | Server-only gas-cover signer |
| `OKX_API_KEY` | OKX DEX API access |
| `OKX_SECRET_KEY` | OKX DEX API signing |
| `OKX_PASSPHRASE` | OKX DEX API passphrase |
| `NEXT_PUBLIC_WEESH_DROP` | Optional WeeshDrop contract override |

Never commit `.env.local` or server secrets.

## Verification

```bash
npm run lint
npm run build
```

See [HACKATHON.md](./docs/HACKATHON.md) for the submission copy and [DEMO.md](./docs/DEMO.md) for the demo script.

## Risk disclosures

xStocks are tokenized instruments, not direct shares, and can trade away from their reference price. Availability and eligibility vary by jurisdiction. Weesh is not investment advice.
