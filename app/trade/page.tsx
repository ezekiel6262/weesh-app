"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gate } from "@/components/Connect";
import { TradeTicket } from "@/components/TradeTicket";
import { STOCKS } from "@/lib/catalog";
import { getStock } from "@/lib/xstock";

export default function TradePage() {
  return (
    <Gate>
      <Suspense>
        <Trade />
      </Suspense>
    </Gate>
  );
}

function Trade() {
  const params = useSearchParams();
  const paramId = params.get("asset");
  const initial =
    (paramId ? getStock(paramId) : undefined) ?? STOCKS.find((s) => s.id === paramId) ?? STOCKS[0];
  const [stockId, setStockId] = useState(initial.id);
  const side = params.get("side") === "sell" ? "sell" : "buy";

  useEffect(() => {
    const a = params.get("asset");
    if (a && getStock(a)) setStockId(a);
  }, [params]);

  return (
    <div className="grid">
      <div>
        <p className="kicker">Trade</p>
        <p className="muted">Pick a name, or open it from Book / Markets for the full stock page.</p>
        <TradeTicket
          stockId={stockId}
          onStockId={setStockId}
          showPicker
          initialSide={side}
        />
      </div>
      <div>
        <div className="card">
          <p className="muted">
            Uniswap V3 first. If there is no pool, OKX DEX (aggregator + Native RFQ). If neither
            quotes, we say so instead of faking a fill.
          </p>
        </div>
      </div>
    </div>
  );
}
