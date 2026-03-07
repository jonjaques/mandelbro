/**
 * URL hash serialization for shareable Mandelbrot views.
 *
 * The entire view state (center position, zoom level, iteration count, color
 * scheme) is encoded in the URL hash fragment, e.g.:
 *   #x=-0.500000000000000&y=0.00000000000000&z=3.50000000&i=200&c=classic
 *
 * This enables:
 * - **Bookmarking**: save a specific deep-zoom location
 * - **Sharing**: copy the URL to send someone to the exact same view
 * - **Browser navigation**: back/forward buttons restore previous views
 *
 * Hash (not query string) is used because changes don't cause page reloads
 * and aren't sent to the server.
 */
import type { ColorScheme, ViewState } from "./types";
import { autoIterations } from "./compute";
import { withPreciseFields } from "./precision";

/**
 * The default "home" view: the classic Mandelbrot set overview.
 * Center at (-0.5, 0) with zoom=3.5 frames the entire set with padding.
 * The slight offset from the origin (centerX = -0.5 instead of 0) is because
 * the Mandelbrot set is not symmetric about the imaginary axis — it extends
 * roughly from Re=-2.5 to Re=1, so -0.5 is roughly the visual center.
 */
export const DEFAULT_VIEW: ViewState = {
  centerX: -0.5,
  centerY: 0,
  zoom: 3.5,
  centerXPrecise: "-0.5",
  centerYPrecise: "0",
  zoomPrecise: "3.5",
  maxIter: autoIterations(3.5),
  colorScheme: "classic",
  precisionMode: "auto",
};

const VALID_SCHEMES = new Set<ColorScheme>([
  "classic",
  "fire",
  "ocean",
  "grayscale",
  "psychedelic",
  "ice",
  "neon",
]);

/**
 * Encode a ViewState as a URL hash string.
 *
 * Precision choices:
 * - Coordinates (x, y): 15 significant digits — this is near the limit of
 *   IEEE 754 double-precision (~15.9 significant digits), preserving the
 *   maximum precision JavaScript can represent. This matters for deep zooms:
 *   at 10^14x magnification, a single digit of precision lost would shift
 *   the view by visible pixels.
 *
 * - Zoom (z): 10 significant digits — zoom precision doesn't need to be as
 *   high because it's a scale factor, not a position.
 */
export function serializeToHash(state: ViewState): string {
  const params = new URLSearchParams();
  params.set("x", state.centerXPrecise);
  params.set("y", state.centerYPrecise);
  params.set("z", state.zoomPrecise);
  params.set("i", String(state.maxIter));
  params.set("c", state.colorScheme);
  params.set(
    "p",
    state.precisionMode === "native"
      ? "n"
      : state.precisionMode === "precise"
        ? "h"
        : "a",
  );
  return "#" + params.toString();
}

/**
 * Parse a URL hash string back into a ViewState.
 * Returns null if the hash is empty, malformed, or contains invalid values.
 * Iteration count is clamped to [50, 5000] for safety.
 */
export function deserializeFromHash(hash: string): ViewState | null {
  if (!hash || hash === "#") return null;

  const params = new URLSearchParams(hash.slice(1));
  const xRaw = params.get("x");
  const yRaw = params.get("y");
  const zRaw = params.get("z");
  const i = Number(params.get("i"));
  const c = params.get("c") as ColorScheme;
  const p = params.get("p");

  if (!xRaw || !yRaw || !zRaw || isNaN(i)) return null;
  if (!VALID_SCHEMES.has(c)) return null;
  if (p && p !== "n" && p !== "a" && p !== "h") return null;

  const x = Number(xRaw);
  const y = Number(yRaw);
  const z = Number(zRaw);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return withPreciseFields({
    centerX: x,
    centerY: y,
    zoom: z,
    centerXPrecise: xRaw,
    centerYPrecise: yRaw,
    zoomPrecise: zRaw,
    maxIter: Math.max(50, Math.min(5000, Math.round(i))),
    colorScheme: c,
    precisionMode: p === "n" ? "native" : p === "h" ? "precise" : "auto",
  });
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Update the URL hash with the current view state, debounced at 200ms.
 *
 * Uses replaceState (not pushState) to avoid flooding the browser's history
 * stack during continuous panning/zooming. Without debouncing, a smooth drag
 * would generate hundreds of history entries per second.
 *
 * The 200ms delay means the URL updates ~5 times/second during interaction,
 * which is enough to keep it roughly in sync without overwhelming the browser.
 */
export function pushHashState(state: ViewState): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const hash = serializeToHash(state);
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }, 200);
}
