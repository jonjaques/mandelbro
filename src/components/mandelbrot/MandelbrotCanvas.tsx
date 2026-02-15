/**
 * MandelbrotCanvas — full-viewport <canvas> element with DPR-aware sizing.
 *
 * This component manages the canvas element that fills the entire browser
 * viewport. It handles two key responsibilities:
 *
 * 1. **DPR (Device Pixel Ratio) scaling**: On high-DPI displays (Retina, etc.),
 *    CSS pixels and device pixels aren't 1:1. A 100×100 CSS element on a 2x
 *    display has 200×200 physical pixels. We scale the canvas buffer to match
 *    (up to MAX_DPR=2) so the fractal is rendered at the display's native
 *    resolution, not blurry CSS resolution.
 *
 * 2. **Resize tracking**: Uses ResizeObserver to detect viewport changes
 *    (window resize, orientation change, fullscreen toggle) and re-triggers
 *    a full render at the new dimensions.
 *
 * The canvas itself does NO rendering — it's just a pixel buffer. All pixel
 * data comes from the Web Workers via useMandelbrotWorker.
 */
import { forwardRef, useEffect, useRef } from "react";

interface MandelbrotCanvasProps {
  onResize: (width: number, height: number) => void;
}

/**
 * Cap device pixel ratio at 2x. On 3x+ displays (some phones), the extra
 * pixels are barely perceptible but cost 2.25x more memory and compute
 * compared to 2x. This is a pragmatic trade-off: 2x is "Retina quality"
 * and 3x would mean computing 3× the pixels for marginal visual benefit.
 */
const MAX_DPR = 2;

export const MandelbrotCanvas = forwardRef<
  HTMLCanvasElement,
  MandelbrotCanvasProps
>(function MandelbrotCanvas({ onResize }, ref) {
  const internalRef = useRef<HTMLCanvasElement>(null);

  // Forward the internal ref to the parent's ref. This two-ref pattern is
  // needed because we need a stable ref for the ResizeObserver (internalRef)
  // while also exposing the canvas to the parent via forwardRef.
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
      if (!entry) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      // contentRect gives us the CSS dimensions of the element
      const { width, height } = entry.contentRect;

      // Scale CSS dimensions to device pixels for the canvas buffer.
      // The CSS size stays the same (via className), but canvas.width/height
      // control the actual pixel buffer size. The browser stretches the
      // buffer to fit the CSS size, so setting canvas.width = cssWidth * dpr
      // gives us 1:1 device-pixel mapping.
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;

      // Notify the parent of the new device-pixel dimensions so it can
      // trigger a render at the correct resolution
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
      // fixed inset-0: fill the entire viewport
      // touch-none: disable browser touch gestures (we handle them manually)
      className="fixed inset-0 w-full h-full touch-none"
      style={{ cursor: "crosshair" }}
    />
  );
});
