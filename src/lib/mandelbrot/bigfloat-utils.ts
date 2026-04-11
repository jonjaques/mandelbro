import {
  make,
  string,
  number as bfNumber,
  normalize,
  make_big_float,
  add,
  mul,
  gt,
  type IBigFloat,
} from "bigfloat-esnext";

export type { IBigFloat } from "bigfloat-esnext";
export { add, mul, make, string as bfToString };

import { BAILOUT } from "./constants";

const ZERO = make(0);
const BAILOUT_BF = make(BAILOUT);

export { ZERO, BAILOUT_BF };

/**
 * Decimal digits for the **reference-orbit** BigFloat iteration at this zoom.
 * Pixel spacing in the complex plane is about `zoom / height`; when that is
 * far below ~1e-15, doubles cannot represent distinct pixel c values, so the
 * reference orbit must be computed in arbitrary precision (see
 * `PRECISION_THRESHOLD` in `types.ts`). The +10 margin covers accumulated
 * rounding while iterating z² + c.
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set
 */
export function requiredPrecision(zoom: number): number {
  if (zoom >= 1e-13) return 16;
  return Math.ceil(-Math.log10(zoom)) + 10;
}

/**
 * Truncate a BigFloat to at most `digits` significant decimal digits.
 *
 * `bigfloat-esnext` multiplication is exact (coefficients grow without bound).
 * Each Mandelbrot squaring roughly doubles coefficient length, so without
 * periodic truncation the reference orbit would slow exponentially while still
 * exceeding the useful precision dictated by `requiredPrecision(zoom)`.
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
