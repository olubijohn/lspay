// Studio portraits for ID cards: finds the student's face, removes the background (pure white),
// and crops a square head-and-shoulders shot with the whole head and hair inside the frame.
//
// Runs fully in the browser with Google MediaPipe (Apache-2.0): photos never leave the device.
//   * FaceDetector (BlazeFace short range) → where the face is
//   * ImageSegmenter (selfie_multiclass_256x256) → person vs background, hair included
// The library and models load on first use only (≈11 MB WASM + ≈16 MB model, then browser-cached).
// LSPay serves them itself (public/mediapipe — models committed, WASM copied by scripts/copy-mediapipe.mjs),
// so no CDN is needed at runtime; the public CDNs are only a fallback.
import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";

// Keep in sync with the installed @mediapipe/tasks-vision version (package.json).
const MEDIAPIPE_VERSION = "1.0.1";
const LOCAL_BASE = new URL(`${import.meta.env.BASE_URL}mediapipe/`, window.location.origin).href;
const SOURCES = [
  {
    name: "LSPay",
    wasm: `${LOCAL_BASE}wasm`,
    face: `${LOCAL_BASE}models/blaze_face_short_range.tflite`,
    segment: `${LOCAL_BASE}models/selfie_multiclass_256x256.tflite`,
  },
  {
    name: "CDN",
    wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
    face: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
    segment: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
  },
];
const LOAD_TIMEOUT_MS = 180_000;

let lastError = "";
/** Why the engine last failed to load (shown to staff). */
export const portraitEngineError = () => lastError;

const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

// Working resolution: long side of the photo while detecting / segmenting.
const WORK_MAX_SIDE = 640;

interface Engine {
  face: FaceDetector;
  /** The segmenter in use — the faster of CPU / GPU once calibrated on the first photo. */
  segmenter: ImageSegmenter;
  /** GPU candidate still waiting to be timed against the CPU one (null once decided or unavailable). */
  gpuCandidate: ImageSegmenter | null;
  delegate: "CPU" | "GPU";
}
let enginePromise: Promise<Engine> | null = null;

/** Is WebGL running on a software rasteriser (no usable GPU)? Then the GPU delegate is ~10× slower than CPU. */
function describeGpu(): { software: boolean; renderer: string } {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    if (!gl) return { software: true, renderer: "no WebGL" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return { software: /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer), renderer };
  } catch {
    return { software: true, renderer: "unknown" };
  }
}

/**
 * Loads MediaPipe once per session. Face detection runs on the CPU (it's tiny). The segmenter is created on
 * both CPU and GPU: which is faster depends on the machine (a real GPU wins; a software/blocklisted one can be
 * 10× slower than the CPU), so the first photo times both and the slower one is closed.
 */
export function loadPortraitEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const errors: string[] = [];
      for (const src of SOURCES) {
        try {
          const fileset = await withTimeout(vision.FilesetResolver.forVisionTasks(src.wasm), LOAD_TIMEOUT_MS, "Loading the AI runtime");
          const segmenterFor = (delegate: "GPU" | "CPU") => vision.ImageSegmenter.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: src.segment, delegate },
            runningMode: "IMAGE",
            outputConfidenceMasks: true,
            outputCategoryMask: false,
          });
          const [face, cpuSeg] = await withTimeout(Promise.all([
            vision.FaceDetector.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: src.face, delegate: "CPU" },
              runningMode: "IMAGE",
              minDetectionConfidence: 0.5,
            }),
            segmenterFor("CPU"),
          ]), LOAD_TIMEOUT_MS, "Loading the AI models");
          let gpuCandidate: ImageSegmenter | null = null;
          const gpu = describeGpu();
          if (gpu.software) {
            console.info(`[portrait] software GPU (${gpu.renderer}) — using CPU`);
          } else {
            try { gpuCandidate = await withTimeout(segmenterFor("GPU"), 30_000, "GPU segmenter"); }
            catch (gpuErr) { console.info("[portrait] GPU unavailable, using CPU", gpuErr); }
          }
          lastError = "";
          console.info(`[portrait] AI engine ready (${src.name})`);
          return { face, segmenter: cpuSeg, gpuCandidate, delegate: "CPU" as const };
        } catch (e: any) {
          const msg = `${src.name}: ${e?.message ?? String(e)}`;
          console.warn("[portrait] engine load failed —", msg, e);
          errors.push(msg);
        }
      }
      throw new Error(errors.join(" · "));
    })().catch((e) => { lastError = e?.message ?? String(e); enginePromise = null; throw e; });
  }
  return enginePromise;
}

export interface PortraitOptions {
  /** Output is a square of this many pixels. */
  size?: number;
  /** Space above the top of the head, as % of the frame (10 snug, 14 balanced, 18 spacious). */
  headroomPercent?: number;
  background?: "white" | "transparent";
  quality?: number;
  /** Receives per-stage timings in ms (for diagnostics). */
  onTimings?: (t: Record<string, number>) => void;
}

export interface PortraitResult {
  dataUrl: string;
  /** A face was found and the crop is centred on it. */
  faceFound: boolean;
  /** The background was replaced (segmentation found a person). */
  backgroundRemoved: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Keeps only the part of the person mask that is connected to the face (removes classmates in the
 * background, bits of fence the model was unsure about, etc.).
 */
function keepConnectedToSeed(alpha: Float32Array, w: number, h: number, seedX: number, seedY: number) {
  const on = (i: number) => alpha[i] > 0.35;
  let seed = Math.round(clamp(seedY, 0, h - 1)) * w + Math.round(clamp(seedX, 0, w - 1));
  if (!on(seed)) {
    // search a small neighbourhood for a foreground pixel to start from
    let found = -1;
    for (let r = 1; r < 40 && found < 0; r++) {
      for (let dy = -r; dy <= r && found < 0; dy += r) for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(seedX) + dx, y = Math.round(seedY) + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && on(y * w + x)) { found = y * w + x; break; }
      }
    }
    if (found < 0) return;
    seed = found;
  }
  const keep = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  queue[tail++] = seed; keep[seed] = 1;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && !keep[i - 1] && on(i - 1)) { keep[i - 1] = 1; queue[tail++] = i - 1; }
    if (x < w - 1 && !keep[i + 1] && on(i + 1)) { keep[i + 1] = 1; queue[tail++] = i + 1; }
    if (y > 0 && !keep[i - w] && on(i - w)) { keep[i - w] = 1; queue[tail++] = i - w; }
    if (y < h - 1 && !keep[i + w] && on(i + w)) { keep[i + w] = 1; queue[tail++] = i + w; }
  }
  // Pixels outside the kept region fade out; soft edge pixels next to it (below threshold) are kept.
  for (let i = 0; i < alpha.length; i++) {
    if (keep[i]) continue;
    if (alpha[i] > 0.35) alpha[i] = 0;
  }
}

/** Resamples a mask to the working size if the segmenter returned a different resolution. */
function resample(src: Float32Array, sw: number, sh: number, w: number, h: number): Float32Array {
  if (sw === w && sh === h) return src;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor((y / h) * sh));
    for (let x = 0; x < w; x++) out[y * w + x] = src[sy * sw + Math.min(sw - 1, Math.floor((x / w) * sw))];
  }
  return out;
}

/** Makes an ID-card headshot: white background, face-centred square crop with head-safe headroom. */
export async function makeStudioPortrait(file: File, options: PortraitOptions = {}): Promise<PortraitResult> {
  const { size = 512, headroomPercent = 14, background = "white", quality = 0.9 } = options;
  const engine = await loadPortraitEngine();
  const { face } = engine;
  const times: Record<string, number> = {};
  let mark = performance.now();
  const lap = (name: string) => { const now = performance.now(); times[name] = Math.round(now - mark); mark = now; };

  // 1. Small working copy for the AI + mask maths; the full-resolution photo is kept for the final render.
  const source = await decode(file);
  lap("decode");
  const scale = Math.min(1, WORK_MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const work = document.createElement("canvas");
  work.width = w; work.height = h;
  const wctx = work.getContext("2d")!;
  wctx.drawImage(source, 0, 0, w, h);
  lap("resize");

  // 2. Face: the largest confident detection is the student
  const detections = face.detect(work).detections ?? [];
  lap("face");
  const best = detections
    .filter((d) => d.boundingBox)
    .sort((a, b) => b.boundingBox!.width * b.boundingBox!.height - a.boundingBox!.width * a.boundingBox!.height)[0];
  const box = best?.boundingBox;
  const faceFound = !!box;

  // 3. Person mask (1 − background confidence; hair, skin, clothes and accessories all count as person)
  if (engine.gpuCandidate) {
    // First photo of the session: time GPU against CPU and keep the faster one.
    const gpu = engine.gpuCandidate;
    engine.gpuCandidate = null;
    // Time a full segmentation *including* reading the mask back — GPU calls return before the work is done.
    const timeRun = (s: ImageSegmenter) => {
      const t = performance.now();
      const r = s.segment(work);
      try { r.confidenceMasks?.[0]?.getAsFloat32Array(); } finally { r.close(); }
      return performance.now() - t;
    };
    try {
      timeRun(engine.segmenter); // CPU warm-up
      const cpuMs = timeRun(engine.segmenter);
      // One GPU run (includes shader compile). If even that is far slower than the CPU, the GPU is software /
      // blocklisted — stop there instead of paying for another slow run.
      let gpuMs = timeRun(gpu);
      if (gpuMs < cpuMs * 3) gpuMs = timeRun(gpu); // plausible: time it again without the compile
      if (gpuMs < cpuMs) { engine.segmenter.close(); engine.segmenter = gpu; engine.delegate = "GPU"; }
      else gpu.close();
      console.info(`[portrait] segmenter: GPU ${gpuMs.toFixed(0)} ms vs CPU ${cpuMs.toFixed(0)} ms → using ${engine.delegate}`);
    } catch (e) {
      console.info("[portrait] GPU segmenter failed, using CPU", e);
      try { gpu.close(); } catch { /* already gone */ }
    }
    lap("calibrate");
  }
  const seg = engine.segmenter.segment(work);
  let alpha: Float32Array | null = null;
  try {
    const bgMask = seg.confidenceMasks?.[0];
    if (bgMask) {
      const bg = resample(bgMask.getAsFloat32Array(), bgMask.width, bgMask.height, w, h);
      alpha = new Float32Array(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = 1 - bg[i];
    }
  } finally {
    seg.close();
  }
  lap("segment");

  let backgroundRemoved = false;
  let maskCanvas: HTMLCanvasElement | null = null;
  if (alpha) {
    if (box) {
      const cx = box.originX + box.width / 2, cy = box.originY + box.height / 2;
      keepConnectedToSeed(alpha, w, h, cx, cy);
      // anything far to the side of the student fades out (other people, background clutter) — per-column factor
      const reach = box.width * 2.8;
      const col = new Float32Array(w);
      for (let x = 0; x < w; x++) { const d = Math.abs(x - cx); col[x] = d > reach ? 1 - smoothstep(reach, reach * 1.25, d) : 1; }
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) if (col[x] < 1) alpha[i] *= col[x];
    }
    // crisp but soft edges
    let fg = 0;
    const mask = new ImageData(w, h);
    const md = mask.data;
    for (let i = 0; i < alpha.length; i++) {
      const v = alpha[i];
      const a = v <= 0.2 ? 0 : v >= 0.8 ? 1 : smoothstep(0.2, 0.8, v);
      alpha[i] = a;
      if (a > 0.5) fg++;
      md[i * 4 + 3] = (a * 255) | 0;
    }
    backgroundRemoved = fg > w * h * 0.02;
    if (backgroundRemoved) {
      maskCanvas = document.createElement("canvas");
      maskCanvas.width = w; maskCanvas.height = h;
      maskCanvas.getContext("2d")!.putImageData(mask, 0, 0);
    }
  }

  // 4. Crop: square frame, head top at `headroomPercent`, head ≈ 52% of the frame height (shows shoulders)
  let left: number, top: number, side: number;
  if (box) {
    const cx = box.originX + box.width / 2;
    let headTop = box.originY - box.height * 0.6;               // fallback: typical hair height above the box
    if (alpha && backgroundRemoved) {
      const x0 = Math.round(clamp(cx - box.width * 0.55, 0, w - 1)), x1 = Math.round(clamp(cx + box.width * 0.55, 0, w - 1));
      const yStart = Math.max(0, Math.round(box.originY - box.height * 1.5));
      scan: for (let y = yStart; y < box.originY; y++) {
        for (let x = x0; x <= x1; x++) if (alpha[y * w + x] > 0.5) { headTop = y; break scan; }
      }
    }
    const chin = box.originY + box.height * 1.05;
    const headH = Math.max(chin - headTop, box.height);
    side = Math.max(headH / 0.52, box.width * 2.3);
    top = headTop - (headroomPercent / 100) * side;
    left = cx - side / 2;
  } else if (alpha && backgroundRemoved) {
    // no face: frame the person's bounding box from the top
    let minX = w, maxX = 0, minY = h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 0.5) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y;
    }
    side = Math.min(Math.max(maxX - minX, 1) * 1.15, Math.max(w, h));
    top = minY - (headroomPercent / 100) * side;
    left = (minX + maxX) / 2 - side / 2;
  } else {
    // nothing recognised: whole photo, fitted
    side = Math.max(w, h);
    left = (w - side) / 2;
    top = 0;
  }

  lap("mask");
  // 5. Render at output size only: the full-resolution photo for sharpness, the small mask scaled up for the
  //    cut-out. Areas beyond the photo stay white, so off-edge crops look seamless.
  const k = size / side;
  const sx = clamp(left, 0, w), sy = clamp(top, 0, h);
  const ex = clamp(left + side, 0, w), ey = clamp(top + side, 0, h);
  const dx = (sx - left) * k, dy = (sy - top) * k, dw = (ex - sx) * k, dh = (ey - sy) * k;

  const cut = document.createElement("canvas");
  cut.width = size; cut.height = size;
  const cctx = cut.getContext("2d")!;
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  if (ex > sx && ey > sy) {
    // same region in full-resolution source pixels
    cctx.drawImage(source, sx / scale, sy / scale, (ex - sx) / scale, (ey - sy) / scale, dx, dy, dw, dh);
    if (maskCanvas) {
      cctx.globalCompositeOperation = "destination-in";
      cctx.filter = `blur(${Math.max(0.6, k * 0.6).toFixed(2)}px)`; // feather the cut-out edge
      cctx.drawImage(maskCanvas, sx, sy, ex - sx, ey - sy, dx, dy, dw, dh);
      cctx.filter = "none";
      cctx.globalCompositeOperation = "source-over";
    }
  }
  if ("close" in source && typeof (source as ImageBitmap).close === "function") (source as ImageBitmap).close();

  let out = cut;
  if (background === "white") {
    out = document.createElement("canvas");
    out.width = size; out.height = size;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#FFFFFF";
    octx.fillRect(0, 0, size, size);
    octx.drawImage(cut, 0, 0);
  }

  const dataUrl = background === "transparent" ? out.toDataURL("image/png") : out.toDataURL("image/jpeg", quality);
  lap("render");
  options.onTimings?.(times);
  return { dataUrl, faceFound, backgroundRemoved };
}
