import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, LogOut, X } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Same rule as LSA: 8+ characters with upper, lower, number and symbol.
const RULES: [string, (p: string) => boolean][] = [
  ["At least 8 characters", (p) => p.length >= 8],
  ["An  letter", (p) => /[A-Z]/.test(p)],
  ["A lowercase letter", (p) => /[a-z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
  ["A symbol (e.g. # @ $ %)", (p) => /[^A-Za-z0-9]/.test(p)],
];

/** Shown instead of the portal until a parent the school connected replaces their temporary password. */
export function ForceChangePassword() {
  const { parentSession, changeParentPassword, logoutParent } = useStore();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const allOk = RULES.every(([, ok]) => ok(pw));
  const match = pw.length > 0 && pw === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!allOk) { setError("Your new password doesn't meet all the rules yet."); return; }
    if (!match) { setError("The two passwords don't match."); return; }
    setBusy(true);
    const r = await changeParentPassword(pw);
    setBusy(false);
    if (!r.success) setError(r.message || "Could not change your password. Please try again.");
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-lg" data-testid="force-change-password">
        <div className="on-ink relative overflow-hidden bg-ink px-6 py-7 text-white">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
          <span className="relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-ink"><KeyRound className="h-6 w-6" /></span>
          <h1 className="relative text-3xl leading-tight">Choose your password</h1>
          <p className="relative mt-1.5 text-sm text-lilac/80">
            Welcome{parentSession?.name ? `, ${parentSession.name.split(" ")[0]}` : ""}! Your school gave you a temporary password. Please choose your own to continue.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input id="new-pw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="h-12 pr-11" required />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {RULES.map(([label, ok]) => (
              <li key={label} className={cn("flex items-center gap-1.5 text-xs font-semibold", ok(pw) ? "text-green-700" : "text-muted-foreground")}>
                {ok(pw) ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {label}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input id="confirm-pw" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="h-12" required />
            {confirm && !match && <p className="text-xs font-semibold text-red-700">Passwords don't match.</p>}
          </div>
          {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <Button type="submit" variant="highlight" disabled={busy || !allOk || !match} className="h-12 w-full rounded-2xl text-base" data-testid="btn-save-new-password">
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} {busy ? "Saving…" : "Save and continue"}
          </Button>
          <button type="button" onClick={() => logoutParent()} className="mx-auto flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
