import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RestingOrder } from "./orderTypes";

const FILE = join(process.cwd(), "data", "orders.json");

function load(): RestingOrder[] {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as RestingOrder[];
  } catch {
    return [];
  }
}

function save(rows: RestingOrder[]) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export function listOrders(stockId?: string): RestingOrder[] {
  const now = Math.floor(Date.now() / 1000);
  const all = load();
  const live = all.filter((o) => o.expiry > now);
  if (live.length !== all.length) save(live);
  if (!stockId) return live;
  return live.filter((o) => o.stockId.toLowerCase() === stockId.toLowerCase());
}

export function addOrder(row: RestingOrder) {
  const all = listOrders();
  all.push(row);
  save(all);
}

export function removeOrder(id: string, maker: string): RestingOrder | null {
  const all = load();
  const hit = all.find((o) => o.id === id);
  if (!hit || hit.maker.toLowerCase() !== maker.toLowerCase()) return null;
  save(all.filter((o) => o.id !== id));
  return hit;
}
