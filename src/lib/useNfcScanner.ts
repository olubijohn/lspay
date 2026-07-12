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
    if (status !== "scanning") return;

    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement;
      // If focused in the simulator custom input, let it handle keypresses locally
      if (activeEl && activeEl.id === "nfc-sim-input") {
        return;
      }

      if (e.key === "Enter") {
        if (buffer.trim()) {
          const scannedId = buffer.trim();
          buffer = "";
          setStatus("success");
          onScanRef.current(scannedId);
        }
      } else if (e.key === "Escape") {
        stop();
      } else if (e.key.length === 1) {
        const now = Date.now();
        // Clear buffer if there is a long pause (> 1 second) since last keystroke (indicating normal manual typing)
        if (now - lastKeyTime > 1000) {
          buffer = "";
        }
        buffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [status, stop]);

  // Desktop Simulator UI portal overlay
  useEffect(() => {
    if (status !== "scanning" || hasNativeNfc) {
      const existing = document.getElementById("nfc-desktop-simulator");
      if (existing) existing.remove();
      return;
    }

    const container = document.createElement("div");
    container.id = "nfc-desktop-simulator";
    container.className = "fixed bottom-6 right-6 z-[99999] w-96 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 font-sans";
    
    container.style.boxShadow = "0 25px 50px -12px rgba(16, 185, 129, 0.25), 0 0 40px rgba(0, 0, 0, 0.5)";
    container.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    container.style.background = "rgba(15, 23, 42, 0.95)";
    container.style.backdropFilter = "blur(12px)";
    container.style.color = "#f8fafc";
    container.style.fontFamily = "system-ui, -apple-system, sans-serif";

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; position: relative;">
          <div style="width: 10px; height: 10px; border-radius: 9999px; background: #10b981; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 10px; height: 10px; border-radius: 9999px; background: #10b981; position: absolute; left: 0; top: 0;"></div>
          <span style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #34d399; letter-spacing: 0.05em;">NFC Desktop Simulator</span>
        </div>
        <button id="nfc-sim-close" style="color: #94a3b8; background: transparent; border: none; font-size: 20px; font-weight: bold; cursor: pointer; padding: 0 4px; transition: color 0.2s;">&times;</button>
      </div>
      <p style="font-size: 11px; color: #cbd5e1; margin-bottom: 16px; line-height: 1.5;">
        Tap a quick mock card to simulate a scan, type a custom card ID, or scan with a USB NFC reader.
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em;">Quick Simulate Cards</div>
        
        <button class="nfc-mock-btn" data-id="NFC-9982" style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s; color: white;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #f1f5f9;">Emma Johnson</div>
            <div style="font-size: 10px; font-family: monospace; color: #94a3b8;">ID: NFC-9982</div>
          </div>
          <span style="color: #34d399; font-size: 12px; font-weight: 800; font-family: monospace;">₦45.50</span>
        </button>

        <button class="nfc-mock-btn" data-id="NFC-4421" style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s; color: white;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #f1f5f9;">Liam Davis</div>
            <div style="font-size: 10px; font-family: monospace; color: #94a3b8;">ID: NFC-4421</div>
          </div>
          <span style="color: #34d399; font-size: 12px; font-weight: 800; font-family: monospace;">₦32.00</span>
        </button>

        <button class="nfc-mock-btn" data-id="NFC-7733" style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s; color: white;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #f1f5f9;">Isabella Wilson</div>
            <div style="font-size: 10px; font-family: monospace; color: #94a3b8;">ID: NFC-7733</div>
          </div>
          <span style="color: #34d399; font-size: 12px; font-weight: 800; font-family: monospace;">₦15.00</span>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em;">Custom Card ID</div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="nfc-sim-input" placeholder="e.g. NFC-1234" style="flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: white; outline: none; font-family: monospace;" />
          <button id="nfc-sim-submit" style="background: #10b981; border: none; border-radius: 8px; padding: 8px 16px; color: white; font-weight: 700; font-size: 12px; cursor: pointer; transition: background 0.2s;">Tap</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Style pings keyframe
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
      @keyframes ping {
        75%, 100% {
          transform: scale(2);
          opacity: 0;
        }
      }
      .nfc-mock-btn:hover {
        border-color: #10b981 !important;
        background: #334155 !important;
        transform: translateY(-1px);
      }
      #nfc-sim-close:hover {
        color: #f1f5f9 !important;
      }
      #nfc-sim-submit:hover {
        background: #059669 !important;
      }
    `;
    document.head.appendChild(styleSheet);

    const closeBtn = container.querySelector("#nfc-sim-close");
    closeBtn?.addEventListener("click", () => {
      stop();
    });

    const mockButtons = container.querySelectorAll(".nfc-mock-btn");
    mockButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = (e.currentTarget as HTMLButtonElement).getAttribute("data-id");
        if (id) {
          setStatus("success");
          onScanRef.current(id);
          container.remove();
        }
      });
    });

    const submitBtn = container.querySelector("#nfc-sim-submit");
    const inputField = container.querySelector("#nfc-sim-input") as HTMLInputElement;
    const triggerSubmit = () => {
      const id = inputField.value.trim();
      if (id) {
        setStatus("success");
        onScanRef.current(id);
        container.remove();
      }
    };
    submitBtn?.addEventListener("click", triggerSubmit);
    inputField?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        triggerSubmit();
      }
    });

    return () => {
      container.remove();
      styleSheet.remove();
    };
  }, [status, hasNativeNfc, stop]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  return { supported, status, error, start, stop };
}
