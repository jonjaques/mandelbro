import { create } from "zustand";
import {
  Algorithm,
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
  MAX_LEVELS,
} from "../lib/constants";
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
  }),
);

export default useRendererStore;
