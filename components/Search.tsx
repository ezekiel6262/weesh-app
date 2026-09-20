"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { stockPath, XSTOCKS } from "@/lib/xstock";

export function HeaderSearch() {
  const [q, setQ] = useState("");
  const [on, setOn] = useState(false);
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 1) return [];
    return XSTOCKS.filter(
      (r) =>
        r.name.toLowerCase().includes(n) ||
        r.symbol.toLowerCase().includes(n) ||
        r.xSymbol.toLowerCase().includes(n)
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="head-search">
      <input
        value={q}
        placeholder="Search NVDA…"
        onChange={(e) => {
          setQ(e.target.value);
          setOn(true);
        }}
        onFocus={() => setOn(true)}
        onBlur={() => setTimeout(() => setOn(false), 180)}
      />
      {on && hits.length ? (
        <div className="search-pop">
          {hits.map((r) => (
            <Link key={r.id} href={stockPath(r.id)} onClick={() => setQ("")}>
              <strong>{r.symbol}</strong>
              <span>{r.name}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
