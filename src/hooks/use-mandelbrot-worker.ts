import { useCallback, useEffect, useRef } from "react";
import type {
  CancelRequest,
  RenderRequest,
  ViewState,
  WorkerOutMessage,
} from "@/lib/mandelbrot/types";
import { resolveAntialiasSamples } from "@/lib/mandelbrot/compute";
import { useChunkRenderer } from "@/hooks/use-chunk-renderer";

/**
 * Number of Web Workers in the rendering pool.
 *
 * Each worker processes a subset of the horizontal bands (round-robin striping),
 * so N workers means each worker does ~1/N of the total work. Capped at 16 to
 * avoid diminishing returns from thread overhead. Falls back to 4 during SSR
 * (where navigator is undefined).
 */
const WORKER_COUNT =
  typeof navigator === "undefined"
    ? 4
    : Math.min(navigator.hardwareConcurrency || 4, 16);

/**
 * Hook that manages the Web Worker pool and progressive rendering pipeline.
 *
 * ## Architecture
 *
 * ```
 *  render(view, w, h)
 *       │
 *       ├──► Worker 0: bands 0, N, 2N, ...  ──► chunks ──┐
 *       ├──► Worker 1: bands 1, N+1, 2N+1, ...──► chunks ──┤
 *       ├──► Worker 2: bands 2, N+2, 2N+2, ...──► chunks ──┤
 *       │    ...                                            │
 *       │                                                   ▼
 *       │                              pendingChunksRef (queue)
 *       │                                                   │
 *       │                              requestAnimationFrame │
 *       │                                                   ▼
 *       │                                 paintChunks → canvas
 * ```
 *
 * ## Cancellation
 *
 * Each render call increments a monotonic requestId. Workers and the main thread
 * both check this ID: stale chunks from a superseded render are silently dropped.
 * This means starting a new render implicitly cancels any in-progress render.
 *
 * Renders always target the canvas's native pixel dimensions. Interaction
 * previews are handled separately by reusing the already-rendered canvas.
 */
export function useMandelbrotWorker(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  wideGamutRef: React.RefObject<boolean>,
  vibranceRef: React.RefObject<number>,
) {
  const workersRef = useRef<Worker[]>([]);
  const {
    requestIdRef,
    progress,
    handleChunkMessage,
    resetForNewRender,
    cancelBase,
    cancelPendingRaf,
  } = useChunkRenderer(canvasRef, wideGamutRef);

  // ── Worker pool lifecycle ──────────────────────────────────────────
  //
  // Workers are created once on mount and terminated on unmount.
  // Each worker runs worker.ts, which processes RenderRequests and
  // streams back ChunkResult messages.
  useEffect(() => {
    const workers: Worker[] = [];

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = new Worker(
        new URL("../lib/mandelbrot/worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        handleChunkMessage(e.data, WORKER_COUNT, 0, 100);
      };

      workers.push(worker);
    }

    workersRef.current = workers;

    return () => {
      workers.forEach((w) => {
        w.terminate();
      });
      workersRef.current = [];
      cancelPendingRaf();
    };
  }, [handleChunkMessage, cancelPendingRaf]);

  const cancelRender = useCallback(() => {
    const workers = workersRef.current;
    if (workers.length === 0) return;

    const id = cancelBase();

    const cancelMessage: CancelRequest = {
      type: "cancel",
      requestId: id,
    };

    for (const worker of workers) {
      worker.postMessage(cancelMessage);
    }
  }, [cancelBase]);

  /**
   * Dispatch a render request to all workers.
   *
   * Each worker receives the same view/dimensions but a different workerIndex,
   * causing them to process interleaved bands (round-robin). For example with
   * 4 workers and 32px bands:
   *   Worker 0: rows 0-31, 128-159, 256-287, ...
   *   Worker 1: rows 32-63, 160-191, 288-319, ...
   *   Worker 2: rows 64-95, 192-223, 320-351, ...
   *   Worker 3: rows 96-127, 224-255, 352-383, ...
   *
   * This interleaving ensures the image fills in evenly from all regions
   * rather than top-to-bottom, giving a better progressive-display experience.
   */
  const render = useCallback(
    (view: ViewState, width: number, height: number) => {
      const workers = workersRef.current;
      if (workers.length === 0 || width === 0 || height === 0) return;

      const id = ++requestIdRef.current;
      resetForNewRender(width * height);

      for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        if (!worker) continue;

        const request: RenderRequest = {
          type: "render",
          requestId: id,
          width,
          height,
          centerX: view.centerX,
          centerY: view.centerY,
          zoom: view.zoom,
          maxIter: view.maxIter,
          colorScheme: view.colorScheme,
          antialiasSamples: resolveAntialiasSamples(view.antialias, view.zoom),
          wideGamut: wideGamutRef.current,
          vibrance: vibranceRef.current,
          workerIndex: i,
          workerCount: workers.length,
        };

        worker.postMessage(request);
      }
    },
    [requestIdRef, resetForNewRender],
  );

  return { render, cancelRender, progress };
}
