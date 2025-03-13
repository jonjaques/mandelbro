import { create } from "zustand";
import {
  Algorithm,
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
  MAX_LEVELS,
} from "../lib/constants";
import { getComplexRanges } from "../lib/render";
import { type ColorScheme } from "../lib/colors";

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
  cx?: number;
  cy?: number;
  zoom?: number;
  iterations?: number;
  colorScheme?: ColorScheme;
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

export const useRendererStore = create<RendererState & RendererActions>(
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
      console.log("zoom", event);
      const ranges = getComplexRanges(
        event.currentTarget.width,
        event.currentTarget.height,
        options.cx,
        options.cy,
        options.zoom,
      );

      const { x, y } = ranges.screenToComplex(
        event.clientX * 2,
        event.clientY * 2,
      );
      const zoom = (options.zoom || 1) * 2;
      set({ cx: x, cy: y, zoom: zoom, iterations: calculateIterations(zoom) });
    },
  }),
);

export default useRendererStore;

// calculate iterations for given zoom level
function calculateIterations(zoom: number) {
  return Math.floor(100 * Math.log2(zoom));
}
