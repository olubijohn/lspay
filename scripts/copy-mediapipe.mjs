// Copies MediaPipe's WASM runtime from node_modules into public/mediapipe/wasm so LSPay serves it itself
// (no jsdelivr at runtime — school networks and browser shields often block CDNs). Runs before dev/build,
// so the files always match the installed @mediapipe/tasks-vision version. The models live in
// public/mediapipe/models and are committed.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.warn("[copy-mediapipe] @mediapipe/tasks-vision is not installed; skipping (the portrait tool will use the CDN).");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
// Only the classic (non-module) runtime is used: vision_wasm_internal.* and the no-SIMD fallback.
const files = readdirSync(src).filter((f) => /^vision_wasm_(nosimd_)?internal\.(js|wasm)$/.test(f));
for (const f of files) cpSync(join(src, f), join(dest, f));
console.log(`[copy-mediapipe] ${files.length} files -> public/mediapipe/wasm`);
