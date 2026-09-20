/** US cash session in America/New_York. xStocks still fill onchain 24/5. */
export function cashSession(now = new Date()): {
  open: boolean;
  label: string;
  ny: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;
  const weekend = wd === "Sat" || wd === "Sun";
  const open = !weekend && mins >= 9 * 60 + 30 && mins < 16 * 60;
  const ny = `${wd} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;
  if (weekend) return { open: false, label: "US cash session closed (weekend)", ny };
  if (open) return { open: true, label: "US cash session open", ny };
  return { open: false, label: "US cash session closed", ny };
}
