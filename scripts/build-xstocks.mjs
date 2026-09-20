import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodes = [];
for (let page = 0; ; page++) {
  const src = await fetch(`https://api.xstocks.fi/api/v2/public/assets?page=${page}`);
  if (!src.ok) throw new Error(`xStocks API ${src.status} page ${page}`);
  const body = await src.json();
  nodes.push(...(body.nodes ?? []));
  console.log(`page ${page}: ${body.nodes?.length ?? 0} (total ${nodes.length})`);
  if (!body.page?.hasNextPage) break;
}

const out = [];
for (const n of nodes) {
  const xl = (n.deployments ?? []).find((d) => d.network === "XLayer");
  if (!xl?.address) continue;
  const ticker = String(n.symbol || n.underlyingSymbol || "").replace(/x$/i, "");
  const wrap = xl.wrapperAddressV2 || null;
  out.push({
    id: ticker || n.symbol,
    name: (n.name || ticker).replace(/\s+xStock$/i, ""),
    symbol: ticker || n.symbol,
    xSymbol: n.symbol,
    address: (wrap || xl.address).toLowerCase(),
    underlying: wrap ? xl.address.toLowerCase() : null,
    logo: n.logo || null,
    kind: /ETF|index|500|nasdaq|qqq|spy/i.test(n.name || "") ? "etf" : "equity",
    halted: Boolean(n.isTradingHalted || n.trading?.isTradingHalted),
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
const unique = [];
const seenAddr = new Set();
const seenId = new Map();
for (const row of out) {
  if (seenAddr.has(row.address)) continue;
  seenAddr.add(row.address);
  const n = (seenId.get(row.id) ?? 0) + 1;
  seenId.set(row.id, n);
  if (n > 1) row.id = `${row.id}-${row.address.slice(2, 6)}`;
  unique.push(row);
}

const dest = join(__dirname, "..", "lib", "xstocks.json");
writeFileSync(dest, JSON.stringify(unique, null, 2));
console.log(`wrote ${unique.length} X Layer xStocks → lib/xstocks.json`);
