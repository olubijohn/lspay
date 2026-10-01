import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useStore } from "@/store";
import type { GuardianRelationship, LspayGuardianImportResult, LspayGuardianImportRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_GUARDIANS, downloadCsv, fileSlug, guardiansByStudent, relationshipLabel } from "@/lib/guardians";
import {
  ChildMatch, ParentEntry, buildPlan, detectColumns, emailProblem, findWarnings, parseDelimited,
} from "@/lib/parentImport";
import { cn } from "@/lib/utils";
import { ListScroll, PaginationBar } from "@/components/ui/paginated-list";
import { usePagination } from "@/lib/usePagination";

type Step = "upload" | "review" | "done";
type View = "attention" | "all";

/**
 * Import a school's parent list (parent name, email, gender, phone, linked children) and link every parent to
 * their children as LSPay guardians — father and mother each get their own login later. Nothing is saved until
 * "Import"; the review step shows exact matches, close matches to confirm, children not found and bad emails.
 */
export function ParentImportDialog({ open, onClose, tenantId, schoolName, onOpenReport }: {
  open: boolean; onClose: () => void; tenantId: string; schoolName: string; onOpenReport?: () => void;
}) {
  const { students, lspayGuardians, parentUsers, importLspayGuardians } = useStore();
  const [step, setStep] = useState<Step>("upload");
  const [entries, setEntries] = useState<ParentEntry[]>([]);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState("");
  const [view, setView] = useState<View>("attention");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<LspayGuardianImportResult | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const schoolStudents = useMemo(() => students.filter((s) => s.tenantId === tenantId), [students, tenantId]);
  const nameOf = useMemo(() => new Map(schoolStudents.map((s) => [s.id, s])), [schoolStudents]);
  const existing = useMemo(
    () => guardiansByStudent(schoolStudents, lspayGuardians.filter((g) => g.tenantId === tenantId), parentUsers.filter((p) => p.tenantId === tenantId)),
    [schoolStudents, lspayGuardians, parentUsers, tenantId],
  );

  const reset = () => { setStep("upload"); setEntries([]); setError(""); setPaste(""); setResult(null); setView("attention"); };
  const close = () => {
    if (saving) return;
    if (step === "review" && entries.length) { setConfirmDiscard(true); return; }
    reset(); onClose();
  };

  const load = (text: string) => {
    setError("");
    const rows = parseDelimited(text);
    const cols = detectColumns(rows);
    if (!cols) {
      setError("Could not find the columns. The first row must have headings, including an email column and a children column (e.g. \"Email Address\" and \"Linked children\").");
      return;
    }
    const plan = buildPlan(rows, cols.map, cols.headerRow, schoolStudents);
    if (!plan.length) { setError("No parents found under the headings."); return; }
    setEntries(plan); setStep("review");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (/\.(xlsx|xls|pdf)$/i.test(f.name)) {
      setError("Please save the list as CSV first (in Excel: File → Save As → CSV UTF-8), or copy the rows in Excel and paste them below.");
      return;
    }
    load(await f.text());
  };

  // ------------------------------ review state ------------------------------
  const updateEntry = (key: string, patch: Partial<ParentEntry>) => setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const pickChild = (entryKey: string, childKey: string, studentId: string | null) =>
    setEntries((prev) => prev.map((e) => e.key !== entryKey ? e : { ...e, children: e.children.map((c) => (c.key === childKey ? { ...c, studentId } : c)) }));
  const acceptAllClose = () =>
    setEntries((prev) => prev.map((e) => ({ ...e, children: e.children.map((c) => c.status === "close" && !c.studentId && c.candidates[0]?.score >= 0.75 ? { ...c, studentId: c.candidates[0].student.id } : c) })));

  const summary = useMemo(() => {
    let linked = 0, close = 0, notFound = 0, ambiguous = 0, badEmail = 0;
    const kids = new Set<string>();
    for (const e of entries) {
      const bad = !!emailProblem(e.email, e.originalEmail);
      if (bad) badEmail++;
      for (const c of e.children) {
        if (c.studentId) { if (!bad) { linked++; kids.add(c.studentId); } }
        else if (c.status === "close") close++;
        else if (c.status === "ambiguous") ambiguous++;
        else notFound++;
      }
    }
    return { parents: entries.length, linked, students: kids.size, close, ambiguous, notFound, badEmail };
  }, [entries]);

  const warnings = useMemo(
    () => findWarnings(entries, (sid) => (existing.get(sid) ?? []).map((g) => g.email), schoolStudents),
    [entries, existing, schoolStudents],
  );

  const needsAttention = (e: ParentEntry) => !!emailProblem(e.email, e.originalEmail) || e.children.length === 0 || e.children.some((c) => !c.studentId);
  const visible = view === "attention" ? entries.filter(needsAttention) : entries;
  const reviewPage = usePagination(visible, view);

  const importRows = (): LspayGuardianImportRow[] => entries
    .filter((e) => !emailProblem(e.email, e.originalEmail))
    .flatMap((e) => e.children.filter((c) => c.studentId).map((c) => ({
      studentId: c.studentId!, name: e.name, email: e.email.trim().toLowerCase(), phone: e.phone, relationship: e.relationship,
    })));

  const exportProblems = () => {
    const out: unknown[][] = [];
    for (const e of entries) {
      const problem = emailProblem(e.email, e.originalEmail);
      if (problem) out.push([e.rows.join(" "), e.name, e.originalEmail, e.phone, "", problem]);
      if (!e.children.length) out.push([e.rows.join(" "), e.name, e.originalEmail, e.phone, "", "No children listed"]);
      for (const c of e.children) if (!c.studentId) {
        out.push([e.rows.join(" "), e.name, e.originalEmail, e.phone, c.raw,
          c.status === "close" ? `Close match not confirmed (${c.candidates.map((x) => x.student.name).join(" / ")})`
          : c.status === "ambiguous" ? `More than one student called this (${c.candidates.map((x) => `${x.student.name} ${x.student.studentId}`).join(" / ")})`
          : "Child not found in the school"]);
      }
    }
    for (const w of warnings) out.push(["", "", "", "", "", w.message]);
    downloadCsv(`${fileSlug(schoolName)}-parents-not-linked`, ["Row(s)", "Parent", "Email", "Phone", "Child", "Problem"], out);
  };

  const runImport = async () => {
    setSaving(true); setError("");
    try {
      setResult(await importLspayGuardians(tenantId, importRows()));
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "The import failed. Nothing after the failed batch was saved; you can run it again safely.");
    } finally {
      setSaving(false);
    }
  };

  const withoutGuardian = schoolStudents.filter((s) => (existing.get(s.id) ?? []).length === 0);

  const exportResult = () => {
    if (!result) return;
    const rows: unknown[][] = result.skipped.map((x) => [nameOf.get(x.studentId)?.name ?? "", nameOf.get(x.studentId)?.studentId ?? "", x.email, x.reason]);
    for (const s of withoutGuardian) rows.push([s.name, s.studentId, "", "Student still has no guardian"]);
    downloadCsv(`${fileSlug(schoolName)}-import-follow-up`, ["Student", "Reg no", "Email", "Reason"], rows);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Import parents</DialogTitle>
            <DialogDescription>{schoolName} · each parent is linked to their children as an LSPay guardian (up to {MAX_GUARDIANS} per child). No logins are sent until you connect them.</DialogDescription>
          </DialogHeader>

          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-bold text-foreground">What the file needs</p>
                <p className="mt-1 text-muted-foreground">
                  A heading row with: <b>Parent's name</b>, <b>Email Address</b>, <b>Gender</b> (or Relationship), <b>Phone Number</b> and <b>Linked children</b>.
                  Children can be numbered in one cell ("1 BAKARE KHALEED 2 BAKARE NADINE"), one per line, or separated by ";".
                  Adding the reg no next to a child's name (e.g. "BAKARE NADINE – PG0612") makes matching exact. Other columns (occupation, S/N) are ignored.
                </p>
                <Button variant="outline" size="sm" className="mt-3 h-9 bg-card"
                  onClick={() => downloadCsv("parent-import-template", ["Parent's name", "Email Address", "Gender", "Phone Number", "Linked children"],
                    [["BAKARE SEYI", "parent@example.com", "MALE", "+2348000000000", "1 BAKARE KHALEED IREOLUWA\n2 BAKARE NADINE OREOLUWA"]])}>
                  <Download /> Download template (Excel)
                </Button>
              </div>

              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors hover:border-primary hover:bg-lilac/40">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <span className="font-bold text-foreground">Choose the parent list (CSV)</span>
                <span className="text-xs text-muted-foreground">From Excel: File → Save As → CSV UTF-8</span>
              </button>

              <div className="space-y-2">
                <p className="text-sm font-bold text-foreground">…or paste the rows copied from Excel (including the heading row)</p>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5}
                  className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  placeholder={"Parent's name\tEmail Address\tGender\tPhone Number\tLinked children"} />
                <Button onClick={() => load(paste)} disabled={!paste.trim()} className="h-10"><ClipboardPaste /> Read pasted rows</Button>
              </div>
              {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Tile label="Parents" value={summary.parents} />
                <Tile label="Parent–child links" value={summary.linked} tone="mint" hint={`${summary.students} different students`} />
                <Tile label="Close matches to confirm" value={summary.close} tone="peach" />
                <Tile label="Same-name students" value={summary.ambiguous} tone="peach" />
                <Tile label="Children not found" value={summary.notFound} tone="blush" />
                <Tile label="Email problems" value={summary.badEmail} tone="blush" />
              </div>

              {warnings.length > 0 && (
                <details className="rounded-2xl border border-amber-500 bg-peach/60 p-3 text-sm" open={warnings.length <= 6}>
                  <summary className="cursor-pointer font-bold text-amber-700"><AlertTriangle className="mr-1 inline h-4 w-4" /> {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check (nothing is changed automatically)</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-700">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
                </details>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex rounded-full border border-border bg-background p-1">
                  {(["attention", "all"] as View[]).map((v) => (
                    <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                      className={cn("h-8 rounded-full px-3 text-xs font-bold", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                      {v === "attention" ? `Needs attention (${entries.filter(needsAttention).length})` : `All parents (${entries.length})`}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.close > 0 && <Button variant="outline" size="sm" className="h-9" onClick={acceptAllClose}><CheckCircle2 /> Accept strong close matches</Button>}
                  <Button variant="outline" size="sm" className="h-9" onClick={exportProblems}><Download /> Export what can't be linked</Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border">
              <ListScroll page={reviewPage.page} offset="30rem" className="space-y-2 p-2">
                {reviewPage.pageItems.map((e) => (
                  <ParentCard key={e.key} entry={e} nameOf={nameOf}
                    onEmail={(email) => updateEntry(e.key, { email: email.trim().toLowerCase(), originalEmail: email.trim() })}
                    onRelationship={(relationship) => updateEntry(e.key, { relationship })}
                    onPick={(childKey, sid) => pickChild(e.key, childKey, sid)} />
                ))}
                {visible.length === 0 && <p className="rounded-2xl bg-mint p-4 text-center text-sm font-semibold text-green-700">Everything matched. Nothing needs attention.</p>}
              </ListScroll>
              <PaginationBar p={reviewPage} label="parents" />
              </div>

              {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
              <div className="sticky bottom-0 -mx-6 flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={reset} disabled={saving}>Start again</Button>
                <Button onClick={runImport} disabled={saving || summary.linked === 0} className="h-11" data-testid="btn-run-parent-import">
                  {saving ? <Loader2 className="animate-spin" /> : <Upload />}
                  {saving ? "Importing…" : `Link ${summary.linked} child${summary.linked === 1 ? "" : "ren"} to their parents`}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-mint p-4">
                <p className="font-display text-xl text-green-700"><CheckCircle2 className="mr-1 inline h-5 w-5" /> Import finished</p>
                <ul className="mt-2 space-y-0.5 text-sm text-green-700">
                  <li><b>{result.added}</b> guardian links added</li>
                  {result.updated > 0 && <li><b>{result.updated}</b> existing guardians updated</li>}
                  {result.alreadyOnRecord > 0 && <li><b>{result.alreadyOnRecord}</b> already the guardian on the student record (no change)</li>}
                  {result.skipped.length > 0 && <li className="text-amber-700"><b>{result.skipped.length}</b> skipped (see the export)</li>}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Tile label="Students in school" value={schoolStudents.length} />
                <Tile label="Now have a guardian" value={schoolStudents.length - withoutGuardian.length} tone="mint" />
                <Tile label="Still no guardian" value={withoutGuardian.length} tone={withoutGuardian.length ? "blush" : undefined} />
              </div>
              <p className="text-sm text-muted-foreground">
                Parents can't sign in yet. Open the Guardians report and use <b>Connect</b> to create their LSPay logins and email them, for everyone at once or class by class.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={exportResult} className="h-10"><Download /> Export follow-up list (Excel)</Button>
                {onOpenReport && <Button onClick={() => { reset(); onClose(); onOpenReport(); }} className="h-10">Open guardians report</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Discard this import?</DialogTitle>
            <DialogDescription>Nothing has been saved yet. Your review and any fixes will be lost.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDiscard(false)} className="h-10">Keep reviewing</Button>
            <Button onClick={() => { setConfirmDiscard(false); reset(); onClose(); }} className="h-10 bg-red-600 text-white hover:bg-red-700">Discard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Tile({ label, value, tone, hint }: { label: string; value: number; tone?: "mint" | "peach" | "blush"; hint?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border p-3", tone === "mint" ? "bg-mint" : tone === "peach" ? "bg-peach" : tone === "blush" ? "bg-blush" : "bg-card")}>
      <div className="font-display text-2xl text-foreground">{value}</div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ParentCard({ entry: e, nameOf, onEmail, onRelationship, onPick }: {
  entry: ParentEntry; nameOf: Map<string, { name: string; studentId: string; className: string }>;
  onEmail: (email: string) => void; onRelationship: (r: GuardianRelationship) => void; onPick: (childKey: string, studentId: string | null) => void;
}) {
  const problem = emailProblem(e.email, e.originalEmail);
  return (
    <div className={cn("rounded-2xl border bg-card p-3", problem ? "border-red-300" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-foreground">{e.name}</div>
          <div className="text-xs text-muted-foreground">Row {e.rows.join(", ")}{e.phone && <> · {e.phone}</>}</div>
        </div>
        <select value={e.relationship} onChange={(ev) => onRelationship(ev.target.value as GuardianRelationship)}
          className="h-8 rounded-full border border-border bg-background px-3 text-xs font-bold text-foreground">
          {(["father", "mother", "guardian"] as GuardianRelationship[]).map((r) => <option key={r} value={r}>{relationshipLabel(r)}</option>)}
        </select>
      </div>
      <div className="mt-2">
        <Input defaultValue={e.originalEmail} onBlur={(ev) => ev.target.value.trim() !== e.originalEmail && onEmail(ev.target.value)}
          className={cn("h-9 font-mono text-xs", problem && "border-red-400 bg-blush/50")} aria-label={`Email for ${e.name}`} />
        {problem && <p className="mt-1 text-xs font-semibold text-red-700">{problem}. Fix it here, or this parent is skipped.</p>}
      </div>
      <ul className="mt-2 space-y-1.5">
        {e.children.length === 0 && <li className="text-xs font-semibold text-red-700">No children listed for this parent.</li>}
        {e.children.map((c) => <ChildRow key={c.key} c={c} nameOf={nameOf} onPick={(sid) => onPick(c.key, sid)} />)}
      </ul>
    </div>
  );
}

function ChildRow({ c, nameOf, onPick }: { c: ChildMatch; nameOf: Map<string, { name: string; studentId: string; className: string }>; onPick: (studentId: string | null) => void }) {
  const chosen = c.studentId ? nameOf.get(c.studentId) : undefined;
  if (c.status === "exact" && chosen) {
    return (
      <li className="flex flex-wrap items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="font-semibold text-foreground">{chosen.name}</span>
        <span className="text-xs text-muted-foreground">{chosen.studentId} · {chosen.className || "No class"}</span>
      </li>
    );
  }
  if (c.status === "none") {
    return (
      <li className="flex flex-wrap items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <span className="text-foreground">{c.raw}</span>
        <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-extrabold text-red-700">Not found in the school</span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <AlertTriangle className={cn("h-4 w-4", c.studentId ? "text-green-600" : "text-amber-600")} />
      <span className="text-foreground">"{c.raw}"</span>
      <span className="text-xs text-muted-foreground">{c.status === "ambiguous" ? "more than one student has this name:" : "did you mean:"}</span>
      <select value={c.studentId ?? ""} onChange={(ev) => onPick(ev.target.value || null)}
        className={cn("h-8 max-w-full rounded-full border px-3 text-xs font-bold", c.studentId ? "border-green-500 bg-mint text-green-700" : "border-amber-500 bg-peach text-amber-700")}>
        <option value="">Don't link</option>
        {c.candidates.map(({ student, score }) => (
          <option key={student.id} value={student.id}>
            {student.name} · {student.studentId} · {student.className || "No class"}{c.status === "close" ? ` (${Math.round(score * 100)}%)` : ""}
          </option>
        ))}
      </select>
    </li>
  );
}
