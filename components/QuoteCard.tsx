import type { ReactNode } from "react";
import { poolFeePct, qty } from "@/lib/format";
import { weeshFeeLabel, type Asset } from "@/lib/catalog";
import { splitWeeshFee } from "@/lib/fee";
import type { Quote } from "@/lib/quote";

export function QuoteCard({
  q,
  pay,
  get,
  extra,
  slippagePct = 0.5,
  fullIn,
}: {
  q: Quote;
  pay: Asset;
  get: Asset;
  extra?: ReactNode;
  slippagePct?: number;
  fullIn?: bigint;
}) {
  const paid = fullIn ?? q.amountIn;
  const { fee } = splitWeeshFee(paid);
  return (
    <div className="card accent-edge" style={{ marginTop: 16 }}>
      <div className="kv">
        <span>You pay</span>
        <strong>
          {qty(paid, pay.decimals)} {pay.symbol}
        </strong>
      </div>
      <div className="kv">
        <span>You receive</span>
        <strong>
          {qty(q.amountOut, get.decimals)} {get.symbol}
        </strong>
      </div>
      <div className="kv">
        <span>Venue</span>
        <span>{q.venue === "okx" ? "OKX DEX" : "Uniswap V3"}</span>
      </div>
      <div className="kv">
        <span>{q.venue === "okx" ? "Route" : "Pool fee"}</span>
        <span>
          {q.venue === "okx" ? q.via || "RFQ / aggregator" : poolFeePct(q.fee)}
          {q.venue !== "okx" && q.via ? ` · via ${q.via}` : ""}
        </span>
      </div>
      <div className="kv">
        <span>Weesh fee</span>
        <span>
          {weeshFeeLabel()}
          {fee > BigInt(0) ? ` · ${qty(fee, pay.decimals)} ${pay.symbol}` : ""}
        </span>
      </div>
      <div className="kv">
        <span>Gas</span>
        <span>covered</span>
      </div>
      <div className="kv">
        <span>Slippage</span>
        <span>{slippagePct.toFixed(2)}%</span>
      </div>
      {extra}
    </div>
  );
}
