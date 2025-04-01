import React from "react";

export type DrawFn = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => void;

export function useCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  let canvas: HTMLCanvasElement | null,
    context: CanvasRenderingContext2D | null,
    drawFn: DrawFn;

  // Sets up canvas context
  React.useEffect(() => {
    updateContext();
  }, []);

  return [canvasRef, setDraw] as const;

  function updateContext() {
    canvas = canvasRef.current;
    if (canvas) {
      context = canvas.getContext("2d");
    }
  }

  function setDraw(userDrawFn: DrawFn) {
    drawFn = userDrawFn;
    updateContext();
    return draw;
  }

  function draw() {
    if (context && canvas) {
      drawFn(context, canvas);
    }
  }
}

export default useCanvas;
