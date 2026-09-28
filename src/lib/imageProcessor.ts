export interface ProcessPhotoOptions {
  targetWidth?: number;
  targetHeight?: number;
  headroomPercent?: number; // e.g. 15 = 15% padding from the top edge
  sidePaddingPercent?: number; // e.g. 8 = 8% padding on left/right
  backgroundColor?: string; // "white", "transparent", or hex
  quality?: number; // 0.85
  format?: "image/webp" | "image/jpeg" | "image/png";
}

/**
 * Loads a File into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Intelligently frames a student portrait with proper headroom and spacing so that
 * when rendered in cards (circular or rounded badges), the student's head and hair
 * are NEVER cut off.
 *
 * Compresses the image to a compact, high-resolution Base64 data URL (~30-50KB)
 * ready to save in the Supabase `students.avatar_path` column.
 */
export async function processStudentPhoto(
  file: File,
  options: ProcessPhotoOptions = {}
): Promise<string> {
  const {
    targetWidth = 500,
    targetHeight = 500,
    headroomPercent = 14, // 14% breathing space at the top
    sidePaddingPercent = 8,
    backgroundColor = "white", // default white backdrop for crisp badges
    quality = 0.86,
    format = "image/jpeg",
  } = options;

  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not initialize canvas 2D context");
  }

  // 1. Draw background
  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }

  // 2. Calculate scaling and positioning with headroom
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  // Available drawing area inside the canvas
  const topPadding = (targetHeight * headroomPercent) / 100;
  const sidePadding = (targetWidth * sidePaddingPercent) / 100;

  const maxDrawWidth = targetWidth - sidePadding * 2;
  const maxDrawHeight = targetHeight - topPadding; // chest/shoulders can extend to bottom

  // Fit image into available bounding box while maintaining aspect ratio
  const scale = Math.min(maxDrawWidth / naturalWidth, maxDrawHeight / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;

  // Horizontally center, position vertically with top headroom
  const drawX = (targetWidth - drawWidth) / 2;
  const drawY = topPadding;

  // 3. High quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the student image
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

  // 4. Export as compressed data URL
  const outputFormat = backgroundColor === "transparent" ? "image/png" : format;
  return canvas.toDataURL(outputFormat, quality);
}
