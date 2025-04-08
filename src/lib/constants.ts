export const enum Algorithm {
  Noise = "noise",
  Naive = "naive",
  Revised = "revised",
  Fancy = "fancy",
}

export const MANDELBROT_X_MIN = -2.5;

export const MANDELBROT_X_MAX = 1.5;

export const MANDELBROT_Y_MIN = -2;

export const MANDELBROT_Y_MAX = 2;

export const INITIAL_ORIGIN_X = -0.6;

export const INITIAL_ORIGIN_Y = 0;

export const INITIAL_ZOOM = 1;

export const INITIAL_ALGORITHM = Algorithm.Fancy;

export const INITIAL_ITERATIONS = 50;

export const ESCAPE_RADIUS = 4;

export const INITIAL_COLOR_SCHEME = "turbo";

export const TARGET_FPS = 30;

export const COLOR_LEVELS = 256;
