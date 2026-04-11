/**
 * Web Worker — **Phase 2** of the perturbation pipeline: per-pixel deltas from
 * the reference orbit (`perturbationBand` / `perturbation.ts`), same band
 * streaming and cancellation pattern as `worker.ts`.
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 */
import { perturbationBand } from "./perturbation";
import { mapToColors, zoomColorCyclePeriod } from "./colors";
import type {
  AntialiasSamples,
  PerturbationWorkerIn,
  PerturbationRenderRequest,
  ChunkResult,
  RenderComplete,
} from "./types";

interface WorkerContext {
  onmessage: ((e: MessageEvent<PerturbationWorkerIn>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const workerSelf = self as unknown as WorkerContext;

let currentRequestId = -1;

const BASE_BAND_HEIGHT = 32;

workerSelf.onmessage = (e: MessageEvent<PerturbationWorkerIn>) => {
  const msg = e.data;
  currentRequestId = msg.requestId;

  if (msg.type === "cancel") return;

  processRequest(msg);
};

function getBandHeight(
  maxIter: number,
  antialiasSamples: AntialiasSamples,
): number {
  if (antialiasSamples >= 4 || maxIter >= 2000) return 4;
  if (antialiasSamples >= 2 || maxIter >= 800) return 8;
  if (maxIter >= 400) return 16;
  return BASE_BAND_HEIGHT;
}

function processRequest(req: PerturbationRenderRequest) {
  const {
    width,
    height,
    refOrbitRe,
    refOrbitIm,
    refIterations,
    zoom,
    maxIter,
    colorScheme,
    antialiasSamples,
    refOffsetRe,
    refOffsetIm,
    saCoeffAre,
    saCoeffAim,
    saCoeffBre,
    saCoeffBim,
    saCoeffCre,
    saCoeffCim,
  } = req;

  const bandHeightStep = getBandHeight(maxIter, antialiasSamples);

  const workerIndex = req.workerIndex ?? 0;
  const workerCount = req.workerCount ?? 1;
  let y = workerIndex * bandHeightStep;
  const stride = workerCount * bandHeightStep;

  function nextBand() {
    if (currentRequestId !== req.requestId) return;

    if (y >= height) {
      const complete: RenderComplete = {
        type: "complete",
        requestId: req.requestId,
      };
      workerSelf.postMessage(complete);
      return;
    }

    const bandHeight = Math.min(bandHeightStep, height - y);

    const iterations = perturbationBand(
      width,
      height,
      y,
      bandHeight,
      refOrbitRe,
      refOrbitIm,
      refIterations,
      zoom,
      maxIter,
      refOffsetRe,
      refOffsetIm,
      saCoeffAre,
      saCoeffAim,
      saCoeffBre,
      saCoeffBim,
      saCoeffCre,
      saCoeffCim,
    );

    const rgba = mapToColors(
      iterations,
      maxIter,
      colorScheme,
      zoomColorCyclePeriod(zoom),
    );
    const buffer = rgba.buffer as ArrayBuffer;

    const chunk: ChunkResult = {
      type: "chunk",
      requestId: req.requestId,
      width,
      y,
      height: bandHeight,
      buffer,
    };

    workerSelf.postMessage(chunk, [buffer]);

    y += stride;

    // Small delay between bands to prevent CPU saturation across all
    // worker threads. Without this, N workers in tight loops pin every
    // core at 100%, leaving no headroom for the browser or OS.
    setTimeout(nextBand, 4);
  }

  nextBand();
}
