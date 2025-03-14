import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import hashStorage from "./storage";
import {
  Algorithm,
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
  MAX_LEVELS,
} from "../lib/constants";
import { getComplexRanges } from "../lib/util";
import { type ColorScheme } from "../lib/colors";
import { pick } from "../lib/util";

export interface RenderOptions {
  algorithm: Algorithm;
  cx?: number;
  cy?: number;
  zoom?: number;
  iterations?: number;
  colorScheme?: ColorScheme;
}

export interface RendererState {
  algorithm: Algorithm;
  cx: number;
  cy: number;
  zoom: number;
  iterations: number;
  colorScheme: ColorScheme;
  rendering: boolean;
  done: boolean;
}

export interface RendererActions {
  render: (options: RenderOptions) => void;
  renderDone: () => void;
  clickZoom: (
    event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
    options: Partial<RenderOptions>,
  ) => void;
}

export type RendererInterface = RendererState & RendererActions;

export const initialState: RendererState = {
  algorithm: Algorithm.Naive,
  cx: INITIAL_ORIGIN_X,
  cy: INITIAL_ORIGIN_Y,
  zoom: INITIAL_ZOOM,
  iterations: MAX_LEVELS,
  colorScheme: "monochrome",
  rendering: false,
  done: false,
};

const persistanceOptions = {
  name: "renderer",
  storage: createJSONStorage(() => hashStorage),
  partialize: (state: RendererInterface) =>
    pick(state, ["algorithm", "cx", "cy", "zoom", "iterations", "colorScheme"]),
};

export const useRendererStore = create<RendererInterface>()(
  persist(
    (set) => ({
      ...initialState,
      render: (options: RenderOptions) => {
        console.log("render", options);
        set({ ...options, rendering: true, done: false });
      },
      renderDone: () => {
        console.log("render done");
        set({ rendering: false, done: true });
      },
      clickZoom: (
        event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
        options: Partial<RenderOptions>,
      ) => {
        const { cx, cy, zoom } = options;
        const { width, height } = event.currentTarget;
        const ranges = getComplexRanges(width, height, cx, cy, zoom);

        // Need to remember to multiply by devicePixelRatio
        // Our canvas is scaled up by this factor, but the event coordinates are not
        const { x, y } = ranges.screenToComplex(
          event.clientX * window.devicePixelRatio,
          event.clientY * window.devicePixelRatio,
        );

        // Zoom in by a factor of 2, we may want to make this smarter
        // based on current zoom level in the future
        const newZoom = (options.zoom || 1) * 2;

        set({
          cx: x,
          cy: y,
          zoom: newZoom,
          iterations: calculateIterations(newZoom),

          // kicks off a render
          rendering: true,
          done: false,
        });
      },
    }),
    persistanceOptions,
  ),
);

export default useRendererStore;

// calculate iterations for given zoom level
function calculateIterations(zoom: number) {
  return Math.floor(100 * Math.log2(zoom));
}
