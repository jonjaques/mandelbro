import type { ColorScheme } from "./types";

type RGB = [number, number, number];

/**
 * Color palettes for the Mandelbrot set visualization.
 *
 * Each palette is defined as 5 RGB color stops. The iteration count is mapped
 * to a value in [0, 1) (see mapToColors), then that value is used to
 * interpolate between these stops. The stops are evenly spaced across [0, 1],
 * so with 5 stops we get 4 segments of linear interpolation.
 *
 * The palettes are designed to be visually cyclic (or at least smooth at the
 * wrap boundary) because the iteration-to-color mapping wraps every 256
 * iterations. Non-cyclic palettes (like "ice") produce a visible seam at the
 * 256-boundary, which is only noticeable at high iteration counts.
 */
const PALETTES: Record<ColorScheme, RGB[]> = {
  classic: [
    [0, 7, 100], // Deep blue (Ultra Fractal "classic" inspired)
    [32, 107, 203], // Medium blue
    [237, 255, 255], // Near-white cyan
    [255, 170, 0], // Warm orange
    [0, 2, 0], // Near-black green (wraps back toward start)
  ],
  fire: [
    [0, 0, 0],
    [128, 0, 0],
    [255, 65, 0],
    [255, 200, 0],
    [255, 255, 200],
  ],
  ocean: [
    [0, 0, 30],
    [0, 51, 102],
    [0, 128, 200],
    [100, 200, 255],
    [200, 240, 255],
  ],
  grayscale: [
    [0, 0, 0],
    [128, 128, 128],
    [255, 255, 255],
    [128, 128, 128],
    [0, 0, 0], // Symmetric: wraps cleanly back to black
  ],
  psychedelic: [
    [255, 0, 100],
    [255, 255, 0],
    [0, 255, 100],
    [0, 100, 255],
    [200, 0, 255],
  ],
  ice: [
    [0, 0, 40],
    [50, 80, 160],
    [130, 180, 230],
    [200, 230, 255],
    [255, 255, 255],
  ],
  neon: [
    [0, 0, 0],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 0],
    [0, 255, 0],
  ],
};

/**
 * Linear interpolation (lerp) between two RGB colors.
 * t=0 returns color `a`, t=1 returns color `b`, values between blend linearly.
 * This is done in sRGB space (not perceptually uniform), which is standard
 * for fractal coloring and fast to compute.
 */
function interpolateColor(a: RGB, b: RGB, t: number): RGB {
  const [ar, ag, ab] = a;
  const [br, bg, bb] = b;
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

/**
 * Map a normalized value t ∈ [0, 1] to an RGB color by interpolating through
 * the palette's color stops.
 *
 * The palette stops are treated as evenly spaced across [0, 1]. With N stops,
 * there are N-1 segments. The value t selects which segment we're in, and the
 * fractional position within that segment drives the linear interpolation
 * between its two endpoint colors.
 *
 * Example with 5 stops (4 segments):
 *   t=0.0  → stop[0]
 *   t=0.25 → stop[1]
 *   t=0.5  → stop[2]
 *   t=0.125 → halfway between stop[0] and stop[1]
 */
export function interpolatePalette(stops: RGB[], t: number): RGB {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1) return stops[0] ?? [0, 0, 0];

  const clampedT = Math.max(0, Math.min(1, t));
  const segCount = stops.length - 1;
  // Scale t to "segment space" — e.g. with 4 segments, t=0.5 → seg=2.0
  const seg = clampedT * segCount;
  // Which segment are we in? Clamp to last valid segment.
  const idx = Math.min(Math.floor(seg), segCount - 1);
  // How far through this segment? (0 = at start stop, 1 = at end stop)
  const localT = seg - idx;
  const start = stops[idx] ?? stops[0] ?? [0, 0, 0];
  const end = stops[idx + 1] ?? stops[stops.length - 1] ?? start;
  return interpolateColor(start, end, localT);
}

/**
 * Convert a Float64Array of smooth iteration counts into RGBA pixel data.
 *
 * The mapping works as follows:
 * - **Interior points** (iter >= maxIter): rendered as solid black (alpha=255).
 *   These are points that didn't escape — they're "in" the Mandelbrot set.
 *
 * - **Exterior points** (iter < maxIter): the smooth iteration count is mapped
 *   to a palette color using a cycling scheme. The formula `(iter % 256) / 256`
 *   produces a value in [0, 1) that cycles every 256 iterations, creating
 *   repeating color bands as you zoom deeper. This cycling prevents the palette
 *   from stretching to invisibility at high iteration counts.
 *
 * @returns Uint8ClampedArray of RGBA values (4 bytes per pixel), suitable for
 *   direct use with ImageData.
 */
export function mapToColors(
  iterations: Float64Array,
  maxIter: number,
  scheme: ColorScheme,
): Uint8ClampedArray {
  const palette = PALETTES[scheme];
  const len = iterations.length;
  // 4 bytes per pixel: R, G, B, A
  const rgba = new Uint8ClampedArray(len * 4);

  for (let i = 0; i < len; i++) {
    const iter = iterations[i] ?? maxIter;
    const offset = i * 4;

    if (iter >= maxIter) {
      // Interior point — always black, full opacity
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 255;
    } else {
      // Exterior point — map fractional iteration count to color.
      // The modulo 256 creates repeating color cycles (like contour lines).
      // Because `iter` is fractional (from smoothColor), the transitions
      // between bands are smooth gradients rather than hard edges.
      const t = (iter % 256) / 256;
      const color = interpolatePalette(palette, t);
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }

  return rgba;
}

export const COLOR_SCHEME_NAMES: Record<ColorScheme, string> = {
  classic: "Classic",
  fire: "Fire",
  ocean: "Ocean",
  grayscale: "Grayscale",
  psychedelic: "Psychedelic",
  ice: "Ice",
  neon: "Neon",
};

export function getSwatchColors(scheme: ColorScheme): string[] {
  return PALETTES[scheme].map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);
}

/**
 * Returns CSS gradient + glow color sampled from the bright inner range
 * of a palette, suitable for the brand mark.
 */
export function getBrandColors(scheme: ColorScheme): {
  gradient: string;
  glow: string;
} {
  const palette = PALETTES[scheme];
  const samples = 6;
  const start = 0.15;
  const end = 0.85;
  const colors: string[] = [];

  for (let i = 0; i < samples; i++) {
    const t = start + (end - start) * (i / (samples - 1));
    const [r, g, b] = interpolatePalette(palette, t);
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }

  // Glow: sample the brightest-feeling point (60% through the palette)
  const [gr, gg, gb] = interpolatePalette(palette, 0.6);

  return {
    gradient: `linear-gradient(90deg, ${colors.join(", ")})`,
    glow: `rgb(${gr}, ${gg}, ${gb})`,
  };
}
