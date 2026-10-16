/**
 * LSPay offline mode.
 *  - The signed-in person's data is kept on this device (IndexedDB), so LSPay opens with no internet.
 *  - Kiosk sales made offline wait here until "Sync now"; each carries a key so it is recorded exactly once
 *    (lspay_wallet_checkout_offline, migration 0134).
 * Signing out deletes the copy (waiting sales stay until they are synced by the same person).
 */
const DB = "lspay-offline";
const VERSION = 1;

export type OfflineSale = { key: string; userId: string; tenantId: string; studentId: string; studentName: string; amount: number; cost: number;
  items: { item_id: string; name: string; qty: number; amount: number }[]; at: string };
export type SaleProblem = { key: string; studentName: string; amount: number; at: string; error: string };

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no IndexedDB"));
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("copy");
      d.createObjectStore("sales", { keyPath: "key" });
      d.createObjectStore("problems", { keyPath: "key" });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const tx = db.transaction(store, mode); const req = fn(tx.objectStore(store));
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); tx.oncomplete = () => db.close();
  });
}

export const writeCopy = async (c: unknown) => { try { await run("copy", "readwrite", (s) => s.put(c, "last")); } catch (e) { console.warn("LSPay: offline copy not saved", e); } };
export const readCopy = async (): Promise<any | null> => { try { return (await run("copy", "readonly", (s) => s.get("last"))) ?? null; } catch { return null; } };
export const deleteCopy = async () => { try { await run("copy", "readwrite", (s) => s.delete("last")); } catch { /* none */ } };

export const addSale = (s: OfflineSale) => run("sales", "readwrite", (st) => st.put(s));
export const listSales = async (userId?: string | null): Promise<OfflineSale[]> => {
  try { const all = (await run("sales", "readonly", (s) => s.getAll())) as OfflineSale[]; return userId ? all.filter((x) => x.userId === userId) : all; } catch { return []; }
};
export const removeSale = (key: string) => run("sales", "readwrite", (s) => s.delete(key));
export const addProblem = (p: SaleProblem) => run("problems", "readwrite", (s) => s.put(p));
export const listProblems = async (): Promise<SaleProblem[]> => { try { return (await run("problems", "readonly", (s) => s.getAll())) as SaleProblem[]; } catch { return []; } };
export const clearProblems = () => run("problems", "readwrite", (s) => s.clear());

/** True when an error means "could not reach the server" rather than "the server said no". */
export const isNetError = (e: unknown) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = String((e as any)?.message ?? (e as any)?.details ?? e ?? "").toLowerCase();
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|err_internet|offline/.test(m);
};
export const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
export const DEFAULT_OFFLINE_CAP = 2000;
