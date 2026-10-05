import { useEffect, type RefObject } from "react";

/*
 * Fixed screens: the header, menu and page frame never scroll. The page area fills the space under the
 * header, and its lists (tables, card grids, ListScroll boxes) are shortened just enough to fit and scroll
 * inside themselves, biggest list first. A page with no list that is still taller than the screen scrolls
 * inside the page area. Same behaviour as LSA's FitScroll.
 */
const NAMED = ".list-scroll,[data-fit-list]";
const MIN = 180;

function fitScreen(host: HTMLElement) {
  if (!host.isConnected || window.matchMedia("print").matches) return;
  const skip = (el: Element) => (el as HTMLElement).offsetParent === null || !!el.closest("[role=dialog],[data-radix-popper-content-wrapper],.no-fit");
  host.querySelectorAll<HTMLElement>(".fit-list").forEach((el) => { el.style.maxHeight = ""; el.style.overflowY = ""; el.classList.remove("fit-list"); });
  const named = [...host.querySelectorAll<HTMLElement>(NAMED)].filter((el) => !skip(el) && !el.parentElement?.closest(NAMED));
  // any other block of five or more look-alike items (cards, rows) counts as a list too; forms do not, their parts differ
  const sig = (c: Element) => c.tagName + "." + String(c.className).split(" ")[0];
  const auto = [...host.querySelectorAll<HTMLElement>("div,ul,ol,section")].filter((el) => {
    if (skip(el) || el.closest(NAMED) || el.querySelector(NAMED) || el.children.length < 5) return false;
    const kids = [...el.children]; const counts: Record<string, number> = {};
    kids.forEach((k) => { counts[sig(k)] = (counts[sig(k)] || 0) + 1; });
    return Math.max(...Object.values(counts)) / kids.length >= 0.8 && !kids.some((k) => /^(INPUT|SELECT|TEXTAREA|LABEL|BUTTON)$/.test(k.tagName));
  }).filter((el, _i, arr) => !arr.some((o) => o !== el && o.contains(el)));
  const lists = [...named, ...auto];
  host.style.height = "";
  const r = host.getBoundingClientRect();
  const below = Math.max(0, document.documentElement.scrollHeight - (r.bottom + window.scrollY));
  host.style.height = Math.max(240, Math.floor(window.innerHeight - Math.max(r.top, 0) - below)) + "px";
  let over = host.scrollHeight - host.clientHeight;
  if (over > 0) lists.map((el) => ({ el, h: el.getBoundingClientRect().height })).filter((x) => x.h > MIN).sort((a, b) => b.h - a.h).forEach(({ el, h }) => {
    if (over <= 0) return; const cut = Math.min(h - MIN, over); el.style.maxHeight = Math.floor(h - cut) + "px"; el.style.overflowY = "auto"; el.classList.add("fit-list"); over -= cut;
  });
}

/** Keeps `ref`'s element sized to the screen and its lists scrolling inside it. `resetKey` (e.g. the open tab) scrolls it back to the top. */
export function useFitScreen(ref: RefObject<HTMLElement | null>, resetKey?: unknown) {
  useEffect(() => {
    const host = ref.current; if (!host) return; let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fitScreen(host)); };
    document.documentElement.classList.add("fit-lock"); run();
    const mo = new MutationObserver(run); mo.observe(host, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", run); const t = setTimeout(run, 400);
    return () => { mo.disconnect(); window.removeEventListener("resize", run); cancelAnimationFrame(raf); clearTimeout(t); document.documentElement.classList.remove("fit-lock"); };
  }, [ref.current]);   // re-attach when the element appears (pages that render it only after loading)
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [ref, resetKey]);
}
