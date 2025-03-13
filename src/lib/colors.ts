import {
  // interpolateBlues,
  // interpolateGreens,
  interpolateGreys,
  // interpolateOranges,
  // interpolatePurples,
  // interpolateReds,
  interpolateTurbo,
  interpolateViridis,
  interpolateInferno,
  // interpolateMagma,
  // interpolatePlasma,
  interpolateCividis,
  interpolateWarm,
  interpolateCool,
  interpolateRainbow,
  interpolateSinebow,
} from "d3-scale-chromatic";

export const interpolators = {
  turbo: interpolateTurbo,
  viridis: interpolateViridis,
  inferno: interpolateInferno,
  cividis: interpolateCividis,
  warm: interpolateWarm,
  cool: interpolateCool,
  rainbow: interpolateRainbow,
  sinebow: interpolateSinebow,
  monochrome: interpolateGreys,
} as const;

export const colors = {
  turbo: "Turbo",
  viridis: "Viridis",
  inferno: "Inferno",
  cividis: "Cividis",
  warm: "Warm",
  cool: "Cool",
  rainbow: "Rainbow",
  sinebow: "Sinebow",
  monochrome: "Monochrome",
} as const;

export type ColorScheme = keyof typeof interpolators;
