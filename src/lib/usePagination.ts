import { useEffect, useMemo, useState } from "react";

/** Every list in LSPay shows this many rows per page. */
export const PAGE_SIZE = 15;

export interface Pagination<T> {
  page: number;          // 0-based
  pageCount: number;
  pageItems: T[];
  total: number;
  from: number;          // 1-based index of the first row shown (0 when empty)
  to: number;
  setPage: (p: number) => void;
}

/**
 * Pages a list (15 per page). Goes back to page 1 whenever the list changes length or `resetKey` changes
 * (e.g. a filter or the selected school), and never points past the last page.
 */
export function usePagination<T>(items: T[], resetKey?: unknown, pageSize = PAGE_SIZE): Pagination<T> {
  const [page, setPageRaw] = useState(0);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { setPageRaw(0); }, [total, resetKey]);
  const cur = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => items.slice(cur * pageSize, (cur + 1) * pageSize), [items, cur, pageSize]);
  return {
    page: cur, pageCount, pageItems, total,
    from: total ? cur * pageSize + 1 : 0,
    to: Math.min((cur + 1) * pageSize, total),
    setPage: (p: number) => setPageRaw(Math.max(0, Math.min(p, pageCount - 1))),
  };
}
