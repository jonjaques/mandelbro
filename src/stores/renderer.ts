import { flushSync } from "react-dom";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { urlStorage } from "./storage";
import {
  Algorithm,
  ESCAPE_RADIUS,
  INITIAL_COLOR_SCHEME,
  INITIAL_ITERATIONS,
  INITIAL_ORIGIN_X,
  INITIAL_ORIGIN_Y,
  INITIAL_ZOOM,
} from "../lib/constants";
import { getComplexRanges, getMaxIterationsForZoom } from "../lib/util";
import type { ColorScheme } from "../lib/colors";
import { pick } from "../lib/util";

export interface RenderOptions {
  algorithm: Algorithm;
  cx?: number;
  cy?: number;
  zoom?: number;
  iterations?: number;
  escapeRadius?: number;
  colorScheme?: ColorScheme;
}

export interface RendererState {
  algorithm: Algorithm;
  cx: number;
  cy: number;
  zoom: number;
  iterations: number;
  escapeRadius: number;
  colorScheme: ColorScheme;
  rendering: boolean;
  done: boolean;
  renderStopFn: () => void;
}

export interface RendererActions {
  render: (options?: RenderOptions) => void;
  renderDone: () => void;
  setRenderStop: (fn: () => void) => void;
  renderCancel: () => void;
  rerender: () => void;
  reset: () => void;
  clickZoom: (
    event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
    options: Partial<RenderOptions>,
  ) => void;
}

export type RendererInterface = RendererState & RendererActions;

export const initialState: RendererState = {
  algorithm: Algorithm.Revised,
  cx: INITIAL_ORIGIN_X,
  cy: INITIAL_ORIGIN_Y,
  zoom: INITIAL_ZOOM,
  iterations: INITIAL_ITERATIONS,
  escapeRadius: ESCAPE_RADIUS,
  colorScheme: INITIAL_COLOR_SCHEME,
  rendering: true,
  done: false,
  renderStopFn: () => {},
};

console.log("initialState", initialState);
export const useRendererStore = create<RendererInterface>()(
  persist(
    (set, get) => ({
      ...initialState,
      reset: () => set(() => initialState),
      render: (options?: RenderOptions) => {
        console.log("render", options);
        set(() => ({ ...options, rendering: true, done: false }));
      },
      rerender: () => {
        const state = get();
        console.log("rerender", state);
        state.renderCancel();
        state.render();
      },
      renderDone: () => {
        console.log("render done");
        set(() => ({ rendering: false, done: true }));
      },
      setRenderStop(fn: () => void) {
        set(() => ({ renderStopFn: fn }));
      },
      renderCancel() {
        console.log("render stop");
        // We need this because the
        // loop limiter (requestAnimationFrame)
        // calls another action that sets rendering
        // false and we need that to get flushed out
        // to the useEffect which initiates rendering
        flushSync(() => {
          get().renderStopFn();
        });
      },
      clickZoom: (
        event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
        options: Partial<RenderOptions>,
        reverse?: boolean,
      ) => {
        const state = get();
        if (state.rendering) {
          console.log("rendering, canceling");
          state.renderCancel();
        }
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
        let newZoom = options.zoom || 1;
        if (event.shiftKey || reverse) {
          newZoom = newZoom / 2;
        } else {
          newZoom = newZoom * 2;
        }

        set(() => ({
          cx: x,
          cy: y,
          zoom: newZoom,
          iterations: getMaxIterationsForZoom(newZoom),
        }));

        state.render();
      },
    }),
    {
      name: "renderer",
      // @ts-expect-error We have a quick and dirty interface, no typecheck needed
      storage: urlStorage,
      // storage: createJSONStorage(() => hashStorage),
      partialize: pickRendererState,
    },
  ),
);

export default useRendererStore;

export function pickRendererState(state: RendererInterface) {
  return pick(state, [
    "algorithm",
    "cx",
    "cy",
    "zoom",
    "escapeRadius",
    "iterations",
    "colorScheme",
  ]);
}
