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
    console.log("NFC keyboard-wedge listener active. Status:", status);
    if (status !== "scanning") return;

    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (e.key === "Enter") {
        if (isInput && activeEl instanceof HTMLInputElement) {
          const val = activeEl.value.trim();
          console.log("NFC scanner: Enter pressed inside input. Value:", val);
          if (val) {
            e.preventDefault();
            e.stopPropagation();
            setStatus("success");
            const scannedId = val.toUpperCase();
            console.log("NFC scanner: Triggering onScan (focused) with ID:", scannedId);
            onScanRef.current(scannedId);
          }
        } else {
          console.log("NFC scanner: Enter pressed outside input. Buffer:", buffer);
          if (buffer.trim()) {
            e.preventDefault();
            e.stopPropagation();
            const scannedId = buffer.trim().toUpperCase();
            buffer = "";
            setStatus("success");
            console.log("NFC scanner: Triggering onScan (unfocused) with ID:", scannedId);
            onScanRef.current(scannedId);
          }
        }
      } else if (e.key === "Escape") {
        stop();
      } else if (e.key.length === 1) {
        if (isInput) {
          // If focused on an input, let the browser handle key input naturally.
          // The wedge scanner will type directly into the input.
          console.log("NFC scanner: keystroke typed into focused input:", e.key);
          return;
        }
        
        // Otherwise, buffer the keys since we are unfocused.
        const now = Date.now();
        if (now - lastKeyTime > 1000) {
          buffer = "";
        }
        buffer += e.key;
        lastKeyTime = now;
        console.log("NFC scanner: buffered key (unfocused):", e.key, "New buffer:", buffer);
      }
    };

    // Use capture phase (true) to intercept keys before they reach input elements
    window.addEventListener("keydown", handleKeyDown, true);
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
