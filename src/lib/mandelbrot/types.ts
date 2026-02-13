export type ColorScheme =
  | "classic"
  | "fire"
  | "ocean"
  | "grayscale"
  | "psychedelic"
  | "ice"
  | "neon";

export interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
  maxIter: number;
  colorScheme: ColorScheme;
}

export interface RenderRequest {
  requestId: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  zoom: number;
  maxIter: number;
  colorScheme: ColorScheme;
}

export interface RenderResult {
  requestId: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}
