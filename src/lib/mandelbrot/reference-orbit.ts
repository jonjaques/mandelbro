import { sub, set_precision } from "bigfloat-esnext";
import {
  add,
  mul,
  make,
  toDouble,
  truncateToPrecision,
  bfEscaped,
  ZERO,
  type IBigFloat,
} from "./bigfloat-utils";
import type { ReferenceOrbit } from "./types";

import { BAILOUT, MAX_SAFE_ITERATIONS } from "./constants";

const PROGRESS_INTERVAL = 200;
const PROBE_GRID = 9;

export interface ReferenceOrbitOptions {
  computeSACoefficients?: boolean;
  onProgress?: (iteration: number, maxIter: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Compute a **reference orbit** X_n at c (one high-precision Mandelbrot
 * iteration). Workers store X_n as doubles; every screen pixel reuses this
 * orbit and only integrates a double-precision delta (see `perturbation.ts`).
 *
 * - **Escape:** stops when |z|² exceeds bailout (same threshold as workers).
 * - **Interior:** Brent-style cycle detection on the double shadow of the
 *   orbit stops BigFloat work once the sequence repeats; the orbit is then
 *   tiled out to `maxIter` so perturbation still has an X_n at every n.
 * - **Series approximation:** optional (A,B,C) coefficients for iteration
 *   skipping, updated from the double-precision X_n values each step.
 *
 * @see Martin (perturbation + deep zoom context):
 *   https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf
 * @see Brent's cycle-finding strategy (tortoise jumps by powers of two):
 *   https://en.wikipedia.org/wiki/Cycle_detection#Brent's_algorithm
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

  // Series approximation (SA): delta_n ≈ A_n·ε + B_n·ε² + C_n·ε³ in ε = c - c_ref.
  // Init: A_0=B_0=C_0=0; first nontrivial step sets A_1 = 1 (see n===0 branch).
  let aRe = 0;
  let aIm = 0;
  let bRe = 0;
  let bIm = 0;
  let cReCoeff = 0;
  let cImCoeff = 0;

  // Brent's algorithm state: `tort` is the tortoise orbit sample; `lambda`
  // counts steps since last tortoise advance; `power` gates exponential moves.
  let tortRe = 0;
  let tortIm = 0;
  let power = 1;
  let lambda = 0;
  // Squared-distance threshold (distance 1e-12). Must be tight: a detected
  // "cycle" freezes X_n and tiles it to maxIter, so any residual error here
  // is injected into every subsequent perturbation delta. A loose tolerance
  // (e.g. distance 1e-6) causes near-miss orbit points to be mistaken for
  // true cycles, corrupting interior-centered deep zooms.
  const cycleToleranceSq = 1e-24;

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
    // 2·(zRe·zIm) as a self-add: cheaper than a BigFloat multiply by a
    // constant, and avoids allocating make(2) on every iteration.
    const zReZIm = mul(zRe, zIm);
    const twoZReZIm = add(zReZIm, zReZIm);

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

    // Equality test on doubles (not BigFloat): interior detection only needs
    // to spot repetition; full precision is unnecessary and much slower.
    const dRe = newReD - tortRe;
    const dIm = newImD - tortIm;
    if (dRe * dRe + dIm * dIm < cycleToleranceSq) {
      cycleDetected = true;
      // `lambda` is incremented *after* this comparison, so at match time it
      // lags the step count by one: the tortoise was set to z_k, this value
      // is z_{k+lambda+1}, hence period = lambda + 1 (a fixed point matches
      // with lambda = 0 and has period 1).
      cyclePeriod = lambda + 1;
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

  // ── Extend cyclic orbits to full length ──
  //
  // For cycle-detected orbits, perturbation workers need data for the full
  // iteration range. Repeat the detected cycle pattern cheaply.
  if (cycleDetected && cyclePeriod > 0 && finalIter < clampedMaxIter) {
    // Interior point: extend orbit to maxIter by repeating the cycle.
    // Perturbation workers need data for the full iteration range; without
    // this, they'd be capped at the detection point.
    for (let m = finalIter + 1; m <= clampedMaxIter; m++) {
      reArr[m] = reArr[m - cyclePeriod] ?? 0;
      imArr[m] = imArr[m - cyclePeriod] ?? 0;
    }
    finalIter = clampedMaxIter;
  }

  // NOTE: Escaped orbits are intentionally NOT extended. Extending in
  // double precision causes catastrophic cancellation when perturbation
  // computes Z = X + delta with huge X and delta ≈ -X. Instead, the
  // perturbation function falls back to direct iteration from Z_N when
  // the reference runs out.

  onProgress?.(finalIter, clampedMaxIter);

  const result: ReferenceOrbit = {
    re: reArr.subarray(0, finalIter + 1),
    im: imArr.subarray(0, finalIter + 1),
    iterations: finalIter,
    escaped,
    cycleDetected,
    cyclePeriod,
  };

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

/**
 * When the reference orbit at the view center **escapes**, search nearby c
 * values for a longer-lived orbit (preferably interior) so Phase 2 has more
 * valid X_n samples before bailout.
 *
 * Uses a multi-pass grid: wide probe, then refinement around the best
 * candidate. Each probe runs the same delta recurrence as `perturbation.ts`
 * (`probePoint`) with epsilon = (candidate − viewCenter) − currentRefOffset.
 *
 * @param currentRefOffsetRe - Reference point minus view center. Epsilon sent
 *   to `probePoint` is `(candidate offset from center) − this`, matching how
 *   workers subtract `refOffsetRe/Im` from pixel epsilon.
 * @returns Best candidate offset from the **view center** (absolute), or
 *   `null` if no grid point beat the current reference lifetime.
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 */
export function findBestReference(
  refOrbitRe: Float64Array,
  refOrbitIm: Float64Array,
  refIterations: number,
  width: number,
  height: number,
  zoom: number,
  maxIter: number,
  currentRefOffsetRe = 0,
  currentRefOffsetIm = 0,
): { offsetRe: number; offsetIm: number } | null {
  const aspectRatio = width / height;
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / height;

  let bestIter = refIterations;
  // Best candidate offset from VIEW CENTER
  let bestOffsetRe = currentRefOffsetRe;
  let bestOffsetIm = currentRefOffsetIm;
  let found = false;

  // Start search centered on view center, spanning the full viewport
  let searchCenterRe = 0;
  let searchCenterIm = 0;
  let searchRadiusRe = (width / 2) * pixelWidth;
  let searchRadiusIm = (height / 2) * pixelHeight;

  const MAX_PASSES = 5;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let passImproved = false;

    for (let gy = 0; gy < PROBE_GRID; gy++) {
      for (let gx = 0; gx < PROBE_GRID; gx++) {
        const fx = (gx + 0.5) / PROBE_GRID - 0.5;
        const fy = (gy + 0.5) / PROBE_GRID - 0.5;

        // Candidate position relative to view center
        const candRe = searchCenterRe + fx * 2 * searchRadiusRe;
        const candIm = searchCenterIm + fy * 2 * searchRadiusIm;

        // Perturbation epsilon = candidate offset from REFERENCE ORBIT
        const epsRe = candRe - currentRefOffsetRe;
        const epsIm = candIm - currentRefOffsetIm;

        const iter = probePoint(
          refOrbitRe,
          refOrbitIm,
          refIterations,
          epsRe,
          epsIm,
        );

        if (iter > bestIter) {
          bestIter = iter;
          bestOffsetRe = candRe;
          bestOffsetIm = candIm;
          found = true;
          passImproved = true;
          if (iter >= maxIter) break;
        }
      }
      if (bestIter >= maxIter) break;
    }
    if (bestIter >= maxIter) break;
    if (!passImproved) break;

    searchCenterRe = bestOffsetRe;
    searchCenterIm = bestOffsetIm;
    searchRadiusRe /= PROBE_GRID / 2;
    searchRadiusIm /= PROBE_GRID / 2;
  }

  return found ? { offsetRe: bestOffsetRe, offsetIm: bestOffsetIm } : null;
}

/**
 * Escape-time for c = c_ref + epsilon using the reference orbit (cheap
 * double loop shared with `perturbationEscapeTime` logic).
 */
function probePoint(
  refRe: Float64Array,
  refIm: Float64Array,
  refIterations: number,
  epsRe: number,
  epsIm: number,
): number {
  let dRe = 0;
  let dIm = 0;

  for (let n = 0; n < refIterations; n++) {
    const xn = refRe[n] ?? 0;
    const yn = refIm[n] ?? 0;

    const newDRe = 2 * (xn * dRe - yn * dIm) + (dRe * dRe - dIm * dIm) + epsRe;
    const newDIm = 2 * (xn * dIm + yn * dRe) + 2 * dRe * dIm + epsIm;

    dRe = newDRe;
    dIm = newDIm;

    const zRe = (refRe[n + 1] ?? 0) + dRe;
    const zIm = (refIm[n + 1] ?? 0) + dIm;

    if (zRe * zRe + zIm * zIm > BAILOUT) {
      return n + 1;
    }
  }

  return refIterations;
}
