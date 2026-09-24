"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectBar } from "./Connect";
import { GasCover } from "./GasCover";
import { HeaderSearch } from "./Search";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/earn", label: "Earn" },
  { href: "/strategy", label: "Strategy" },
  { href: "/send", label: "Send" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="shell">
      <GasCover />
      <header className="top">
        <Link href="/" className="brand">
          <span className="brand-mark">W</span>
          Weesh
        </Link>
        <nav className="top-nav">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                path === n.href || (n.href === "/markets" && path.startsWith("/s/")) || (n.href === "/send" && path.startsWith("/send")) ? "on" : ""
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <HeaderSearch />
        <ConnectBar compact />
      </header>
      <main>{children}</main>
      <footer className="foot">
        <span>Non-custodial. Weesh covers gas. 0.05% on trades. <Link href="/about">What’s an xStock?</Link></span>
        <span>X Layer · xStocks</span>
      </footer>
      <nav className="tabbar">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={
              path === n.href || (n.href === "/markets" && path.startsWith("/s/")) ? "on" : ""
            }
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
