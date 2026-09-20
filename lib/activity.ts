"use client";

import { useEffect, useState } from "react";

export type Act = {
  t: number;
  kind: string;
  label: string;
  hash: string;
};

const KEY = "weesh-activity";

export function recordAct(kind: string, label: string, hash: string) {
  if (typeof window === "undefined") return;
  const cur: Act[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  cur.unshift({ t: Date.now(), kind, label, hash });
  localStorage.setItem(KEY, JSON.stringify(cur.slice(0, 40)));
  window.dispatchEvent(new Event("weesh-act"));
}

export function useActivity() {
  const [items, setItems] = useState<Act[]>([]);
  useEffect(() => {
    const load = () => {
      try {
        setItems(JSON.parse(localStorage.getItem(KEY) || "[]"));
      } catch {
        setItems([]);
      }
    };
    load();
    window.addEventListener("weesh-act", load);
    return () => window.removeEventListener("weesh-act", load);
  }, []);
  return items;
}
