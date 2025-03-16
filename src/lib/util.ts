import { scaleLinear } from "d3-scale";
import { INITIAL_ORIGIN_X, INITIAL_ORIGIN_Y, INITIAL_ZOOM } from "./constants";

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
 * @param {number} screenWidth - Width of the canvas in pixels
 * @param {number} screenHeight - Height of the canvas in pixels
 * @param {number} cx - Center x-coordinate in the complex plane
 * @param {number} cy - Center y-coordinate in the complex plane
 * @param {number} zoom - Zoom level (higher values = more zoomed in)
 * @returns {Object} - Contains the complex plane ranges and scaling functions
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

// calculate iterations for given zoom level
export function getMaxIterationsForZoom(zoom: number) {
  return Math.floor(100 * Math.log2(zoom));
}
