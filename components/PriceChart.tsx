"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Point = { t: number; c: number };

export function PriceChart({ id, last }: { id: string; last?: number | null }) {
  const [range, setRange] = useState("1W");
  const [points, setPoints] = useState<Point[]>([]);
  const [change, setChange] = useState(0);
  const [px, setPx] = useState<number | null>(last ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetch(`/api/chart?id=${encodeURIComponent(id)}&range=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (dead) return;
        setPoints(j.points ?? []);
        setChange(j.change ?? 0);
        if (j.last) setPx(j.last);
      })
      .catch(() => {
        if (!dead) setPoints([]);
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [id, range]);

  const path = useMemo(() => {
    if (points.length < 2) return "";
    const w = 640;
    const h = 200;
    const ys = points.map((p) => p.c);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p.c - min) / span) * (h - 16) - 8;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  const up = change >= 0;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <p className="nav-usd" style={{ fontSize: 36 }}>
            {px ? money(px) : last ? money(last) : "—"}
          </p>
          <p className={up ? "ok" : "err"} style={{ margin: "4px 0 0" }}>
            {loading ? "Loading chart…" : `${up ? "+" : ""}${change.toFixed(2)}% · ${range}`}
          </p>
        </div>
        <div className="seg" style={{ margin: 0, minWidth: 180 }}>
          {["1D", "1W", "1M"].map((r) => (
            <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="chart">
        {path ? (
          <svg viewBox="0 0 640 200" preserveAspectRatio="none" aria-label="Price chart">
            <path d={path} fill="none" stroke={up ? "var(--ok)" : "var(--accent)"} strokeWidth="2.2" />
          </svg>
        ) : (
          <p className="muted chart-empty">
            {loading ? "Fetching Uniswap history…" : "No Uniswap history for this name yet. Quotes still run through OKX DEX when a maker fills."}
          </p>
        )}
      </div>
    </div>
  );
}
