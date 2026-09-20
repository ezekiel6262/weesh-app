"use client";

import { useEffect, useMemo, useState } from "react";
import type { Market } from "./xstock";

type Payload = {
  updatedAt: number;
  available: Market[];
  unavailable: Market[];
  total: number;
};

const NONE: Market[] = [];

export function useMarkets() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/markets");
        if (!res.ok) throw new Error(`markets ${res.status}`);
        const json = (await res.json()) as Payload;
        if (!dead) setData(json);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Could not load markets");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const px = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of data?.available ?? []) {
      if (m.px) out[m.id] = m.px;
    }
    return out;
  }, [data]);

  return {
    loading,
    error,
    available: data?.available ?? NONE,
    unavailable: data?.unavailable ?? NONE,
    total: data?.total ?? 0,
    px,
  };
}
