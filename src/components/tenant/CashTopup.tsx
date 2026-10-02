import { useState } from "react";
import { Banknote, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useStore } from "@/store";
import type { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { naira } from "@/lib/money";
import { guardiansOf } from "@/lib/guardians";
import { cn } from "@/lib/utils";

const QUICK = [1000, 2000, 5000, 10000];

/**
 * "Top up wallet (cash)" on a student's profile. Only school admins see it, and the database checks it again
 * (lspay_cash_topup): the parent brings cash, the admin records it, the wallet is credited in full and the
 * ledger keeps a CASH entry with a receipt reference, who paid and who received it.
 */
export function CashTopupButton({ student, className }: { student: Student; className?: string }) {
  const { session, cashTopup, lspayGuardians, parentUsers } = useStore();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference?: string; balance?: number; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (session.user?.role !== "tenant_admin") return null;

  const guardians = guardiansOf(student, lspayGuardians, parentUsers);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= 1_000_000 && /^\d+(\.\d{1,2})?$/.test(amount.trim());

  const start = () => {
    setAmount(""); setPaidBy(guardians[0]?.name ?? student.parentName ?? ""); setNote(""); setConfirmed(false);
    setError(""); setDone(null); setCopied(false); setOpen(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { setError("Enter an amount in naira, e.g. 2000 (maximum 1,000,000)."); return; }
    if (!confirmed) { setError("Tick the box to confirm you have received the cash."); return; }
    setBusy(true); setError("");
    const r = await cashTopup(student.id, value, paidBy.trim(), note.trim());
    setBusy(false);
    if (!r.success) { setError(r.message ?? "The top-up was not saved. Please try again."); return; }
    setDone({ reference: r.reference, balance: r.balance, amount: value });
  };
  const copy = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(`LSPay cash top-up\n${student.name} (${student.studentId})\nAmount: ${naira(done.amount)}\nReference: ${done.reference}\nNew balance: ${naira(done.balance ?? 0)}`);
      setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <>
      <Button type="button" onClick={start} className={cn("h-11 w-full rounded-xl font-bold", className)} data-testid="btn-cash-topup">
        <Banknote className="h-4 w-4 mr-2" /> Top up wallet (cash)
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">{done ? "Wallet topped up" : "Cash top-up"}</DialogTitle>
            <DialogDescription>{student.name} · {student.studentId}{student.className ? ` · ${student.className}` : ""}</DialogDescription>
          </DialogHeader>

          {!done ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Current balance <b className="text-foreground">{naira(student.walletBalance)}</b>. Cash is credited in full; no online payment charge applies.
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-amount">Amount received (₦)</Label>
                <Input id="cash-amount" inputMode="decimal" autoFocus value={amount} placeholder="e.g. 2000"
                  onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} className="h-12 text-lg font-bold" />
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => { setAmount(String(q)); setError(""); }}
                      className={cn("h-9 rounded-full border text-xs font-extrabold transition-colors", Number(amount) === q ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted")}>
                      {naira(q, { decimals: 0 })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-from">Cash brought by</Label>
                <Input id="cash-from" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Parent or guardian's name" list="cash-from-guardians" />
                <datalist id="cash-from-guardians">{guardians.map((g) => <option key={g.email} value={g.name} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-note">Receipt number or note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="cash-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Receipt 0045" />
              </div>
              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3 text-sm font-semibold text-foreground">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setError(""); }} />
                <span>I have received {valid ? <b>{naira(value)}</b> : "this amount"} in cash for {student.name.split(" ")[0]}'s wallet.</span>
              </label>
              {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy} className="h-11">Cancel</Button>
                <Button type="submit" disabled={busy || !valid || !confirmed} className="h-11">
                  {busy ? <Loader2 className="animate-spin" /> : <Banknote />} {valid ? `Credit ${naira(value)}` : "Credit wallet"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-mint p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-600" />
                <div className="font-display text-3xl text-green-700">{naira(done.amount)}</div>
                <p className="text-sm font-semibold text-green-700">added to {student.name.split(" ")[0]}'s wallet</p>
              </div>
              <div className="space-y-2 rounded-2xl border-2 border-dashed border-border p-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Reference</span><b className="font-mono">{done.reference}</b></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">New balance</span><b>{naira(done.balance ?? 0)}</b></div>
                {paidBy.trim() && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Brought by</span><b>{paidBy.trim()}</b></div>}
              </div>
              <p className="text-xs text-muted-foreground">Saved to the wallet history as a cash top-up. Write the reference on the paper receipt you give the parent.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={copy} className="h-11">{copied ? <CheckCircle2 /> : <Copy />} {copied ? "Copied" : "Copy details"}</Button>
                <Button onClick={() => setOpen(false)} className="h-11">Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
