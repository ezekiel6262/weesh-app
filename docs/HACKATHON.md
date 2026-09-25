# OKX Dev Day 2026 submission

## Project

**Weesh — stocks you can actually use**

Primary track: **Build a Market**  
Product: https://weesh-app.vercel.app  
Repository: https://github.com/ezekiel6262/weesh-app

## Short summary

Weesh is a non-custodial brokerage for tokenized stocks on X Layer. Users can buy xStocks with USDG, view stocks and DeFi positions in one book, send fractional shares directly or through a private claim link, and put idle stablecoins to work. Every asset-moving action remains user-signed.

## Intended user

A consumer who wants brokerage simplicity without giving up wallet ownership or the programmability of onchain assets.

## Core integration

- X Layer mainnet for all asset and contract actions
- xStocks as the tokenized-stock/RWA market
- Uniswap and OKX DEX for execution
- WeeshDrop for direct transfers, claim links, and recurring stock gifts
- Spark and Aave for idle stablecoin utility
- OKX AI listed services for strategy analysis and x402-style paid calls

## What is distinctive

The product does not end after a stock purchase. The same asset can be held, verified, sent fractionally, gifted through a claim link, or composed with other X Layer financial activity. The wallet stays in control throughout.

## Working demo flow

1. Connect a wallet on X Layer.
2. Open NVIDIA and load a live USDG quote.
3. Review route, fee, and slippage before signing.
4. Show the position in the Book.
5. Open Send and create a fractional NVIDIA gift.
6. Open the private claim link in a recipient session.
7. Show the WeeshDrop contract and transaction on OKLink.
8. Open Strategy and demonstrate the stock-mix planner plus an OKX AI verification service.

## Technical proof

WeeshDrop: `0x76960502d4d84381fab3ec48be229342631fc33f`  
Network: X Layer, chain ID `196`  
Explorer: https://www.oklink.com/x-layer/address/0x76960502d4d84381fab3ec48be229342631fc33f

## Build-period work

The commit history shows the implementation of the brokerage UI, routed trades, portfolio book, DeFi workflows, stock sending and claims, recurring sends, OKX AI agent integration, mobile UX, and submission-focused refinements. This is functional work, not a new deployment or listing alone.

## Safety and accuracy

- No custody or hidden signing
- No claim that xStocks are Aave collateral
- Charges and slippage are shown before signing
- Paid agent calls display their requested payment before authorization
- External agent output is analysis, not automatic execution
