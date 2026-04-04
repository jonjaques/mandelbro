import type { AntialiasMode, ColorScheme, ViewState } from "./types";
import { autoIterations } from "./compute";

export interface Favorite {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  zoom: number;
  centerXHp?: string;
  centerYHp?: string;
  zoomHp?: string;
  maxIter: number;
  colorScheme: ColorScheme;
  antialias: AntialiasMode;
  isPreset: boolean;
}

export function viewStateToFavorite(
  view: ViewState,
  name: string,
  id?: string,
): Favorite {
  return {
    id: id ?? crypto.randomUUID(),
    name,
    centerX: view.centerX,
    centerY: view.centerY,
    zoom: view.zoom,
    ...(view.centerXHp != null ? { centerXHp: view.centerXHp } : {}),
    ...(view.centerYHp != null ? { centerYHp: view.centerYHp } : {}),
    ...(view.zoomHp != null ? { zoomHp: view.zoomHp } : {}),
    maxIter: view.maxIter,
    colorScheme: view.colorScheme,
    antialias: view.antialias,
    isPreset: false,
  };
}

export function favoriteToViewState(fav: Favorite): ViewState {
  return {
    centerX: fav.centerX,
    centerY: fav.centerY,
    zoom: fav.zoom,
    ...(fav.centerXHp != null ? { centerXHp: fav.centerXHp } : {}),
    ...(fav.centerYHp != null ? { centerYHp: fav.centerYHp } : {}),
    ...(fav.zoomHp != null ? { zoomHp: fav.zoomHp } : {}),
    maxIter: fav.maxIter,
    colorScheme: fav.colorScheme,
    antialias: fav.antialias,
  };
}

function preset(
  name: string,
  centerX: number,
  centerY: number,
  zoom: number,
  colorScheme: ColorScheme = "classic",
): Favorite {
  return {
    id: `preset-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    centerX,
    centerY,
    zoom,
    maxIter: autoIterations(zoom),
    colorScheme,
    antialias: "auto",
    isPreset: true,
  };
}

export const PRESET_FAVORITES: Favorite[] = [
  preset(
    "Seahorse Valley",
    -0.746759001575747,
    0.0960456531166771,
    0.007697371773,
    "ocean",
  ),
  preset(
    "Elephant Valley",
    0.279314988638172,
    0.00939674211801463,
    0.003949968815,
    "fire",
  ),
  preset(
    "Lightning Bolt",
    -1.315180982097868,
    0.07352926355990851,
    0.0003,
    "neon",
  ),
  preset(
    "Double Spiral",
    -0.0452394340153082,
    0.986796283427352,
    0.00003,
    "psychedelic",
  ),
  preset("Mini Mandelbrot", -1.749, 0.0, 0.05, "classic"),
  preset("Starfish", -0.3742, 0.6598, 0.02, "rainbow"),
  preset("Jewel", -0.235125, 0.827215, 0.00004, "ice"),
];
