"use client";

import { useParams } from "next/navigation";
import { PortfolioDetail } from "@/components/PortfolioDetail";

export default function PublicPortfolioPage() {
  const params = useParams<{ id: string }>();
  return <PortfolioDetail id={params.id} />;
}
