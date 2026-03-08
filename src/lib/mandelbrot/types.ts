/**
 * Core type definitions for the Mandelbrot rendering pipeline.
 *
 * These types define the contract between the main thread and the Web Worker
 * pool. Messages flow in two directions:
 *
 *   Main thread ──► Worker:     RenderRequest (start/cancel a render)
 *   Worker ──► Main thread:     ChunkResult | RenderComplete (streaming output)
 */
import type { ColorScheme } from "./color-schemes";

export { COLOR_SCHEMES } from "./color-schemes";
export type { ColorScheme } from "./color-schemes";

export const ANTIALIAS_MODES = ["auto", 1, 2, 4] as const;
export const ANTIALIAS_SAMPLES = [1, 2, 4] as const;
export type AntialiasMode = (typeof ANTIALIAS_MODES)[number];
export type AntialiasSamples = (typeof ANTIALIAS_SAMPLES)[number];

/**
 * The complete state of the fractal viewport. This is the single source of
 * truth for "what the user is looking at." It's persisted in the URL hash,
 * passed to workers for rendering, and displayed in the coordinates HUD.
 *
 * - centerX/Y: the complex-plane coordinates at the center of the viewport
 * - zoom: the height of the visible region in complex-plane units
 *         (smaller = more zoomed in)
 * - maxIter: maximum escape-time iterations (higher = more detail but slower)
 * - colorScheme: which color palette to use
 * - antialias: anti-aliasing mode for committed renders
 */
export interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
  maxIter: number;
  colorScheme: ColorScheme;
  antialias: AntialiasMode;
}

/**
 * Message sent from the main thread to a worker to begin (or replace) a render.
 *
 * The `requestId` is a monotonically increasing number used for cancellation:
 * if the worker receives a new request, it checks this ID between bands and
 * abandons stale work.
 *
 * `workerIndex` and `workerCount` control round-robin band distribution:
 * worker N processes bands N, N+count, N+2*count, etc.
 */
export interface RenderRequest {
  type: "render";
  requestId: number;
  width: number; // Render width in pixels
  height: number; // Render height in pixels
  centerX: number;
  centerY: number;
  zoom: number;
  maxIter: number;
  colorScheme: ColorScheme;
  antialiasSamples: AntialiasSamples;
  /** Index of this worker in the pool (0-based) */
  workerIndex?: number;
  /** Total number of workers in the pool */
  workerCount?: number;
}

export interface CancelRequest {
  type: "cancel";
  requestId: number;
}

export type WorkerInMessage = RenderRequest | CancelRequest;

/** Legacy non-streaming result type (retained for compatibility) */
export interface RenderResult {
  requestId: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}

// --- Streaming protocol types ---

/**
 * A single horizontal band of rendered RGBA pixels, sent from a worker to
 * the main thread. The `buffer` is transferred (zero-copy) via the
 * Transferable API, so it becomes detached in the worker after sending.
 *
 * - y: the absolute y-offset of this band within the full render
 * - height: the height of this band (usually 32px, may be less for the last band)
 * - buffer: raw RGBA pixel data (4 bytes per pixel, width × height pixels)
 */
export interface ChunkResult {
  type: "chunk";
  requestId: number;
  width: number;
  y: number;
  height: number;
  buffer: ArrayBuffer;
}

/** Sent by a worker when it has finished processing all of its assigned bands. */
export interface RenderComplete {
  type: "complete";
  requestId: number;
}

/** Discriminated union of all messages a worker can send to the main thread. */
export type WorkerOutMessage = ChunkResult | RenderComplete;
