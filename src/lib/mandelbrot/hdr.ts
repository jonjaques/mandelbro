/**
 * Wide gamut (display-p3) feature detection and canvas context helpers.
 *
 * The detection is a single boolean: the display either supports P3+ wide gamut
 * or it doesn't. When it does, all canvas contexts and ImageData are configured
 * with `colorSpace: "display-p3"` so the same 0–255 Uint8 values are
 * interpreted as the P3 gamut — roughly 25% wider than sRGB.
 */

const STORAGE_KEY = "mandelbro-wide-gamut";

let cachedSupport: boolean | null = null;

/** True when the display supports P3+ wide gamut AND the browser can render it. */
export function detectWideGamutSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport;

  try {
    const hasP3Display = window.matchMedia("(color-gamut: p3)").matches;
    const testCanvas = document.createElement("canvas");
    testCanvas.width = testCanvas.height = 1;
    const ctx = testCanvas.getContext("2d", {
      colorSpace: "display-p3",
    } as CanvasRenderingContext2DSettings);
    cachedSupport = hasP3Display && ctx !== null;
  } catch {
    cachedSupport = false;
  }

  return cachedSupport;
}

/** Read persisted preference, falling back to auto-detection. */
export function getWideGamutPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // localStorage may be unavailable
  }
  return detectWideGamutSupport();
}

/** Persist the user's wide-gamut toggle choice. */
export function setWideGamutPreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Get a 2D canvas context with the correct color space injected.
 * Centralizes all `getContext("2d")` calls so the P3 switch is in one place.
 */
export function getContext2D(
  canvas: HTMLCanvasElement,
  wideGamut: boolean,
  extraOpts?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D | null {
  return canvas.getContext("2d", {
    alpha: false,
    ...extraOpts,
    ...(wideGamut ? { colorSpace: "display-p3" as PredefinedColorSpace } : {}),
  });
}

/**
 * Build ImageData settings appropriate for the current color mode.
 * When wide gamut is active, tags the pixel data as display-p3.
 */
export function imageDataSettings(wideGamut: boolean): ImageDataSettings {
  return wideGamut ? { colorSpace: "display-p3" } : {};
}
