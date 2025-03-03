import { create } from "zustand";

export interface RenderOptions {
  test?: boolean;
}

export interface RendererState {
  rendering: boolean;
  done: boolean;
}

export interface RendererActions {
  render: (options: RenderOptions) => void;
  renderDone: () => void;
}

export const initialState: RendererState = {
  rendering: false,
  done: false,
};

export const useRendererStore = create<RendererState & RendererActions>(
  (set) => ({
    ...initialState,
    render: (options: RenderOptions) => {
      console.log("render", options);
      set({ rendering: true, done: false });
    },
    renderDone: () => {
      console.log("render done");
      set({ rendering: false, done: true });
    },
  })
);

export default useRendererStore;
