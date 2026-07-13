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
  const hasNativeNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  // Always true to allow desktop simulations / keyboard wedges to work transparently
  const supported = true;

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
    
    // Blur any focused element (like the click target button) to prevent Enter key conflicts
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!hasNativeNfc) {
      // On desktop, directly transition to scanning state so keyboard wedge & simulator will activate
      setStatus("scanning");
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
  }, [hasNativeNfc]);

  // Global Keyboard Wedge scanner listener
  useEffect(() => {
    console.log("NFC scanner useEffect triggered. Current status:", status);
    if (status !== "scanning") return;

    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("NFC scanner keydown received:", {
        key: e.key,
        code: e.code,
        target: e.target ? (e.target as HTMLElement).tagName : "unknown",
        activeElement: document.activeElement ? document.activeElement.tagName : "none"
      });

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Do not intercept if focused on a text input/textarea (allow normal typing there)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        console.log("NFC scanner: skipped intercept because focus is on input/textarea");
        return;
      }

      if (e.key === "Enter") {
        console.log("NFC scanner: Enter pressed. Buffer:", buffer);
        if (buffer.trim()) {
          const scannedId = buffer.trim();
          buffer = "";
          setStatus("success");
          console.log("NFC scanner: triggering onScan with ID:", scannedId);
          onScanRef.current(scannedId);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.key === "Escape") {
        stop();
      } else if (e.key.length === 1) {
        const now = Date.now();
        // Clear buffer if there is a long pause (> 1 second) since last keystroke (indicating normal typing)
        if (now - lastKeyTime > 1000) {
          console.log("NFC scanner: clearing buffer due to timeout. Previous buffer:", buffer);
          buffer = "";
        }
        buffer += e.key;
        lastKeyTime = now;
        console.log("NFC scanner: buffered key:", e.key, "New buffer:", buffer);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // Use capture phase to intercept early
    return () => {
      console.log("NFC scanner removing keydown listener");
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [status, stop]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  return { supported, status, error, start, stop };
}
