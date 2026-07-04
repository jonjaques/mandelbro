/**
 * Shared utilities for Web Worker files.
 *
 * Worker-safe: no DOM or React dependencies.
 */
import { BAILOUT, LOG2, BASE_BAND_HEIGHT } from "./constants";
import type { AntialiasSamples } from "./types";

/**
 * Smooth (fractional) iteration count, eliminating the visible "banding"
 * that occurs with integer iteration counts.
 *
 * The raw integer iteration count produces discrete color bands. To get a
 * continuous value, we use the "normalized iteration count" formula:
 *
 *   smoothed = iter + 1 - log₂(log₂(|z|))
 *            = iter + 1 - log(log(√(x²+y²))) / log(2)
 *            = iter + 1 - log(½ · log(x²+y²)) / log(2)
 *
 * For interior points (|z|² ≤ BAILOUT after maxIter), we return the raw
 * iteration count, which maps to solid black via the color palette.
 *
 * @see https://en.wikipedia.org/wiki/Mandelbrot_set#Continuous_(smooth)_coloring
 */
export function smoothColor(iterations: number, zMag2: number): number {
  if (zMag2 <= BAILOUT) return iterations;
  // log(√m) ≡ ½·log(m), so the sqrt can be folded into a multiply —
  // one less sqrt per escaped pixel in both pipelines' hot paths.
  return iterations + 1 - Math.log(0.5 * Math.log(zMag2)) / LOG2;
}

/**
 * Adaptive band height: smaller bands for expensive renders so the first
 * chunk arrives sooner and stale work can be cancelled with lower latency.
 */
export function getBandHeight(
  maxIter: number,
  antialiasSamples: AntialiasSamples,
): number {
  if (antialiasSamples >= 4 || maxIter >= 2000) return 4;
  if (antialiasSamples >= 2 || maxIter >= 800) return 8;
  if (maxIter >= 400) return 16;
  return BASE_BAND_HEIGHT;
}

/** Typed wrapper for `self` inside a Web Worker. */
export interface WorkerContext<T> {
  onmessage: ((e: MessageEvent<T>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}
