export const BUILTIN_COLOR_SCHEMES = [
  "classic",
  "fire",
  "ocean",
  "grayscale",
  "psychedelic",
  "ice",
  "neon",
] as const;

export const D3_CYCLICAL_COLOR_SCHEMES = ["rainbow", "sinebow"] as const;

export const D3_DIVERGING_COLOR_SCHEMES = [
  "brbg",
  "prgn",
  "piyg",
  "puor",
  "rdbu",
  "rdgy",
  "rdylbu",
  "rdylgn",
  "spectral",
] as const;

export const D3_SEQUENTIAL_COLOR_SCHEMES = [
  "blues",
  "bugn",
  "bupu",
  "cividis",
  "cool",
  "cubehelix-default",
  "gnbu",
  "greens",
  "greys",
  "inferno",
  "magma",
  "orrd",
  "oranges",
  "plasma",
  "pubu",
  "pubugn",
  "purd",
  "purples",
  "rdpu",
  "reds",
  "turbo",
  "viridis",
  "warm",
  "ylgn",
  "ylgnbu",
  "ylorbr",
  "ylorrd",
] as const;

export const COLOR_SCHEMES = [
  ...BUILTIN_COLOR_SCHEMES,
  ...D3_CYCLICAL_COLOR_SCHEMES,
  ...D3_DIVERGING_COLOR_SCHEMES,
  ...D3_SEQUENTIAL_COLOR_SCHEMES,
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];
