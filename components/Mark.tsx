import Image from "next/image";
import type { Asset } from "@/lib/catalog";
import { getRow } from "@/lib/xstock";

export function Mark({ asset, size = 36 }: { asset: Asset; size?: number }) {
  const logo = asset.logo || getRow(asset.id.replace(/-x$/, ""))?.logo;
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
      {logo ? <Image src={logo} alt="" width={size} height={size} sizes={`${size}px`} /> : asset.symbol.slice(0, 1)}
    </span>
  );
}
