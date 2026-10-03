import { useEffect, useMemo, useState } from "react";

/** Lists start at this many rows per page. */
export const PAGE_SIZE = 15;
/** The rows-per-page choices every list offers; 0 means "All". The last choice is remembered on this device. */
export const PAGE_SIZES = [15, 20, 40, 60, 0];
const KEY = "lspay.pageSize";

export interface Pagination<T> {
  page: number;          // 0-based
  pageCount: number;
  pageItems: T[];
  total: number;
  from: number;          // 1-based index of the first row shown (0 when empty)
  to: number;
  setPage: (p: number) => void;
  pageSize: number;      // 0 = all
  setPageSize: (n: number) => void;
}

function savedSize(fallback: number) {
  try { const raw = localStorage.getItem(KEY); const v = Number(raw); return raw !== null && PAGE_SIZES.includes(v) ? v : fallback; } catch { return fallback; }
}

/**
 * Pages a list. Goes back to page 1 whenever the list changes length, the page size changes or `resetKey` changes
 * (e.g. a filter or the selected school), and never points past the last page.
 */
export function usePagination<T>(items: T[], resetKey?: unknown, pageSize = PAGE_SIZE): Pagination<T> {
  const [page, setPageRaw] = useState(0);
  const [size, setSize] = useState(() => savedSize(pageSize));
  const total = items.length;
  const eff = size || total || 1;
  const pageCount = Math.max(1, Math.ceil(total / eff));
  useEffect(() => { setPageRaw(0); }, [total, resetKey, size]);
  const cur = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => items.slice(cur * eff, (cur + 1) * eff), [items, cur, eff]);
  return {
    page: cur, pageCount, pageItems, total,
    from: total ? cur * eff + 1 : 0,
    to: Math.min((cur + 1) * eff, total),
    setPage: (p: number) => setPageRaw(Math.max(0, Math.min(p, pageCount - 1))),
    pageSize: size,
    setPageSize: (n: number) => { setSize(n); try { localStorage.setItem(KEY, String(n)); } catch { /* private window */ } },
  };
}
