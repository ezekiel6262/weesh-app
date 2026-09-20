"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { money } from "@/lib/format";
import { stockPath, toAsset, type Market } from "@/lib/xstock";

export function MarketsList({
  available,
  unavailable,
  loading,
  compact,
}: {
  available: Market[];
  unavailable: Market[];
  loading?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [showClosed, setShowClosed] = useState(!compact);
  const needle = q.trim().toLowerCase();

  const match = (m: Market) =>
    !needle ||
    m.name.toLowerCase().includes(needle) ||
    m.symbol.toLowerCase().includes(needle) ||
    m.xSymbol.toLowerCase().includes(needle);

  const uni = useMemo(() => available.filter((m) => m.reason === "live" && match(m)), [available, needle]);
  const okx = useMemo(() => available.filter((m) => m.reason === "okx" && match(m)), [available, needle]);
  const closed = useMemo(
    () =>
      unavailable.filter(
        (m) =>
          !needle ||
          m.name.toLowerCase().includes(needle) ||
          m.symbol.toLowerCase().includes(needle) ||
          m.xSymbol.toLowerCase().includes(needle)
      ),
    [unavailable, needle]
  );

  const uniShow = compact && !needle ? uni.slice(0, 8) : uni;
  const okxShow = compact && !needle ? okx.slice(0, 8) : okx;

  return (
    <>
      <div className="amount" style={{ marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search NVIDIA, Tesla, SHEIN…"
        />
      </div>
      {loading ? <p className="muted">Reading Uniswap and OKX DEX…</p> : null}
      <p className="section-title">On Uniswap · {available.filter((m) => m.reason === "live").length}</p>
      <div className="rows">
        {uniShow.map((m) => (
          <Link key={m.id} href={stockPath(m.id)} className="row-link">
            <Mark asset={toAsset(m)} />
            <div>
              <div className="name">{m.name}</div>
              <div className="sym">{m.symbol}</div>
            </div>
            <div className="r px">{m.px ? money(m.px) : "—"}</div>
            <div className="r">
              <span className="btn small">Buy</span>
            </div>
          </Link>
        ))}
        {!loading && uniShow.length === 0 ? <p className="muted">No Uniswap pool matches.</p> : null}
      </div>
      <p className="section-title">On OKX DEX · {available.filter((m) => m.reason === "okx").length}</p>
      <p className="muted">No Uniswap pool. Quote comes from OKX DEX (aggregator + RFQ) if a maker fills.</p>
      <div className="rows">
        {okxShow.map((m) => (
          <Link key={m.id} href={stockPath(m.id)} className="row-link">
            <Mark asset={toAsset(m)} />
            <div>
              <div className="name">{m.name}</div>
              <div className="sym">{m.symbol} · OKX DEX</div>
            </div>
            <div className="r px">RFQ</div>
            <div className="r">
              <span className="btn small">Buy</span>
            </div>
          </Link>
        ))}
        {!loading && okxShow.length === 0 ? (
          <p className="muted">No OKX DEX matches — try a quote on Trade anyway.</p>
        ) : null}
      </div>
      {compact && !needle ? (
        <p className="actions">
          <Link href="/markets" className="btn ghost">
            All markets
          </Link>
        </p>
      ) : null}

      <p className="section-title">
        Issued, no fill yet · {unavailable.length}
        {compact ? (
          <>
            {" "}
            <button className="btn ghost small" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? "Hide" : "Show"}
            </button>
          </>
        ) : null}
      </p>
      {showClosed ? (
        <div className="rows">
          {(compact && !needle ? closed.slice(0, 12) : closed).map((m) => (
            <Link key={m.id} href={stockPath(m.id)} className="row-link dim">
              <Mark asset={toAsset(m)} />
              <div>
                <div className="name">{m.name}</div>
                <div className="sym">{m.symbol} · try OKX DEX quote</div>
              </div>
              <div className="r px">—</div>
              <div className="r">
                <span className="tag debt">{m.reason === "halted" ? "halted" : "no book"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">
          {unavailable.length} xStocks are issued on X Layer with no Uniswap pool and are not on
          the OKX DEX token list. Trade can still ask OKX DEX for a quote. We do not invent a price.
        </p>
      )}
    </>
  );
}
