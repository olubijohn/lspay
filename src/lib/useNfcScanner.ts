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
  } catch { /* ignore */ }
}

// ─── Extract UID from Web NFC API event ───────────────────────────────────────
function extractUidFromNfcEvent(event: any): string {
  if (event?.serialNumber) {
    return String(event.serialNumber).replace(/[:\s-]/g, "").toUpperCase();
  }
  try {
    for (const record of event?.message?.records ?? []) {
      if (record.recordType === "text") {
        const val = new TextDecoder(record.encoding ?? "utf-8").decode(record.data).trim();
        if (val) return val.toUpperCase();
      }
      if (record.recordType === "url") {
        const val = new TextDecoder().decode(record.data).trim();
        if (val) return val.toUpperCase();
      }
    }
  } catch { /* ignore */ }
  return "";
}

function cleanUid(raw: string): string {
  return raw.replace(/[:\s-]/g, "").trim().toUpperCase();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNfcScanner(onScan: (id: string) => void) {
  const hasNativeNfc = typeof window !== "undefined" && "NDEFReader" in window;

  const [status, setStatus]   = useState<NfcStatus>("idle");
  const [error, setError]     = useState("");

  // Always-fresh callback — no stale closure
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  const activeRef            = useRef(false);
  const nfcControllerRef     = useRef<AbortController | null>(null);
  // Cleanup for any listener attached to a focused input element
  const inputCleanupRef      = useRef<(() => void) | null>(null);

  // ── Fire a confirmed scan ─────────────────────────────────────────────────
  const fireScan = useCallback((rawId: string) => {
    const uid = cleanUid(rawId);
    if (uid.length < 3) return;

    playBeep();
    setError("");
    setStatus("success");
    onScanRef.current(uid);
    // Stay on "success" — the user sees the UID, assigns the card,
    // then clicks "Scan NFC" again for the next card (which calls start())
  }, []);

  // ── Start scanning ────────────────────────────────────────────────────────
  //   focusTarget: the <input> element to focus so the USB reader types into it.
  //   When provided, we watch the element's native "input" events with a debounce
  //   — this is the most reliable strategy for USB HID / keyboard-wedge readers.
  const start = useCallback(async (focusTarget?: HTMLInputElement | null) => {
    // Tear down any previous input listener
    inputCleanupRef.current?.();
    inputCleanupRef.current = null;

    setError("");
    activeRef.current = true;

    // ── USB HID input-element strategy ──────────────────────────────────────
    if (focusTarget) {
      // Immediately clear the field via native setter so React's onChange fires
      // and hardwareId state resets to "". This ensures each scan starts clean
      // and the reader never appends to a previous card's UID.
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(focusTarget, "");
        focusTarget.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // Focus after a short tick so the button-click blur completes first
      setTimeout(() => {
        if (activeRef.current && focusTarget) {
          focusTarget.focus();
        }
      }, 50);

      // Debounce variables (closed over by the listener, not React state)
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let lastInputTime = 0;

      // USB readers emit input events very fast (< 30 ms between chars).
      // We wait for 120 ms of silence after the last character, then treat
      // whatever is in the field as the complete UID.
      const SCAN_SILENCE_MS = 120;

      const onInputEvent = () => {
        if (!activeRef.current) return;

        lastInputTime = Date.now();

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          if (!activeRef.current) return;

          // Read the current raw value straight from the DOM element
          const raw = focusTarget.value;
          const uid = cleanUid(raw);

          if (uid.length >= 3) {
            fireScan(uid);
          }
        }, SCAN_SILENCE_MS);
      };

      // Also handle Enter sent by the reader (some readers send CR/LF after UID)
      const onKeyDown = (e: KeyboardEvent) => {
        if (!activeRef.current) return;
        if (e.target !== focusTarget) return;
        if (e.key !== "Enter") return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;

        e.preventDefault();
        e.stopPropagation();

        const raw = focusTarget.value;
        const uid = cleanUid(raw);
        if (uid.length >= 3) {
          fireScan(uid);
        }
      };

      focusTarget.addEventListener("input", onInputEvent);
      focusTarget.addEventListener("keydown", onKeyDown, true);

      inputCleanupRef.current = () => {
        focusTarget.removeEventListener("input", onInputEvent);
        focusTarget.removeEventListener("keydown", onKeyDown, true);
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }

    setStatus("scanning");

    // ── Native Web NFC (Android Chrome) ─────────────────────────────────────
    if (hasNativeNfc) {
      try {
        if (nfcControllerRef.current) nfcControllerRef.current.abort();
        const ctrl = new AbortController();
        nfcControllerRef.current = ctrl;

        const reader = new (window as any).NDEFReader();
        await reader.scan({ signal: ctrl.signal });

        reader.onreadingerror = () =>
          setError("Couldn't read that card — please tap again.");

        reader.onreading = (evt: any) => {
          const uid = extractUidFromNfcEvent(evt);
          uid ? fireScan(uid) : setError("Card detected but no UID found.");
        };
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (e?.name === "NotAllowedError") {
          setError("NFC permission denied — please allow NFC and try again.");
          setStatus("error");
          activeRef.current = false;
        } else if (e?.name === "NotSupportedError") {
          // No native NFC chip — fall back silently to USB HID / keyboard-wedge
          setError("");
        } else {
          setError(e?.message ?? "Failed to start NFC reader.");
          setStatus("error");
          activeRef.current = false;
        }
      }
    }
  }, [hasNativeNfc, fireScan]);

  // ── Stop scanning ─────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    inputCleanupRef.current?.();
    inputCleanupRef.current = null;

    activeRef.current = false;
    nfcControllerRef.current?.abort();
    nfcControllerRef.current = null;

    setStatus("idle");
    setError("");
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    inputCleanupRef.current?.();
    activeRef.current = false;
    nfcControllerRef.current?.abort();
  }, []);

  // ── Global keydown fallback (when no input is focused / no focusTarget) ───
  // This covers the case where startNfc() is called without a focusTarget,
  // e.g. from TenantKiosk where there is no specific field to focus.
  // It buffers raw keystrokes and fires on Enter or 120ms silence.
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const clearDebounce = () => {
      if (debounce) { clearTimeout(debounce); debounce = null; }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // If an input/textarea is focused and we've attached a direct listener on it,
      // skip the global handler to avoid double-processing
      const activeEl = document.activeElement;
      const inputFocused = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
      if (inputFocused && inputCleanupRef.current) return;

      const now = Date.now();
      const gap = lastKeyTime > 0 ? now - lastKeyTime : 9999;

      if (e.key === "Enter") {
        clearDebounce();
        const candidate = buffer.trim();
        buffer = "";
        lastKeyTime = 0;
        if (candidate.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          fireScan(candidate);
        }
        return;
      }

      if (e.key === "Escape") {
        clearDebounce();
        buffer = "";
        lastKeyTime = 0;
        return;
      }

      if (e.key.length !== 1) return;

      // Reset buffer if there has been a long pause
      if (gap > 400) {
        clearDebounce();
        buffer = e.key;
      } else {
        buffer += e.key;
      }
      lastKeyTime = now;

      if (buffer.length >= 3) {
        clearDebounce();
        debounce = setTimeout(() => {
          debounce = null;
          if (!activeRef.current) return;
          const candidate = buffer.trim();
          buffer = "";
          lastKeyTime = 0;
          if (candidate.length >= 3) fireScan(candidate);
        }, 120);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearDebounce();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireScan]);

  return { supported: true, status, error, start, stop };
}
