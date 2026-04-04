/**
 * Perturbation-based Mandelbrot escape-time computation.
 *
 * Instead of iterating z_{n+1} = z_n^2 + c at full precision for every pixel,
 * we iterate the *delta* from a pre-computed high-precision reference orbit:
 *
 *   delta_{n+1} = 2 * X_n * delta_n + delta_n^2 + epsilon
 *
 * where X_n is the reference orbit value (stored as a double), delta_n is
 * the perturbation (a small double), and epsilon = c_pixel - c_reference
 * is the pixel's offset from the reference point.
 *
 * All arithmetic in this module is native IEEE 754 double-precision.
 */

const BAILOUT = 256;
const LOG2 = Math.log(2);

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
      // Glitch detected — accepted for v1, future work adds multi-reference
    }
  }

  return [maxIter, 0];
}

export function smoothColor(iterations: number, zMag2: number): number {
  if (zMag2 <= BAILOUT) return iterations;
  return iterations + 1 - Math.log(Math.log(Math.sqrt(zMag2))) / LOG2;
}

/**
 * Determine how many iterations can be skipped for a given pixel using
 * the Series Approximation. Returns [skipIter, deltaRe, deltaIm] where
 * skipIter is the iteration to start the perturbation loop from and
 * deltaRe/deltaIm are the pre-computed perturbation values at that point.
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
    const epsIm = (py - fullHeight / 2) * pixelHeight;
    const rowOffset = localY * width;

    for (let px = 0; px < width; px++) {
      const epsRe = (px - width / 2) * pixelWidth;

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
