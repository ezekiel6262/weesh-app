"use client";

import { MarketsList } from "@/components/MarketsList";
import { useMarkets } from "@/lib/useMarkets";

export default function MarketsPage() {
  const { available, unavailable, loading, error, total } = useMarkets();
  return (
    <>
      <h1>Markets</h1>
      <p className="page-lede">
        {loading ? "Loading…" : `${total} xStocks on X Layer. Prices come from Uniswap; the rest are quoted on request.`}
      </p>
      {error ? <p className="err">{error}</p> : null}
      <div style={{ marginTop: 24 }}>
        <MarketsList available={available} unavailable={unavailable} loading={loading} />
      </div>
    </>
  );
}
