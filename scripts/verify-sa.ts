/**
 * Temporary: direct verification of the series-approximation skip.
 * For sample pixels, iterate the perturbation recurrence honestly from 0 to
 * the band's skip iteration and compare against the series evaluation
 * delta ≈ A·ε + B·ε² + C·ε³. Relative error must be within the SA tolerance.
 * Run: bun run scripts/verify-sa.ts
 */
import { computeReferenceOrbit } from "../src/lib/mandelbrot/reference-orbit";

const width = 256;
const height = 256;
const zoom = 1e-14;
const cx = "-0.743643887037158";
const cy = "0.131825904205311";
const maxIter = 2000;

const orbit = computeReferenceOrbit(cx, cy, maxIter, 30, {
  computeSACoefficients: true,
});
console.log(
  `orbit: iters=${String(orbit.iterations)} escaped=${String(orbit.escaped)} cycle=${String(orbit.cycleDetected)}`,
);

const { re, im } = orbit;
const A_re = orbit.saCoeffAre;
const A_im = orbit.saCoeffAim;
const B_re = orbit.saCoeffBre;
const B_im = orbit.saCoeffBim;
const C_re = orbit.saCoeffCre;
const C_im = orbit.saCoeffCim;
if (!A_re || !A_im || !B_re || !B_im || !C_re || !C_im) {
  throw new Error("missing SA coefficients");
}

// Replicate the band-level scan from perturbation.ts
const pixelHeight = zoom / height;
const pixelWidth = pixelHeight; // square pixels for this test
const maxDeltaMag = Math.hypot(
  (width / 2) * pixelWidth,
  (height / 2) * pixelHeight,
);
const tolerance = 1e-6;
let skipN = 0;
for (let n = 1; n < orbit.iterations; n++) {
  const aMag = Math.hypot(A_re[n] ?? 0, A_im[n] ?? 0) * maxDeltaMag;
  const cMag = Math.hypot(C_re[n] ?? 0, C_im[n] ?? 0) * maxDeltaMag ** 3;
  if (aMag > 0 && cMag > aMag * tolerance) break;
  const bMag = Math.hypot(B_re[n] ?? 0, B_im[n] ?? 0) * maxDeltaMag ** 2;
  if (aMag + bMag + cMag > 1e5) break;
  skipN = n;
}
console.log(
  `skipN=${String(skipN)} of ${String(orbit.iterations)} (maxDeltaMag=${maxDeltaMag.toExponential(2)})`,
);

let worst = 0;
let failures = 0;
// Sample pixels including the extreme corners (largest |ε|, worst case)
for (const [fx, fy] of [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [0.5, 0.5],
  [0.25, 0.8],
  [0.9, 0.1],
  [0.33, 0.66],
] as const) {
  const epsRe = (fx - 0.5) * width * pixelWidth;
  const epsIm = (fy - 0.5) * height * pixelHeight;

  // Honest iteration of delta_{n+1} = 2 X_n delta_n + delta_n² + ε
  let dRe = 0;
  let dIm = 0;
  for (let n = 0; n < skipN; n++) {
    const xn = re[n] ?? 0;
    const yn = im[n] ?? 0;
    const nRe = 2 * (xn * dRe - yn * dIm) + (dRe * dRe - dIm * dIm) + epsRe;
    const nIm = 2 * (xn * dIm + yn * dRe) + 2 * dRe * dIm + epsIm;
    dRe = nRe;
    dIm = nIm;
  }

  // Series evaluation at skipN
  const d2Re = epsRe * epsRe - epsIm * epsIm;
  const d2Im = 2 * epsRe * epsIm;
  const d3Re = d2Re * epsRe - d2Im * epsIm;
  const d3Im = d2Re * epsIm + d2Im * epsRe;
  const aRe = A_re[skipN] ?? 0;
  const aIm = A_im[skipN] ?? 0;
  const bRe = B_re[skipN] ?? 0;
  const bIm = B_im[skipN] ?? 0;
  const cRe = C_re[skipN] ?? 0;
  const cIm = C_im[skipN] ?? 0;
  const sRe =
    aRe * epsRe -
    aIm * epsIm +
    (bRe * d2Re - bIm * d2Im) +
    (cRe * d3Re - cIm * d3Im);
  const sIm =
    aRe * epsIm +
    aIm * epsRe +
    (bRe * d2Im + bIm * d2Re) +
    (cRe * d3Im + cIm * d3Re);

  const mag = Math.hypot(dRe, dIm);
  const err = Math.hypot(sRe - dRe, sIm - dIm);
  const rel = mag > 0 ? err / mag : err;
  worst = Math.max(worst, rel);
  if (rel > 1e-4) failures++;
  console.log(
    `pixel(${fx.toFixed(2)},${fy.toFixed(2)}): |delta|=${mag.toExponential(3)} relErr=${rel.toExponential(2)}`,
  );
}

console.log(
  failures === 0
    ? `\nPASS — worst relative error ${worst.toExponential(2)} (series matches honest iteration)`
    : `\nFAIL — ${String(failures)} sample(s) exceeded 1e-4 relative error`,
);
process.exit(failures === 0 ? 0 : 1);
