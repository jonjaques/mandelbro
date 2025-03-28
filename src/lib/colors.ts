import { color } from "d3-color";
import {
  interpolateGreys,
  interpolateTurbo,
  interpolateInferno,
  interpolateWarm,
  interpolateCool,
  interpolateRainbow,
} from "d3-scale-chromatic";
import { COLOR_LEVELS } from "./constants";

export const interpolators = {
  monochrome: interpolateGreys,
  turbo: interpolateTurbo,
  inferno: interpolateInferno,
  warm: interpolateWarm,
  cool: interpolateCool,
  rainbow: interpolateRainbow,
} as const;

export type ColorScheme = keyof typeof interpolators;

export const colors = {
  monochrome: "Monochrome",
  turbo: "Turbo",
  inferno: "Inferno",
  warm: "Warm",
  cool: "Cool",
  rainbow: "Rainbow",
} as const;

export const colorLuts = Object.keys(colors).reduce(
  (acc, key) => {
    const k: ColorScheme = key as ColorScheme;
    acc[k] = generateLUT(k, COLOR_LEVELS);
    return acc;
  },
  {} as { [key in ColorScheme]: Uint8Array },
);

export function getColorForIteration(
  iteration: number,
  maxIterations: number,
  colorScheme: ColorScheme,
  zr?: number,
  zi?: number,
) {
  const colorFloat = iteration >= maxIterations ? 0 : iteration / maxIterations;
  // const smoothFloat = smoothColor(iteration, maxIterations, zr, zi);
  // console.log(colorFloat, smoothFloat);

  // map float to color LUT
  const lutIndex = Math.floor(colorFloat * COLOR_LEVELS);

  const offset = lutIndex * 3;
  return {
    r: colorLuts[colorScheme][offset],
    g: colorLuts[colorScheme][offset + 1],
    b: colorLuts[colorScheme][offset + 2],
  } as const;
}

export function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  screenWidth: number,
  py: number,
  color: string | { r: number; g: number; b: number } = "white",
) {
  ctx.fillStyle =
    typeof color === "string"
      ? color
      : `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fillRect(0, py, screenWidth, 1);
}

function generateLUT(colorScheme: ColorScheme, levels: number): Uint8Array {
  const lut = new Uint8Array(levels * 3);
  const interpolate = interpolators[colorScheme];
  for (let i = 0; i < levels; i++) {
    const colorStr = interpolate(i / levels);
    const { r, g, b } = color(colorStr)!.rgb();
    const offset = i * 3;
    lut[offset] = r;
    lut[offset + 1] = g;
    lut[offset + 2] = b;
  }
  return lut;
}
