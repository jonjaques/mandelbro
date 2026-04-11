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

/** Cap on iterations for BigFloat reference orbit computation. */
export const MAX_SAFE_ITERATIONS = 10000;
