"use client";

import { MarketsList } from "@/components/MarketsList";
import { useMarkets } from "@/lib/useMarkets";

export default function MarketsPage() {
  const { available, unavailable, loading, error, total } = useMarkets();
  return (
    <>
      <p className="kicker">Markets</p>
      <h2>Every xStock on X Layer</h2>
      <p className="muted">
        {loading
          ? "Loading…"
          : `${available.filter((m) => m.reason === "live").length} Uniswap · ${available.filter((m) => m.reason === "okx").length} OKX DEX · ${unavailable.length} no fill · ${total} issued`}
        . Live prices are Uniswap. If there is no pool, Weesh says so.
      </p>
      {error ? <p className="err">{error}</p> : null}
      <div style={{ marginTop: 24 }}>
        <MarketsList available={available} unavailable={unavailable} loading={loading} />
      </div>
    </>
  );
}
