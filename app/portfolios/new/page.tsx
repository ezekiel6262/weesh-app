import { Suspense } from "react";
import { PortfolioCreate } from "@/components/PortfolioCreate";

export default function NewPortfolioPage() {
  return <Suspense fallback={<p className="muted">Opening portfolio editor…</p>}><PortfolioCreate /></Suspense>;
}
