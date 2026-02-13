import { forwardRef, useCallback, useEffect, useRef } from "react";

interface MandelbrotCanvasProps {
  imageData: ImageData | null;
  onResize: (width: number, height: number) => void;
}

const MAX_DPR = 2;

export const MandelbrotCanvas = forwardRef<
  HTMLCanvasElement,
  MandelbrotCanvasProps
>(function MandelbrotCanvas({ imageData, onResize }, ref) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const canvasRef =
    (ref as React.RefObject<HTMLCanvasElement>) ?? internalRef;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // If the imageData matches canvas size, putImageData directly
    if (
      imageData.width === canvas.width &&
      imageData.height === canvas.height
    ) {
      ctx.putImageData(imageData, 0, 0);
    } else {
      // Draft render at lower resolution — scale up
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(imageData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef, imageData]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const { width, height } = entry.contentRect;

      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;

      onResize(pixelWidth, pixelHeight);
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, onResize]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none"
      style={{ cursor: "crosshair" }}
    />
  );
});
