/**
 * Shared constants used across both rendering pipelines.
 *
 * Worker-safe: no DOM or React dependencies.
 */

/**
 * Higher bailout values produce smoother color gradients at the escape boundary
 * because they let |z|² grow larger before we declare "escaped," giving the
 * smooth-coloring log-log formula more dynamic range to work with. The classic
 * bailout is 4 (radius 2), but 256 (radius 16) is used here for much smoother
 * color transitions at virtually no extra cost per pixel.
 */
export const BAILOUT = 256;

export const LOG2 = Math.log(2);

/**
 * The default zoom level of 3.5 corresponds to the "standard view" of the
 * Mandelbrot set: a viewport ~3.5 units wide on the complex plane, centered
 * at (-0.5, 0), which frames the full set with a little padding. The zoom
 * value represents the height of the visible region in complex-plane units.
 */
export const DEFAULT_ZOOM = 3.5;

/** Baseline height of each horizontal band in pixels before adaptive reduction. */
export const BASE_BAND_HEIGHT = 32;

/** Lower bound on user-selectable / URL-deserialized iteration count. */
export const MIN_SAFE_ITERATIONS = 50;

/**
 * Cap on iterations for BigFloat reference orbit computation. Also the upper
 * bound on user-selectable / URL-deserialized iteration count.
 */
export const MAX_SAFE_ITERATIONS = 10000;

/**
 * Maximum device pixel ratio used by canvas buffers and luminance sampling.
 * On 3x+ displays the extra resolution is barely perceptible while costing
 * 2.25× more memory and compute compared to 2x. Capping at 2 keeps Retina
 * sharpness without paying for invisible detail.
 */
export const MAX_DPR = 2;

/* ── SEO / meta copy ─────────────────────────────────────────────── */

/** Page title — used by the layout, OG tags, and Twitter cards. */
export const SITE_TITLE =
  "Mandelbro — Explore the Mandelbrot Set | Infinite Fractal Zoom in Your Browser";

/**
 * Page description — used by the layout `<meta name="description">`,
 * OG description, Twitter description, and JSON-LD.
 */
export const SITE_DESCRIPTION =
  "Zoom endlessly into the Mandelbrot set right in your browser. Mandelbro uses perturbation theory and arbitrary-precision math to render fractal detail far beyond what ordinary viewers can reach — then lets you share any location with a link.";

/** References page title — includes the base SITE_TITLE for brand consistency. */
export const REFERENCES_TITLE = `References & Algorithms — ${SITE_TITLE}`;

/** References page description — used by the layout and JSON-LD on `/references`. */
export const REFERENCES_DESCRIPTION =
  "Algorithms, publications, and techniques behind the Mandelbro fractal explorer: perturbation theory, series approximation, smooth coloring, Brent cycle detection, and more.";
