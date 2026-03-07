import {
  add,
  div,
  make,
  mul,
  scientific,
  sub,
  type IBigFloat,
} from "bigfloat-esnext";
import { getDivisionPrecisionForZoom } from "./precision";

/**
 * Higher bailout values produce smoother color gradients at the escape boundary
 * because they let |z|² grow larger before we declare "escaped," giving the
 * smooth-coloring log-log formula more dynamic range to work with. The classic
 * bailout is 4 (radius 2), but 256 (radius 16) is used here for much smoother
 * color transitions at virtually no extra cost per pixel.
 */
const BAILOUT = 256;
const LOG2 = Math.log(2);
const PRECISE_TWO = make("2");

function preciseToApproxNumber(value: IBigFloat): number {
  return Number(scientific(value));
}

/**
 * The default zoom level of 3.5 corresponds to the "standard view" of the
 * Mandelbrot set: a viewport ~3.5 units wide on the complex plane, centered
 * at (-0.5, 0), which frames the full set with a little padding. The zoom
 * value represents the height of the visible region in complex-plane units.
 */
const DEFAULT_ZOOM = 3.5;

/**
 * Auto-calculate iteration count based on zoom depth.
 *
 * As you zoom deeper into the set, the fractal boundary becomes more
 * intricate and needs more iterations to "resolve" — points near the
 * boundary escape very slowly, and with too few iterations they'll be
 * misclassified as interior (black) instead of exterior (colored).
 *
 * The formula: 200 + 50 * log₂(3.5 / zoom), clamped to [200, 5000].
 * Each doubling of magnification adds 50 iterations. At the default view
 * (zoom=3.5), depth=0 so we get the base 200. At 1000x zoom we get ~700.
 */
export function autoIterations(zoom: number): number {
  // log₂(DEFAULT_ZOOM / zoom) measures how many "doublings" deep we are.
  // At default zoom this is 0; at 2x zoom it's 1; at 4x zoom it's 2, etc.
  const depth = Math.max(0, Math.log2(DEFAULT_ZOOM / zoom));
  return Math.round(Math.min(5000, Math.max(200, 200 + 50 * depth)));
}

/**
 * Fast rejection test for points known to be inside the Mandelbrot set.
 *
 * The Mandelbrot set has two large connected regions where we can skip the
 * expensive escape-time iteration entirely, because we know analytically
 * that these points will never escape:
 *
 * 1. **Main cardioid** — the large heart-shaped body, centered at (0.25, 0).
 *    A point (x₀, y₀) is inside the cardioid iff:
 *      q(q + (x₀ - ¼)) ≤ ¼y₀²
 *    where q = (x₀ - ¼)² + y₀². This is derived from the parametric equation
 *    of the cardioid boundary: c = ½eⁱᶿ - ¼e²ⁱᶿ.
 *
 * 2. **Period-2 bulb** — the circular "head" to the left of the cardioid,
 *    centered at (-1, 0) with radius ¼. A point is inside iff:
 *      (x₀ + 1)² + y₀² ≤ 1/16
 *
 * Together these two regions cover roughly 25% of the visible area at the
 * default zoom level, so this check saves significant computation.
 */
export function isInCardioid(x0: number, y0: number): boolean {
  // Main cardioid: the big heart-shaped region
  const q = (x0 - 0.25) * (x0 - 0.25) + y0 * y0;
  if (q * (q + (x0 - 0.25)) <= 0.25 * y0 * y0) return true;

  // Period-2 bulb: the circular bulb centered at (-1, 0), radius 0.25
  if ((x0 + 1) * (x0 + 1) + y0 * y0 <= 0.0625) return true;

  return false;
}

/**
 * Core Mandelbrot escape-time algorithm.
 *
 * For a complex number c = x₀ + y₀i, we iterate: z_{n+1} = z_n² + c
 * starting from z₀ = 0. If |z|² ever exceeds BAILOUT, the point has
 * "escaped" and is NOT in the Mandelbrot set. If we reach maxIter without
 * escaping, the point is (probably) in the set.
 *
 * The iteration is written in "optimized form" to avoid redundant
 * multiplications:
 *   - x2 = x² and y2 = y² are cached across iterations
 *   - The complex multiply z² = (x+yi)² expands to (x²-y²) + (2xy)i
 *   - Adding c gives: new_x = x²-y² + x₀,  new_y = 2xy + y₀
 *
 * @returns [iterations, |z|²] — the iteration count when it escaped (or
 *   maxIter if it didn't), and the final magnitude squared of z. Both are
 *   needed for smooth coloring.
 */
export function escapeTime(
  x0: number,
  y0: number,
  maxIter: number,
): [number, number] {
  let x = 0; // Real part of z
  let y = 0; // Imaginary part of z
  let x2 = 0; // x² (cached to avoid recomputing)
  let y2 = 0; // y² (cached to avoid recomputing)
  let i = 0;

  // The escape condition |z|² > BAILOUT is equivalent to x²+y² > BAILOUT.
  // Note: y is computed BEFORE x because the new y needs the OLD x value.
  while (x2 + y2 <= BAILOUT && i < maxIter) {
    y = 2 * x * y + y0; // Imaginary part: 2xy + y₀
    x = x2 - y2 + x0; // Real part: x² - y² + x₀
    x2 = x * x;
    y2 = y * y;
    i++;
  }

  return [i, x2 + y2];
}

/**
 * Smooth (fractional) iteration count, eliminating the visible "banding"
 * that occurs with integer iteration counts.
 *
 * The raw integer iteration count produces discrete color bands. To get a
 * continuous value, we use the "normalized iteration count" formula:
 *
 *   smoothed = iter + 1 - log₂(log₂(|z|))
 *            = iter + 1 - log(log(√(x²+y²))) / log(2)
 *            = iter + 1 - log(½ · log(x²+y²)) / log(2)
 *
 * Intuition: when z escapes, |z|² might be anywhere from BAILOUT to much
 * larger. Two pixels with the same integer iteration count but different
 * final |z|² values are at different "fractional progress" toward the next
 * iteration. The double-logarithm maps this residual magnitude to a smooth
 * [0,1) fraction, giving gradient-like color transitions instead of bands.
 *
 * For interior points (|z|² ≤ BAILOUT after maxIter), we return the raw
 * iteration count, which maps to solid black via the color palette.
 */
export function smoothColor(iterations: number, zMag2: number): number {
  if (zMag2 <= BAILOUT) return iterations; // Interior point — didn't escape
  // Math.sqrt(zMag2) = |z|, then double-log normalizes the residual escape
  return iterations + 1 - Math.log(Math.log(Math.sqrt(zMag2))) / LOG2;
}

/**
 * Compute a horizontal band (stripe) of the Mandelbrot set.
 *
 * The canvas is divided into horizontal bands for streaming/interruptible
 * rendering. Each band is a contiguous horizontal slice of the full image.
 *
 * **Coordinate mapping (screen pixels → complex plane):**
 *
 * The view is defined by (centerX, centerY, zoom), where zoom is the height
 * of the visible region in complex-plane units. The width is derived from
 * the aspect ratio: visibleWidth = zoom × (canvasWidth / canvasHeight).
 *
 * ```
 *   Complex plane                     Screen pixels
 *   ┌─────────────────┐               ┌─────────────────┐
 *   │ xMin,yMin       │               │ (0,0)           │
 *   │     ●center     │  ◄── maps ──► │     ●center     │
 *   │       xMax,yMax │               │       (W,H)     │
 *   └─────────────────┘               └─────────────────┘
 * ```
 *
 * For each pixel (px, py):
 *   x₀ = xMin + px × pixelWidth    (real component)
 *   y₀ = yMin + py × pixelHeight   (imaginary component)
 *
 * Where:
 *   xMin = centerX - (zoom/2) × aspectRatio
 *   yMin = centerY - (zoom/2)
 *   pixelWidth  = (zoom × aspectRatio) / canvasWidth
 *   pixelHeight = zoom / canvasHeight
 *
 * @returns Float64Array of smooth iteration counts, one per pixel in the band.
 *   Interior points get maxIter; exterior points get fractional values for
 *   smooth coloring.
 */
export function computeBand(
  width: number,
  fullHeight: number,
  startY: number,
  bandHeight: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number,
): Float64Array {
  const result = new Float64Array(width * bandHeight);
  const aspectRatio = width / fullHeight;
  const halfZoom = zoom / 2;

  // Top-left corner of the viewport in complex-plane coordinates
  const xMin = centerX - halfZoom * aspectRatio;
  const yMin = centerY - halfZoom;
  // Size of one pixel in complex-plane units
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / fullHeight;

  for (let localY = 0; localY < bandHeight; localY++) {
    // py is the absolute y position in the full canvas (not band-local)
    const py = startY + localY;
    // Map pixel row to imaginary axis coordinate
    const y0 = yMin + py * pixelHeight;
    const rowOffset = localY * width;

    for (let px = 0; px < width; px++) {
      // Map pixel column to real axis coordinate
      const x0 = xMin + px * pixelWidth;

      // Fast analytical check: skip iteration for known interior regions
      if (isInCardioid(x0, y0)) {
        result[rowOffset + px] = maxIter;
        continue;
      }

      const [iter, zMag2] = escapeTime(x0, y0, maxIter);
      result[rowOffset + px] = smoothColor(iter, zMag2);
    }
  }

  return result;
}

export function computeBandPrecise(
  width: number,
  fullHeight: number,
  startY: number,
  bandHeight: number,
  centerX: string,
  centerY: string,
  zoom: string,
  maxIter: number,
  precision = getDivisionPrecisionForZoom(zoom, Math.max(width, fullHeight)),
): Float64Array {
  const result = new Float64Array(width * bandHeight);
  const widthBig = make(String(width));
  const heightBig = make(String(fullHeight));
  const zoomBig = make(zoom);
  const aspectRatio = div(widthBig, heightBig, precision);
  const halfZoom = div(zoomBig, PRECISE_TWO, precision);
  const xMin = sub(make(centerX), mul(halfZoom, aspectRatio));
  const yMin = sub(make(centerY), halfZoom);
  const pixelWidth = div(mul(zoomBig, aspectRatio), widthBig, precision);
  const pixelHeight = div(zoomBig, heightBig, precision);
  let y0 = add(yMin, mul(make(String(startY)), pixelHeight));

  for (let localY = 0; localY < bandHeight; localY++) {
    const rowOffset = localY * width;
    let x0 = xMin;
    const y0Number = preciseToApproxNumber(y0);

    for (let px = 0; px < width; px++) {
      const x0Number = preciseToApproxNumber(x0);

      if (isInCardioid(x0Number, y0Number)) {
        result[rowOffset + px] = maxIter;
        x0 = add(x0, pixelWidth);
        continue;
      }

      const [iter, zMag2] = escapeTime(x0Number, y0Number, maxIter);
      result[rowOffset + px] = smoothColor(iter, zMag2);
      x0 = add(x0, pixelWidth);
    }

    y0 = add(y0, pixelHeight);
  }

  return result;
}

/**
 * Compute the entire Mandelbrot frame at once (non-streaming variant).
 * Same coordinate mapping as computeBand, but processes the full canvas
 * in a single pass. Used as a simpler entry point when streaming is not needed.
 */
export function computeFrame(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number,
): Float64Array {
  const result = new Float64Array(width * height);
  const aspectRatio = width / height;
  const halfZoom = zoom / 2;

  const xMin = centerX - halfZoom * aspectRatio;
  const yMin = centerY - halfZoom;
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / height;

  for (let py = 0; py < height; py++) {
    const y0 = yMin + py * pixelHeight;
    const rowOffset = py * width;

    for (let px = 0; px < width; px++) {
      const x0 = xMin + px * pixelWidth;

      if (isInCardioid(x0, y0)) {
        result[rowOffset + px] = maxIter;
        continue;
      }

      const [iter, zMag2] = escapeTime(x0, y0, maxIter);
      result[rowOffset + px] = smoothColor(iter, zMag2);
    }
  }

  return result;
}
