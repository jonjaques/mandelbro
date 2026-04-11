/**
 * Perturbation-based Mandelbrot escape-time computation.
 *
 * Instead of iterating z_{n+1} = z_n^2 + c at full precision for every pixel,
 * we iterate the *delta* from a pre-computed high-precision reference orbit.
 * Write Z_n = X_n + delta_n where X_n is the reference orbit at c_ref; then
 * expanding (X_n + delta_n)^2 + (c_ref + epsilon) and subtracting the
 * identity for X_n leaves the first-order update plus a quadratic correction:
 *
 *   delta_{n+1} = 2 * X_n * delta_n + delta_n^2 + epsilon
 *
 * where X_n is stored as a double, delta_n stays small near c_ref, and
 * epsilon = c_pixel - c_reference is the pixel offset. All arithmetic here
 * is native IEEE 754 double-precision.
 *
 * @see K. I. Martin, "Superfractalthing Maths" (perturbation formulation):
 *   https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf
 * @see Overview (perturbation + series approximation):
 *   https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 * @see https://mathr.co.uk/blog/2021-05-14_deep_zoom_theory_and_practice.html
 */

import { BAILOUT } from "./constants";
import { smoothColor } from "./worker-utils";

const GLITCH_THRESHOLD = 1e3;

export function perturbationEscapeTime(
  refRe: Float64Array,
  refIm: Float64Array,
  refIterations: number,
  epsilonRe: number,
  epsilonIm: number,
  maxIter: number,
  startIter = 0,
  startDeltaRe = 0,
  startDeltaIm = 0,
): [number, number] {
  let dRe = startDeltaRe;
  let dIm = startDeltaIm;

  const iterLimit = Math.min(refIterations, maxIter);

  for (let n = startIter; n < iterLimit; n++) {
    const xn = refRe[n] ?? 0;
    const yn = refIm[n] ?? 0;

    const newDRe =
      2 * (xn * dRe - yn * dIm) + (dRe * dRe - dIm * dIm) + epsilonRe;
    const newDIm = 2 * (xn * dIm + yn * dRe) + 2 * dRe * dIm + epsilonIm;

    dRe = newDRe;
    dIm = newDIm;

    const zRe = (refRe[n + 1] ?? 0) + dRe;
    const zIm = (refIm[n + 1] ?? 0) + dIm;
    const zMag2 = zRe * zRe + zIm * zIm;

    if (zMag2 > BAILOUT) {
      return [n + 1, zMag2];
    }

    const dMag2 = dRe * dRe + dIm * dIm;
    const refNextRe = refRe[n + 1] ?? 0;
    const refNextIm = refIm[n + 1] ?? 0;
    const refMag2 = refNextRe * refNextRe + refNextIm * refNextIm;
    if (refMag2 > 0 && dMag2 > GLITCH_THRESHOLD * refMag2) {
      // |delta| has blown up relative to |X|: first-order perturbation is
      // unreliable (classic "glitch" artifact). v1 only flags this; a
      // production fix is re-referencing / multi-reference (see Wikipedia link
      // in file header).
    }
  }

  // When the reference orbit ran out (escaped) but this pixel hasn't,
  // fall back to direct double-precision iteration from the current Z
  // value. At the transition point |X_n| ≈ 16 and |delta| is similar
  // magnitude, so Z = X + delta retains ~14 significant digits.
  if (iterLimit < maxIter) {
    let zRe = (refRe[iterLimit] ?? 0) + dRe;
    let zIm = (refIm[iterLimit] ?? 0) + dIm;
    // c_pixel = c_center + epsilon; c_center = refRe[1] since z_1 = 0²+c = c
    const cRe = (refRe[1] ?? 0) + epsilonRe;
    const cIm = (refIm[1] ?? 0) + epsilonIm;

    for (let n = iterLimit; n < maxIter; n++) {
      const zReSq = zRe * zRe;
      const zImSq = zIm * zIm;
      const zMag2 = zReSq + zImSq;

      if (zMag2 > BAILOUT) {
        return [n + 1, zMag2];
      }

      const newZIm = 2 * zRe * zIm + cIm;
      zRe = zReSq - zImSq + cRe;
      zIm = newZIm;
    }
  }

  return [maxIter, 0];
}

/**
 * Series approximation (SA): treat delta_n as a truncated power series in
 * epsilon — delta ≈ A_n·ε + B_n·ε² + C_n·ε³ — with coefficients (A,B,C)
 * depending only on the reference orbit. For tiny |epsilon| at deep zoom,
 * evaluating the series at n skips iterating 0..n-1 in the perturbation loop.
 *
 * Returns `[skipIter, deltaRe, deltaIm]` to resume `perturbationEscapeTime`
 * at iteration `skipIter` with the series-evaluated delta.
 *
 * @see Same Wikipedia section as file header (series approximation).
 */
export function seriesApproximationSkip(
  saAre: Float64Array,
  saAim: Float64Array,
  saBre: Float64Array,
  saBim: Float64Array,
  saCre: Float64Array,
  saCim: Float64Array,
  refIterations: number,
  deltaRe: number,
  deltaIm: number,
): [number, number, number] {
  const d2Re = deltaRe * deltaRe - deltaIm * deltaIm;
  const d2Im = 2 * deltaRe * deltaIm;
  const d3Re = d2Re * deltaRe - d2Im * deltaIm;
  const d3Im = d2Re * deltaIm + d2Im * deltaRe;

  const tolerance = 1e-6;
  let bestN = 0;
  let bestEpsRe = 0;
  let bestEpsIm = 0;

  for (let n = 1; n < refIterations; n++) {
    const an_re = saAre[n] ?? 0;
    const an_im = saAim[n] ?? 0;
    const bn_re = saBre[n] ?? 0;
    const bn_im = saBim[n] ?? 0;
    const cn_re = saCre[n] ?? 0;
    const cn_im = saCim[n] ?? 0;

    const aTermRe = an_re * deltaRe - an_im * deltaIm;
    const aTermIm = an_re * deltaIm + an_im * deltaRe;

    const bTermRe = bn_re * d2Re - bn_im * d2Im;
    const bTermIm = bn_re * d2Im + bn_im * d2Re;

    const cTermRe = cn_re * d3Re - cn_im * d3Im;
    const cTermIm = cn_re * d3Im + cn_im * d3Re;

    const cMag2 = cTermRe * cTermRe + cTermIm * cTermIm;
    const aMag2 = aTermRe * aTermRe + aTermIm * aTermIm;

    if (aMag2 > 0 && cMag2 > aMag2 * tolerance * tolerance) {
      break;
    }

    const epsRe = aTermRe + bTermRe + cTermRe;
    const epsIm = aTermIm + bTermIm + cTermIm;

    if (epsRe * epsRe + epsIm * epsIm > 1e10) {
      break;
    }

    bestN = n;
    bestEpsRe = epsRe;
    bestEpsIm = epsIm;
  }

  return [bestN, bestEpsRe, bestEpsIm];
}

export function perturbationBand(
  width: number,
  fullHeight: number,
  startY: number,
  bandHeight: number,
  refRe: Float64Array,
  refIm: Float64Array,
  refIterations: number,
  zoom: number,
  maxIter: number,
  refOffsetRe = 0,
  refOffsetIm = 0,
  saAre?: Float64Array,
  saAim?: Float64Array,
  saBre?: Float64Array,
  saBim?: Float64Array,
  saCre?: Float64Array,
  saCim?: Float64Array,
): Float64Array {
  const result = new Float64Array(width * bandHeight);
  const aspectRatio = width / fullHeight;
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / fullHeight;

  const hasSA =
    saAre != null &&
    saAim != null &&
    saBre != null &&
    saBim != null &&
    saCre != null &&
    saCim != null;

  for (let localY = 0; localY < bandHeight; localY++) {
    const py = startY + localY;
    // epsilon = pixel_offset_from_center - reference_offset_from_center
    const epsIm = (py - fullHeight / 2) * pixelHeight - refOffsetIm;
    const rowOffset = localY * width;

    for (let px = 0; px < width; px++) {
      const epsRe = (px - width / 2) * pixelWidth - refOffsetRe;

      let startIter = 0;
      let startDRe = 0;
      let startDIm = 0;

      if (hasSA) {
        [startIter, startDRe, startDIm] = seriesApproximationSkip(
          saAre,
          saAim,
          saBre,
          saBim,
          saCre,
          saCim,
          refIterations,
          epsRe,
          epsIm,
        );
      }

      const [iter, zMag2] = perturbationEscapeTime(
        refRe,
        refIm,
        refIterations,
        epsRe,
        epsIm,
        maxIter,
        startIter,
        startDRe,
        startDIm,
      );

      result[rowOffset + px] = smoothColor(iter, zMag2);
    }
  }

  return result;
}
