import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, GraduationCap, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PrivacyComplianceDialog } from "./PrivacyComplianceDialog";

interface Props {
  authCode: string;
  onAuthCodeChange: (v: string) => void;
  studentId: string;
  onStudentIdChange: (v: string) => void;
  error: string;
  success: string;
  processing: boolean;
  privacyAccepted: boolean;
  onPrivacyAccept: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

/** Full-page "Link a child" flow: review privacy & compliance first, then enter the school code and pay. */
export function LinkChildPage(props: Props) {
  const { authCode, onAuthCodeChange, studentId, onStudentIdChange, error, success, processing, privacyAccepted, onPrivacyAccept, onSubmit, onBack } = props;
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-10 duration-500" data-testid="link-child-page">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
        {/* Hero */}
        <div className="on-ink relative overflow-hidden bg-ink px-6 pb-7 pt-7 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-gold/20" />
          <span className="relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-ink">
            <GraduationCap className="h-6 w-6" />
          </span>
          <h1 className="relative text-3xl leading-tight">Link a child</h1>
          <p className="relative mt-1.5 max-w-sm text-sm text-lilac/80">
            Connect your child's school wallet to see their spending, top up and manage their card.
          </p>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {/* Step 1 — privacy */}
          <div className={cn("rounded-2xl border p-4 transition-colors", privacyAccepted ? "border-green-500/40 bg-mint/60" : "border-border bg-muted/40")}>
            <div className="flex items-start gap-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", privacyAccepted ? "bg-green text-white" : "bg-lilac text-ink-2")}>
                {privacyAccepted ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-display">1</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">Privacy & compliance</div>
                <p className="text-sm text-muted-foreground">
                  {privacyAccepted ? "Thanks — you've accepted the notice. You can review it again any time." : "Read and accept how we handle your family's data before linking."}
                </p>
                <Button
                  type="button"
                  variant={privacyAccepted ? "outline" : "default"}
                  onClick={() => setShowPrivacy(true)}
                  className="mt-3 h-10"
                  data-testid="btn-view-privacy"
                >
                  <FileText /> {privacyAccepted ? "Review privacy & compliance" : "View privacy & compliance"}
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 — school details */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", privacyAccepted ? "bg-lilac text-ink-2" : "bg-muted text-muted-foreground")}>
                {privacyAccepted ? <span className="font-display">2</span> : <Lock className="h-4 w-4" />}
              </span>
              <div>
                <div className="font-extrabold">School details</div>
                <p className="text-sm text-muted-foreground">From the letter or message your school sent you.</p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-blush px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-mint px-4 py-3 text-sm font-bold text-green-700" role="status">
                <CheckCircle2 className="h-4 w-4" /> {success}
              </div>
            )}

            <fieldset disabled={!privacyAccepted || processing} className="space-y-4 disabled:opacity-60">
              <div className="space-y-2">
                <Label htmlFor="link-auth-code">School authorization code</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="link-auth-code"
                    value={authCode}
                    onChange={e => onAuthCodeChange(e.target.value.toUpperCase())}
                    placeholder="SCH-XXX-2026"
                    autoCapitalize="characters"
                    className="h-12 pl-10 font-display text-base uppercase tracking-wide"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-student-id">Student ID</Label>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="link-student-id"
                    value={studentId}
                    onChange={e => onStudentIdChange(e.target.value.toUpperCase())}
                    placeholder="STU-000"
                    autoCapitalize="characters"
                    className="h-12 pl-10 font-display text-base uppercase tracking-wide"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-green-500/30 bg-mint/70 px-3.5 py-3">
                <p className="flex items-start gap-2.5 text-xs leading-relaxed text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                  <span><strong>Linking is free.</strong> An enrollment charge applies to every wallet top-up to cover infrastructure, payment gateway and transaction fees — you'll see it before you pay.</span>
                </p>
                <p className="flex items-start gap-2.5 text-xs leading-relaxed text-green-800">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                  <span>All payments are processed by <strong>Paystack</strong>. LSPay never holds or stores your card or bank details.</span>
                </p>
              </div>

              <Button type="submit" variant="highlight" className="h-13 w-full rounded-2xl text-base" data-testid="btn-link-child">
                {processing ? "Linking…" : "Connect account"}
              </Button>
            </fieldset>
            {!privacyAccepted && (
              <p className="text-center text-xs text-muted-foreground">Accept the privacy & compliance notice to continue.</p>
            )}
          </form>
        </div>
      </div>

      <PrivacyComplianceDialog open={showPrivacy} onOpenChange={setShowPrivacy} accepted={privacyAccepted} onAccept={onPrivacyAccept} />
    </div>
  );
}
