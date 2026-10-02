import { useMemo, useState } from "react";
import { Ban, CheckCircle2, ClipboardList, Download, Loader2 } from "lucide-react";
import { useStore } from "@/store";
import type { PrintStatus, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { indexStudents, matchChild, type ChildMatch } from "@/lib/parentImport";
import { downloadCsv, fileSlug } from "@/lib/guardians";
import { cn } from "@/lib/utils";

// ------------------------------ filter ------------------------------
export type PrintFilter = "all" | "ready" | "not_ready" | "unchecked";
export const PRINT_FILTER_OPTIONS: { value: PrintFilter; label: string }[] = [
  { value: "all", label: "All card print statuses" },
  { value: "ready", label: "Ready to print" },
  { value: "not_ready", label: "Not ready (don't print)" },
  { value: "unchecked", label: "Not checked yet" },
];
export const matchesPrintFilter = (s: Student, f: PrintFilter) =>
  f === "all" || (f === "unchecked" ? !s.printStatus : s.printStatus === f);
export const printStatusLabel = (st: PrintStatus | undefined) => (st === "ready" ? "Ready" : st === "not_ready" ? "Not ready" : "Not checked");

// ------------------------------ row buttons ------------------------------
/** "Ready" / "Not ready" toggles for one student. Clicking the active one again clears it. */
export function PrintStatusButtons({ student, className }: { student: Student; className?: string }) {
  const { setPrintStatus } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = async (st: Exclude<PrintStatus, null>) => {
    setBusy(true); setError("");
    const r = await setPrintStatus([student.id], student.printStatus === st ? null : st);
    setBusy(false);
    if (!r.success) setError(r.message ?? "Not saved. Please try again.");
  };
  const base = "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-extrabold transition-colors disabled:opacity-60";
  return (
    <div className={cn("flex items-center gap-1", className)} title={student.printStatusBy ? `${printStatusLabel(student.printStatus)} · ${student.printStatusBy}` : undefined}>
      <button type="button" disabled={busy} onClick={() => set("ready")} aria-pressed={student.printStatus === "ready"}
        className={cn(base, student.printStatus === "ready" ? "border-green-600 bg-green-600 text-white" : "border-border bg-background text-muted-foreground hover:border-green-600 hover:text-green-700")}
        data-testid={`btn-ready-${student.id}`}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
      </button>
      <button type="button" disabled={busy} onClick={() => set("not_ready")} aria-pressed={student.printStatus === "not_ready"}
        className={cn(base, student.printStatus === "not_ready" ? "border-red-600 bg-red-600 text-white" : "border-border bg-background text-muted-foreground hover:border-red-500 hover:text-red-600")}
        data-testid={`btn-not-ready-${student.id}`}>
        <Ban className="h-3.5 w-3.5" /> Not ready
      </button>
      {error && <span className="ml-1 text-[10px] font-bold text-red-700" role="alert">{error}</span>}
    </div>
  );
}

/** Small read-only pill (e.g. in the Super Admin Card Registry). */
export function PrintStatusPill({ status }: { status?: PrintStatus }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold",
      status === "ready" ? "bg-mint text-green-700" : status === "not_ready" ? "bg-blush text-red-700" : "bg-muted text-muted-foreground")}>
      {status === "ready" ? "Ready to print" : status === "not_ready" ? "Not ready" : "Not checked"}
    </span>
  );
}

// ------------------------------ compare with the school's own list ------------------------------
const cleanLine = (l: string) => l.replace(/^\s*\d{1,4}\s*[.)-]?\s+/, "").replace(/\s+/g, " ").trim();

/**
 * Paste the school's real list (names or reg numbers, one per line, straight from Excel) and compare it with
 * `students` (the whole school, or the classes currently filtered). Matched students can be marked Ready, and
 * everyone in that group who is NOT on the list can be marked Not ready in the same step.
 */
export function PrintListMatchDialog({ open, onClose, students, scopeLabel, schoolName }: {
  open: boolean; onClose: () => void; students: Student[]; scopeLabel: string; schoolName: string;
}) {
  const { setPrintStatus } = useStore();
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<ChildMatch[] | null>(null);
  const [markMatched, setMarkMatched] = useState(true);
  const [markOthers, setMarkOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ready: number; notReady: number } | null>(null);
  const [error, setError] = useState("");

  const reset = () => { setText(""); setMatches(null); setDone(null); setError(""); setMarkMatched(true); setMarkOthers(true); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const check = () => {
    const lines = text.split(/\r?\n/).map(cleanLine).filter((l) => /[A-Za-z0-9]{2,}/.test(l));
    if (!lines.length) { setError("Paste at least one name or reg number."); return; }
    const idx = indexStudents(students);
    setMatches(lines.map((l, i) => matchChild(l, idx, `l${i}`)));
    setError("");
  };
  const pick = (key: string, studentId: string | null) => setMatches((m) => m && m.map((x) => (x.key === key ? { ...x, studentId } : x)));

  const matchedIds = useMemo(() => new Set((matches ?? []).map((m) => m.studentId).filter(Boolean) as string[]), [matches]);
  const notOnList = useMemo(() => students.filter((s) => !matchedIds.has(s.id)), [students, matchedIds]);
  const counts = useMemo(() => {
    const m = matches ?? [];
    return {
      exact: m.filter((x) => x.status === "exact").length,
      toConfirm: m.filter((x) => (x.status === "close" || x.status === "ambiguous") && !x.studentId).length,
      notFound: m.filter((x) => x.status === "none").length,
    };
  }, [matches]);

  const apply = async () => {
    setBusy(true); setError("");
    let ready = 0, notReady = 0;
    if (markMatched && matchedIds.size) {
      const r = await setPrintStatus([...matchedIds], "ready");
      if (!r.success) { setBusy(false); setError(r.message ?? "Could not save."); return; }
      ready = matchedIds.size;
    }
    if (markOthers && notOnList.length) {
      const r = await setPrintStatus(notOnList.map((s) => s.id), "not_ready");
      if (!r.success) { setBusy(false); setError(r.message ?? "Could not save."); return; }
      notReady = notOnList.length;
    }
    setBusy(false);
    setDone({ ready, notReady });
  };

  const exportResult = () => {
    const rows: unknown[][] = [];
    for (const m of matches ?? []) if (!m.studentId) rows.push(["On your list, not found in LSPay", m.raw, "", ""]);
    for (const s of notOnList) rows.push(["In LSPay, not on your list", s.name, s.studentId, s.className]);
    downloadCsv(`${fileSlug(schoolName)}-card-list-check`, ["Result", "Name", "Reg no", "Class"], rows);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">Check against my list</DialogTitle>
          <DialogDescription>
            Comparing with <b>{students.length}</b> students ({scopeLabel}). Nothing is deleted. Students marked Not ready are simply left out of card printing.
          </DialogDescription>
        </DialogHeader>

        {!matches && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste your list: one student per line, names or reg numbers (or both). You can copy a column straight from Excel.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} autoFocus
              className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder={"N0586\nOluwatobi Abimbola\nAmansa Ikape-James Ogonye\n…"} />
            {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex justify-end"><Button onClick={check} className="h-10"><ClipboardList /> Check list</Button></div>
          </div>
        )}

        {matches && !done && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="On your list and found" value={matchedIds.size} tone="mint" />
              <Tile label="Close matches to confirm" value={counts.toConfirm} tone="peach" />
              <Tile label="On your list, not found" value={counts.notFound} tone="blush" />
              <Tile label="In LSPay, not on your list" value={notOnList.length} tone="lilac" />
            </div>

            {(matches.some((m) => m.status === "close" || m.status === "ambiguous")) && (
              <div className="space-y-1.5 rounded-2xl border border-border p-3">
                <p className="text-sm font-extrabold text-foreground">Confirm these</p>
                {matches.filter((m) => m.status === "close" || m.status === "ambiguous").map((m) => (
                  <div key={m.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-foreground">"{m.raw}"</span>
                    <select value={m.studentId ?? ""} onChange={(e) => pick(m.key, e.target.value || null)}
                      className={cn("h-8 max-w-full rounded-full border px-3 text-xs font-bold", m.studentId ? "border-green-500 bg-mint text-green-700" : "border-amber-500 bg-peach text-amber-700")}>
                      <option value="">Not this student</option>
                      {m.candidates.map(({ student, score }) => (
                        <option key={student.id} value={student.id}>{student.name} · {student.studentId} · {student.className || "No class"}{m.status === "close" ? ` (${Math.round(score * 100)}%)` : ""}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {counts.notFound > 0 && (
              <details className="rounded-2xl border border-border p-3 text-sm">
                <summary className="cursor-pointer font-extrabold text-foreground">{counts.notFound} line{counts.notFound === 1 ? "" : "s"} from your list not found in LSPay</summary>
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-muted-foreground">{matches.filter((m) => m.status === "none").map((m) => <li key={m.key}>{m.raw}</li>)}</ul>
              </details>
            )}

            <div className="space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
              <label className="flex items-start gap-2.5 font-semibold text-foreground">
                <input type="checkbox" className="mt-1" checked={markMatched} onChange={(e) => setMarkMatched(e.target.checked)} />
                <span>Mark the <b>{matchedIds.size}</b> students on your list as <b className="text-green-700">Ready</b></span>
              </label>
              <label className="flex items-start gap-2.5 font-semibold text-foreground">
                <input type="checkbox" className="mt-1" checked={markOthers} onChange={(e) => setMarkOthers(e.target.checked)} />
                <span>Mark the other <b>{notOnList.length}</b> students ({scopeLabel}) as <b className="text-red-700">Not ready</b>, so their cards are not printed</span>
              </label>
            </div>

            {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMatches(null)} disabled={busy}>Back to list</Button>
                <Button variant="outline" onClick={exportResult} disabled={busy}><Download /> Export differences (Excel)</Button>
              </div>
              <Button onClick={apply} disabled={busy || (!markMatched && !markOthers)} className="h-10">
                {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Save
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-mint p-4 text-sm text-green-700">
              <p className="font-display text-xl"><CheckCircle2 className="mr-1 inline h-5 w-5" /> Saved</p>
              {done.ready > 0 && <p><b>{done.ready}</b> students marked Ready.</p>}
              {done.notReady > 0 && <p><b>{done.notReady}</b> students marked Not ready. Their cards won't be included in bulk printing.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={exportResult}><Download /> Export differences (Excel)</Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "mint" | "peach" | "blush" | "lilac" }) {
  return (
    <div className={cn("rounded-2xl border border-border p-3", tone === "mint" ? "bg-mint" : tone === "peach" ? "bg-peach" : tone === "blush" ? "bg-blush" : "bg-lilac")}>
      <div className="font-display text-2xl text-foreground">{value}</div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
    </div>
  );
}
