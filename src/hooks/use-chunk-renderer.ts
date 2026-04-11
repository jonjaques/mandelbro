import { useCallback, useRef, useState } from "react";
import type { ChunkResult, RenderComplete } from "@/lib/mandelbrot/types";

type ChunkPipelineMessage = ChunkResult | RenderComplete;

/**
 * Shared progressive chunk queue, rAF-batched painting, and progress tracking
 * for Mandelbrot worker pools (standard + perturbation phase 2).
 */
export function useChunkRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const requestIdRef = useRef(0);
  const pendingChunksRef = useRef<ChunkResult[]>([]);
  const rafIdRef = useRef(0);
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
      ctx.putImageData(imgData, 0, chunk.y);
    }
  }, [canvasRef]);

  const handleChunkMessage = useCallback(
    (
      msg: ChunkPipelineMessage,
      workerCount: number,
      progressOffset = 0,
      progressScale = 100,
    ) => {
      if (msg.type === "chunk") {
        if (msg.requestId !== requestIdRef.current) return;

        pendingChunksRef.current.push(msg);
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(paintChunks);
        }

        pixelsReceivedRef.current += msg.width * msg.height;
        const total = totalPixelsRef.current;
        if (total > 0) {
          setProgress(
            Math.min(
              100,
              progressOffset +
                (pixelsReceivedRef.current / total) * progressScale,
            ),
          );
        }
      } else {
        if (msg.requestId !== requestIdRef.current) return;
        completedWorkersRef.current++;
        if (completedWorkersRef.current >= workerCount) {
          setProgress(null);
        }
      }
    },
    [paintChunks],
  );

  /** Phase 2: set pixel budget and clear per-pixel counters (progress unchanged). */
  const armPixelPhase = useCallback((totalPixels: number) => {
    totalPixelsRef.current = totalPixels;
    pendingChunksRef.current = [];
    pixelsReceivedRef.current = 0;
    completedWorkersRef.current = 0;
  }, []);

  /** Standard pipeline: arm pixels and show 0% while workers run. */
  const resetForNewRender = useCallback(
    (totalPixels: number) => {
      armPixelPhase(totalPixels);
      setProgress(0);
    },
    [armPixelPhase],
  );

  /** Clear chunk queue and pixel counters only (perturbation phase 1 start). */
  const clearChunkQueueAndPixelCounters = useCallback(() => {
    pendingChunksRef.current = [];
    pixelsReceivedRef.current = 0;
    completedWorkersRef.current = 0;
  }, []);

  /** Reference-orbit progress (0–10%) and explicit hides. */
  const setChunkProgress = useCallback((value: number | null) => {
    setProgress(value);
  }, []);

  /**
   * Next monotonic request id, empty queues, hide progress, cancel pending rAF.
   * Return value is the new id (for worker cancel messages).
   */
  const cancelBase = useCallback(() => {
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
    return id;
  }, []);

  const cancelPendingRaf = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
  }, []);

  return {
    requestIdRef,
    progress,
    paintChunks,
    handleChunkMessage,
    resetForNewRender,
    armPixelPhase,
    clearChunkQueueAndPixelCounters,
    setChunkProgress,
    cancelBase,
    cancelPendingRaf,
  };
}
