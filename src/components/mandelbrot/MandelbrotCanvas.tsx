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

  useEffect(() => {
    if (typeof ref === "function") {
      ref(internalRef.current);
      return;
    }
    if (ref) {
      ref.current = internalRef.current;
    }
  }, [ref]);

  useEffect(() => {
    const canvas = internalRef.current;
    if (canvas === null) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const { width, height } = entry.contentRect;

      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;

      onResize(pixelWidth, pixelHeight);
    });

    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [onResize]);

  return (
    <canvas
      ref={internalRef}
      className="fixed inset-0 w-full h-full touch-none"
      style={{ cursor: "crosshair" }}
    />
  );
});
