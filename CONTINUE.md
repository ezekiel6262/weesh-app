# Weesh — pick up here

Last session: 16 Sep 2026. Product is **Weesh**. IntentOS is not the homepage.

## Run

```bash
cd C:\Users\zek\projects\useweesh\apps\weesh
npm install
npm run dev
```

http://localhost:3000

## Locked decisions

- **App:** Weesh. Consumer stocks + DeFi on X Layer. Feels like a brokerage, not a DEX.
- **Custody:** none. User signs. Uniswap / Aave / Spark hold protocol positions.
- **Login:** OKX Wallet (email / Google inside **OKX**, then Connect). Phone without an extension uses “Open in OKX Wallet”. Do not add Privy unless Connect is too much friction.
- **Backup:** Settings → OKX Wallet Web export. Weesh never sees the key. Prefer email (export is live; Google/Apple export was not).
- **Face 1 (now):** Book, Trade, Earn, Settings.
- **Face 2 (later):** strategies, IntentOS, OKX.AI. App must work with Face 2 off.
- **Do not** bet on solvers/agents. A buy is one quote + one signature.
- **Do not** fake Aave-against-xStocks. Not listed on X Layer.
- Existing `C:\Users\zek\projects\weesh` is a **different** old project (outcome markets). Do not overwrite it. This app lives at `useweesh/apps/weesh`.

## What is built

| Route | Behavior |
|---|---|
| `/` | Book: USD NAV, allocation, holdings (wallet + Aave + Spark + debt), LP rows, markets tape. Empty book → Buy NVIDIA / Receive. Logged-out landing shows live Uniswap prices. |
| `/trade` | Buy/sell NVDA, TSLA, AAPL, SPY, QQQ, SPCX vs USDG. Debounced quote, Max, fee card (pool + Weesh 0% + slippage) before sign. `?asset=&side=` |
| `/earn` | Spark park/unpark USDT0. Aave supply/withdraw/borrow/repay on USDG and USDT0, with on-chain rates. Uniswap V3 full-range LP add/remove via NPM `0x315e413A11AB0df498eF83873012430ca36638Ae`. |
| `/settings` | Address copy, explorer, OKX backup, sign out. |

Catalog addresses were verified on X Layer RPC (`lib/catalog.ts`). Weesh fee is **0%** this build (`WEESH_FEE_BPS`).

## Next (in order)

1. **Use it** — OKX Wallet email → small buy. Confirm quote, switch-chain, two-step approve+swap.
2. Optional: `@okxconnect/ui` if the OKX deeplink is still too much friction on desktop-without-extension.
3. Weesh fee (treasury) when a recipient is set — UI already shows the line.
4. Face 2 only after a stranger can buy a stock and park cash.

## Docs

- Product: `useweesh/docs/brief/README.md`
- Schema: `useweesh/docs/brief/schema.md`
- PDF: `useweesh/docs/brief/Weesh-Product.pdf`
- IntentOS (clearing, later): `useweesh/` — registry `0x4129073bf0B0c9b612fA33F8687DbF555646D515` on chain 196.
