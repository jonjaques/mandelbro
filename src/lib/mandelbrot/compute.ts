const BAILOUT = 256;
const LOG2 = Math.log(2);

export function isInCardioid(x0: number, y0: number): boolean {
  // Main cardioid check
  const q = (x0 - 0.25) * (x0 - 0.25) + y0 * y0;
  if (q * (q + (x0 - 0.25)) <= 0.25 * y0 * y0) return true;

  // Period-2 bulb check
  if ((x0 + 1) * (x0 + 1) + y0 * y0 <= 0.0625) return true;

  return false;
}

export function escapeTime(
  x0: number,
  y0: number,
  maxIter: number,
): [number, number] {
  let x = 0;
  let y = 0;
  let x2 = 0;
  let y2 = 0;
  let i = 0;

  while (x2 + y2 <= BAILOUT && i < maxIter) {
    y = 2 * x * y + y0;
    x = x2 - y2 + x0;
    x2 = x * x;
    y2 = y * y;
    i++;
  }

  return [i, x2 + y2];
}

export function smoothColor(iterations: number, zMag2: number): number {
  if (zMag2 <= BAILOUT) return iterations; // Interior point
  return iterations + 1 - Math.log(Math.log(Math.sqrt(zMag2))) / LOG2;
}

export function computeFrame(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number,
): Float64Array {
  const result = new Float64Array(width * height);
  const aspectRatio = width / height;
  const halfZoom = zoom / 2;

  const xMin = centerX - halfZoom * aspectRatio;
  const yMin = centerY - halfZoom;
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / height;

  for (let py = 0; py < height; py++) {
    const y0 = yMin + py * pixelHeight;
    const rowOffset = py * width;

    for (let px = 0; px < width; px++) {
      const x0 = xMin + px * pixelWidth;

      if (isInCardioid(x0, y0)) {
        result[rowOffset + px] = maxIter;
        continue;
      }

      const [iter, zMag2] = escapeTime(x0, y0, maxIter);
      result[rowOffset + px] = smoothColor(iter, zMag2);
    }
  }

  return result;
}
