import { useCallback, useEffect, useRef, useState } from "react";

export type NfcStatus = "idle" | "scanning" | "success" | "error";

function normalizeNfcId(event: any): string {
  if (event?.serialNumber) {
    return String(event.serialNumber).toUpperCase();
  }
  try {
    for (const record of event?.message?.records ?? []) {
      if (record.recordType === "text") {
        const decoder = new TextDecoder(record.encoding || "utf-8");
        return decoder.decode(record.data).trim();
      }
      if (record.recordType === "url") {
        return new TextDecoder().decode(record.data).trim();
      }
    }
  } catch {
    /* ignore decode errors */
  }
  return "";
}

export function useNfcScanner(onScan: (id: string) => void) {
  const supported =
    typeof window !== "undefined" && "NDEFReader" in window;

  const [status, setStatus] = useState<NfcStatus>("idle");
  const [error, setError] = useState("");

  const controllerRef = useRef<AbortController | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setStatus((s) => (s === "scanning" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!supported) {
      setStatus("error");
      setError(
        "NFC scanning isn't available here. Open this app in Chrome or Edge on an Android device with NFC turned on."
      );
      return;
    }
    try {
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const reader = new (window as any).NDEFReader();
      await reader.scan({ signal: controller.signal });
      setStatus("scanning");

      reader.onreadingerror = () => {
        setError("Couldn't read that card. Please tap it again.");
      };
      reader.onreading = (event: any) => {
        const id = normalizeNfcId(event);
        if (id) {
          setStatus("success");
          onScanRef.current(id);
        } else {
          setError("Card read but no ID found on it.");
        }
      };
    } catch (e: any) {
      setStatus("error");
      if (e?.name === "NotAllowedError") {
        setError("NFC permission was denied. Allow NFC access and try again.");
      } else if (e?.name === "NotSupportedError") {
        setError("No NFC hardware found, or NFC is switched off on this device.");
      } else {
        setError(e?.message || "Failed to start the NFC scanner.");
      }
    }
  }, [supported]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  return { supported, status, error, start, stop };
}
