"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gate } from "@/components/Connect";
import { GetDollars } from "@/components/GetDollars";
import { Mark } from "@/components/Mark";
import { Receive } from "@/components/Receive";
import { Logo } from "@/components/Shell";
import { useActivity } from "@/lib/activity";
import { money, qty } from "@/lib/format";
import { txUrl } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import { useMarkets } from "@/lib/useMarkets";
import { stockPath } from "@/lib/xstock";

export default function HomePage() {
  const path = usePathname();
  return path === "/app" ? (
    <Gate>
      <Book />
    </Gate>
  ) : <MarketingHome />;
}

function MarketingHome() {
  const { available, loading } = useMarkets();
  const live = available.filter((m) => m.reason === "live").slice(0, 6);
  return (
    <div className="marketing-home">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="brand"><Logo />Weesh</Link>
          <nav aria-label="Homepage">
            <a href="#product">Product</a>
            <a href="#portfolios">Portfolios</a>
            <a href="#ai">OKX AI</a>
            <a href="#limits">What we don’t do</a>
          </nav>
          <Link className="btn primary" href="/app">Open app</Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div>
          <h1>Build a portfolio. Share the strategy. Keep the keys.</h1>
          <p className="lede">Weesh is an AI-assisted social investing app for tokenized stocks and onchain assets on X Layer. Buy, earn, publish a portfolio, and let anyone replicate your allocation from their own wallet.</p>
          <div className="actions">
            <Link className="btn primary marketing-cta" href="/app">Open Weesh</Link>
            <Link className="btn ghost marketing-cta" href="/portfolios">Explore portfolios</Link>
          </div>
          <p className="hint">Non-custodial · User-signed execution · Gas covered by Weesh · Not available to US persons</p>
        </div>
        <div className="marketing-mock" aria-label="Weesh trade preview">
          <div className="mock-ticket">
            <div className="mock-stock"><span className="mock-mark">N</span><span><strong>NVIDIA</strong><small>wNVDAx · Uniswap</small></span><span className="mock-price"><strong>$181.42</strong><small className="ok">+1.84%</small></span></div>
            <div className="seg"><button className="on">Buy</button><button>Sell</button></div>
            <div className="mock-amount"><span>$</span><strong>100</strong><small>USDG</small></div>
            <div className="mock-rows"><p><span>You get about</span><strong>0.5502 NVDA</strong></p><p><span>Weesh fee</span><strong>0.05% · $0.05</strong></p><p><span>Network fee</span><strong>Paid by Weesh</strong></p></div>
            <span className="btn primary">Buy NVIDIA</span>
          </div>
          <div className="mock-book"><small>Your dashboard</small><strong>$4,672.19</strong><div className="alloc-bar"><span className="stocks" style={{ width: "45%" }} /><span className="cash" style={{ width: "27%" }} /><span className="defi" style={{ width: "28%" }} /></div><small>Stocks · Cash · Earning</small></div>
        </div>
      </section>

      <div className="marketing-ticker">
        <div>{(loading ? [] : live).map((s) => <Link key={s.id} href={stockPath(s.id)}><strong>{s.symbol}</strong><span>{s.px ? money(s.px) : "—"}</span><span className={s.change24 != null && s.change24 < 0 ? "err" : "ok"}>{s.change24 == null ? "" : `${s.change24 >= 0 ? "+" : "−"}${Math.abs(s.change24).toFixed(2)}%`}</span></Link>)}</div>
      </div>

      <section className="marketing-section split" id="xstocks">
        <h2>An xStock is a token that tracks a stock.</h2>
        <div><p className="section-lede">It follows a stock or ETF and is backed 1:1 by the issuer, Backed. It gives price exposure, but it is not a share and does not include voting rights.</p><dl className="definition-list"><div><dt>NVDAx</dt><dd>The issuer token. Its balance rebases as dividend equivalents are paid.</dd></div><div><dt>wNVDAx</dt><dd>The wrapped version traded through Uniswap and OKX DEX—the one Weesh buys.</dd></div></dl></div>
      </section>

      <section className="marketing-dark" id="product"><div className="marketing-section"><h2>One wallet. A complete onchain investing loop.</h2><p className="section-lede">Weesh connects markets, yield, AI, and social portfolios while every asset remains at the user’s X Layer address.</p><div className="feature-rows">{[["Discover & trade","Buy tokenized stocks and RWAs through live Uniswap liquidity with OKX DEX routing when needed."],["One portfolio view","See wallet balances, stocks, stablecoins, Spark, Aave, debt, and Uniswap LP positions together."],["Automatic dollars","Weesh routes between supported stablecoins when an action needs a different dollar token."],["Earn","Put idle stablecoins to work through Spark, Aave, or Uniswap liquidity workflows."],["Send","Transfer fractional shares to a wallet or create a private claim link for someone new to crypto."]].map(([title,copy]) => <div key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div></div></section>

      <section className="marketing-section split" id="portfolios"><div><h2>Turn a market view into a portfolio people can follow.</h2><p className="section-lede">Create a public, unlisted, or private strategy with tokenized stocks and onchain assets. Public portfolios have a shareable page for the thesis, target allocation, verified holdings, followers, and discussion.</p><div className="actions"><Link className="btn primary" href="/portfolios/new">Create a portfolio</Link><Link className="btn ghost" href="/portfolios">Browse strategies</Link></div></div><div className="gift-example"><small>Public strategy</small><h3>X Layer Growth Basket</h3><p><span>NVIDIA</span><strong>40%</strong></p><p><span>S&amp;P 500</span><strong>35%</strong></p><p><span>Onchain dollars</span><strong>25%</strong></p><p><span>Execution</span><strong className="ok">Replicate from your wallet</strong></p></div></section>

      <section className="marketing-section" id="ai"><h2>Ask an agent. Keep the decision.</h2><p className="section-lede">Use specialists listed on OKX AI to research a stock mix, verify a thesis, or compare yield. Weesh supports free and paid agent services, while the wallet owner approves every payment and market action.</p><div className="strategy-example"><blockquote>“Compare the risk and yield of this allocation.”</blockquote><div><article><small>Plan in Weesh</small><h3>Strategy builder</h3><p>Set an amount and turn an idea into a clear target allocation.</p></article><article><small>Ask on OKX AI</small><h3>Specialist analysis</h3><p>Call a listed agent, review its response, then decide what—if anything—to sign.</p></article></div></div><div className="actions"><Link className="btn primary" href="/strategy">Open AI strategy desk</Link><Link className="btn ghost" href="/portfolios">Explore public portfolios</Link></div></section>

      <section className="marketing-section split send-story"><div><h2>Give stock to anyone.</h2><p className="section-lede">Wallets receive shares immediately. Everyone else gets a private link, and unclaimed gifts return after 14 days.</p><Link href="/app" className="btn primary">Open Send</Link></div><div className="gift-example"><h3>Ada’s class · 0.1 SPY each</h3><p><span>0x4f2a…c9e1</span><strong className="ok">Paid</strong></p><p><span>ada@school.edu</span><strong>Claimed</strong></p><p><span>Leo</span><strong>12 days left</strong></p></div></section>

      <section className="marketing-facts"><div><article><h3>Simple onboarding</h3><p>Use an embedded email wallet or connect OKX Wallet.</p></article><article><h3>No custody</h3><p>Weesh builds transactions. You review and sign them.</p></article><article><h3>No gas friction</h3><p>Fees are disclosed and supported actions can be gas-covered.</p></article></div></section>

      <section className="marketing-section split" id="limits"><div><h2>What Weesh doesn’t do</h2><p className="section-lede">Knowing the edges is part of the product.</p></div><div className="limit-list"><p><strong>Mint with the issuer.</strong> That requires Backed KYC.</p><p><strong>Borrow against stocks.</strong> xStocks are not Aave collateral on X Layer.</p><p><strong>Let agents move money.</strong> Agents analyze; you decide and sign.</p><p><strong>Invent assets.</strong> Send only moves real xStocks you hold.</p></div></section>

      <section className="marketing-final"><div><h2>Build your portfolio—and make the strategy worth following.</h2><Link className="btn primary" href="/app">Open Weesh</Link></div></section>
      <footer className="marketing-footer"><span><Logo />Weesh · Social investing on X Layer</span><p>Tokenized stocks are not available to US persons. Not investment advice. Protocols and agents are third parties.</p></footer>
    </div>
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
          <Link href="/trade" className="btn primary">
            Trade
          </Link>
          <Link href="/strategy" className="btn ghost">
            Build a strategy
          </Link>
          <Link href="/swap" className="btn ghost">
            Swap dollars
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
