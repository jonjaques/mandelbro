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

/* ── Vibrance (palette chroma scaling) ───────────────────────────── */

/**
 * Vibrance multiplies palette chroma in OKLCH before clamping to the active
 * gamut. 1.0 is neutral: identical output to the pre-vibrance renderer in
 * sRGB mode, and the default chroma boost in wide-gamut (P3) mode.
 */
export const DEFAULT_VIBRANCE = 1;
export const MIN_VIBRANCE = 0.5;
export const MAX_VIBRANCE = 2;
export const VIBRANCE_STEP = 0.05;

/**
 * Maximum device pixel ratio used by canvas buffers and luminance sampling.
 * On 3x+ displays the extra resolution is barely perceptible while costing
 * 2.25× more memory and compute compared to 2x. Capping at 2 keeps Retina
 * sharpness without paying for invisible detail.
 */
export const MAX_DPR = 2;

/* ── SEO / meta copy ─────────────────────────────────────────────── */

/**
 * Brand short name — the bare brand string, used as a building block for
 * page-specific titles ("<topic> · Mandelbrot Renderer · <BRAND>").
 */
export const BRAND_NAME = "Mandelbro";

/**
 * Tag line — short marketing phrase appended to the brand on the home page
 * title and used in OG site name. Keeps the most-searched terms ("mandelbrot
 * set", "fractal", "deep zoom", "browser") inside the visible 60-char window
 * Google typically renders before truncation.
 */
export const SITE_TAGLINE =
  "Mandelbrot Set Fractal Explorer & Deep Zoom Renderer";

/** Page title — used by the layout, OG tags, and Twitter cards. */
export const SITE_TITLE = `${BRAND_NAME} — ${SITE_TAGLINE} (Online, Free)`;

/**
 * Page description — used by the layout `<meta name="description">`,
 * OG description, Twitter description, and JSON-LD. Aims for ~150-160 chars
 * so Google renders the full snippet, and front-loads the highest-volume
 * keywords ("mandelbrot set", "fractal", "browser").
 */
export const SITE_DESCRIPTION =
  "Explore the Mandelbrot set in your browser — a free, open-source fractal renderer with arbitrary-precision deep zoom past 10^50×, smooth color palettes, and shareable URLs.";

/**
 * Keyword cluster — driven by competitor analysis and Google "People Also
 * Search" data for "mandelbrot", "mandelbrot set", "fractals", "fractal
 * generator", "trippy", and "fractal renderer". Modern crawlers don't weight
 * <meta keywords> heavily but several alternative search engines (DuckDuckGo,
 * Yandex, Kagi) and AI crawlers still parse them.
 */
export const SITE_KEYWORDS = [
  "mandelbrot",
  "mandelbrot set",
  "mandelbrot set explorer",
  "mandelbrot renderer",
  "mandelbrot viewer",
  "mandelbrot zoom",
  "mandelbrot deep zoom",
  "mandelbrot generator",
  "mandelbrot js",
  "mandelbrot javascript",
  "fractal",
  "fractals",
  "fractal explorer",
  "fractal viewer",
  "fractal generator",
  "fractal renderer",
  "online fractal",
  "interactive fractal",
  "browser fractal",
  "psychedelic fractal",
  "trippy fractal",
  "trippy visualizer",
  "infinite zoom",
  "perturbation theory",
  "series approximation",
  "arbitrary precision",
  "complex plane",
  "complex numbers",
  "math visualization",
  "fractal art",
  "seahorse valley",
  "elephant valley",
  "minibrot",
  "PWA",
].join(", ");

/** References page title — includes the brand for consistency, but leads with the page topic. */
export const REFERENCES_TITLE = `Mandelbrot Set Algorithms & References — ${BRAND_NAME}`;

/** References page description — used by the layout and JSON-LD on `/references`. */
export const REFERENCES_DESCRIPTION =
  "Algorithms, publications, and techniques behind Mandelbro's Mandelbrot set renderer: perturbation theory, series approximation, smooth coloring, and Brent cycle detection.";

/** About page title. */
export const ABOUT_TITLE = `What Is the Mandelbrot Set? An Interactive Guide — ${BRAND_NAME}`;

/** About page description. */
export const ABOUT_DESCRIPTION =
  "A plain-English guide to the Mandelbrot set: what it is, how the fractal is generated from z² + c, and how Mandelbro renders deep zoom in your browser using perturbation theory.";

/** Generic landing-page title builder for preset locations. */
export function locationPageTitle(location: string): string {
  return `${location} — Mandelbrot Set Deep Zoom | ${BRAND_NAME}`;
}

/** Generic landing-page description builder for preset locations. */
export function locationPageDescription(
  location: string,
  summary: string,
): string {
  return `${location}: ${summary} Open it instantly in Mandelbro, a free browser-based Mandelbrot set fractal renderer with arbitrary-precision deep zoom.`;
}
