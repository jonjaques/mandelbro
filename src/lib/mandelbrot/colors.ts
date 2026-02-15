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
  const [ar, ag, ab] = a;
  const [br, bg, bb] = b;
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

export function interpolatePalette(stops: RGB[], t: number): RGB {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1) return stops[0] ?? [0, 0, 0];

  const clampedT = Math.max(0, Math.min(1, t));
  const segCount = stops.length - 1;
  const seg = clampedT * segCount;
  const idx = Math.min(Math.floor(seg), segCount - 1);
  const localT = seg - idx;
  const start = stops[idx] ?? stops[0] ?? [0, 0, 0];
  const end = stops[idx + 1] ?? stops[stops.length - 1] ?? start;
  return interpolateColor(start, end, localT);
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
    const iter = iterations[i] ?? maxIter;
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
  return PALETTES[scheme].map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);
}

/**
 * Returns CSS gradient + glow color sampled from the bright inner range
 * of a palette, suitable for the brand mark.
 */
export function getBrandColors(scheme: ColorScheme): {
  gradient: string;
  glow: string;
} {
  const palette = PALETTES[scheme];
  const samples = 6;
  const start = 0.15;
  const end = 0.85;
  const colors: string[] = [];

  for (let i = 0; i < samples; i++) {
    const t = start + (end - start) * (i / (samples - 1));
    const [r, g, b] = interpolatePalette(palette, t);
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }

  // Glow: sample the brightest-feeling point (60% through the palette)
  const [gr, gg, gb] = interpolatePalette(palette, 0.6);

  return {
    gradient: `linear-gradient(90deg, ${colors.join(", ")})`,
    glow: `rgb(${gr}, ${gg}, ${gb})`,
  };
}
