import type { Transaction } from "./types";

// Transactions carry their items as text: kiosk sales look like "Jollof rice x1, Zobo x2"; wallet ledger rows look
// like "Wallet Top-up: note (ref)" or "Kiosk Purchase". These helpers turn that into item names to filter by.

const LEDGER_LABELS: [RegExp, string][] = [
  [/^wallet top-?up/i, "Wallet top-up"],
  [/^kiosk purchase/i, "Kiosk purchase"],
  [/^refund/i, "Refund"],
  [/^adjustment/i, "Adjustment"],
];

/** Item names in one transaction, without quantities. */
export function txItemNames(itemsString: string): string[] {
  const text = (itemsString ?? "").trim();
  if (!text) return [];
  for (const [re, label] of LEDGER_LABELS) if (re.test(text)) return [label];
  return text
    .split(/,\s*/)
    .map(p => p.replace(/\s+x\d+\s*$/i, "").trim())
    .filter(Boolean);
}

/** Sorted, de-duplicated item names across transactions, for the item filter. */
export function collectItemOptions(txs: Transaction[]): string[] {
  const set = new Map<string, string>();
  for (const t of txs) for (const n of txItemNames(t.itemsString)) {
    const k = n.toLowerCase();
    if (!set.has(k)) set.set(k, n);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

/** Student search: matches the student's name or registration number. */
export function matchesStudent(tx: Transaction, query: string, regNo?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return tx.studentName.toLowerCase().includes(q) || (regNo ?? "").toLowerCase().includes(q);
}

export function matchesItem(tx: Transaction, item: string): boolean {
  if (!item || item === "all") return true;
  const k = item.toLowerCase();
  return txItemNames(tx.itemsString).some(n => n.toLowerCase() === k);
}
