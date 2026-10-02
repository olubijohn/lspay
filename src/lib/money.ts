// One money format for the whole app: ₦26,900.00 · −₦400.00 · +₦3,500.00 (sign before the symbol,
// thousands separators, two decimals, a real minus sign). Use these instead of `₦${n.toFixed(2)}`.

export const MINUS = "−";

const two = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

const safe = (n: unknown) => (typeof n === "number" && isFinite(n) ? n : Number(n) || 0);

/** ₦26,900.00 — negatives as −₦26,900.00. `decimals: 0` for whole-naira labels (₦500). */
export function naira(n: number, opts: { decimals?: 0 | 2 } = {}): string {
  const v = safe(n);
  const body = (opts.decimals === 0 ? whole : two).format(Math.abs(v));
  return `₦${body}`;   // no +/- signs anywhere: colour shows money in (green) vs out
}

/** Always shows a sign: +₦3,500.00 for money in, −₦400.00 for money out. */
export function nairaSigned(n: number): string {
  const v = safe(n);
  return `₦${two.format(Math.abs(v))}`;
}

/** Short chart-axis labels: ₦950, ₦9.5K, ₦1.2M. */
export function nairaAxis(n: number): string {
  const v = safe(n);
  return `₦${Math.abs(v) >= 1000 ? compact.format(Math.abs(v)) : whole.format(Math.abs(v))}`;
}
