/**
 * Web Worker for computing the high-precision reference orbit (Phase 1 of
 * the perturbation pipeline).
 *
 * Receives a center point as arbitrary-precision decimal strings, computes
 * the Mandelbrot orbit using BigFloat arithmetic (bigfloat-esnext), and
 * transfers the orbit values back as Float64Arrays for consumption by
 * the perturbation render workers. Optionally computes Series Approximation
 * coefficients (A, B, C) alongside the orbit for iteration skipping.
 *
 * Streams progress updates during computation and supports cancellation
 * via requestId checking between iteration batches.
 */
import { computeReferenceOrbit } from "./reference-orbit";
import type {
  ReferenceWorkerIn,
  ReferenceOrbitProgress,
  ReferenceOrbitComplete,
  CancelRequest,
} from "./types";

interface WorkerContext {
  onmessage: ((e: MessageEvent<ReferenceWorkerIn>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const workerSelf = self as unknown as WorkerContext;

let currentRequestId = -1;

workerSelf.onmessage = (e: MessageEvent<ReferenceWorkerIn>) => {
  const msg = e.data;
  currentRequestId = msg.requestId;

  if (msg.type === "cancel") return;

  const orbit = computeReferenceOrbit(
    msg.centerReStr,
    msg.centerImStr,
    msg.maxIter,
    msg.precisionDigits,
    {
      computeSACoefficients: msg.computeSACoefficients,
      onProgress(iteration, maxIter) {
        if (currentRequestId !== msg.requestId) return;
        const progress: ReferenceOrbitProgress = {
          type: "reference-progress",
          requestId: msg.requestId,
          iteration,
          maxIter,
        };
        workerSelf.postMessage(progress);
      },
      isCancelled() {
        return currentRequestId !== msg.requestId;
      },
    },
  );

  if (currentRequestId !== msg.requestId) return;

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

// Suppress unused variable for cancel message typing
void (undefined as unknown as CancelRequest);
