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
import {
  bytesToOklch,
  maxChroma,
  mixOklch,
  oklchToBytes,
  type Gamut,
  type Oklch,
} from "./oklch";

export type RGB = readonly [number, number, number];

const LUT_SIZE = 256;
const SWATCH_SAMPLE_COUNT = 5;

/**
 * The hand-authored palettes are still defined as a small set of stops, then
 * expanded into 256-sample LUTs so the custom and D3-derived schemes share the
 * same runtime representation.
 */
type BuiltinStopKey =
  "classic" | "fire" | "ocean" | "grayscale" | "psychedelic" | "ice" | "neon";

const BUILTIN_STOP_PALETTES: Record<BuiltinStopKey, readonly RGB[]> = {
  classic: [
    [0, 7, 100],
    [32, 107, 203],
    [237, 255, 255],
    [255, 170, 0],
    [0, 2, 0],
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
    [0, 0, 0],
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
 * P3-optimized palette stops. In display-p3, [255, 0, 0] is the P3 red primary
 * which is substantially more saturated than sRGB red. These stops push into
 * P3's extended gamut territory — more saturated primaries, deeper darks, and
 * purer hues that are impossible in sRGB.
 */
const BUILTIN_STOP_PALETTES_P3: Record<BuiltinStopKey, readonly RGB[]> = {
  classic: [
    [0, 0, 140], // Deeper blue — P3 blues are richer
    [0, 90, 255], // Saturated azure riding the blue primary
    [190, 255, 255], // Cyan highlight with real chroma (was near-white)
    [255, 140, 0], // Hotter orange — P3 red/orange extends further
    [0, 2, 0],
  ],
  fire: [
    [0, 0, 0],
    [160, 0, 0], // Deeper crimson — P3 reds are much more saturated
    [255, 30, 0], // Scorching red-orange
    [255, 180, 0], // Vivid amber
    [255, 255, 180], // Hot white core
  ],
  ocean: [
    [0, 0, 50], // Deeper abyss
    [0, 30, 130], // Rich deep blue
    [0, 110, 220], // Vivid cerulean
    [60, 200, 255], // Electric cyan
    [180, 240, 255],
  ],
  grayscale: BUILTIN_STOP_PALETTES.grayscale,
  psychedelic: [
    [255, 0, 80], // P3 hot pink — beyond sRGB
    [255, 255, 0], // Pure P3 yellow
    [0, 255, 60], // Electric green — P3's biggest gamut advantage
    [0, 60, 255], // Deep electric blue
    [220, 0, 255], // Vivid violet
  ],
  ice: [
    [0, 0, 80], // Darker abyss
    [15, 50, 210], // Deeper sapphire
    [60, 160, 255], // Electric sky, riding the blue/cyan edge
    [150, 220, 255], // More chromatic glacial cyan
    [255, 255, 255],
  ],
  neon: [
    [0, 0, 0],
    [255, 0, 255], // P3 magenta — already at gamut boundary, stunning
    [0, 255, 255], // P3 cyan — electric
    [255, 255, 0], // P3 yellow — blazing
    [0, 255, 0], // P3 green — the biggest visual leap from sRGB
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
function interpolatePalette(stops: readonly RGB[], t: number): RGB {
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

function buildD3Palettes(): Record<
  Exclude<ColorScheme, BuiltinStopKey>,
  RGB[]
> {
  return {
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
  };
}

function buildBuiltinPalettes(
  stops: Record<BuiltinStopKey, readonly RGB[]>,
): Record<BuiltinStopKey, RGB[]> {
  const entries = Object.entries(stops) as [BuiltinStopKey, readonly RGB[]][];
  return Object.fromEntries(
    entries.map(([key, s]) => [key, createPaletteLutFromStops(s)]),
  ) as Record<BuiltinStopKey, RGB[]>;
}

const d3Palettes = buildD3Palettes();

const PALETTES_SRGB: Record<ColorScheme, RGB[]> = {
  ...buildBuiltinPalettes(BUILTIN_STOP_PALETTES),
  ...d3Palettes,
};

/**
 * Base chroma multiplier applied in wide-gamut mode (before the user's
 * vibrance setting). Chosen to exceed the implicit saturation gain the old
 * renderer got from reinterpreting sRGB bytes as P3 coordinates (~1.2×), so
 * enabling P3 is a strict vibrancy upgrade. Chroma is clamped to the P3
 * gamut surface per LUT entry, so overshoot just rides the boundary.
 */
const P3_CHROMA_BOOST = 1.35;

/** Chroma multipliers this close to 1 in sRGB mode take the identity path. */
const NEUTRAL_VIBRANCE_EPSILON = 1e-3;

/**
 * Boost chroma toward the gamut surface at constant lightness and hue: the
 * most saturated displayable version of the color, short of changing what
 * color it *is*.
 */
function vividBytes(color: Oklch, gamut: Gamut, chromaBoost: number): RGB {
  const C = Math.min(color.C * chromaBoost, maxChroma(color.L, color.h, gamut));
  return oklchToBytes({ ...color, C }, gamut);
}

/**
 * Build a LUT by interpolating stops in OKLCH instead of encoded RGB.
 *
 * Straight RGB lerps between vivid stops cut through the dark, desaturated
 * interior of the gamut (measured up to −56% chroma at segment midpoints for
 * the psychedelic palette). Interpolating lightness/hue perceptually and then
 * pushing chroma to the gamut surface keeps every entry vivid through the
 * transitions.
 */
function createVividLutFromStops(
  stops: readonly RGB[],
  gamut: Gamut,
  chromaBoost: number,
): RGB[] {
  const lchStops = stops.map((stop) => bytesToOklch(stop, gamut));
  const segCount = lchStops.length - 1;
  const lut: RGB[] = [];

  for (let index = 0; index < LUT_SIZE; index++) {
    const t = index / (LUT_SIZE - 1);
    const seg = Math.min(Math.floor(t * segCount), segCount - 1);
    const start = lchStops[seg];
    const end = lchStops[seg + 1];
    if (!start || !end) continue;
    const mixed = mixOklch(start, end, t * segCount - seg);
    lut.push(vividBytes(mixed, gamut, chromaBoost));
  }

  return lut;
}

/**
 * Re-express an existing sRGB LUT (the D3 schemes, or any palette under a
 * non-neutral vibrance) in the target gamut with scaled chroma. Unlike the
 * old byte-reinterpretation trick this is hue-faithful: the color is decoded
 * as the sRGB color it actually is, then made more vivid.
 */
function createVividLutFromSrgbLut(
  baseLut: readonly RGB[],
  gamut: Gamut,
  chromaBoost: number,
): RGB[] {
  return baseLut.map((entry) =>
    vividBytes(bytesToOklch(entry, "srgb"), gamut, chromaBoost),
  );
}

function isBuiltinStopKey(scheme: ColorScheme): scheme is BuiltinStopKey {
  return scheme in BUILTIN_STOP_PALETTES;
}

/**
 * LUTs are built lazily per (scheme, gamut, boost) because vibrance is a
 * continuous user setting. A build costs well under a millisecond; the cap
 * just keeps slider scrubbing from accumulating stale LUTs forever.
 */
const paletteCache = new Map<string, RGB[]>();
const PALETTE_CACHE_LIMIT = 64;

function getPalette(
  scheme: ColorScheme,
  wideGamut: boolean,
  vibrance: number,
): RGB[] {
  if (!wideGamut && Math.abs(vibrance - 1) < NEUTRAL_VIBRANCE_EPSILON) {
    return PALETTES_SRGB[scheme];
  }

  const gamut: Gamut = wideGamut ? "display-p3" : "srgb";
  const chromaBoost = wideGamut ? P3_CHROMA_BOOST * vibrance : vibrance;
  const key = `${scheme}|${gamut}|${chromaBoost.toFixed(4)}`;

  const cached = paletteCache.get(key);
  if (cached) return cached;

  const lut =
    wideGamut && isBuiltinStopKey(scheme)
      ? createVividLutFromStops(
          BUILTIN_STOP_PALETTES_P3[scheme],
          gamut,
          chromaBoost,
        )
      : createVividLutFromSrgbLut(PALETTES_SRGB[scheme], gamut, chromaBoost);

  if (paletteCache.size >= PALETTE_CACHE_LIMIT) {
    paletteCache.clear();
  }
  paletteCache.set(key, lut);
  return lut;
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
  cyclePeriod = 256,
  wideGamut = false,
  vibrance = 1,
): Uint8ClampedArray {
  const len = iterations.length;
  const rgba = new Uint8ClampedArray(len * 4);
  const palette = getPalette(scheme, wideGamut, vibrance);

  for (let i = 0; i < len; i++) {
    const iter = iterations[i] ?? maxIter;
    const offset = i * 4;
    if (iter >= maxIter) {
      rgba[offset + 3] = 255;
      continue;
    }
    const t = (iter % cyclePeriod) / cyclePeriod;
    const color = interpolatePalette(palette, t);
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
  cyclePeriod = 256,
  wideGamut = false,
  vibrance = 1,
): RGB {
  if (iter >= maxIter) {
    return [0, 0, 0];
  }

  const palette = getPalette(scheme, wideGamut, vibrance);
  const t = (iter % cyclePeriod) / cyclePeriod;
  return interpolatePalette(palette, t);
}

/**
 * Compute a color cycle period appropriate for the current zoom level.
 * At normal zoom the full 256-iteration cycle is used. At deep zoom,
 * iteration counts are much higher and adjacent pixels differ by fewer
 * iterations relative to the cycle length, washing out visible color
 * variation. Shortening the cycle at deep zoom compresses more of the
 * palette into the visible iteration range.
 */
export function zoomColorCyclePeriod(zoom: number): number {
  if (zoom >= 1e-8) return 256;
  const depth = Math.max(0, -Math.log10(zoom) - 8);
  return Math.max(24, Math.round(256 / (1 + depth * 0.3)));
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

export function getSwatchColors(
  scheme: ColorScheme,
  wideGamut = false,
  vibrance = 1,
): string[] {
  const swatches: string[] = [];
  const palette = getPalette(scheme, wideGamut, vibrance);

  for (let index = 0; index < SWATCH_SAMPLE_COUNT; index++) {
    const t = index / (SWATCH_SAMPLE_COUNT - 1);
    const [r, g, b] = interpolatePalette(palette, t);
    if (wideGamut) {
      swatches.push(
        `color(display-p3 ${(r / 255).toFixed(4)} ${(g / 255).toFixed(4)} ${(b / 255).toFixed(4)})`,
      );
    } else {
      swatches.push(`rgb(${r}, ${g}, ${b})`);
    }
  }

  return swatches;
}
