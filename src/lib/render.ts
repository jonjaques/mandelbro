import { scaleLinear } from "d3-scale";

import useRendererStore from "../stores/renderer";

const MANDELBROT_SCALE_BOUNDS = {
  xMin: -2.5,
  xMax: 1.5,
  yMin: -2,
  yMax: 2,
} as const;

export function renderNoise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  console.log("renderNoise");

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

  state.renderDone();
}

// This function is the naive implementation of the Mandelbrot set rendering.
// Pseudocode from wikipedia: https://en.wikipedia.org/wiki/Mandelbrot_set#Computer_drawings
export function renderNaiveMandelbrot(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  console.log("renderNaiveMandelbrot");

  const state = useRendererStore.getState();
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  const xScale = scaleLinear()
    .domain([0, canvas.width])
    .range([MANDELBROT_SCALE_BOUNDS.xMin, MANDELBROT_SCALE_BOUNDS.xMax]);

  const yScale = scaleLinear()
    .domain([0, canvas.height])
    .range([MANDELBROT_SCALE_BOUNDS.yMin, MANDELBROT_SCALE_BOUNDS.yMax]);

  for (let px = 0; px < canvas.width; px++) {
    for (let py = 0; py < canvas.height; py++) {
      const x0 = xScale(px);
      const y0 = yScale(py);
      let x = 0;
      let y = 0;
      let iteration = 0;
      const maxIteration = 32;
      while (x * x + y * y <= 4 && iteration < maxIteration) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iteration++;
      }
      const color = Math.floor((iteration / maxIteration) * 255);
      const i = (py * canvas.width + px) * 4;
      imageData.data[i + 0] = color;
      imageData.data[i + 1] = color;
      imageData.data[i + 2] = color;
      imageData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  state.renderDone();
}
