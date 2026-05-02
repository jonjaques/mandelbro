/**
 * Single source of truth for site identity, URLs, and deployment context.
 *
 * Imported by Toolbar (compare), layout (OG), settings, and anywhere else
 * that needs to reference the production hostname or repo URL. Keep these
 * in sync with `astro.config.mjs` (which reads `CF_PAGES_URL` at build
 * time for the Astro `site` field).
 */

export const PRODUCTION_HOSTNAME = "mandelbro.jonjaques.com";
export const PRODUCTION_URL = `https://${PRODUCTION_HOSTNAME}`;
export const PAGES_DOMAIN = "mandelbro.pages.dev";
export const SOURCE_CODE_URL = "https://github.com/jonjaques/mandelbro";

export const MIT_LICENSE_URL = "https://opensource.org/licenses/MIT";

export const WIKIPEDIA_MANDELBROT_SET_URL =
  "https://en.wikipedia.org/wiki/Mandelbrot_set";

export const WIKIPEDIA_FRACTAL_URL = "https://en.wikipedia.org/wiki/Fractal";

export const WIKIPEDIA_COMPLEX_DYNAMICS_URL =
  "https://en.wikipedia.org/wiki/Complex_dynamics";

export const AUTHOR_NAME = "Jon Jaques";
export const AUTHOR_URL = "https://github.com/jonjaques";

function isProductionHost(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname === PRODUCTION_HOSTNAME
  );
}

export function isPreviewDeployment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(`.${PAGES_DOMAIN}`)
  );
}

/**
 * Returns a URL to compare the current view against production, or `null`
 * when already on production (no meaningful comparison target).
 */
export function getCompareUrl(): string | null {
  if (typeof window === "undefined") return null;
  if (isProductionHost()) return null;
  return PRODUCTION_URL + window.location.hash;
}
