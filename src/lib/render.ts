import { scaleLinear } from "d3-scale";

import useRendererStore from "../stores/renderer";

// @ts-ignore
window.xScaleLinear = scaleLinear;

const MAX_LEVELS = 255;
const INITIAL_ORIGIN = [-0.6, 0] as const;
const INITIAL_ZOOM = 1;
const MANDELBROT_SCALE_BOUNDS = {
  xMin: -2.5,
  xMax: 1.5,
  yMin: -2,
  yMax: 2,
} as const;

// This function is the naive implementation of the Mandelbrot set rendering.
// Pseudocode from wikipedia: https://en.wikipedia.org/wiki/Mandelbrot_set#Computer_drawings
export function renderNaiveMandelbrot(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  console.log("renderNaiveMandelbrot");
  console.time("renderNaiveMandelbrot");

  const state = useRendererStore.getState();
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  const xRange: [number, number] = [
    MANDELBROT_SCALE_BOUNDS.xMin,
    MANDELBROT_SCALE_BOUNDS.xMax,
  ];

  const yRange: [number, number] = [
    MANDELBROT_SCALE_BOUNDS.yMin,
    MANDELBROT_SCALE_BOUNDS.yMax,
  ];
  // Modify the xRange and yRange to match the aspect ratio of the canvas
  // Yuck! Will fix this later
  adjustAspectRatio(xRange, yRange, canvas);

  const xScale = scaleLinear().domain([0, canvas.width]).range(xRange);
  const yScale = scaleLinear().domain([0, canvas.height]).range(yRange);

  for (let px = 0; px < canvas.width; px++) {
    for (let py = 0; py < canvas.height; py++) {
      const x0 = xScale(px);
      const y0 = yScale(py);
      let x = 0;
      let y = 0;
      let iteration = 0;
      const maxIteration = MAX_LEVELS / 4;
      while (x * x + y * y <= 4 && iteration < maxIteration) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iteration++;
      }
      const color =
        iteration >= maxIteration
          ? 0
          : Math.floor((iteration / maxIteration) * MAX_LEVELS);
      const i = (py * canvas.width + px) * 4;
      imageData.data[i + 0] = color;
      imageData.data[i + 1] = color;
      imageData.data[i + 2] = color;
      imageData.data[i + 3] = MAX_LEVELS;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  console.timeEnd("renderNaiveMandelbrot");
  state.renderDone();
}

// Borrowed from https://github.com/cslarsen/mandelbrot-js/blob/master/mandelbrot.js#L264
function adjustAspectRatio(
  xRange: [number, number],
  yRange: [number, number],
  canvas: HTMLCanvasElement,
) {
  const ratio =
    Math.abs(xRange[1] - xRange[0]) / Math.abs(yRange[1] - yRange[0]);
  const sRatio = canvas.width / canvas.height;
  if (sRatio > ratio) {
    const xf = sRatio / ratio;
    xRange[0] *= xf;
    xRange[1] *= xf;
  } else {
    const yf = ratio / sRatio;
    yRange[0] *= yf;
    yRange[1] *= yf;
  }
}

export function renderNoise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
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
