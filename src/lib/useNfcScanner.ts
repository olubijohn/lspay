import { useCallback, useEffect, useRef, useState } from "react";

export type NfcStatus = "idle" | "scanning" | "success" | "error";

// ─── Audio feedback ────────────────────────────────────────────────────────────
function playBeep() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Ignore audio context errors
  }
}

function cleanUid(raw: string): string {
  return raw.replace(/[:\s-]/g, "").trim().toUpperCase();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNfcScanner(onScan: (id: string) => void) {
  const [status, setStatus] = useState<NfcStatus>("idle");
  const [error, setError] = useState("");

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  const nfcControllerRef = useRef<AbortController | null>(null);

  // ── Fire a confirmed scan ─────────────────────────────────────────────────
  const fireScan = useCallback((rawId: string) => {
    const uid = cleanUid(rawId);
    if (uid.length < 3) return;

    playBeep();
    setError("");
    setStatus("success");

    onScanRef.current(uid);

    // After 1 second reset status back to idle
    setTimeout(() => {
      setStatus("idle");
    }, 1000);
  }, []);

  // ── Start scanning ────────────────────────────────────────────────────────
  const start = useCallback(async (focusTarget?: HTMLInputElement | null) => {
    setError("");
    setStatus("scanning");

    if (focusTarget) {
      setTimeout(() => {
        focusTarget.focus();
        focusTarget.select();
      }, 30);
    }

    // Native Web NFC (Android Chrome) support if present
    if (typeof window !== "undefined" && "NDEFReader" in window) {
      try {
        if (nfcControllerRef.current) nfcControllerRef.current.abort();
        const ctrl = new AbortController();
        nfcControllerRef.current = ctrl;

        const reader = new (window as any).NDEFReader();
        await reader.scan({ signal: ctrl.signal });

        reader.onreadingerror = () =>
          setError("Couldn't read that card — please tap again.");

        reader.onreading = (evt: any) => {
          if (evt?.serialNumber) {
            fireScan(evt.serialNumber);
          }
        };
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          // If native NFC is not supported/allowed, keyboard wedge remains active
          console.warn("Native Web NFC not active, using USB wedge mode:", e);
        }
      }
    }
  }, [fireScan]);

  // ── Stop scanning ─────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    nfcControllerRef.current?.abort();
    nfcControllerRef.current = null;
    setStatus("idle");
    setError("");
  }, []);

  useEffect(() => () => {
    nfcControllerRef.current?.abort();
  }, []);

  // ── Global Keyboard Wedge Reader listener ────────────────────────────────
  // Listens directly for USB NFC reader keystrokes (e.g. ACR122U, ACR1252, etc.).
  // When a card is tapped, the reader / wedge types the UID + presses Enter.
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore system shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const gap = lastKeyTime > 0 ? now - lastKeyTime : 9999;

      // ── Handle Enter Key (Standard USB RFID/NFC reader terminator) ─────────
      if (e.key === "Enter") {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }

        const candidate = buffer.trim();
        buffer = "";
        lastKeyTime = 0;

        if (candidate.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          fireScan(candidate);
          return;
        }

        // If buffer was empty but an active input has text from the scanner
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement && activeEl.value.trim().length >= 3) {
          const val = activeEl.value.trim();
          e.preventDefault();
          e.stopPropagation();
          fireScan(val);
          return;
        }
        return;
      }

      if (e.key === "Escape") {
        buffer = "";
        lastKeyTime = 0;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length !== 1) return;

      // If gap between keystrokes is > 300ms, start a new buffer for the new card
      if (gap > 300) {
        buffer = e.key;
      } else {
        buffer += e.key;
      }
      lastKeyTime = now;

      // Fallback: in case a reader does NOT send Enter, auto-fire after 300ms pause
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (buffer.length >= 4) {
        fallbackTimer = setTimeout(() => {
          fallbackTimer = null;
          const candidate = buffer.trim();
          // Only auto-fire if it looks like a valid card UID
          if (candidate.length >= 4) {
            buffer = "";
            lastKeyTime = 0;
            fireScan(candidate);
          }
        }, 300);
      }
    };

    // Use capture phase on window to catch all keystrokes from USB wedge
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [fireScan]);

  return { supported: true, status, error, start, stop };
}
