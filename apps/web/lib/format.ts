// Indian-format money + percent helpers (mirror of the design's fmt/pct).

/** Format a number as ₹ with Indian digit grouping. e.g. 138600 -> "₹1,38,600". */
export function fmt(n: number, signed = false): string {
  const neg = n < 0;
  const x = Math.abs(Math.round(n));
  let s = String(x);
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    s = rest + "," + last3;
  }
  const sign = neg ? "−" : signed ? "+" : "";
  return sign + "₹" + s;
}

/** Signed percentage with a unicode minus. e.g. 9.8 -> "+9.8%". */
export function pct(n: number): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1) + "%";
}

/** mm:ss from seconds. */
export function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export function clockNow(): string {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
