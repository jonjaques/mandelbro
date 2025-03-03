import { create } from "zustand";

export interface RenderOptions {}

export interface RendererState {
  rendering: boolean;
  done: boolean;
  render: (options: RenderOptions) => void;
}

export const initialState: RendererState = {
  rendering: false,
  done: false,
  render: () => {},
};

export const useRendererStore = create<RendererState>((set) => ({
  ...initialState,
  render: (options: RenderOptions) => {
    console.log("rendering", options);
    set({ rendering: true });
    setTimeout(() => {
      set({ rendering: false, done: true });
    }, 1000);
  },
}));

export default useRendererStore;
