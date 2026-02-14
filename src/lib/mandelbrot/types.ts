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
  /** Index of this worker in the pool (0-based) */
  workerIndex?: number;
  /** Total number of workers in the pool */
  workerCount?: number;
}

export interface RenderResult {
  requestId: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}

// --- Streaming protocol types ---

export interface ChunkResult {
  type: "chunk";
  requestId: number;
  width: number;
  y: number;
  height: number;
  buffer: ArrayBuffer;
}

export interface RenderComplete {
  type: "complete";
  requestId: number;
}

export type WorkerOutMessage = ChunkResult | RenderComplete;
