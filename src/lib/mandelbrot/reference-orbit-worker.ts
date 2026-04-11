/**
 * Web Worker — **Phase 1** of the perturbation pipeline: high-precision
 * reference orbit at c (and optional SA coefficients), then `postMessage` with
 * transferred `Float64Array` buffers for Phase 2 workers.
 *
 * If the center escapes early, runs `findBestReference` + a fresh BigFloat
 * orbit at an improved c (up to a few rounds) so zooms centered on filaments
 * still get a usable reference.
 *
 * @see `computeReferenceOrbit` in `reference-orbit.ts` (same literature links).
 * @see https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf
 */
import { computeReferenceOrbit, findBestReference } from "./reference-orbit";
import { toString as bfToString, make, add } from "./bigfloat-utils";
import type { WorkerContext } from "./worker-utils";
import type {
  ReferenceWorkerIn,
  ReferenceOrbitProgress,
  ReferenceOrbitComplete,
} from "./types";

const workerSelf = self as unknown as WorkerContext<ReferenceWorkerIn>;

let currentRequestId = -1;

workerSelf.onmessage = (e: MessageEvent<ReferenceWorkerIn>) => {
  const msg = e.data;
  currentRequestId = msg.requestId;

  if (msg.type === "cancel") return;

  const progressCb = (iteration: number, maxIter: number) => {
    if (currentRequestId !== msg.requestId) return;
    const progress: ReferenceOrbitProgress = {
      type: "reference-progress",
      requestId: msg.requestId,
      iteration,
      maxIter,
    };
    workerSelf.postMessage(progress);
  };

  const isCancelled = () => currentRequestId !== msg.requestId;

  // Phase 1a: compute orbit at view center
  let orbit = computeReferenceOrbit(
    msg.centerReStr,
    msg.centerImStr,
    msg.maxIter,
    msg.precisionDigits,
    {
      computeSACoefficients: msg.computeSACoefficients,
      onProgress: progressCb,
      isCancelled,
    },
  );

  if (isCancelled()) return;

  let refOffsetRe = 0;
  let refOffsetIm = 0;

  // Iterative reference deepening: when the current reference escapes,
  // probe for a better candidate using the orbit we have, compute a new
  // BigFloat orbit there, and repeat. Each round has strictly more orbit
  // data to probe with, converging toward a non-escaping reference.
  const MAX_DEEPENING_ROUNDS = 3;

  for (let round = 0; round < MAX_DEEPENING_ROUNDS; round++) {
    if (!orbit.escaped || orbit.iterations >= msg.maxIter) break;
    if (isCancelled()) return;

    const best = findBestReference(
      orbit.re,
      orbit.im,
      orbit.iterations,
      msg.width,
      msg.height,
      msg.zoom,
      msg.maxIter,
      refOffsetRe,
      refOffsetIm,
    );

    if (!best) break;
    if (isCancelled()) return;

    // best.offsetRe/Im is absolute offset from view center
    refOffsetRe = best.offsetRe;
    refOffsetIm = best.offsetIm;

    const refReStr = bfToString(add(make(msg.centerReStr), make(refOffsetRe)));
    const refImStr = bfToString(add(make(msg.centerImStr), make(refOffsetIm)));

    orbit = computeReferenceOrbit(
      refReStr,
      refImStr,
      msg.maxIter,
      msg.precisionDigits,
      {
        computeSACoefficients: msg.computeSACoefficients,
        onProgress: progressCb,
        isCancelled,
      },
    );

    if (isCancelled()) return;
  }

  const transferables: Transferable[] = [
    orbit.re.buffer as ArrayBuffer,
    orbit.im.buffer as ArrayBuffer,
  ];

  const complete: ReferenceOrbitComplete = {
    type: "reference-complete",
    requestId: msg.requestId,
    refOrbitRe: orbit.re,
    refOrbitIm: orbit.im,
    iterations: orbit.iterations,
    escaped: orbit.escaped,
    cycleDetected: orbit.cycleDetected,
    cyclePeriod: orbit.cyclePeriod,
    refOffsetRe,
    refOffsetIm,
  };

  if (
    orbit.saCoeffAre &&
    orbit.saCoeffAim &&
    orbit.saCoeffBre &&
    orbit.saCoeffBim &&
    orbit.saCoeffCre &&
    orbit.saCoeffCim
  ) {
    complete.saCoeffAre = orbit.saCoeffAre;
    complete.saCoeffAim = orbit.saCoeffAim;
    complete.saCoeffBre = orbit.saCoeffBre;
    complete.saCoeffBim = orbit.saCoeffBim;
    complete.saCoeffCre = orbit.saCoeffCre;
    complete.saCoeffCim = orbit.saCoeffCim;
    transferables.push(
      orbit.saCoeffAre.buffer as ArrayBuffer,
      orbit.saCoeffAim.buffer as ArrayBuffer,
      orbit.saCoeffBre.buffer as ArrayBuffer,
      orbit.saCoeffBim.buffer as ArrayBuffer,
      orbit.saCoeffCre.buffer as ArrayBuffer,
      orbit.saCoeffCim.buffer as ArrayBuffer,
    );
  }

  workerSelf.postMessage(complete, transferables);
};
