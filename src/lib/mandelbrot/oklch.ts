/**
 * Minimal OKLab/OKLCH color math for palette construction.
 *
 * Everything here runs at LUT-build time (not per pixel) and is worker-safe
 * (no DOM). Two gamuts are supported: sRGB and display-p3. Both share the
 * sRGB transfer curve; they differ only in the linear-RGB ↔ LMS matrices.
 *
 * OKLab/OKLCH is used because its chroma axis is perceptually meaningful:
 * scaling C makes a color more vivid without shifting its hue or lightness,
 * and clamping C to the gamut boundary ("riding the gamut surface") yields
 * the most saturated displayable color for a given hue and lightness.
 *
 * Matrices: sRGB↔LMS from Björn Ottosson's OKLab reference; P3↔LMS is the
 * product of the CSS Color 4 display-p3→XYZ(D65) matrix and Ottosson's
 * XYZ→LMS matrix (precomputed, verified to round-trip).
 *
 * @see https://bottosson.github.io/posts/oklab/
 */

export type Gamut = "srgb" | "display-p3";

export interface Oklch {
  /** Perceptual lightness, 0 (black) to 1 (white) */
  L: number;
  /** Chroma (0 = achromatic; P3 gamut tops out around 0.37) */
  C: number;
  /** Hue angle in degrees */
  h: number;
}

/** Below this chroma a color is treated as achromatic (hue is meaningless). */
export const ACHROMATIC_EPSILON = 0.004;

type Vec3 = [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];

const SRGB_TO_LMS: Mat3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_SRGB: Mat3 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const P3_TO_LMS: Mat3 = [
  [0.4813272911960763, 0.4620679116724795, 0.0564956028735719],
  [0.2288381013317354, 0.6532343999261818, 0.1179544131901985],
  [0.0839860177938747, 0.2242727892997344, 0.6922208388786099],
];
const LMS_TO_P3: Mat3 = [
  [3.1281105290323103, -2.2570750183548696, 0.1293047884378314],
  [-1.0911281609083132, 2.4132667617599544, -0.3221681708589348],
  [-0.0260136497064855, -0.5080276489512764, 1.5333166822296189],
];

const LMS_CUBED_TO_OKLAB: Mat3 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const OKLAB_TO_LMS_CUBED: Mat3 = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.0638541728],
  [1.0, -0.0894841775, -1.291485548],
];

function mul(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** sRGB transfer curve (also used by display-p3). Encoded → linear. */
function toLinear(u: number): number {
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

/** sRGB transfer curve (also used by display-p3). Linear → encoded. */
function toEncoded(u: number): number {
  return u <= 0.0031308 ? u * 12.92 : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
}

function rgbToLms(gamut: Gamut): Mat3 {
  return gamut === "display-p3" ? P3_TO_LMS : SRGB_TO_LMS;
}

function lmsToRgb(gamut: Gamut): Mat3 {
  return gamut === "display-p3" ? LMS_TO_P3 : LMS_TO_SRGB;
}

/**
 * Convert 0–255 channel bytes to OKLCH. The bytes are interpreted as
 * coordinates in `gamut` — the same triplet names a different (more
 * saturated) color when read as display-p3 versus sRGB.
 */
export function bytesToOklch(
  rgb: readonly [number, number, number],
  gamut: Gamut,
): Oklch {
  const linear: Vec3 = [
    toLinear(rgb[0] / 255),
    toLinear(rgb[1] / 255),
    toLinear(rgb[2] / 255),
  ];
  const lms = mul(rgbToLms(gamut), linear);
  const lmsRoot: Vec3 = [
    Math.cbrt(lms[0]),
    Math.cbrt(lms[1]),
    Math.cbrt(lms[2]),
  ];
  const [L, a, b] = mul(LMS_CUBED_TO_OKLAB, lmsRoot);
  return {
    L,
    C: Math.hypot(a, b),
    h: (Math.atan2(b, a) * 180) / Math.PI,
  };
}

function oklchToLinear(L: number, C: number, hDeg: number, gamut: Gamut): Vec3 {
  const h = (hDeg * Math.PI) / 180;
  const lmsRoot = mul(OKLAB_TO_LMS_CUBED, [
    L,
    C * Math.cos(h),
    C * Math.sin(h),
  ]);
  const lms: Vec3 = [lmsRoot[0] ** 3, lmsRoot[1] ** 3, lmsRoot[2] ** 3];
  return mul(lmsToRgb(gamut), lms);
}

const GAMUT_EPSILON = 1e-6;

function isInGamut(linear: Vec3): boolean {
  return linear.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);
}

/**
 * Convert OKLCH to 0–255 channel bytes in `gamut`, clamping each channel.
 * Callers are expected to have already limited chroma via `maxChroma`, so the
 * clamp only cleans up float noise at the gamut boundary.
 */
export function oklchToBytes(
  color: Oklch,
  gamut: Gamut,
): [number, number, number] {
  const linear = oklchToLinear(color.L, color.C, color.h, gamut);
  return [
    Math.round(
      Math.max(0, Math.min(1, toEncoded(Math.max(0, linear[0])))) * 255,
    ),
    Math.round(
      Math.max(0, Math.min(1, toEncoded(Math.max(0, linear[1])))) * 255,
    ),
    Math.round(
      Math.max(0, Math.min(1, toEncoded(Math.max(0, linear[2])))) * 255,
    ),
  ];
}

/**
 * Largest chroma that stays inside `gamut` at the given lightness and hue
 * (binary search on the gamut boundary).
 */
export function maxChroma(L: number, h: number, gamut: Gamut): number {
  if (L <= 0 || L >= 1) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(oklchToLinear(L, mid, h, gamut))) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Interpolate two OKLCH colors: linear in L and C, shortest arc in hue.
 * When one endpoint is achromatic (black/white/gray) its hue is undefined,
 * so the other endpoint's hue is used for the whole segment — this keeps
 * e.g. black→red ramps on the red hue instead of sweeping through arbitrary
 * hues from atan2 noise.
 */
export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  const aChromatic = a.C > ACHROMATIC_EPSILON;
  const bChromatic = b.C > ACHROMATIC_EPSILON;

  let h: number;
  if (aChromatic && bChromatic) {
    const delta = ((((b.h - a.h) % 360) + 540) % 360) - 180;
    h = a.h + delta * t;
  } else if (aChromatic) {
    h = a.h;
  } else {
    h = b.h;
  }

  return {
    L: a.L + (b.L - a.L) * t,
    C: a.C + (b.C - a.C) * t,
    h,
  };
}
