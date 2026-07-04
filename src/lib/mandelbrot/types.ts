/**
 * Core type definitions for both Mandelbrot rendering pipelines.
 *
 * The app runs two pipelines that share common output types:
 *
 * **Standard pipeline** (zoom ≥ PRECISION_THRESHOLD):
 *   Main thread ──► Worker:     RenderRequest (start/cancel)
 *   Worker ──► Main thread:     ChunkResult | RenderComplete (streaming RGBA)
 *
 * **Perturbation pipeline** (zoom < PRECISION_THRESHOLD):
 *   Main thread ──► RefWorker:   ReferenceOrbitRequest (BigFloat center)
 *   RefWorker ──► Main thread:   ReferenceOrbitProgress | ReferenceOrbitComplete
 *   Main thread ──► PertWorker:  PerturbationRenderRequest (ref orbit + zoom)
 *   PertWorker ──► Main thread:  ChunkResult | RenderComplete (same output)
 */
import type { ColorScheme } from "./color-schemes";

export { COLOR_SCHEMES } from "./color-schemes";
export type { ColorScheme } from "./color-schemes";

export const ANTIALIAS_MODES = ["auto", 1, 2, 4] as const;
export const ANTIALIAS_SAMPLES = [1, 2, 4] as const;
export type AntialiasMode = (typeof ANTIALIAS_MODES)[number];
export type AntialiasSamples = (typeof ANTIALIAS_SAMPLES)[number];

/**
 * Zoom level below which we switch from per-pixel double iteration to
 * perturbation: one arbitrary-precision reference orbit, then per-pixel
 * deltas in double. Below ~1e-13, adjacent pixel c values differ by less than
 * can be represented in IEEE 754 (~15–16 decimal digits), so a shared
 * high-precision reference is required for correct deep zoom.
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set
 */
export const PRECISION_THRESHOLD = 1e-13;

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
 * - centerXHp/centerYHp/zoomHp: optional high-precision decimal strings used
 *   when zoomed past PRECISION_THRESHOLD
 */
export interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
  centerXHp?: string | undefined;
  centerYHp?: string | undefined;
  zoomHp?: string | undefined;
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
  /** Use P3 wide-gamut palette LUTs instead of sRGB */
  wideGamut?: boolean;
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

// ---------------------------------------------------------------------------
// Perturbation pipeline message types
//
// Used when zoom < PRECISION_THRESHOLD. Phase 1: one BigFloat reference orbit;
// Phase 2: all pixels as native-double perturbation deltas (Martin / SFT maths).
// https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf
// ---------------------------------------------------------------------------

/** Result of a high-precision reference orbit computation. */
export interface ReferenceOrbit {
  re: Float64Array;
  im: Float64Array;
  iterations: number;
  escaped: boolean;
  cycleDetected: boolean;
  cyclePeriod: number;
  saCoeffAre?: Float64Array;
  saCoeffAim?: Float64Array;
  saCoeffBre?: Float64Array;
  saCoeffBim?: Float64Array;
  saCoeffCre?: Float64Array;
  saCoeffCim?: Float64Array;
}

export interface ReferenceOrbitRequest {
  type: "compute-reference";
  requestId: number;
  centerReStr: string;
  centerImStr: string;
  maxIter: number;
  precisionDigits: number;
  computeSACoefficients: boolean;
  /** View dimensions needed for reference point selection when center escapes */
  width: number;
  height: number;
  zoom: number;
}

export interface ReferenceOrbitProgress {
  type: "reference-progress";
  requestId: number;
  iteration: number;
  maxIter: number;
}

export interface ReferenceOrbitComplete {
  type: "reference-complete";
  requestId: number;
  refOrbitRe: Float64Array;
  refOrbitIm: Float64Array;
  iterations: number;
  escaped: boolean;
  cycleDetected: boolean;
  cyclePeriod: number;
  /** Offset of actual reference point from view center (complex-plane coords) */
  refOffsetRe: number;
  refOffsetIm: number;
  saCoeffAre?: Float64Array;
  saCoeffAim?: Float64Array;
  saCoeffBre?: Float64Array;
  saCoeffBim?: Float64Array;
  saCoeffCre?: Float64Array;
  saCoeffCim?: Float64Array;
}

export type ReferenceWorkerIn = ReferenceOrbitRequest | CancelRequest;
export type ReferenceWorkerOut =
  ReferenceOrbitProgress | ReferenceOrbitComplete;

export interface PerturbationRenderRequest {
  type: "perturbation-render";
  requestId: number;
  width: number;
  height: number;
  refOrbitRe: Float64Array;
  refOrbitIm: Float64Array;
  refIterations: number;
  zoom: number;
  maxIter: number;
  colorScheme: ColorScheme;
  antialiasSamples: AntialiasSamples;
  /** Use P3 wide-gamut palette LUTs instead of sRGB */
  wideGamut?: boolean;
  /** Offset of reference point from view center (complex-plane coords) */
  refOffsetRe: number;
  refOffsetIm: number;
  workerIndex?: number;
  workerCount?: number;
  saCoeffAre?: Float64Array;
  saCoeffAim?: Float64Array;
  saCoeffBre?: Float64Array;
  saCoeffBim?: Float64Array;
  saCoeffCre?: Float64Array;
  saCoeffCim?: Float64Array;
}

export type PerturbationWorkerIn = PerturbationRenderRequest | CancelRequest;
export type PerturbationWorkerOut = ChunkResult | RenderComplete;
