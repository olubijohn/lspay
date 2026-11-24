import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Loader2, Printer, RefreshCw, Search, UserRound } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import type { PrintStatus, Student, Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationBar } from "@/components/ui/paginated-list";
import { usePagination } from "@/lib/usePagination";
import { CardPrintStudio } from "@/components/CardPrintStudio";
import { cn } from "@/lib/utils";

// Staff ID cards (0168). Staff are the school's active Nova EC accounts (the same people Attendify mirrors), with
// their HR job title and the photo set in Nova EC (HR record or My account). The QR on the back holds the staff
// number (or username when there is none), which is the staff ID Attendify scans, so the card checks them in and out.
// Print status is kept in lspay_staff_cards, like the student card print status.

interface StaffRow {
  user_id: string; tenant_id: string; full_name: string; staff_code: string; job_title: string; department: string; role: string;
  avatar_path: string | null; print_status: PrintStatus | null; print_status_at: string | null; print_status_by: string | null;
}
type Filter = "all" | "ready" | "printed" | "not_ready";
type PhotoF = "all" | "with" | "without";

const initials = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
const shortDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/** A staff member in the shape the card studio draws (staff number where the student number goes, job title where the class goes). */
const asCard = (s: StaffRow): Student => ({
  id: s.user_id, tenantId: s.tenant_id, name: s.full_name, studentId: s.staff_code, className: s.job_title,
  imageUrl: s.avatar_path || initials(s.full_name), cardHardwareId: "", cardStatus: "Unassigned", cardType: "QR",
  printStatus: s.print_status ?? undefined, printStatusAt: s.print_status_at ?? undefined, printStatusBy: s.print_status_by ?? undefined,
} as unknown as Student);

export function StaffCards({ tenants, tenantId }: { tenants: Tenant[]; tenantId?: string }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [school, setSchool] = useState<string>(tenantId ?? "all");
  const [filter, setFilter] = useState<Filter>("all");
  const [photoF, setPhotoF] = useState<PhotoF>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [printing, setPrinting] = useState<{ list?: Student[]; one?: Student } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: e } = await getSupabase().rpc("lspay_staff_list", { p_tenant: tenantId ?? null });
    if (e) setError(e.message); else setRows((data ?? []) as StaffRow[]);
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (ids: string[], status: PrintStatus | null) => {
    if (!ids.length) return { success: true };
    const { error: e } = await getSupabase().rpc("lspay_set_staff_print_status", { p_users: ids, p_status: status });
    if (e) { setError(e.message); return { success: false }; }
    const at = new Date().toISOString(); const set = new Set(ids);
    setRows((prev) => prev.map((r) => (set.has(r.user_id) ? { ...r, print_status: status, print_status_at: status ? at : null } : r)));
    return { success: true };
  };

  const hasPhoto = (r: StaffRow) => !!r.avatar_path;
  const statusOk = (r: StaffRow) =>
    filter === "all" || (filter === "ready" ? r.print_status !== "printed" && r.print_status !== "not_ready" : r.print_status === filter);
  const inSchool = useMemo(() => rows.filter((r) => school === "all" || r.tenant_id === school), [rows, school]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return inSchool.filter((r) => statusOk(r) && (photoF === "all" || (photoF === "with") === hasPhoto(r))
      && (!k || `${r.full_name} ${r.staff_code} ${r.job_title} ${r.department}`.toLowerCase().includes(k)));
  }, [inSchool, filter, photoF, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = usePagination(shown, `${school}|${filter}|${photoF}|${q}`);
  const schoolName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "";
  const pageIds = page.pageItems.map((r) => r.user_id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => sel.includes(id));
  const count = (f: Filter) => inSchool.filter((r) => f === "all" || (f === "ready" ? r.print_status !== "printed" && r.print_status !== "not_ready" : r.print_status === f)).length;

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl flex flex-col" data-testid="staff-cards">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-foreground">Staff ID cards</h3>
            <p className="text-sm text-muted-foreground mt-1">Teachers and staff from Nova EC. The QR code holds the staff number, so the same card checks them in and out on Attendify.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh</Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, staff number or job title…" className="pl-9 bg-background border-border h-10" data-testid="input-staff-search" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!tenantId && (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">School</span>
              <Select value={school} onValueChange={(v) => { setSchool(v); setSel([]); }}>
                <SelectTrigger className="w-full bg-background border-border h-9" data-testid="select-staff-school"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All schools ({rows.length})</SelectItem>
                  {tenants.filter((t) => rows.some((r) => r.tenant_id === t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({rows.filter((r) => r.tenant_id === t.id).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Card print</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-full bg-background border-border h-9" data-testid="select-staff-print"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All ({count("all")})</SelectItem>
                <SelectItem value="ready">Ready, not printed yet ({count("ready")})</SelectItem>
                <SelectItem value="printed">Card printed ({count("printed")})</SelectItem>
                <SelectItem value="not_ready">Not ready (don't print) ({count("not_ready")})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Photo</span>
            <Select value={photoF} onValueChange={(v) => setPhotoF(v as PhotoF)}>
              <SelectTrigger className="w-full bg-background border-border h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="with">With photo ({inSchool.filter(hasPhoto).length})</SelectItem>
                <SelectItem value="without">Without photo ({inSchool.filter((r) => !hasPhoto(r)).length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {photoF !== "with" && inSchool.some((r) => !hasPhoto(r)) && (
          <p className="text-xs text-muted-foreground">Staff photos are added in Nova EC: HR, open the staff member's HR record, Upload photo (or the staff member's own My account).</p>
        )}
        {error && <p className="text-xs font-bold text-red-600" role="alert">{error}</p>}
        {sel.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-sm font-bold text-foreground">{sel.length} selected</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="highlight" onClick={() => setPrinting({ list: rows.filter((r) => sel.includes(r.user_id)).map(asCard) })} data-testid="btn-staff-bulk-print">
                <Printer className="w-4 h-4 mr-2" /> Print cards
              </Button>
              <Button size="sm" variant="outline" onClick={async () => { await setStatus(sel, "not_ready"); }}><Ban className="w-4 h-4 mr-2" /> Not ready</Button>
              <Button size="sm" variant="outline" onClick={async () => { await setStatus(sel, null); }}>Ready</Button>
              <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading staff…</div>
      ) : shown.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground"><UserRound className="w-8 h-8 mx-auto mb-2" />No staff match these filters.</div>
      ) : (
        <div className="divide-y divide-border">
          <label className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-muted-foreground">
            <Checkbox checked={allOnPage} onCheckedChange={(v) => setSel((s) => (v ? Array.from(new Set([...s, ...pageIds])) : s.filter((id) => !pageIds.includes(id))))} />
            Select all on this page
          </label>
          {page.pageItems.map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`staff-row-${r.user_id}`}>
              <Checkbox checked={sel.includes(r.user_id)} onCheckedChange={(v) => setSel((s) => (v ? [...s, r.user_id] : s.filter((id) => id !== r.user_id)))} />
              <img src={r.avatar_path || initials(r.full_name)} alt="" className="w-10 h-10 rounded-full object-cover bg-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-foreground truncate">{r.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.staff_code} · {r.job_title}{r.department ? `, ${r.department}` : ""}{!tenantId && school === "all" ? ` · ${schoolName(r.tenant_id)}` : ""}</div>
              </div>
              <span className={cn("text-[11px] font-bold rounded-full px-2.5 py-1",
                r.print_status === "printed" ? "bg-green-100 text-green-800" : r.print_status === "not_ready" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground")}>
                {r.print_status === "printed" ? <><CheckCircle2 className="inline w-3 h-3 mr-1" />Printed {shortDate(r.print_status_at)}</> : r.print_status === "not_ready" ? "Not ready" : "Ready"}
              </span>
              <Button size="sm" variant="outline" disabled={busy === r.user_id} onClick={() => setPrinting({ one: asCard(r) })} data-testid={`btn-staff-print-${r.user_id}`}>
                <Printer className="w-4 h-4 mr-1" /> Card
              </Button>
              {r.print_status && (
                <Button size="sm" variant="ghost" disabled={busy === r.user_id} title="Back to Ready" onClick={async () => { setBusy(r.user_id); await setStatus([r.user_id], null); setBusy(null); }}>Reset</Button>
              )}
            </div>
          ))}
          <PaginationBar p={page} label="staff" className="rounded-b-xl" />
        </div>
      )}

      {printing && (
        <CardPrintStudio
          kind="staff"
          student={printing.one}
          students={printing.list}
          tenant={tenants.find((t) => t.id === (printing.one?.tenantId ?? printing.list?.[0]?.tenantId))}
          isOpen
          onClose={() => { setPrinting(null); setSel([]); }}
          onMarkPrinted={(ids) => setStatus(ids, "printed")}
        />
      )}
    </div>
  );
}
