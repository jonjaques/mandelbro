/**
 * Web Worker — **Phase 2** of the perturbation pipeline: per-pixel deltas from
 * the reference orbit (`perturbationBand` / `perturbation.ts`), same band
 * streaming and cancellation pattern as `worker.ts`.
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 */
import { perturbationBand } from "./perturbation";
import { mapToColors, mapToColorsHDR, zoomColorCyclePeriod } from "./colors";
import { getBandHeight, type WorkerContext } from "./worker-utils";
import type {
  PerturbationWorkerIn,
  PerturbationRenderRequest,
  ChunkResult,
  RenderComplete,
} from "./types";

const workerSelf = self as unknown as WorkerContext<PerturbationWorkerIn>;

let currentRequestId = -1;

workerSelf.onmessage = (e: MessageEvent<PerturbationWorkerIn>) => {
  const msg = e.data;
  currentRequestId = msg.requestId;

  if (msg.type === "cancel") return;

  processRequest(msg);
};

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
    wideGamut,
    hdr,
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

    const rgba = hdr
      ? mapToColorsHDR(
          iterations,
          maxIter,
          colorScheme,
          zoomColorCyclePeriod(zoom),
        )
      : mapToColors(
          iterations,
          maxIter,
          colorScheme,
          zoomColorCyclePeriod(zoom),
          wideGamut,
        );
    const buffer = rgba.buffer as ArrayBuffer;

    const chunk: ChunkResult = {
      type: "chunk",
      requestId: req.requestId,
      width,
      y,
      height: bandHeight,
      buffer,
      ...(hdr ? { hdr: true } : {}),
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
