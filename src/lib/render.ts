import useRendererStore from "../stores/renderer";
import { getColorForIteration } from "./colors";
import { getComplexRanges } from "./util";

// This function is the naive implementation of the Mandelbrot set rendering.
// Pseudocode from wikipedia: https://en.wikipedia.org/wiki/Mandelbrot_set#Computer_drawings
export function renderNaiveMandelbrot(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  console.log("renderNaiveMandelbrot");
  console.time("renderNaiveMandelbrot");
  const { cx, cy, zoom, iterations, colorScheme, renderDone } =
    useRendererStore.getState();

  const width = canvas.width;
  const height = canvas.height;
  const ranges = getComplexRanges(width, height, cx, cy, zoom);

  for (let py = 0; py < height; py++) {
    const imageData = ctx.createImageData(width, 1);

    for (let px = 0; px < width; px++) {
      const { x: x0, y: y0 } = ranges.screenToComplex(px, py);
      const maxIteration = iterations!;

      let x = 0;
      let y = 0;
      let iteration = 0;
      while (x * x + y * y <= 4 && iteration < maxIteration) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iteration++;
      }

      // We're only painting one row at a time, so no need to multiply by py
      // const i = (py * width + px) * 4;
      const i = px * 4;
      const { r, g, b } = getColorForIteration(
        iteration,
        maxIteration,
        colorScheme!,
      );

      imageData.data[i + 0] = r;
      imageData.data[i + 1] = g;
      imageData.data[i + 2] = b;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, py);
  }

  console.timeEnd("renderNaiveMandelbrot");
  renderDone();
}

export function renderNoise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  console.log("renderNoise");
  console.time("renderNoise");
  const width = canvas.width;
  const height = canvas.height;

  const state = useRendererStore.getState();
  const imageData = ctx.createImageData(width, height);

  const length = imageData.data.length;
  for (let i = 0; i < length; i += 4) {
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
