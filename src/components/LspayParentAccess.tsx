import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Link2, Loader2, Trash2, UserPlus, UserRoundCheck } from "lucide-react";
import { useStore } from "@/store";
import type { GuardianRelationship, LspayParentCredentials, ParentUser, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  MAX_GUARDIANS, StudentGuardian, GuardianLoginStatus, guardiansOf, relationshipLabel, loginStatusLabel, emailLooksValid,
} from "@/lib/guardians";

/** The first LSPay parent account (if any) linked to this student. */
export function lspayParentFor(student: Student, parentUsers: ParentUser[]): ParentUser | undefined {
  return parentUsers.find((p) => p.linkedStudentIds.includes(student.id));
}

/** Small status pill for student lists: how many of the student's guardians are connected to LSPay. */
export function LspayParentBadge({ student, className }: { student: Student; className?: string }) {
  const { parentUsers, lspayGuardians } = useStore();
  const guardians = guardiansOf(student, lspayGuardians, parentUsers);
  const connected = guardians.filter((g) => g.status !== "not_connected");
  if (!connected.length) return null;
  const awaiting = connected.every((g) => g.status === "awaiting");
  const label = guardians.length > 1
    ? `LSPay: ${connected.length} of ${guardians.length} parents connected`
    : awaiting ? "LSPay: awaiting sign-in" : "LSPay parent connected";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
        awaiting ? "bg-peach text-amber-700" : "bg-mint text-green-700",
        className
      )}
      title={connected.map((g) => `${g.email}: ${loginStatusLabel(g.status)}`).join("\n")}
      data-testid={`lspay-parent-${student.id}`}
    >
      <UserRoundCheck className="h-3 w-3" /> {label}
    </span>
  );
}

/** "Portal access is ready" — same content as LSA's credentials window, for the LSPay parent portal. */
export function LspayCredentialsDialog({ student, creds, onClose }: { student?: Student; creds: LspayParentCredentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!creds) return null;
  const signInAt = (import.meta.env.VITE_LSPAY_URL as string | undefined) || window.location.origin;
  const passwordText = creds.password
    ?? (creds.linkedExisting || creds.alreadyActive ? "Use existing account password" : "Sent by email to the guardian");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`LSPay parent portal\nSign in at: ${signInAt}\nEmail: ${creds.email}\nPassword: ${passwordText}`);
      setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]" data-testid="lspay-creds-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">Portal access is ready</DialogTitle>
          <DialogDescription>{student?.name}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {creds.isNew
            ? "A new LSPay parent account was created."
            : creds.linkedExisting
            ? "The student has been linked to the guardian's existing account. They can sign in to LSPay using their existing password."
            : creds.alreadyActive
            ? "The guardian's LSPay parent account has been linked to this student."
            : "A new temporary password was issued for the guardian's LSPay parent account."}{" "}
          Share these sign-in details with the guardian.
        </p>
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-4 text-sm">
          <Row k="Sign in at" v={signInAt} mono />
          <Row k="App" v="LSPay (parent portal)" />
          <Row k="Email" v={creds.email} mono />
          <Row k="Password" v={passwordText} mono={!!creds.password} strong={!!creds.password} />
          {creds.children.length > 0 && <Row k={creds.children.length > 1 ? "Children (siblings)" : "Child"} v={creds.children.join(", ")} />}
        </div>
        <p className="text-xs text-muted-foreground">
          {creds.password
            ? "The guardian chooses their own password the first time they sign in. This window is the only place the temporary password is shown."
            : "The guardian can sign in immediately using their existing password."}
          {creds.emailed ? " The details were also emailed to the guardian." : " Email is not set up on the server, so share these details directly."}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={copy} className="h-10">
            {copied ? <CheckCircle2 /> : <Copy />} {copied ? "Copied" : "Copy details"}
          </Button>
          <Button onClick={onClose} className="h-10">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <b className={cn("min-w-0 break-all text-right", mono && "font-mono text-[13px]", strong && "text-base text-foreground")}>{v}</b>
    </div>
  );
}

/**
 * "LSPay parent portal" panel on a student's details — the LSPay twin of LSA's "Parent portal" section.
 * Lists every guardian (the one on the student record plus extra LSPay guardians, e.g. father and mother,
 * up to 3). Each is connected separately and gets their own login; siblings link automatically. No card needed.
 */
/** `wide`: for a full-width spot (student page) — guardians sit side by side. */
export function LspayParentAccessPanel({ student, className, wide }: { student: Student; className?: string; wide?: boolean }) {
  const { parentUsers, lspayGuardians, connectLspayParent, removeLspayGuardian } = useStore();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<LspayParentCredentials | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<StudentGuardian | null>(null);

  const guardians = guardiansOf(student, lspayGuardians, parentUsers);
  const canAdd = guardians.length < MAX_GUARDIANS;

  const run = async (g: StudentGuardian, action: "connect" | "reset") => {
    const key = g.guardianId ?? "record";
    setError(""); setBusyKey(key);
    try {
      const r = await connectLspayParent(student.id, action, g.guardianId ?? undefined);
      if (r.success && r.credentials) setCreds(r.credentials);
      else setError(r.message || "Could not connect the guardian. Please try again.");
    } catch (e: any) {
      setError(e?.message ?? "Could not connect the guardian. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing?.guardianId) return;
    setBusyKey(removing.guardianId);
    const r = await removeLspayGuardian(removing.guardianId);
    setBusyKey(null); setRemoving(null);
    if (!r.success) setError(r.message ?? "Could not remove the guardian.");
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 text-left", className)} data-testid="lspay-parent-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-foreground">LSPay parent portal</div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold text-muted-foreground">
          {guardians.length} of {MAX_GUARDIANS} guardians
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Each guardian gets their own LSPay login to top up, set limits and see what the child buys.
      </p>

      {guardians.length === 0 && (
        <p className="mt-3 rounded-xl bg-peach px-3 py-2 text-xs font-semibold text-amber-700">
          No guardian email yet. Add one on the student record, or add a guardian below.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {guardians.map((g) => {
          const key = g.guardianId ?? "record";
          const busy = busyKey === key;
          const siblings = g.account ? g.account.linkedStudentIds.length - 1 : 0;
          return (
            wide ? (
            <li key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 md:flex-row md:items-center" data-testid={`guardian-${key}`}>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-foreground">{g.name || "Parent"}</span>
                  <span className="whitespace-nowrap rounded-full bg-lilac px-2 py-0.5 text-[10px] font-extrabold text-ink-2">{relationshipLabel(g.relationship)}</span>
                  <StatusPill status={g.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  <span className="break-all">{g.email}</span>
                  {g.phone && <span className="whitespace-nowrap">{g.phone}</span>}
                  {siblings > 0 && <span className="whitespace-nowrap">Linked with {siblings} sibling{siblings > 1 ? "s" : ""}</span>}
                </div>
                {!g.guardianId && <p className="text-[11px] text-muted-foreground">From the student record. Edit the student to change it.</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => run(g, g.account ? "reset" : "connect")}
                  disabled={busyKey !== null}
                  variant={g.account ? "outline" : "highlight"}
                  className="h-9 rounded-lg px-4"
                  data-testid={g.account ? `btn-reset-lspay-parent-${key}` : `btn-connect-lspay-parent-${key}`}
                >
                  {busy ? <Loader2 className="animate-spin" /> : g.account ? <KeyRound /> : <Link2 />}
                  {busy ? "Working…" : g.account ? "Reset password" : "Connect to LSPay"}
                </Button>
                {g.guardianId && (
                  <Button type="button" size="sm" variant="ghost" disabled={busyKey !== null} onClick={() => setRemoving(g)}
                    className="h-9 rounded-lg px-2.5 text-red-600 hover:bg-blush" aria-label={`Remove ${g.name}`}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
            ) : (
            <li key={key} className="rounded-xl border border-border bg-background p-3" data-testid={`guardian-${key}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate whitespace-nowrap font-bold text-foreground" title={g.name || "Parent"}>{g.name || "Parent"}</span>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-lilac px-2 py-0.5 text-[10px] font-extrabold text-ink-2">{relationshipLabel(g.relationship)}</span>
                  </div>
                  <div className="break-all text-xs text-muted-foreground">{g.email}</div>
                  {g.phone && <div className="truncate whitespace-nowrap text-xs text-muted-foreground">{g.phone}</div>}
                  {siblings > 0 && <div className="truncate whitespace-nowrap text-[11px] text-muted-foreground">Linked with {siblings} sibling{siblings > 1 ? "s" : ""}</div>}
                </div>
                <StatusPill status={g.status} />
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => run(g, g.account ? "reset" : "connect")}
                  disabled={busyKey !== null}
                  variant={g.account ? "outline" : "highlight"}
                  className="h-9 flex-1 rounded-lg"
                  data-testid={g.account ? `btn-reset-lspay-parent-${key}` : `btn-connect-lspay-parent-${key}`}
                >
                  {busy ? <Loader2 className="animate-spin" /> : g.account ? <KeyRound /> : <Link2 />}
                  {busy ? "Working…" : g.account ? "Reset password" : "Connect to LSPay"}
                </Button>
                {g.guardianId && (
                  <Button type="button" size="sm" variant="ghost" disabled={busyKey !== null} onClick={() => setRemoving(g)}
                    className="h-9 rounded-lg px-2.5 text-red-600 hover:bg-blush" aria-label={`Remove ${g.name}`}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              {!g.guardianId && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">From the student record. Edit the student to change it.</p>
              )}
            </li>
            )
          );
        })}
      </ul>

      {error && <p className="mt-2 rounded-xl bg-blush px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}

      {canAdd ? (
        <Button type="button" variant="outline" onClick={() => setAdding(true)} disabled={busyKey !== null} className={cn("mt-3 h-10 rounded-xl", wide ? "w-full sm:w-auto sm:px-6" : "w-full")} data-testid="btn-add-guardian">
          <UserPlus /> Add guardian
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">This student has the maximum of {MAX_GUARDIANS} guardians.</p>
      )}

      <AddGuardianDialog student={student} open={adding} onClose={() => setAdding(false)} />
      <LspayCredentialsDialog student={student} creds={creds} onClose={() => setCreds(null)} />

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Remove guardian?</DialogTitle>
            <DialogDescription>
              {removing?.name} ({removing?.email}) will no longer see {student.name} in LSPay. Their login and any other children stay as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRemoving(null)} className="h-10">Cancel</Button>
            <Button onClick={confirmRemove} disabled={busyKey !== null} className="h-10 bg-red-600 text-white hover:bg-red-700">
              {busyKey ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: GuardianLoginStatus }) {
  return (
    <span className={cn(
      "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold",
      status === "connected" ? "bg-mint text-green-700" : status === "awaiting" ? "bg-peach text-amber-700" : "bg-muted text-muted-foreground",
    )}>
      {loginStatusLabel(status)}
    </span>
  );
}

function AddGuardianDialog({ student, open, onClose }: { student: Student; open: boolean; onClose: () => void }) {
  const { addLspayGuardian } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<GuardianRelationship>("mother");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => { setName(""); setEmail(""); setPhone(""); setRelationship("mother"); setError(""); onClose(); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailLooksValid(email)) { setError("Enter a valid email address. It is the guardian's LSPay login."); return; }
    setSaving(true); setError("");
    const r = await addLspayGuardian(student.id, { name, email, phone, relationship });
    setSaving(false);
    if (r.success) close(); else setError(r.message ?? "Could not add the guardian.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">Add guardian</DialogTitle>
          <DialogDescription>For {student.name}. Connect them to LSPay afterwards to send their login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(["father", "mother", "guardian"] as GuardianRelationship[]).map((r) => (
              <button key={r} type="button" onClick={() => setRelationship(r)} aria-pressed={relationship === r}
                className={cn("h-9 rounded-full border text-sm font-bold transition-colors",
                  relationship === r ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                {relationshipLabel(r)}
              </button>
            ))}
          </div>
          <div className="space-y-1"><Label htmlFor="g-name">Full name</Label><Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fatima Bakare" /></div>
          <div className="space-y-1"><Label htmlFor="g-email">Email</Label><Input id="g-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" /></div>
          <div className="space-y-1"><Label htmlFor="g-phone">Phone (optional)</Label><Input id="g-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" /></div>
          {error && <p className="rounded-xl bg-blush px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} className="h-10">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-10">{saving ? <Loader2 className="animate-spin" /> : <UserPlus />} Add guardian</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

