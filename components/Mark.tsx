import type { Asset } from "@/lib/catalog";

export function Mark({ asset, size = 36 }: { asset: Asset; size?: number }) {
  return (
    <span
      className="mark"
      style={{
        width: size,
        height: size,
        background: asset.tint,
        fontSize: Math.max(11, size * 0.36),
      }}
    >
      {asset.symbol.slice(0, 1)}
    </span>
  );
}
