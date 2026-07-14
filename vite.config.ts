import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { exec, spawn } from "child_process";

function nfcWedgePlugin() {
  return {
    name: "nfc-wedge-plugin",
    configureServer() {
      if (process.platform === "win32") {
        console.log("Vite NFC Plugin: Checking NFC Keyboard Wedge status...");
        exec('tasklist /FI "IMAGENAME eq NfcKeyboardWedge.exe"', (err, stdout) => {
          if (err) {
            console.error("Vite NFC Plugin: Error checking NFC Wedge:", err);
            return;
          }
          if (stdout.includes("NfcKeyboardWedge.exe")) {
            console.log("Vite NFC Plugin: NFC Keyboard Wedge is already running.");
          } else {
            console.log("Vite NFC Plugin: Starting NFC Keyboard Wedge...");
            const wedgePath = path.resolve(import.meta.dirname, "nfc-wedge", "NfcKeyboardWedge.exe");
            const child = spawn(wedgePath, [], {
              detached: true,
              stdio: "ignore",
              cwd: path.resolve(import.meta.dirname, "nfc-wedge")
            });
            child.unref();
          }
        });
      }
    }
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), nfcWedgePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
