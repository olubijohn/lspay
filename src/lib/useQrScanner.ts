import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export type QrStatus = "idle" | "scanning" | "success" | "error";

export function useQrScanner(onScan: (id: string) => void) {
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const [status, setStatus] = useState<QrStatus>("idle");
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setStatus((s) => (s === "scanning" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!supported) {
      setStatus("error");
      setError(
        "Camera scanning isn't available here. Use a device with a camera and allow camera access."
      );
      return;
    }
    if (!videoRef.current) {
      setStatus("error");
      setError("Camera preview is not ready yet. Please try again.");
      return;
    }
    try {
      if (controlsRef.current) controlsRef.current.stop();
      const reader = new BrowserQRCodeReader();
      setStatus("scanning");
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, _err, ctrl) => {
          if (result) {
            const text = result.getText().trim();
            if (text) {
              setStatus("success");
              ctrl.stop();
              controlsRef.current = null;
              onScanRef.current(text);
            }
          }
        }
      );
      controlsRef.current = controls;
    } catch (e: any) {
      setStatus("error");
      if (e?.name === "NotAllowedError") {
        setError("Camera permission was denied. Allow camera access and try again.");
      } else if (e?.name === "NotFoundError" || e?.name === "NotReadableError") {
        setError("No camera was found, or it is being used by another app.");
      } else {
        setError(e?.message || "Failed to start the camera scanner.");
      }
    }
  }, [supported]);

  useEffect(() => {
    return () => {
      if (controlsRef.current) controlsRef.current.stop();
    };
  }, []);

  return { supported, status, error, start, stop, videoRef };
}
