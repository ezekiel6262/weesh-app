"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Mark } from "@/components/Mark";
import { PriceChart } from "@/components/PriceChart";
import { IssueRedeem } from "@/components/IssueRedeem";
import { MarketBook } from "@/components/MarketBook";
import { SizeRfq } from "@/components/SizeRfq";
import { TradeTicket } from "@/components/TradeTicket";
import { WrapPanel } from "@/components/WrapPanel";
import { EXPLORER } from "@/lib/chain";
import { money, qty, shortAddr } from "@/lib/format";
import { cashSession } from "@/lib/hours";
import { useBook } from "@/lib/useBook";
import { useMarkets } from "@/lib/useMarkets";
import { getRow, getStock } from "@/lib/xstock";
import { STOCKS } from "@/lib/catalog";

export default function StockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = decodeURIComponent(raw);
  const row = getRow(id);
  const stock = getStock(id) ?? STOCKS.find((s) => s.id === id);
  const { available, unavailable } = useMarkets();
  const { holdings } = useBook();
  const { isConnected } = useAccount();
  const [refPx, setRefPx] = useState<number | null>(null);
  const [tab, setTab] = useState<"market" | "book" | "size" | "issue">("market");
  const session = cashSession();

  useEffect(() => {
    if (!stock) return;
    fetch(`/api/ref?id=${encodeURIComponent(stock.id)}`)
      .then((r) => r.json())
      .then((j) => setRefPx(typeof j.ref === "number" ? j.ref : null))
      .catch(() => setRefPx(null));
  }, [stock]);

  if (!stock || !row) {
    return (
      <section className="hero">
        <h1>Unknown stock</h1>
        <p className="lede">That ticker is not in the X Layer xStocks list.</p>
        <Link href="/markets" className="btn">
          All markets
        </Link>
      </section>
    );
  }

  const market = [...available, ...unavailable].find((m) => m.id === stock.id);
  const holding = holdings.find((h) => h.asset.id === stock.id);
  const onchain = market?.px ?? holding?.px ?? null;
  const prem =
    onchain && refPx ? ((onchain - refPx) / refPx) * 100 : null;
  const venue =
    market?.reason === "live"
      ? "Uniswap V3"
      : market?.reason === "okx"
        ? "OKX DEX"
        : market?.reason === "halted"
          ? "Halted"
          : "No fill yet";

  return (
    <>
      <p className="kicker">
        <Link href="/markets">Markets</Link>
        {" / "}
        {stock.symbol}
      </p>
      <div className="stock-hero">
        <Mark asset={stock} size={48} />
        <div>
          <h1 style={{ margin: 0 }}>{stock.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {row.xSymbol} · tokenized {row.kind === "etf" ? "ETF" : "equity"} on X Layer
          </p>
        </div>
      </div>
      <p className={session.open ? "ok" : "muted"}>
        {session.label} · {session.ny}. Onchain still fills; the print can drift when cash is closed.
      </p>
      {market?.reason === "halted" ? (
        <p className="blocked">Issuer has halted this xStock.</p>
      ) : null}

      <div className="stock-grid">
        <div>
          <PriceChart id={stock.id} last={onchain} />
          <div className="card" style={{ marginTop: 16 }}>
            <p className="kicker">Details</p>
            <div className="kv">
              <span>Onchain</span>
              <strong>{onchain ? money(onchain) : "Live on quote"}</strong>
            </div>
            <div className="kv">
              <span>Issuer / cash</span>
              <span>{refPx ? money(refPx) : "No tape for this ticker"}</span>
            </div>
            <div className="kv">
              <span>Premium</span>
              <strong className={prem == null ? "" : prem > 0.15 ? "err" : prem < -0.15 ? "ok" : ""}>
                {prem == null ? "—" : `${prem > 0 ? "+" : ""}${prem.toFixed(2)}% vs ${stock.symbol}`}
              </strong>
            </div>
            {market?.change24 != null ? (
              <div className="kv">
                <span>24h onchain</span>
                <span className={market.change24 >= 0 ? "ok" : "err"}>
                  {market.change24 >= 0 ? "+" : ""}
                  {market.change24.toFixed(2)}%
                </span>
              </div>
            ) : null}
            <div className="kv">
              <span>Venue</span>
              <strong>{venue}</strong>
            </div>
            <div className="kv">
              <span>Uniswap liquidity</span>
              <span>{market?.usdLiquidity ? money(market.usdLiquidity) : "—"}</span>
            </div>
            {isConnected ? (
              <div className="kv">
                <span>Your position</span>
                <strong>
                  {holding
                    ? `${qty(holding.wallet + holding.aave + holding.spark, stock.decimals)} · ${money(holding.usd)}`
                    : "None"}
                </strong>
              </div>
            ) : null}
            <div className="kv">
              <span>Trade token</span>
              <a href={`${EXPLORER}/token/${stock.address}`} target="_blank" rel="noreferrer" className="mono">
                {shortAddr(stock.address)}
              </a>
            </div>
            {row.underlying ? (
              <div className="kv">
                <span>Underlying xStock</span>
                <a href={`${EXPLORER}/token/${row.underlying}`} target="_blank" rel="noreferrer" className="mono">
                  {shortAddr(row.underlying)}
                </a>
              </div>
            ) : null}
            <p className="muted" style={{ marginTop: 14 }}>
              Premium is onchain last vs the cash-market print. Not NAV. Tokenized stocks are not for US
              persons.{" "}
              <Link href="/about">What’s an xStock?</Link>
            </p>
          </div>
          {tab !== "issue" ? <WrapPanel stock={stock} row={row} /> : null}
        </div>
        <div>
          <div className="seg">
            <button className={tab === "market" ? "on" : ""} onClick={() => setTab("market")}>
              Market
            </button>
            <button className={tab === "book" ? "on" : ""} onClick={() => setTab("book")}>
              Book
            </button>
            <button className={tab === "size" ? "on" : ""} onClick={() => setTab("size")}>
              Size
            </button>
            <button className={tab === "issue" ? "on" : ""} onClick={() => setTab("issue")}>
              Issue
            </button>
          </div>
          {tab === "market" ? (
            <TradeTicket stockId={stock.id} initialSide={holding ? "sell" : "buy"} />
          ) : null}
          {tab === "book" ? <MarketBook stock={stock} last={onchain} /> : null}
          {tab === "size" ? <SizeRfq stock={stock} /> : null}
          {tab === "issue" ? <IssueRedeem stock={stock} row={row} onchain={onchain} /> : null}
        </div>
      </div>
    </>
  );
}
