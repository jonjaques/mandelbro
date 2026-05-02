/**
 * useCanvasLuminance — samples canvas pixels behind a DOM element to determine
 * whether the underlying content is visually light or dark.
 *
 * This is useful for overlays (like the brand mark) that sit on top of the
 * fractal canvas and need their text color to adapt for readability. The hook
 * polls the canvas at a configurable interval, reads the pixel region behind
 * the target element, and returns a boolean indicating whether the background
 * is light (luminance > 128).
 *
 * ## How It Works
 *
 * 1. Gets the target element's bounding rect (CSS pixels)
 * 2. Scales to device pixels (matching the canvas buffer resolution)
 * 3. Reads a sparse grid of pixels via `getImageData`
 * 4. Computes average luminance using the BT.601 formula: `0.299R + 0.587G + 0.114B`
 * 5. Returns `true` if average luminance > 128 (light), `false` otherwise (dark)
 *
 * The sparse grid sampling (step size ~1/8 of the smaller dimension) keeps the
 * cost negligible — typically reading ~64 pixels regardless of element size.
 */
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { MAX_DPR } from "@/lib/mandelbrot/constants";

/** How often to re-sample the canvas, in milliseconds */
const DEFAULT_INTERVAL_MS = 300;

/**
 * Midpoint of the 0–255 luminance range. Values above this are considered
 * "light" (use dark text); values at or below are "dark" (use light text).
 */
const LUMINANCE_THRESHOLD = 128;

/**
 * Number of evenly-spaced divisions along each axis when building the
 * sampling grid. 8 divisions ≈ 64 sample points (8×8), which is enough
 * to capture the dominant brightness without reading every pixel.
 */
const GRID_DIVISIONS = 8;

/**
 * Minimum step size in device pixels between sample points. Prevents
 * degenerate over-sampling on very small elements where `dimension / 8`
 * would round down to 1–3px, turning the sparse grid into a near-full read.
 */
const MIN_STEP_PX = 4;

/** RGBA: 4 bytes (channels) per pixel in ImageData.data */
const BYTES_PER_PIXEL = 4;

/**
 * BT.601 luminance coefficients — the standard weights for converting
 * sRGB to perceived brightness. Green dominates because human vision is
 * most sensitive to it; blue contributes the least.
 *
 * Formula: Y = 0.299·R + 0.587·G + 0.114·B
 *
 * @see https://en.wikipedia.org/wiki/Rec._601
 */
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

export function useCanvasLuminance(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): boolean {
  const [isLight, setIsLight] = useState(false);
  const lastValueRef = useRef(false);
  const offscreenRef = useRef<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } | null>(null);

  useEffect(() => {
    const sampleLuminance = () => {
      const canvas = canvasRef.current;
      const target = targetRef.current;
      if (!canvas || !target) return;

      const rect = target.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const x = Math.round(rect.left * dpr);
      const y = Math.round(rect.top * dpr);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w <= 0 || h <= 0) return;

      try {
        let offscreen = offscreenRef.current;
        if (!offscreen) {
          const c = document.createElement("canvas");
          const ctx = c.getContext("2d", {
            willReadFrequently: true,
            alpha: false,
          });
          if (!ctx) return;
          offscreen = { canvas: c, ctx };
          offscreenRef.current = offscreen;
        }

        if (offscreen.canvas.width !== w || offscreen.canvas.height !== h) {
          offscreen.canvas.width = w;
          offscreen.canvas.height = h;
        }

        offscreen.ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
        const imageData = offscreen.ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const step = Math.max(
          MIN_STEP_PX,
          Math.floor(Math.min(w, h) / GRID_DIVISIONS),
        );
        let totalLuminance = 0;
        let count = 0;

        for (let sy = 0; sy < h; sy += step) {
          for (let sx = 0; sx < w; sx += step) {
            const idx = (sy * w + sx) * BYTES_PER_PIXEL;
            totalLuminance +=
              LUMA_R * (data[idx] ?? 0) +
              LUMA_G * (data[idx + 1] ?? 0) +
              LUMA_B * (data[idx + 2] ?? 0);
            count++;
          }
        }

        const avgLuminance = count > 0 ? totalLuminance / count : 0;
        const light = avgLuminance > LUMINANCE_THRESHOLD;

        if (light !== lastValueRef.current) {
          lastValueRef.current = light;
          setIsLight(light);
        }
      } catch {
        // Canvas may not be ready yet
      }
    };

    sampleLuminance();
    const interval = setInterval(sampleLuminance, intervalMs);
    return () => {
      clearInterval(interval);
    };
  }, [canvasRef, targetRef, intervalMs]);

  return isLight;
}
