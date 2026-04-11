/**
 * Shared string formatting for coordinates, zoom, and magnification.
 * Used by HUD, settings panel, and favorites list.
 */

import { DEFAULT_ZOOM } from "@/lib/mandelbrot/constants";

function magnification(zoom: number): number {
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
