import { rgb } from "d3-color";
import {
  interpolateBlues,
  interpolateBrBG,
  interpolateBuGn,
  interpolateBuPu,
  interpolateCividis,
  interpolateCool,
  interpolateCubehelixDefault,
  interpolateGnBu,
  interpolateGreens,
  interpolateGreys,
  interpolateInferno,
  interpolateMagma,
  interpolateOrRd,
  interpolateOranges,
  interpolatePRGn,
  interpolatePiYG,
  interpolatePlasma,
  interpolatePuBu,
  interpolatePuBuGn,
  interpolatePuOr,
  interpolatePuRd,
  interpolatePurples,
  interpolateRainbow,
  interpolateRdBu,
  interpolateRdGy,
  interpolateRdPu,
  interpolateRdYlBu,
  interpolateRdYlGn,
  interpolateReds,
  interpolateSinebow,
  interpolateSpectral,
  interpolateTurbo,
  interpolateViridis,
  interpolateWarm,
  interpolateYlGn,
  interpolateYlGnBu,
  interpolateYlOrBr,
  interpolateYlOrRd,
} from "d3-scale-chromatic";
import type { ColorScheme } from "./types";

export type RGB = readonly [number, number, number];

const LUT_SIZE = 256;
const SWATCH_SAMPLE_COUNT = 5;

/**
 * The hand-authored palettes are still defined as a small set of stops, then
 * expanded into 256-sample LUTs so the custom and D3-derived schemes share the
 * same runtime representation.
 */
const BUILTIN_STOP_PALETTES = {
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
} satisfies Partial<Record<ColorScheme, readonly RGB[]>>;

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
 * the palette's RGB LUT samples.
 *
 * The LUT samples are treated as evenly spaced across [0, 1]. With N samples,
 * there are N-1 segments. The value t selects which segment we're in, and the
 * fractional position within that segment drives the linear interpolation
 * between its two endpoint colors.
 *
 * Example with 256 samples (255 segments):
 *   t=0.0   → lut[0]
 *   t=0.5   → around lut[128]
 *   t=0.125 → around lut[32]
 */
export function interpolatePalette(stops: readonly RGB[], t: number): RGB {
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

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbStringToTriplet(color: string): RGB {
  const parsed = rgb(color);
  return [
    clampChannel(parsed.r),
    clampChannel(parsed.g),
    clampChannel(parsed.b),
  ];
}

function createPaletteLutFromStops(stops: readonly RGB[]): RGB[] {
  const palette: RGB[] = [];

  for (let index = 0; index < LUT_SIZE; index++) {
    palette.push(interpolatePalette(stops, index / (LUT_SIZE - 1)));
  }

  return palette;
}

function createPaletteLutFromInterpolator(
  interpolator: (t: number) => string,
): RGB[] {
  const palette: RGB[] = [];

  for (let index = 0; index < LUT_SIZE; index++) {
    palette.push(rgbStringToTriplet(interpolator(index / (LUT_SIZE - 1))));
  }

  return palette;
}

const PALETTES = {
  classic: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.classic),
  fire: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.fire),
  ocean: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.ocean),
  grayscale: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.grayscale),
  psychedelic: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.psychedelic),
  ice: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.ice),
  neon: createPaletteLutFromStops(BUILTIN_STOP_PALETTES.neon),
  rainbow: createPaletteLutFromInterpolator(interpolateRainbow),
  sinebow: createPaletteLutFromInterpolator(interpolateSinebow),
  brbg: createPaletteLutFromInterpolator(interpolateBrBG),
  prgn: createPaletteLutFromInterpolator(interpolatePRGn),
  piyg: createPaletteLutFromInterpolator(interpolatePiYG),
  puor: createPaletteLutFromInterpolator(interpolatePuOr),
  rdbu: createPaletteLutFromInterpolator(interpolateRdBu),
  rdgy: createPaletteLutFromInterpolator(interpolateRdGy),
  rdylbu: createPaletteLutFromInterpolator(interpolateRdYlBu),
  rdylgn: createPaletteLutFromInterpolator(interpolateRdYlGn),
  spectral: createPaletteLutFromInterpolator(interpolateSpectral),
  blues: createPaletteLutFromInterpolator(interpolateBlues),
  bugn: createPaletteLutFromInterpolator(interpolateBuGn),
  bupu: createPaletteLutFromInterpolator(interpolateBuPu),
  cividis: createPaletteLutFromInterpolator(interpolateCividis),
  cool: createPaletteLutFromInterpolator(interpolateCool),
  "cubehelix-default": createPaletteLutFromInterpolator(
    interpolateCubehelixDefault,
  ),
  gnbu: createPaletteLutFromInterpolator(interpolateGnBu),
  greens: createPaletteLutFromInterpolator(interpolateGreens),
  greys: createPaletteLutFromInterpolator(interpolateGreys),
  inferno: createPaletteLutFromInterpolator(interpolateInferno),
  magma: createPaletteLutFromInterpolator(interpolateMagma),
  orrd: createPaletteLutFromInterpolator(interpolateOrRd),
  oranges: createPaletteLutFromInterpolator(interpolateOranges),
  plasma: createPaletteLutFromInterpolator(interpolatePlasma),
  pubu: createPaletteLutFromInterpolator(interpolatePuBu),
  pubugn: createPaletteLutFromInterpolator(interpolatePuBuGn),
  purd: createPaletteLutFromInterpolator(interpolatePuRd),
  purples: createPaletteLutFromInterpolator(interpolatePurples),
  rdpu: createPaletteLutFromInterpolator(interpolateRdPu),
  reds: createPaletteLutFromInterpolator(interpolateReds),
  turbo: createPaletteLutFromInterpolator(interpolateTurbo),
  viridis: createPaletteLutFromInterpolator(interpolateViridis),
  warm: createPaletteLutFromInterpolator(interpolateWarm),
  ylgn: createPaletteLutFromInterpolator(interpolateYlGn),
  ylgnbu: createPaletteLutFromInterpolator(interpolateYlGnBu),
  ylorbr: createPaletteLutFromInterpolator(interpolateYlOrBr),
  ylorrd: createPaletteLutFromInterpolator(interpolateYlOrRd),
} satisfies Record<ColorScheme, RGB[]>;

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
  const len = iterations.length;
  // 4 bytes per pixel: R, G, B, A
  const rgba = new Uint8ClampedArray(len * 4);

  for (let i = 0; i < len; i++) {
    const iter = iterations[i] ?? maxIter;
    const offset = i * 4;
    const color = colorFromSmoothIteration(iter, maxIter, scheme);
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 255;
  }

  return rgba;
}

export function colorFromSmoothIteration(
  iter: number,
  maxIter: number,
  scheme: ColorScheme,
): RGB {
  if (iter >= maxIter) {
    return [0, 0, 0];
  }

  const palette = PALETTES[scheme];
  const t = (iter % 256) / 256;
  return interpolatePalette(palette, t);
}

export const COLOR_SCHEME_NAMES: Record<ColorScheme, string> = {
  classic: "Classic",
  fire: "Fire",
  ocean: "Ocean",
  grayscale: "Grayscale",
  psychedelic: "Psychedelic",
  ice: "Ice",
  neon: "Neon",
  rainbow: "Rainbow",
  sinebow: "Sinebow",
  brbg: "BrBG",
  prgn: "PRGn",
  piyg: "PiYG",
  puor: "PuOr",
  rdbu: "RdBu",
  rdgy: "RdGy",
  rdylbu: "RdYlBu",
  rdylgn: "RdYlGn",
  spectral: "Spectral",
  blues: "Blues",
  bugn: "BuGn",
  bupu: "BuPu",
  cividis: "Cividis",
  cool: "Cool",
  "cubehelix-default": "Cubehelix Default",
  gnbu: "GnBu",
  greens: "Greens",
  greys: "Greys",
  inferno: "Inferno",
  magma: "Magma",
  orrd: "OrRd",
  oranges: "Oranges",
  plasma: "Plasma",
  pubu: "PuBu",
  pubugn: "PuBuGn",
  purd: "PuRd",
  purples: "Purples",
  rdpu: "RdPu",
  reds: "Reds",
  turbo: "Turbo",
  viridis: "Viridis",
  warm: "Warm",
  ylgn: "YlGn",
  ylgnbu: "YlGnBu",
  ylorbr: "YlOrBr",
  ylorrd: "YlOrRd",
};

export function getSwatchColors(scheme: ColorScheme): string[] {
  const swatches: string[] = [];

  for (let index = 0; index < SWATCH_SAMPLE_COUNT; index++) {
    const t = index / (SWATCH_SAMPLE_COUNT - 1);
    const [r, g, b] = interpolatePalette(PALETTES[scheme], t);
    swatches.push(`rgb(${r}, ${g}, ${b})`);
  }

  return swatches;
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
