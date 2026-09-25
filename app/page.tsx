"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { GetDollars } from "@/components/GetDollars";
import { Mark } from "@/components/Mark";
import { Receive } from "@/components/Receive";
import { useActivity } from "@/lib/activity";
import { xlayer } from "@/lib/chain";
import { money, qty } from "@/lib/format";
import { txUrl } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import { useMarkets } from "@/lib/useMarkets";
import { stockPath, toAsset } from "@/lib/xstock";

export default function BookPage() {
  const { isConnected, chainId } = useAccount();
  if (!isConnected) return <Landing />;
  if (chainId !== xlayer.id) {
    return (
      <section className="hero">
        <h1>Switch to X Layer</h1>
        <p className="lede">Stocks and DeFi here live on X Layer. One tap.</p>
        <ConnectBar />
      </section>
    );
  }
  return <Book />;
}

function Landing() {
  const { available, loading } = useMarkets();
  const live = available.filter((m) => m.reason === "live").slice(0, 6);
  return (
    <section className="landing">
      <div>
        <h1>Stocks you can actually use.</h1>
        <p className="lede">
          Buy NVIDIA, Tesla or the S&amp;P 500 on X Layer. Hold it in your wallet, send a fraction to
          anyone, and put idle dollars to work.
        </p>
        <ConnectBar start />
        <div className="actions">
          <Link className="btn ghost" href="/send">
            Send a stock
          </Link>
          <Link className="btn ghost" href="/about">
            How it works
          </Link>
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Your wallet · Your signature · X Layer
        </p>
      </div>
      <div className="tape-card">
        <div className="tape-head">
          <h2>Live on Uniswap</h2>
          <Link href="/markets">All markets</Link>
        </div>
        {(loading ? [] : live).map((s) => (
          <Link className="tape-row" key={s.id} href={stockPath(s.id)}>
            <Mark asset={toAsset(s)} size={32} />
            <span>
              <span className="name" style={{ display: "block", fontWeight: 600 }}>{s.name}</span>
              <span className="sym">{s.symbol}</span>
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{s.px ? money(s.px) : "…"}</span>
            <span className={`chg ${s.change24 != null && s.change24 < 0 ? "err" : "ok"}`}>
              {s.change24 == null ? "" : `${s.change24 >= 0 ? "+" : "−"}${Math.abs(s.change24).toFixed(2)}%`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Book() {
  const { holdings, lp, loading, error, nav, cash, stocksUsd, defiUsd, empty } = useBook();
  const markets = useMarkets();
  const acts = useActivity();
  const [receive, setReceive] = useState(false);
  const [hideDust, setHideDust] = useState(true);
  const [dollars, setDollars] = useState(false);

  const shown = hideDust ? holdings.filter((l) => Math.abs(l.usd) >= 0.05) : holdings;
  const day = useMemo(() => {
    if (!nav) return null;
    let d = 0;
    for (const h of holdings) {
      if (h.asset.kind === "stable") continue;
      const id = h.asset.id.endsWith("-x") ? h.asset.id.slice(0, -2) : h.asset.id;
      const m = markets.available.find((x) => x.id === id);
      if (m?.change24 != null) d += h.usd * (m.change24 / 100);
    }
    return { usd: d, pct: (d / nav) * 100 };
  }, [holdings, markets.available, nav]);
  const total = Math.max(nav, 0.0001);
  const stockPct = Math.round((stocksUsd / total) * 100);
  const cashPct = Math.round((cash / total) * 100);
  const defiPct = Math.max(0, 100 - stockPct - cashPct);

  return (
    <>
      <div className="book-head">
        <div>
          <p className="book-label">Your book</p>
          <p className="nav-usd">{loading && holdings.length === 0 ? "…" : money(nav)}</p>
          {day && !empty ? (
            <p className={day.usd >= 0 ? "ok" : "err"} style={{ margin: "8px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {day.usd >= 0 ? "+" : "−"}
              {money(Math.abs(day.usd))} ({day.pct >= 0 ? "+" : "−"}
              {Math.abs(day.pct).toFixed(2)}%) today
            </p>
          ) : null}
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn ghost" onClick={() => setReceive(true)}>
            Add money
          </button>
          <Link href={stockPath("NVDA")} className="btn primary">
            Trade
          </Link>
        </div>
      </div>
      {dollars ? <GetDollars /> : null}
      {error ? <p className="err">{error}</p> : null}

      {!empty ? (
        <div className="alloc">
          <div className="alloc-bar">
            {stockPct ? <span className="stocks" style={{ width: `${stockPct}%` }} /> : null}
            {cashPct ? <span className="cash" style={{ width: `${cashPct}%` }} /> : null}
            {defiPct ? <span className="defi" style={{ width: `${defiPct}%` }} /> : null}
          </div>
          <div className="alloc-legend">
            <span>
              <i className="stocks" />
              Stocks {money(stocksUsd)}
            </span>
            <span>
              <i className="cash" />
              Cash {money(cash)}
            </span>
            <span>
              <i className="defi" />
              Earning {money(defiUsd)}
            </span>
          </div>
        </div>
      ) : null}

      {empty && !loading ? (
        <div style={{ maxWidth: 620, padding: "24px 0" }}>
          <h1>Add dollars, then buy a stock.</h1>
          <p className="page-lede">Send USDG on X Layer to your address. Weesh covers gas, so you don’t need OKB.</p>
          <Receive compact />
          <p className="muted" style={{ marginTop: 16 }}>
            Already have USDT or USDC here?{" "}
            <button className="btn ghost small" onClick={() => setDollars(true)}>
              Convert to USDG
            </button>
          </p>
        </div>
      ) : null}

      {!empty ? (
        <div className="book-grid">
          <div className="hold-card">
            <div className="hold-head">
              <h2>Holdings</h2>
              <button className="btn ghost small" type="button" onClick={() => setHideDust((v) => !v)}>
                {hideDust ? "Show small balances" : "Hide small balances"}
              </button>
            </div>
            {shown.map((l) => {
              const href =
                l.asset.kind === "equity" || l.asset.kind === "etf"
                  ? stockPath(l.asset.id.endsWith("-x") ? l.asset.id.slice(0, -2) : l.asset.id)
                  : "/earn";
              const where = l.spark > BigInt(0) ? "on Spark" : l.aave > BigInt(0) ? "on Aave" : null;
              return (
                <Link key={l.asset.id} href={href} className="hold-row">
                  <Mark asset={l.asset} />
                  <span>
                    <span className="name" style={{ display: "block" }}>{l.asset.name}</span>
                    <span className="sym">
                      {qty(l.wallet + l.aave + l.spark, l.asset.decimals)} {l.asset.symbol}
                      {l.px ? ` · ${money(l.px)}` : ""}
                      {where ? ` · ${where}` : ""}
                    </span>
                  </span>
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{money(l.usd)}</span>
                  </span>
                </Link>
              );
            })}
            {lp.map((p) => (
              <Link key={p.tokenId.toString()} href="/earn" className="hold-row">
                <Mark asset={p.token0.id === "USDG" ? p.token1 : p.token0} />
                <span>
                  <span className="name" style={{ display: "block" }}>
                    {p.token0.symbol} / {p.token1.symbol}
                  </span>
                  <span className="sym">
                    Uniswap · {(p.fee / 10000).toFixed(2)}% fee · #{p.tokenId.toString()}
                  </span>
                </span>
                <span className="sym">LP</span>
              </Link>
            ))}
          </div>
          <div>
            <h2 className="side-title">Activity</h2>
            {acts.slice(0, 8).map((a) => (
              <a key={a.hash + a.t} className="act-row" href={txUrl(a.hash)} target="_blank" rel="noreferrer">
                <span>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{a.label}</span>
                  <span className="sym">{new Date(a.t).toLocaleString()}</span>
                </span>
                <span className="sym">{a.kind}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {receive ? (
        <div className="modal-back" onClick={() => setReceive(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Receive />
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setReceive(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
