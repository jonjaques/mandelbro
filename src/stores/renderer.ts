import { create } from "zustand";

export interface RenderOptions {
  test?: boolean;
}

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
    set({ rendering: true, done: false });
    setTimeout(() => {
      set({ rendering: false, done: true });
    }, 1000);
  },
}));

export default useRendererStore;
