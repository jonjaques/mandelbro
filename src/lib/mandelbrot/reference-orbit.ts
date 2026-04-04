import {
  add,
  sub,
  mul,
  make,
  set_precision,
  toDouble,
  truncateToPrecision,
  bfEscaped,
  ZERO,
  type IBigFloat,
} from "./bigfloat-utils";
import type { ReferenceOrbit } from "./types";

const PROGRESS_INTERVAL = 200;
const MAX_SAFE_ITERATIONS = 10000;

export interface ReferenceOrbitOptions {
  computeSACoefficients?: boolean;
  onProgress?: (iteration: number, maxIter: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Compute a reference orbit at the given center using arbitrary-precision
 * arithmetic (bigfloat-esnext). The orbit values are stored as doubles for
 * consumption by perturbation workers.
 *
 * Includes Brent's cycle detection for early termination when the reference
 * point is interior to the Mandelbrot set.
 *
 * Optionally computes Series Approximation coefficients (A, B, C) alongside
 * the orbit. These are computed using double-precision reference orbit values
 * and add negligible cost.
 */
export function computeReferenceOrbit(
  centerReStr: string,
  centerImStr: string,
  maxIter: number,
  precisionDigits: number,
  options: ReferenceOrbitOptions = {},
): ReferenceOrbit {
  const { computeSACoefficients = false, onProgress, isCancelled } = options;

  const clampedMaxIter = Math.min(maxIter, MAX_SAFE_ITERATIONS);

  set_precision(-precisionDigits);

  const cRe = make(centerReStr);
  const cIm = make(centerImStr);

  const reArr = new Float64Array(clampedMaxIter + 1);
  const imArr = new Float64Array(clampedMaxIter + 1);

  let saAre: Float64Array | undefined;
  let saAim: Float64Array | undefined;
  let saBre: Float64Array | undefined;
  let saBim: Float64Array | undefined;
  let saCre: Float64Array | undefined;
  let saCim: Float64Array | undefined;

  if (computeSACoefficients) {
    saAre = new Float64Array(clampedMaxIter + 1);
    saAim = new Float64Array(clampedMaxIter + 1);
    saBre = new Float64Array(clampedMaxIter + 1);
    saBim = new Float64Array(clampedMaxIter + 1);
    saCre = new Float64Array(clampedMaxIter + 1);
    saCim = new Float64Array(clampedMaxIter + 1);
  }

  let zRe: IBigFloat = ZERO;
  let zIm: IBigFloat = ZERO;

  reArr[0] = 0;
  imArr[0] = 0;

  // SA: A_0 = 0, B_0 = 0, C_0 = 0 (epsilon_0 = 0 for all pixels)
  // A_1 = 1, which gets set in the first iteration below
  let aRe = 0;
  let aIm = 0;
  let bRe = 0;
  let bIm = 0;
  let cReCoeff = 0;
  let cImCoeff = 0;

  // Brent's cycle detection state
  let tortRe = 0;
  let tortIm = 0;
  let power = 1;
  let lambda = 0;
  const cycleTolerance = 1e-12;

  let escaped = false;
  let cycleDetected = false;
  let cyclePeriod = 0;
  let finalIter = clampedMaxIter;

  for (let n = 0; n < clampedMaxIter; n++) {
    if (isCancelled?.()) {
      finalIter = n;
      break;
    }

    if (onProgress && n % PROGRESS_INTERVAL === 0) {
      onProgress(n, maxIter);
    }

    // z_{n+1} = z_n^2 + c
    //   z_re' = z_re^2 - z_im^2 + c_re
    //   z_im' = 2 * z_re * z_im + c_im
    const zReSq = mul(zRe, zRe);
    const zImSq = mul(zIm, zIm);
    const twoZReZIm = mul(mul(make(2), zRe), zIm);

    let newZRe = add(sub(zReSq, zImSq), cRe);
    let newZIm = add(twoZReZIm, cIm);

    newZRe = truncateToPrecision(newZRe, precisionDigits);
    newZIm = truncateToPrecision(newZIm, precisionDigits);

    const newReD = toDouble(newZRe);
    const newImD = toDouble(newZIm);

    reArr[n + 1] = newReD;
    imArr[n + 1] = newImD;

    // SA coefficient update (using doubles from the reference orbit)
    // z_n values (doubles) for SA computation
    if (
      computeSACoefficients &&
      saAre &&
      saAim &&
      saBre &&
      saBim &&
      saCre &&
      saCim
    ) {
      const znRe = reArr[n] ?? 0;
      const znIm = imArr[n] ?? 0;

      if (n === 0) {
        // A_1 = 2*z_0*A_0 + 1 = 1 (since z_0 = 0 and A_0 = 0)
        aRe = 1;
        aIm = 0;
        bRe = 0;
        bIm = 0;
        cReCoeff = 0;
        cImCoeff = 0;
      } else {
        // A_{n+1} = 2*z_n*A_n + 1  (complex multiply: 2*z_n*A_n)
        const twoZA_re = 2 * (znRe * aRe - znIm * aIm);
        const twoZA_im = 2 * (znRe * aIm + znIm * aRe);
        // B_{n+1} = 2*z_n*B_n + A_n^2
        const twoZB_re = 2 * (znRe * bRe - znIm * bIm);
        const twoZB_im = 2 * (znRe * bIm + znIm * bRe);
        const aSq_re = aRe * aRe - aIm * aIm;
        const aSq_im = 2 * aRe * aIm;
        // C_{n+1} = 2*z_n*C_n + 2*A_n*B_n
        const twoZC_re = 2 * (znRe * cReCoeff - znIm * cImCoeff);
        const twoZC_im = 2 * (znRe * cImCoeff + znIm * cReCoeff);
        const twoAB_re = 2 * (aRe * bRe - aIm * bIm);
        const twoAB_im = 2 * (aRe * bIm + aIm * bRe);

        const newARe = twoZA_re + 1;
        const newAIm = twoZA_im;
        const newBRe = twoZB_re + aSq_re;
        const newBIm = twoZB_im + aSq_im;
        const newCRe = twoZC_re + twoAB_re;
        const newCIm = twoZC_im + twoAB_im;

        aRe = newARe;
        aIm = newAIm;
        bRe = newBRe;
        bIm = newBIm;
        cReCoeff = newCRe;
        cImCoeff = newCIm;
      }

      saAre[n + 1] = aRe;
      saAim[n + 1] = aIm;
      saBre[n + 1] = bRe;
      saBim[n + 1] = bIm;
      saCre[n + 1] = cReCoeff;
      saCim[n + 1] = cImCoeff;
    }

    // Escape check
    if (bfEscaped(newZRe, newZIm)) {
      escaped = true;
      finalIter = n + 1;
      break;
    }

    // Brent's cycle detection on the double-precision orbit values
    const dRe = newReD - tortRe;
    const dIm = newImD - tortIm;
    if (dRe * dRe + dIm * dIm < cycleTolerance) {
      cycleDetected = true;
      cyclePeriod = lambda;
      finalIter = n + 1;
      break;
    }

    lambda++;
    if (lambda === power) {
      tortRe = newReD;
      tortIm = newImD;
      power *= 2;
      lambda = 0;
    }

    zRe = newZRe;
    zIm = newZIm;
  }

  // When the reference orbit is periodic, extend it to full length by
  // repeating the cycle. Without this, perturbation is capped at the cycle
  // detection point and changing maxIter has no visible effect.
  if (cycleDetected && cyclePeriod > 0 && finalIter < clampedMaxIter) {
    for (let m = finalIter + 1; m <= clampedMaxIter; m++) {
      reArr[m] = reArr[m - cyclePeriod] ?? 0;
      imArr[m] = imArr[m - cyclePeriod] ?? 0;
    }
    finalIter = clampedMaxIter;
  }

  onProgress?.(finalIter, clampedMaxIter);

  const result: ReferenceOrbit = {
    re: reArr.subarray(0, finalIter + 1),
    im: imArr.subarray(0, finalIter + 1),
    iterations: finalIter,
    escaped,
    cycleDetected,
    cyclePeriod,
  };

  // SA coefficients are only valid for non-cyclic orbits. For cyclic orbits
  // the coefficients grow without bound past the detection point and can't
  // be extended by simple repetition.
  if (
    computeSACoefficients &&
    !cycleDetected &&
    saAre &&
    saAim &&
    saBre &&
    saBim &&
    saCre &&
    saCim
  ) {
    result.saCoeffAre = saAre.subarray(0, finalIter + 1);
    result.saCoeffAim = saAim.subarray(0, finalIter + 1);
    result.saCoeffBre = saBre.subarray(0, finalIter + 1);
    result.saCoeffBim = saBim.subarray(0, finalIter + 1);
    result.saCoeffCre = saCre.subarray(0, finalIter + 1);
    result.saCoeffCim = saCim.subarray(0, finalIter + 1);
  }

  return result;
}
