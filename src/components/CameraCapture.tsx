import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, RotateCcw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;

/** Wraps a captured File as a file-input change event so existing upload handlers can take it unchanged. */
export const asFileEvent = (file: File) => {
  const target = { files: [file] as unknown as FileList, value: "" };
  return { target, currentTarget: target } as unknown as React.ChangeEvent<HTMLInputElement>;
};

/** Draws the current video frame into a JPEG File (longest side capped at MAX_SIDE). */
async function frameToFile(video: HTMLVideoElement, name: string): Promise<File> {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not capture photo"))), "image/jpeg", 0.9));
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  title?: string;
  /** "user" = front camera (people), "environment" = back camera (documents, items). */
  facing?: "user" | "environment";
}

/** Live camera preview → Capture → Use photo. Falls back to the device's camera picker when getUserMedia is unavailable. */
export function CameraCaptureDialog({ open, onOpenChange, onCapture, title = "Take a photo", facing = "environment" }: DialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"user" | "environment">(facing);
  const [status, setStatus] = useState<"starting" | "live" | "error">("starting");
  const [error, setError] = useState("");
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (m: "user" | "environment") => {
    stop();
    setStatus("starting"); setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError(window.isSecureContext ? "This browser can't open the camera here." : "The camera needs a secure (https) connection.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: m }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      setStatus("live");
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
    } catch (e: any) {
      setStatus("error");
      setError(e?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser settings, or choose a photo instead." : e?.name === "NotFoundError" ? "No camera was found on this device." : "The camera couldn't be started.");
    }
  }, [stop]);

  useEffect(() => {
    if (open) { setShot(null); setMode(facing); start(facing); }
    else stop();
    return () => stop();
  }, [open, facing, start, stop]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const file = await frameToFile(v, `photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`);
    setShot({ file, url: URL.createObjectURL(file) });
  };

  const use = () => {
    if (!shot) return;
    onCapture(shot.file);
    onOpenChange(false);
  };

  const switchCamera = () => {
    const next = mode === "user" ? "environment" : "user";
    setMode(next); setShot(null); start(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]" data-testid="camera-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>Position the subject in the frame, then capture.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} playsInline muted className={cn("h-full w-full object-cover", shot && "hidden", mode === "user" && "-scale-x-100")} />
          {shot && <img src={shot.url} alt="Captured" className="h-full w-full object-contain" />}
          {status === "starting" && !shot && (
            <div className="absolute inset-0 flex items-center justify-center text-lilac"><Loader2 className="h-8 w-8 animate-spin" /></div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <Camera className="h-10 w-10 text-lilac" />
              <p className="text-sm text-lilac/90">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="highlight" size="sm" onClick={() => fallbackRef.current?.click()}>Use device camera / choose photo</Button>
                <Button variant="outline" size="sm" onClick={() => start(mode)} className="border-white/30 bg-transparent text-white hover:bg-white/10"><RefreshCw /> Try again</Button>
              </div>
            </div>
          )}
          {canSwitch && status === "live" && !shot && (
            <button type="button" onClick={switchCamera} aria-label="Switch camera" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
        </div>

        <input
          ref={fallbackRef}
          type="file"
          accept="image/*"
          capture={mode}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onCapture(f); onOpenChange(false); } e.target.value = ""; }}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11">Cancel</Button>
          {shot ? (
            <>
              <Button variant="outline" onClick={() => setShot(null)} className="h-11"><RotateCcw /> Retake</Button>
              <Button variant="highlight" onClick={use} className="h-11" data-testid="btn-use-photo"><Check /> Use photo</Button>
            </>
          ) : (
            <Button onClick={capture} disabled={status !== "live"} className="h-11" data-testid="btn-capture-photo"><Camera /> Capture</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ButtonProps {
  onCapture: (file: File) => void;
  label?: string;
  title?: string;
  facing?: "user" | "environment";
  className?: string;
  size?: "default" | "sm" | "icon";
}

/** "Take photo" button that opens the camera and hands back a File — put it next to any image upload. */
export function CameraCaptureButton({ onCapture, label = "Take photo", title, facing, className, size = "default" }: ButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)} className={cn("shrink-0", className)} aria-label={label} title={label} data-testid="btn-take-photo">
        <Camera />{size !== "icon" && label}
      </Button>
      <CameraCaptureDialog open={open} onOpenChange={setOpen} onCapture={onCapture} title={title ?? label} facing={facing} />
    </>
  );
}
