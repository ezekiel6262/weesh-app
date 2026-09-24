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
  const [group, setGroup] = useState<"uni" | "okx" | "closed">("uni");
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

  const searching = needle.length > 0;
  const rows = searching ? [...uni, ...okx, ...closed] : group === "uni" ? uniShow : group === "okx" ? okxShow : closed;
  const note = searching
    ? null
    : group === "okx"
      ? "No Uniswap pool. OKX DEX quotes these when a maker will fill."
      : group === "closed"
        ? "Issued on X Layer but nobody is making a market yet. You can still ask for a quote."
        : null;

  return (
    <>
      <div className="market-tools">
        <div className="seg">
          {(
            [
              ["uni", "Uniswap"],
              ["okx", "OKX DEX"],
              ["closed", "No pool"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={!searching && group === id ? "on" : ""} onClick={() => { setGroup(id); setQ(""); }}>
              {label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search NVIDIA, Tesla…"
        />
      </div>
      <div className="hold-card">
        {loading ? <p className="muted" style={{ padding: "16px 20px" }}>Reading Uniswap and OKX DEX…</p> : null}
        {rows.map((m) => {
          const quote = m.reason === "okx";
          const closedRow = m.reason === "no-pool" || m.reason === "halted";
          return (
            <Link key={m.id} href={stockPath(m.id)} className="tape-row" style={closedRow ? { opacity: 0.55 } : undefined}>
              <Mark asset={toAsset(m)} />
              <span>
                <span className="name" style={{ display: "block", fontWeight: 600 }}>{m.name}</span>
                <span className="sym">{m.symbol}{quote ? " · OKX DEX" : ""}</span>
              </span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: closedRow ? "var(--faint)" : undefined }}>
                {m.reason === "halted" ? "Halted" : quote ? "Quote" : m.px ? money(m.px) : "—"}
              </span>
              <span className={`chg ${m.change24 != null && m.change24 < 0 ? "err" : "ok"}`}>
                {m.change24 == null ? "" : `${m.change24 >= 0 ? "+" : "−"}${Math.abs(m.change24).toFixed(2)}%`}
              </span>
            </Link>
          );
        })}
        {!loading && rows.length === 0 ? <p className="muted" style={{ padding: "24px 20px" }}>Nothing matches “{q}”.</p> : null}
      </div>
      {note ? <p className="hint">{note}</p> : null}
    </>
  );
}
