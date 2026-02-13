import type { ColorScheme } from "./types";

type RGB = [number, number, number];

const PALETTES: Record<ColorScheme, RGB[]> = {
  classic: [
    [0, 7, 100],
    [32, 107, 203],
    [237, 255, 255],
    [255, 170, 0],
    [0, 2, 0],
  ],
  fire: [
    [0, 0, 0],
    [128, 0, 0],
    [255, 65, 0],
    [255, 200, 0],
    [255, 255, 200],
  ],
  ocean: [
    [0, 0, 30],
    [0, 51, 102],
    [0, 128, 200],
    [100, 200, 255],
    [200, 240, 255],
  ],
  grayscale: [
    [0, 0, 0],
    [128, 128, 128],
    [255, 255, 255],
    [128, 128, 128],
    [0, 0, 0],
  ],
  psychedelic: [
    [255, 0, 100],
    [255, 255, 0],
    [0, 255, 100],
    [0, 100, 255],
    [200, 0, 255],
  ],
  ice: [
    [0, 0, 40],
    [50, 80, 160],
    [130, 180, 230],
    [200, 230, 255],
    [255, 255, 255],
  ],
  neon: [
    [0, 0, 0],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 0],
    [0, 255, 0],
  ],
};

function interpolateColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function interpolatePalette(stops: RGB[], t: number): RGB {
  const clampedT = Math.max(0, Math.min(1, t));
  const segCount = stops.length - 1;
  const seg = clampedT * segCount;
  const idx = Math.min(Math.floor(seg), segCount - 1);
  const localT = seg - idx;
  return interpolateColor(stops[idx], stops[idx + 1], localT);
}

export function mapToColors(
  iterations: Float64Array,
  maxIter: number,
  scheme: ColorScheme,
): Uint8ClampedArray {
  const palette = PALETTES[scheme];
  const len = iterations.length;
  const rgba = new Uint8ClampedArray(len * 4);

  for (let i = 0; i < len; i++) {
    const iter = iterations[i];
    const offset = i * 4;

    if (iter >= maxIter) {
      // Interior — black
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 255;
    } else {
      const t = (iter % 256) / 256;
      const color = interpolatePalette(palette, t);
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }

  return rgba;
}

export const COLOR_SCHEME_NAMES: Record<ColorScheme, string> = {
  classic: "Classic",
  fire: "Fire",
  ocean: "Ocean",
  grayscale: "Grayscale",
  psychedelic: "Psychedelic",
  ice: "Ice",
  neon: "Neon",
};

export function getSwatchColors(scheme: ColorScheme): string[] {
  return PALETTES[scheme].map(
    ([r, g, b]) => `rgb(${r}, ${g}, ${b})`,
  );
}
