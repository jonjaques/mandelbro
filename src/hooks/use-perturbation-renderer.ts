import { useCallback, useEffect, useRef } from "react";
import type {
  CancelRequest,
  PerturbationRenderRequest,
  ViewState,
  ReferenceWorkerOut,
  PerturbationWorkerOut,
  ReferenceOrbitRequest,
  ReferenceOrbitComplete,
} from "@/lib/mandelbrot/types";
import { resolveAntialiasSamples } from "@/lib/mandelbrot/compute";
import { requiredPrecision } from "@/lib/mandelbrot/bigfloat-utils";
import { useChunkRenderer } from "@/hooks/use-chunk-renderer";

/**
 * Perturbation workers are more CPU-intensive per pixel than the standard
 * pipeline (thousands of iterations at deep zoom). Using fewer workers than
 * available cores leaves headroom for the browser main thread and the OS,
 * preventing thermal throttling and system instability.
 */
const PERTURBATION_WORKER_COUNT =
  typeof navigator === "undefined"
    ? 2
    : Math.min(
        Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
        8,
      );

/**
 * Two-phase **perturbation** render: one `reference-orbit-worker` (BigFloat
 * c_ref + optional SA coeffs), then a pool of `perturbation-worker`s that share
 * the same orbit buffers. Matches `useMandelbrotWorker`'s outward API so
 * `MandelbrotExplorer` can route by `view.zoom` alone.
 *
 * @see https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 */
export function usePerturbationRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const refWorkerRef = useRef<Worker | null>(null);
  const pertWorkersRef = useRef<Worker[]>([]);
  const {
    requestIdRef,
    progress,
    handleChunkMessage,
    armPixelPhase,
    clearChunkQueueAndPixelCounters,
    setChunkProgress,
    cancelBase,
    cancelPendingRaf,
  } = useChunkRenderer(canvasRef);

  // Reference orbit cache: reuse when center hasn't changed
  const cachedOrbitRef = useRef<{
    centerKey: string;
    orbit: ReferenceOrbitComplete;
  } | null>(null);

  useEffect(() => {
    const refWorker = new Worker(
      new URL("../lib/mandelbrot/reference-orbit-worker.ts", import.meta.url),
      { type: "module" },
    );
    refWorkerRef.current = refWorker;

    const pertWorkers: Worker[] = [];
    for (let i = 0; i < PERTURBATION_WORKER_COUNT; i++) {
      const worker = new Worker(
        new URL("../lib/mandelbrot/perturbation-worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (e: MessageEvent<PerturbationWorkerOut>) => {
        handleChunkMessage(e.data, PERTURBATION_WORKER_COUNT, 10, 90);
      };

      pertWorkers.push(worker);
    }
    pertWorkersRef.current = pertWorkers;

    return () => {
      refWorker.terminate();
      refWorkerRef.current = null;
      for (const w of pertWorkers) {
        w.terminate();
      }
      pertWorkersRef.current = [];
      cancelPendingRaf();
    };
  }, [handleChunkMessage, cancelPendingRaf]);

  const cancelRender = useCallback(() => {
    const id = cancelBase();

    const cancelMessage: CancelRequest = { type: "cancel", requestId: id };
    refWorkerRef.current?.postMessage(cancelMessage);
    for (const w of pertWorkersRef.current) {
      w.postMessage(cancelMessage);
    }
  }, [cancelBase]);

  const dispatchPerturbationRender = useCallback(
    (
      orbit: ReferenceOrbitComplete,
      view: ViewState,
      width: number,
      height: number,
      id: number,
    ) => {
      const workers = pertWorkersRef.current;
      if (workers.length === 0) return;

      armPixelPhase(width * height);

      for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        if (!worker) continue;

        const request: PerturbationRenderRequest = {
          type: "perturbation-render",
          requestId: id,
          width,
          height,
          refOrbitRe: orbit.refOrbitRe,
          refOrbitIm: orbit.refOrbitIm,
          refIterations: orbit.iterations,
          zoom: view.zoom,
          maxIter: view.maxIter,
          colorScheme: view.colorScheme,
          antialiasSamples: resolveAntialiasSamples(view.antialias, view.zoom),
          refOffsetRe: orbit.refOffsetRe,
          refOffsetIm: orbit.refOffsetIm,
          workerIndex: i,
          workerCount: workers.length,
          ...(orbit.saCoeffAre != null ? { saCoeffAre: orbit.saCoeffAre } : {}),
          ...(orbit.saCoeffAim != null ? { saCoeffAim: orbit.saCoeffAim } : {}),
          ...(orbit.saCoeffBre != null ? { saCoeffBre: orbit.saCoeffBre } : {}),
          ...(orbit.saCoeffBim != null ? { saCoeffBim: orbit.saCoeffBim } : {}),
          ...(orbit.saCoeffCre != null ? { saCoeffCre: orbit.saCoeffCre } : {}),
          ...(orbit.saCoeffCim != null ? { saCoeffCim: orbit.saCoeffCim } : {}),
        };

        worker.postMessage(request);
      }
    },
    [armPixelPhase],
  );

  const render = useCallback(
    (view: ViewState, width: number, height: number) => {
      const refWorker = refWorkerRef.current;
      if (!refWorker || width === 0 || height === 0) return;

      const id = ++requestIdRef.current;
      clearChunkQueueAndPixelCounters();
      setChunkProgress(0);

      const centerReStr = view.centerXHp ?? view.centerX.toPrecision(15);
      const centerImStr = view.centerYHp ?? view.centerY.toPrecision(15);
      const centerKey = `${centerReStr}|${centerImStr}|${view.maxIter}|${width}x${height}`;

      const cached = cachedOrbitRef.current;
      if (cached?.centerKey === centerKey) {
        setChunkProgress(10);
        dispatchPerturbationRender(cached.orbit, view, width, height, id);
        return;
      }

      // Phase 1: compute reference orbit
      const precDigits = requiredPrecision(view.zoom);

      refWorker.onmessage = (e: MessageEvent<ReferenceWorkerOut>) => {
        const msg = e.data;
        if (msg.requestId !== id) return;

        if (msg.type === "reference-progress") {
          const refProgress =
            msg.maxIter > 0 ? (msg.iteration / msg.maxIter) * 10 : 0;
          setChunkProgress(Math.min(10, refProgress));
          return;
        }

        const orbit = msg;
        cachedOrbitRef.current = { centerKey, orbit };
        setChunkProgress(10);

        if (requestIdRef.current !== id) return;
        dispatchPerturbationRender(orbit, view, width, height, id);
      };

      const refRequest: ReferenceOrbitRequest = {
        type: "compute-reference",
        requestId: id,
        centerReStr,
        centerImStr,
        maxIter: view.maxIter,
        precisionDigits: precDigits,
        computeSACoefficients: true,
        width,
        height,
        zoom: view.zoom,
      };

      refWorker.postMessage(refRequest);
    },
    [
      dispatchPerturbationRender,
      clearChunkQueueAndPixelCounters,
      setChunkProgress,
      requestIdRef,
    ],
  );

  return { render, cancelRender, progress };
}
