import { forwardRef, useEffect, useRef } from "react";

interface MandelbrotCanvasProps {
  onResize: (width: number, height: number) => void;
}

const MAX_DPR = 2;

export const MandelbrotCanvas = forwardRef<
  HTMLCanvasElement,
  MandelbrotCanvasProps
>(function MandelbrotCanvas({ onResize }, ref) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) ?? internalRef;

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
