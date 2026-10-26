// Image quality helpers for the FlashAM gate Add-Employee form
// (Omer, 2026-10-26): CamScanner-style document capture needs (a) a
// sharpness verdict so a blurry / unreadable CNIC scan is rejected at
// the gate with a retake prompt, and (b) an automatic crop to the
// document's edges. Both operate on plain grayscale pixel arrays so
// they are pure and unit-testable; the component wrapper only moves
// pixels between <canvas> and these functions.
//
// Sharpness = variance of the Laplacian (the classic focus measure):
// a sharp document photo carries strong edges (text strokes), a
// blurred one does not. The threshold was set against the downscaled
// analysis size the component uses (max 480px wide): printed-text
// scans measure in the hundreds/thousands, motion-blurred or
// out-of-focus frames fall well under 60.

export const SHARPNESS_MIN = 60; // below this a document scan is "blurry"
export const BRIGHTNESS_MIN = 28; // mean gray below this is "too dark to read"

export function laplacianVariance(gray, width, height) {
  if (!gray || width < 3 || height < 3 || gray.length < width * height) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function meanBrightness(gray) {
  if (!gray || gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

// Verdict for one captured frame: { sharpness, brightness, ok, issues[] }
// issues carries human-readable reasons ('blurry', 'too dark') the UI
// turns into the retake prompt.
export function assessGrayscaleFrame(gray, width, height) {
  const sharpness = laplacianVariance(gray, width, height);
  const brightness = meanBrightness(gray);
  const issues = [];
  if (sharpness < SHARPNESS_MIN) issues.push('blurry');
  if (brightness < BRIGHTNESS_MIN) issues.push('too dark');
  return { sharpness, brightness, ok: issues.length === 0, issues };
}

// Auto-crop: find the document's bounding box from the edge map.
// A document photographed on a gate desk is a large bright rectangle
// against a darker/rougher surround; its border produces a strong
// gradient ring. We threshold the per-pixel gradient, then take the
// tight bounding box of rows/columns whose edge density is meaningful,
// requiring the box to cover a sane share of the frame (else the frame
// is kept whole — a wrong crop is worse than none).
// Returns { x, y, w, h } in source pixel coordinates, or null.
export function detectDocumentBounds(gray, width, height) {
  if (!gray || width < 8 || height < 8) return null;
  const edge = new Float32Array(width * height);
  let maxEdge = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const g = Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + width] - gray[i - width]);
      edge[i] = g;
      if (g > maxEdge) maxEdge = g;
    }
  }
  if (maxEdge < 24) return null; // no real edges at all — keep the frame
  const threshold = maxEdge * 0.35;

  const rowDensity = new Float32Array(height);
  const colDensity = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (edge[row + x] > threshold) { rowDensity[y]++; colDensity[x]++; }
    }
  }
  const rowMin = width * 0.08;
  const colMin = height * 0.08;
  let top = -1, bottom = -1, left = -1, right = -1;
  for (let y = 0; y < height; y++) if (rowDensity[y] > rowMin) { if (top < 0) top = y; bottom = y; }
  for (let x = 0; x < width; x++) if (colDensity[x] > colMin) { if (left < 0) left = x; right = x; }
  if (top < 0 || left < 0) return null;

  const w = right - left + 1;
  const h = bottom - top + 1;
  // The box must be a substantial, document-like region.
  if (w < width * 0.35 || h < height * 0.25) return null;
  if (w > width * 0.995 && h > height * 0.995) return null; // whole frame — no crop needed
  // Small breathing margin back, clamped to the frame.
  const mx = Math.round(width * 0.01);
  const my = Math.round(height * 0.01);
  const x0 = Math.max(0, left - mx);
  const y0 = Math.max(0, top - my);
  const x1 = Math.min(width - 1, right + mx);
  const y1 = Math.min(height - 1, bottom + my);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
