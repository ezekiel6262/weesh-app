"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { GetDollars } from "@/components/GetDollars";
import { Mark } from "@/components/Mark";
import { Receive } from "@/components/Receive";
import { MarketsList } from "@/components/MarketsList";
import { useActivity } from "@/lib/activity";
import { xlayer } from "@/lib/chain";
import { money, qty } from "@/lib/format";
import { txUrl } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import { useMarkets } from "@/lib/useMarkets";
import { stockPath } from "@/lib/xstock";

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
  const { available, unavailable, loading, total } = useMarkets();
  return (
    <>
      <section className="hero">
        <p className="kicker">Weesh</p>
        <h1>Own stocks. Use DeFi. Stay in your wallet.</h1>
        <p className="lede">
          Create a wallet with email — no extension. Same address on any device. Buy NVIDIA like a
          stock. Park cash. Lend dollars. You sign every action — Uniswap, Aave, and Spark hold
          the position, not us.
        </p>
        <ConnectBar />
        <ul className="points">
          <li>Non-custodial</li>
          <li>X Layer</li>
          <li>
            {loading ? "xStocks" : `${available.length} live · ${unavailable.length} no pool`}
          </li>
          <li>0.05% Weesh fee · gas covered</li>
        </ul>
      </section>
      <p className="section-title">Live on Uniswap</p>
      <div className="tape">
        {(loading ? [] : available.slice(0, 6)).map((s) => (
          <Link className="cell" key={s.id} href={stockPath(s.id)}>
            <div className="cell-name">{s.name}</div>
            <div className="cell-px">{s.px ? money(s.px) : "…"}</div>
          </Link>
        ))}
      </div>
      {!loading ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {total} xStocks issued on X Layer.{" "}
          <Link href="/markets">See all markets</Link>
        </p>
      ) : null}
    </>
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
  const dayPct = useMemo(() => {
    if (!nav) return null;
    let d = 0;
    for (const h of holdings) {
      if (h.asset.kind === "stable") continue;
      const id = h.asset.id.endsWith("-x") ? h.asset.id.slice(0, -2) : h.asset.id;
      const m = markets.available.find((x) => x.id === id);
      if (m?.change24 != null) d += h.usd * (m.change24 / 100);
    }
    return (d / nav) * 100;
  }, [holdings, markets.available, nav]);
  const total = Math.max(nav, 0.0001);
  const stockPct = Math.round((stocksUsd / total) * 100);
  const cashPct = Math.round((cash / total) * 100);
  const defiPct = Math.max(0, 100 - stockPct - cashPct);

  return (
    <>
      <div className="book-head">
        <div>
          <p className="kicker">Dashboard</p>
          <p className="nav-usd">{loading && holdings.length === 0 ? "…" : money(nav)}</p>
          {dayPct != null && !empty ? (
            <p className={dayPct >= 0 ? "ok" : "err"} style={{ margin: "6px 0 0" }}>
              {dayPct >= 0 ? "+" : ""}
              {dayPct.toFixed(2)}% today
            </p>
          ) : null}
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn ghost" onClick={() => setDollars((v) => !v)}>
            Get dollars
          </button>
          <button className="btn ghost" onClick={() => setReceive(true)}>
            Receive
          </button>
          <Link href={stockPath("NVDA")} className="btn primary">
            Trade
          </Link>
        </div>
      </div>
      <p className="sub">
        {money(cash)} cash · {shown.length} holding{shown.length === 1 ? "" : "s"}
        {lp.length ? ` · ${lp.length} LP` : ""} · you hold the keys
        {" · "}
        <button className="btn ghost small" onClick={() => setHideDust((v) => !v)}>
          {hideDust ? "Show dust" : "Hide dust"}
        </button>
      </p>
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
              Stocks {stockPct}%
            </span>
            <span>
              <i className="cash" />
              Cash {cashPct}%
            </span>
            <span>
              <i className="defi" />
              DeFi {defiPct}%
            </span>
          </div>
        </div>
      ) : null}

      {empty && !loading ? (
        <div className="empty">
          <h2>Add dollars, then buy a stock.</h2>
          <p className="muted">
            Send USDG on X Layer to this address. Weesh covers gas — you do not need OKB. Already
            have USDT or USDC here? Get dollars.
          </p>
          <Receive compact />
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => setDollars(true)}>
              I already have USDT / USDC
            </button>
            <Link href={stockPath("NVDA")} className="btn ghost">
              Buy NVIDIA
            </Link>
          </div>
        </div>
      ) : null}

      {shown.length ? <p className="section-title">Holdings</p> : null}
      <div className="rows">
        {shown.map((l) => {
          const href =
            l.asset.kind === "equity" || l.asset.kind === "etf"
              ? stockPath(l.asset.id.endsWith("-x") ? l.asset.id.slice(0, -2) : l.asset.id)
              : l.asset.kind === "stable"
                ? "/earn"
                : undefined;
          const inner = (
            <>
              <Mark asset={l.asset} />
              <div>
                <div className="name">{l.asset.name}</div>
                <div className="sym">
                  {l.asset.symbol}
                  {l.px ? <span>· {money(l.px)}</span> : null}
                  {l.aave > BigInt(0) ? <span className="tag">lent</span> : null}
                  {l.spark > BigInt(0) ? <span className="tag">parked</span> : null}
                  {l.debt > BigInt(0) ? <span className="tag debt">borrowed</span> : null}
                </div>
              </div>
              <div className="r px">{qty(l.wallet + l.aave + l.spark, l.asset.decimals)}</div>
              <div className="r">
                <div>{money(l.usd)}</div>
              </div>
            </>
          );
          return href ? (
            <Link key={l.asset.id} href={href} className="row-link">
              {inner}
            </Link>
          ) : (
            <div key={l.asset.id} className="holding">
              {inner}
            </div>
          );
        })}
      </div>

      {lp.length ? (
        <>
          <p className="section-title">Liquidity</p>
          <div className="rows">
            {lp.map((p) => (
              <Link key={p.tokenId.toString()} href="/earn" className="row-link">
                <Mark asset={p.token0.id === "USDG" ? p.token1 : p.token0} />
                <div>
                  <div className="name">
                    {p.token0.symbol} / {p.token1.symbol}
                  </div>
                  <div className="sym">
                    Uniswap · {(p.fee / 10000).toFixed(2)}% · #{p.tokenId.toString()}
                  </div>
                </div>
                <div className="r" />
                <div className="r">
                  <span className="tag">LP</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {acts.length ? (
        <>
          <p className="section-title">Activity</p>
          <div className="rows">
            {acts.slice(0, 8).map((a) => (
              <a key={a.hash + a.t} className="row-link" href={txUrl(a.hash)} target="_blank" rel="noreferrer">
                <div>
                  <div className="name">{a.label}</div>
                  <div className="sym">{new Date(a.t).toLocaleString()}</div>
                </div>
                <div />
                <div />
                <div className="r">
                  <span className="tag">{a.kind}</span>
                </div>
              </a>
            ))}
          </div>
        </>
      ) : null}

      <p className="section-title">Markets</p>
      {markets.error ? <p className="err">{markets.error}</p> : null}
      <MarketsList
        available={markets.available}
        unavailable={markets.unavailable}
        loading={markets.loading}
        compact
      />

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
