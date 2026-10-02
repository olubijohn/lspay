// Date + time for every listed record (sales, top-ups, stock movements), e.g. "02 Oct 2026, 14:32".
// Uses the record's exact time when it has one (createdAt), otherwise just its date.
const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function when(r: { date?: string; createdAt?: string }): string {
  if (r.createdAt) {
    const d = new Date(r.createdAt);
    if (!isNaN(d.getTime())) return fmt.format(d);
  }
  if (r.date) {
    const d = new Date(`${r.date}T00:00:00`);
    if (!isNaN(d.getTime())) return fmtDay.format(d);
    return r.date;
  }
  return "";
}

/** Newest first, by exact time when known. */
export const byNewest = (a: { date?: string; createdAt?: string }, b: { date?: string; createdAt?: string }) =>
  (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "");
