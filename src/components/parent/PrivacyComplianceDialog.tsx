import { useEffect, useState } from "react";
import { Check, ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIVACY_CONSENT_STATEMENTS, PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_TITLE, PRIVACY_POLICY_VERSION } from "@/lib/privacyPolicy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accepted: boolean;
  onAccept: () => void;
}

export function PrivacyComplianceDialog({ open, onOpenChange, accepted, onAccept }: Props) {
  const [checks, setChecks] = useState<boolean[]>(() => PRIVACY_CONSENT_STATEMENTS.map(() => accepted));

  useEffect(() => {
    if (open) setChecks(PRIVACY_CONSENT_STATEMENTS.map(() => accepted));
  }, [open, accepted]);

  const allChecked = checks.every(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]" data-testid="privacy-dialog">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-green-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="pr-6 font-display text-xl leading-tight sm:text-2xl">{PRIVACY_POLICY_TITLE}</DialogTitle>
          <DialogDescription>
            Please read how LSPay handles your family's information and payments before linking a child. Version {PRIVACY_POLICY_VERSION}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {PRIVACY_POLICY_SECTIONS.map((s, i) => (
            <section key={s.title} className="space-y-1.5">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lilac text-[11px] text-ink-2">{i + 1}</span>
                {s.title}
              </h3>
              {s.body?.map((p, j) => (
                <p key={j} className="pl-8 text-sm leading-relaxed text-muted-foreground">{p}</p>
              ))}
              {s.bullets && (
                <ul className="space-y-1.5 pl-8">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.link && (
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-8 inline-flex items-center gap-1.5 text-sm font-extrabold text-primary underline-offset-4 hover:underline"
                >
                  {s.link.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </section>
          ))}
        </div>

        <div className="space-y-3 border-t border-border bg-muted/40 px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4">
          {PRIVACY_CONSENT_STATEMENTS.map((text, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-3 text-[13px] font-semibold leading-snug">
              <Checkbox
                checked={checks[i]}
                onCheckedChange={(v) => setChecks(prev => prev.map((c, k) => (k === i ? v === true : c)))}
                className="mt-0.5 h-5 w-5 rounded-md"
                data-testid={`privacy-check-${i}`}
              />
              <span>{text}</span>
            </label>
          ))}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11">
              Not now
            </Button>
            <Button
              type="button"
              disabled={!allChecked}
              onClick={() => { onAccept(); onOpenChange(false); }}
              className="h-11"
              data-testid="btn-accept-privacy"
            >
              <FileCheck2 /> Accept & continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
