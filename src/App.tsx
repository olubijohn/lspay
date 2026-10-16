import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { StoreProvider, useStore } from "./store";
import { SuperAdmin } from "./pages/SuperAdmin";
import { TenantConsole } from "./pages/TenantConsole";
import { ParentPortal } from "./pages/ParentPortal";
import { UnifiedLogin } from "./pages/auth/UnifiedLogin";
import { ThemeProvider } from "./theme";
import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

/** Offline mode, same as the other apps: big red-bordered banner; after typing on a page you can't leave it until
 *  the change is saved; back online with kiosk sales made offline, the whole app is locked behind "Sync now". */
const LEAVE_PAGE = "nav,aside,[role=tablist],[role=tab],a[href],[data-leave]";
function OfflineGate() {
  const { offline, dataAt, pendingSales, syncNow, saleProblems, clearSaleProblems, session, parentSession } = useStore();
  const [net, setNet] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [dirty, setDirty] = useState(false); const [nudge, setNudge] = useState(0); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const signedIn = !!session.user || !!parentSession; const isOff = signedIn && (offline || !net);
  useEffect(() => {
    const on = () => setNet(true), off = () => setNet(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    if (!isOff) { setDirty(false); return; }
    const typed = (e: Event) => { const t = e.target as HTMLElement; if (t?.matches?.("input,textarea,select") && !t.closest(".lp-offline") && (t as HTMLInputElement).type !== "search") setDirty(true); };
    document.addEventListener("input", typed, true); document.addEventListener("change", typed, true);
    return () => { document.removeEventListener("input", typed, true); document.removeEventListener("change", typed, true); };
  }, [isOff]);
  useEffect(() => { setDirty(false); }, [pendingSales]);   // a sale was saved on the device
  useEffect(() => {
    if (!(isOff && dirty)) return;
    const stop = (e: Event) => { const t = e.target as HTMLElement; if (t?.closest?.(LEAVE_PAGE) && !t.closest("[role=dialog],.lp-offline")) { e.preventDefault(); e.stopPropagation(); setNudge((n) => n + 1); } };
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("click", stop, true); window.addEventListener("beforeunload", unload);
    return () => { document.removeEventListener("click", stop, true); window.removeEventListener("beforeunload", unload); };
  }, [isOff, dirty]);
  const sync = async () => {
    setBusy(true); setErr("");
    const m = await syncNow(); setBusy(false);
    if (m) setErr(m); else { setDone(true); window.setTimeout(() => setDone(false), 6000); }
  };
  if (signedIn && net && pendingSales > 0) return (
    <div className="lp-gate" role="alertdialog" aria-modal="true"><div className="lp-card">
      <RefreshCw size={30} className={busy ? "lp-spin" : ""} /><h2>You're back online</h2>
      <p><b>{pendingSales} kiosk sale{pendingSales === 1 ? "" : "s"}</b> made while offline {pendingSales === 1 ? "is" : "are"} saved on this device but not yet on the server. Sync now before doing anything else, so wallets and stock are right.</p>
      <button type="button" className="lp-btn" disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync now"}</button>
      {err && <p className="lp-note err">{err}</p>}
    </div></div>
  );
  if (signedIn && saleProblems.length) return (
    <div className="lp-offline bad"><AlertTriangle size={20} />
      <div className="ob-text"><b>{saleProblems.length} offline sale{saleProblems.length === 1 ? "" : "s"} could not be recorded.</b>
        {saleProblems.map((p) => <span key={p.key} style={{ display: "block", fontSize: 13 }}>{p.studentName} · N{p.amount.toLocaleString()} · {new Date(p.at).toLocaleString()} · {p.error}</span>)}</div>
      <button type="button" onClick={clearSaleProblems}>Dismiss</button></div>
  );
  if (done) return <div className="lp-offline ok"><CheckCircle2 size={20} /><div className="ob-text"><b>Synced.</b> Every sale made offline is now recorded.</div></div>;
  if (!isOff) return null;
  const at = dataAt ? new Date(dataAt) : null;
  return (
    <div className={`lp-offline${dirty ? " dirty" : ""}`} role="status" key={nudge}>
      <WifiOff size={22} />
      <div className="ob-text"><b>You're offline.</b>{at ? ` Showing data loaded at ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : ""}
        <span> Kiosk sales still work, within each student's balance and the school's offline limit (no PIN needed). Top-ups and other changes need the internet.{pendingSales ? ` ${pendingSales} sale${pendingSales === 1 ? "" : "s"} waiting to sync.` : ""}</span>
        {dirty && <span className="ob-dirty"><AlertTriangle size={15} /> Finish and save what you're doing before leaving this page.</span>}</div>
      {dirty && <button type="button" onClick={() => setDirty(false)}>Discard and leave</button>}
    </div>
  );
}


const queryClient = new QueryClient();

function Router() {
  const { session, parentSession } = useStore();

  const isAuthenticated = session.portal !== null || parentSession !== null;

  const getPortalComponent = () => {
    if (session.portal === "super_admin") return <SuperAdmin />;
    if (session.portal === "tenant") return <TenantConsole />;
    if (parentSession) return <ParentPortal />;
    return <UnifiedLogin />;
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans transition-colors">
      <OfflineGate />
      <main className="flex-1">
        <Switch>
          <Route path="/">{getPortalComponent()}</Route>
          <Route path="/super-admin">{session.portal === "super_admin" ? <SuperAdmin /> : <UnifiedLogin />}</Route>
          <Route path="/tenant">{session.portal === "tenant" ? <TenantConsole /> : <UnifiedLogin />}</Route>
          <Route path="/parent">{parentSession ? <ParentPortal /> : <UnifiedLogin />}</Route>
          <Route><NotFound /></Route>
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <StoreProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </StoreProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
