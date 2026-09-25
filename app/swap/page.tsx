"use client";

import { Gate } from "@/components/Connect";
import { GetDollars } from "@/components/GetDollars";

export default function SwapPage() {
  return <Gate><div className="swap-page"><p className="kicker">Dollars</p><h1>Swap stablecoins</h1><p className="page-lede">Move between the dollar tokens used across Weesh without leaving the app.</p><GetDollars /></div></Gate>;
}
