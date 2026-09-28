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
  return raw.replace(/[:\s\-]/g, "").trim().toUpperCase();
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

    // After 1.5 seconds reset status back to scanning (not idle) so
    // the reader stays ready for the next card
    setTimeout(() => {
      setStatus((prev) => (prev === "success" ? "idle" : prev));
    }, 1500);
  }, []);

  // ── Start scanning ────────────────────────────────────────────────────────
  const start = useCallback(
    async (focusTarget?: HTMLInputElement | null) => {
      setError("");
      setStatus("scanning");

      if (focusTarget) {
        // Small delay so the button click completes before we steal focus
        setTimeout(() => {
          focusTarget.focus();
          focusTarget.select();
        }, 50);
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
            // Native NFC not supported/allowed – USB wedge mode will handle it
            console.warn("Native Web NFC not active, using USB wedge mode:", e);
          }
        }
      }
    },
    [fireScan]
  );

  // ── Stop scanning ─────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    nfcControllerRef.current?.abort();
    nfcControllerRef.current = null;
    setStatus("idle");
    setError("");
  }, []);

  useEffect(
    () => () => {
      nfcControllerRef.current?.abort();
    },
    []
  );

  // ── Global Keyboard Wedge Reader listener ────────────────────────────────
  // Listens for USB HID NFC reader keystrokes globally on window.
  // Most USB readers type the UID in < 50 ms total then press Enter.
  // We use a generous 500 ms inter-key gap so slow readers still work.
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    // Maximum gap (ms) between keystrokes from the SAME card read.
    // USB HID is very fast (< 5 ms per char), but some readers have a
    // 200-400 ms startup delay before the FIRST character.  We use a
    // separate "first-char" window handled by the fallback timer instead
    // of resetting the buffer mid-read.
    const INTER_KEY_GAP_MS = 500;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore system shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const gap = lastKeyTime > 0 ? now - lastKeyTime : 0;

      // ── Handle Enter Key (Standard USB RFID/NFC reader terminator) ──────
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

        // If buffer was empty/short, check active input value (some readers
        // type directly into the focused field)
        const activeEl = document.activeElement;
        if (
          activeEl instanceof HTMLInputElement &&
          activeEl.value.trim().length >= 3
        ) {
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

      // If gap between successive keystrokes exceeds the threshold,
      // start a fresh buffer — this is a new card read, not a continuation.
      // NOTE: we only reset when lastKeyTime > 0 (i.e. we have seen at least
      // one previous key), so the very first char of any read always starts
      // a fresh buffer cleanly.
      if (lastKeyTime > 0 && gap > INTER_KEY_GAP_MS) {
        buffer = e.key;
      } else {
        buffer += e.key;
      }
      lastKeyTime = now;

      // Fallback: auto-fire after 500 ms of silence if reader omits Enter
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (buffer.length >= 4) {
        fallbackTimer = setTimeout(() => {
          fallbackTimer = null;
          const candidate = buffer.trim();
          if (candidate.length >= 4) {
            buffer = "";
            lastKeyTime = 0;
            fireScan(candidate);
          }
        }, 500);
      }
    };

    // Capture phase on window — catches keystrokes from USB wedge even when
    // focus is on a button or outside any input.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [fireScan]);

  return { supported: true, status, error, start, stop };
}
