import { useMemo, useState } from "react";
import { Download, Link2, Loader2, Search, Users } from "lucide-react";
import { useStore } from "@/store";
import type { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClassMultiSelect } from "@/components/ClassMultiSelect";
import { ListScroll, PaginationBar } from "@/components/ui/paginated-list";
import { usePagination } from "@/lib/usePagination";
import {
  MAX_GUARDIANS, StudentGuardian, downloadCsv, fileSlug, guardiansByStudent, loginStatusLabel, relationshipLabel,
} from "@/lib/guardians";
import { cn } from "@/lib/utils";

type CountFilter = "all" | "none" | "one" | "multi" | "full";
type LoginFilter = "all" | "any_connected" | "none_connected" | "awaiting" | "has_unconnected";

const COUNT_OPTIONS: { value: CountFilter; label: string }[] = [
  { value: "all", label: "Any number of guardians" },
  { value: "none", label: "No guardian" },
  { value: "one", label: "1 guardian" },
  { value: "multi", label: "More than one guardian" },
  { value: "full", label: `${MAX_GUARDIANS} guardians (full)` },
];
const LOGIN_OPTIONS: { value: LoginFilter; label: string }[] = [
  { value: "all", label: "Any LSPay status" },
  { value: "any_connected", label: "At least one parent connected" },
  { value: "none_connected", label: "No parent connected" },
  { value: "awaiting", label: "Awaiting first sign-in" },
  { value: "has_unconnected", label: "Has a guardian not connected" },
];

const classOf = (s: Student) => s.className?.trim() || "No class";

function matchesCount(n: number, f: CountFilter) {
  return f === "all" || (f === "none" && n === 0) || (f === "one" && n === 1) || (f === "multi" && n > 1) || (f === "full" && n >= MAX_GUARDIANS);
}
function matchesLogin(gs: StudentGuardian[], f: LoginFilter) {
  if (f === "all") return true;
  const connected = gs.filter((g) => g.status !== "not_connected").length;
  if (f === "any_connected") return connected > 0;
  if (f === "none_connected") return connected === 0;
  if (f === "awaiting") return gs.some((g) => g.status === "awaiting");
  return gs.some((g) => g.status === "not_connected");
}

/** Guardians report for one school: who has 0 / 1 / several guardians, who is connected, with Excel (CSV) export. */
export function GuardianReport({ tenantId, schoolName }: { tenantId: string; schoolName: string }) {
  const { students, lspayGuardians, parentUsers, connectLspayParent, refreshLspayParents } = useStore();
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const [loginFilter, setLoginFilter] = useState<LoginFilter>("all");
  const [bulkOpen, setBulkOpen] = useState(false);

  const schoolStudents = useMemo(() => students.filter((s) => s.tenantId === tenantId), [students, tenantId]);
  const guardianMap = useMemo(
    () => guardiansByStudent(schoolStudents, lspayGuardians.filter((g) => g.tenantId === tenantId), parentUsers.filter((p) => p.tenantId === tenantId)),
    [schoolStudents, lspayGuardians, parentUsers, tenantId],
  );
  const gOf = (s: Student) => guardianMap.get(s.id) ?? [];

  const stats = useMemo(() => {
    let none = 0, one = 0, multi = 0, connected = 0;
    for (const s of schoolStudents) {
      const gs = guardianMap.get(s.id) ?? [];
      if (gs.length === 0) none++; else if (gs.length === 1) one++; else multi++;
      if (gs.some((g) => g.status !== "not_connected")) connected++;
    }
    return { total: schoolStudents.length, none, one, multi, connected, unconnected: schoolStudents.length - connected };
  }, [schoolStudents, guardianMap]);

  const classOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of schoolStudents) counts.set(classOf(s), (counts.get(classOf(s)) ?? 0) + 1);
    return [...counts].map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: "base" }));
  }, [schoolStudents]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schoolStudents
      .filter((s) => {
        const gs = guardianMap.get(s.id) ?? [];
        if (classes.length && !classes.includes(classOf(s))) return false;
        if (!matchesCount(gs.length, countFilter) || !matchesLogin(gs, loginFilter)) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.studentId.toLowerCase().includes(q)
            && !gs.some((g) => g.email.includes(q) || g.name.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => classOf(a).localeCompare(classOf(b), undefined, { numeric: true }) || a.name.localeCompare(b.name));
  }, [schoolStudents, guardianMap, classes, countFilter, loginFilter, query]);

  const reportPage = usePagination(rows, `${query}|${classes.join(",")}|${countFilter}|${loginFilter}`);
  const filtersOn = query || classes.length || countFilter !== "all" || loginFilter !== "all";
  const unconnectedInView = rows.flatMap((s) => gOf(s).filter((g) => g.status === "not_connected").map((g) => ({ s, g })));

  const exportRows = (list: Student[], label: string) => {
    const header = ["Student", "Reg no", "Class", "Guardians", "Parents connected"];
    for (let i = 1; i <= MAX_GUARDIANS; i++) header.push(`Guardian ${i} name`, `Guardian ${i} relationship`, `Guardian ${i} email`, `Guardian ${i} phone`, `Guardian ${i} LSPay`);
    const data = list.map((s) => {
      const gs = gOf(s);
      const r: unknown[] = [s.name, s.studentId, classOf(s), gs.length, gs.filter((g) => g.status !== "not_connected").length];
      for (let i = 0; i < MAX_GUARDIANS; i++) {
        const g = gs[i];
        r.push(g?.name ?? "", g ? relationshipLabel(g.relationship) : "", g?.email ?? "", g?.phone ?? "", g ? loginStatusLabel(g.status) : "");
      }
      return r;
    });
    downloadCsv(`${fileSlug(schoolName)}-${label}-${new Date().toISOString().slice(0, 10)}`, header, data);
  };

  const quickExport = (f: CountFilter, label: string) =>
    exportRows(schoolStudents.filter((s) => matchesCount(gOf(s).length, f)), label);

  return (
    <div className="space-y-4" data-testid="guardian-report">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Students" value={stats.total} />
        <Stat label="No guardian" value={stats.none} tone="coral" onClick={() => { setCountFilter("none"); setLoginFilter("all"); }} />
        <Stat label="1 guardian" value={stats.one} onClick={() => { setCountFilter("one"); setLoginFilter("all"); }} />
        <Stat label="More than one" value={stats.multi} tone="lilac" onClick={() => { setCountFilter("multi"); setLoginFilter("all"); }} />
        <Stat label="Parent connected" value={stats.connected} tone="mint" onClick={() => { setCountFilter("all"); setLoginFilter("any_connected"); }} />
        <Stat label="No parent connected" value={stats.unconnected} tone="peach" onClick={() => { setCountFilter("all"); setLoginFilter("none_connected"); }} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student, reg no, parent or email" className="h-9 pl-9" />
        </div>
        <ClassMultiSelect options={classOptions} selected={classes} onChange={setClasses} />
        <Select value={countFilter} onValueChange={(v) => setCountFilter(v as CountFilter)}>
          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{COUNT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={loginFilter} onValueChange={(v) => setLoginFilter(v as LoginFilter)}>
          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{LOGIN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{rows.length} student{rows.length === 1 ? "" : "s"}</span>
          {filtersOn ? (
            <button type="button" className="font-bold text-primary" onClick={() => { setQuery(""); setClasses([]); setCountFilter("all"); setLoginFilter("all"); }}>Clear filters</button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => quickExport("multi", "more-than-one-guardian")} disabled={!stats.multi}>
            <Download /> More than one guardian ({stats.multi})
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => quickExport("none", "no-guardian")} disabled={!stats.none}>
            <Download /> No guardian ({stats.none})
          </Button>
          <Button size="sm" className="h-9" onClick={() => exportRows(rows, filtersOn ? "guardians-filtered" : "guardians")} disabled={!rows.length} data-testid="btn-export-guardians">
            <Download /> Export this list (Excel)
          </Button>
          {unconnectedInView.length > 0 && (
            <Button variant="highlight" size="sm" className="h-9" onClick={() => setBulkOpen(true)} data-testid="btn-bulk-connect">
              <Link2 /> Connect {unconnectedInView.length} guardian{unconnectedInView.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <ListScroll page={reportPage.page} offset="26rem">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Guardians</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportPage.pageItems.map((s) => {
              const gs = gOf(s);
              return (
                <TableRow key={s.id}>
                  <TableCell className="align-top">
                    <div className="font-bold text-foreground">{s.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.studentId}</div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">{classOf(s)}</TableCell>
                  <TableCell className="align-top">
                    {gs.length === 0 ? (
                      <span className="rounded-full bg-blush px-2 py-0.5 text-[11px] font-extrabold text-red-700">No guardian</span>
                    ) : (
                      <ul className="space-y-1">
                        {gs.map((g) => (
                          <li key={g.email} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <span className="font-semibold text-foreground">{g.name}</span>
                            <span className="text-[10px] font-extrabold text-ink-2">{relationshipLabel(g.relationship)}</span>
                            <span className="max-w-[16rem] truncate whitespace-nowrap text-xs text-muted-foreground" title={g.email}>{g.email}</span>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                              g.status === "connected" ? "bg-mint text-green-700" : g.status === "awaiting" ? "bg-peach text-amber-700" : "bg-muted text-muted-foreground")}>
                              {loginStatusLabel(g.status)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No students match these filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </ListScroll>
        <PaginationBar p={reportPage} label="students" />
      </div>

      <BulkConnectDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        items={unconnectedInView}
        schoolName={schoolName}
        onDone={() => refreshLspayParents(tenantId)}
        connect={(studentId, guardianId) => connectLspayParent(studentId, "connect", guardianId ?? undefined, { refresh: false })}
      />
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: "coral" | "lilac" | "mint" | "peach"; onClick?: () => void }) {
  const bg = tone === "coral" ? "bg-blush" : tone === "lilac" ? "bg-lilac" : tone === "mint" ? "bg-mint" : tone === "peach" ? "bg-peach" : "bg-card";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("rounded-2xl border border-border p-3 text-left", bg, onClick && "transition-transform hover:-translate-y-0.5")}>
      <div className="font-display text-2xl text-foreground">{value}</div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
    </Tag>
  );
}

/**
 * Connects every not-yet-connected guardian in the current list, one after another. Each guardian gets their
 * login by email (siblings are linked automatically, so a parent with 3 children is connected once).
 */
function BulkConnectDialog({ open, onClose, items, schoolName, onDone, connect }: {
  open: boolean; onClose: () => void; items: { s: Student; g: StudentGuardian }[]; schoolName: string;
  onDone: () => Promise<void>;
  connect: (studentId: string, guardianId: string | null) => Promise<{ success: boolean; message?: string; credentials?: { email: string; password: string | null; emailed: boolean } }>;
}) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ email: string; name: string; ok: boolean; message: string; password: string | null; emailed: boolean }[]>([]);
  const [finished, setFinished] = useState(false);

  // one call per distinct email: the server links all of that parent's children
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return items.filter(({ g }) => (seen.has(g.email) ? false : (seen.add(g.email), true)));
  }, [items]);

  const start = async () => {
    setRunning(true); setDone(0); setResults([]); setFinished(false);
    const out: typeof results = [];
    for (const { s, g } of unique) {
      try {
        const r = await connect(s.id, g.guardianId);
        out.push({ email: g.email, name: g.name, ok: r.success, message: r.success ? "Connected" : r.message ?? "Failed",
          password: r.credentials?.password ?? null, emailed: !!r.credentials?.emailed });
      } catch (e: any) {
        out.push({ email: g.email, name: g.name, ok: false, message: e?.message ?? "Failed", password: null, emailed: false });
      }
      setDone((d) => d + 1);
      setResults([...out]);
    }
    await onDone();
    setRunning(false); setFinished(true);
  };

  const failed = results.filter((r) => !r.ok);
  const notEmailed = results.filter((r) => r.ok && r.password && !r.emailed);
  const close = () => { if (running) return; setResults([]); setDone(0); setFinished(false); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">Connect guardians to LSPay</DialogTitle>
          <DialogDescription>
            {unique.length} guardian{unique.length === 1 ? "" : "s"} at {schoolName} will get an LSPay login. Each one is emailed a temporary password (or told to use their existing password) and must choose their own at first sign-in.
          </DialogDescription>
        </DialogHeader>

        {(running || finished) && (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${unique.length ? (done / unique.length) * 100 : 0}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{done} of {unique.length} done{failed.length ? ` · ${failed.length} failed` : ""}</p>
          </div>
        )}

        {finished && (failed.length > 0 || notEmailed.length > 0) && (
          <div className="space-y-2 rounded-xl bg-peach p-3 text-sm">
            {failed.length > 0 && <p className="font-semibold text-amber-700">{failed.length} could not be connected.</p>}
            {notEmailed.length > 0 && <p className="font-semibold text-amber-700">{notEmailed.length} login{notEmailed.length === 1 ? " was" : "s were"} not emailed (email is not set up on the server). Download them and share them directly.</p>}
            <Button size="sm" variant="outline" className="h-9 bg-card"
              onClick={() => downloadCsv(`${fileSlug(schoolName)}-connect-results`, ["Guardian", "Email", "Result", "Temporary password (only if not emailed)"],
                results.map((r) => [r.name, r.email, r.message, r.ok && !r.emailed ? r.password ?? "" : ""]))}>
              <Download /> Download results (Excel)
            </Button>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} disabled={running} className="h-10">{finished ? "Close" : "Cancel"}</Button>
          {!finished && (
            <Button onClick={start} disabled={running || !unique.length} className="h-10">
              {running ? <Loader2 className="animate-spin" /> : <Users />} {running ? "Connecting…" : `Connect ${unique.length} & email logins`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
