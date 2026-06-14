import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";
import { useQrScanner } from "@/lib/useQrScanner";

interface QrScannerProps {
  onResult: (text: string) => void;
  triggerClassName?: string;
  children?: ReactNode;
}

export function QrScanner({ onResult, triggerClassName, children }: QrScannerProps) {
  const [open, setOpen] = useState(false);
  const { status, error, start, stop, videoRef } = useQrScanner((text) => {
    onResult(text);
    setOpen(false);
  });

  useEffect(() => {
    if (open) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [open, start, stop]);

  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "w-full border-border text-foreground h-11 font-bold"}
        data-testid="btn-scan-qr"
      >
        {children ?? (
          <>
            <QrCode className="mr-2 h-4 w-4" /> Scan QR Code
          </>
        )}
      </Button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[10001] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" /> Scan QR Code
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="btn-close-qr"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-border">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-10 border-2 border-primary/70 rounded-xl pointer-events-none animate-pulse" />
              </div>

              <p className="text-center text-sm mt-4">
                {error ? (
                  <span className="text-red-400">{error}</span>
                ) : status === "scanning" ? (
                  <span className="text-muted-foreground">
                    Point the camera at the QR code on the student card.
                  </span>
                ) : (
                  <span className="text-muted-foreground">Starting camera…</span>
                )}
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
