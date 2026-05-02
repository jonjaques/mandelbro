/**
 * Shared string formatting for coordinates, zoom, and magnification.
 * Used by HUD, settings panel, favorites list, and deep-zoom banner.
 */

import { DEFAULT_ZOOM } from "@/lib/mandelbrot/constants";
import type { ViewState } from "@/lib/mandelbrot/types";

/**
 * Number of significant decimal digits used when serializing a double-precision
 * coordinate to a string — close to the ~15.9 digit IEEE 754 limit.
 */
export const COORD_PRECISION_DIGITS = 15;

/**
 * String form of a real coordinate, preferring the high-precision overlay
 * when present (deep zoom) and otherwise falling back to a `toPrecision`
 * representation of the live double.
 */
export function coordToString(value: number, hp?: string): string {
  return hp ?? value.toPrecision(COORD_PRECISION_DIGITS);
}

/**
 * `[centerXStr, centerYStr]` — used by URL serialization, perturbation
 * orbit cache keys, and BigFloat delta application.
 */
export function viewCenterStrings(view: ViewState): [string, string] {
  return [
    coordToString(view.centerX, view.centerXHp),
    coordToString(view.centerY, view.centerYHp),
  ];
}

/** Zoom relative to `DEFAULT_ZOOM` (e.g. 1×, 1000×). */
export function magnification(zoom: number): number {
  return DEFAULT_ZOOM / zoom;
}

/** Zoom line in settings / coordinates HUD (ASCII "x" suffix). */
export function formatZoom(zoom: number): string {
  const mag = magnification(zoom);
  if (mag >= 1e6) return mag.toExponential(2) + "x";
  if (mag >= 1000) return Math.round(mag).toLocaleString() + "x";
  return mag.toFixed(1) + "x";
}

/** Magnification in favorites subtitles (Unicode "×", compact bands). */
export function formatMagnification(zoom: number): string {
  const mag = magnification(zoom);
  if (mag >= 1e6) return `${mag.toExponential(1)}×`;
  if (mag >= 1000) return `${Math.round(mag).toLocaleString()}×`;
  if (mag >= 10) return `${String(Math.round(mag))}×`;
  return `${mag.toFixed(1)}×`;
}

/**
 * Order-of-magnitude badge used by the deep-zoom banner, e.g. `10^30×`.
 * Mirrors how `formatMagnification` rounds toward exponent boundaries.
 */
export function formatMagnificationExponent(zoom: number): string {
  const exp = Math.floor(Math.log10(magnification(zoom)));
  return `10^${String(exp)}×`;
}

/**
 * Format a real/imag coordinate for display.
 * When `maxHpLen` is set (HUD), high-precision strings truncate and doubles use compact formatting.
 * When omitted (settings panel), full HP is shown and doubles use higher precision.
 */
export function formatCoord(n: number, hp?: string, maxHpLen?: number): string {
  const hud = maxHpLen !== undefined;

  if (hp) {
    if (hud && hp.length > maxHpLen) {
      return hp.slice(0, maxHpLen) + "…";
    }
    return hp;
  }

  if (hud) {
    if (Math.abs(n) < 0.0001) return n.toExponential(4);
    return n.toFixed(8);
  }
  if (Math.abs(n) < 0.0001) return n.toExponential(6);
  return n.toPrecision(12);
}
