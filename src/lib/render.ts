import { scaleLinear } from "d3-scale";

import useRendererStore from "../stores/renderer";
import {
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
  MAX_LEVELS,
} from "./constants";

// This function is the naive implementation of the Mandelbrot set rendering.
// Pseudocode from wikipedia: https://en.wikipedia.org/wiki/Mandelbrot_set#Computer_drawings
export function renderNaiveMandelbrot(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  console.log("renderNaiveMandelbrot");
  console.time("renderNaiveMandelbrot");

  const state = useRendererStore.getState();
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const range = getComplexRanges(
    canvas.width,
    canvas.height,
    state.cx,
    state.cy,
    state.zoom
  );

  for (let px = 0; px < canvas.width; px++) {
    for (let py = 0; py < canvas.height; py++) {
      const { x: x0, y: y0 } = range.screenToComplex(px, py);
      const maxIteration = state.iterations || MAX_LEVELS;

      let x = 0;
      let y = 0;
      let iteration = 0;
      while (x * x + y * y <= 4 && iteration < maxIteration) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iteration++;
      }
      const color =
        iteration >= maxIteration
          ? 0
          : Math.floor((iteration / maxIteration) * 255);
      const i = (py * canvas.width + px) * 4;
      imageData.data[i + 0] = color;
      imageData.data[i + 1] = color;
      imageData.data[i + 2] = color;
      imageData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  console.timeEnd("renderNaiveMandelbrot");
  state.renderDone();
}

export function renderNoise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  console.log("renderNoise");
  console.time("renderNoise");

  const state = useRendererStore.getState();
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const color = Math.floor(Math.random() * 255);
    imageData.data[i + 0] = color;
    imageData.data[i + 1] = color;
    imageData.data[i + 2] = color;
    imageData.data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  console.timeEnd("renderNoise");
  state.renderDone();
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
function getComplexRanges(
  screenWidth: number,
  screenHeight: number,
  cx: number = INITIAL_ORIGIN_X,
  cy: number = INITIAL_ORIGIN_Y,
  zoom: number = INITIAL_ZOOM
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
