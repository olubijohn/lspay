import { Plus, Trash2 } from "lucide-react";
import type { GuardianRelationship, LspayGuardian, ParentUser, Student } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MAX_GUARDIANS, emailLooksValid, guardiansOf, loginStatusLabel, relationshipLabel } from "@/lib/guardians";
import { cn } from "@/lib/utils";

/** One editable guardian in the student form. `isRecord` = the guardian stored on the student record. */
export interface GuardianDraft {
  key: string;
  guardianId: string | null;
  isRecord: boolean;
  name: string;
  email: string;
  phone: string;
  relationship: GuardianRelationship;
  status?: string;
}

let seq = 0;
const newKey = () => `g${Date.now()}-${seq++}`;

/** Load every guardian of a student (record guardian first, then LSPay guardians) into editable rows. */
export function draftsFor(student: Student, extras: LspayGuardian[], parentUsers: ParentUser[]): GuardianDraft[] {
  const rows: GuardianDraft[] = guardiansOf(student, extras, parentUsers).map((g) => ({
    key: g.guardianId ?? "record",
    guardianId: g.guardianId,
    isRecord: g.guardianId === null,
    name: g.guardianId === null ? (student.parentName || "") : g.name,
    email: g.email,
    phone: g.guardianId === null ? (student.parentPhone || "") : g.phone,
    relationship: g.relationship ?? "guardian",
    status: loginStatusLabel(g.status),
  }));
  // a name on the record without an email still belongs in the main guardian row
  if (!rows.some((r) => r.isRecord) && student.parentName?.trim()) {
    rows.unshift({ key: "record", guardianId: null, isRecord: true, name: student.parentName, email: "", phone: student.parentPhone || "", relationship: "guardian" });
  }
  return rows;
}

/** Problems that block saving; empty when the guardians are fine. */
export function guardianDraftErrors(rows: GuardianDraft[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const label = r.name.trim() || `Guardian ${i + 1}`;
    const email = r.email.trim().toLowerCase();
    if (!email && !r.isRecord) errors.push(`${label}: add an email address (it is their LSPay login).`);
    if (email && !emailLooksValid(email)) errors.push(`${label}: "${r.email}" is not a valid email.`);
    if (email && seen.has(email)) errors.push(`${email} is listed twice.`);
    if (email) seen.add(email);
  });
  return errors;
}

export function GuardianEditor({ rows, onChange }: { rows: GuardianDraft[]; onChange: (rows: GuardianDraft[]) => void }) {
  const set = (key: string, patch: Partial<GuardianDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => onChange([
    ...rows,
    // with no guardian yet, the first one becomes the main guardian on the student record
    { key: newKey(), guardianId: null, isRecord: !rows.some((r) => r.isRecord), name: "", email: "", phone: "", relationship: rows.length === 0 ? "father" : "mother" },
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-foreground">Parents / guardians <span className="text-xs font-normal text-muted-foreground">(up to {MAX_GUARDIANS})</span></Label>
        <span className="text-xs text-muted-foreground">{rows.length} of {MAX_GUARDIANS}</span>
      </div>
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No guardian yet. Add the father, mother or another guardian.</p>
      )}
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-2xl border border-border bg-muted/20 p-3" data-testid={`guardian-row-${i}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="whitespace-nowrap text-xs font-extrabold text-foreground">Guardian {i + 1}</span>
              {r.isRecord && <span className="whitespace-nowrap rounded-full bg-sky px-2 py-0.5 text-[10px] font-extrabold text-ink-2">Main (student record)</span>}
              {r.status && <span className="truncate whitespace-nowrap text-[10px] font-bold text-muted-foreground">{r.status}</span>}
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:bg-blush"
              onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Remove guardian ${i + 1}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {!r.isRecord && (
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {(["father", "mother", "guardian"] as GuardianRelationship[]).map((rel) => (
                <button key={rel} type="button" onClick={() => set(r.key, { relationship: rel })} aria-pressed={r.relationship === rel}
                  className={cn("h-8 rounded-full border text-xs font-bold transition-colors",
                    r.relationship === rel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
                  {relationshipLabel(rel)}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Full name" aria-label={`Guardian ${i + 1} name`} className="h-10 bg-background" />
            <Input type="email" value={r.email} onChange={(e) => set(r.key, { email: e.target.value })} placeholder="Email (LSPay login)" aria-label={`Guardian ${i + 1} email`} className="h-10 bg-background" />
            <Input value={r.phone} onChange={(e) => set(r.key, { phone: e.target.value })} placeholder="Phone" aria-label={`Guardian ${i + 1} phone`} className="h-10 bg-background" />
          </div>
        </div>
      ))}
      {rows.length < MAX_GUARDIANS && (
        <Button type="button" variant="outline" onClick={add} className="h-10 w-full rounded-xl" data-testid="btn-add-guardian-row">
          <Plus className="h-4 w-4" /> Add guardian
        </Button>
      )}
    </div>
  );
}
