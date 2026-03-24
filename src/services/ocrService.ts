/**
 * ocrService.ts
 *
 * Tesseract.js wrapper — lazy-initialized, shared worker (fra + eng).
 *
 * Two public functions:
 *   recognizeText(canvas)  → full text string (for saving with the file)
 *   detectTextBounds(canvas) → bounding box {x,y,w,h} of the main text block
 *                              used as OpenCV fallback when no quad is found
 */

import { createWorker, Worker, RecognizeResult } from 'tesseract.js';

let worker: Worker | null = null;
let initPromise: Promise<Worker> | null = null;

/** Lazy-init: creates & loads the worker once, reuses it for all calls */
async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const w = await createWorker(['fra', 'eng'], 1, {
      // Keep the worker quiet in production
      logger: () => {},
    });
    worker = w;
    return w;
  })();

  return initPromise;
}

/** Pre-warm the Tesseract worker in the background (call early, not on demand) */
export function warmupOCR(): void {
  getWorker().catch(() => {});
}

/** Tear down the worker (call on app unmount / page unload if needed) */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    initPromise = null;
  }
}

// ─── Pre-processing helpers ───────────────────────────────────────────────────

/**
 * Returns a new canvas with adaptive thresholding applied.
 * This dramatically improves OCR accuracy on photos of documents:
 * - Converts to greyscale
 * - Applies a local threshold to handle uneven lighting
 */
function preprocessForOCR(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width  = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d')!;

  // Draw original
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data, width, height } = imgData;

  // Convert to greyscale in-place
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = grey;
  }

  // Simple local mean threshold (block size 15)
  const block = 15;
  const half  = Math.floor(block / 2);
  const out2  = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += data[(ny * width + nx) * 4];
            count++;
          }
        }
      }
      const mean  = sum / count;
      const pixel = data[(y * width + x) * 4];
      const val   = pixel < mean - 8 ? 0 : 255;
      const idx   = (y * width + x) * 4;
      out2[idx] = out2[idx + 1] = out2[idx + 2] = val;
      out2[idx + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(out2, width, height), 0, 0);
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all text from a canvas image.
 * Returns the raw recognized string (trimmed).
 */
export async function recognizeText(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const processed = preprocessForOCR(canvas);
  const result: RecognizeResult = await w.recognize(processed);
  return result.data.text.trim();
}

/**
 * Detect the bounding rectangle of the main text block.
 * Returns { x, y, width, height } in canvas pixels, or null if nothing found.
 *
 * Used as a fallback in ScanPage when OpenCV finds no quadrilateral:
 * the text-block bounding box approximates the document extent.
 */
export async function detectTextBounds(
  canvas: HTMLCanvasElement
): Promise<{ x: number; y: number; w: number; h: number } | null> {
  const w = await getWorker();
  const processed = preprocessForOCR(canvas);
  const result: RecognizeResult = await w.recognize(processed);

  const blocks = result.data.blocks ?? [];
  if (blocks.length === 0) return null;

  // Union all block bboxes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const block of blocks) {
    const b = block.bbox;
    if (b.x0 < minX) minX = b.x0;
    if (b.y0 < minY) minY = b.y0;
    if (b.x1 > maxX) maxX = b.x1;
    if (b.y1 > maxY) maxY = b.y1;
  }

  if (minX === Infinity) return null;

  // Small padding
  const pad = 12;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(canvas.width,  maxX - minX + pad * 2),
    h: Math.min(canvas.height, maxY - minY + pad * 2),
  };
}
