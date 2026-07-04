/**
 * Temporary verification script (not shipped): sanity-checks the math fixes
 * against known analytical results and cross-checks the two pipelines.
 * Run: bun run scripts/verify-math.ts
 */
import { computeReferenceOrbit } from "../src/lib/mandelbrot/reference-orbit";
import { perturbationBand } from "../src/lib/mandelbrot/perturbation";
import { computeBand } from "../src/lib/mandelbrot/compute";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

// ── 1. Brent cycle detection: c = 0 (fixed point, period 1) ─────────────
{
  const orbit = computeReferenceOrbit("0", "0", 100, 20);
  check(
    "c=0 detects period-1 cycle",
    orbit.cycleDetected && orbit.cyclePeriod === 1,
    `cycleDetected=${String(orbit.cycleDetected)} period=${String(orbit.cyclePeriod)}`,
  );
  check(
    "c=0 orbit extended to maxIter",
    orbit.iterations === 100 && orbit.re.length === 101,
    `iterations=${String(orbit.iterations)} len=${String(orbit.re.length)}`,
  );
  const allZero =
    orbit.re.every((v) => v === 0) && orbit.im.every((v) => v === 0);
  check("c=0 extended orbit is all zeros", allZero);
}

// ── 2. Brent cycle detection: c = -1 (0, -1, 0, -1, ... period 2) ───────
{
  const orbit = computeReferenceOrbit("-1", "0", 100, 20);
  check(
    "c=-1 detects period-2 cycle",
    orbit.cycleDetected && orbit.cyclePeriod === 2,
    `cycleDetected=${String(orbit.cycleDetected)} period=${String(orbit.cyclePeriod)}`,
  );
  // Extended orbit must alternate 0, -1, 0, -1... exactly
  let ok = true;
  for (let n = 0; n <= 100; n++) {
    const expected = n % 2 === 0 ? 0 : -1;
    if (orbit.re[n] !== expected || orbit.im[n] !== 0) {
      ok = false;
      console.log(`  mismatch at n=${String(n)}: ${String(orbit.re[n])}`);
      break;
    }
  }
  check("c=-1 extended orbit alternates 0/-1 with correct phase", ok);
}

// ── 3. Escaping reference orbit (c = 1 escapes: 0,1,2,5,26,...) ─────────
{
  const orbit = computeReferenceOrbit("1", "0", 100, 20);
  check(
    "c=1 escapes quickly",
    orbit.escaped && orbit.iterations <= 6,
    `escaped=${String(orbit.escaped)} iters=${String(orbit.iterations)}`,
  );
}

// ── 4. Cross-check: standard pipeline vs perturbation (+SA) pipeline ────
{
  const width = 64;
  const height = 64;
  const zoom = 1e-10; // deep enough for meaningful SA skips, shallow enough for doubles
  const cx = -0.743643887037158;
  const cy = 0.131825904205311;
  const maxIter = 2000;

  const std = computeBand(width, height, 0, height, cx, cy, zoom, maxIter);

  const orbit = computeReferenceOrbit(String(cx), String(cy), maxIter, 30, {
    computeSACoefficients: true,
  });
  check(
    "cross-check reference orbit has SA coefficients",
    orbit.saCoeffAre != null,
  );

  const pert = perturbationBand(
    width,
    height,
    0,
    height,
    orbit.re,
    orbit.im,
    orbit.iterations,
    zoom,
    maxIter,
    0,
    0,
    orbit.saCoeffAre,
    orbit.saCoeffAim,
    orbit.saCoeffBre,
    orbit.saCoeffBim,
    orbit.saCoeffCre,
    orbit.saCoeffCim,
  );

  let maxDiff = 0;
  let bigDiffs = 0;
  for (let i = 0; i < std.length; i++) {
    const diff = Math.abs((std[i] ?? 0) - (pert[i] ?? 0));
    if (diff > maxDiff) maxDiff = diff;
    if (diff > 1) bigDiffs++;
  }
  const bigDiffPct = (bigDiffs / std.length) * 100;
  console.log(
    `  cross-check: maxDiff=${maxDiff.toFixed(4)} pixels>1 iter apart: ${bigDiffPct.toFixed(2)}%`,
  );
  check(
    "standard and perturbation pipelines agree (<1% pixels off by >1 iter)",
    bigDiffPct < 1,
  );
}

// ── 5. SA skip actually skips (perf property, not just correctness) ─────
{
  const zoom = 1e-20;
  const cx = "-0.74364388703715870475729342991260979";
  const cy = "0.13182590420531197147326198429463949";
  const maxIter = 3000;
  const orbit = computeReferenceOrbit(cx, cy, maxIter, 40, {
    computeSACoefficients: true,
  });
  console.log(
    `  deep orbit: iters=${String(orbit.iterations)} escaped=${String(orbit.escaped)} cycle=${String(orbit.cycleDetected)}`,
  );

  const t0 = performance.now();
  perturbationBand(
    128,
    128,
    0,
    128,
    orbit.re,
    orbit.im,
    orbit.iterations,
    zoom,
    maxIter,
    0,
    0,
    orbit.saCoeffAre,
    orbit.saCoeffAim,
    orbit.saCoeffBre,
    orbit.saCoeffBim,
    orbit.saCoeffCre,
    orbit.saCoeffCim,
  );
  const withSA = performance.now() - t0;

  const t1 = performance.now();
  perturbationBand(
    128,
    128,
    0,
    128,
    orbit.re,
    orbit.im,
    orbit.iterations,
    zoom,
    maxIter,
  );
  const withoutSA = performance.now() - t1;

  console.log(
    `  128x128 @1e-20: with SA ${withSA.toFixed(1)}ms, without ${withoutSA.toFixed(1)}ms`,
  );
  check(
    "SA-enabled render is not slower than plain perturbation",
    withSA <= withoutSA * 1.1,
  );
}

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${String(failures)} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
