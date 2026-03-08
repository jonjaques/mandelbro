import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CancelRequest,
  RenderRequest,
  ViewState,
  ChunkResult,
  WorkerOutMessage,
} from "@/lib/mandelbrot/types";
import { resolveAntialiasSamples } from "@/lib/mandelbrot/compute";

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
) {
  const workersRef = useRef<Worker[]>([]);
  const requestIdRef = useRef(0);
  const pendingChunksRef = useRef<ChunkResult[]>([]);
  const rafIdRef = useRef(0);
  const pixelsReceivedRef = useRef(0);
  const totalPixelsRef = useRef(0);
  const completedWorkersRef = useRef(0);
  // Progress: null means no active render, 0-100 means rendering in progress
  const [progress, setProgress] = useState<number | null>(null);

  /**
   * Paint all queued chunks to the canvas in a single rAF callback.
   *
   * This batching strategy ensures we never do more than one DOM/canvas
   * write per frame, regardless of how many chunk messages arrive between
   * frames. Without batching, each postMessage → putImageData would trigger
   * a layout/composite cycle.
   */
  const paintChunks = useCallback(() => {
    rafIdRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // { alpha: false } tells the browser this canvas is always opaque,
    // enabling compositing optimizations (no alpha blending needed)
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Drain the queue atomically
    const chunks = pendingChunksRef.current;
    pendingChunksRef.current = [];

    const currentId = requestIdRef.current;

    for (const chunk of chunks) {
      // Drop stale chunks from a cancelled/superseded render
      if (chunk.requestId !== currentId) continue;

      // Reconstruct an ImageData from the transferred ArrayBuffer.
      // The buffer was transferred via zero-copy postMessage from the worker,
      // so this is just wrapping existing memory — no copying.
      const clamped = new Uint8ClampedArray(chunk.buffer);
      const imgData = new ImageData(clamped, chunk.width, chunk.height);
      // putImageData writes pixels 1:1 directly into the canvas buffer.
      // chunk.y is the band's y-offset within the full canvas.
      ctx.putImageData(imgData, 0, chunk.y);
    }
  }, [canvasRef]);

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
        const msg = e.data;

        if (msg.type === "chunk") {
          // Ignore chunks from stale/cancelled renders
          if (msg.requestId !== requestIdRef.current) return;

          // Queue the chunk for painting on the next animation frame
          pendingChunksRef.current.push(msg);

          // Schedule a paint if one isn't already scheduled.
          // Multiple chunks arriving in the same frame will all be painted
          // together in a single rAF callback.
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(paintChunks);
          }

          // Track progress: sum pixels from all workers to get overall %
          pixelsReceivedRef.current += msg.width * msg.height;
          const total = totalPixelsRef.current;
          if (total > 0) {
            setProgress(
              Math.min(100, (pixelsReceivedRef.current / total) * 100),
            );
          }
        } else {
          // "complete" message — this worker finished all its bands
          if (msg.requestId !== requestIdRef.current) return;
          completedWorkersRef.current++;
          // Hide progress indicator once ALL workers have finished
          if (completedWorkersRef.current >= WORKER_COUNT) {
            setProgress(null);
          }
        }
      };

      workers.push(worker);
    }

    workersRef.current = workers;

    return () => {
      workers.forEach((w) => {
        w.terminate();
      });
      workersRef.current = [];
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [paintChunks]);

  const cancelRender = useCallback(() => {
    const workers = workersRef.current;
    if (workers.length === 0) return;

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

    const cancelMessage: CancelRequest = {
      type: "cancel",
      requestId: id,
    };

    for (const worker of workers) {
      worker.postMessage(cancelMessage);
    }
  }, []);

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

      // Increment request ID to implicitly cancel any in-progress render
      const id = ++requestIdRef.current;
      totalPixelsRef.current = width * height;
      pixelsReceivedRef.current = 0;
      completedWorkersRef.current = 0;
      setProgress(0);

      // Clear pending chunks from previous request
      pendingChunksRef.current = [];

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
          workerIndex: i,
          workerCount: workers.length,
        };

        worker.postMessage(request);
      }
    },
    [],
  );

  return { render, cancelRender, progress };
}
