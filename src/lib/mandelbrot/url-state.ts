/**
 * URL hash serialization for shareable Mandelbrot views.
 *
 * The entire view state (center position, zoom level, iteration count, color
 * scheme, anti-aliasing) is encoded in the URL hash fragment, e.g.:
 *   #x=-0.500000000000000&y=0.00000000000000&z=3.50000000&i=200&c=classic&aa=auto
 *
 * For deep zoom (past PRECISION_THRESHOLD), coordinates are stored as
 * arbitrary-precision decimal strings — the full centerXHp/centerYHp/zoomHp
 * values are serialized directly, enabling shareable URLs at 10^50× and beyond.
 *
 * This enables:
 * - **Bookmarking**: save a specific deep-zoom location with full precision
 * - **Sharing**: copy the URL to send someone to the exact same view
 * - **Browser navigation**: back/forward buttons restore previous views
 *
 * Hash (not query string) is used because changes don't cause page reloads
 * and aren't sent to the server.
 */
import {
  ANTIALIAS_MODES,
  ANTIALIAS_SAMPLES,
  PRECISION_THRESHOLD,
  type AntialiasMode,
  COLOR_SCHEMES,
  type AntialiasSamples,
  type ColorScheme,
  type ViewState,
} from "./types";
import { autoIterations } from "./compute";

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
  maxIter: autoIterations(3.5),
  colorScheme: "classic",
  antialias: "auto",
};

const VALID_SCHEMES = new Set<ColorScheme>(COLOR_SCHEMES);
const VALID_ANTIALIAS_MODES = new Set<AntialiasMode>(ANTIALIAS_MODES);
const VALID_ANTIALIAS_SAMPLES = new Set<AntialiasSamples>(ANTIALIAS_SAMPLES);

/**
 * Encode a ViewState as a URL hash string.
 *
 * Precision choices:
 * - Coordinates (x, y): uses arbitrary-precision strings (centerXHp/centerYHp)
 *   when available for deep zoom. Falls back to 15 significant digits from
 *   the double-precision values, which is near the IEEE 754 limit (~15.9
 *   significant digits).
 *
 * - Zoom (z): uses zoomHp when available, else 10 significant digits.
 *   Zoom precision doesn't need to be as high because it's a scale factor,
 *   not a position.
 */
export function serializeToHash(state: ViewState): string {
  const params = new URLSearchParams();
  params.set("x", state.centerXHp ?? state.centerX.toPrecision(15));
  params.set("y", state.centerYHp ?? state.centerY.toPrecision(15));
  params.set("z", state.zoomHp ?? state.zoom.toPrecision(10));
  params.set("i", String(state.maxIter));
  params.set("c", state.colorScheme);
  params.set("aa", String(state.antialias));
  return "#" + params.toString();
}

/**
 * Parse a URL hash string back into a ViewState.
 * Returns null if the hash is empty, malformed, or contains invalid values.
 * Iteration count is clamped to [50, 10000] for safety.
 *
 * Past `PRECISION_THRESHOLD`, coordinate strings longer than 16 chars
 * (x/y) or 11 chars (z) are preserved as high-precision strings in the Hp
 * fields. Shallow-zoom URLs use the same length for `toPrecision` fragments
 * only; those are not stored as Hp so they cannot override live doubles.
 */
export function deserializeFromHash(hash: string): ViewState | null {
  if (!hash || hash === "#") return null;

  const params = new URLSearchParams(hash.slice(1));
  const xStr = params.get("x");
  const yStr = params.get("y");
  const zStr = params.get("z");
  const x = Number(xStr);
  const y = Number(yStr);
  const z = Number(zStr);
  const i = Number(params.get("i"));
  const c = params.get("c") as ColorScheme;
  const aaParam = params.get("aa");
  const aa: AntialiasMode =
    aaParam === null
      ? "auto"
      : aaParam === "auto"
        ? "auto"
        : (Number(aaParam) as AntialiasSamples);

  if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(i)) return null;
  if (!VALID_SCHEMES.has(c)) return null;
  if (
    !VALID_ANTIALIAS_MODES.has(aa) &&
    !VALID_ANTIALIAS_SAMPLES.has(aa as AntialiasSamples)
  ) {
    return null;
  }

  // Only keep arbitrary-precision strings past the perturbation threshold.
  // Shallow URLs still use long `toPrecision` fragments; those are not HP
  // fields and must not shadow live double coordinates after pan/zoom.
  const hasHpCoords =
    z < PRECISION_THRESHOLD &&
    ((xStr != null && xStr.length > 16) ||
      (yStr != null && yStr.length > 16) ||
      (zStr != null && zStr.length > 11));

  return {
    centerX: x,
    centerY: y,
    zoom: z,
    ...(hasHpCoords
      ? {
          centerXHp: xStr ?? undefined,
          centerYHp: yStr ?? undefined,
          zoomHp: zStr ?? undefined,
        }
      : {}),
    maxIter: Math.max(50, Math.min(10000, Math.round(i))),
    colorScheme: c,
    antialias: aa,
  };
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
    debounceTimer = null;
    const hash = serializeToHash(state);
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }, 200);
}

/**
 * Write the hash immediately and cancel any pending debounced update from
 * {@link pushHashState}. Used when the view is committed so the URL matches
 * what is rendered, and before copying a shareable link.
 */
export function flushHashState(state: ViewState): void {
  if (typeof window === "undefined") return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const hash = serializeToHash(state);
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

/** Drop HP string fields when using the standard (double) pipeline. */
export function stripHpFieldsWhenShallow(view: ViewState): ViewState {
  if (view.zoom < PRECISION_THRESHOLD) return view;
  const { centerXHp, centerYHp, zoomHp, ...rest } = view;
  void centerXHp;
  void centerYHp;
  void zoomHp;
  return rest;
}
