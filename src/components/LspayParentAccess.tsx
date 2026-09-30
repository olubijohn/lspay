import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Link2, Loader2, UserRoundCheck } from "lucide-react";
import { useStore } from "@/store";
import type { LspayParentCredentials, ParentUser, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The LSPay parent account (if any) that this student is linked to. */
export function lspayParentFor(student: Student, parentUsers: ParentUser[]): ParentUser | undefined {
  return parentUsers.find((p) => p.linkedStudentIds.includes(student.id));
}

/** Small status pill for student lists. */
export function LspayParentBadge({ student, className }: { student: Student; className?: string }) {
  const { parentUsers } = useStore();
  const acct = lspayParentFor(student, parentUsers);
  if (!acct) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
        acct.mustChangePassword ? "bg-peach text-amber-700" : "bg-mint text-green-700",
        className
      )}
      title={acct.mustChangePassword ? `Connected as ${acct.email} — waiting for the first sign-in` : `Connected as ${acct.email}`}
      data-testid={`lspay-parent-${student.id}`}
    >
      <UserRoundCheck className="h-3 w-3" /> {acct.mustChangePassword ? "LSPay: awaiting sign-in" : "LSPay parent connected"}
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
 * Not connected → "Connect to LSPay parent portal" (creates the login with a temporary password and links siblings).
 * Connected → "Reset LSPay password". No card is needed.
 */
export function LspayParentAccessPanel({ student, className }: { student: Student; className?: string }) {
  const { parentUsers, connectLspayParent } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<LspayParentCredentials | null>(null);

  const acct = lspayParentFor(student, parentUsers);
  const siblings = acct ? acct.linkedStudentIds.length - 1 : 0;
  const email = student.parentEmail?.trim();

  const run = async (action: "connect" | "reset") => {
    setError(""); setBusy(true);
    try {
      const r = await connectLspayParent(student.id, action);
      if (r.success && r.credentials) setCreds(r.credentials);
      else setError(r.message || "Could not connect the guardian. Please try again.");
    } catch (e: any) {
      setError(e?.message ?? "Could not connect the guardian. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 text-left", className)} data-testid="lspay-parent-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-foreground">LSPay parent portal</div>
        {acct ? (
          <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold", acct.mustChangePassword ? "bg-peach text-amber-700" : "bg-mint text-green-700")}>
            {acct.mustChangePassword ? "Awaiting first sign-in" : "Connected"}
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold text-muted-foreground">Not connected</span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {acct ? (
          <>Signs in as <span className="break-all font-semibold text-foreground">{acct.email}</span>.{siblings > 0 && <> Linked with {siblings} sibling{siblings > 1 ? "s" : ""}.</>}</>
        ) : (
          "Give the guardian an LSPay login to top up, set limits and see what their child buys."
        )}
      </p>
      {!acct && !email && <p className="mt-2 text-xs font-semibold text-amber-700">Add the guardian's email to the student record first.</p>}
      {error && <p className="mt-2 rounded-xl bg-blush px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}

      <Button
        type="button"
        onClick={() => run(acct ? "reset" : "connect")}
        disabled={busy || (!acct && !email)}
        variant={acct ? "outline" : "highlight"}
        className="mt-3 h-10 w-full rounded-xl"
        data-testid={acct ? "btn-reset-lspay-parent" : "btn-connect-lspay-parent"}
      >
        {busy ? <Loader2 className="animate-spin" /> : acct ? <KeyRound /> : <Link2 />}
        {busy ? "Working…" : acct ? "Reset LSPay password" : "Connect to LSPay parent portal"}
      </Button>

      <LspayCredentialsDialog student={student} creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
