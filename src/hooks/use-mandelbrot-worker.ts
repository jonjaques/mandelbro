import { useCallback, useEffect, useRef } from "react";
import type { RenderRequest, RenderResult, ViewState } from "@/lib/mandelbrot/types";

interface WorkerHookResult {
  render: (
    view: ViewState,
    width: number,
    height: number,
  ) => void;
}

export function useMandelbrotWorker(
  onResult: (imageData: ImageData) => void,
): WorkerHookResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL("../lib/mandelbrot/worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<RenderResult>) => {
      const { width, height, buffer } = e.data;
      const clamped = new Uint8ClampedArray(buffer);
      const imageData = new ImageData(clamped, width, height);
      onResult(imageData);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [onResult]);

  const render = useCallback(
    (view: ViewState, width: number, height: number) => {
      if (!workerRef.current || width === 0 || height === 0) return;

      const id = ++requestIdRef.current;
      const request: RenderRequest = {
        requestId: id,
        width,
        height,
        centerX: view.centerX,
        centerY: view.centerY,
        zoom: view.zoom,
        maxIter: view.maxIter,
        colorScheme: view.colorScheme,
      };

      workerRef.current.postMessage(request);
    },
    [],
  );

  return { render };
}
