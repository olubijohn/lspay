import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One line of text that shrinks to fit its box instead of wrapping or spilling out (big amounts like
 * ₦1,006,970.00 in stat tiles and balance cards). It starts at the size its classes give it, shrinks down to
 * `min` of that, and only then cuts off with "…" (the full value stays in the tooltip).
 */
export function FitText({ children, className, min = 0.45, title }: { children: ReactNode; className?: string; min?: number; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let base = 0;
    const fit = () => {
      el.style.fontSize = "";
      base = parseFloat(getComputedStyle(el).fontSize) || base;
      if (!base || !el.clientWidth) return;
      const ratio = el.clientWidth / el.scrollWidth;
      if (ratio < 1) el.style.fontSize = `${Math.max(base * min, Math.floor(base * ratio * 0.97 * 10) / 10)}px`;
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [children, min]);
  return (
    <span ref={ref} title={title ?? (typeof children === "string" ? children : undefined)}
      className={cn("block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap", className)}>
      {children}
    </span>
  );
}
