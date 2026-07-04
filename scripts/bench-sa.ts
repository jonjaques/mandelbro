/**
 * Temporary: benchmark per-band SA skip vs plain perturbation.
 * Run: bun run scripts/bench-sa.ts
 */
import { computeReferenceOrbit } from "../src/lib/mandelbrot/reference-orbit";
import { perturbationBand } from "../src/lib/mandelbrot/perturbation";

const size = 256;
const zoom = 1e-14;
const maxIter = 2000;
const orbit = computeReferenceOrbit(
  "-0.743643887037158",
  "0.131825904205311",
  maxIter,
  30,
  { computeSACoefficients: true },
);
console.log(
  `orbit iters=${String(orbit.iterations)} cycle=${String(orbit.cycleDetected)} SA=${String(orbit.saCoeffAre != null)}`,
);

function run(withSA: boolean): number {
  const t0 = performance.now();
  perturbationBand(
    size,
    size,
    0,
    size,
    orbit.re,
    orbit.im,
    orbit.iterations,
    zoom,
    maxIter,
    0,
    0,
    ...(withSA
      ? ([
          orbit.saCoeffAre,
          orbit.saCoeffAim,
          orbit.saCoeffBre,
          orbit.saCoeffBim,
          orbit.saCoeffCre,
          orbit.saCoeffCim,
        ] as const)
      : ([] as const)),
  );
  return performance.now() - t0;
}

// warmup
run(true);
run(false);

let sa = 0;
let plain = 0;
for (let i = 0; i < 5; i++) {
  sa += run(true);
  plain += run(false);
}
console.log(`256x256 @1e-14, maxIter 2000 (5 runs avg):`);
console.log(`  with SA:    ${(sa / 5).toFixed(1)}ms`);
console.log(`  without SA: ${(plain / 5).toFixed(1)}ms`);
console.log(`  speedup:    ${(plain / sa).toFixed(2)}x`);
