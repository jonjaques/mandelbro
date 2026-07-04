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

  // NOTE: no per-iteration glitch detection (Pauldelbrot criterion,
  // |delta| >> |X|) in v1 — checking it here costs ~25% of this hot loop and
  // the proper fix is re-referencing / multi-reference anyway (see Wikipedia
  // link in file header). Glitched pixels near mini-Mandelbrots may render
  // with inaccurate colors until that lands.
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
 * Find the deepest iteration at which the truncated series is still accurate
 * for **every** |ε| ≤ `maxDeltaMag`. Validity is monotonic in |ε| (the
 * truncation-error ratio |C·ε³| / |A·ε| = |C/A|·|ε|² shrinks with |ε|), so a
 * skip point proven safe for the largest ε in a band is safe for all of its
 * pixels. This lets the scan run **once per band** — scalar magnitude math
 * over the coefficient arrays — instead of three complex multiplies per
 * iteration per pixel, which would cost more than the iterations it skips.
 *
 * @see Same Wikipedia section as file header (series approximation).
 */
function findSASkipIteration(
  saAre: Float64Array,
  saAim: Float64Array,
  saBre: Float64Array,
  saBim: Float64Array,
  saCre: Float64Array,
  saCim: Float64Array,
  refIterations: number,
  maxDeltaMag: number,
): number {
  const d1 = maxDeltaMag;
  const d2 = d1 * d1;
  const d3 = d2 * d1;
  // Truncation-error budget: stop once the cubic term exceeds 1e-6 of the
  // linear term (the dropped ε⁴ term is smaller still).
  const tolerance = 1e-6;

  let skipN = 0;

  for (let n = 1; n < refIterations; n++) {
    const aMag = Math.hypot(saAre[n] ?? 0, saAim[n] ?? 0) * d1;
    const cMag = Math.hypot(saCre[n] ?? 0, saCim[n] ?? 0) * d3;

    if (aMag > 0 && cMag > aMag * tolerance) break;

    // Guard against series blowup for near-escaped references: |delta| this
    // large means the pixel escaped long before n, so skipping to n would
    // jump past the bailout crossing.
    const bMag = Math.hypot(saBre[n] ?? 0, saBim[n] ?? 0) * d2;
    if (aMag + bMag + cMag > 1e5) break;

    skipN = n;
  }

  return skipN;
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

  // ── Series-approximation setup (once per band) ──────────────────────
  //
  // The skip point is chosen conservatively using the largest |epsilon| in
  // this band (attained at one of the band's four corners since epsilon is
  // linear in px/py), so it is valid for every pixel. The six coefficients
  // at the skip iteration are then hoisted out of the pixel loop; each pixel
  // only pays one 3-term series evaluation instead of a full rescan.
  let skipIter = 0;
  let skipARe = 0;
  let skipAIm = 0;
  let skipBRe = 0;
  let skipBIm = 0;
  let skipCRe = 0;
  let skipCIm = 0;

  if (hasSA) {
    const epsReLeft = (0.5 - width / 2) * pixelWidth - refOffsetRe;
    const epsReRight = (width - 0.5 - width / 2) * pixelWidth - refOffsetRe;
    const epsImTop =
      (startY + 0.5 - fullHeight / 2) * pixelHeight - refOffsetIm;
    const epsImBottom =
      (startY + bandHeight - 0.5 - fullHeight / 2) * pixelHeight - refOffsetIm;
    const maxDeltaMag = Math.hypot(
      Math.max(Math.abs(epsReLeft), Math.abs(epsReRight)),
      Math.max(Math.abs(epsImTop), Math.abs(epsImBottom)),
    );

    skipIter = findSASkipIteration(
      saAre,
      saAim,
      saBre,
      saBim,
      saCre,
      saCim,
      refIterations,
      maxDeltaMag,
    );

    if (skipIter > 0) {
      skipARe = saAre[skipIter] ?? 0;
      skipAIm = saAim[skipIter] ?? 0;
      skipBRe = saBre[skipIter] ?? 0;
      skipBIm = saBim[skipIter] ?? 0;
      skipCRe = saCre[skipIter] ?? 0;
      skipCIm = saCim[skipIter] ?? 0;
    }
  }

  for (let localY = 0; localY < bandHeight; localY++) {
    const py = startY + localY;
    // epsilon = pixel_offset_from_center - reference_offset_from_center
    // (+0.5 samples the pixel center — same midpoint convention as the
    // standard pipeline and its supersampled path)
    const epsIm = (py + 0.5 - fullHeight / 2) * pixelHeight - refOffsetIm;
    const rowOffset = localY * width;

    for (let px = 0; px < width; px++) {
      const epsRe = (px + 0.5 - width / 2) * pixelWidth - refOffsetRe;

      let startDRe = 0;
      let startDIm = 0;

      if (skipIter > 0) {
        // delta_skipIter = A·ε + B·ε² + C·ε³ (complex arithmetic)
        const d2Re = epsRe * epsRe - epsIm * epsIm;
        const d2Im = 2 * epsRe * epsIm;
        const d3Re = d2Re * epsRe - d2Im * epsIm;
        const d3Im = d2Re * epsIm + d2Im * epsRe;

        startDRe =
          skipARe * epsRe -
          skipAIm * epsIm +
          (skipBRe * d2Re - skipBIm * d2Im) +
          (skipCRe * d3Re - skipCIm * d3Im);
        startDIm =
          skipARe * epsIm +
          skipAIm * epsRe +
          (skipBRe * d2Im + skipBIm * d2Re) +
          (skipCRe * d3Im + skipCIm * d3Re);
      }

      const [iter, zMag2] = perturbationEscapeTime(
        refRe,
        refIm,
        refIterations,
        epsRe,
        epsIm,
        maxIter,
        skipIter,
        startDRe,
        startDIm,
      );

      result[rowOffset + px] = smoothColor(iter, zMag2);
    }
  }

  return result;
}
