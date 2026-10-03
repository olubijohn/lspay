import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePagination, PAGE_SIZES, type Pagination } from "@/lib/usePagination";
import { cn } from "@/lib/utils";

/**
 * The scrolling part of a list. Only this box scrolls (the page stays put): its height is capped to the
 * screen, table headers stick to its top, and it jumps back to the top when the page changes.
 * `offset` is roughly how much of the screen sits above and below the list on that page.
 */
export const ListScroll = forwardRef<HTMLDivElement, {
  children: ReactNode; className?: string; offset?: string; page?: number; minHeight?: string;
}>(function ListScroll({ children, className, offset = "22rem", page, minHeight = "14rem" }, ref) {
  const inner = useRef<HTMLDivElement | null>(null);
  useEffect(() => { inner.current?.scrollTo({ top: 0 }); }, [page]);
  return (
    <div
      ref={(el) => { inner.current = el; if (typeof ref === "function") ref(el); else if (ref) ref.current = el; }}
      className={cn("list-scroll overflow-auto overscroll-contain", className)}
      style={{ maxHeight: `max(${minHeight}, calc(100dvh - ${offset}))` }}
    >
      {children}
    </div>
  );
});

/**
 * Render-prop pagination for lists that live inside conditional JSX (where a hook can't be called):
 * <Paged items={rows}>{(p) => …p.pageItems… <PaginationBar p={p} />}</Paged>
 */
export function Paged<T>({ items, resetKey, children }: { items: T[]; resetKey?: unknown; children: (p: Pagination<T>) => ReactNode }) {
  const p = usePagination(items, resetKey);
  return <>{children(p)}</>;
}

/** Pages for a long list: compact numbers with ellipses, e.g. 1 … 4 5 6 … 48. */
function pageNumbers(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const set = new Set([0, count - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push("gap"); out.push(p); });
  return out;
}

/** "Showing 16–30 of 717" with Previous / page numbers / Next. */
export function PaginationBar({ p, label = "", className }: { p: Pagination<unknown>; label?: string; className?: string }) {
  if (p.total === 0) return null;
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold transition-colors disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground", className)} data-testid="pagination-bar">
      <span className="flex flex-wrap items-center gap-2">
        {p.total > PAGE_SIZES[0] && (
          <label className="flex items-center gap-1.5">Show
            <select className="h-8 rounded-md border border-border bg-card px-2 text-xs font-bold text-foreground" value={p.pageSize} onChange={(e) => p.setPageSize(Number(e.target.value))} aria-label="Rows per page" data-testid="select-page-size">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n || "All"}</option>)}
            </select>
          </label>
        )}
        <span>{p.pageSize ? <>Showing <b className="text-foreground">{p.from}–{p.to}</b> of </> : <>Showing all </>}<b className="text-foreground">{p.total.toLocaleString("en-NG")}</b>{label && ` ${label}`}</span>
      </span>
      {p.pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pages">
          <button type="button" className={cn(btn, "hover:bg-muted text-foreground")} onClick={() => p.setPage(p.page - 1)} disabled={p.page === 0} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline pr-1">Previous</span>
          </button>
          {pageNumbers(p.page, p.pageCount).map((n, i) => n === "gap"
            ? <span key={`g${i}`} className="px-1">…</span>
            : (
              <button key={n} type="button" onClick={() => p.setPage(n)} aria-current={n === p.page ? "page" : undefined}
                className={cn(btn, "hidden sm:inline-flex", n === p.page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                {n + 1}
              </button>
            ))}
          <span className="px-1 font-bold text-foreground sm:hidden">{p.page + 1} / {p.pageCount}</span>
          <button type="button" className={cn(btn, "hover:bg-muted text-foreground")} onClick={() => p.setPage(p.page + 1)} disabled={p.page >= p.pageCount - 1} aria-label="Next page">
            <span className="hidden sm:inline pl-1">Next</span><ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
