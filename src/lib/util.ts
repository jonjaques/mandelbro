import { scaleLinear } from "d3-scale";
import { INITIAL_ORIGIN_X, INITIAL_ORIGIN_Y, INITIAL_ZOOM } from "./constants";
const { log2, pow, floor } = Math;

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // type hijinks to make TypeScript happy
  const result: Pick<T, K> = {} as unknown as Pick<T, K>;
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
}

/**
 * Maps screen coordinates to complex plane coordinates while maintaining aspect ratio,
 * using scaleLinear for the transformations.
 *
 * @param {number} screenWidth Width of the canvas in pixels
 * @param {number} screenHeight Height of the canvas in pixels
 * @param {number} cx Center x-coordinate in the complex plane
 * @param {number} cy Center y-coordinate in the complex plane
 * @param {number} zoom - Zoom level (higher values = more zoomed in)
 */
export function getComplexRanges(
  screenWidth: number,
  screenHeight: number,
  cx: number = INITIAL_ORIGIN_X,
  cy: number = INITIAL_ORIGIN_Y,
  zoom: number = INITIAL_ZOOM,
) {
  // Define the aspect ratio of our view into the complex plane
  // Standard view of the Mandelbrot set: x: [-2.5, 1], y: [-2, 2]
  const complexAspectRatio = 3.5 / 4.0; // (1 - (-2.5)) / (2 - (-2))

  // Calculate the screen aspect ratio
  const screenAspectRatio = screenWidth / screenHeight;

  // Base scale factor (how much complex plane is visible at zoom=1)
  const baseScale = 4.0; // This represents the height of the complex plane at zoom=1

  // Calculate the actual scale based on zoom
  const scale = baseScale / zoom;

  // Determine the width and height in the complex plane
  let complexHeight, complexWidth;

  if (screenAspectRatio >= complexAspectRatio) {
    // Screen is wider than the complex plane's natural ratio
    // So we fix the height and adjust the width
    complexHeight = scale;
    complexWidth = scale * screenAspectRatio;
  } else {
    // Screen is taller than the complex plane's natural ratio
    // So we fix the width and adjust the height
    complexWidth = scale * complexAspectRatio;
    complexHeight = complexWidth / screenAspectRatio;
  }

  // Calculate the bounds of the complex plane to render
  const xMin = cx - complexWidth / 2;
  const xMax = cx + complexWidth / 2;
  const yMin = cy - complexHeight / 2;
  const yMax = cy + complexHeight / 2;

  // Create D3 scaling functions for x and y coordinates
  // These map from screen space [0, width/height] to complex plane [min, max]
  const xScale = scaleLinear().domain([0, screenWidth]).range([xMin, xMax]);

  const yScale = scaleLinear().domain([0, screenHeight]).range([yMin, yMax]);

  // Create inverse scales for mapping from complex plane to screen
  const xScaleInverse = scaleLinear()
    .domain([xMin, xMax])
    .range([0, screenWidth]);

  const yScaleInverse = scaleLinear()
    .domain([yMin, yMax])
    .range([0, screenHeight]);

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    // Helper functions using scaleLinear
    screenToComplex: function (px: number, py: number) {
      return { x: xScale(px), y: yScale(py) };
    },
    complexToScreen: function (x: number, y: number) {
      return { px: xScaleInverse(x), py: yScaleInverse(y) };
    },
    // Provide direct access to the scales if needed
    xScale,
    yScale,
    xScaleInverse,
    yScaleInverse,
  };
}

/*
 * Borrowed from Christian Stigen Larsen's mandelbrot-js project:
 * https://github.com/cslarsen/mandelbrot-js/blob/9b2ca5134a566bc5eb6e95dacb38e41ad408949d/mandelbrot.js#L82
 * Copyright 2012, 2018 Christian Stigen Larsen
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License.  You may obtain a copy
 * of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Returns number of iterations and values of Z_{n}^2 = Tr + Ti at the time
 * we either converged (n == iterations) or diverged.  We use these to
 * determined the color at the current pixel.
 *
 * The Mandelbrot set is rendered taking
 *
 *     Z_{n+1} = Z_{n}^2 + C
 *
 * with C = x + iy, based on the "look at" coordinates.
 *
 * The Julia set can be rendered by taking
 *
 *     Z_{0} = C = x + iy
 *     Z_{n+1} = Z_{n} + K
 *
 * for some arbitrary constant K.  The point C for Z_{0} must be the
 * current pixel we're rendering, but K could be based on the "look at"
 * coordinate, or by letting the user select a point on the screen.
 */
export function iterateMandelbrotEquation(
  Cr: number,
  Ci: number,
  escapeRadius: number,
  maxIterations: number,
) {
  let Zr = 0;
  let Zi = 0;
  let Tr = 0;
  let Ti = 0;
  let iterations = 0;

  for (; iterations < maxIterations && Tr + Ti <= escapeRadius; iterations++) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }

  /*
   * A few more iterations to decrease error term:
   * http://linas.org/art-gallery/escape/escape.html
   */
  // This is not effective at the moment, because we don't consider
  // the real/imaginary coords for color picking
  // const ecIterations = 4;
  // for (let e = 0; e < ecIterations; e++) {
  //   Zi = 2 * Zr * Zi + Ci;
  //   Zr = Tr - Ti + Cr;
  //   Tr = Zr * Zr;
  //   Ti = Zi * Zi;
  // }

  return [iterations, Tr, Ti] as const;
}

// calculate iterations for given zoom level
export function getMaxIterationsForZoom(zoom: number) {
  const its = floor(50 * log2(zoom) + 10 * pow(log2(zoom), 2));
  if (its < 50) {
    return 50;
  }
  return its;
}
