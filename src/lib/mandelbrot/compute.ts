import type { AntialiasMode, AntialiasSamples } from "./types";
import { BAILOUT, DEFAULT_ZOOM, MAX_SAFE_ITERATIONS } from "./constants";
import { smoothColor } from "./worker-utils";

const AUTO_BASE_ITERATIONS = 200;
const AUTO_ITERATIONS_PER_OCTAVE = 50;

/**
 * Auto-calculate iteration count based on zoom depth.
 *
 * As you zoom deeper into the set, the fractal boundary becomes more
 * intricate and needs more iterations to "resolve" — points near the
 * boundary escape very slowly, and with too few iterations they'll be
 * misclassified as interior (black) instead of exterior (colored).
 *
 * Formula: 200 + 50 × log₂(DEFAULT_ZOOM / zoom), clamped to
 * [200, MAX_SAFE_ITERATIONS].
 *   - Default view (zoom=3.5): 200 iterations
 *   - 1,000× zoom:            ~700 iterations
 *   - 10^14× zoom:            ~2550 iterations (standard pipeline limit)
 *   - 10^50× zoom:            ~8750 iterations (perturbation pipeline)
 *   - Beyond:                 capped at `MAX_SAFE_ITERATIONS`
 *
 * The cap balances detail against compute cost. In the perturbation pipeline,
 * each pixel iterates up to `maxIter` times and the BigFloat reference orbit
 * is bounded by the same constant.
 */
export function autoIterations(zoom: number): number {
  const depth = Math.max(0, Math.log2(DEFAULT_ZOOM / zoom));
  return Math.round(
    Math.min(
      MAX_SAFE_ITERATIONS,
      Math.max(
        AUTO_BASE_ITERATIONS,
        AUTO_BASE_ITERATIONS + AUTO_ITERATIONS_PER_OCTAVE * depth,
      ),
    ),
  );
}

/**
 * Resolve the user's anti-aliasing preference to a concrete sample count for
 * worker renders. `auto` uses a light pass at broad views and ramps up once
 * the zoom is deep enough that edge shimmer becomes more noticeable.
 */
export function resolveAntialiasSamples(
  mode: AntialiasMode,
  zoom: number,
): AntialiasSamples {
  if (mode !== "auto") return mode;

  const depth = Math.max(0, Math.log2(DEFAULT_ZOOM / zoom));
  return depth >= 6 ? 4 : 2;
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
function isInCardioid(x0: number, y0: number): boolean {
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
function escapeTime(x0: number, y0: number, maxIter: number): [number, number] {
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

export function computePixelSample(
  x0: number,
  y0: number,
  maxIter: number,
): number {
  if (isInCardioid(x0, y0)) {
    return maxIter;
  }

  const [iter, zMag2] = escapeTime(x0, y0, maxIter);
  return smoothColor(iter, zMag2);
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
      result[rowOffset + px] = computePixelSample(x0, y0, maxIter);
    }
  }

  return result;
}
