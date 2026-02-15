import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RenderRequest,
  ViewState,
  ChunkResult,
  WorkerOutMessage,
} from "@/lib/mandelbrot/types";

const WORKER_COUNT =
  typeof navigator === "undefined"
    ? 4
    : Math.min(navigator.hardwareConcurrency || 4, 16);

export function useMandelbrotWorker(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const workersRef = useRef<Worker[]>([]);
  const requestIdRef = useRef(0);
  const pendingChunksRef = useRef<ChunkResult[]>([]);
  const rafIdRef = useRef(0);
  const renderSizeRef = useRef({ width: 0, height: 0 });
  const pixelsReceivedRef = useRef(0);
  const totalPixelsRef = useRef(0);
  const completedWorkersRef = useRef(0);
  const [progress, setProgress] = useState<number | null>(null);

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

      if (chunk.width === canvas.width) {
        // Full resolution — putImageData directly at correct y offset
        ctx.putImageData(imgData, 0, chunk.y);
      } else {
        // Draft render — scale up to canvas size
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = chunk.width;
        tempCanvas.height = chunk.height;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.putImageData(imgData, 0, 0);

        const scaleX = canvas.width / renderSizeRef.current.width;
        const scaleY = canvas.height / renderSizeRef.current.height;

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(
          tempCanvas,
          0,
          0,
          chunk.width,
          chunk.height,
          0,
          chunk.y * scaleY,
          chunk.width * scaleX,
          chunk.height * scaleY,
        );
      }
    }
  }, [canvasRef]);

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
          if (msg.requestId !== requestIdRef.current) return;

          pendingChunksRef.current.push(msg);

          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(paintChunks);
          }

          // Track progress by pixels received across all workers
          pixelsReceivedRef.current += msg.width * msg.height;
          const total = totalPixelsRef.current;
          if (total > 0) {
            setProgress(
              Math.min(100, (pixelsReceivedRef.current / total) * 100),
            );
          }
        } else if (msg.type === "complete") {
          if (msg.requestId !== requestIdRef.current) return;
          completedWorkersRef.current++;
          if (completedWorkersRef.current >= WORKER_COUNT) {
            setProgress(null);
          }
        }
      };

      workers.push(worker);
    }

    workersRef.current = workers;

    return () => {
      workers.forEach((w) => w.terminate());
      workersRef.current = [];
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [paintChunks]);

  const render = useCallback(
    (view: ViewState, width: number, height: number) => {
      const workers = workersRef.current;
      if (workers.length === 0 || width === 0 || height === 0) return;

      const id = ++requestIdRef.current;
      renderSizeRef.current = { width, height };
      totalPixelsRef.current = width * height;
      pixelsReceivedRef.current = 0;
      completedWorkersRef.current = 0;
      setProgress(0);

      // Clear pending chunks from previous request
      pendingChunksRef.current = [];

      for (let i = 0; i < workers.length; i++) {
        const request: RenderRequest = {
          requestId: id,
          width,
          height,
          centerX: view.centerX,
          centerY: view.centerY,
          zoom: view.zoom,
          maxIter: view.maxIter,
          colorScheme: view.colorScheme,
          workerIndex: i,
          workerCount: workers.length,
        };

        workers[i].postMessage(request);
      }
    },
    [],
  );

  return { render, progress };
}
