import {
  make,
  string,
  number as bfNumber,
  normalize,
  make_big_float,
  add,
  sub,
  mul,
  gt,
  set_precision,
  type IBigFloat,
} from "bigfloat-esnext";

export type { IBigFloat } from "bigfloat-esnext";
export { add, sub, mul, set_precision, make, string as bfToString };

const ZERO = make(0);
const BAILOUT_BF = make(256);

export { ZERO, BAILOUT_BF };

/**
 * Determine how many decimal digits of precision are needed for a given zoom
 * level. At zoom = 1e-50, pixels are spaced ~1e-53 apart (zoom / screenHeight),
 * so we need ~55+ digits to distinguish adjacent pixels. The +10 margin covers
 * accumulated rounding during iteration.
 */
export function requiredPrecision(zoom: number): number {
  if (zoom >= 1e-13) return 16;
  return Math.ceil(-Math.log10(zoom)) + 10;
}

/**
 * Truncate a BigFloat to at most `digits` significant decimal digits.
 *
 * bigfloat-esnext's mul() produces exact results (BigInt coefficients grow
 * without bound). After each Mandelbrot squaring step the coefficient roughly
 * doubles in length. Without truncation the computation becomes exponentially
 * slower. This function sheds excess digits while preserving the required
 * precision.
 */
export function truncateToPrecision(bf: IBigFloat, digits: number): IBigFloat {
  const n = normalize(bf);
  if (n.coefficient === 0n) return ZERO;

  const isNeg = n.coefficient < 0n;
  const absCoef = isNeg ? -n.coefficient : n.coefficient;
  const coefStr = absCoef.toString();
  const coefDigits = coefStr.length;

  if (coefDigits <= digits) return n;

  const excess = coefDigits - digits;
  const divisor = 10n ** BigInt(excess);
  const truncated = absCoef / divisor;
  return make_big_float(isNeg ? -truncated : truncated, n.exponent + excess);
}

export function toDouble(bf: IBigFloat): number {
  return bfNumber(bf);
}

export function fromString(s: string): IBigFloat {
  return make(s);
}

export function toString(bf: IBigFloat): string {
  return string(bf) ?? "0";
}

/**
 * Check whether |z|^2 > bailout using BigFloat arithmetic.
 * z = (re, im), |z|^2 = re^2 + im^2.
 */
export function bfEscaped(re: IBigFloat, im: IBigFloat): boolean {
  const mag2 = add(mul(re, re), mul(im, im));
  return gt(mag2, BAILOUT_BF);
}
