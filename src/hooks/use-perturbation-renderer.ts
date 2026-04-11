import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CancelRequest,
  PerturbationRenderRequest,
  ViewState,
  ChunkResult,
  ReferenceWorkerOut,
  PerturbationWorkerOut,
  ReferenceOrbitRequest,
  ReferenceOrbitComplete,
} from "@/lib/mandelbrot/types";
import { resolveAntialiasSamples } from "@/lib/mandelbrot/compute";
import { requiredPrecision } from "@/lib/mandelbrot/bigfloat-utils";

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
 * Hook that manages the two-phase perturbation rendering pipeline:
 *   Phase 1: Compute a high-precision reference orbit (single worker)
 *   Phase 2: Compute per-pixel perturbation deltas (worker pool)
 *
 * Exposes the same API as useMandelbrotWorker so the Explorer can
 * swap between them transparently.
 */
export function usePerturbationRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const refWorkerRef = useRef<Worker | null>(null);
  const pertWorkersRef = useRef<Worker[]>([]);
  const requestIdRef = useRef(0);
  const pendingChunksRef = useRef<ChunkResult[]>([]);
  const rafIdRef = useRef(0);
  const pixelsReceivedRef = useRef(0);
  const totalPixelsRef = useRef(0);
  const completedWorkersRef = useRef(0);
  const [progress, setProgress] = useState<number | null>(null);

  // Reference orbit cache: reuse when center hasn't changed
  const cachedOrbitRef = useRef<{
    centerKey: string;
    orbit: ReferenceOrbitComplete;
  } | null>(null);

  const paintChunks = useCallback(() => {
    rafIdRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const chunks = pendingChunksRef.current;
    pendingChunksRef.current = [];
    const currentId = requestIdRef.current;

    for (const chunk of chunks) {
      if (chunk.requestId !== currentId) continue;
      const clamped = new Uint8ClampedArray(chunk.buffer);
      const imgData = new ImageData(clamped, chunk.width, chunk.height);
      ctx.putImageData(imgData, 0, chunk.y);
    }
  }, [canvasRef]);

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
        const msg = e.data;
        if (msg.type === "chunk") {
          if (msg.requestId !== requestIdRef.current) return;
          pendingChunksRef.current.push(msg);
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(paintChunks);
          }
          pixelsReceivedRef.current += msg.width * msg.height;
          const total = totalPixelsRef.current;
          if (total > 0) {
            // Phase 2 progress: 10-100% (phase 1 is 0-10%)
            setProgress(
              Math.min(100, 10 + (pixelsReceivedRef.current / total) * 90),
            );
          }
        } else {
          if (msg.requestId !== requestIdRef.current) return;
          completedWorkersRef.current++;
          if (completedWorkersRef.current >= PERTURBATION_WORKER_COUNT) {
            setProgress(null);
          }
        }
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
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [paintChunks]);

  const cancelRender = useCallback(() => {
    const id = ++requestIdRef.current;
    pendingChunksRef.current = [];
    pixelsReceivedRef.current = 0;
    totalPixelsRef.current = 0;
    completedWorkersRef.current = 0;
    setProgress(null);

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    const cancelMessage: CancelRequest = { type: "cancel", requestId: id };
    refWorkerRef.current?.postMessage(cancelMessage);
    for (const w of pertWorkersRef.current) {
      w.postMessage(cancelMessage);
    }
  }, []);

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

      totalPixelsRef.current = width * height;
      pixelsReceivedRef.current = 0;
      completedWorkersRef.current = 0;
      pendingChunksRef.current = [];

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
    [],
  );

  const render = useCallback(
    (view: ViewState, width: number, height: number) => {
      const refWorker = refWorkerRef.current;
      if (!refWorker || width === 0 || height === 0) return;

      const id = ++requestIdRef.current;
      setProgress(0);
      pendingChunksRef.current = [];

      const centerReStr = view.centerXHp ?? view.centerX.toPrecision(15);
      const centerImStr = view.centerYHp ?? view.centerY.toPrecision(15);
      const centerKey = `${centerReStr}|${centerImStr}|${view.maxIter}|${width}x${height}`;

      const cached = cachedOrbitRef.current;
      if (cached?.centerKey === centerKey) {
        setProgress(10);
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
          setProgress(Math.min(10, refProgress));
          return;
        }

        const orbit = msg;
        cachedOrbitRef.current = { centerKey, orbit };
        setProgress(10);

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
    [dispatchPerturbationRender],
  );

  return { render, cancelRender, progress };
}
