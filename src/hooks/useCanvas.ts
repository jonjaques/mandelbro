import React from "react";

export type TracerFn = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => void;

export const requestAnimationFrame = window.requestAnimationFrame;

export const cancelAnimationFrame = window.cancelAnimationFrame;

export function useCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  let canvas: HTMLCanvasElement | null,
    context: CanvasRenderingContext2D | null,
    animationFrameId: number,
    tracer: TracerFn;

  function updateContext() {
    canvas = canvasRef.current;
    if (canvas) {
      context = canvas.getContext("2d");
      animationFrameId = requestAnimationFrame(renderFrame);
    }
  }

  function setTracer(tracerFn: TracerFn) {
    tracer = tracerFn;
    return updateContext;
  }

  function renderFrame() {
    if (context && canvas) {
      animationFrameId = requestAnimationFrame(() => tracer(context!, canvas!));
    }
  }

  React.useEffect(() => {
    updateContext();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return [canvasRef, setTracer] as const;
}

export default useCanvas;
